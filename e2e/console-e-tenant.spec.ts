import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { linkDoEmail as buscarLink, totp } from "../src/testes/apoio";

/**
 * Fluxo completo de acesso (ADR-0011, ADR-0019; autenticacao-e-sessao.md):
 * convite do console → senha → 2FA obrigatório → cadastro de tenant →
 * convite do administrador do tenant → login no tenant → isolamento.
 * Usa só dados fictícios (@exemplo.test) e limpa tudo no final.
 */
try {
  process.loadEnvFile();
} catch {}

const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const emailConsole = `console-${sufixo}@exemplo.test`;
const emailTenant = `admin-${sufixo}@exemplo.test`;
const slug = `e2e-${sufixo}`;
const senha = "senha-e2e-segura-1";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
  await dono.query(`delete from tenant where slug = $1`, [slug]);
  await dono.query(`delete from usuario where email = any($1)`, [[emailConsole, emailTenant]]);
  await dono.query(`delete from convite_plataforma where email = $1`, [emailConsole]);
  await dono.end();
});

/** Lê no Mailpit o link de convite enviado para o e-mail. */
async function linkDoEmail(para: string): Promise<string> {
  const link = await buscarLink(para, /https?:\/\/\S+\/convite\/\S+/);
  if (!link) throw new Error("E-mail de convite não chegou ao Mailpit.");
  return link;
}

let segredo = "";
let ultimoCodigo = "";

/** Gera um código diferente do último usado (espera a próxima janela de 30 s se preciso). */
async function novoCodigo(page: Page): Promise<string> {
  let c = totp(segredo);
  while (c === ultimoCodigo) {
    await page.waitForTimeout(2000);
    c = totp(segredo);
  }
  ultimoCodigo = c;
  return c;
}

test("console: convite, senha e 2FA obrigatório; cadastro de tenant e convite do administrador", async ({
  page,
}) => {
  test.setTimeout(120_000);
  execSync(`pnpm console:convidar-admin ${emailConsole} "Console E2E"`, { stdio: "pipe" });
  const link = await linkDoEmail(emailConsole);
  expect(link).toContain(`://admin.${dominio}/convite/`);

  await page.goto(link);
  await page.getByLabel("Crie uma senha").fill(senha);
  await page.getByLabel("Repita a senha").fill(senha);
  await page.getByRole("button", { name: "Aceitar convite" }).click();

  // Sem 2FA, o console só mostra a configuração do autenticador.
  await expect(page).toHaveURL(/\/configurar-2fa$/);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Não consegue ler o QR code?").click();
  const uri = await page.locator("details code").innerText();
  segredo = new URL(uri).searchParams.get("secret")!;
  await page.getByLabel("Código de 6 dígitos").fill(await novoCodigo(page));
  await page.getByRole("button", { name: "Ativar" }).click();

  await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();
  await page.getByLabel("Nome do tenant").fill("Escritório E2E");
  await page.getByLabel("Endereço (subdomínio)").fill(slug);
  await page.getByRole("button", { name: "Criar tenant" }).click();
  await expect(page.getByRole("heading", { name: "Escritório E2E" })).toBeVisible();

  await page.getByLabel("Nome").fill("Admin do Tenant");
  await page.getByLabel("E-mail", { exact: true }).fill(emailTenant);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText("Convite enviado")).toBeVisible();

  // Sair e entrar de novo: senha + código do autenticador.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("E-mail", { exact: true }).fill(emailConsole);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dois-fatores$/);
  await page.getByLabel("Código do aplicativo autenticador").fill(await novoCodigo(page));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();
});

test("tenant: administrador aceita o convite e entra só no seu endereço", async ({ page }) => {
  const link = await linkDoEmail(emailTenant);
  expect(link).toContain(`://${slug}.${dominio}/convite/`);

  await page.goto(link);
  await page.getByLabel("Crie uma senha").fill(senha);
  await page.getByLabel("Repita a senha").fill(senha);
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Admin do Tenant" })).toBeVisible();
  await expect(page.getByText("Administrador")).toBeVisible();

  // A conta do tenant não entra no console.
  await page.goto(`http://admin.${dominio}/entrar`);
  await page.getByLabel("E-mail", { exact: true }).fill(emailTenant);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("acesso não permitido", { exact: false })).toBeVisible();

  // Convite já usado não vale de novo.
  await page.goto(link);
  await expect(page.getByText("Convite")).toHaveCount(0);
});

test("tenant: link mágico por e-mail e passkey (políticas 1A e 2A)", async ({ page, context }) => {
  test.setTimeout(90_000);
  const base = `http://${slug}.${dominio}`;

  // Link mágico: pede na tela de entrada, abre o e-mail e confirma no botão.
  await page.goto(`${base}/entrar`);
  await page.getByText("Receber link de acesso por e-mail").click();
  await page.getByLabel("E-mail para receber o link").fill(emailTenant);
  await page.getByRole("button", { name: "Receber link por e-mail" }).click();
  await expect(page.getByText("enviamos um link")).toBeVisible();
  const link = await buscarLink(emailTenant, /https?:\/\/\S+\/link\/\S+/);
  expect(link).toContain(`${base}/link/`);
  await page.goto(link!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Admin do Tenant" })).toBeVisible();

  // Passkey com autenticador virtual do Chromium (simula digital/PIN do aparelho).
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.getByRole("link", { name: "Segurança" }).click();
  await page.getByLabel("Nome da passkey").fill("Notebook de teste");
  await page.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(page.getByText("Passkey cadastrada.")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Admin do Tenant" })).toBeVisible();

  // A sessão aberta com passkey conta como dois fatores (política 2A).
  const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
  const r = await dono.query(
    `select s.segundo_fator from sessao s join usuario u on u.id = s.usuario_id
     where u.email = $1 order by s.criado_em desc limit 1`,
    [emailTenant],
  );
  await dono.end();
  expect(r.rows[0]).toEqual({ segundo_fator: true });
});

test("rotas do console não respondem em endereço de tenant, e vice-versa", async ({ page }) => {
  // Pelo navegador: no Windows, o Node não resolve subdomínios de localhost.
  expect((await page.goto(`http://${slug}.${dominio}/console/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://admin.${dominio}/t/${slug}/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://www.${dominio}/`))?.status()).toBe(404);
});
