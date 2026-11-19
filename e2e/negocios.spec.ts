import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Negócios (item 8), pela tela: criar, ver as abas, incluir empresa e
 * participante. Usa a entrada de desenvolvimento: só roda quando ela está
 * ligada no .env.
 */
try {
  process.loadEnvFile();
} catch {}

const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slug = `neg-${sufixo}`;
const email = `neg-${sufixo}@exemplo.test`;

test.skip(process.env.DEV_ENTRAR_SO_COM_EMAIL !== "sim", "entrada de desenvolvimento desligada");

const dono = () => new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });

test.beforeAll(async () => {
  test.setTimeout(90_000);
  const p = dono();
  const t = await p.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Escritório de Teste') returning id`,
    [slug],
  );
  const u = await p.query<{ id: string }>(
    `insert into usuario (nome, email, email_verificado) values ('Pessoa Negócio', $1, true) returning id`,
    [email],
  );
  await p.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    t.rows[0].id,
    u.rows[0].id,
  ]);
  await p.end();
  // Perfis, papéis, tipos de operação, empresa do contratante e a pessoa do usuário.
  execSync(`pnpm -s tenants:completar-padrao ${slug}`, { stdio: "ignore" });
  const q = dono();
  // Usuário comum (administrador exigiria 2FA) com o perfil "Gestor do contratante".
  await q.query(
    `insert into perfil_usuario (tenant_id, usuario_id, perfil_id)
     select $1, $2, id from perfil where tenant_id = $1 and padrao = 'gestor-contratante'`,
    [t.rows[0].id, u.rows[0].id],
  );
  await q.query(
    `insert into empresa (tenant_id, razao_social) values ($1, 'Vendedora de Teste Ltda'), ($1, 'Compradora de Teste S.A.')`,
    [t.rows[0].id],
  );
  await q.end();
});

test.afterAll(async () => {
  const p = dono();
  await p.query(`delete from tenant where slug = $1`, [slug]);
  await p.query(`delete from usuario where email = $1`, [email]);
  await p.end();
});

test("cria o negócio, mostra as abas e inclui uma compradora", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`http://${slug}.${dominio}/entrar`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail (desenvolvimento)").fill(email);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Pessoa Negócio" })).toBeVisible();

  await page.goto(`http://${slug}.${dominio}/negocios`);
  await expect(page.getByText("Nenhum negócio encontrado.")).toBeVisible();
  await page.getByRole("link", { name: "Novo negócio" }).click();
  await expect(page.getByRole("heading", { name: "Novo negócio" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Codinome").fill("Projeto Teste");
  await page.getByLabel("Nome interno").fill("Venda da Vendedora de Teste");
  await page.locator("select[name=tipoOperacaoId]").selectOption({ label: "Aquisição total" });
  await page
    .locator("select[name=papelContratanteId]")
    .selectOption({ label: "Escritório de advocacia da vendedora" });
  await expect(page.getByText("O contratante fica do lado vendedor.")).toBeVisible();
  await page.getByLabel("Vendedora de Teste Ltda").check();
  await page.getByRole("button", { name: "Criar negócio" }).click();

  await expect(page.getByRole("heading", { name: "N-0001 Projeto Teste" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Venda da Vendedora de Teste · Aquisição total · Em andamento")).toBeVisible();

  await page.getByRole("tab", { name: /Empresas/ }).click();
  await expect(page.getByText("Vendedora · lado vendedor", { exact: true })).toBeVisible();
  await page.locator("select[name=empresaId]").selectOption({ label: "Compradora de Teste S.A." });
  await page.locator("select[name=papelId]").selectOption({ label: "Compradora" });
  await page.getByRole("button", { name: "Incluir", exact: true }).click();
  await expect(page.getByText("Compradora · lado comprador · Prospectada", { exact: true })).toBeVisible();

  // Funil (kanban): mover a compradora para Escolhida → aparece a aba Exclusividade.
  await page.getByRole("tab", { name: /Funil de compradoras/ }).click();
  await page.getByLabel("Mover Compradora de Teste S.A. para").selectOption("escolhida");
  await expect(
    page.getByRole("region", { name: "Escolhida" }).getByText("Compradora de Teste S.A."),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Exclusividade" }).click();
  await page.getByLabel("Duração (dias)").fill("30");
  await page.getByRole("button", { name: "Definir exclusividade" }).click();
  await expect(page.getByText(/^Exclusividade de /)).toBeVisible();
  // Etapas: iniciar a Prospecção vira a etapa atual do negócio.
  await page.getByRole("tab", { name: "Etapas" }).click();
  await page.getByRole("button", { name: "Iniciar" }).first().click();
  await expect(page.getByText(/Etapa: Prospecção/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Linha do tempo" }).click();
  await expect(page.getByText(/edição gráfica/)).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Negócio criado")).toBeVisible();
  await page.getByRole("tab", { name: /Participantes/ }).click();
  await expect(
    page.getByText(/Coordenador do negócio · representando Escritório de Teste · lado vendedor/),
  ).toBeVisible();

  await page.goto(`http://${slug}.${dominio}/negocios`);
  await expect(page.getByRole("link", { name: "N-0001 Projeto Teste" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Vendedora de Teste Ltda" })).toBeVisible();
});
