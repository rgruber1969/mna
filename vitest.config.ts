import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile();
} catch {
  // Sem .env: variáveis vêm do ambiente (ex.: CI).
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Testes de banco usam o banco de testes, nunca o da aplicação.
    env: { DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "" },
    fileParallelism: false,
  },
});
