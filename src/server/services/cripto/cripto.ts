import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { banco, comTenant, type Banco } from "@/server/db/cliente";
import { chaveTenant } from "@/server/db/esquema";

/**
 * Módulo único de criptografia de campos (ADR-0007, ADR-0017 e adendo):
 * o restante do código só chama `criptografar`, `descriptografar` e
 * `indiceCego`. Criptografia em envelope com uma chave de dados por tenant:
 *
 *   chave mestra (cofre) ──tranca──▶ chave de dados do tenant ──tranca──▶ dado
 *
 * O cofre é a única parte que muda entre ambientes: fora da produção, a chave
 * mestra vem do `.env` / configuração secreta; na produção, do AWS KMS.
 *
 * Formato do dado gravado: `c1.<versão da chave>.<iv>.<cifra+etiqueta>`
 * (base64url). O dado fica amarrado ao tenant (dado associado do GCM): copiado
 * para outro tenant, não abre. Nenhuma chave ou dado legível vai para logs.
 */

const ALGORITMO = "aes-256-gcm";
const PREFIXO = "c1";
/** Cache curto das chaves destrancadas (ADR-0017, regra 6). */
const VALIDADE_CACHE_MS = 5 * 60 * 1000;

// --- Cofre da chave mestra -----------------------------------------------------

/** Tranca e destranca chaves de dados com a chave mestra. */
export interface Cofre {
  trancar(chave: Buffer): Promise<string>;
  destrancar(trancada: string): Promise<Buffer>;
}

