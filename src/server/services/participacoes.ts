import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { cnpjDoSocio, formatarCep, formatarCnpj } from "@/config/documentos";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import { empresa, participacaoEmpresa } from "@/server/db/esquema";
import type { Acesso, AcessoTenant } from "./acesso";
import { consultarCnpj } from "./consultas-publicas";
import { auditar, criarEmpresa } from "./empresas";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Empresa sócia de outra empresa (dominio.md, "Empresa sócia de outra
 * empresa"). Mesmas permissões do cadastro de empresas, com auditoria.
 */

export type Participacao = {
  id: string;
  /** A outra empresa da relação (a sócia, ou aquela em que se participa). */
  empresaId: string;
  nome: string;
  cnpj: string | null;
  qualificacao: string | null;
  percentual: string | null;
};

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

/** Sócias de uma empresa e empresas em que ela participa. */
export async function listarParticipacoes(
  acesso: Acesso | null,
  empresaId: string,
): Promise<{ socias: Participacao[]; participaEm: Participacao[] }> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  if (!uuidValido(empresaId)) return { socias: [], participaEm: [] };
  const outra = alias(empresa, "outra");
  return comTenant(a.tenant.id, async (tx) => {
    const campos = {
      id: participacaoEmpresa.id,
      empresaId: outra.id,
      nome: outra.razaoSocial,
      cnpj: outra.cnpj,
      qualificacao: participacaoEmpresa.qualificacao,
      percentual: participacaoEmpresa.percentual,
    };
    const socias = await tx
      .select(campos)
      .from(participacaoEmpresa)
      .innerJoin(outra, eq(outra.id, participacaoEmpresa.sociaId))
      .where(eq(participacaoEmpresa.empresaId, empresaId))
      .orderBy(asc(outra.razaoSocial));
    const participaEm = await tx
      .select(campos)
      .from(participacaoEmpresa)
      .innerJoin(outra, eq(outra.id, participacaoEmpresa.empresaId))
      .where(eq(participacaoEmpresa.sociaId, empresaId))
      .orderBy(asc(outra.razaoSocial));
    return { socias, participaEm };
  });
}

const Dados = z.object({
  empresaId: z.uuid("cadastros.erros.empresaNaoEncontrada"),
  sociaId: z.uuid("cadastros.participacoes.erros.escolhaSocia"),
  qualificacao: z
    .string()
    .trim()
    .max(120, "cadastros.erros.textoLongo")
    .transform((v) => v || null),
  percentual: z
    .string()
    .trim()
    .transform((v) => v.replace(",", ".") || null)
    .refine(
      (v) => v === null || (/^\d{1,3}(\.\d{1,4})?$/.test(v) && Number(v) <= 100),
      "cadastros.erros.percentualInvalido",
    ),
});

async function gravarParticipacao(
  a: AcessoTenant,
  d: z.output<typeof Dados>,
): Promise<{ id: string; jaExistia: boolean } | ErroDeServico> {
  if (d.empresaId === d.sociaId) return { erro: "cadastros.participacoes.erros.mesmaEmpresa" };
  return comTenant(a.tenant.id, async (tx) => {
    const existem = await tx
      .select({ id: empresa.id })
      .from(empresa)
      .where(inArray(empresa.id, [d.empresaId, d.sociaId]));
    if (existem.length < 2) return { erro: "cadastros.erros.empresaNaoEncontrada" };
    const [ja] = await tx
      .select({ id: participacaoEmpresa.id })
      .from(participacaoEmpresa)
      .where(and(eq(participacaoEmpresa.empresaId, d.empresaId), eq(participacaoEmpresa.sociaId, d.sociaId)));
    if (ja) return { id: ja.id, jaExistia: true };
    const [p] = await tx
      .insert(participacaoEmpresa)
      .values({ tenantId: a.tenant.id, ...d })
      .returning({ id: participacaoEmpresa.id });
    return { id: p.id, jaExistia: false };
  });
}

export async function adicionarParticipacao(
  acesso: Acesso | null,
  dados: z.input<typeof Dados>,
): Promise<{ id: string } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  const r = Dados.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "cadastros.erros.dadosInvalidos" };
  const g = await gravarParticipacao(a, r.data);
  if ("erro" in g) return g;
  if (g.jaExistia) return { erro: "cadastros.participacoes.erros.jaExiste" };
  await auditar(a, "participacao.criada", "empresa", r.data.empresaId, { sociaId: r.data.sociaId });
  return { id: g.id };
}

export async function removerParticipacao(
  acesso: Acesso | null,
  id: string,
): Promise<{ ok: true } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.participacoes.erros.naoEncontrada" };
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx.delete(participacaoEmpresa).where(eq(participacaoEmpresa.id, id)).returning(),
  );
  if (!p) return { erro: "cadastros.participacoes.erros.naoEncontrada" };
  await auditar(a, "participacao.removida", "empresa", p.empresaId, { sociaId: p.sociaId });
  return { ok: true };
}

/**
 * Sócio pessoa jurídica do quadro da Receita: cadastra a empresa (CNPJ da
 * matriz montado a partir do que a Receita informa; dados da consulta
 * pública) e a liga como sócia. Se a empresa já existir, só liga.
 */
export async function cadastrarEmpresaSocia(
  acesso: Acesso | null,
  empresaId: string,
  socio: { nome: string; documento: string; qualificacao: string },
): Promise<{ id: string } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  if (!uuidValido(empresaId)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const cnpj = cnpjDoSocio(socio.documento);
  let sociaId: string | null = null;
  if (cnpj) {
    const [ja] = await comTenant(a.tenant.id, (tx) =>
      tx.select({ id: empresa.id }).from(empresa).where(eq(empresa.cnpj, cnpj)),
    );
    sociaId = ja?.id ?? null;
  }
  if (!sociaId) {
    const d = cnpj ? await consultarCnpj(a, cnpj) : null;
    const criada = await criarEmpresa(
      a,
      {
        cnpj: cnpj ? formatarCnpj(cnpj) : "",
        identificadorEstrangeiro: "",
        razaoSocial: d?.razaoSocial || socio.nome,
        nomeFantasia: d?.nomeFantasia ?? "",
        cnae: d?.cnae ?? "",
        cep: d?.endereco.cep ? formatarCep(d.endereco.cep) : "",
        logradouro: d?.endereco.logradouro ?? "",
        numero: d?.numero ?? "",
        complemento: d?.endereco.complemento ?? "",
        bairro: d?.endereco.bairro ?? "",
        cidade: d?.endereco.cidade ?? "",
        uf: d?.endereco.uf ?? "",
        pais: "",
        site: "",
        telefone: d?.telefone ?? "",
        email: d?.email ?? "",
        observacoes: "",
        grupoId: "",
      },
      { ignorarParecida: true },
    );
    if ("erro" in criada) return criada;
    sociaId = criada.id;
  }
  const g = await gravarParticipacao(a, {
    empresaId,
    sociaId,
    qualificacao: socio.qualificacao.trim().slice(0, 120) || null,
    percentual: null,
  });
  if ("erro" in g) return g;
  if (!g.jaExistia) await auditar(a, "participacao.criada", "empresa", empresaId, { sociaId });
  return { id: sociaId };
}
