import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { produto } from "@/config/produto";
import { obterAcesso, pendenciaDeDoisFatores, type Acesso } from "@/server/services/acesso";
import { obterConvite } from "@/server/services/convites";
import { Cartao, Carregando, Moldura, Titulo } from "@/components/ui/basicos";
import { FundoDeLinhas } from "@/components/ui/fundo-de-linhas";
import { Cabecalho, EstruturaDoTenant } from "./cabecalho";
import { FormFoto } from "@/components/conta/formulario-foto";
import { AvisoDaEntrada } from "./aviso-da-entrada";
import { FormAutenticador, FormSair } from "./formularios";
import { BotoesDeLoginSocial } from "./login-social";
import {
  BotaoEntrarComPasskey,
  FormCriarPasskey,
  FormEsqueciSenha,
  FormPedirLink,
  FormRedefinirSenha,
  FormUsarLink,
} from "./passkey-e-link";
import { FormConvite, FormEntrar, FormEntrarSoComEmail, FormSegundoFator } from "./formularios";

/** Telas de acesso compartilhadas pelo console e pelos tenants. */

/** Logotipo da RGRUBER para fundo escuro (docs/marca/rgruber; mínimo de 120 px de largura). */
export function LogoRgruber() {
  const t = useTranslations("comum.basicos");
  return (
    <Image
      src="/marca/rgruber-horizontal-negativa.svg"
      alt={t("logoAlt")}
      width={200}
      height={57}
      priority
      unoptimized
    />
  );
}

/**
 * Tela de entrada. Com `marca` (console), fundo escuro, logotipo acima do
 * cartão, título próprio em destaque e sem rodapé.
 */
export function TelaEntrar({
  titulo,
  marca,
  linhas = false,
  soComEmail = false,
  logoDoTenant,
  loginSocial = false,
}: {
  titulo: string;
  marca?: ReactNode;
  /** Logo do tenant (white label), acima do nome do produto. */
  logoDoTenant?: ReactNode;
  /** Fundo escuro com linhas animadas (entrada do tenant). */
  linhas?: boolean;
  /** Entrada de desenvolvimento (só e-mail) disponível neste endereço. */
  soComEmail?: boolean;
  /** Botões de Google e Microsoft (item 3; simulados enquanto não forem reais). */
  loginSocial?: boolean;
}) {
  const t = useTranslations("acesso.entrada");
  const tSenha = useTranslations("acesso.senha");
  return (
    <Moldura
      destaque={Boolean(marca) || linhas}
      logo={marca ?? logoDoTenant}
      rodape={!marca}
      fundo={linhas ? <FundoDeLinhas /> : undefined}
    >
      <Cartao>
        <header className="mb-6">
          <h1 className="text-primary text-4xl font-bold tracking-tight">{produto.nome}</h1>
          <h2 className="text-text mt-1 text-xl font-medium">{titulo}</h2>
        </header>
        <Suspense>
          <AvisoDaEntrada />
        </Suspense>
        <FormEntrar />
        <details className="mt-3">
          <summary className="text-primary cursor-pointer text-sm font-medium">{tSenha("esqueci")}</summary>
          <div className="mt-4">
            <FormEsqueciSenha />
          </div>
        </details>
        <div className="border-border my-6 border-t" />
        <BotaoEntrarComPasskey />
        {loginSocial && <BotoesDeLoginSocial />}
        <details className="mt-4">
          <summary className="text-primary cursor-pointer text-sm font-medium">{t("receberLink")}</summary>
          <div className="mt-4">
            <FormPedirLink />
          </div>
        </details>
        {soComEmail && <FormEntrarSoComEmail />}
      </Cartao>
    </Moldura>
  );
}

export function TelaSegundoFator() {
  const t = useTranslations("acesso");
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={t("geral.verificacaoEmDuasEtapas")}>{t("segundoFator.titulo")}</Titulo>
        <FormSegundoFator />
      </Cartao>
    </Moldura>
  );
}

async function ConteudoConvite({ token }: { token: Promise<string> }) {
  await connection();
  const t = await getTranslations("acesso.convite");
  const tokenDoConvite = await token;
  const c = await obterConvite((await headers()).get("host"), tokenDoConvite);
  if (!c) notFound();
  return (
    <>
      <Titulo sobre={t("sobre")}>{t("ola", { nome: c.nome })}</Titulo>
      <p className="text-muted mb-6 text-sm">
        {t.rich("intro", {
          onde: c.onde ?? t("ondeConsole"),
          email: c.email,
          destaque: (partes) => <strong className="text-text">{partes}</strong>,
        })}{" "}
        {c.contaExiste ? t("contaExiste") : t("contaNova")}
      </p>
      <FormConvite token={tokenDoConvite} contaExiste={c.contaExiste} nome={c.nome} />
    </>
  );
}