function chaveDoAmbiente(nome: string): Buffer {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} não definida. Rode "pnpm cripto:gerar-chaves" (veja .env.example).`);
  const chave = Buffer.from(valor, "base64url");
  if (chave.length !== 32) throw new Error(`${nome} precisa ter 32 bytes (base64url).`);
  return chave;
}

/** Cofre local (desenvolvimento e demonstração): chave mestra no ambiente. */
export const cofreLocal: Cofre = {
  async trancar(chave) {
    const iv = randomBytes(12);
    const c = createCipheriv(ALGORITMO, chaveDoAmbiente("CRIPTO_CHAVE_MESTRA"), iv);
    const corpo = Buffer.concat([c.update(chave), c.final(), c.getAuthTag()]);
    return `local1.${iv.toString("base64url")}.${corpo.toString("base64url")}`;
  },
  async destrancar(trancada) {
    const [etiqueta, iv, corpo] = trancada.split(".");
    if (etiqueta !== "local1" || !iv || !corpo) throw new Error("Chave de dados em formato desconhecido.");
    const bruto = Buffer.from(corpo, "base64url");
    const d = createDecipheriv(
      ALGORITMO,
      chaveDoAmbiente("CRIPTO_CHAVE_MESTRA"),
      Buffer.from(iv, "base64url"),
    );
    d.setAuthTag(bruto.subarray(-16));
    return Buffer.concat([d.update(bruto.subarray(0, -16)), d.final()]);
  },
};

let cofreAtual: Cofre = cofreLocal;

/** Troca o cofre (produção: KMS; testes: cofre controlado). */
export function usarCofre(cofre: Cofre): void {
  cofreAtual = cofre;
  cache.clear();
}

// --- Chave de dados do tenant ----------------------------------------------------

type ChaveAberta = { versao: number; chave: Buffer; ate: number };
const cache = new Map<string, ChaveAberta>();
const chavesAntigas = new Map<string, Buffer>(); // `${tenant}:${versao}` → chave

async function chaveAtualDoTenant(tenantId: string, db: Banco): Promise<{ versao: number; chave: Buffer }> {
  const emCache = cache.get(tenantId);
  if (emCache && emCache.ate > Date.now()) return emCache;

  const aberta = await comTenant(
    tenantId,
    async (tx) => {
      const [atual] = await tx
        .select()
        .from(chaveTenant)
        .where(eq(chaveTenant.tenantId, tenantId))
        .orderBy(desc(chaveTenant.versao))
        .limit(1);
      if (atual) return { versao: atual.versao, chave: await cofreAtual.destrancar(atual.chaveTrancada) };
      // Primeira vez: gera a chave de dados do tenant e guarda trancada.
      const chave = randomBytes(32);
      await tx
        .insert(chaveTenant)
        .values({ tenantId, versao: 1, chaveTrancada: await cofreAtual.trancar(chave) })
        .onConflictDoNothing();
      const [gravada] = await tx
        .select()
        .from(chaveTenant)
        .where(eq(chaveTenant.tenantId, tenantId))
        .orderBy(desc(chaveTenant.versao))
        .limit(1);
      return { versao: gravada.versao, chave: await cofreAtual.destrancar(gravada.chaveTrancada) };
    },
    db,
  );
  cache.set(tenantId, { ...aberta, ate: Date.now() + VALIDADE_CACHE_MS });
  return aberta;
}

async function chaveDaVersao(tenantId: string, versao: number, db: Banco): Promise<Buffer> {
  const atual = await chaveAtualDoTenant(tenantId, db);
  if (atual.versao === versao) return atual.chave;
  const id = `${tenantId}:${versao}`;
  const guardada = chavesAntigas.get(id);
  if (guardada) return guardada;
  const linha = await comTenant(
    tenantId,
    async (tx) =>
      (await tx.select().from(chaveTenant).where(eq(chaveTenant.tenantId, tenantId))).find(
        (c) => c.versao === versao,
      ),
    db,
  );
  if (!linha) throw new Error("Chave de dados não encontrada (destruída ou de outro tenant).");
  const chave = await cofreAtual.destrancar(linha.chaveTrancada);
  chavesAntigas.set(id, chave);
  return chave;
}

// --- Operações usadas pelo restante do código ------------------------------------

/** Criptografa um texto do tenant. Vazio continua vazio (campo não preenchido). */
export async function criptografar(tenantId: string, texto: string, db: Banco = banco()): Promise<string> {
  if (texto === "") return "";
  const { versao, chave } = await chaveAtualDoTenant(tenantId, db);
  const iv = randomBytes(12);
  const c = createCipheriv(ALGORITMO, chave, iv);
  c.setAAD(Buffer.from(tenantId));
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final(), c.getAuthTag()]);
  return `${PREFIXO}.${versao}.${iv.toString("base64url")}.${corpo.toString("base64url")}`;
}

/** Descriptografa um texto do tenant. Falha se o dado for de outro tenant ou tiver sido alterado. */
export async function descriptografar(
  tenantId: string,
  cifrado: string,
  db: Banco = banco(),
): Promise<string> {
  if (cifrado === "") return "";
  const [prefixo, versao, iv, corpo] = cifrado.split(".");
  if (prefixo !== PREFIXO || !versao || !iv || !corpo)
    throw new Error("Dado criptografado em formato desconhecido.");
  const chave = await chaveDaVersao(tenantId, Number(versao), db);
  const bruto = Buffer.from(corpo, "base64url");
  const d = createDecipheriv(ALGORITMO, chave, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(tenantId));
  d.setAuthTag(bruto.subarray(-16));
  try {
    return Buffer.concat([d.update(bruto.subarray(0, -16)), d.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível descriptografar o dado (outro tenant ou dado alterado).");
  }
}

/**
 * Índice cego: permite achar um valor exato (ex.: CPF repetido) sem guardá-lo
 * legível. Calculado por tenant (o mesmo CPF dá índices diferentes em tenants
 * diferentes) com chave própria (ADR-0017, regra 3). O valor deve vir
 * normalizado (ex.: CPF só com dígitos).
 */
export function indiceCego(tenantId: string, valor: string): string {
  return createHmac("sha256", chaveDoAmbiente("CRIPTO_CHAVE_INDICE"))
    .update(`${tenantId}:${valor}`)
    .digest("base64url");
}

/**
 * Nova versão da chave de dados do tenant (rotação). Os dados antigos continuam
 * legíveis pela versão gravada em cada um; os novos usam a nova chave.
 */
export async function rotacionarChave(tenantId: string, db: Banco = banco()): Promise<number> {
  const atual = await chaveAtualDoTenant(tenantId, db);
  const versao = atual.versao + 1;
  await comTenant(
    tenantId,
    async (tx) =>
      tx
        .insert(chaveTenant)
        .values({ tenantId, versao, chaveTrancada: await cofreAtual.trancar(randomBytes(32)) }),
    db,
  );
  cache.delete(tenantId);
  return versao;
}

/**
 * Destruição criptográfica (ADR-0017, regra 5): apaga as chaves do tenant; os
 * dados sensíveis dele ficam ilegíveis para sempre, inclusive em backups.
 */
export async function destruirChavesDoTenant(tenantId: string, db: Banco = banco()): Promise<void> {
  await comTenant(tenantId, (tx) => tx.delete(chaveTenant).where(eq(chaveTenant.tenantId, tenantId)), db);
  cache.delete(tenantId);
  for (const id of chavesAntigas.keys()) if (id.startsWith(`${tenantId}:`)) chavesAntigas.delete(id);
}
