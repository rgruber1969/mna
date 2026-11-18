import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { apagarArquivo, chaveDoArquivo, gravarArquivo } from "@/server/arquivos/armazenamento";
import { banco, comTenant } from "@/server/db/cliente";
import { eventoAuditoria, tenant } from "@/server/db/esquema";
import { corValida, fonteValida, problemasDeContraste, TOKENS_PADRAO } from "@/config/marca";
import { exigirAdministrador, type Acesso, type AcessoTenant } from "./acesso";
import { colunas, type IdentidadeGravada } from "./marca";

/**
 * Identidade visual do tenant (white label, ADR-0010), editada só pelos
 * administradores do tenant: nome de exibição, logos (fundo claro e escuro),
 * ícone da aba, cores e fonte. Campo vazio = padrão RGRUBER.
 *
 * Imagens: o original nunca é guardado. O servidor decodifica a imagem (só
 * JPG, PNG ou WebP de verdade; SVG não é aceito), limita o tamanho e grava
 * uma imagem NOVA em PNG (com transparência e sem metadados). PNG porque
 * também vai embutido nos e-mails, onde WebP nem sempre funciona. As imagens
 * da marca são públicas: aparecem na tela de entrada, antes do login.
 */

export const IMAGEM_TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB
const FORMATOS = new Set(["jpeg", "png", "webp"]);

export const TIPOS_DE_IMAGEM = {
  logoClaro: { arquivo: "logo-claro", nome: "Logo para fundo claro", largura: 800, altura: 240 },
  logoEscuro: { arquivo: "logo-escuro", nome: "Logo para fundo escuro", largura: 800, altura: 240 },
  icone: { arquivo: "icone", nome: "Ícone da aba", largura: 256, altura: 256 },
} as const;

export type TipoDeImagem = keyof typeof TIPOS_DE_IMAGEM;

export const tipoDeImagemValido = (t: string): t is TipoDeImagem => t in TIPOS_DE_IMAGEM;

type Resultado = { ok: true } | { erro: string };

/** Identidade gravada, para o formulário de configuração (só administradores). */
export async function obterIdentidade(acesso: Acesso | null): Promise<IdentidadeGravada & { nome: string }> {
  const a = exigirAdministrador(acesso);
  const [t] = await banco().select(colunas).from(tenant).where(eq(tenant.id, a.tenant.id));
  return t;
}

async function auditar(a: AcessoTenant, tipo: string, detalhes?: Record<string, string | boolean>) {
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(eventoAuditoria).values({
      tenantId: a.tenant.id,
      tipo,
      atorId: a.usuario.id,
      alvoTipo: "tenant",
      alvoId: a.tenant.id,
      detalhes,
    }),
  );
}

const Dados = z.object({
  nomeExibicao: z.string().trim().max(80, "Nome de exibição muito longo (até 80 caracteres)."),
  corPrimaria: z.string().trim().toLowerCase(),
  corDestaque: z.string().trim().toLowerCase(),
  fonte: z.string().trim(),
});

export type DadosIdentidade = z.input<typeof Dados>;

/** Salva nome de exibição, cores e fonte; recusa cores ilegíveis, com explicação. */
export async function salvarIdentidade(acesso: Acesso | null, dados: DadosIdentidade): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  const r = Dados.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Dados inválidos." };
  const { nomeExibicao, corPrimaria, corDestaque, fonte } = r.data;
  if (!corValida(corPrimaria) || !corValida(corDestaque)) return { erro: "Use cores no formato #RRGGBB." };
  if (!fonteValida(fonte)) return { erro: "Escolha uma fonte da lista." };
  const problemas = problemasDeContraste({ primaria: corPrimaria, destaque: corDestaque });
  if (problemas.length) return { erro: problemas.join(" ") };

  const padrao = (cor: string, p: string) => (cor === p ? null : cor);
  await banco()
    .update(tenant)
    .set({
      nomeExibicao: nomeExibicao || null,
      corPrimaria: padrao(corPrimaria, TOKENS_PADRAO.primaria),
      corDestaque: padrao(corDestaque, TOKENS_PADRAO.destaque),
      fonte: fonte === "manrope" ? null : fonte,
    })
    .where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.identidade.alterada");
  return { ok: true };
}

/** Volta cores e fonte ao padrão RGRUBER (nome e imagens ficam). */
export async function restaurarPadrao(acesso: Acesso | null): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  await banco()
    .update(tenant)
    .set({ corPrimaria: null, corDestaque: null, fonte: null })
    .where(eq(tenant.id, a.tenant.id));
  await auditar(a, "tenant.identidade.padrao_restaurado");
  return { ok: true };
}

/** Decodifica e regrava a imagem: só imagens reais, tamanho limitado, PNG sem metadados. */
export async function processarImagemDaMarca(
  conteudo: Uint8Array,
  tipo: TipoDeImagem,
): Promise<Uint8Array | null> {
  const { largura, altura } = TIPOS_DE_IMAGEM[tipo];
  try {
    const imagem = sharp(conteudo, { failOn: "error", limitInputPixels: 40_000_000 });
    const { format } = await imagem.metadata();
    if (!format || !FORMATOS.has(format)) return null;
    const ajustada =
      tipo === "icone"
        ? imagem.resize(largura, altura, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        : imagem.resize(largura, altura, { fit: "inside", withoutEnlargement: true });
    return await ajustada.png({ compressionLevel: 9 }).toBuffer();
  } catch {
    return null;
  }
}

async function chaveAtual(tenantId: string, tipo: TipoDeImagem): Promise<string | null> {
  const [t] = await banco().select({ chave: tenant[tipo] }).from(tenant).where(eq(tenant.id, tenantId));
  return t?.chave ?? null;
}

export async function enviarImagemDaMarca(
  acesso: Acesso | null,
  tipo: string,
  arquivo: File | null,
): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  if (!tipoDeImagemValido(tipo)) return { erro: "Tipo de imagem inválido." };
  if (!arquivo || arquivo.size === 0) return { erro: "Escolha uma imagem." };
  if (arquivo.size > IMAGEM_TAMANHO_MAXIMO) return { erro: "A imagem deve ter até 2 MB." };
  const png = await processarImagemDaMarca(new Uint8Array(await arquivo.arrayBuffer()), tipo);
  if (!png) return { erro: "Envie uma imagem JPG, PNG ou WebP." };

  const anterior = await chaveAtual(a.tenant.id, tipo);
  const nome = `${TIPOS_DE_IMAGEM[tipo].arquivo}-${randomBytes(8).toString("hex")}.png`;
  const chave = chaveDoArquivo(a.tenant.id, "marca", nome);
  await gravarArquivo(chave, png, "image/png");
  await banco()
    .update(tenant)
    .set({ [tipo]: chave })
    .where(eq(tenant.id, a.tenant.id));
  if (anterior) await apagarArquivo(anterior).catch(() => undefined);
  await auditar(a, "tenant.identidade.imagem_enviada", { tipo });
  return { ok: true };
}

export async function removerImagemDaMarca(acesso: Acesso | null, tipo: string): Promise<Resultado> {
  const a = exigirAdministrador(acesso);
  if (!tipoDeImagemValido(tipo)) return { erro: "Tipo de imagem inválido." };
  const anterior = await chaveAtual(a.tenant.id, tipo);
  if (!anterior) return { ok: true };
  await banco()
    .update(tenant)
    .set({ [tipo]: null })
    .where(eq(tenant.id, a.tenant.id));
  await apagarArquivo(anterior).catch(() => undefined);
  await auditar(a, "tenant.identidade.imagem_removida", { tipo });
  return { ok: true };
}
