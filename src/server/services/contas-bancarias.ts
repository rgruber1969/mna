import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { cnpjValido, cpfValido, soDigitos } from "@/config/documentos";
import type { ErroDeServico } from "@/i18n/servidor";
import { comTenant } from "@/server/db/cliente";
import { contaBancaria, empresa, pessoa } from "@/server/db/esquema";
import type { Acesso, AcessoTenant } from "./acesso";
import { criptografar, descriptografar } from "./cripto/cripto";
import { auditar } from "./empresas";
import { exigirPermissao } from "./permissoes/verificador";

/**
 * Contas bancárias e chaves Pix de empresas e pessoas (aba "Dados bancários").
 * Agência, conta e chave Pix ficam criptografadas com a chave do tenant e
 * aparecem mascaradas; "mostrar" revela e fica na auditoria
 * (dados-pessoais.md). Permissões do cadastro "Empresas e pessoas": na
 * empresa, ver para revelar; na pessoa, editar (como os demais dados
 * sensíveis da pessoa).
 */

export type AlvoDaConta = { tipo: "empresa" | "pessoa"; id: string };
type Resultado = { ok: true } | ErroDeServico;

export const TIPOS_DE_CONTA = ["corrente", "poupanca", "pagamento"] as const;
export const TIPOS_DE_CHAVE_PIX = ["cnpj", "cpf", "email", "telefone", "aleatoria"] as const;

/** Bancos mais comuns (código de compensação → nome), para preencher o nome sozinho. */
export const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "004": "Banco do Nordeste",
  "033": "Santander",
  "041": "Banrisul",
  "070": "BRB",
  "077": "Inter",
  "104": "Caixa Econômica Federal",
  "136": "Unicred",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Safra",
  "748": "Sicredi",
  "756": "Sicoob",
};

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

export type ContaBancaria = {
  id: string;
  bancoCodigo: string | null;
  bancoNome: string | null;
  tipoConta: (typeof TIPOS_DE_CONTA)[number] | null;
  tipoChavePix: (typeof TIPOS_DE_CHAVE_PIX)[number] | null;
  principal: boolean;
  /** Mascarados (ex.: "***52-1"); o valor legível só por `revelarContaBancaria`. */
  agencia: string | null;
  conta: string | null;
  chavePix: string | null;
};

const mascarar = (v: string) => (v.length <= 3 ? "***" : `***${v.slice(-3)}`);

function permissao(alvo: AlvoDaConta, operacao: "ver" | "revelar" | "alterar") {
  if (operacao === "ver") return "ver" as const;
  if (operacao === "revelar") return alvo.tipo === "pessoa" ? ("editar" as const) : ("ver" as const);
  return "editar" as const;
}

const colunaDoAlvo = (alvo: AlvoDaConta) =>
  alvo.tipo === "empresa" ? eq(contaBancaria.empresaId, alvo.id) : eq(contaBancaria.pessoaId, alvo.id);

async function alvoExiste(a: AcessoTenant, alvo: AlvoDaConta): Promise<boolean> {
  if (!uuidValido(alvo.id)) return false;
  const tabela = alvo.tipo === "empresa" ? empresa : pessoa;
  const [x] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ id: tabela.id }).from(tabela).where(eq(tabela.id, alvo.id)),
  );
  return Boolean(x);
}

export async function listarContasBancarias(
  acesso: Acesso | null,
  alvo: AlvoDaConta,
): Promise<ContaBancaria[]> {
  const a = await exigirPermissao(acesso, "empresas", permissao(alvo, "ver"));
  if (!uuidValido(alvo.id)) return [];
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(contaBancaria)
      .where(colunaDoAlvo(alvo))
      .orderBy(desc(contaBancaria.principal), asc(contaBancaria.criadoEm)),
  );
  const ler = async (v: string | null) => (v ? mascarar(await descriptografar(a.tenant.id, v)) : null);
  return Promise.all(
    linhas.map(async (c) => ({
      id: c.id,
      bancoCodigo: c.bancoCodigo,
      bancoNome: c.bancoNome,
      tipoConta: c.tipoConta,
      tipoChavePix: c.tipoChavePix,
      principal: c.principal,
      agencia: await ler(c.agenciaCifrada),
      conta: await ler(c.contaCifrada),
      chavePix: await ler(c.chavePixCifrada),
    })),
  );
}

