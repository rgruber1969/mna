import { randomBytes } from "node:crypto";
import { and, eq, gt, like } from "drizzle-orm";
import { produto } from "@/config/produto";
import { tradutor } from "@/i18n/servidor";
import { areaPermitida, auth, SENHA_TAMANHO_MINIMO } from "@/server/auth/auth";
import { banco } from "@/server/db/cliente";
import { usuario, verificacao } from "@/server/db/esquema";
import { enviarEmail } from "@/server/email/enviar";
import { montarEmail } from "@/server/email/modelo";
import { protocolo, resolverArea } from "@/server/enderecos";
import { marcaParaEmailPorSlug } from "./marca";
import { registrarEventoDeAcesso } from "./acesso";
import type { ErroDeServico } from "@/i18n/servidor";

/**
 * "Esqueci minha senha" (autenticacao-e-sessao.md, "Senha"). O link é criado
 * aqui, e não pelo Better Auth, porque só aqui se sabe o endereço do pedido:
 * ele só é enviado a quem tem acesso a esse endereço (como o link mágico). A
 * troca em si é a do Better Auth (mesmo registro de verificação), que encerra
 * as sessões abertas. O 2FA continua exigido no próximo login.
 */

export const LINK_DE_SENHA_VALIDADE_S = 15 * 60; // 15 min, uso único
const INTERVALO_ENTRE_PEDIDOS_S = 60;
const PREFIXO = "reset-password:"; // o mesmo do Better Auth (resetPassword)

const contexto = () => auth.$context;

async function enviarLinkDeSenha(host: string, u: { email: string; nome: string }, token: string) {
  const area = resolverArea(host);
  const t = await tradutor();
  await enviarEmail(
    montarEmail({
      para: u.email,
      assunto: t("emails.redefinirSenha.assunto", { produto: produto.nome }),
      saudacao: t("emails.saudacao", { nome: u.nome }),
      paragrafos: [t("emails.redefinirSenha.paragrafo")],
      link: {
        texto: t("emails.redefinirSenha.botao"),
        url: `${protocolo()}://${host}/redefinir-senha/${encodeURIComponent(token)}`,
      },
      linkAlternativo: t("emails.linkAlternativo"),
      rodape: t("emails.redefinirSenha.rodape"),
      marca: area.tipo === "tenant" ? await marcaParaEmailPorSlug(area.slug) : null,
    }),
  );
}

/** Pede o link. A resposta é sempre a mesma, exista ou não a conta. */
export async function pedirRedefinicaoDeSenha(email: string, headers: Headers): Promise<{ ok: true }> {
  const host = headers.get("host");
  const [u] = await banco()
    .select({ id: usuario.id, nome: usuario.name, email: usuario.email })
    .from(usuario)
    .where(eq(usuario.email, email.trim().toLowerCase()));
  if (!host || !u || !(await areaPermitida(host, u.id))) return { ok: true };
  // Limite: um link por minuto para a mesma conta.
  const recente = await banco()
    .select({ id: verificacao.id })
    .from(verificacao)
    .where(
      and(
        eq(verificacao.value, u.id),
        like(verificacao.identifier, `${PREFIXO}%`),
        gt(verificacao.createdAt, new Date(Date.now() - INTERVALO_ENTRE_PEDIDOS_S * 1000)),
      ),
    )
    .limit(1);
  if (recente.length) return { ok: true };
  const token = randomBytes(24).toString("base64url");
  const ctx = await contexto();
  await ctx.internalAdapter.createVerificationValue({
    value: u.id,
    identifier: `${PREFIXO}${token}`,
    expiresAt: new Date(Date.now() + LINK_DE_SENHA_VALIDADE_S * 1000),
  });
  await enviarLinkDeSenha(host, u, token);
  return { ok: true };
}

/** Grava a senha nova. O link vale só no endereço em que foi pedido. */
export async function redefinirSenha(
  token: string,
  dados: { senha: string; confirmacao: string },
  headers: Headers,
): Promise<{ ok: true } | ErroDeServico> {
  if (dados.senha.length < SENHA_TAMANHO_MINIMO)
    return { erro: "acesso.erros.senhaCurta", parametros: { minimo: SENHA_TAMANHO_MINIMO } };
  if (dados.senha !== dados.confirmacao) return { erro: "acesso.erros.senhasNaoConferem" };
  const invalido = { erro: "acesso.erros.linkDeSenhaInvalido" };
  const ctx = await contexto();
  const v = await ctx.internalAdapter.findVerificationValue(`${PREFIXO}${token}`);
  if (!v || v.expiresAt < new Date()) return invalido;
  if (!(await areaPermitida(headers.get("host"), v.value))) return invalido;
  try {
    await auth.api.resetPassword({ body: { newPassword: dados.senha, token }, headers });
  } catch {
    return invalido;
  }
  await registrarEventoDeAcesso(headers, v.value, "senha.redefinida", {});
  const [u] = await banco()
    .select({ nome: usuario.name, email: usuario.email })
    .from(usuario)
    .where(eq(usuario.id, v.value));
  if (u) {
    const area = resolverArea(headers.get("host"));
    const t = await tradutor();
    await enviarEmail(
      montarEmail({
        para: u.email,
        assunto: t("emails.senhaAlterada.assunto", { produto: produto.nome }),
        saudacao: t("emails.saudacao", { nome: u.nome }),
        paragrafos: [t("emails.senhaAlterada.paragrafo")],
        rodape: t("emails.senhaAlterada.rodape"),
        marca: area.tipo === "tenant" ? await marcaParaEmailPorSlug(area.slug) : null,
      }),
    );
  }
  return { ok: true };
}
