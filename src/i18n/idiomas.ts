/**
 * Idiomas da aplicação (ADR-0020). Na V1 só português; inglês e espanhol
 * entram traduzindo os arquivos de `mensagens/` (o idioma vira opção na tela
 * só quando o arquivo existir).
 */
export const IDIOMAS = ["pt-BR"] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Idioma = "pt-BR";
/** Fuso para datas e horas (a aplicação atende o Brasil na V1). */
export const FUSO_PADRAO = "America/Sao_Paulo";
