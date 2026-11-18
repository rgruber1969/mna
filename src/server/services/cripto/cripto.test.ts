import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  cofreLocal,
  criptografar,
  descriptografar,
  destruirChavesDoTenant,
  indiceCego,
  rotacionarChave,
  usarCofre,
} from "./cripto";

/** Criptografia de campos em envelope, com chave por tenant (ADR-0017 e adendo). */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const tenants = { A: "", B: "" };
const CPF = "12345678909";

beforeAll(async () => {
  usarCofre(cofreLocal); // limpa o cache entre arquivos de teste
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Cripto A'), ($2, 'Cripto B') returning id`,
    [`ca-${sufixo}`, `cb-${sufixo}`],
  );
  [tenants.A, tenants.B] = r.rows.map((x) => x.id);
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = any($1)`, [[tenants.A, tenants.B]]);
  await dono.end();
});

describe("criptografar e descriptografar", () => {
  it("volta o texto original; nada legível no dado gravado; cada vez um resultado diferente", async () => {
    const a = await criptografar(tenants.A, CPF);
    const b = await criptografar(tenants.A, CPF);
    expect(a).toMatch(/^c1\.1\./);
    expect(a).not.toContain(CPF);
    expect(a).not.toBe(b);
    expect(await descriptografar(tenants.A, a)).toBe(CPF);
    expect(await descriptografar(tenants.A, "")).toBe("");
    expect(await criptografar(tenants.A, "")).toBe("");
  });

  it("guarda a chave do tenant só trancada, uma por tenant", async () => {
    await criptografar(tenants.B, "x");
    const r = await dono.query(
      `select tenant_id, versao, chave_trancada from chave_tenant where tenant_id = any($1)`,
      [[tenants.A, tenants.B]],
    );
    expect(r.rows).toHaveLength(2);
    for (const linha of r.rows) expect(linha.chave_trancada).toMatch(/^local1\./);
  });

  it("dado de um tenant não abre em outro, nem alterado", async () => {
    const a = await criptografar(tenants.A, CPF);
    await expect(descriptografar(tenants.B, a)).rejects.toThrow();
    const alterado = a.slice(0, -3) + (a.endsWith("A") ? "B" : "A") + a.slice(-2);
    await expect(descriptografar(tenants.A, alterado)).rejects.toThrow();
  });

  it("acentos e textos longos", async () => {
    const texto = "Maria José da Conceição — comunhão parcial de bens";
    expect(await descriptografar(tenants.A, await criptografar(tenants.A, texto))).toBe(texto);
  });
});

describe("índice cego", () => {
  it("igual para o mesmo valor no mesmo tenant; diferente entre tenants; sem o valor legível", () => {
    expect(indiceCego(tenants.A, CPF)).toBe(indiceCego(tenants.A, CPF));
    expect(indiceCego(tenants.A, CPF)).not.toBe(indiceCego(tenants.B, CPF));
    expect(indiceCego(tenants.A, CPF)).not.toContain(CPF);
  });
});

describe("rotação e destruição", () => {
  it("após a rotação, dados antigos continuam legíveis e os novos usam a nova versão", async () => {
    const antigo = await criptografar(tenants.A, CPF);
    expect(await rotacionarChave(tenants.A)).toBe(2);
    const novo = await criptografar(tenants.A, CPF);
    expect(novo).toMatch(/^c1\.2\./);
    expect(await descriptografar(tenants.A, antigo)).toBe(CPF);
    expect(await descriptografar(tenants.A, novo)).toBe(CPF);
  });

  it("destruição criptográfica: sem as chaves, os dados do tenant ficam ilegíveis", async () => {
    const dado = await criptografar(tenants.B, CPF);
    await destruirChavesDoTenant(tenants.B);
    await expect(descriptografar(tenants.B, dado)).rejects.toThrow();
  });

  it("chave mestra diferente não abre as chaves de dados", async () => {
    const dado = await criptografar(tenants.A, CPF);
    const original = process.env.CRIPTO_CHAVE_MESTRA;
    process.env.CRIPTO_CHAVE_MESTRA = Buffer.alloc(32, 7).toString("base64url");
    usarCofre(cofreLocal); // esvazia o cache: força destrancar de novo
    await expect(descriptografar(tenants.A, dado)).rejects.toThrow();
    process.env.CRIPTO_CHAVE_MESTRA = original;
    usarCofre(cofreLocal);
    expect(await descriptografar(tenants.A, dado)).toBe(CPF);
  });
});
