import { extractText, getDocumentProxy } from "unpdf";
import { cnpjValido, cpfValido, soDigitos } from "@/config/documentos";

/**
 * Leitor de documentos (ADR-0021). Módulo único: a implementação local lê a
 * camada de texto do PDF no próprio servidor e encontra CNPJs e CPFs
 * válidos; uma implementação por IA pode entrar depois com a mesma saída.
 * Nada aqui sai do servidor nem vai para logs.
 */

export type CpfNoTexto = { cpf: string; nomeProximo: string | null };

export type Leitura = {
  /** O PDF tinha texto? (escaneado = false) */
  temTexto: boolean;
  cnpjs: string[];
  cpfs: CpfNoTexto[];
  /** Palpite do tipo de documento, para o anexo. */
  categoriaSugerida: "cartao-cnpj" | "contrato-social" | "outro";
};

/** Texto do PDF (todas as páginas). Vazio se não houver camada de texto ou o arquivo for inválido. */
export async function textoDoPdf(conteudo: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(conteudo));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    return "";
  }
}

/** Remove acentos, deixa em maiúsculas e um espaço só (para comparar nomes). */
export function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CPF = /(?<![\d./])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d/])/g;
/** Sequência de palavras em maiúsculas (nome como aparece em contratos), com DE/DA/DOS. */
const NOME_EM_MAIUSCULAS = /\b[A-ZÀ-Ý]{2,}(?:\s+(?:D[AEO]S?|E|[A-ZÀ-Ý]{2,}))+\b/g;
/** Palavras comuns em maiúsculas que não são nomes de pessoas. */
const NAO_E_NOME =
  /\b(LTDA|S\.?A|EIRELI|ME|EPP|CPF|CNPJ|RG|CONTRATO|SOCIAL|CL[AÁ]USULA|REP[UÚ]BLICA|FEDERATIVA|BRASIL|RECEITA|FEDERAL|MINIST[EÉ]RIO|COMPROVANTE|INSCRI[CÇ][AÃ]O|CADASTRAL|JUNTA|COMERCIAL)\b/;

/** Nome mais próximo antes do CPF (padrão de contratos: "FULANO DE TAL, brasileiro, …, CPF nº …"). */
function nomeAntes(texto: string, posicao: number): string | null {
  const janela = texto.slice(Math.max(0, posicao - 400), posicao);
  const candidatos = [...janela.matchAll(NOME_EM_MAIUSCULAS)]
    .map((m) => m[0].trim())
    .filter((n) => n.split(/\s+/).length >= 2 && !NAO_E_NOME.test(n));
  return candidatos.at(-1) ?? null;
}

/** Encontra CNPJs e CPFs válidos (dígitos verificadores) no texto, sem repetir. */
export function encontrarDocumentos(texto: string): Omit<Leitura, "temTexto"> {
  const cnpjs = [...new Set([...texto.matchAll(CNPJ)].map((m) => soDigitos(m[0])))].filter(cnpjValido);
  const cpfs = new Map<string, CpfNoTexto>();
  for (const m of texto.matchAll(CPF)) {
    const cpf = soDigitos(m[0]);
    if (!cpfValido(cpf) || cpfs.has(cpf)) continue;
    cpfs.set(cpf, { cpf, nomeProximo: nomeAntes(texto, m.index ?? 0) });
  }
  const t = normalizarNome(texto);
  const categoriaSugerida = t.includes("COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL")
    ? "cartao-cnpj"
    : t.includes("CONTRATO SOCIAL") || t.includes("ALTERACAO CONTRATUAL")
      ? "contrato-social"
      : "outro";
  return { cnpjs, cpfs: [...cpfs.values()], categoriaSugerida };
}

/** Lê um PDF e devolve o que encontrou. */
export async function lerDocumento(conteudo: Uint8Array): Promise<Leitura> {
  const texto = await textoDoPdf(conteudo);
  return { temTexto: texto.trim().length > 0, ...encontrarDocumentos(texto) };
}
