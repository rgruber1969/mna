import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Entrada de desenvolvimento (autenticacao-e-sessao.md): só roda quando a
 * marcação está ligada no .env local.
 */
try {
  process.loadEnvFile();
} catch {}

const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slug = `dev-${sufixo}`;
const email = `dev-${sufixo}@exemplo.test`;

test.skip(process.env.DEV_ENTRAR_SO_COM_EMAIL !== "sim", "entrada de desenvolvimento desligada");

const dono = () => new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });

test.beforeAll(async () => {
  const p = dono();
  const t = await p.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant Dev') returning id`,
    [slug],
  );
  const u = await p.query<{ id: string }>(
    `insert into usuario (nome, email, email_verificado) values ('Pessoa Dev', $1, true) returning id`,
    [email],
  );
  await p.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    t.rows[0].id,
    u.rows[0].id,
  ]);
  await p.end();
});

test.afterAll(async () => {
  const p = dono();
  await p.query(`delete from tenant where slug = $1`, [slug]);
  await p.query(`delete from usuario where email = $1`, [email]);
  await p.end();
});

test("entra só com o e-mail no endereço local; e-mail sem acesso é recusado", async ({ page }) => {
  await page.goto(`http://${slug}.${dominio}/entrar`);
  await expect(page.getByText("Modo desenvolvimento: entrar só com e-mail")).toBeVisible();
  // Espera a página ficar interativa (no modo de desenvolvimento, a primeira carga é lenta).
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail (desenvolvimento)").fill(`ninguem-${sufixo}@exemplo.test`);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByText("acesso não permitido", { exact: false })).toBeVisible();

  await page.getByLabel("E-mail (desenvolvimento)").fill(email);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });
});
