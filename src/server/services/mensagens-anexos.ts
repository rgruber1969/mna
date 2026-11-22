import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import {
  chaveDoArquivo,
  gerarLinkDeDownload,
  gerarLinkDeEnvio,
  gravarArquivo,
  lerArquivo,
} from "@/server/arquivos/armazenamento";
import { comTenant } from "@/server/db/cliente";
import { documentoVersao, mensagem, mensagemAnexo } from "@/server/db/esquema";
import { exigirTenant, type Acesso, type AcessoTenant } from "./acesso";
import { verificarArquivo } from "./antivirus";
import { concluirEnvio, iniciarEnvio, TAMANHO_MAXIMO_DOCUMENTO, tipoDoDocumento } from "./documentos";
import { auditar } from "./empresas";
import { contextoSemErro } from "./mensagens";
import { negocioFechado } from "./negocios";

/**
 * Anexos das mensagens (item 16; dominio.md, "Mensageria e avisos"):
 * enviados direto ao armazenamento, conferidos (tipo real e antivírus) e só
 * então ligados a uma mensagem. Quem vê a mensagem (item + canal) baixa o
 * anexo, com auditoria. "Transformar em documento" cria um documento do
 * negócio pelo mesmo caminho de um envio ao data room (mesmas permissões e
 * conferências), visível de início só a quem transformou.
 */

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
type Resultado = { ok: true } | ErroDeServico;

export async function iniciarAnexo(
  acesso: Acesso | null,
  dealId: string,
  dados: { nomeArquivo: string; tamanho: number },
): Promise<{ anexoId: string; url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const nome = String(dados.nomeArquivo ?? "")
    .trim()
    .slice(0, 200);
  if (!uuidValido(dealId) || !nome) return { erro: "mensagens.erros.naoEncontrada" };
  if (!Number.isInteger(dados.tamanho) || dados.tamanho <= 0)
    return { erro: "documentos.erros.envioIncompleto" };
  if (dados.tamanho > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "documentos.erros.grande" };
  const ctx = await contextoSemErro(a, dealId);
  if (!ctx || ctx.canais.length === 0) return { erro: "mensagens.erros.naoEncontrada" };
  const fechado = await negocioFechado(a, dealId);
  if (fechado) return fechado;
  const id = randomUUID();
  const chave = chaveDoArquivo(a.tenant.id, "mensagens", dealId, id);
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(mensagemAnexo).values({
      id,
      tenantId: a.tenant.id,
      dealId,
      nomeArquivo: nome,
      tamanho: dados.tamanho,
      chave,
      enviadoPor: a.usuario.id,
    }),
  );
  return { anexoId: id, url: await gerarLinkDeEnvio(chave, "application/octet-stream") };
}

/** Confere tamanho, tipo real e antivírus; só "disponível" pode ir numa mensagem. */
export async function concluirAnexo(acesso: Acesso | null, anexoId: string): Promise<Resultado> {
  const a = exigirTenant(acesso);
  if (!uuidValido(anexoId)) return { erro: "mensagens.erros.naoEncontrada" };
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(mensagemAnexo)
      .where(and(eq(mensagemAnexo.id, anexoId), eq(mensagemAnexo.enviadoPor, a.usuario.id))),
  );
  if (!x || x.situacao !== "enviando") return { erro: "mensagens.erros.naoEncontrada" };
  const conteudo = await lerArquivo(x.chave);
  const recusar = async (erro: string, situacao?: "bloqueado") => {
    await comTenant(a.tenant.id, (tx) =>
      situacao
        ? tx.update(mensagemAnexo).set({ situacao }).where(eq(mensagemAnexo.id, anexoId))
        : tx.delete(mensagemAnexo).where(eq(mensagemAnexo.id, anexoId)),
    );
    return { erro };
  };
  if (!conteudo || conteudo.length !== x.tamanho) return recusar("documentos.erros.envioIncompleto");
  const tipo = tipoDoDocumento(conteudo, x.nomeArquivo);
  if (!tipo) return recusar("documentos.erros.formato");
  if ((await verificarArquivo(conteudo)) === "bloqueado") {
    await auditar(a, "mensagem.anexo_bloqueado", "deal", x.dealId, { anexoId });
    return recusar("documentos.erros.bloqueado", "bloqueado");
  }
  await comTenant(a.tenant.id, (tx) =>
    tx
      .update(mensagemAnexo)
      .set({ situacao: "disponivel", tipoDeConteudo: tipo })
      .where(eq(mensagemAnexo.id, anexoId)),
  );
  return { ok: true };
}

/** Anexo de uma mensagem que a pessoa vê (item e canal). */
async function anexoVisivel(a: AcessoTenant, anexoId: string) {
  if (!uuidValido(anexoId)) return null;
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ anexo: mensagemAnexo, m: mensagem })
      .from(mensagemAnexo)
      .innerJoin(mensagem, eq(mensagem.id, mensagemAnexo.mensagemId))
      .where(eq(mensagemAnexo.id, anexoId)),
  );
  if (!x || x.anexo.situacao !== "disponivel") return null;
  const ctx = await contextoSemErro(a, x.m.dealId);
  if (!ctx || !ctx.canalVisivel(x.m.canal)) return null;
  const item = await ctx.item({ tipo: x.m.alvoTipo, id: x.m.alvoId });
  return item ? { ...x, item } : null;
}

/** Link temporário de download (auditado). */
export async function linkDoAnexo(
  acesso: Acesso | null,
  anexoId: string,
): Promise<{ url: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const x = await anexoVisivel(a, anexoId);
  if (!x) return { erro: "mensagens.erros.naoEncontrada" };
  await auditar(a, "mensagem.anexo_baixado", "deal", x.m.dealId, { anexoId });
  return { url: await gerarLinkDeDownload(x.anexo.chave, x.anexo.nomeArquivo) };
}

/**
 * Transforma o anexo em documento do negócio (na etapa da conversa, ou geral),
 * pelo mesmo envio do data room: permissão de criar documento na etapa,
 * conferência de tipo, antivírus e texto para a busca.
 */
export async function anexoParaDocumento(
  acesso: Acesso | null,
  anexoId: string,
  dados: { titulo?: string } = {},
): Promise<{ versaoId: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  const x = await anexoVisivel(a, anexoId);
  if (!x) return { erro: "mensagens.erros.naoEncontrada" };
  const conteudo = await lerArquivo(x.anexo.chave);
  if (!conteudo) return { erro: "mensagens.erros.naoEncontrada" };
  const titulo = (dados.titulo?.trim() || x.anexo.nomeArquivo.replace(/\.[^.]+$/, "")).slice(0, 200);
  const inicio = await iniciarEnvio(a, x.m.dealId, {
    titulo,
    etapaId: x.item.etapaId,
    nomeArquivo: x.anexo.nomeArquivo,
    tamanho: conteudo.length,
    comentario: "",
    perfis: [],
    usuarios: [],
  });
  if ("erro" in inicio) return inicio;
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ chave: documentoVersao.chave })
      .from(documentoVersao)
      .where(eq(documentoVersao.id, inicio.versaoId)),
  );
  await gravarArquivo(v.chave, conteudo, "application/octet-stream");
  const fim = await concluirEnvio(a, inicio.versaoId);
  if ("erro" in fim) return fim;
  await auditar(a, "mensagem.anexo_virou_documento", "deal", x.m.dealId, {
    anexoId,
    versaoId: inicio.versaoId,
  });
  return { versaoId: inicio.versaoId };
}
