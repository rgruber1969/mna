import { z } from "zod";
import { tradutor, type ErroDeServico } from "@/i18n/servidor";
import { formatarCnpj } from "@/config/documentos";
import { estaLigada } from "@/config/funcionalidades";
import { docxDeParagrafos, type ParagrafoDocx } from "@/server/arquivos/docx-simples";
import { exigirTenant, type Acesso } from "./acesso";
import { auditar } from "./empresas";
import { listarContratos, obterContrato } from "./contratos";
import { obterNegocio, paginaDeNegocios } from "./negocios";

/**
 * Templates DOCX com preenchimento de campos (item 13, **simulado**): na
 * demonstração, a lista de templates é fixa (sem envio de modelos pelo
 * tenant) e "Gerar" devolve um DOCX de exemplo preenchido com os campos do
 * negócio ou do contrato escolhido, que a pessoa precisa conseguir ver. Os
 * textos dos modelos ficam nas mensagens (`templates.modelos`). Auditado.
 */

export const TEMPLATES = [
  {
    codigo: "nda",
    alvo: "negocio",
    campos: ["negocio", "vendedoras", "compradoras", "tenant", "data"],
  },
  {
    codigo: "term-sheet",
    alvo: "negocio",
    campos: ["negocio", "tipo", "vendedoras", "compradoras", "valorEstimado", "previsaoFechamento", "data"],
  },
  {
    codigo: "procuracao",
    alvo: "negocio",
    campos: ["vendedoras", "tenant", "negocio", "data"],
  },
  {
    codigo: "mandato",
    alvo: "contrato",
    campos: ["contratantes", "contratadas", "objeto", "vigencia", "honorarioFixo", "successFee", "data"],
  },
  {
    codigo: "honorarios",
    alvo: "contrato",
    campos: ["contratantes", "contratadas", "objeto", "honorarioFixo", "successFee", "data"],
  },
] as const;

export type CodigoDoTemplate = (typeof TEMPLATES)[number]["codigo"];
export type AlvoDoTemplate = "negocio" | "contrato";

export type TelaDeTemplates = {
  templates: { codigo: CodigoDoTemplate; alvo: AlvoDoTemplate; campos: string[] }[];
  negocios: { id: string; nome: string }[];
  contratos: { id: string; nome: string }[];
};

const desligada = { erro: "templates.erros.funcionalidadeDesligada" } as const;

/** Templates e as opções de negócio e contrato que a pessoa vê (para escolher o que preencher). */
export async function telaDeTemplates(acesso: Acesso | null): Promise<TelaDeTemplates | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!estaLigada("templatesDocx")) return desligada;
  const [pagina, contratos] = await Promise.all([
    paginaDeNegocios(a, {}, { pagina: 1, porPagina: 100, ordem: "numero", direcao: "desc" }).catch(
      () => null,
    ),
    listarContratos(a, {}).catch(() => []),
  ]);
  return {
    templates: TEMPLATES.map((t) => ({ codigo: t.codigo, alvo: t.alvo, campos: [...t.campos] })),
    negocios: (pagina?.itens ?? []).map((n) => ({ id: n.id, nome: n.nome })),
    contratos: contratos.map((c) => ({
      id: c.id,
      nome: c.negocio ? `${c.titulo} · ${c.negocio}` : c.titulo,
    })),
  };
}

const br = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "—");
const reais = (v: string | null | undefined) =>
  v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const lista = (xs: string[]) => (xs.length ? xs.join("; ") : "—");

/** Valores dos campos do alvo (só o que a pessoa vê nele). */
async function camposDoAlvo(
  a: ReturnType<typeof exigirTenant>,
  alvo: AlvoDoTemplate,
  id: string,
): Promise<{ titulo: string; campos: Record<string, string> } | null> {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (alvo === "negocio") {
    const n = await obterNegocio(a, id).catch(() => null);
    if (!n) return null;
    // Vendedoras: empresas com papel "Vendedora" (só as que a pessoa vê); compradoras: as do funil.
    const vendedoras = n.empresas
      .filter((e) => /vendedor/i.test(e.papel))
      .map((e) => (e.cnpj ? `${e.nome} (CNPJ ${formatarCnpj(e.cnpj)})` : e.nome));
    return {
      titulo: n.nome,
      campos: {
        negocio: n.nome,
        tipo: n.tipo ?? "—",
        vendedoras: lista(vendedoras),
        compradoras: lista(n.compradoras.map((x) => x.nome)),
        valorEstimado: reais(n.valorEstimado),
        previsaoFechamento: br(n.previsaoFechamento),
        tenant: a.tenant.nomeExibido,
        data: hoje,
      },
    };
  }
  const c = await obterContrato(a, id).catch(() => null);
  if (!c) return null;
  const vigencia = c.inicio || c.fim ? `${br(c.inicio)} – ${br(c.fim)}` : "—";
  const successFee = [
    c.successFeePercentual ? `${Number(c.successFeePercentual).toLocaleString("pt-BR")}%` : null,
    c.successFeeMinimo ? `mín. ${reais(c.successFeeMinimo)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    titulo: c.titulo,
    campos: {
      contratantes: lista(c.contratantes),
      contratadas: lista(c.contratadas),
      objeto: c.objeto ?? "—",
      vigencia,
      honorarioFixo: c.honorarioFixo ? reais(c.honorarioFixo) : "—",
      successFee: successFee || "—",
      negocio: c.negocio ?? "—",
      data: hoje,
    },
  };
}

/** Gera o DOCX de exemplo do template, preenchido com os campos do negócio ou do contrato. */
export async function gerarDocumentoDoTemplate(
  acesso: Acesso | null,
  codigo: string,
  alvoId: string,
): Promise<{ nome: string; conteudo: string } | ErroDeServico> {
  const a = exigirTenant(acesso);
  if (!estaLigada("templatesDocx")) return desligada;
  const template = TEMPLATES.find((t) => t.codigo === codigo);
  if (!template) return { erro: "templates.erros.templateInexistente" };
  if (!z.uuid().safeParse(alvoId).success) return { erro: `templates.erros.${template.alvo}Obrigatorio` };
  const dados = await camposDoAlvo(a, template.alvo, alvoId);
  if (!dados) return { erro: `templates.erros.${template.alvo}Obrigatorio` };
  const tr = await tradutor();
  const base = `templates.modelos.${template.codigo}`;
  const paragrafos: ParagrafoDocx[] = [
    { texto: tr("templates.docx.demonstracao"), estilo: "pequeno" },
    { texto: tr(`${base}.nome`), estilo: "titulo" },
    { texto: "" },
  ];
  for (let i = 1; tr.has(`${base}.p${i}`); i++) {
    const texto = tr(`${base}.p${i}`, dados.campos);
    paragrafos.push({ texto, estilo: texto.length < 60 && /^\d+\./.test(texto) ? "subtitulo" : undefined });
  }
  paragrafos.push(
    { texto: "" },
    { texto: tr("templates.docx.camposPreenchidos"), estilo: "negrito" },
    ...template.campos.map((c) => ({
      texto: `${tr(`templates.campos.${c}`)}: ${dados.campos[c] ?? "—"}`,
      estilo: "pequeno" as const,
    })),
  );
  const docx = docxDeParagrafos(paragrafos);
  await auditar(a, "template.gerado", template.alvo === "negocio" ? "deal" : "contrato", alvoId, {
    template: template.codigo,
    simulada: true,
  });
  const nome = `${template.codigo}-${dados.titulo.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-demonstracao.docx`;
  return { nome, conteudo: Buffer.from(docx).toString("base64") };
}
