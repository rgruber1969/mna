import type { Acao, Camada, Matriz } from "./catalogo";

/**
 * Perfis padrão aprovados em 2026-11-18 (perfis-e-permissoes.md, "Perfis
 * padrão"), copiados para cada tenant novo. Depois da cópia, são do tenant.
 * Mudanças aqui só valem para tenants criados depois (modelos centralizados:
 * backlog-futuro.md).
 */

export type PerfilPadrao = { codigo: string; nome: string; camada: Camada; matriz: Matriz };

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
    nome: "Gestor do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCEX, valuations: VCEXB, empresas: VCEXB, cadastros: VCEX, auditoria: V },
  },
  {
    codigo: "equipe-contratante",
    nome: "Equipe do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCE, valuations: VCEXB, empresas: VCEB, cadastros: V },
  },
  {
    codigo: "usuario-externo",
    nome: "Usuário externo",
    camada: "tenant",
    matriz: { painel: V, deals: V },
  },

  // --- Perfis de deal ---------------------------------------------------------
  {
    codigo: "coordenador-deal",
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
    nome: "Contador da vendedora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "vendedora",
    nome: "Vendedora",
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
    nome: "Compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VB, tarefas: VE, mensagens: VC, ebook: V },
  },
  {
    codigo: "advogado-compradora",
    nome: "Advogado da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCB, tarefas: VCE, mensagens: VC, ebook: V },
  },
  {
    codigo: "contador-compradora",
    nome: "Contador da compradora",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "auditor",
    nome: "Auditor (diligência)",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "somente-leitura",
    nome: "Somente leitura",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: V, tarefas: V, mensagens: V },
  },
];
