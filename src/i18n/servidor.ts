import { createTranslator } from "next-intl";
import { FUSO_PADRAO, IDIOMA_PADRAO, type Idioma } from "./idiomas";
import { carregarMensagens } from "./mensagens";

/**
 * Tradução fora de uma tela (ADR-0020): e-mails, tarefas em segundo plano e
 * mensagens de erro devolvidas pelas ações. Na V1, sempre no idioma padrão;
 * depois, no idioma de quem recebe.
 */
export async function tradutor(idioma: Idioma = IDIOMA_PADRAO) {
  const messages = await carregarMensagens(idioma);
  return createTranslator({ locale: idioma, messages, timeZone: FUSO_PADRAO });
}

/**
 * Erro devolvido pela camada de serviços: uma chave das mensagens (ex.:
 * "cadastros.erros.cnpjInvalido") e, se preciso, parâmetros. Nunca a frase.
 */
export type ErroDeServico = { erro: string; parametros?: Record<string, string | number> };

/** Traduz o erro de um serviço para a frase no idioma do usuário (usado pelas ações). */
export async function traduzirErro(e: ErroDeServico, idioma: Idioma = IDIOMA_PADRAO): Promise<string> {
  const t = await tradutor(idioma);
  // Chave vinda do serviço (texto livre para o tipo do tradutor).
  const traduzir = t as unknown as {
    has(k: string): boolean;
    (k: string, p?: ErroDeServico["parametros"]): string;
  };
  return traduzir.has(e.erro) ? traduzir(e.erro, e.parametros) : e.erro;
}
