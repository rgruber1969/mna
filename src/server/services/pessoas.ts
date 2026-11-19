import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { limites, type Pagina, type PedidoDePagina } from "@/config/paginacao";
import { z } from "zod";
import { comTenant } from "@/server/db/cliente";
import { apagarArquivo } from "@/server/arquivos/armazenamento";
import {
  anexoCadastro,
  empresa,
  pessoa,
  tipoVinculo,
  usuario,
  vinculoPessoaEmpresa,
} from "@/server/db/esquema";
import { enderecoDaFoto } from "./foto-da-conta";
import { cpfValido, mascararCpf, mascararDocumento, soDigitos } from "@/config/documentos";
import type { ErroDeServico } from "@/i18n/servidor";
import type { Acesso, AcessoTenant } from "./acesso";
import { criptografar, descriptografar, indiceCego } from "./cripto/cripto";
import { auditar, CamposEndereco, type ResultadoComId } from "./empresas";
import { situacoes, type SituacaoDeAcesso, type Tx } from "./situacao-de-acesso";

export type { SituacaoDeAcesso };
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Pessoas do tenant (dominio.md, "Pessoa e usuário"; dados-pessoais.md).
 *
 * Dados sensíveis (CPF, RG, documento estrangeiro e CPF, RG e regime de bens
 * do cônjuge) são criptografados com a chave do tenant antes de gravar e
 * aparecem mascarados; "mostrar" exige permissão de editar e é auditado.
 * CPF único no tenant (índice cego); e-mail único quando preenchido.
 */

type Resultado = { ok: true } | ErroDeServico;

const uuidValido = (id: string) => z.uuid().safeParse(id).success;
const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "cadastros.erros.textoLongo")
    .transform((v) => v || null);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v || null)
  .refine((v) => v === null || z.email().safeParse(v).success, "cadastros.erros.emailInvalido");
const cpf = (erro: string) =>
  z
    .string()
    .trim()
    .transform((v) => soDigitos(v) || null)
    .refine((v) => v === null || cpfValido(v), erro);

/** Campos sensíveis: gravados criptografados, mostrados mascarados. */
export const CAMPOS_SENSIVEIS = [
  "cpf",
  "rg",
  "documentoEstrangeiro",
  "conjugeCpf",
  "conjugeRg",
  "conjugeRegime",
] as const;
export type CampoSensivel = (typeof CAMPOS_SENSIVEIS)[number];

const coluna = {
  cpf: "cpfCifrado",
  rg: "rgCifrado",
  documentoEstrangeiro: "documentoEstrangeiroCifrado",
  conjugeCpf: "conjugeCpfCifrado",
  conjugeRg: "conjugeRgCifrado",
  conjugeRegime: "conjugeRegimeCifrado",
} as const satisfies Record<CampoSensivel, keyof typeof pessoa.$inferSelect>;

const DadosPessoa = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "cadastros.erros.pessoaNomeObrigatorio")
    .max(200, "cadastros.erros.nomeLongo"),
  email,
  telefone: opcional(40),
  nacionalidade: opcional(80),
  estadoCivil: opcional(40),
  profissao: opcional(120),
  dataNascimento: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "cadastros.erros.dataNascimentoInvalida"),
  ...CamposEndereco,
  rgOrgao: opcional(20),
  rgUf: opcional(2).transform((v) => v?.toUpperCase() ?? null),
  conjugeNome: opcional(),
  conjugeEmail: email,
  // Sensíveis: vazio na edição = manter o atual (use `limpar` para apagar).
  cpf: cpf("cadastros.erros.cpfInvalido"),
  rg: opcional(30),
  documentoEstrangeiro: opcional(60),
  conjugeCpf: cpf("cadastros.erros.cpfConjugeInvalido"),
  conjugeRg: opcional(30),
  conjugeRegime: opcional(80),
});

export type DadosPessoa = z.input<typeof DadosPessoa>;

function validar(dados: DadosPessoa) {
  const r = DadosPessoa.safeParse(dados);
  if (r.success) return r.data;
  const problema = r.error.issues[0];
  return {
    erro: problema?.message ?? "cadastros.erros.dadosInvalidos",
    campo: problema?.path[0] !== undefined ? String(problema.path[0]) : undefined,
  };
}

