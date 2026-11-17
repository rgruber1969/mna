import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta no navegador (ADR-0018).
 * Sobe a aplicação em desenvolvimento (ou reaproveita a que já estiver no ar).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  // Em desenvolvimento, a primeira visita a uma página espera a compilação.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/status",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
