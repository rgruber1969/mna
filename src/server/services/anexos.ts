import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ErroDeServico } from "@/i18n/servidor";
import { apagarArquivo, chaveDoArquivo, gravarArquivo, lerArquivo } from "@/server/arquivos/armazenamento";
import { comTenant } from "@/server/db/cliente";
import { anexoCadastro, empresa, pessoa, usuario, vinculoTenant } from "@/server/db/esquema";
import type { Acesso, AcessoTenant } from "./acesso";
import { tipoRealDoArquivo, verificarArquivo } from "./antivirus";
import { criptografar, criptografarArquivo, descriptografar, descriptografarArquivo } from "./cripto/cripto";
import { auditar } from "./empresas";
import { notificar } from "./notificacoes";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Anexos do cadastro de empresas e pessoas (escopo-v1.md, item 34).
 * - Ver a lista: "Empresas e pessoas × ver"; enviar e remover: "× editar";
 *   baixar: "× baixar". Tudo auditado, sem dados pessoais no evento.
 * - Antivírus antes de gravar (ADR-0016) e arquivo criptografado com a chave
 *   do tenant, amarrado ao anexo (ADR-0017, adendo de 2026-11-19); o nome do
 *   arquivo também é criptografado. Download só pelo servidor.
 */

export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

export const CATEGORIAS_DE_EMPRESA = [
  "cartao-cnpj",
  "contrato-social",
  "alteracao-contratual",
  "procuracao",
  "certidao",
  "outro",
] as const;
export const CATEGORIAS_DE_PESSOA = [
  "cpf",
  "rg",
  "cnh",
  "comprovante-endereco",
  "certidao-estado-civil",
  "outro",
] as const;

export type AlvoDoAnexo = { tipo: "empresa" | "pessoa"; id: string };

export type Anexo = {
  id: string;
  categoria: string;
  descricao: string | null;
  nomeArquivo: string;
  tamanho: number;
  situacao: string;
  enviadoPor: string | null;
  criadoEm: Date;
};

type Resultado = { ok: true; id: string } | ErroDeServico;

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

function categoriaValida(alvo: AlvoDoAnexo, categoria: string): boolean {
  const lista: readonly string[] = alvo.tipo === "empresa" ? CATEGORIAS_DE_EMPRESA : CATEGORIAS_DE_PESSOA;
  return lista.includes(categoria);
}

const colunaDoAlvo = (alvo: AlvoDoAnexo) =>
  alvo.tipo === "empresa" ? anexoCadastro.empresaId : anexoCadastro.pessoaId;

/** O registro (empresa ou pessoa) existe no tenant? */
async function alvoExiste(a: AcessoTenant, alvo: AlvoDoAnexo): Promise<boolean> {
  if (!uuidValido(alvo.id)) return false;
  const tabela = alvo.tipo === "empresa" ? empresa : pessoa;
  const [r] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, alvo.id)),
  );
  return !!r;
}

export async function listarAnexos(acesso: Acesso | null, alvo: AlvoDoAnexo): Promise<Anexo[]> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  if (!uuidValido(alvo.id)) return [];
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ anexo: anexoCadastro, enviadoPor: usuario.name })
      .from(anexoCadastro)
      .leftJoin(usuario, eq(usuario.id, anexoCadastro.enviadoPor))
      .where(eq(colunaDoAlvo(alvo), alvo.id))
      .orderBy(desc(anexoCadastro.criadoEm)),
  );
  return Promise.all(
    linhas.map(async ({ anexo: l, enviadoPor }) => ({
      id: l.id,
      categoria: l.categoria,
      descricao: l.descricao,
      nomeArquivo: await descriptografar(a.tenant.id, l.nomeArquivoCifrado),
      tamanho: l.tamanho,
      situacao: l.situacao,
      enviadoPor: enviadoPor ?? null,
      criadoEm: l.criadoEm,
    })),
  );
}

/** Avisa os administradores do tenant de um arquivo bloqueado (ADR-0016, regra 2). */
async function avisarBloqueio(a: AcessoTenant, alvo: AlvoDoAnexo) {
  await comTenant(a.tenant.id, async (tx) => {
    const admins = await tx
      .select({ id: vinculoTenant.usuarioId })
      .from(vinculoTenant)
      .where(and(eq(vinculoTenant.administrador, true), eq(vinculoTenant.situacao, "ativo")));
    for (const adm of admins)
      await notificar(tx, a.tenant.id, adm.id, "arquivo_bloqueado", {}, `/${alvo.tipo}s/${alvo.id}`);
  });
}

/**
 * Grava um anexo já lido em memória. Usado pela tela de anexos e pelo
 * cadastro a partir de documento (o documento lido pode virar anexo).
 */
