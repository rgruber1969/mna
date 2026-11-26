import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import sharp from "sharp";
import { TOKENS_PADRAO } from "@/config/marca";
import { montarEmail } from "@/server/email/modelo";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import {
  enviarImagemDaMarca,
  processarImagemDaMarca,
  removerImagemDaMarca,
  restaurarPadrao,
  salvarIdentidade,
} from "./identidade-visual";
import { lerImagemDaMarca, marcaParaEmail, marcaPorSlug } from "./marca";

/** Identidade visual do tenant (ADR-0010), contra o banco e o armazenamento de testes. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
const slug = `iv-${sufixo}`;
let tenantId = "";

function acesso(administrador: boolean): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      id: tenantId,
      slug,
      nome: "Identidade",
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: "perfil",
      nomeExibido: "Identidade",
      logo: null,
    },
    usuario: {
      id: "00000000-0000-0000-0000-000000000001",
      nome: "Admin",
      email: "",
      temAutenticador: false,
      temPasskey: false,
      doisFatoresAtivo: false,
    },
    administrador,
    exigeDoisFatores: false,
    sessaoId: "00000000-0000-0000-0000-000000000000",
    segundoFatorNaSessao: false,
  } as AcessoTenant;
}

const dados = {
  nomeExibicao: "Bastos Tigre",
  corPrimaria: "#7a1238",
  corDestaque: "#c2410c",
  corAcento: "#4338ca",
  fonte: "inter",
};

async function logo(): Promise<File> {
  const png = await sharp({
    create: { width: 1600, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], "logo.png", { type: "image/png" });
}

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Identidade') returning id`,
    [slug],
  );
  tenantId = r.rows[0].id;
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.end();
});

describe("permissão", () => {
  it("só administradores do tenant alteram a identidade", async () => {
    await expect(salvarIdentidade(acesso(false), dados)).rejects.toBeInstanceOf(AcessoNegado);
    await expect(enviarImagemDaMarca(acesso(false), "logoClaro", await logo())).rejects.toBeInstanceOf(
      AcessoNegado,
    );
    await expect(salvarIdentidade(null, dados)).rejects.toBeInstanceOf(AcessoNegado);
  });
});

describe("nome, cores e fonte", () => {
  it("salva, aplica nas telas e audita; recusa cores ilegíveis", async () => {
    expect(await salvarIdentidade(acesso(true), { ...dados, corPrimaria: "#ffd60a" })).toHaveProperty("erro");
    expect(await salvarIdentidade(acesso(true), { ...dados, fonte: "comic-sans" })).toHaveProperty("erro");

    expect(await salvarIdentidade(acesso(true), dados)).toEqual({ ok: true });
    const m = await marcaPorSlug(slug);
    expect(m?.nome).toBe("Bastos Tigre");
    expect(m?.css).toContain("--primary:#7a1238");
    expect(m?.css).toContain("--fonte-marca:var(--font-inter)");
    expect(m?.css).toContain("--cta:#4338ca");
    expect(await salvarIdentidade(acesso(true), { ...dados, corAcento: "#7a7a7a" })).toHaveProperty("erro");

    expect(await restaurarPadrao(acesso(true))).toEqual({ ok: true });
    const padrao = await marcaPorSlug(slug);
    expect(padrao?.css).toBe("");
    expect(padrao?.nome).toBe("Bastos Tigre");
    expect(padrao?.corPrimaria).toBe(TOKENS_PADRAO.primaria);

    const ev = await dono.query(
      `select tipo from evento_auditoria where tenant_id = $1 order by ocorrido_em`,
      [tenantId],
    );
    expect(ev.rows.map((r) => r.tipo)).toEqual([
      "tenant.identidade.alterada",
      "tenant.identidade.padrao_restaurado",
    ]);
  });
});

describe("imagens da marca", () => {
  it("regrava em PNG com tamanho limitado; recusa o que não é imagem", async () => {
    const bytes = async () => new Uint8Array(await (await logo()).arrayBuffer());
    const png = await processarImagemDaMarca(await bytes(), "logoClaro");
    expect(await sharp(png!).metadata()).toMatchObject({
      format: "png",
      width: 800,
      height: 200,
      hasAlpha: true,
    });
    const icone = await processarImagemDaMarca(await bytes(), "icone");
    expect(await sharp(icone!).metadata()).toMatchObject({ width: 256, height: 256 });
    const svg = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>`,
    );
    expect(await processarImagemDaMarca(svg, "logoClaro")).toBeNull();
  });

  it("recusa imagem bloqueada pelo antivírus (arquivo de teste EICAR)", async () => {
    const eicar = new File(
      ["X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"],
      "logo.png",
      { type: "image/png" },
    );
    expect(await enviarImagemDaMarca(acesso(true), "logoClaro", eicar)).toEqual({
      erro: "administracao.erros.imagemBloqueada",
    });
  });

  it("envia, serve só o arquivo atual de tenant ativo, embute no e-mail e remove", async () => {
    expect(await enviarImagemDaMarca(acesso(true), "logoClaro", await logo())).toEqual({ ok: true });
    const primeira = (await marcaPorSlug(slug))!.logoClaro!;
    expect(primeira).toMatch(new RegExp(`^/api/marca/${tenantId}/logo-claro-[0-9a-f]{16}\\.png$`));
    const arquivo = primeira.split("/").pop()!;
    expect(await lerImagemDaMarca(tenantId, arquivo)).not.toBeNull();

    // Troca: a imagem antiga deixa de ser servida.
    expect(await enviarImagemDaMarca(acesso(true), "logoClaro", await logo())).toEqual({ ok: true });
    expect(await lerImagemDaMarca(tenantId, arquivo)).toBeNull();
    const atual = (await marcaPorSlug(slug))!.logoClaro!.split("/").pop()!;
    expect(await lerImagemDaMarca(tenantId, atual)).not.toBeNull();
    expect(await lerImagemDaMarca(tenantId, "../../conta/x.png")).toBeNull();

    // E-mail: logo embutido (cid), texto escapado e versão em texto puro.
    const email = montarEmail({
      para: "x@exemplo.test",
      assunto: "a",
      saudacao: "Olá, <Ana>.",
      paragrafos: ["p"],
      link: { texto: "Entrar", url: "http://x/link" },
      marca: await marcaParaEmail(tenantId),
    });
    expect(email.anexos?.[0]).toMatchObject({ cid: "logo-do-tenant", tipo: "image/png" });
    expect(email.html).toContain(`src="cid:logo-do-tenant"`);
    expect(email.html).toContain("Olá, &lt;Ana&gt;.");
    expect(email.texto).toContain("http://x/link");

    // Tenant suspenso: nada é servido.
    await dono.query(`update tenant set suspenso_em = now() where id = $1`, [tenantId]);
    expect(await lerImagemDaMarca(tenantId, atual)).toBeNull();
    await dono.query(`update tenant set suspenso_em = null where id = $1`, [tenantId]);

    expect(await removerImagemDaMarca(acesso(true), "logoClaro")).toEqual({ ok: true });
    expect((await marcaPorSlug(slug))!.logoClaro).toBeNull();
    expect(await lerImagemDaMarca(tenantId, atual)).toBeNull();
  });

  it("recusa tipo inválido e arquivo grande demais", async () => {
    expect(await enviarImagemDaMarca(acesso(true), "fundo", await logo())).toHaveProperty("erro");
    const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "g.png", { type: "image/png" });
    expect(await enviarImagemDaMarca(acesso(true), "icone", grande)).toHaveProperty("erro");
  });
});
