/**
 * Nome comercial e configurações do produto.
 * "MNA" é apenas o codinome interno: telas, e-mails e textos usam sempre
 * `produto.nome` (decisão menor "Nome do produto"; CLAUDE.md).
 */
export const produto = {
  nome: process.env.PRODUCT_NAME ?? "MNA",
  versao: process.env.npm_package_version ?? "0.1.0",
} as const;