type Validados = z.output<typeof DadosPessoa>;

async function duplicidade(
  a: AcessoTenant,
  d: { email: string | null; cpf: string | null },
  exceto?: string,
  outra = false,
): Promise<(ErroDeServico & { existenteId: string }) | null> {
  return comTenant(a.tenant.id, async (tx) => {
    const fora = exceto ? ne(pessoa.id, exceto) : undefined;
    if (d.cpf) {
      const [p] = await tx
        .select({ id: pessoa.id })
        .from(pessoa)
        .where(and(eq(pessoa.cpfIndice, indiceCego(a.tenant.id, d.cpf)), fora));
      if (p)
        return {
          erro: outra ? "cadastros.erros.pessoaCpfJaExisteOutra" : "cadastros.erros.pessoaCpfJaExiste",
          existenteId: p.id,
        };
    }
    if (d.email) {
      const [p] = await tx
        .select({ id: pessoa.id })
        .from(pessoa)
        .where(and(eq(pessoa.email, d.email), fora));
      if (p)
        return {
          erro: outra ? "cadastros.erros.pessoaEmailJaExisteOutra" : "cadastros.erros.pessoaEmailJaExiste",
          existenteId: p.id,
        };
    }
    return null;
  });
}

/** Separa os campos comuns dos sensíveis e criptografa estes (só os preenchidos). */
async function paraGravar(tenantId: string, d: Validados, limpar: CampoSensivel[] = []) {
  const { cpf: c, rg, documentoEstrangeiro, conjugeCpf, conjugeRg, conjugeRegime, ...comuns } = d;
  const sensiveis: Record<CampoSensivel, string | null> = {
    cpf: c,
    rg,
    documentoEstrangeiro,
    conjugeCpf,
    conjugeRg,
    conjugeRegime,
  };
  const cifrados: Partial<typeof pessoa.$inferInsert> = {};
  for (const campo of CAMPOS_SENSIVEIS) {
    const valor = sensiveis[campo];
    if (valor) cifrados[coluna[campo]] = await criptografar(tenantId, valor);
    else if (limpar.includes(campo)) cifrados[coluna[campo]] = null;
  }
  if (c) cifrados.cpfIndice = indiceCego(tenantId, c);
  else if (limpar.includes("cpf")) cifrados.cpfIndice = null;
  return { ...comuns, ...cifrados };
}

// --- Consulta --------------------------------------------------------------------

export type PessoaResumo = {
  id: string;
  nome: string;
  email: string | null;
  empresas: string[];
  temConta: boolean;
  acesso: SituacaoDeAcesso;
  inativa: boolean;
  /** Foto da conta, se a pessoa for usuária. */
  foto: string | null;
};

export const ORDENS_DE_PESSOAS = ["nome", "email", "criadoEm"] as const;
export type OrdemDePessoas = (typeof ORDENS_DE_PESSOAS)[number];

/** Lista paginada no banco (tela de pessoas). */
export async function paginaDePessoas(
  acesso: Acesso | null,
  filtro: { busca?: string; inativas?: boolean },
  pedido: PedidoDePagina<OrdemDePessoas>,
): Promise<Pagina<PessoaResumo>> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  const busca = filtro.busca?.trim();
  const onde = and(
    filtro.inativas ? undefined : isNull(pessoa.inativaEm),
    busca ? or(ilike(pessoa.nome, `%${busca}%`), ilike(pessoa.email, `%${busca}%`)) : undefined,
  );
  return comTenant(a.tenant.id, async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(pessoa).where(onde);
    const { limite, deslocamento, pagina } = limites(pedido, total);
    const coluna = { nome: pessoa.nome, email: pessoa.email, criadoEm: pessoa.criadoEm }[pedido.ordem];
    const linhas = await tx
      .select({
        id: pessoa.id,
        nome: pessoa.nome,
        email: pessoa.email,
        usuarioId: pessoa.usuarioId,
        inativaEm: pessoa.inativaEm,
        imagem: usuario.image,
      })
      .from(pessoa)
      .leftJoin(usuario, eq(usuario.id, pessoa.usuarioId))
      .where(onde)
      .orderBy(pedido.direcao === "desc" ? desc(coluna) : asc(coluna), asc(pessoa.id))
      .limit(limite)
      .offset(deslocamento);
    const ids = linhas.map((l) => l.id);
    const vinculos = ids.length
      ? await tx
          .select({ pessoaId: vinculoPessoaEmpresa.pessoaId, empresa: empresa.razaoSocial })
          .from(vinculoPessoaEmpresa)
          .innerJoin(empresa, eq(empresa.id, vinculoPessoaEmpresa.empresaId))
          .where(inArray(vinculoPessoaEmpresa.pessoaId, ids))
      : [];
    const situacao = await situacoes(tx, linhas);
    const empresasDe = new Map<string, Set<string>>();
    for (const v of vinculos)
      (empresasDe.get(v.pessoaId) ?? empresasDe.set(v.pessoaId, new Set()).get(v.pessoaId)!).add(v.empresa);
    return {
      itens: linhas.map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        empresas: [...(empresasDe.get(p.id) ?? [])],
        temConta: Boolean(p.usuarioId),
        acesso: situacao.get(p.id) ?? "sem-acesso",
        inativa: Boolean(p.inativaEm),
        foto: p.usuarioId ? enderecoDaFoto(p.usuarioId, p.imagem) : null,
      })),
      total,
      pagina,
      porPagina: limite,
    };
  });
}

