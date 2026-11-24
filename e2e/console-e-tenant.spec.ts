import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { apagarArquivosDeTeste, linkDoEmail as buscarLink, totp, ultimoEmail } from "../src/testes/apoio";

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
  // Arquivos do teste (logos do tenant e fotos das contas) também saem do armazenamento.
  const t = await dono.query(`select id from tenant where slug = $1`, [slug]);
  const u = await dono.query(`select id from usuario where email = any($1)`, [
    [emailConsole, emailTenant, emailUsuaria],
  ]);
  await apagarArquivosDeTeste([
    ...t.rows.map((r) => `tenant/${r.id}/`),
    ...u.rows.map((r) => `conta/${r.id}/`),
  ]);
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
  await expect(page).toHaveURL(/\/configurar-2fa$/, { timeout: 30_000 });
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
  await expect(admin).toHaveURL(/\/configurar-2fa$/, { timeout: 30_000 });
  await admin.getByLabel("Nome da passkey").fill("Notebook do admin");
  await admin.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(admin).toHaveURL(/\/entrar\?passkey=cadastrada$/);
  await admin.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(admin.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });
  expect(await segundoFatorDaUltimaSessao(emailTenant)).toBe(true);

  // Foto da conta: enviada em "Minha conta" e mostrada em miniatura no topo.
  await admin.getByRole("button", { name: "Conta e preferências" }).click();
  await admin.getByRole("link", { name: "Minha conta" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await admin.locator("input[name=foto]").filter({ visible: true }).setInputFiles({
    name: "eu.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(admin.getByRole("img", { name: "Prévia da foto" })).toBeVisible();
  await admin.getByLabel("Zoom").fill("2");
  await admin.getByRole("button", { name: "Salvar foto" }).click();
  await expect(admin.getByText("Foto atualizada.")).toBeVisible();
  await expect(admin.getByRole("img", { name: "Foto de Admin do Tenant" }).first()).toBeVisible();

  // Identidade visual (white label, ADR-0010): nome, cores com contraste, fonte, logo e ícone.
  await admin.getByRole("link", { name: "Configurações" }).click();
  await admin.getByRole("tab", { name: "Identidade visual" }).click();
  await admin.getByLabel("Nome de exibição").fill("Bastos E2E");
  await admin.getByRole("textbox", { name: "Cor da marca", exact: true }).fill("#ffd60a");
  await expect(admin.getByText("A cor primária é usada em textos", { exact: false })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Salvar identidade visual" })).toBeDisabled();
  await admin.getByRole("textbox", { name: "Cor da marca", exact: true }).fill("#7a1238");
  await admin.getByRole("textbox", { name: "Cor secundária", exact: true }).fill("#c2410c");
  // Cor de destaque (acento do 2 + 1): só o botão principal; a tela sugere matizes opostos.
  await admin
    .getByRole("button", { name: /^Usar #/ })
    .first()
    .click();
  await admin.getByRole("textbox", { name: "Cor de destaque", exact: true }).fill("#4338ca");
  await admin.locator("select[name=fonte]").selectOption("lato");
  await admin.getByText("Grande (18)").click();
  await admin.getByRole("button", { name: "Salvar identidade visual" }).click();
  await expect(admin.getByText("Identidade visual salva.")).toBeVisible();
  await admin.reload();
  const variavel = (nome: string) =>
    admin.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), nome);
  await expect.poll(() => variavel("--primary")).toBe("#7a1238");
  expect(await variavel("--cta")).toBe("#4338ca");
  expect(await admin.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Lato");
  expect(await admin.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("18px");
  await admin.getByRole("tab", { name: "Identidade visual" }).click();
  const enviarImagem = async (rotulo: string) => {
    const campo = admin.getByLabel(`Arquivo: ${rotulo}`);
    await campo.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await admin.locator("form", { has: campo }).getByRole("button", { name: "Enviar" }).click();
    await expect(admin.getByText("Imagem atualizada.")).toBeVisible();
  };
  await enviarImagem("Logo para fundo claro");
  await enviarImagem("Ícone da aba");
  await expect(admin.getByRole("complementary").getByRole("img", { name: "Bastos E2E" })).toBeVisible();
  await expect(admin.locator('link[rel=icon][href*="/api/marca/"]')).toHaveCount(1);
  const visitante = await (await browser.newContext()).newPage();
  await visitante.goto(`${base}/entrar`);
  await expect(visitante.getByRole("img", { name: "Bastos E2E" })).toBeVisible();
  await expect(visitante.getByRole("heading", { level: 2, name: "Bastos E2E" })).toBeVisible();

  // Empresas e pessoas (item 7), com CPF criptografado e mascarado (item 24). Sem consultas externas.
  await admin.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Empresas" }).click();
  await expect(admin.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();
  await expect(admin.getByText("contratante", { exact: true })).toBeVisible();
  await admin.getByRole("link", { name: "Nova empresa" }).click();
  await admin.getByRole("textbox", { name: "CNPJ" }).fill("11.222.333/0001-81");
  await admin.getByLabel("Razão social").fill("Alfa E2E Ltda");
  await admin.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(admin.getByRole("heading", { name: "Alfa E2E Ltda" })).toBeVisible();
  await admin.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Pessoas" }).click();
  await admin.getByRole("link", { name: "Nova pessoa" }).click();
  await admin.getByLabel("Nome completo").fill("Maria E2E");
  await admin.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await admin.getByRole("button", { name: "Cadastrar pessoa" }).click();
  await expect(admin.getByRole("heading", { name: "Maria E2E" })).toBeVisible();
  await expect(admin.getByLabel("CPF", { exact: true })).toHaveAttribute(
    "placeholder",
    "Atual: ***.982.247-**",
  );
  // Tela da pessoa em abas: documentos e empresas ficam cada um na sua.
  await admin.getByRole("tab", { name: "Documentos" }).click();
  await expect(admin).toHaveURL(/aba=documentos/);
  await admin.getByRole("button", { name: "Mostrar dados sensíveis" }).click();
  await expect(admin.getByRole("region", { name: "Dados sensíveis" })).toContainText("52998224725");
  await admin.getByRole("tab", { name: /^Empresas/ }).click();
  await admin.getByLabel("Empresa", { exact: true }).selectOption({ label: "Alfa E2E Ltda" });
  await admin.getByLabel("Tipo de vínculo").selectOption({ label: "Sócio" });
  await admin.getByLabel("Percentual de participação").fill("50");
  await admin.getByRole("button", { name: "Adicionar vínculo" }).click();
  await expect(admin.getByText("Vínculo adicionado.")).toBeVisible();
  await expect(admin.getByText("Sócio · 50%")).toBeVisible();
  // Cadastros auxiliares ficam em Configurações, em abas e tabelas.
  await admin.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Configurações" }).click();
  await expect(admin.getByRole("heading", { name: "Configurações" })).toBeVisible();
  await admin.getByRole("tab", { name: "Papéis de empresa" }).click();
  await expect(admin.getByRole("textbox", { name: "Nome de Vendedora" })).toBeVisible();

  // Paleta de comandos do cabeçalho (Ctrl K: ações, páginas e documentos); menu lateral com favoritos e recolher guardados no servidor.
  const menu = admin.getByRole("navigation", { name: "Menu" });
  await admin.getByRole("searchbox", { name: "Procurar no menu" }).fill("pess");
  await expect(admin.getByRole("banner").getByRole("option", { name: "Pessoas", exact: true })).toBeVisible();
  await expect(admin.getByRole("banner").getByRole("option", { name: "Empresas", exact: true })).toHaveCount(
    0,
  );
  await admin.getByRole("searchbox", { name: "Procurar no menu" }).fill("");
  await menu.getByRole("link", { name: "Empresas" }).hover();
  await admin.getByRole("button", { name: "Favoritar Empresas" }).click();
  await expect(admin.getByRole("button", { name: "Tirar Empresas dos favoritos" })).toBeVisible();
  await admin.getByRole("button", { name: "Recolher menu" }).click();
  await expect(admin.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  // As ações do servidor rodam uma de cada vez (a busca de mensagens também usa a fila):
  // espera a preferência chegar ao banco antes de recarregar, senão a recarga a cancela.
  const banco = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });
  await expect
    .poll(
      async () =>
        (
          await banco.query<{ recolhido: boolean }>(
            `select p.recolhido from preferencia_menu p join usuario u on u.id = p.usuario_id where u.email = $1`,
            [emailTenant],
          )
        ).rows[0]?.recolhido ?? false,
      { timeout: 30_000 },
    )
    .toBe(true);
  await banco.end();
  await admin.reload();
  await expect(admin.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await admin.getByRole("button", { name: "Expandir menu" }).click();
  await expect(menu.getByText("Favoritos")).toBeVisible();
  await expect(menu.getByRole("link", { name: "Empresas" })).toHaveCount(2);
  await admin.goto(base);

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
  // 2FA vem marcado por padrão no convite; aqui o administrador desmarca.
  await expect(admin.getByLabel("Exigir verificação em duas etapas (recomendado)")).toBeChecked();
  await admin.getByLabel("Exigir verificação em duas etapas (recomendado)").uncheck();
  await admin.getByRole("button", { name: "Enviar convite" }).click();
  await expect(admin.getByText("Convite enviado")).toBeVisible();
  await expect(admin.getByText(emailUsuaria)).toBeVisible();
  // O convite sai com a marca do tenant: nome de exibição e logo embutido.
  const convite = await ultimoEmail(emailUsuaria);
  expect(convite?.Subject).toBe("Convite para acessar Bastos E2E");
  expect(convite?.Inline).toHaveLength(1);
  expect(convite?.HTML).toContain("cid:");

  // 3. A usuária aceita; sem exigência de 2FA, entra direto. Depois usa o link mágico.
  const usuaria = await (await browser.newContext()).newPage();
  await autenticadorVirtual(usuaria);
  await usuaria.goto(await linkDoEmail(emailUsuaria));
  await usuaria.getByLabel("Crie uma senha").fill(senha);
  await usuaria.getByLabel("Repita a senha").fill(senha);
  await usuaria.getByRole("button", { name: "Aceitar convite" }).click();
  // A página do convite também diz "Olá, ..."; espera a navegação para a tela inicial.
  await expect(usuaria).toHaveURL(`${base}/`);
  await expect(usuaria.getByRole("heading", { name: "Meus negócios" })).toBeVisible();
  await expect(usuaria.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  // Quem não é administrador vê a página de "não encontrado" (com streaming, o status HTTP fica 200).
  await usuaria.goto(`${base}/usuarios`);
  await expect(usuaria.getByText("This page could not be found.")).toBeVisible();
  await expect(usuaria.getByRole("heading", { name: "Usuários" })).toHaveCount(0);
  await usuaria.goto(base);

  await usuaria.getByRole("button", { name: "Conta e preferências" }).click();
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
  await expect(usuaria.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });

  // 3b. Perfis: o convite atribuiu "Usuário externo"; ajustar a matriz muda o resultado na hora.
  await admin.getByRole("link", { name: "Perfis" }).click();
  await expect(admin.getByRole("link", { name: "Gestor do contratante" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Coordenador do negócio" })).toBeVisible();
  await admin.getByRole("link", { name: "Usuário externo" }).click();
  const visivel = (l: ReturnType<Page["getByLabel"]>) => l.filter({ visible: true });
  // Cada permissão é um botão que acende; a caixa de marcar fica por trás (acessível).
  const permissao = (nome: string) =>
    admin.locator("label").filter({ visible: true, has: admin.getByRole("checkbox", { name: nome }) });
  await expect(permissao("Painel: Ver").getByRole("checkbox")).toBeChecked();
  await permissao("Auditoria: Ver").click();
  await expect(permissao("Auditoria: Ver").getByRole("checkbox")).toBeChecked();
  await admin.getByRole("button", { name: "Salvar permissões" }).click();
  await expect(admin.getByText("Permissões salvas.")).toBeVisible();
  await admin.getByRole("button", { name: "Excluir perfil" }).click();
  await expect(admin.getByText("Perfil em uso por 1 usuário(s)", { exact: false })).toBeVisible();
  await admin.getByRole("link", { name: "Usuária E2E" }).click();
  await expect(visivel(admin.getByLabel("Usuário externo"))).toBeChecked();
  await expect(visivel(admin.getByLabel("Auditoria: Ver: permitido"))).toBeVisible();

  // 4. O administrador passa a exigir 2FA dela: no próximo acesso, só a configuração.
  await admin.reload();
  await admin.getByRole("button", { name: "Exigir deste usuário" }).click();
  await expect(admin.getByText("Situação: exigida individualmente.")).toBeVisible();
  await usuaria.goto(base);
  await expect(usuaria).toHaveURL(/\/configurar-2fa$/, { timeout: 30_000 });
  await usuaria.getByLabel("Nome da passkey").fill("Celular da usuária");
  await usuaria.getByRole("button", { name: "Cadastrar passkey" }).click();
  await expect(usuaria).toHaveURL(/\/entrar\?passkey=cadastrada$/);
  await usuaria.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(usuaria.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });

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
  // O nome de exibição definido pelo administrador do tenant prevalece sobre o nome do cadastro.
  await expect(visitante.getByRole("heading", { level: 2, name: "Bastos E2E" })).toBeVisible();
  await expect(visitante.getByRole("img", { name: "Bastos E2E" })).toBeVisible();
});

test("rotas do console não respondem em endereço de tenant, e vice-versa", async ({ page }) => {
  // Pelo navegador: no Windows, o Node não resolve subdomínios de localhost.
  expect((await page.goto(`http://${slug}.${dominio}/console/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://admin.${dominio}/t/${slug}/entrar`))?.status()).toBe(404);
  expect((await page.goto(`http://www.${dominio}/`))?.status()).toBe(404);
});
