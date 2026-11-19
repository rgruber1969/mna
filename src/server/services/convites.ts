import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth, SENHA_TAMANHO_MINIMO } from "@/server/auth/auth";
import { banco, comTenant } from "@/server/db/cliente";
import {
  conta,
  convite,
  convitePlataforma,
  eventoAuditoria,
  eventoPlataforma,
  usuario,
  vinculoTenant,
} from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail, type MarcaDoEmail } from "@/server/email/modelo";
import { marcaParaEmail } from "./marca";
import { resolverArea, urlDaArea } from "@/server/enderecos";
import { produto } from "@/config/produto";
import { tradutor } from "@/i18n/servidor";
import { entrar, gerarToken, hashDoToken, tenantPorSlug, type ResultadoLogin } from "./acesso";
import { atribuirPerfis, filtrarPerfisDoTenant } from "./perfis";
import { ligarContaAPessoa } from "./pessoas";
import { notificar } from "./notificacoes";

/**
 * Convites (ADR-0019, regra 4; docs/projeto/autenticacao-e-sessao.md):
 * cadastro só por convite, validade de 3 dias, uso único, token guardado
 * apenas como hash. Aceitar o convite confirma o e-mail.
 */

export const VALIDADE_CONVITE_MS = 3 * 24 * 60 * 60 * 1000;

const Pessoa = z.object({
  nome: z.string().trim().min(2, "acesso.erros.informeNome").max(120),
  email: z.email("acesso.erros.emailInvalido").trim().toLowerCase(),
});

export type DadosPessoa = z.input<typeof Pessoa>;

function validarPessoa(dados: DadosPessoa): z.output<typeof Pessoa> | { erro: string } {
  const r = Pessoa.safeParse(dados);
  return r.success ? r.data : { erro: r.error.issues[0]?.message ?? "acesso.erros.dadosInvalidos" };
}

async function enviarConvite(
  para: string,
  nome: string,
  link: string,
  /** Nome do tenant; null = console da plataforma. */
  nomeDoLugar: string | null,
  marca?: MarcaDoEmail | null,
): Promise<void> {
  const t = await tradutor();
  const onde = nomeDoLugar ?? t("emails.convite.ondeConsole");
  await enviarEmail(
    montarEmail({
      para,
      assunto: t("emails.convite.assunto", { onde }),
      saudacao: t("emails.saudacao", { nome }),
      paragrafos: [
        t("emails.convite.paragrafo1", { onde, produto: produto.nome }),
        t("emails.convite.paragrafo2"),
      ],
      link: { texto: t("emails.convite.botao"), url: link },
      linkAlternativo: t("emails.linkAlternativo"),
      rodape: t("emails.convite.rodape"),
      marca,
    }),
  );
}

// --- Emissão -----------------------------------------------------------------

/** Convite para o console. Emitido pelo script local ou por um usuário do console. */
export async function convidarUsuarioDaPlataforma(
  dados: DadosPessoa,
  atorId: string | null,
): Promise<{ ok: true } | { erro: string }> {
  const p = validarPessoa(dados);
  if ("erro" in p) return p;
  const { token, hash } = gerarToken();
  const [c] = await banco()
    .insert(convitePlataforma)
    .values({
      email: p.email,
      nome: p.nome,
      tokenHash: hash,
      expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
    })
    .returning({ id: convitePlataforma.id });
  await banco()
    .insert(eventoPlataforma)
    .values({ tipo: "convite.plataforma.emitido", atorId, alvoTipo: "convite_plataforma", alvoId: c.id });
  await enviarConvite(p.email, p.nome, urlDaArea({ tipo: "console" }, `/convite/${token}`), null);
  return { ok: true };
}