/** Valores legíveis de uma conta (auditado). */
export async function revelarContaBancaria(
  acesso: Acesso | null,
  alvo: AlvoDaConta,
  id: string,
): Promise<{ agencia: string | null; conta: string | null; chavePix: string | null } | null> {
  const a = await exigirPermissao(acesso, "empresas", permissao(alvo, "revelar"));
  if (!uuidValido(id) || !uuidValido(alvo.id)) return null;
  const [c] = await comTenant(a.tenant.id, (tx) =>
    tx
      .select()
      .from(contaBancaria)
      .where(and(eq(contaBancaria.id, id), colunaDoAlvo(alvo))),
  );
  if (!c) return null;
  const ler = async (v: string | null) => (v ? descriptografar(a.tenant.id, v) : null);
  const r = {
    agencia: await ler(c.agenciaCifrada),
    conta: await ler(c.contaCifrada),
    chavePix: await ler(c.chavePixCifrada),
  };
  await auditar(a, "conta_bancaria.vista", alvo.tipo, alvo.id, { contaId: id });
  return r;
}

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "cadastros.erros.textoLongo")
    .transform((v) => v || null);

const DadosConta = z
  .object({
    bancoCodigo: z
      .string()
      .trim()
      .transform((v) => (soDigitos(v) ? soDigitos(v).padStart(3, "0") : null))
      .refine((v) => v === null || v.length === 3, "cadastros.contas.erros.bancoInvalido"),
    bancoNome: opcional(120),
    agencia: opcional(20),
    conta: opcional(30),
    tipoConta: z
      .string()
      .trim()
      .transform((v) =>
        (TIPOS_DE_CONTA as readonly string[]).includes(v) ? (v as (typeof TIPOS_DE_CONTA)[number]) : null,
      ),
    chavePix: opcional(140),
    tipoChavePix: z
      .string()
      .trim()
      .transform((v) =>
        (TIPOS_DE_CHAVE_PIX as readonly string[]).includes(v)
          ? (v as (typeof TIPOS_DE_CHAVE_PIX)[number])
          : null,
      ),
    principal: z.boolean().default(false),
  })
  .transform((d) => ({
    ...d,
    bancoNome: d.bancoNome ?? (d.bancoCodigo ? (BANCOS[d.bancoCodigo] ?? null) : null),
  }))
  .superRefine((d, ctx) => {
    const erro = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!d.conta && !d.chavePix) erro("conta", "cadastros.contas.erros.contaOuPix");
    if (d.conta && !d.agencia) erro("agencia", "cadastros.contas.erros.agenciaObrigatoria");
    if (d.conta && !d.bancoCodigo && !d.bancoNome)
      erro("bancoCodigo", "cadastros.contas.erros.bancoObrigatorio");
    if (d.chavePix && !d.tipoChavePix) erro("tipoChavePix", "cadastros.contas.erros.tipoPixObrigatorio");
    const k = d.chavePix ?? "";
    const valida = {
      cnpj: () => cnpjValido(k),
      cpf: () => cpfValido(k),
      email: () => z.email().safeParse(k).success,
      telefone: () => /^\+?\d{10,13}$/.test(k.replace(/[\s()-]/g, "")),
      aleatoria: () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k),
    };
    if (d.chavePix && d.tipoChavePix && !valida[d.tipoChavePix]())
      erro("chavePix", "cadastros.contas.erros.chavePixInvalida");
  });

export type DadosConta = z.input<typeof DadosConta>;

