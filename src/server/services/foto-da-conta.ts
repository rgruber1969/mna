import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { apagarArquivo, chaveDaConta, gravarArquivo, lerArquivo } from "@/server/arquivos/armazenamento";
import { banco, comTenant } from "@/server/db/cliente";
import { eventoAuditoria, eventoPlataforma, usuario, vinculoTenant } from "@/server/db/esquema";
import type { Acesso } from "./acesso";

/**
 * Foto do usuário (dados-pessoais.md): da conta, vale em todos os tenants e
 * no console. Enviada e removida só pela própria pessoa.
 *
 * Proteção do arquivo: o original nunca é guardado. O servidor decodifica a
 * imagem (o que não for JPG, PNG ou WebP de verdade é recusado) e grava uma
 * imagem NOVA, 256 × 256 px em WebP, sem metadados (EXIF, GPS). Ela é servida
 * só para quem está logado, com verificação de permissão.
 */

export const FOTO_TAMANHO_MAXIMO = 2 * 1024 * 1024; // 2 MB
const LADO = 256;
const FORMATOS = new Set(["jpeg", "png", "webp"]);

type Resultado = { ok: true } | { erro: string };

/** Endereço da foto para o navegador; muda quando a foto muda (evita cache antigo). */
export function enderecoDaFoto(usuarioId: string, chave: string | null | undefined): string | null {
  if (!chave) return null;
  const versao =
    chave
      .split("/")
      .pop()
      ?.replace(/\.webp$/, "") ?? "";
  return `/api/conta/foto/${usuarioId}?v=${versao}`;
}

async function auditar(a: Acesso, tipo: string) {
  if (a.area === "console") {
    await banco()
      .insert(eventoPlataforma)
      .values({ tipo, atorId: a.usuario.id, alvoTipo: "usuario", alvoId: a.usuario.id });
  } else {
    await comTenant(a.tenant.id, (tx) =>
      tx.insert(eventoAuditoria).values({
        tenantId: a.tenant.id,
        tipo,
        atorId: a.usuario.id,
        alvoTipo: "usuario",
        alvoId: a.usuario.id,
      }),
    );
  }
}

async function chaveAtual(usuarioId: string): Promise<string | null> {
  const [u] = await banco().select({ imagem: usuario.image }).from(usuario).where(eq(usuario.id, usuarioId));
  return u?.imagem ?? null;
}

/** Processa a imagem enviada: só imagens reais, recortada em quadrado, sem metadados. */
export async function processarFoto(conteudo: Uint8Array): Promise<Uint8Array | null> {
  try {
    const imagem = sharp(conteudo, { failOn: "error", limitInputPixels: 40_000_000 });
    const { format } = await imagem.metadata();
    if (!format || !FORMATOS.has(format)) return null;
    // rotate() aplica a orientação da câmera; o WebP gerado não leva metadados.
    return await imagem.rotate().resize(LADO, LADO, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

export async function enviarFotoDaConta(acesso: Acesso | null, arquivo: File | null): Promise<Resultado> {
  if (!acesso) return { erro: "Entre de novo para alterar a foto." };
  if (!arquivo || arquivo.size === 0) return { erro: "Escolha uma imagem." };
  if (arquivo.size > FOTO_TAMANHO_MAXIMO) return { erro: "A imagem deve ter até 2 MB." };
  const foto = await processarFoto(new Uint8Array(await arquivo.arrayBuffer()));
  if (!foto) return { erro: "Envie uma imagem JPG, PNG ou WebP." };

  const anterior = await chaveAtual(acesso.usuario.id);
  const chave = chaveDaConta(acesso.usuario.id, `foto-${randomBytes(8).toString("hex")}.webp`);
  await gravarArquivo(chave, foto, "image/webp");
  await banco()
    .update(usuario)
    .set({ image: chave, updatedAt: new Date() })
    .where(eq(usuario.id, acesso.usuario.id));
  if (anterior) await apagarArquivo(anterior).catch(() => undefined);
  await auditar(acesso, "conta.foto.alterada");
  return { ok: true };
}

export async function removerFotoDaConta(acesso: Acesso | null): Promise<Resultado> {
  if (!acesso) return { erro: "Entre de novo para alterar a foto." };
  const anterior = await chaveAtual(acesso.usuario.id);
  if (!anterior) return { ok: true };
  await banco()
    .update(usuario)
    .set({ image: null, updatedAt: new Date() })
    .where(eq(usuario.id, acesso.usuario.id));
  await apagarArquivo(anterior).catch(() => undefined);
  await auditar(acesso, "conta.foto.removida");
  return { ok: true };
}

/**
 * Bytes da foto, se quem pede pode vê-la: a própria pessoa; no console, a
 * equipe da plataforma; num tenant, quem tem vínculo ativo no mesmo tenant.
 */
export async function lerFotoDaConta(acesso: Acesso | null, usuarioId: string): Promise<Uint8Array | null> {
  if (!acesso || !/^[0-9a-f-]{36}$/i.test(usuarioId)) return null;
  if (acesso.usuario.id !== usuarioId && acesso.area === "tenant") {
    const [v] = await comTenant(acesso.tenant.id, (tx) =>
      tx
        .select({ id: vinculoTenant.id })
        .from(vinculoTenant)
        .where(and(eq(vinculoTenant.usuarioId, usuarioId), eq(vinculoTenant.situacao, "ativo"))),
    );
    if (!v) return null;
  }
  const chave = await chaveAtual(usuarioId);
  return chave ? lerArquivo(chave) : null;
}