/** Convite para um tenant. Só administradores (do tenant ou da plataforma) chamam. */
export async function emitirConviteDoTenant(
  t: { id: string; slug: string; nome: string },
  dados: DadosPessoa & { administrador: boolean; perfis?: string[]; exigeDoisFatores?: boolean },
  atorId: string,
): Promise<{ ok: true } | { erro: string }> {
  const p = validarPessoa(dados);
  if ("erro" in p) return p;
  const { token, hash } = gerarToken();
  await comTenant(t.id, async (tx) => {
    const [c] = await tx
      .insert(convite)
      .values({
        tenantId: t.id,
        email: p.email,
        nome: p.nome,
        administrador: dados.administrador,
        perfis: dados.perfis ?? [],
        exigeDoisFatores: dados.exigeDoisFatores ?? true,
        tokenHash: hash,
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
        criadoPor: atorId,
      })
      .returning({ id: convite.id });
    await tx.insert(eventoAuditoria).values({
      tenantId: t.id,
      tipo: "convite.emitido",
      atorId,
      alvoTipo: "convite",
      alvoId: c.id,
      detalhes: { administrador: dados.administrador },
    });
  });
  const marca = await marcaParaEmail(t.id);
  await enviarConvite(
    p.email,
    p.nome,
    urlDaArea({ tipo: "tenant", slug: t.slug }, `/convite/${token}`),
    marca?.nome ?? t.nome,
    marca,
  );
  return { ok: true };
}

// --- Consulta e aceite ---------------------------------------------------------

type ConviteValido = {
  id: string;
  nome: string;
  email: string;
  administrador: boolean;
  /** Perfis do tenant a atribuir ao aceitar. */
  perfis: string[];
  /** Marcação individual de 2FA a gravar no vínculo. */
  exigeDoisFatores: boolean;
  tenant: { id: string; slug: string; nome: string } | null;
  /** Quem convidou (avisado quando o convite é aceito). */
  criadoPor?: string | null;
};

async function conviteValido(host: string | null, token: string): Promise<ConviteValido | null> {
  const area = resolverArea(host);
  const hash = hashDoToken(token);
  const agora = new Date();
  if (area.tipo === "console") {
    const [c] = await banco()
      .select()
      .from(convitePlataforma)
      .where(
        and(
          eq(convitePlataforma.tokenHash, hash),
          isNull(convitePlataforma.aceitoEm),
          gt(convitePlataforma.expiraEm, agora),
        ),
      );
    return c
      ? {
          id: c.id,
          nome: c.nome,
          email: c.email,
          administrador: true,
          perfis: [],
          exigeDoisFatores: true,
          tenant: null,
        }
      : null;
  }
  if (area.tipo === "tenant") {
    const t = await tenantPorSlug(area.slug);
    if (!t) return null;
    const [c] = await comTenant(t.id, (tx) =>
      tx
        .select()
        .from(convite)
        .where(and(eq(convite.tokenHash, hash), isNull(convite.aceitoEm), gt(convite.expiraEm, agora))),
    );
    return c
      ? {
          id: c.id,
          nome: c.nome,
          email: c.email,
          administrador: c.administrador,
          perfis: c.perfis,
          exigeDoisFatores: c.exigeDoisFatores,
          tenant: t,
          criadoPor: c.criadoPor,
        }
      : null;
  }
  return null;
}

/** `onde`: nome do tenant; null = console da plataforma (a tela traduz). */
export type ConviteParaTela = { nome: string; email: string; onde: string | null; contaExiste: boolean };

/** Dados para a tela do convite. O convidado é o dono do e-mail, então pode saber se já tem conta. */
export async function obterConvite(host: string | null, token: string): Promise<ConviteParaTela | null> {
  const c = await conviteValido(host, token);
  if (!c) return null;
  const [u] = await banco().select({ id: usuario.id }).from(usuario).where(eq(usuario.email, c.email));
  return {
    nome: c.nome,
    email: c.email,
    onde: c.tenant?.nome ?? null,
    contaExiste: Boolean(u),
  };
}

const CONVITE_INVALIDO = "acesso.erros.conviteInvalido";

