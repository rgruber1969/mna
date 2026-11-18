import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { lerArquivo } from "@/server/arquivos/armazenamento";
import { banco } from "@/server/db/cliente";
import { tenant } from "@/server/db/esquema";
import { corValida, cssDoTema, enderecoDaImagem, TOKENS_PADRAO } from "@/config/marca";
import type { MarcaDoEmail } from "@/server/email/modelo";

/**
 * Leitura da marca do tenant (white label, ADR-0010) para as telas, a tela de
 * entrada, o endereço público das imagens e os e-mails. Sem verificação de
 * permissão: a marca é pública (aparece antes do login). A edição fica em
 * identidade-visual.ts, só para administradores do tenant.
 */

/** Identidade pronta para as telas e os e-mails. */
export type Marca = {
  /** Nome mostrado nas telas e e-mails (de exibição, ou o nome do cadastro). */
  nome: string;
  css: string;
  corPrimaria: string;
  logoClaro: string | null;
  logoEscuro: string | null;
  icone: string | null;
};

/** Campos da identidade como estão gravados (formulário de configuração). */
export type IdentidadeGravada = {
  nomeExibicao: string | null;
  corPrimaria: string | null;
  corDestaque: string | null;
  fonte: string | null;
  logoClaro: string | null;
  logoEscuro: string | null;
  icone: string | null;
};

export const colunas = {
  id: tenant.id,
  nome: tenant.nome,
  nomeExibicao: tenant.nomeExibicao,
  corPrimaria: tenant.corPrimaria,
  corDestaque: tenant.corDestaque,
  fonte: tenant.fonte,
  logoClaro: tenant.logoClaro,
  logoEscuro: tenant.logoEscuro,
  icone: tenant.icone,
};

type Linha = { id: string; nome: string } & IdentidadeGravada;

function montarMarca(t: Linha): Marca {
  return {
    nome: t.nomeExibicao || t.nome,
    css: cssDoTema({ primaria: t.corPrimaria ?? undefined, destaque: t.corDestaque ?? undefined }, t.fonte),
    corPrimaria: corValida(t.corPrimaria) ? t.corPrimaria : TOKENS_PADRAO.primaria,
    logoClaro: enderecoDaImagem(t.id, t.logoClaro),
    logoEscuro: enderecoDaImagem(t.id, t.logoEscuro),
    icone: enderecoDaImagem(t.id, t.icone),
  };
}

/** Marca de um tenant ativo, pelo endereço (telas, inclusive a de entrada). */
export async function marcaPorSlug(slug: string): Promise<Marca | null> {
  const [t] = await banco()
    .select(colunas)
    .from(tenant)
    .where(and(eq(tenant.slug, slug), isNull(tenant.suspensoEm)));
  return t ? montarMarca(t) : null;
}

/** Marca de um tenant pelo id (e-mails). */
export async function marcaDoTenant(tenantId: string): Promise<Marca | null> {
  const [t] = await banco().select(colunas).from(tenant).where(eq(tenant.id, tenantId));
  return t ? montarMarca(t) : null;
}

/** Bytes do logo para fundo claro, para embutir nos e-mails. */
export async function logoParaEmail(tenantId: string): Promise<Uint8Array | null> {
  const [t] = await banco().select({ logo: tenant.logoClaro }).from(tenant).where(eq(tenant.id, tenantId));
  return t?.logo ? lerArquivo(t.logo) : null;
}

/**
 * Bytes de uma imagem da marca, para o endereço público. Só serve o arquivo
 * ATUAL de um tenant ativo (imagens antigas ou de tenant suspenso: nada).
 */
export async function lerImagemDaMarca(tenantId: string, arquivo: string): Promise<Uint8Array | null> {
  if (!z.uuid().safeParse(tenantId).success || !/^[a-z-]+-[0-9a-f]{16}\.png$/.test(arquivo)) return null;
  const [t] = await banco()
    .select(colunas)
    .from(tenant)
    .where(and(eq(tenant.id, tenantId), isNull(tenant.suspensoEm)));
  if (!t) return null;
  const chave = [t.logoClaro, t.logoEscuro, t.icone].find((c) => c?.endsWith(`/${arquivo}`));
  return chave ? lerArquivo(chave) : null;
}

/** Marca do tenant para os e-mails: nome de exibição, cor primária e logo (fundo claro). */
export async function marcaParaEmail(tenantId: string): Promise<MarcaDoEmail | null> {
  const marca = await marcaDoTenant(tenantId);
  if (!marca) return null;
  return { nome: marca.nome, corPrimaria: marca.corPrimaria, logo: await logoParaEmail(tenantId) };
}

/** Idem, pelo endereço do tenant (e-mails pedidos na tela de entrada, como o link de acesso). */
export async function marcaParaEmailPorSlug(slug: string): Promise<MarcaDoEmail | null> {
  const [t] = await banco()
    .select({ id: tenant.id })
    .from(tenant)
    .where(and(eq(tenant.slug, slug), isNull(tenant.suspensoEm)));
  return t ? marcaParaEmail(t.id) : null;
}
