import { getRequestConfig } from "next-intl/server";
import { FUSO_PADRAO, IDIOMA_PADRAO } from "./idiomas";

/**
 * Configuração de idioma de cada requisição (ADR-0020). Na V1 o idioma é
 * sempre o padrão; com o segundo idioma, passa a vir da preferência do
 * usuário (ou do navegador), sem o idioma na URL.
 */
export default getRequestConfig(async () => {
  const locale = IDIOMA_PADRAO;
  return {
    locale,
    timeZone: FUSO_PADRAO,
    messages: (await import(`./mensagens/${locale}.json`)).default,
  };
});
