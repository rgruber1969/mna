import type { Acao, Camada, Matriz } from "./catalogo";

/**
 * Perfis de negócio por função, sem lado (decidido em 2026-11-19): o lado vem
 * do papel da empresa e o sigilo, da lista de acesso de cada registro.
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
      "Para quem coordena o contratante: cria e exclui negócios, mantém os cadastros gerais (etapas padrão, catálogo de documentos, templates) e consulta a auditoria.",
    nome: "Gestor do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCEX, valuations: VCEXB, empresas: VCEXB, cadastros: VCEX, auditoria: V },
  },
  {
    codigo: "equipe-contratante",
    descricao:
      "Para quem trabalha nos negócios no dia a dia: cria e edita negócios, valuations, empresas e pessoas; só consulta os cadastros gerais e não vê a auditoria.",
    nome: "Equipe do contratante",
    camada: "tenant",
    matriz: { painel: V, deals: VCE, valuations: VCEXB, empresas: VCEB, cadastros: V },
  },
  {
    codigo: "usuario-externo",
    descricao:
      "Para clientes, compradores e parceiros: vê o painel e a lista dos negócios em que participa, sem criar negócios; o que faz em cada negócio depende do perfil que recebe nele.",
    nome: "Usuário externo",
    camada: "tenant",
    matriz: { painel: V, deals: V },
  },

  // --- Perfis de negócio (camada "deal" no código) ----------------------------
  {
    codigo: "coordenador-deal",
    descricao:
      "Conduz o negócio: edita os dados do negócio e tem acesso completo a etapas, documentos, tarefas, contratos, e-book e ofertas.",
    nome: "Coordenador do negócio",
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
    codigo: "advogado",
    descricao:
      "Advogado de qualquer lado: trabalha em etapas, documentos, tarefas, contratos e ofertas; comenta o e-book. Vê só o que quem criou liberou para ele.",
    nome: "Advogado",
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
    codigo: "advisor",
    descricao:
      "Advisor de qualquer lado: trabalha em etapas, documentos, tarefas, contratos e ofertas; monta o e-book e o libera. Vê só o que quem criou liberou para ele.",
    nome: "Advisor",
    camada: "deal",
    matriz: {
      deal: V,
      etapas: VE,
      documentos: VCEB,
      tarefas: VCE,
      mensagens: VC,
      contratos: VCEB,
      ebook: [...VCEB, "liberar"],
      ofertas: VCE,
    },
  },
  {
    codigo: "contador",
    descricao: "Contador de qualquer lado: envia e edita documentos e cuida das tarefas.",
    nome: "Contador",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: VCEB, tarefas: VCE, mensagens: VC },
  },
  {
    codigo: "representante",
    descricao:
      "Pessoa de uma empresa do negócio (vendedora, compradora, sócios, investidores): envia documentos, atualiza as próprias tarefas, comenta e aprova o e-book e acompanha contratos e ofertas a que tem acesso.",
    nome: "Representante da empresa",
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
      "Só consulta: vê negócio, etapas, documentos liberados, tarefas e mensagens, sem baixar nem alterar.",
    nome: "Somente leitura",
    camada: "deal",
    matriz: { deal: V, etapas: V, documentos: V, tarefas: V, mensagens: V },
  },
];