export async function aceitarConvite(
  token: string,
  dados: { nome?: string; senha: string },
  headers: Headers,
): Promise<ResultadoLogin> {
  const c = await conviteValido(headers.get("host"), token);
  if (!c) return { erro: CONVITE_INVALIDO };

  const ctx = await auth.$context;
  const [existente] = await banco()
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.email, c.email));
  let usuarioId: string;

  if (existente) {
    // Conta já existe: confirma a identidade pela senha atual.
    const [credencial] = await banco()
      .select({ hash: conta.password })
      .from(conta)
      .where(and(eq(conta.userId, existente.id), eq(conta.providerId, "credential")));
    const senhaOk = credencial?.hash
      ? await ctx.password.verify({ hash: credencial.hash, password: dados.senha })
      : false;
    if (!senhaOk) return { erro: "acesso.erros.senhaIncorreta" };
    usuarioId = existente.id;
  } else {
    if (dados.senha.length < SENHA_TAMANHO_MINIMO || dados.senha.length > 128)
      return { erro: "acesso.erros.senhaCurta", parametros: { minimo: SENHA_TAMANHO_MINIMO } };
    const nome = (dados.nome ?? c.nome).trim();
    if (nome.length < 2) return { erro: "acesso.erros.informeNome" };
    const novo = await ctx.internalAdapter.createUser(
      { name: nome, email: c.email, emailVerified: true },
      { method: "email-password" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: novo.id,
      providerId: "credential",
      accountId: novo.id,
      password: await ctx.password.hash(dados.senha),
    });
    usuarioId = novo.id;
  }

  if (c.tenant) {
    const t = c.tenant;
    const [u] = await banco().select({ nome: usuario.name }).from(usuario).where(eq(usuario.id, usuarioId));
    await comTenant(t.id, async (tx) => {
      await tx
        .insert(vinculoTenant)
        .values({
          tenantId: t.id,
          usuarioId,
          situacao: "ativo",
          administrador: c.administrador,
          exigeDoisFatores: c.exigeDoisFatores,
        })
        .onConflictDoUpdate({
          target: [vinculoTenant.tenantId, vinculoTenant.usuarioId],
          set: {
            situacao: "ativo",
            administrador: c.administrador,
            exigeDoisFatores: c.exigeDoisFatores,
            atualizadoEm: new Date(),
          },
        });
      // Perfis do convite (os que ainda existem) substituem os anteriores.
      await atribuirPerfis(tx, t.id, usuarioId, await filtrarPerfisDoTenant(tx, c.perfis));
      // A conta passa a ser uma pessoa do tenant (ligada pelo e-mail, se já cadastrada).
      await ligarContaAPessoa(tx, t.id, { usuarioId, nome: u?.nome ?? c.nome, email: c.email });
      await tx.update(convite).set({ aceitoEm: new Date() }).where(eq(convite.id, c.id));
      if (c.criadoPor && c.criadoPor !== usuarioId)
        await notificar(
          tx,
          t.id,
          c.criadoPor,
          "convite_aceito",
          { nome: u?.nome ?? c.nome },
          `/usuarios/${usuarioId}`,
        );
      await tx.insert(eventoAuditoria).values({
        tenantId: t.id,
        tipo: "convite.aceito",
        atorId: usuarioId,
        alvoTipo: "convite",
        alvoId: c.id,
      });
    });
  } else {
    await banco().update(usuario).set({ papelPlataforma: "admin" }).where(eq(usuario.id, usuarioId));
    await banco()
      .update(convitePlataforma)
      .set({ aceitoEm: new Date() })
      .where(eq(convitePlataforma.id, c.id));
    await banco().insert(eventoPlataforma).values({
      tipo: "convite.plataforma.aceito",
      atorId: usuarioId,
      alvoTipo: "convite_plataforma",
      alvoId: c.id,
    });
  }

  return entrar({ email: c.email, senha: dados.senha }, headers);
}