/** Lista completa (para escolher numa caixa de seleção). */
export async function listarPessoas(
  acesso: Acesso | null,
  filtro: { busca?: string; inativas?: boolean } = {},
): Promise<PessoaResumo[]> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  const busca = filtro.busca?.trim();
  return comTenant(a.tenant.id, async (tx) => {
    const linhas = await tx
      .select({
        id: pessoa.id,
        nome: pessoa.nome,
        email: pessoa.email,
        usuarioId: pessoa.usuarioId,
        inativaEm: pessoa.inativaEm,
        imagem: usuario.image,
      })
      .from(pessoa)
      .leftJoin(usuario, eq(usuario.id, pessoa.usuarioId))
      .where(
        and(
          filtro.inativas ? undefined : isNull(pessoa.inativaEm),
          busca ? or(ilike(pessoa.nome, `%${busca}%`), ilike(pessoa.email, `%${busca}%`)) : undefined,
        ),
      )
      .orderBy(asc(pessoa.nome));
    const vinculos = await tx
      .select({ pessoaId: vinculoPessoaEmpresa.pessoaId, empresa: empresa.razaoSocial })
      .from(vinculoPessoaEmpresa)
      .innerJoin(empresa, eq(empresa.id, vinculoPessoaEmpresa.empresaId));
    const situacao = await situacoes(tx, linhas);
    const empresasDe = new Map<string, Set<string>>();
    for (const v of vinculos)
      (empresasDe.get(v.pessoaId) ?? empresasDe.set(v.pessoaId, new Set()).get(v.pessoaId)!).add(v.empresa);
    return linhas.map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      empresas: [...(empresasDe.get(p.id) ?? [])],
      temConta: Boolean(p.usuarioId),
      acesso: situacao.get(p.id) ?? "sem-acesso",
      inativa: Boolean(p.inativaEm),
      foto: p.usuarioId ? enderecoDaFoto(p.usuarioId, p.imagem) : null,
    }));
  });
}

export type VinculoDaPessoa = {
  id: string;
  empresaId: string;
  empresa: string;
  tipo: string;
  cargo: string | null;
  percentual: string | null;
};

type Linha = typeof pessoa.$inferSelect;
type SemCifrados = Omit<Linha, (typeof coluna)[CampoSensivel] | "cpfIndice">;

export type PessoaDetalhe = SemCifrados & {
  acesso: SituacaoDeAcesso;
  /** Sensíveis mascarados (null = não preenchido). */
  mascarados: Record<CampoSensivel, string | null>;
  vinculos: VinculoDaPessoa[];
};

function mascarar(campo: CampoSensivel, valor: string): string {
  if (campo === "cpf" || campo === "conjugeCpf") return mascararCpf(valor);
  if (campo === "conjugeRegime") return "••••••";
  return mascararDocumento(valor);
}

