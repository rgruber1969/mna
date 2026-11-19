import { expect, test } from "@playwright/test";
import pg from "pg";
import { pdfComTexto } from "../src/testes/pdf-de-teste";

/**
 * Cadastro a partir de documento e anexos (ADR-0021, item 34), pela tela.
 * Usa a entrada de desenvolvimento: só roda quando ela está ligada no .env.
 */
try {
  process.loadEnvFile();
} catch {}

const dominio = process.env.APP_DOMINIO ?? "localhost:3000";
const sufixo = Date.now().toString(36);
const slug = `doc-${sufixo}`;
const email = `doc-${sufixo}@exemplo.test`;

test.skip(process.env.DEV_ENTRAR_SO_COM_EMAIL !== "sim", "entrada de desenvolvimento desligada");

const dono = () => new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO });

// CNPJ e CPFs fictícios (válidos só pelos dígitos verificadores). A base
// pública não conhece este CNPJ: a razão social é digitada na conferência.
const CONTRATO = pdfComTexto([
  "CONTRATO SOCIAL DA EMPRESA DE TESTE",
  "CNPJ 11.444.777/0001-61",
  "FULANA DE TESTE, brasileira, empresaria, CPF 529.982.247-25;",
]);

test.beforeAll(async () => {
  const p = dono();
  const t = await p.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Tenant Documento') returning id`,
    [slug],
  );
  const u = await p.query<{ id: string }>(
    `insert into usuario (nome, email, email_verificado) values ('Pessoa Documento', $1, true) returning id`,
    [email],
  );
  // Usuário comum (administrador exigiria 2FA) com perfil que cadastra empresas e pessoas.
  await p.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    t.rows[0].id,
    u.rows[0].id,
  ]);
  const perfil = await p.query<{ id: string }>(
    `insert into perfil (tenant_id, camada, nome, descricao, matriz)
     values ($1, 'tenant', 'Cadastro', '', '{"painel":["ver"],"empresas":["ver","criar","editar","excluir","baixar"]}'::jsonb)
     returning id`,
    [t.rows[0].id],
  );
  await p.query(`insert into perfil_usuario (tenant_id, usuario_id, perfil_id) values ($1, $2, $3)`, [
    t.rows[0].id,
    u.rows[0].id,
    perfil.rows[0].id,
  ]);
  await p.end();
});

test.afterAll(async () => {
  const p = dono();
  await p.query(`delete from tenant where slug = $1`, [slug]);
  await p.query(`delete from usuario where email = $1`, [email]);
  await p.end();
});

test("lê o PDF, confere, cadastra empresa e pessoa e guarda o documento como anexo", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`http://${slug}.${dominio}/entrar`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail (desenvolvimento)").fill(email);
  await page.getByRole("button", { name: "Entrar sem senha" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Pessoa Documento" })).toBeVisible();

  await page.goto(`http://${slug}.${dominio}/empresas`);
  await page.getByRole("link", { name: "A partir de documento" }).click();
  await expect(page.getByRole("heading", { name: "Cadastrar a partir de documento" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page
    .getByLabel("Documento em PDF")
    .setInputFiles({ name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from(CONTRATO) });
  await page.getByRole("button", { name: "Ler documento" }).click();

  const proposta = page.getByRole("region", { name: "Proposta de cadastro" });
  await expect(proposta.getByText("Empresa 11.444.777/0001-61")).toBeVisible({ timeout: 30_000 });
  await proposta.getByLabel("Razão social").fill("Empresa de Teste Ltda");
  await expect(proposta.getByLabel("Nome da pessoa do CPF ***.982.247-**")).toHaveValue("Fulana de Teste");
  await proposta.getByLabel("Incluir a pessoa do CPF ***.982.247-**").check();
  await proposta.getByRole("button", { name: "Cadastrar o que está marcado" }).click();

  await expect(page.getByText("1 empresa nova, 1 pessoa nova", { exact: false })).toBeVisible();
  await expect(page.getByText("O documento foi guardado como anexo.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir o cadastro" }).click();

  await expect(page.getByRole("heading", { name: "Empresa de Teste Ltda" })).toBeVisible();
  await expect(page.getByText("contrato.pdf", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar" }).click();
  expect((await download).suggestedFilename()).toBe("contrato.pdf");
});
