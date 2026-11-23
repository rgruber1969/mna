/**
 * Catálogo padrão "onde obter" (dominio.md, D4): documentos comuns em M&A,
 * sobretudo certidões, com o órgão emissor, o link oficial, a abrangência e
 * se a emissão é gratuita. O tenant ajusta o seu em Configurações. Links
 * oficiais mudam com o tempo: confira antes de usar.
 */
export type FontePadrao = {
  nome: string;
  orgao: string;
  link: string | null;
  abrangencia: "federal" | "estadual" | "municipal";
  gratuito: boolean;
  observacao?: string;
};

export const FONTES_PADRAO: FontePadrao[] = [
  {
    nome: "Certidão de débitos relativos a tributos federais e à Dívida Ativa da União (CND/CPEN)",
    orgao: "Receita Federal / PGFN",
    link: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Certificado de Regularidade do FGTS (CRF)",
    orgao: "Caixa Econômica Federal",
    link: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Certidão Negativa de Débitos Trabalhistas (CNDT)",
    orgao: "Tribunal Superior do Trabalho",
    link: "https://cndt-certidao.tst.jus.br/",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Comprovante de inscrição e situação cadastral (CNPJ)",
    orgao: "Receita Federal",
    link: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Certidão de distribuição de ações (Justiça Federal)",
    orgao: "Tribunal Regional Federal da região",
    link: null,
    abrangencia: "federal",
    gratuito: true,
    observacao: "Emitida no site do TRF da região da sede.",
  },
  {
    nome: "Certidão de distribuição de ações trabalhistas",
    orgao: "Tribunal Regional do Trabalho da região",
    link: null,
    abrangencia: "federal",
    gratuito: true,
    observacao: "Emitida no site do TRT da região da sede.",
  },
  {
    nome: "Certidão negativa de débitos ambientais",
    orgao: "IBAMA",
    link: "https://servicos.ibama.gov.br/sicafiext/sistema.php",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Certidão consolidada de licitantes inidôneos e sanções",
    orgao: "TCU / CGU (CEIS, CNEP)",
    link: "https://certidoes-apf.apps.tcu.gov.br/",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Busca de marcas e patentes registradas",
    orgao: "INPI",
    link: "https://busca.inpi.gov.br/pePI/",
    abrangencia: "federal",
    gratuito: true,
  },
  {
    nome: "Certidão de débitos estaduais (ICMS e dívida ativa)",
    orgao: "Secretaria da Fazenda do estado",
    link: null,
    abrangencia: "estadual",
    gratuito: true,
    observacao: "Varia por UF: emitida no site da SEFAZ do estado da sede e de cada filial.",
  },
  {
    nome: "Certidão simplificada e de inteiro teor (atos societários)",
    orgao: "Junta Comercial do estado",
    link: null,
    abrangencia: "estadual",
    gratuito: false,
    observacao: "Paga; emitida no site da Junta Comercial do estado.",
  },
  {
    nome: "Certidão de distribuição de ações cíveis, fiscais e falências (Justiça Estadual)",
    orgao: "Tribunal de Justiça do estado",
    link: null,
    abrangencia: "estadual",
    gratuito: true,
    observacao: "Alguns tribunais cobram certas certidões.",
  },
  {
    nome: "Certidão de débitos municipais (mobiliários e imobiliários)",
    orgao: "Prefeitura do município",
    link: null,
    abrangencia: "municipal",
    gratuito: true,
  },
  {
    nome: "Certidão de protestos",
    orgao: "Tabelionatos de protesto (CENPROT)",
    link: "https://www.pesquisaprotesto.com.br/",
    abrangencia: "municipal",
    gratuito: false,
    observacao: "A consulta é gratuita; a certidão é paga.",
  },
  {
    nome: "Matrícula atualizada do imóvel",
    orgao: "Cartório de Registro de Imóveis (ONR)",
    link: "https://registradores.onr.org.br/",
    abrangencia: "municipal",
    gratuito: false,
  },
];
