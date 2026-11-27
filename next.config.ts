import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Idiomas (ADR-0020): configuração em src/i18n/request.ts.
const comIdiomas = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // O estado das telas vai no endereço (negócio aberto, aba, filtros, busca). Para ele não
  // vazar para outros sites pelo cabeçalho Referer, o endereço completo só vai a páginas da
  // própria aplicação (ASVS V3.4.5).
  async headers() {
    return [{ source: "/:caminho*", headers: [{ key: "Referrer-Policy", value: "same-origin" }] }];
  },
  // Página de referência da API (Scalar): o script do navegador é lido do pacote pela rota da API.
  outputFileTracingIncludes: {
    "/api/[[...rota]]": ["./node_modules/@scalar/api-reference/dist/browser/standalone.js"],
  },
  // Envios por server action: foto da conta (até 2 MB) e anexos do cadastro (até 10 MB).
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
    // Cache em disco do Turbopack no desenvolvimento desligado: neste Windows ele
    // entrava num ciclo de "restart" (página recarregando sem parar).
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default comIdiomas(nextConfig);