export async function anexarArquivo(
  acesso: Acesso | null,
  alvo: AlvoDoAnexo,
  dados: { categoria: string; descricao?: string | null; nome: string; conteudo: Uint8Array },
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!categoriaValida(alvo, dados.categoria)) return { erro: "cadastros.anexos.erros.categoria" };
  if (!(await alvoExiste(a, alvo))) return { erro: "cadastros.anexos.erros.naoEncontrado" };
  if (dados.conteudo.length === 0) return { erro: "cadastros.anexos.erros.escolhaArquivo" };
  if (dados.conteudo.length > TAMANHO_MAXIMO_ANEXO) return { erro: "cadastros.anexos.erros.grande" };
  const tipo = tipoRealDoArquivo(dados.conteudo, dados.nome);
  if (!tipo) return { erro: "cadastros.anexos.erros.formato" };
  const descricao = (dados.descricao ?? "").trim().slice(0, 200) || null;
  const nome = dados.nome.trim().slice(0, 200) || "arquivo";

  // Antivírus antes de criptografar (depois, ninguém enxerga o conteúdo).
  if ((await verificarArquivo(dados.conteudo)) === "bloqueado") {
    await auditar(a, "anexo.bloqueado", alvo.tipo, alvo.id, { categoria: dados.categoria });
    await avisarBloqueio(a, alvo);
    return { erro: "cadastros.anexos.erros.bloqueado" };
  }

  const id = randomUUID();
  const chave = chaveDoArquivo(a.tenant.id, "anexos", id);
  await gravarArquivo(
    chave,
    await criptografarArquivo(a.tenant.id, id, dados.conteudo),
    "application/octet-stream",
  );
  const nomeArquivoCifrado = await criptografar(a.tenant.id, nome);
  await comTenant(a.tenant.id, (tx) =>
    tx.insert(anexoCadastro).values({
      id,
      tenantId: a.tenant.id,
      empresaId: alvo.tipo === "empresa" ? alvo.id : null,
      pessoaId: alvo.tipo === "pessoa" ? alvo.id : null,
      categoria: dados.categoria,
      descricao,
      nomeArquivoCifrado,
      tipoDeConteudo: tipo,
      tamanho: dados.conteudo.length,
      chave,
      situacao: "disponivel",
      enviadoPor: a.usuario.id,
    }),
  );
  await auditar(a, "anexo.enviado", alvo.tipo, alvo.id, { anexoId: id, categoria: dados.categoria });
  return { ok: true, id };
}

export async function enviarAnexo(
  acesso: Acesso | null,
  alvo: AlvoDoAnexo,
  categoria: string,
  descricao: string | null,
  arquivo: File | null,
): Promise<Resultado> {
  if (!arquivo || arquivo.size === 0) {
    await exigirPermissao(acesso, "empresas", "editar");
    return { erro: "cadastros.anexos.erros.escolhaArquivo" };
  }
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) {
    await exigirPermissao(acesso, "empresas", "editar");
    return { erro: "cadastros.anexos.erros.grande" };
  }
  return anexarArquivo(acesso, alvo, {
    categoria,
    descricao,
    nome: arquivo.name,
    conteudo: new Uint8Array(await arquivo.arrayBuffer()),
  });
}

/** Arquivo pronto para download (só disponível; permissão e auditoria). */
export async function baixarAnexo(
  acesso: Acesso | null,
  id: string,
): Promise<{ nome: string; tipo: string; conteudo: Uint8Array } | null> {
  const a = await exigirPermissao(acesso, "empresas", "baixar");
  if (!uuidValido(id)) return null;
  const [l] = await comTenant(a.tenant.id, (tx) =>
    tx.select().from(anexoCadastro).where(eq(anexoCadastro.id, id)),
  );
  if (!l || l.situacao !== "disponivel") return null;
  const cifrado = await lerArquivo(l.chave);
  if (!cifrado) return null;
  const conteudo = await descriptografarArquivo(a.tenant.id, l.id, cifrado);
  const alvoTipo = l.empresaId ? "empresa" : "pessoa";
  await auditar(a, "anexo.baixado", alvoTipo, (l.empresaId ?? l.pessoaId)!, { anexoId: l.id });
  return { nome: await descriptografar(a.tenant.id, l.nomeArquivoCifrado), tipo: l.tipoDeConteudo, conteudo };
}

export async function removerAnexo(acesso: Acesso | null, id: string): Promise<{ ok: true } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.anexos.erros.naoEncontrado" };
  const [l] = await comTenant(a.tenant.id, (tx) =>
    tx.delete(anexoCadastro).where(eq(anexoCadastro.id, id)).returning(),
  );
  if (!l) return { erro: "cadastros.anexos.erros.naoEncontrado" };
  await apagarArquivo(l.chave).catch(() => undefined);
  const alvoTipo = l.empresaId ? "empresa" : "pessoa";
  await auditar(a, "anexo.removido", alvoTipo, (l.empresaId ?? l.pessoaId)!, { anexoId: l.id });
  return { ok: true };
}
