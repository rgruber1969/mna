import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Regras automáticas que verificam os ADRs (ADR-0018).
 * Cada regra cita o ADR de origem na mensagem.
 */

// SDKs que só podem ser importados dentro do seu módulo.
const sdkRestritos = [
  { name: "inngest", message: "ADR-0015: use o módulo src/server/tarefas." },
  { name: "inngest/hono", message: "ADR-0015: use o módulo src/server/tarefas." },
  { name: "pg", message: "ADR-0004: acesso ao banco só pela camada src/server/db." },
  { name: "drizzle-orm/node-postgres", message: "ADR-0004: acesso ao banco só pela camada src/server/db." },
  { name: "resend", message: "ADR-0014: use o módulo de e-mail." },
  { name: "nodemailer", message: "ADR-0014: use o módulo de e-mail." },
];
const sdkPadroes = [
  { group: ["@aws-sdk/*"], message: "ADR-0012/0017: use os módulos de armazenamento e criptografia." },
  {
    group: ["better-auth", "better-auth/*", "@better-auth/*"],
    message: "ADR-0019: Better Auth só em src/server/auth; telas chamam src/server/services.",
  },
];
const semBetterAuth = sdkPadroes.filter((p) => !p.group.includes("better-auth"));

// Telas e rotas da API não acessam o banco: chamam a camada de serviços.
const bancoRestrito = {
  group: ["@/server/db", "@/server/db/*"],
  message: "ADR-0004: telas e API chamam src/server/services, nunca o banco diretamente.",
};

// Cores fixas em componentes (ADR-0010): só tokens semânticos.
const paleta =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const prefixos =
  "bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|shadow|accent|caret|placeholder";
const corFixa = `/(#[0-9a-fA-F]{3,8}\\b)|(\\b(${prefixos})-(${paleta})(-\\d{2,3})?\\b)|(\\[#)/`;

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/server/db/migracoes/**",
    ".claude/worktrees/**",
  ]),

  // Regra geral: SDKs restritos e banco fora das telas/API.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: sdkRestritos, patterns: [...sdkPadroes, bancoRestrito] }],
    },
  },

  // Exceções: cada módulo pode importar o seu SDK.
  {
    files: ["src/server/tarefas/**", "src/server/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: sdkRestritos.filter((s) => !s.name.startsWith("inngest")),
          patterns: [...sdkPadroes, .../* API não acessa o banco */ [bancoRestrito]],
        },
      ],
    },
  },
  {
    files: ["src/server/arquivos/**"],
    rules: { "no-restricted-imports": ["error", { paths: sdkRestritos, patterns: [bancoRestrito] }] },
  },
  {
    files: ["src/server/email/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: sdkRestritos.filter((s) => s.name !== "nodemailer"),
          patterns: [...sdkPadroes, bancoRestrito],
        },
      ],
    },
  },
  {
    // Módulo de autenticação: Better Auth + acesso às tabelas de identidade.
    files: ["src/server/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: sdkRestritos.filter((s) => s.name !== "pg" && s.name !== "drizzle-orm/node-postgres"),
          patterns: semBetterAuth,
        },
      ],
    },
  },
  {
    files: ["src/server/db/**", "src/server/services/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: sdkRestritos.filter((s) => s.name !== "pg" && s.name !== "drizzle-orm/node-postgres"),
          patterns: sdkPadroes,
        },
      ],
    },
  },

  // Telas: sem cor fixa (ADR-0010) e sem nome do produto escrito (decisão
  // "Nome do produto": usar produto.nome de src/config/produto).
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${corFixa}]`,
          message: "ADR-0010: use tokens semânticos (bg-primary, text-muted...), nunca cor fixa.",
        },
        {
          selector: `TemplateElement[value.raw=${corFixa}]`,
          message: "ADR-0010: use tokens semânticos (bg-primary, text-muted...), nunca cor fixa.",
        },
        {
          selector: "JSXText[value=/\\bMNA\\b/]",
          message: "Nome do produto: use produto.nome (src/config/produto), nunca o nome escrito.",
        },
        {
          selector: "Literal[value=/\\bMNA\\b/]",
          message: "Nome do produto: use produto.nome (src/config/produto), nunca o nome escrito.",
        },
      ],
    },
  },
]);
