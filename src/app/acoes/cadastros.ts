"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  completarEmpresa,
  criarEmpresa,
  criarGrupo,
  definirEmpresaInativa,
  editarEmpresa,
  excluirEmpresa,
  excluirGrupo,
  type DadosEmpresa,
} from "@/server/services/empresas";
import {
  adicionarVinculo,
  cadastrarSocioSugerido,
  criarPessoa,
  definirPessoaInativa,
  editarPessoa,
  excluirPessoa,
  revelarDadosSensiveis,
  type CampoSensivel,
  type DadosPessoa,
  pessoaVazia,
  removerVinculo,
} from "@/server/services/pessoas";
import {
  excluirPapel,
  excluirTipoDeVinculo,
  salvarPapel,
  salvarTipoDeVinculo,
} from "@/server/services/cadastros";
import {
  consultarCep,
  consultarCnpj,
  type DadosDoCnpj,
  type Endereco,
} from "@/server/services/consultas-publicas";
import {
  adicionarParticipacao,
  cadastrarEmpresaSocia,
  removerParticipacao,
} from "@/server/services/participacoes";
import type { Estado } from "./acesso";

/** Empresas, pessoas e cadastros gerais: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

const CAMPOS_EMPRESA = [
  "cnpj",
  "identificadorEstrangeiro",
  "razaoSocial",
  "nomeFantasia",
  "cnae",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "pais",
  "site",
  "telefone",
  "email",
  "observacoes",
  "grupoId",
] as const;

const dadosEmpresa = (f: FormData) =>
  Object.fromEntries(CAMPOS_EMPRESA.map((c) => [c, texto(f, c)])) as DadosEmpresa;

const dadosPessoa = (f: FormData) =>
  Object.fromEntries(Object.keys(pessoaVazia).map((c) => [c, texto(f, c)])) as DadosPessoa;

// --- Consultas públicas ------------------------------------------------------------------

export async function consultarCnpjAcao(cnpj: string): Promise<DadosDoCnpj | null> {
  return consultarCnpj(await acesso(), cnpj);
}

export async function consultarCepAcao(cep: string): Promise<Endereco | null> {
  return consultarCep(await acesso(), cep);
}

// --- Empresas ----------------------------------------------------------------------------

export type EstadoEmpresa = (NonNullable<Estado> & { parecida?: { id: string; nome: string } }) | undefined;

export async function salvarEmpresaAcao(_: EstadoEmpresa, f: FormData): Promise<EstadoEmpresa> {
  const t = await getTranslations("cadastros.mensagens");
  const id = texto(f, "id");
  const decisao = texto(f, "decisao");
  // Empresa parecida sem CNPJ: o usuário escolheu completar a existente ou criar outra.
  if (!id && decisao === "completar") {
    const alvo = texto(f, "parecidaId");
    const r = await completarEmpresa(await acesso(), alvo, dadosEmpresa(f));
    return "erro" in r ? { erro: await traduzirErro(r) } : { destino: `/empresas/${r.id}` };
  }
  const r = id
    ? await editarEmpresa(await acesso(), id, dadosEmpresa(f))
    : await criarEmpresa(await acesso(), dadosEmpresa(f), { ignorarParecida: decisao === "criar" });
  if ("erro" in r) return { erro: await traduzirErro(r), parecida: r.parecida, campo: r.campo };
  return id ? { ok: t("empresaSalva") } : { destino: `/empresas/${r.id}` };
}

export async function inativarEmpresaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const inativa = texto(f, "inativa") === "sim";
  const r = await definirEmpresaInativa(await acesso(), texto(f, "id"), inativa);
  return "erro" in r
    ? { erro: await traduzirErro(r) }
    : { ok: inativa ? t("empresaInativada") : t("empresaReativada") };
}

export async function excluirEmpresaAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirEmpresa(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { destino: "/empresas" };
}

export async function criarGrupoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await criarGrupo(await acesso(), texto(f, "nome"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("grupoCriado") };
}

export async function excluirGrupoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await excluirGrupo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("grupoExcluido") };
}

export async function cadastrarSocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  // Sócio pessoa jurídica: cadastra a empresa e a liga como sócia.
  if (texto(f, "tipo") === "pj") {
    const r = await cadastrarEmpresaSocia(await acesso(), texto(f, "empresaId"), {
      nome: texto(f, "nome"),
      documento: texto(f, "documento"),
      qualificacao: texto(f, "qualificacao"),
    });
    return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("empresaSociaCadastrada") };
  }
  const r = await cadastrarSocioSugerido(
    await acesso(),
    texto(f, "empresaId"),
    texto(f, "nome"),
    texto(f, "qualificacao"),
  );
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("socioCadastrado") };
}

export async function adicionarParticipacaoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.participacoes");
  const r = await adicionarParticipacao(await acesso(), {
    empresaId: texto(f, "empresaId"),
    sociaId: texto(f, "sociaId"),
    qualificacao: texto(f, "qualificacao"),
    percentual: texto(f, "percentual"),
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("adicionada") };
}

export async function removerParticipacaoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.participacoes");
  const r = await removerParticipacao(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("removida") };
}

// --- Pessoas -------------------------------------------------------------------------------

export async function salvarPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const id = texto(f, "id");
  if (id) {
    const r = await editarPessoa(await acesso(), id, dadosPessoa(f), f.getAll("limpar").map(String));
    return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("pessoaSalva") };
  }
  const r = await criarPessoa(await acesso(), dadosPessoa(f));
  if ("erro" in r) return { erro: await traduzirErro(r), campo: r.campo };
  return { destino: `/pessoas/${r.id}${r.parecidas ? "?parecidas=1" : ""}` };
}

export async function revelarDadosSensiveisAcao(
  id: string,
): Promise<Record<CampoSensivel, string | null> | null> {
  return revelarDadosSensiveis(await acesso(), id);
}

export async function inativarPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const inativa = texto(f, "inativa") === "sim";
  const r = await definirPessoaInativa(await acesso(), texto(f, "id"), inativa);
  return "erro" in r
    ? { erro: await traduzirErro(r) }
    : { ok: inativa ? t("pessoaInativada") : t("pessoaReativada") };
}

export async function excluirPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirPessoa(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { destino: "/pessoas" };
}

export async function adicionarVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await adicionarVinculo(await acesso(), {
    pessoaId: texto(f, "pessoaId"),
    empresaId: texto(f, "empresaId"),
    tipoId: texto(f, "tipoId"),
    cargo: texto(f, "cargo"),
    percentual: texto(f, "percentual"),
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("vinculoAdicionado") };
}

export async function removerVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await removerVinculo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("vinculoRemovido") };
}

// --- Cadastros gerais ----------------------------------------------------------------------

export async function salvarPapelAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await salvarPapel(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    perfilSugeridoId: texto(f, "perfilSugeridoId"),
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("papelSalvo") };
}

export async function excluirPapelAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await excluirPapel(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("papelExcluido") };
}

export async function salvarTipoDeVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await salvarTipoDeVinculo(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    comPercentual: texto(f, "comPercentual") === "sim",
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("tipoSalvo") };
}

export async function excluirTipoDeVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("cadastros.mensagens");
  const r = await excluirTipoDeVinculo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("tipoExcluido") };
}