export async function obterPessoa(acesso: Acesso | null, id: string): Promise<PessoaDetalhe | null> {
  const a = await exigirPermissao(acesso, "empresas", "ver");
  if (!uuidValido(id)) return null;
  const dados = await comTenant(a.tenant.id, async (tx) => {
    const [p] = await tx.select().from(pessoa).where(eq(pessoa.id, id));
    if (!p) return null;
    const vinculos = await tx
      .select({
        id: vinculoPessoaEmpresa.id,
        empresaId: empresa.id,
        empresa: empresa.razaoSocial,
        tipo: tipoVinculo.nome,
        cargo: vinculoPessoaEmpresa.cargo,
        percentual: vinculoPessoaEmpresa.percentual,
      })
      .from(vinculoPessoaEmpresa)
      .innerJoin(empresa, eq(empresa.id, vinculoPessoaEmpresa.empresaId))
      .innerJoin(tipoVinculo, eq(tipoVinculo.id, vinculoPessoaEmpresa.tipoId))
      .where(eq(vinculoPessoaEmpresa.pessoaId, id))
      .orderBy(asc(empresa.razaoSocial));
    const situacao = (await situacoes(tx, [p])).get(p.id) ?? "sem-acesso";
    return { p, vinculos, situacao };
  });
  if (!dados) return null;
  const { p, vinculos, situacao } = dados;
  const mascarados = {} as Record<CampoSensivel, string | null>;
  for (const campo of CAMPOS_SENSIVEIS) {
    const cifrado = p[coluna[campo]];
    mascarados[campo] = cifrado ? mascarar(campo, await descriptografar(a.tenant.id, cifrado)) : null;
  }
  const {
    cpfCifrado: _1,
    cpfIndice: _2,
    rgCifrado: _3,
    documentoEstrangeiroCifrado: _4,
    conjugeCpfCifrado: _5,
    conjugeRgCifrado: _6,
    conjugeRegimeCifrado: _7,
    ...comuns
  } = p;
  void [_1, _2, _3, _4, _5, _6, _7];
  return { ...comuns, acesso: situacao, mascarados, vinculos };
}

/**
 * Mostra os dados sensíveis legíveis: só para quem pode editar "Empresas e
 * pessoas"; cada visualização vai para a auditoria (sem os valores).
 */
export async function revelarDadosSensiveis(
  acesso: Acesso | null,
  id: string,
): Promise<Record<CampoSensivel, string | null> | null> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return null;
  const [p] = await comTenant(a.tenant.id, (tx) => tx.select().from(pessoa).where(eq(pessoa.id, id)));
  if (!p) return null;
  const legiveis = {} as Record<CampoSensivel, string | null>;
  for (const campo of CAMPOS_SENSIVEIS) {
    const cifrado = p[coluna[campo]];
    legiveis[campo] = cifrado ? await descriptografar(a.tenant.id, cifrado) : null;
  }
  await auditar(a, "pessoa.dados_sensiveis.vistos", "pessoa", id);
  return legiveis;
}

// --- Cadastro --------------------------------------------------------------------

export async function criarPessoa(
  acesso: Acesso | null,
  dados: DadosPessoa,
): Promise<ResultadoComId & { parecidas?: string[] }> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  const d = validar(dados);
  if ("erro" in d) return d;
  const dup = await duplicidade(a, d);
  if (dup) return dup;
  // Sem CPF não há como garantir que é outra pessoa: avisa sobre nomes iguais.
  const parecidas = d.cpf
    ? []
    : (
        await comTenant(a.tenant.id, (tx) =>
          tx.select({ nome: pessoa.nome }).from(pessoa).where(ilike(pessoa.nome, d.nome)),
        )
      ).map((p) => p.nome);
  const valores = await paraGravar(a.tenant.id, d);
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx
      .insert(pessoa)
      .values({ ...valores, tenantId: a.tenant.id })
      .returning({ id: pessoa.id }),
  );
  await auditar(a, "pessoa.criada", "pessoa", p.id);
  return parecidas.length ? { id: p.id, parecidas } : { id: p.id };
}

