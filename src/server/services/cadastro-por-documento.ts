import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { formatarCep, formatarCnpj, formatarCpf } from "@/config/documentos";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import { empresa, pessoa, tipoVinculo, vinculoPessoaEmpresa } from "@/server/db/esquema";
import type { Acesso, AcessoTenant } from "./acesso";
import { anexarArquivo, CATEGORIAS_DE_EMPRESA, CATEGORIAS_DE_PESSOA } from "./anexos";
import { verificarArquivo } from "./antivirus";
import { consultarCnpj } from "./consultas-publicas";
import { indiceCego } from "./cripto/cripto";
import { auditar, criarEmpresa } from "./empresas";
import { lerDocumento, normalizarNome } from "./leitor-de-documentos";
import { adicionarVinculo, criarPessoa, nomeProprio, pessoaVazia } from "./pessoas";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Cadastro de empresas, pessoas e vínculos a partir de um documento
 * (ADR-0021, escopo-v1.md item 34). Duas etapas:
 * 1. `proporCadastro`: lê o PDF no servidor e devolve uma PROPOSTA (nada é
 *    gravado), indicando o que já existe no cadastro;
 * 2. `confirmarCadastro`: grava só o que o usuário conferiu e marcou, pelos
 *    serviços de sempre (mesmas validações, permissões e auditoria).
 */

export const TAMANHO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024;

export type SocioProposto = {
  nome: string;
  qualificacao: string;
  /** CPF completo, quando encontrado no texto e compatível com o quadro público. */
  cpf: string | null;
  existenteId: string | null;
};

export type EmpresaProposta = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnae: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Dados vieram da base pública? (fora do ar: só o CNPJ) */
  consultada: boolean;
  existenteId: string | null;
  socios: SocioProposto[];
};

export type PessoaProposta = { cpf: string; nome: string; existenteId: string | null };

export type Proposta = {
  temTexto: boolean;
  categoriaSugerida: string;
  empresas: EmpresaProposta[];
  /** CPFs do texto que não correspondem a nenhum sócio do quadro público. */
  pessoas: PessoaProposta[];
};

const uuidOuNulo = z.uuid().nullable();

/** O CPF do texto bate com o CPF mascarado do quadro público ("***456789**")? */
function cpfCompativel(cpf: string, parcial: string): boolean {
  const visiveis = parcial.replace(/\D/g, "");
  return visiveis.length === 6 && cpf.slice(3, 9) === visiveis;
}

async function pessoasExistentes(a: AcessoTenant, cpfs: string[]) {
  if (cpfs.length === 0) return new Map<string, string>();
  const indices = new Map(cpfs.map((c) => [indiceCego(a.tenant.id, c), c]));
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: pessoa.id, indice: pessoa.cpfIndice })
      .from(pessoa)
      .where(inArray(pessoa.cpfIndice, [...indices.keys()])),
  );
  return new Map(linhas.map((l) => [indices.get(l.indice!)!, l.id]));
}

async function pessoasPorNome(a: AcessoTenant) {
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: pessoa.id, nome: pessoa.nome }).from(pessoa),
  );
  const mapa = new Map<string, string>();
  for (const l of linhas) mapa.set(normalizarNome(l.nome), l.id);
  return mapa;
}

