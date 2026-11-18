"use server";

import { headers } from "next/headers";
import { obterAcesso } from "@/server/services/acesso";
import {
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

export async function salvarEmpresaAcao(_: Estado, f: FormData): Promise<Estado> {
  const id = texto(f, "id");
  const r = id
    ? await editarEmpresa(await acesso(), id, dadosEmpresa(f))
    : await criarEmpresa(await acesso(), dadosEmpresa(f));
  if ("erro" in r) return { erro: r.erro };
  return id ? { ok: "Empresa salva." } : { destino: `/empresas/${r.id}` };
}

export async function inativarEmpresaAcao(_: Estado, f: FormData): Promise<Estado> {
  const inativa = texto(f, "inativa") === "sim";
  const r = await definirEmpresaInativa(await acesso(), texto(f, "id"), inativa);
  return "erro" in r ? { erro: r.erro } : { ok: inativa ? "Empresa inativada." : "Empresa reativada." };
}

export async function excluirEmpresaAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirEmpresa(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { destino: "/empresas" };
}

export async function criarGrupoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await criarGrupo(await acesso(), texto(f, "nome"));
  return "erro" in r ? { erro: r.erro } : { ok: "Grupo criado." };
}

export async function excluirGrupoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirGrupo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { ok: "Grupo excluído." };
}

export async function cadastrarSocioAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await cadastrarSocioSugerido(await acesso(), texto(f, "empresaId"), texto(f, "nome"));
  return "erro" in r ? { erro: r.erro } : { ok: "Sócio cadastrado." };
}

// --- Pessoas -------------------------------------------------------------------------------

export async function salvarPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const id = texto(f, "id");
  if (id) {
    const r = await editarPessoa(await acesso(), id, dadosPessoa(f), f.getAll("limpar").map(String));
    return "erro" in r ? { erro: r.erro } : { ok: "Pessoa salva." };
  }
  const r = await criarPessoa(await acesso(), dadosPessoa(f));
  if ("erro" in r) return { erro: r.erro };
  return { destino: `/pessoas/${r.id}${r.parecidas ? "?parecidas=1" : ""}` };
}

export async function revelarDadosSensiveisAcao(
  id: string,
): Promise<Record<CampoSensivel, string | null> | null> {
  return revelarDadosSensiveis(await acesso(), id);
}

export async function inativarPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const inativa = texto(f, "inativa") === "sim";
  const r = await definirPessoaInativa(await acesso(), texto(f, "id"), inativa);
  return "erro" in r ? { erro: r.erro } : { ok: inativa ? "Pessoa inativada." : "Pessoa reativada." };
}

export async function excluirPessoaAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirPessoa(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { destino: "/pessoas" };
}

export async function adicionarVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await adicionarVinculo(await acesso(), {
    pessoaId: texto(f, "pessoaId"),
    empresaId: texto(f, "empresaId"),
    tipoId: texto(f, "tipoId"),
    cargo: texto(f, "cargo"),
    percentual: texto(f, "percentual"),
  });
  return "erro" in r ? { erro: r.erro } : { ok: "Vínculo adicionado." };
}

export async function removerVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await removerVinculo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { ok: "Vínculo removido." };
}

// --- Cadastros gerais ----------------------------------------------------------------------

export async function salvarPapelAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await salvarPapel(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    perfilSugeridoId: texto(f, "perfilSugeridoId"),
  });
  return "erro" in r ? { erro: r.erro } : { ok: "Papel salvo." };
}

export async function excluirPapelAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirPapel(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { ok: "Papel excluído." };
}

export async function salvarTipoDeVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await salvarTipoDeVinculo(await acesso(), {
    id: texto(f, "id") || undefined,
    nome: texto(f, "nome"),
    comPercentual: texto(f, "comPercentual") === "sim",
  });
  return "erro" in r ? { erro: r.erro } : { ok: "Tipo de vínculo salvo." };
}

export async function excluirTipoDeVinculoAcao(_: Estado, f: FormData): Promise<Estado> {
  const r = await excluirTipoDeVinculo(await acesso(), texto(f, "id"));
  return "erro" in r ? { erro: r.erro } : { ok: "Tipo de vínculo excluído." };
}