export async function editarPessoa(
  acesso: Acesso | null,
  id: string,
  dados: DadosPessoa,
  limpar: string[] = [],
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  const d = validar(dados);
  if ("erro" in d) return d;
  const dup = await duplicidade(a, d, id, true);
  if (dup) return dup;
  const campos = limpar.filter((c): c is CampoSensivel =>
    (CAMPOS_SENSIVEIS as readonly string[]).includes(c),
  );
  const valores = await paraGravar(a.tenant.id, d, campos);
  const feito = await comTenant(a.tenant.id, async (tx) => {
    const [atual] = await tx
      .select({ usuarioId: pessoa.usuarioId, email: pessoa.email })
      .from(pessoa)
      .where(eq(pessoa.id, id));
    if (!atual) return null;
    // O e-mail de quem tem conta é o de login: só muda pela própria conta.
    const email = atual.usuarioId ? atual.email : valores.email;
    return tx
      .update(pessoa)
      .set({ ...valores, email, atualizadoEm: new Date() })
      .where(eq(pessoa.id, id))
      .returning({ id: pessoa.id });
  });
  if (!feito?.length) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  await auditar(
    a,
    "pessoa.editada",
    "pessoa",
    id,
    campos.length ? { removidos: campos.join(",") } : undefined,
  );
  return { id };
}

export async function definirPessoaInativa(
  acesso: Acesso | null,
  id: string,
  inativa: boolean,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(id)) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx
      .update(pessoa)
      .set({ inativaEm: inativa ? new Date() : null })
      .where(eq(pessoa.id, id))
      .returning({ id: pessoa.id }),
  );
  if (feito.length === 0) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  await auditar(a, inativa ? "pessoa.inativada" : "pessoa.reativada", "pessoa", id);
  return { ok: true };
}

/** Exclusão definitiva: nunca de quem tem conta no tenant (revogue o acesso e inative). */
export async function excluirPessoa(acesso: Acesso | null, id: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "excluir");
  if (!uuidValido(id)) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  const [p] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ usuarioId: pessoa.usuarioId }).from(pessoa).where(eq(pessoa.id, id)),
  );
  if (!p) return { erro: "cadastros.erros.pessoaNaoEncontrada" };
  if (p.usuarioId) return { erro: "cadastros.erros.pessoaTemAcesso" };
  // Anexos saem junto (cascata no banco); os arquivos, do armazenamento.
  const anexos = await comTenant(a.tenant.id, async (tx) => {
    const chaves = await tx
      .select({ chave: anexoCadastro.chave })
      .from(anexoCadastro)
      .where(eq(anexoCadastro.pessoaId, id));
    await tx.delete(pessoa).where(eq(pessoa.id, id));
    return chaves;
  });
  await Promise.all(anexos.map((x) => apagarArquivo(x.chave).catch(() => undefined)));
  await auditar(a, "pessoa.excluida", "pessoa", id);
  return { ok: true };
}

// --- Vínculos com empresas -----------------------------------------------------------

const Vinculo = z.object({
  pessoaId: z.uuid("cadastros.erros.pessoaInvalida"),
  empresaId: z.uuid("cadastros.erros.vinculoEscolhaEmpresa"),
  tipoId: z.uuid("cadastros.erros.vinculoEscolhaTipo"),
  cargo: opcional(120),
  percentual: z
    .string()
    .trim()
    .transform((v) => v.replace(",", ".") || null)
    .refine(
      (v) => v === null || (/^\d{1,3}(\.\d{1,4})?$/.test(v) && Number(v) <= 100),
      "cadastros.erros.percentualInvalido",
    ),
});

export async function adicionarVinculo(
  acesso: Acesso | null,
  dados: z.input<typeof Vinculo>,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  const r = Vinculo.safeParse(dados);
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "cadastros.erros.dadosInvalidos" };
  const v = r.data;
  const erro = await comTenant(a.tenant.id, async (tx) => {
    const [t] = await tx
      .select({ comPercentual: tipoVinculo.comPercentual })
      .from(tipoVinculo)
      .where(eq(tipoVinculo.id, v.tipoId));
    const [e] = await tx.select({ id: empresa.id }).from(empresa).where(eq(empresa.id, v.empresaId));
    const [p] = await tx.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.id, v.pessoaId));
    if (!t || !e || !p) return "cadastros.erros.vinculoReferenciaNaoEncontrada";
    await tx.insert(vinculoPessoaEmpresa).values({
      tenantId: a.tenant.id,
      pessoaId: v.pessoaId,
      empresaId: v.empresaId,
      tipoId: v.tipoId,
      cargo: v.cargo,
      percentual: t.comPercentual ? v.percentual : null,
    });
    return null;
  });
  if (erro) return { erro };
  await auditar(a, "pessoa.vinculo.adicionado", "pessoa", v.pessoaId, { empresaId: v.empresaId });
  return { ok: true };
}

