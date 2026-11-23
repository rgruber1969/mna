/** Valores do formulário de contrato (usados no servidor e no navegador). */

export type ValoresDoContrato = {
  dealId: string | null;
  tipo: "mandato" | "honorarios" | "outro";
  titulo: string;
  objeto: string;
  dataAssinatura: string;
  inicio: string;
  fim: string;
  exclusivo: boolean;
  exclusividadeAte: string;
  honorarioFixo: string;
  periodicidade: "" | "unico" | "mensal" | "trimestral" | "semestral" | "anual";
  retainerDescontado: boolean;
  honorarioVariavel: boolean;
  variavelCriterio: "" | "horas" | "percentual" | "outro";
  variavelValorHora: string;
  variavelPercentual: string;
  variavelBase: string;
  variavelTeto: string;
  variavelDiaApuracao: string;
  successFeePercentual: string;
  successFeeMinimo: string;
  formaPagamento: string;
  contaBancariaId: string;
  meioRecebimento: "conta" | "pix";
  observacoes: string;
  contratantes: string[];
  contratadas: string[];
  perfis: string[];
  usuarios: string[];
};

export const valoresVazios = (dealId: string | null, usuarios: string[] = []): ValoresDoContrato => ({
  dealId,
  tipo: "mandato",
  titulo: "",
  objeto: "",
  dataAssinatura: "",
  inicio: "",
  fim: "",
  exclusivo: false,
  exclusividadeAte: "",
  honorarioFixo: "",
  periodicidade: "",
  retainerDescontado: false,
  honorarioVariavel: false,
  variavelCriterio: "",
  variavelValorHora: "",
  variavelPercentual: "",
  variavelBase: "",
  variavelTeto: "",
  variavelDiaApuracao: "",
  successFeePercentual: "",
  successFeeMinimo: "",
  formaPagamento: "",
  contaBancariaId: "",
  meioRecebimento: "conta",
  observacoes: "",
  contratantes: [],
  contratadas: [],
  perfis: [],
  usuarios,
});
