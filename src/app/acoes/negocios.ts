"use server";

import { salvarHorasDoResumo } from "@/server/services/mensagens";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { traduzirErro } from "@/i18n/servidor";
import { obterAcesso } from "@/server/services/acesso";
import {
  adicionarEmpresaAoNegocio,
  adicionarParticipante,
  criarNegocio,
  editarNegocio,
  excluirNegocio,
  excluirTipoDeOperacao,
  removerEmpresaDoNegocio,
  removerParticipante,
  salvarTipoDeOperacao,
} from "@/server/services/negocios";
import {
  alterarSituacaoDoNegocio,
  alterarSituacaoNoFunil,
  definirExclusividade,
  encerrarAcessosExternos,
  prorrogarExclusividade,
  salvarDiasDeAviso,
  salvarDiasDeLembreteDeTarefa,
  salvarObservacoesDoFunil,
} from "@/server/services/negocios-andamento";
import type { Estado } from "./acesso";

/** Negócios: só repassam para a camada de serviços (ADR-0004). */

const acesso = async () => obterAcesso(new Headers(await headers()));
const texto = (f: FormData, nome: string) => String(f.get(nome) ?? "");

export async function criarNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await criarNegocio(await acesso(), {
    codinome: texto(f, "codinome"),
    nomeInterno: texto(f, "nomeInterno"),
    tipoOperacaoId: texto(f, "tipoOperacaoId"),
    percentual: texto(f, "percentual"),
    papelContratanteId: texto(f, "papelContratanteId"),
    objeto: texto(f, "objeto") === "grupo" ? "grupo" : "empresas",
    vendedoras: f.getAll("vendedoras").map(String).filter(Boolean),
    grupoId: texto(f, "grupoId"),
    dataInicio: texto(f, "dataInicio"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { destino: `/negocios/${r.id}` };
}

export async function editarNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await editarNegocio(await acesso(), texto(f, "id"), {
    codinome: texto(f, "codinome"),
    nomeInterno: texto(f, "nomeInterno"),
    tipoOperacaoId: texto(f, "tipoOperacaoId"),
    percentual: texto(f, "percentual"),
    dataInicio: texto(f, "dataInicio"),
    previsaoFechamento: texto(f, "previsaoFechamento"),
    valorEstimado: texto(f, "valorEstimado"),
    descricao: texto(f, "descricao"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("salvo") };
}

export async function excluirNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirNegocio(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { destino: "/negocios" };
}

export async function adicionarEmpresaAoNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await adicionarEmpresaAoNegocio(await acesso(), texto(f, "dealId"), {
    empresaId: texto(f, "empresaId"),
    papelId: texto(f, "papelId"),
    atuaParaId: texto(f, "atuaParaId") || undefined,
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("empresaIncluida") };
}

export async function removerEmpresaDoNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await removerEmpresaDoNegocio(await acesso(), texto(f, "dealId"), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("empresaRemovida") };
}

export async function adicionarParticipanteAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await adicionarParticipante(await acesso(), texto(f, "dealId"), {
    pessoaId: texto(f, "pessoaId"),
    perfilId: texto(f, "perfilId"),
    empresaId: texto(f, "empresaId"),
    lado: texto(f, "lado"),
    prazo: texto(f, "prazo"),
    alcance: texto(f, "alcance"),
    etapaIds: f.getAll("etapaIds").map(String),
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("participanteIncluido") };
}

export async function removerParticipanteAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await removerParticipante(await acesso(), texto(f, "dealId"), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("participanteRemovido") };
}

export async function salvarTipoDeOperacaoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await salvarTipoDeOperacao(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    comPercentual: texto(f, "comPercentual") === "sim",
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("tipoSalvo") };
}

export async function excluirTipoDeOperacaoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await excluirTipoDeOperacao(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("tipoExcluido") };
}

export async function alterarSituacaoNoFunilAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await alterarSituacaoNoFunil(await acesso(), texto(f, "dealId"), {
    dealEmpresaId: texto(f, "id"),
    situacao: texto(f, "situacao"),
    descartarOutras: texto(f, "descartarOutras") === "sim",
  });
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("funilAlterado") };
}

export async function alterarSituacaoDoNegocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await alterarSituacaoDoNegocio(await acesso(), texto(f, "dealId"), {
    situacao: texto(f, "situacao"),
    motivo: texto(f, "motivo"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("situacaoAlterada") };
}

export async function encerrarAcessosExternosAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await encerrarAcessosExternos(await acesso(), texto(f, "dealId"));
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("externosEncerrados") };
}

export async function definirExclusividadeAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await definirExclusividade(await acesso(), texto(f, "dealId"), {
    inicio: texto(f, "inicio"),
    fim: texto(f, "fim"),
    dias: texto(f, "dias"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("exclusividadeDefinida") };
}

export async function prorrogarExclusividadeAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await prorrogarExclusividade(await acesso(), texto(f, "dealId"), {
    novoFim: texto(f, "novoFim"),
    motivo: texto(f, "motivo"),
  });
  return "erro" in r ? { erro: await traduzirErro(r), campo: r.campo } : { ok: t("exclusividadeProrrogada") };
}

export async function salvarDiasDeAvisoAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const a = await acesso();
  const r = await salvarDiasDeAviso(a, texto(f, "dias"));
  if ("erro" in r) return { erro: await traduzirErro(r), campo: r.campo };
  const r2 = await salvarDiasDeLembreteDeTarefa(a, texto(f, "diasTarefa"));
  if ("erro" in r2) return { erro: await traduzirErro(r2), campo: r2.campo };
  const r3 = await salvarHorasDoResumo(a, texto(f, "horasResumo"));
  return "erro" in r3 ? { erro: await traduzirErro(r3), campo: r3.campo } : { ok: t("configuracoesSalvas") };
}

export async function salvarObservacoesDoFunilAcao(_: Estado, f: FormData): Promise<Estado> {
  const t = await getTranslations("negocios.mensagens");
  const r = await salvarObservacoesDoFunil(
    await acesso(),
    texto(f, "dealId"),
    texto(f, "id"),
    texto(f, "observacoes"),
  );
  return "erro" in r ? { erro: await traduzirErro(r) } : { ok: t("observacoesSalvas") };
}
