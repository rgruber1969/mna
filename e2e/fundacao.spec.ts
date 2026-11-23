import { expect, test } from "@playwright/test";

const nomeDoProduto = process.env.PRODUCT_NAME ?? "MNA";

test("página inicial mostra o nome do produto e o rodapé da RGRUBER", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(nomeDoProduto);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nomeDoProduto);
  await expect(page.getByText("Copyright by")).toBeVisible();
  await expect(page.getByRole("img", { name: "RGRUBER Consultoria" })).toBeVisible();
});

test("API responde e a documentação abre", async ({ page, request }) => {
  const resposta = await request.get("/api/status");
  expect(resposta.ok()).toBeTruthy();
  expect((await resposta.json()).status).toBe("ok");

  await page.goto("/");
  await page.getByRole("link", { name: "Documentação da API" }).click();
  await expect(page.getByText("/api/status")).toBeVisible();
});

test("o endereço não vaza para outros sites (Referrer-Policy, ASVS V3.4.5)", async ({ request }) => {
  const resposta = await request.get("/");
  expect(resposta.headers()["referrer-policy"]).toBe("same-origin");
});
