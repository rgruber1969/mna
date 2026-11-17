import { defineConfig } from "drizzle-kit";

// Carrega o .env local (o Next.js faz isso sozinho; o drizzle-kit não).
try {
  process.loadEnvFile();
} catch {
  // Sem .env (ex.: CI ou Vercel): as variáveis já vêm do ambiente.
}

/**
 * Migrações rodam com o papel dono das tabelas (DATABASE_URL_MIGRACAO), nunca
 * com o papel da aplicação (DATABASE_URL), que não pode alterar estrutura.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/esquema.ts",
  out: "./src/server/db/migracoes",
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRACAO ?? "",
  },
  strict: true,
  verbose: true,
});
