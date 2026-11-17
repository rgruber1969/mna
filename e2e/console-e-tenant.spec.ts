import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

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

/** Lê no Mailpit o link enviado para o e-mail. */
async function linkDoEmail(para: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const busca = await fetch(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`,
    );
    const { messages } = (await busca.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const m = (await (await fetch(`http://localhost:8025/api/v1/message/${messages[0].ID}`)).json()) as {
        Text: string;
      };
      const link = m.Text.match(/https?:\/\/\S+\/convite\/\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("E-mail de convite não chegou ao Mailpit.");
}

/** Código TOTP (RFC 6238) a partir do segredo em base32. */
function totp(segredo: string, instante = Date.now()): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of segredo.replace(/=+$/, "").toUpperCase())
    bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const chave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(instante / 30000)));
  const h = createHmac("sha1", chave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1e6).toString().padStart(6, "0");
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
  await page.getByLabel("E-mail").fill(emailTenant);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText("Convite enviado")).toBeVisible();

  // Sair e entrar de novo: senha + código do autenticador.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("E-mail").fill(emailConsole);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
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
  await page.getByLabel("E-mail").fill(emailTenant);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("acesso não permitido", { exact: false })).toBeVisible();

  // Convite já usado não vale de novo.
  await page.goto(link);
  await expect(page.getByText("Convite")).toHaveCount(0);
});

test("rotas do console não respondem em endereço de tenant, e vice-versa", async ({ page }) => {
  // Pelo navegador: no Windows, o Node não resolve subdomínios de localhost.
  expect((await page.goto(`http://${slug}.${dominio}/console/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://admin.${dominio}/t/${slug}/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://www.${dominio}/`))?.status()).toBe(404);
});
