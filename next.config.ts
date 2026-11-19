import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Idiomas (ADR-0020): configuração em src/i18n/request.ts.
const comIdiomas = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Envio da foto da conta (até 2 MB) por server action.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
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