export async function removerVinculo(acesso: Acesso | null, vinculoId: string): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", "editar");
  if (!uuidValido(vinculoId)) return { erro: "cadastros.erros.vinculoNaoEncontrado" };
  const [v] = await comTenant(a.tenant.id, (tx) =>
    tx
      .delete(vinculoPessoaEmpresa)
      .where(eq(vinculoPessoaEmpresa.id, vinculoId))
      .returning({ pessoaId: vinculoPessoaEmpresa.pessoaId, empresaId: vinculoPessoaEmpresa.empresaId }),
  );
  if (!v) return { erro: "cadastros.erros.vinculoNaoEncontrado" };
  await auditar(a, "pessoa.vinculo.removido", "pessoa", v.pessoaId, { empresaId: v.empresaId });
  return { ok: true };
}

/**
 * Sócio sugerido pela consulta do CNPJ: cadastra a pessoa (só o nome) e o
 * vínculo de sócio com a empresa, depois de o usuário confirmar.
 */
/** Quem é sócio no quadro da Receita (pela qualificação) vira "Sócio"; os demais, "Administrador". */
export function vinculoDaQualificacao(qualificacao: string): "socio" | "administrador" {
  return /s[óo]ci/i.test(qualificacao) ? "socio" : "administrador";
}

export async function cadastrarSocioSugerido(
  acesso: Acesso | null,
  empresaId: string,
  nome: string,
  qualificacao = "",
): Promise<ResultadoComId> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  if (!uuidValido(empresaId)) return { erro: "cadastros.erros.empresaNaoEncontrada" };
  const [socio] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: tipoVinculo.id })
      .from(tipoVinculo)
      .where(eq(tipoVinculo.padrao, vinculoDaQualificacao(qualificacao))),
  );
  if (!socio) return { erro: "cadastros.erros.tipoSocioInexistente" };
  const p = await criarPessoa(a, { ...pessoaVazia, nome: nomeProprio(nome) });
  if ("erro" in p) return p;
  const v = await adicionarVinculo(a, {
    pessoaId: p.id,
    empresaId,
    tipoId: socio.id,
    cargo: qualificacao.trim().slice(0, 120),
    percentual: "",
  });
  return "erro" in v ? v : { id: p.id };
}

/** "FULANO DE TAL" → "Fulano de Tal" (a Receita devolve em maiúsculas). */
export function nomeProprio(nome: string): string {
  const minusculas = new Set(["da", "das", "de", "do", "dos", "e"]);
  return nome
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export const pessoaVazia: DadosPessoa = {
  nome: "",
  email: "",
  telefone: "",
  nacionalidade: "",
  estadoCivil: "",
  profissao: "",
  dataNascimento: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  pais: "",
  rgOrgao: "",
  rgUf: "",
  conjugeNome: "",
  conjugeEmail: "",
  cpf: "",
  rg: "",
  documentoEstrangeiro: "",
  conjugeCpf: "",
  conjugeRg: "",
  conjugeRegime: "",
};

// --- Conta (convite aceito) -----------------------------------------------------------

/**
 * Liga a conta à pessoa do tenant ao aceitar um convite (decidido em
 * 2026-11-18): se já existe pessoa com o mesmo e-mail, liga a ela; senão, cria
 * a pessoa com nome e e-mail. Operação do sistema (não do usuário), dentro da
 * transação do aceite.
 */
export async function ligarContaAPessoa(
  tx: Tx,
  tenantId: string,
  conta: { usuarioId: string; nome: string; email: string },
): Promise<void> {
  const email = conta.email.toLowerCase();
  const [ligada] = await tx
    .select({ id: pessoa.id })
    .from(pessoa)
    .where(eq(pessoa.usuarioId, conta.usuarioId));
  if (ligada) return;
  const [mesmoEmail] = await tx.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.email, email));
  if (mesmoEmail) {
    await tx
      .update(pessoa)
      .set({ usuarioId: conta.usuarioId, inativaEm: null })
      .where(eq(pessoa.id, mesmoEmail.id));
    return;
  }
  await tx.insert(pessoa).values({ tenantId, nome: conta.nome, email, usuarioId: conta.usuarioId });
}
