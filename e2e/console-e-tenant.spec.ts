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
const emailUsuaria = `usuaria-${sufixo}@exemplo.test`;
const slug = `e2e-${sufixo}`;
const senha = "senha-e2e-segura-1";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
  await dono.query(`delete from tenant where slug = $1`, [slug]);
  await dono.query(`delete from usuario where email = any($1)`, [[emailConsole, emailTenant, emailUsuaria]]);
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

  await page.getByLabel("Nome", { exact: true }).fill("Admin do Tenant");
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

/** Autenticador virtual do Chromium: simula a passkey do aparelho (digital/PIN). */
async function autenticadorVirtual(page: Page) {
  const cdp = await page.context().newCDPSession(page);
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
}

const segundoFatorDaUltimaSessao = async (email: string) => {
  const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
  const r = await dono.query(
    `select s.segundo_fator from sessao s join usuario u on u.id = s.usuario_id
     where u.email = $1 order by s.criado_em desc limit 1`,
    [email],
  );
  await dono.end();
  return r.rows[0]?.segundo_fator;
};

test("tenant: administrador com 2FA obrigatório, convites, link mágico, exigência e redefinição do 2FA", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const base = `http://${slug}.${dominio}`;
  const admin = await (await browser.newContext()).newPage();
  admin.on("dialog", (d) => d.accept());
  await autenticadorVirtual(admin);

  // 1. O administrador aceita o convite e, por ser administrador, configura o 2FA na hora.
  const link = await linkDoEmail(emailTenant);
  expect(link).toContain(`${base}/convite/`);
  await admin.goto(link);
  await admin.getByLabel("Crie uma senha").fill(senha);
  await admin.getByLabel("Repita a senha").fill(senha);
  await admin.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(admin).toHaveURL(/\/configurar-2fa$/);
  await admin.getByLabel("Nome da passkey").fill("Notebook do admin");
  await admin.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(admin).toHaveURL(/\/entrar\?passkey=cadastrada$/);
  await admin.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(admin.getByRole("heading", { name: "Olá, Admin do Tenant" })).toBeVisible();
  expect(await segundoFatorDaUltimaSessao(emailTenant)).toBe(true);

  // Convite já usado não vale de novo.
  const outra = await (await browser.newContext()).newPage();
  await outra.goto(link);
  await expect(outra.getByText("Convite")).toHaveCount(0);

  // A conta do tenant não entra no console.
  await outra.goto(`http://admin.${dominio}/entrar`);
  await outra.getByLabel("E-mail", { exact: true }).fill(emailTenant);
  await outra.getByLabel("Senha").fill(senha);
  await outra.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(outra.getByText("acesso não permitido", { exact: false })).toBeVisible();

  // 2. O administrador convida uma usuária pela tela Usuários.
  await admin.getByRole("link", { name: "Usuários" }).click();
  await admin.getByLabel("Nome", { exact: true }).fill("Usuária E2E");
  await admin.getByLabel("E-mail do convidado").fill(emailUsuaria);
  // O tenant já nasce com os perfis padrão; a usuária entra com "Usuário externo".
  await admin.getByLabel("Usuário externo").check();
  await admin.getByRole("button", { name: "Enviar convite" }).click();
  await expect(admin.getByText("Convite enviado")).toBeVisible();
  await expect(admin.getByText(emailUsuaria)).toBeVisible();

  // 3. A usuária aceita; sem exigência de 2FA, entra direto. Depois usa o link mágico.
  const usuaria = await (await browser.newContext()).newPage();
  await autenticadorVirtual(usuaria);
  await usuaria.goto(await linkDoEmail(emailUsuaria));
  await usuaria.getByLabel("Crie uma senha").fill(senha);
  await usuaria.getByLabel("Repita a senha").fill(senha);
  await usuaria.getByRole("button", { name: "Aceitar convite" }).click();
  // A página do convite também diz "Olá, ..."; espera a navegação para a tela inicial.
  await expect(usuaria).toHaveURL(`${base}/`);
  await expect(usuaria.getByText("Acesso confirmado")).toBeVisible();
  await expect(usuaria.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  // Quem não é administrador vê a página de "não encontrado" (com streaming, o status HTTP fica 200).
  await usuaria.goto(`${base}/usuarios`);
  await expect(usuaria.getByText("This page could not be found.")).toBeVisible();
  await expect(usuaria.getByRole("heading", { name: "Usuários" })).toHaveCount(0);
  await usuaria.goto(base);

  await usuaria.getByRole("button", { name: "Sair" }).click();
  await expect(usuaria).toHaveURL(/\/entrar$/);
  await usuaria.getByText("Receber link de acesso por e-mail").click();
  await usuaria.getByLabel("E-mail para receber o link").fill(emailUsuaria);
  await usuaria.getByRole("button", { name: "Receber link por e-mail" }).click();
  await expect(usuaria.getByText("enviamos um link")).toBeVisible();
  const linkMagico = await buscarLink(emailUsuaria, /https?:\/\/\S+\/link\/\S+/);
  expect(linkMagico).toContain(`${base}/link/`);
  await usuaria.goto(linkMagico!);
  await usuaria.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(usuaria.getByRole("heading", { name: "Olá, Usuária E2E" })).toBeVisible();

  // 3b. Perfis: o convite atribuiu "Usuário externo"; ajustar a matriz muda o resultado na hora.
  await admin.getByRole("link", { name: "Perfis" }).click();
  await expect(admin.getByRole("link", { name: "Gestor do contratante" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Coordenador do deal" })).toBeVisible();
  await admin.getByRole("link", { name: "Usuário externo" }).click();
  const visivel = (l: ReturnType<Page["getByLabel"]>) => l.filter({ visible: true });
  await expect(visivel(admin.getByLabel("Painel: Ver"))).toBeChecked();
  await visivel(admin.getByLabel("Auditoria: Ver")).check();
  await admin.getByRole("button", { name: "Salvar permissões" }).click();
  await expect(admin.getByText("Permissões salvas.")).toBeVisible();
  await admin.getByRole("button", { name: "Excluir perfil" }).click();
  await expect(admin.getByText("Perfil em uso por 1 usuário(s)", { exact: false })).toBeVisible();
  await admin.getByRole("link", { name: "Usuária E2E" }).click();
  await expect(visivel(admin.getByLabel("Usuário externo"))).toBeChecked();
  await expect(visivel(admin.getByLabel("Auditoria: Ver"))).toHaveText("✓");

  // 4. O administrador passa a exigir 2FA dela: no próximo acesso, só a configuração.
  await admin.reload();
  await admin.getByRole("button", { name: "Exigir deste usuário" }).click();
  await expect(admin.getByText("Situação: exigida individualmente.")).toBeVisible();
  await usuaria.goto(base);
  await expect(usuaria).toHaveURL(/\/configurar-2fa$/);
  await usuaria.getByLabel("Nome da passkey").fill("Celular da usuária");
  await usuaria.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(usuaria).toHaveURL(/\/entrar\?passkey=cadastrada$/);
  await usuaria.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(usuaria.getByRole("heading", { name: "Olá, Usuária E2E" })).toBeVisible();

  // 5. Recuperação: não remove o único fator; a redefinição completa apaga tudo e encerra a sessão.
  await admin.reload();
  await admin.getByRole("button", { name: "Remover" }).click();
  await expect(admin.getByText("Não é possível remover o único fator", { exact: false })).toBeVisible();
  await admin.getByRole("button", { name: "Redefinir 2FA" }).click();
  await expect(admin.getByText("Nenhum fator configurado.")).toBeVisible();
  await usuaria.goto(base);
  await expect(usuaria).toHaveURL(/\/entrar$/);

  // 6. Revogação imediata.
  await admin.getByRole("button", { name: "Revogar acesso" }).click();
  await expect(admin.getByRole("heading", { name: "Usuários" })).toBeVisible();
  await expect(admin.getByText(emailUsuaria)).toHaveCount(0);
});

test("console: equipe, renomear, suspender e reativar tenant", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://admin.${dominio}/entrar`);
  await page.getByLabel("E-mail", { exact: true }).fill(emailConsole);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("Código do aplicativo autenticador").fill(await novoCodigo(page));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();

  await page.getByRole("link", { name: "Equipe" }).click();
  await expect(page.getByRole("heading", { name: "Equipe da RGRUBER" })).toBeVisible();
  await expect(page.getByText(`(${emailConsole})`)).toBeVisible();

  await page.goto(`http://admin.${dominio}/`);
  await page.getByRole("link", { name: "Escritório E2E" }).click();
  await expect(page.getByRole("heading", { name: "Escritório E2E", exact: true })).toBeVisible();
  // A página anterior fica escondida no HTML (cache do Next.js): restringe ao formulário de edição.
  const edicao = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar nome" }) });
  await edicao.getByLabel("Nome do tenant").fill("Escritório E2E Renomeado");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Nome alterado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escritório E2E Renomeado" })).toBeVisible();

  await page.getByRole("button", { name: "Suspender tenant" }).click();
  await expect(page.getByText("Suspenso desde", { exact: false })).toBeVisible();
  const visitante = await (await page.context().browser()!.newContext()).newPage();
  await visitante.goto(`http://${slug}.${dominio}/entrar`);
  await expect(visitante.getByRole("heading", { name: "Acesso suspenso" })).toBeVisible();

  await page.getByRole("button", { name: "Reativar tenant" }).click();
  await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
  await visitante.reload();
  await expect(visitante.getByRole("heading", { name: "Escritório E2E Renomeado" })).toBeVisible();
});

test("rotas do console não respondem em endereço de tenant, e vice-versa", async ({ page }) => {
  // Pelo navegador: no Windows, o Node não resolve subdomínios de localhost.
  expect((await page.goto(`http://${slug}.${dominio}/console/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://admin.${dominio}/t/${slug}/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://www.${dominio}/`))?.status()).toBe(404);
});
