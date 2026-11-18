import type { Acao, Camada, Matriz } from "./catalogo";

/**
 * Perfis padrão aprovados em 2026-11-18 (perfis-e-permissoes.md, "Perfis
 * padrão"), copiados para cada tenant novo. Depois da cópia, são do tenant.
 * Mudanças aqui só valem para tenants criados depois (modelos centralizados:
 * backlog-futuro.md).
 */

export type PerfilPadrao = {
  codigo: string;
  nome: string;
  descricao: string;
  camada: Camada;
  matriz: Matriz;
};

const V: Acao[] = ["ver"];
const VC: Acao[] = ["ver", "criar"];
const VE: Acao[] = ["ver", "editar"];
const VB: Acao[] = ["ver", "baixar"];
const VCB: Acao[] = ["ver", "criar", "baixar"];
const VCE: Acao[] = ["ver", "criar", "editar"];
const VCEB: Acao[] = ["ver", "criar", "editar", "baixar"];
const VCEX: Acao[] = ["ver", "criar", "editar", "excluir"];
const VCEXB: Acao[] = ["ver", "criar", "editar", "excluir", "baixar"];

export const PERFIS_PADRAO: PerfilPadrao[] = [
  // --- Perfis do tenant -------------------------------------------------------
  {
    codigo: "gestor-contratante",
    descricao:
      "Para quem coordena o contratante: cria e exclui deals, mantém os cadastros gerais (etapas padrão, catálogo de documentos, templates) e consulta a auditoria.",
    nome: "Gestor do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCEX, valuations: VCEXB, empresas: VCEXB, cadastros: VCEX, auditoria: V },
  },
  {
    codigo: "equipe-contratante",
    descricao:
      "Para quem trabalha nos deals no dia a dia: cria e edita deals, valuations, empresas e pessoas; só consulta os cadastros gerais e não vê a auditoria.",
    nome: "Equipe do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCE, valuations: VCEXB, empresas: VCEB, cadastros: V },
  },
  {
    codigo: "usuario-externo",
    descricao:
      "Para clientes, compradores e parceiros: vê o painel e a lista dos deals em que participa; o que faz em cada deal depende do perfil que recebe nele.",
    nome: "Usuário externo",
    camada: "tenant",
    matriz: { painel: V, deals: V },
  },

  // --- Perfis de deal ---------------------------------------------------------
  {
    codigo: "coordenador-deal",
    descricao:
      "Conduz o deal: edita os dados do deal e tem acesso completo a etapas, documentos, tarefas, contratos, e-book e ofertas.",
    nome: "Coordenador do deal",
    camada: "deal",
    matriz: {
      deal: VE,
      etapas: VCEX,
      documentos: VCEXB,
      tarefas: VCEX,
      mensagens: VC,
      contratos: VCEXB,
      ebook: [...VCEXB, "liberar"],
      ofertas: VCEX,
    },
  },
  {
    codigo: "advogado-vendedora",
    descricao:
      "Advogado do lado vendedor: trabalha em etapas, documentos, tarefas, contratos e ofertas; comenta o e-book.",
    nome: "Advogado da vendedora",
    camada: "deal",
    matriz: {
      deal: V,
      etapas: VE,
      documentos: VCEB,
      tarefas: VCE,
      mensagens: VC,
      contratos: VCEB,
      ebook: ["ver", "comentar"],
      ofertas: VCE,
    },
  },
  {
    codigo: "advisor-vendedora",
    descricao:
      "Advisor do lado vendedor: trabalha em etapas, documentos, tarefas e ofertas; monta o e-book e o libera ao comprador.",
    nome: "Advisor da vendedora",
    camada: "deal",
    matriz: {
      deal: V,
      etapas: VE,
      documentos: VCEB,
      tarefas: VCE,
      mensagens: VC,
      contratos: VB,
      ebook: [...VCEB, "liberar"],
      ofertas: VCE,
    },
  },
  {
    codigo: "contador-vendedora",
    descricao: "Contador do lado vendedor: envia e edita documentos e cuida das tarefas.",
    nome: "Contador da vendedora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "vendedora",
    descricao:
      "Pessoa da empresa vendedora (ex.: sócio ou diretor): envia documentos, atualiza as próprias tarefas, comenta e aprova o e-book e acompanha as ofertas.",
    nome: "Representante da vendedora",
    camada: "deal",
    matriz: {
      deal: V,
      etapas: V,
      documentos: VCB,
      tarefas: VE,
      mensagens: VC,
      contratos: VB,
      ebook: ["ver", "comentar", "aprovar"],
      ofertas: V,
    },
  },
  {
    codigo: "compradora",
    descricao:
      "Pessoa da empresa compradora: vê e baixa os documentos liberados, atualiza as próprias tarefas e vê o e-book liberado.",
    nome: "Representante da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VB, tarefas: VE, mensagens: VC, ebook: V },
  },
  {
    codigo: "advisor-compradora",
    descricao:
      "Advisor do lado comprador: envia e baixa documentos, cuida das tarefas e vê o e-book depois que o lado vendedor o libera.",
    nome: "Advisor da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCB, tarefas: VCE, mensagens: VC, ebook: V },
  },
  {
    codigo: "advogado-compradora",
    descricao:
      "Advogado do lado comprador: vê, envia e baixa documentos, cuida de tarefas e vê o e-book liberado.",
    nome: "Advogado da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCB, tarefas: VCE, mensagens: VC, ebook: V },
  },
  {
    codigo: "contador-compradora",
    descricao: "Contador do lado comprador: envia e edita documentos e cuida das tarefas.",
    nome: "Contador da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "auditor",
    descricao:
      "Diligências (contábil, jurídica, trabalhista etc.), normalmente só na subetapa da sua diligência: documentos e tarefas.",
    nome: "Auditor (diligência)",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "somente-leitura",
    descricao:
      "Só consulta: vê deal, etapas, documentos liberados, tarefas e mensagens, sem baixar nem alterar.",
    nome: "Somente leitura",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: V, tarefas: V, mensagens: V },
  },
];
