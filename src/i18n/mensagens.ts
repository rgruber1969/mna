import { IDIOMA_PADRAO, type Idioma } from "./idiomas";

/**
 * Mensagens por idioma (ADR-0020), divididas em arquivos por área para que
 * cada área seja editada sem conflito. Cada arquivo tem chaves de primeiro
 * nível próprias (ex.: `cadastros`), e todos são juntados aqui.
 */
export const AREAS = [
  "comum",
  "layout",
  "erros",
  "acesso",
  "cadastros",
  "negocios",
  "etapas",
  "documentos",
  "tarefas",
  "mensagens",
  "busca",
  "chaves",
  "resumos",
  "administracao",
  "emails",
] as const;

export type Mensagens = Record<string, unknown>;

export async function carregarMensagens(idioma: Idioma = IDIOMA_PADRAO): Promise<Mensagens> {
  const partes = await Promise.all(
    AREAS.map(async (area) => (await import(`./mensagens/${idioma}/${area}.json`)).default as Mensagens),
  );
  return Object.assign({}, ...partes);
}
