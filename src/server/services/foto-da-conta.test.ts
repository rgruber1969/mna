import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import sharp from "sharp";
import { auth } from "@/server/auth/auth";
import type { Acesso } from "./acesso";
import { enviarFotoDaConta, lerFotoDaConta, processarFoto, removerFotoDaConta } from "./foto-da-conta";

/** Foto da conta (dados-pessoais.md), contra o banco e o armazenamento de testes. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const email = (nome: string) => `${nome}-${sufixo}@exemplo.test`;
const tenants = { A: "", B: "" };

async function criarConta(nome: string, tenantId: string): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: email(nome), emailVerified: true },
    { method: "admin" },
  );
  await dono.query(`insert into vinculo_tenant (tenant_id, usuario_id, situacao) values ($1, $2, 'ativo')`, [
    tenantId,
    u.id,
  ]);
  return u.id;
}

function acesso(usuarioId: string, tenantId: string): Acesso {
  return {
    area: "tenant",
    tenant: { id: tenantId, slug: "x", nome: "X", exigeDoisFatoresDeTodos: false, modoPermissoes: "perfil" },
    usuario: {
      id: usuarioId,
      nome: "P",
      email: "",
      temAutenticador: false,
      temPasskey: false,
      doisFatoresAtivo: false,
    },
    administrador: false,
    exigeDoisFatores: false,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: false,
  };
}

/** JPG com metadados de câmera e GPS, como sai de um celular. */
const fotoDeCelular = () =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: "#3366aa" } })
    .jpeg()
    .withExif({ IFD0: { Make: "Celular", Model: "Teste" }, IFD3: { GPSLatitudeRef: "S" } })
    .toBuffer();

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Foto A'), ($2, 'Foto B') returning id`,
    [`fa-${sufixo}`, `fb-${sufixo}`],
  );
  [tenants.A, tenants.B] = r.rows.map((x) => x.id);
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = any($1)`, [[tenants.A, tenants.B]]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("processamento da foto", () => {
  it("gera imagem nova 256 × 256 em WebP, sem metadados", async () => {
    const r = await processarFoto(new Uint8Array(await fotoDeCelular()));
    expect(r).not.toBeNull();
    const m = await sharp(r!).metadata();
    expect(m).toMatchObject({ format: "webp", width: 256, height: 256 });
    expect(m.exif).toBeUndefined();
  });

  it("recusa o que não é imagem, mesmo com nome de imagem", async () => {
    expect(await processarFoto(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
      .gif()
      .toBuffer();
    expect(await processarFoto(new Uint8Array(gif))).toBeNull();
  });
});

describe("envio, leitura e remoção", () => {
  it("a própria pessoa envia e remove; colegas do tenant veem; outros tenants não", async () => {
    const ana = await criarConta("ana", tenants.A);
    const colega = await criarConta("colega", tenants.A);
    const deFora = await criarConta("defora", tenants.B);
    const arquivo = new File([new Uint8Array(await fotoDeCelular())], "eu.jpg", { type: "image/jpeg" });

    expect(await enviarFotoDaConta(acesso(ana, tenants.A), arquivo)).toEqual({ ok: true });
    const chave = (await dono.query(`select imagem from usuario where id = $1`, [ana])).rows[0].imagem;
    expect(chave).toMatch(new RegExp(`^conta/${ana}/foto-[0-9a-f]{16}\\.webp$`));

    expect(await lerFotoDaConta(acesso(ana, tenants.A), ana)).not.toBeNull();
    expect(await lerFotoDaConta(acesso(colega, tenants.A), ana)).not.toBeNull();
    expect(await lerFotoDaConta(acesso(deFora, tenants.B), ana)).toBeNull();
    expect(await lerFotoDaConta(null, ana)).toBeNull();

    expect(await removerFotoDaConta(acesso(ana, tenants.A))).toEqual({ ok: true });
    expect(await lerFotoDaConta(acesso(ana, tenants.A), ana)).toBeNull();
    const ev = await dono.query(
      `select tipo from evento_auditoria where ator_id = $1 and tipo like 'conta.foto.%' order by ocorrido_em`,
      [ana],
    );
    expect(ev.rows.map((r) => r.tipo)).toEqual(["conta.foto.alterada", "conta.foto.removida"]);
  });

  it("recusa arquivo grande demais", async () => {
    const bia = await criarConta("bia", tenants.A);
    const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "g.jpg", { type: "image/jpeg" });
    expect(await enviarFotoDaConta(acesso(bia, tenants.A), grande)).toHaveProperty("erro");
  });
});
