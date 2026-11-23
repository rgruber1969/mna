import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { pdfComTexto } from "../src/testes/pdf-de-teste";

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
  await expect(page.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });

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
  // Data room: enviar um PDF (direto ao armazenamento) e vê-lo na lista.
  await page.getByRole("tab", { name: /^Documentos/ }).click();
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await page.getByLabel("Título").fill("Contrato social");
  await page.getByLabel("Arquivo").setInputFiles({
    name: "contrato.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfComTexto(["CONTRATO SOCIAL DE TESTE"])),
  });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("button", { name: /Contrato social/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Arquivo gravado com sucesso!")).toBeVisible();
  // Vários arquivos de uma vez: cada um vira um documento com o nome do arquivo.
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await page.getByLabel("Arquivo").setInputFiles([
    { name: "anexo-a.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfComTexto(["ANEXO A"])) },
    { name: "anexo-b.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdfComTexto(["ANEXO B"])) },
  ]);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByRole("button", { name: /anexo-a/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /anexo-b/ })).toBeVisible();
  // Visualizar o PDF na tela, sem baixar.
  await page.getByRole("button", { name: "Visualizar" }).first().click();
  const janela = page.getByRole("dialog", { name: /^Visualizando / });
  await expect(janela.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await janela.getByRole("button", { name: "Fechar" }).click();

  // Tarefas: criar uma tarefa e vê-la na lista de abertas.
  await page.getByRole("tab", { name: /^Tarefas/ }).click();
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  await page.getByLabel("Título").and(page.locator(":enabled")).fill("Revisar minuta");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("button", { name: /Revisar minuta/ })).toBeVisible({ timeout: 30_000 });
  // Mensagens: conversa geral do negócio, no canal da equipe do lado vendedor.
  await page.getByRole("tab", { name: "Mensagens" }).click();
  await expect(page.getByRole("tab", { name: "Equipe do lado vendedor" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Mensagem", { exact: true }).fill("Primeira mensagem do negócio");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Primeira mensagem do negócio")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Marcar como tarefa" }).click();
  await expect(page.getByRole("link", { name: "Virou tarefa ›" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Negócio criado")).toBeVisible();
  await page.getByRole("tab", { name: /Participantes/ }).click();
  await expect(
    page.getByText(/Coordenador do negócio · representando Escritório de Teste · lado vendedor/),
  ).toBeVisible();

  await page.goto(`http://${slug}.${dominio}/negocios`);
  await expect(page.getByRole("link", { name: "N-0001 Projeto Teste" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Vendedora de Teste Ltda" })).toBeVisible();
  // Busca de documentos pelo conteúdo (texto extraído do PDF no envio).
  await page.goto(`http://${slug}.${dominio}/busca?q=${encodeURIComponent("contrato social de teste")}`);
  await expect(page.getByRole("link", { name: /Contrato social/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("no conteúdo").first()).toBeVisible();
  // Menu lateral no tema oposto: com a tela clara, o fundo do menu fica escuro (e volta ao desligar).
  const fundoDoMenu = () =>
    page.locator("[data-menu-lateral]").evaluate((el) => getComputedStyle(el).backgroundColor);
  const claro = await fundoDoMenu();
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByLabel("Menu lateral no tema oposto").check();
  await expect.poll(fundoDoMenu).not.toBe(claro);
  await page.getByLabel("Menu lateral no tema oposto").uncheck();
  await expect.poll(fundoDoMenu).toBe(claro);
  await page.keyboard.press("Escape");

  // Kanban: o negócio está na coluna Prospecção; "Mover para" leva ao Term Sheet.
  await page.goto(`http://${slug}.${dominio}/negocios?vista=kanban`);
  await expect(
    page.getByRole("region", { name: "Prospecção" }).getByText("N-0001 Projeto Teste"),
  ).toBeVisible();
  // Menu ⋮ do cartão → Mover para → Term Sheet (com confirmação).
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Mais ações de N-0001 Projeto Teste" }).click();
  await page.getByRole("menuitem", { name: /Mover para/ }).click();
  await page.getByRole("menuitem", { name: "Term Sheet" }).click();
  await expect(
    page.getByRole("region", { name: "Term Sheet" }).getByText("N-0001 Projeto Teste"),
  ).toBeVisible({
    timeout: 30_000,
  });
  // Busca no topo do kanban.
  await page.getByRole("searchbox", { name: "Procurar nos negócios…" }).fill("inexistente");
  await expect(page.getByText("N-0001 Projeto Teste")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Procurar nos negócios…" }).fill("teste");
  // Capturas para revisão visual (só quando CAPTURAS aponta para uma pasta).
  if (process.env.CAPTURAS)
    await page.screenshot({ path: `${process.env.CAPTURAS}/kanban.png`, fullPage: true });
  // Painel do cartão em abas: Resumo e Documentos.
  await page.getByRole("button", { name: "N-0001 Projeto Teste", exact: true }).click();
  const painel = page.getByRole("dialog", { name: "N-0001 Projeto Teste" });
  await expect(painel.getByRole("tab", { name: "Resumo" })).toBeVisible();
  await painel.getByRole("tab", { name: "Documentos" }).click();
  await expect(painel.getByRole("button", { name: /Contrato social/ })).toBeVisible();
  // Enviar pelo painel: o aviso de sucesso continua visível depois de recarregar a lista.
  await painel.getByRole("button", { name: "Enviar documento" }).click();
  await painel.getByLabel("Título").fill("Ata pelo painel");
  await painel.getByLabel("Arquivo").setInputFiles({
    name: "ata.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfComTexto(["ATA"])),
  });
  await painel.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(painel.getByText("Arquivo gravado com sucesso!")).toBeVisible({ timeout: 30_000 });
  await expect(painel.getByRole("button", { name: /Ata pelo painel/ })).toBeVisible();
  // Etapas no painel: só a linha do tempo.
  await painel.getByRole("tab", { name: "Etapas" }).click();
  await expect(painel.getByRole("button", { name: "Lista" })).toHaveCount(0);
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/kanban-painel.png` });
});

test("contratos: cria no negócio, envia arquivo, simula o success fee e lista", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`http://${slug}.${dominio}/entrar`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail (desenvolvimento)").fill(email);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });
  await page.goto(`http://${slug}.${dominio}/negocios`);
  await page.getByRole("link", { name: "N-0001 Projeto Teste" }).click();
  await page.getByRole("tab", { name: /^Contratos/ }).click();
  await page.getByRole("link", { name: "Novo contrato" }).click();
  await expect(page.getByRole("heading", { name: "Novo contrato" })).toBeVisible({ timeout: 40_000 });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Título").fill("Mandato de venda");
  await page.getByRole("group", { name: "Contratante(s)" }).getByLabel("Vendedora de Teste Ltda").check();
  await page.getByRole("group", { name: "Contratada(s)" }).getByLabel("Escritório de Teste").check();
  await page.getByLabel("Honorários fixos (retainer), R$").fill("20.000,00");
  await page.getByLabel("Success fee (%)").fill("2");
  await page.getByLabel("Success fee mínimo, R$").fill("150.000,00");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Contrato salvo.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Mandato de venda" })).toBeVisible();
  await expect(page.getByText("R$ 20.000,00")).toBeVisible();
  // Simulação: 2% de 10 milhões = 200 mil (acima do mínimo).
  await page.getByLabel("Simular success fee sobre o valor (R$)").fill("10.000.000");
  await expect(page.getByText("Success fee estimado: R$ 200.000,00")).toBeVisible();
  // Arquivo (versão 1), conferido pelo antivírus.
  await page.getByLabel("Enviar arquivo (nova versão)").setInputFiles({
    name: "mandato.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfComTexto(["CONTRATO DE MANDATO"])),
  });
  await expect(page.getByText("Arquivo gravado com sucesso!")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/v1 · mandato\.pdf/)).toBeVisible();
  if (process.env.CAPTURAS)
    await page.screenshot({ path: `${process.env.CAPTURAS}/contrato.png`, fullPage: true });
  // Lista do menu Contratos.
  await page.goto(`http://${slug}.${dominio}/contratos`);
  await expect(page.getByRole("link", { name: "Mandato de venda" })).toBeVisible();
  await expect(page.getByText("N-0001 Projeto Teste")).toBeVisible();
});

test("ofertas: registra, contraproposta e comparação", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`http://${slug}.${dominio}/entrar`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail (desenvolvimento)").fill(email);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByRole("link", { name: /Negócios em aberto/ })).toBeVisible({ timeout: 30_000 });
  await page.goto(`http://${slug}.${dominio}/negocios`);
  await page.getByRole("link", { name: "N-0001 Projeto Teste" }).click();
  await page.getByRole("tab", { name: /^Ofertas/ }).click();
  await page.getByRole("button", { name: "Registrar oferta" }).click();
  await page.getByLabel("Instrumento").selectOption("loi");
  await page.getByLabel("Parcela à vista, R$").fill("10.000.000");
  await page.getByRole("button", { name: "+ Parcela" }).click();
  await page.getByLabel("Parcela 1: Valor, R$").fill("5.000.000");
  await page.getByLabel("Parcela 1: Vencimento").fill("2027-12-31");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Oferta salva.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("R$ 15.000.000,00")).toBeVisible();
  // Contraproposta (rodada 2): a comparação aparece com duas ofertas.
  await page.getByRole("button", { name: "Registrar oferta" }).click();
  await page.getByLabel("Contraproposta de (oferta anterior)").selectOption({ index: 1 });
  await page.getByLabel("Parcela à vista, R$").fill("16.000.000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Rodada 2").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Comparação" })).toBeVisible();
  await expect(page.getByText("R$ 16.000.000,00").first()).toBeVisible();
  if (process.env.CAPTURAS)
    await page.screenshot({ path: `${process.env.CAPTURAS}/ofertas.png`, fullPage: true });
});