/** Etapa 1: lê o documento e propõe o cadastro. Não grava nada (só a auditoria da leitura). */
export async function proporCadastro(
  acesso: Acesso | null,
  arquivo: { nome: string; conteudo: Uint8Array },
): Promise<Proposta | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  if (arquivo.conteudo.length === 0) return { erro: "cadastros.porDocumento.erros.escolhaArquivo" };
  if (arquivo.conteudo.length > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "cadastros.anexos.erros.grande" };
  if (Buffer.from(arquivo.conteudo.subarray(0, 4)).toString("latin1") !== "%PDF")
    return { erro: "cadastros.porDocumento.erros.soPdf" };
  if ((await verificarArquivo(arquivo.conteudo)) === "bloqueado")
    return { erro: "cadastros.anexos.erros.bloqueado" };

  const leitura = await lerDocumento(arquivo.conteudo);
  const [porCpf, porNome] = await Promise.all([
    pessoasExistentes(
      a,
      leitura.cpfs.map((c) => c.cpf),
    ),
    pessoasPorNome(a),
  ]);
  const usados = new Set<string>();

  const empresas: EmpresaProposta[] = [];
  for (const cnpj of leitura.cnpjs.slice(0, 10)) {
    const [existente] = await comTenant(a.tenant.id, (tx) =>
      tx.select({ id: empresa.id }).from(empresa).where(eq(empresa.cnpj, cnpj)),
    );
    const d = await consultarCnpj(a, cnpj);
    const socios: SocioProposto[] = (d?.socios ?? []).map((s) => {
      // CPF do texto: pelo nome próximo ou pelos dígitos visíveis do quadro público.
      const doTexto =
        leitura.cpfs.find((c) => c.nomeProximo && normalizarNome(c.nomeProximo) === normalizarNome(s.nome)) ??
        leitura.cpfs.find((c) => s.documentoParcial && cpfCompativel(c.cpf, s.documentoParcial));
      if (doTexto) usados.add(doTexto.cpf);
      const cpf = doTexto?.cpf ?? null;
      return {
        nome: nomeProprio(s.nome),
        qualificacao: s.qualificacao,
        cpf,
        existenteId: (cpf && porCpf.get(cpf)) || porNome.get(normalizarNome(s.nome)) || null,
      };
    });
    empresas.push({
      cnpj,
      razaoSocial: d?.razaoSocial ?? "",
      nomeFantasia: d?.nomeFantasia ?? "",
      cnae: d?.cnae ?? "",
      telefone: d?.telefone ?? "",
      email: d?.email ?? "",
      cep: d?.endereco.cep ?? "",
      logradouro: d?.endereco.logradouro ?? "",
      numero: d?.numero ?? "",
      complemento: d?.endereco.complemento ?? "",
      bairro: d?.endereco.bairro ?? "",
      cidade: d?.endereco.cidade ?? "",
      uf: d?.endereco.uf ?? "",
      consultada: !!d,
      existenteId: existente?.id ?? null,
      socios,
    });
  }

  const pessoas: PessoaProposta[] = leitura.cpfs
    .filter((c) => !usados.has(c.cpf))
    .slice(0, 30)
    .map((c) => ({
      cpf: c.cpf,
      nome: c.nomeProximo ? nomeProprio(c.nomeProximo) : "",
      existenteId: porCpf.get(c.cpf) ?? null,
    }));

  await auditar(a, "documento.lido", "tenant", a.tenant.id, {
    empresas: empresas.length,
    pessoas: pessoas.length + empresas.reduce((n, e) => n + e.socios.length, 0),
  });
  return { temTexto: leitura.temTexto, categoriaSugerida: leitura.categoriaSugerida, empresas, pessoas };
}

// --- Etapa 2: confirmação ------------------------------------------------------------

const Texto = z.string().trim().max(300).default("");
const SelecaoSchema = z.object({
  empresas: z
    .array(
      z.object({
        incluir: z.boolean(),
        existenteId: uuidOuNulo,
        cnpj: z.string(),
        razaoSocial: Texto,
        nomeFantasia: Texto,
        cnae: Texto,
        telefone: Texto,
        email: Texto,
        cep: Texto,
        logradouro: Texto,
        numero: Texto,
        complemento: Texto,
        bairro: Texto,
        cidade: Texto,
        uf: Texto,
        socios: z
          .array(
            z.object({
              incluir: z.boolean(),
              existenteId: uuidOuNulo,
              nome: Texto,
              qualificacao: Texto,
              cpf: z.string().nullable(),
            }),
          )
          .max(50),
      }),
    )
    .max(10),
  pessoas: z
    .array(z.object({ incluir: z.boolean(), existenteId: uuidOuNulo, nome: Texto, cpf: z.string() }))
    .max(30),
  anexo: z.object({ guardar: z.boolean(), categoria: z.string() }),
});
export type Selecao = z.input<typeof SelecaoSchema>;

export type ResultadoDoCadastro = {
  empresasCriadas: number;
  pessoasCriadas: number;
  vinculosCriados: number;
  anexoGuardado: boolean;
  /** Itens que não puderam ser gravados (ex.: dado inválido), com o erro. */
  falhas: { item: string; erro: ErroDeServico }[];
  /** Primeiro cadastro tocado, para abrir depois. */
  destino: string | null;
};

