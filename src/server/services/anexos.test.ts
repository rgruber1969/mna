import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { auth } from "@/server/auth/auth";
import { lerArquivo } from "@/server/arquivos/armazenamento";
import { AcessoNegado, type AcessoTenant } from "./acesso";
import { anexarArquivo, baixarAnexo, listarAnexos, removerAnexo } from "./anexos";
import { tipoRealDoArquivo } from "./antivirus";
import { criarEmpresa, excluirEmpresa } from "./empresas";

/** Anexos do cadastro (item 34): criptografados, antivírus, permissões e auditoria. */
const dono = new pg.Pool({ connectionString: process.env.DATABASE_URL_MIGRACAO_TESTE });
const sufixo = Date.now().toString(36);
let tenantId = "";
let adminId = "";
let semPerfilId = "";
let empresaId = "";

const PDF = new TextEncoder().encode("%PDF-1.4\nconteudo de teste do contrato social\n%%EOF");
const EICAR = new TextEncoder().encode(
  "%PDF X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
);

function acesso(usuarioId: string, administrador: boolean): AcessoTenant {
  return {
    area: "tenant",
    tenant: {
      id: tenantId,
      slug: `ax-${sufixo}`,
      nome: "Anexos",
      exigeDoisFatoresDeTodos: false,
      modoPermissoes: "perfil",
      nomeExibido: "Anexos",
      logo: null,
    },
    usuario: {
      id: usuarioId,
      nome: "Teste",
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

async function criarConta(nome: string, administrador = false): Promise<string> {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser(
    { name: nome, email: `${nome}-${sufixo}@exemplo.test`, emailVerified: true },
    { method: "admin" },
  );
  await dono.query(
    `insert into vinculo_tenant (tenant_id, usuario_id, situacao, administrador) values ($1, $2, 'ativo', $3)`,
    [tenantId, u.id, administrador],
  );
  return u.id;
}

beforeAll(async () => {
  const r = await dono.query<{ id: string }>(
    `insert into tenant (slug, nome) values ($1, 'Anexos') returning id`,
    [`ax-${sufixo}`],
  );
  tenantId = r.rows[0].id;
  adminId = await criarConta("admin", true);
  semPerfilId = await criarConta("semperfil");
  const e = await criarEmpresa(acesso(adminId, true), {
    cnpj: "",
    identificadorEstrangeiro: "",
    razaoSocial: "Empresa dos Anexos Ltda",
    nomeFantasia: "",
    cnae: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais: "",
    site: "",
    telefone: "",
    email: "",
    observacoes: "",
    grupoId: "",
  });
  if (!("id" in e)) throw new Error("empresa não criada");
  empresaId = e.id;
});

afterAll(async () => {
  await dono.query(`delete from tenant where id = $1`, [tenantId]);
  await dono.query(`delete from usuario where email like '%-${sufixo}@exemplo.test'`);
  await dono.end();
});

describe("tipo real do arquivo", () => {
  it("reconhece pelo conteúdo e recusa o resto", () => {
    expect(tipoRealDoArquivo(PDF, "x.exe")).toBe("application/pdf");
    expect(tipoRealDoArquivo(new Uint8Array([0x4d, 0x5a, 0x90]), "x.pdf")).toBeNull();
    expect(tipoRealDoArquivo(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "x.zip")).toBeNull();
  });
});

describe("anexos do cadastro", () => {
  it("guarda criptografado, lista, baixa e remove, com auditoria", async () => {
    const a = acesso(adminId, true);
    const r = await anexarArquivo(
      a,
      { tipo: "empresa", id: empresaId },
      {
        categoria: "contrato-social",
        descricao: "Versão 2024",
        nome: "contrato social.pdf",
        conteudo: PDF,
      },
    );
    if (!("id" in r)) throw new Error(r.erro);

    // No armazenamento, o conteúdo não aparece legível; no banco, nem o nome.
    const linha = await dono.query(`select chave, nome_arquivo_cifrado from anexo_cadastro where id = $1`, [
      r.id,
    ]);
    const gravado = await lerArquivo(linha.rows[0].chave);
    expect(Buffer.from(gravado!).toString("latin1")).not.toContain("contrato social");
    expect(linha.rows[0].nome_arquivo_cifrado).not.toContain("contrato");

    const lista = await listarAnexos(a, { tipo: "empresa", id: empresaId });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nomeArquivo: "contrato social.pdf", categoria: "contrato-social" });

    const baixado = await baixarAnexo(a, r.id);
    expect(Buffer.from(baixado!.conteudo).equals(Buffer.from(PDF))).toBe(true);
    expect(baixado!.tipo).toBe("application/pdf");

    expect(await removerAnexo(a, r.id)).toEqual({ ok: true });
    expect(await lerArquivo(linha.rows[0].chave)).toBeNull();

    const eventos = await dono.query(
      `select tipo from evento_auditoria where tenant_id = $1 and tipo like 'anexo.%' order by ocorrido_em`,
      [tenantId],
    );
    expect(eventos.rows.map((e) => e.tipo)).toEqual(["anexo.enviado", "anexo.baixado", "anexo.removido"]);
  });

  it("antivírus bloqueia antes de gravar e avisa os administradores", async () => {
    const r = await anexarArquivo(
      acesso(adminId, true),
      { tipo: "empresa", id: empresaId },
      {
        categoria: "outro",
        nome: "teste.pdf",
        conteudo: EICAR,
      },
    );
    expect(r).toEqual({ erro: "cadastros.anexos.erros.bloqueado" });
    const n = await dono.query(
      `select count(*)::int as n from notificacao where tenant_id = $1 and tipo = 'arquivo_bloqueado'`,
      [tenantId],
    );
    expect(n.rows[0].n).toBe(1);
    expect(await listarAnexos(acesso(adminId, true), { tipo: "empresa", id: empresaId })).toHaveLength(0);
  });

  it("recusa formato, categoria e quem não tem permissão", async () => {
    const alvo = { tipo: "empresa" as const, id: empresaId };
    const a = acesso(adminId, true);
    expect(
      await anexarArquivo(a, alvo, {
        categoria: "outro",
        nome: "x.exe",
        conteudo: new Uint8Array([0x4d, 0x5a]),
      }),
    ).toEqual({ erro: "cadastros.anexos.erros.formato" });
    expect(await anexarArquivo(a, alvo, { categoria: "rg", nome: "x.pdf", conteudo: PDF })).toEqual({
      erro: "cadastros.anexos.erros.categoria",
    });
    await expect(
      anexarArquivo(acesso(semPerfilId, false), alvo, { categoria: "outro", nome: "x.pdf", conteudo: PDF }),
    ).rejects.toBeInstanceOf(AcessoNegado);
  });

  it("excluir a empresa apaga os arquivos dos anexos", async () => {
    const a = acesso(adminId, true);
    const r = await anexarArquivo(
      a,
      { tipo: "empresa", id: empresaId },
      {
        categoria: "certidao",
        nome: "certidao.pdf",
        conteudo: PDF,
      },
    );
    if (!("id" in r)) throw new Error(r.erro);
    const { rows } = await dono.query(`select chave from anexo_cadastro where id = $1`, [r.id]);
    expect(await excluirEmpresa(a, empresaId)).toEqual({ ok: true });
    expect(await lerArquivo(rows[0].chave)).toBeNull();
  });
});