/** Chave Pix guardada no formato do tipo (CPF/CNPJ formatados como digitados ficam só com dígitos). */
function normalizarChave(tipo: string | null, chave: string | null): string | null {
  if (!chave) return null;
  if (tipo === "cnpj" || tipo === "cpf") return soDigitos(chave);
  if (tipo === "email") return chave.toLowerCase();
  if (tipo === "telefone") return chave.replace(/[\s()-]/g, "");
  return chave;
}

/** Cria ou edita uma conta. Marcar como principal desmarca as outras do mesmo cadastro. */
export async function salvarContaBancaria(
  acesso: Acesso | null,
  alvo: AlvoDaConta,
  dados: DadosConta & { id?: string },
): Promise<{ id: string } | ErroDeServico> {
  const a = await exigirPermissao(acesso, "empresas", permissao(alvo, "alterar"));
  if (!(await alvoExiste(a, alvo))) return { erro: "cadastros.contas.erros.cadastroNaoEncontrado" };
  const r = DadosConta.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    return {
      erro: p?.message ?? "cadastros.erros.dadosInvalidos",
      campo: p?.path[0] !== undefined ? String(p.path[0]) : undefined,
    };
  }
  const d = r.data;
  const cifrar = (v: string | null) => (v ? criptografar(a.tenant.id, v) : Promise.resolve(null));
  const valores = {
    bancoCodigo: d.bancoCodigo,
    bancoNome: d.bancoNome,
    tipoConta: d.tipoConta,
    tipoChavePix: d.chavePix ? d.tipoChavePix : null,
    agenciaCifrada: await cifrar(d.agencia),
    contaCifrada: await cifrar(d.conta),
    chavePixCifrada: await cifrar(normalizarChave(d.tipoChavePix, d.chavePix)),
    principal: d.principal,
  };
  const id = await comTenant(a.tenant.id, async (tx) => {
    const existentes = await tx
      .select({ id: contaBancaria.id })
      .from(contaBancaria)
      .where(colunaDoAlvo(alvo));
    // A primeira conta do cadastro já nasce principal.
    const principal = valores.principal || existentes.filter((e) => e.id !== dados.id).length === 0;
    if (principal) await tx.update(contaBancaria).set({ principal: false }).where(colunaDoAlvo(alvo));
    if (dados.id) {
      if (!uuidValido(dados.id) || !existentes.some((e) => e.id === dados.id)) return null;
      await tx
        .update(contaBancaria)
        .set({ ...valores, principal, atualizadoEm: new Date() })
        .where(eq(contaBancaria.id, dados.id));
      return dados.id;
    }
    const [nova] = await tx
      .insert(contaBancaria)
      .values({
        tenantId: a.tenant.id,
        ...(alvo.tipo === "empresa" ? { empresaId: alvo.id } : { pessoaId: alvo.id }),
        ...valores,
        principal,
      })
      .returning({ id: contaBancaria.id });
    return nova.id;
  });
  if (!id) return { erro: "cadastros.contas.erros.contaNaoEncontrada" };
  await auditar(a, dados.id ? "conta_bancaria.editada" : "conta_bancaria.criada", alvo.tipo, alvo.id, {
    contaId: id,
  });
  return { id };
}

export async function excluirContaBancaria(
  acesso: Acesso | null,
  alvo: AlvoDaConta,
  id: string,
): Promise<Resultado> {
  const a = await exigirPermissao(acesso, "empresas", permissao(alvo, "alterar"));
  if (!uuidValido(id) || !uuidValido(alvo.id)) return { erro: "cadastros.contas.erros.contaNaoEncontrada" };
  const feito = await comTenant(a.tenant.id, (tx) =>
    tx
      .delete(contaBancaria)
      .where(and(eq(contaBancaria.id, id), colunaDoAlvo(alvo)))
      .returning({ id: contaBancaria.id }),
  );
  if (feito.length === 0) return { erro: "cadastros.contas.erros.contaNaoEncontrada" };
  await auditar(a, "conta_bancaria.excluida", alvo.tipo, alvo.id, { contaId: id });
  return { ok: true };
}