/** Etapa 2: grava o que foi conferido e marcado. Cada item segue as regras de sempre. */
export async function confirmarCadastro(
  acesso: Acesso | null,
  selecao: unknown,
  arquivo: { nome: string; conteudo: Uint8Array } | null,
): Promise<ResultadoDoCadastro | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", "criar");
  const s = SelecaoSchema.safeParse(selecao);
  if (!s.success) return { erro: "cadastros.porDocumento.erros.selecaoInvalida" };
  const r: ResultadoDoCadastro = {
    empresasCriadas: 0,
    pessoasCriadas: 0,
    vinculosCriados: 0,
    anexoGuardado: false,
    falhas: [],
    destino: null,
  };

  const [socio] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: tipoVinculo.id }).from(tipoVinculo).where(eq(tipoVinculo.padrao, "socio")),
  );
  let primeiraEmpresa: string | null = null;
  let primeiraPessoa: string | null = null;

  const pessoaDe = async (p: { existenteId: string | null; nome: string; cpf: string | null }) => {
    if (p.existenteId) return p.existenteId;
    const criada = await criarPessoa(a, {
      ...pessoaVazia,
      nome: p.nome,
      cpf: p.cpf ? formatarCpf(p.cpf) : "",
    });
    if ("erro" in criada) {
      r.falhas.push({ item: p.nome || (p.cpf ?? ""), erro: criada });
      return null;
    }
    r.pessoasCriadas++;
    return criada.id;
  };

  for (const e of s.data.empresas.filter((x) => x.incluir)) {
    let empresaId = e.existenteId;
    if (!empresaId) {
      const criada = await criarEmpresa(a, {
        cnpj: formatarCnpj(e.cnpj),
        identificadorEstrangeiro: "",
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia,
        cnae: e.cnae,
        cep: e.cep ? formatarCep(e.cep) : "",
        logradouro: e.logradouro,
        numero: e.numero,
        complemento: e.complemento,
        bairro: e.bairro,
        cidade: e.cidade,
        uf: e.uf,
        pais: "",
        site: "",
        telefone: e.telefone,
        email: e.email,
        observacoes: "",
        grupoId: "",
      });
      if ("erro" in criada) {
        r.falhas.push({ item: e.razaoSocial || formatarCnpj(e.cnpj), erro: criada });
        continue;
      }
      r.empresasCriadas++;
      empresaId = criada.id;
    }
    primeiraEmpresa ??= empresaId;

    for (const sc of e.socios.filter((x) => x.incluir)) {
      const pessoaId = await pessoaDe(sc);
      if (!pessoaId) continue;
      primeiraPessoa ??= pessoaId;
      if (!socio) continue;
      const [jaVinculada] = await comTenant(a.tenant.id, (tx) =>
        tx
          .select({ id: vinculoPessoaEmpresa.id })
          .from(vinculoPessoaEmpresa)
          .where(
            and(
              eq(vinculoPessoaEmpresa.pessoaId, pessoaId),
              eq(vinculoPessoaEmpresa.empresaId, empresaId),
              eq(vinculoPessoaEmpresa.tipoId, socio.id),
            ),
          ),
      );
      if (jaVinculada) continue;
      const v = await adicionarVinculo(a, {
        pessoaId,
        empresaId,
        tipoId: socio.id,
        cargo: sc.qualificacao,
        percentual: "",
      });
      if ("erro" in v) r.falhas.push({ item: sc.nome, erro: v });
      else r.vinculosCriados++;
    }
  }

  for (const p of s.data.pessoas.filter((x) => x.incluir)) {
    const id = await pessoaDe(p);
    if (id) primeiraPessoa ??= id;
  }

  // Documento lido guardado como anexo: na primeira empresa ou, sem empresa, na primeira pessoa.
  if (s.data.anexo.guardar && arquivo && (primeiraEmpresa || primeiraPessoa)) {
    const alvo = primeiraEmpresa
      ? { tipo: "empresa" as const, id: primeiraEmpresa }
      : { tipo: "pessoa" as const, id: primeiraPessoa! };
    const lista: readonly string[] = alvo.tipo === "empresa" ? CATEGORIAS_DE_EMPRESA : CATEGORIAS_DE_PESSOA;
    const anexo = await anexarArquivo(a, alvo, {
      categoria: lista.includes(s.data.anexo.categoria) ? s.data.anexo.categoria : "outro",
      nome: arquivo.nome,
      conteudo: arquivo.conteudo,
    });
    if ("erro" in anexo) r.falhas.push({ item: arquivo.nome, erro: anexo });
    else r.anexoGuardado = true;
  }

  r.destino = primeiraEmpresa
    ? `/empresas/${primeiraEmpresa}`
    : primeiraPessoa
      ? `/pessoas/${primeiraPessoa}`
      : null;
  await auditar(a, "documento.cadastro_confirmado", "tenant", a.tenant.id, {
    empresas: r.empresasCriadas,
    pessoas: r.pessoasCriadas,
    vinculos: r.vinculosCriados,
  });
  return r;
}