export function TelaConvite({ token }: { token: Promise<string> }) {
  return (
    <Moldura>
      <Cartao>
        <Suspense fallback={<Carregando />}>
          <ConteudoConvite token={token} />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

export function TelaLink({ token }: { token: Promise<string> }) {
  const t = useTranslations("acesso");
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={t("link.sobre")}>{t("geral.entrar")}</Titulo>
        <p className="text-muted mb-6 text-sm">{t("link.texto")}</p>
        <Suspense fallback={<Carregando />}>
          <TokenDoLink token={token} />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

/** Tela do link de "Esqueci minha senha" (vale 15 min, uma vez, só neste endereço). */
export function TelaRedefinirSenha({ token }: { token: Promise<string> }) {
  const t = useTranslations("acesso.senha");
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={t("sobre")}>{t("titulo")}</Titulo>
        <p className="text-muted mb-6 text-sm">{t("texto")}</p>
        <Suspense fallback={<Carregando />}>
          <TokenDaSenha token={token} />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

async function TokenDaSenha({ token }: { token: Promise<string> }) {
  return <FormRedefinirSenha token={decodeURIComponent(await token)} />;
}

async function TokenDoLink({ token }: { token: Promise<string> }) {
  return <FormUsarLink token={decodeURIComponent(await token)} />;
}

/**
 * Portão do 2FA (autenticacao-e-sessao.md, "Exigência no tenant"): sem fator
 * configurado, vai para a configuração; com fator, mas sessão aberta só com
 * senha ou link, pede para entrar de novo. Devolve null quando está tudo em dia.
 */
export function portaoDeDoisFatores(acesso: Acesso) {
  const pendencia = pendenciaDeDoisFatores(acesso);
  if (pendencia === "configurar") redirect("/configurar-2fa");
  return pendencia === "reentrar" ? <ExigeSegundoFator /> : null;
}

async function ConteudoConfigurar2fa() {
  await connection();
  const t = await getTranslations("acesso.configurar2fa");
  const acesso = await obterAcesso(new Headers(await headers()));
  if (!acesso) redirect("/entrar");
  if (pendenciaDeDoisFatores(acesso) !== "configurar") redirect("/");
  return (
    <>
      <p className="text-muted mb-6 text-sm">
        {acesso.area === "console"
          ? t("exigeConsole")
          : t("exigeTenant", { tenant: acesso.tenant.nomeExibido })}{" "}
        {t("escolha")}
      </p>
      <h2 className="text-text mb-2 text-sm font-semibold">{t("opcaoPasskey")}</h2>
      <FormCriarPasskey reentrar />
      <div className="border-border my-6 border-t" />
      <h2 className="text-text mb-2 text-sm font-semibold">{t("opcaoAutenticador")}</h2>
      <FormAutenticador />
    </>
  );
}

/** Configuração obrigatória do 2FA: quando exigido e sem fator, só esta tela fica disponível. */
export function TelaConfigurar2fa() {
  const t = useTranslations("acesso.geral");
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={t("seguranca")}>{t("verificacaoEmDuasEtapas")}</Titulo>
        <Suspense fallback={<Carregando />}>
          <ConteudoConfigurar2fa />
        </Suspense>
      </Cartao>
    </Moldura>
  );
}

/** Aviso para quem precisa entrar de novo com dois fatores (ex.: só usou a senha). */
export function ExigeSegundoFator() {
  const t = useTranslations("acesso");
  return (
    <Moldura>
      <Cartao>
        <Titulo sobre={t("geral.seguranca")}>{t("exigeSegundoFator.titulo")}</Titulo>
        <p className="text-muted mb-6 text-sm">{t("exigeSegundoFator.texto")}</p>
        <FormSair />
      </Cartao>
    </Moldura>
  );
}

async function ConteudoSeguranca() {
  await connection();
  const t = await getTranslations("acesso");
  const acesso = await obterAcesso(new Headers(await headers()));
  if (!acesso) redirect("/entrar");
  const conteudo = (
    <main className="bg-surface flex flex-1 flex-wrap items-start justify-center gap-6 px-4 py-10">
      <Cartao>
        <Titulo sobre={t("seguranca.minhaConta")}>{t("seguranca.foto")}</Titulo>
        <FormFoto nome={acesso.usuario.nome} foto={acesso.usuario.foto} />
      </Cartao>
      <Cartao>
        <Titulo sobre={t("geral.seguranca")}>{t("seguranca.passkey")}</Titulo>
        {acesso.usuario.temPasskey && (
          <p className="text-success mb-4 text-sm">{t("seguranca.jaTemPasskey")}</p>
        )}
        <FormCriarPasskey />
      </Cartao>
      <Cartao>
        <Titulo sobre={t("geral.seguranca")}>{t("seguranca.autenticador")}</Titulo>
        {acesso.usuario.temAutenticador ? (
          <p className="text-success text-sm">{t("seguranca.autenticadorAtivo")}</p>
        ) : (
          <FormAutenticador />
        )}
      </Cartao>
    </main>
  );
  // No tenant, o menu lateral; no console, a barra superior.
  if (acesso.area === "tenant") return <EstruturaDoTenant acesso={acesso}>{conteudo}</EstruturaDoTenant>;
  return (
    <>
      <Cabecalho
        area={t("seguranca.tituloConsole", { produto: produto.nome })}
        usuario={acesso.usuario}
        console
      />
      {conteudo}
    </>
  );
}

export function TelaSeguranca() {
  return (
    <Suspense fallback={<Carregando />}>
      <ConteudoSeguranca />
    </Suspense>
  );
}
