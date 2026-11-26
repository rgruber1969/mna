"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  aceitarConviteAcao,
  confirmarAutenticadorAcao,
  convidarAdministradorAcao,
  criarTenantAcao,
  entrarAcao,
  entrarSoComEmailAcao,
  iniciarAutenticadorAcao,
  sairAcao,
  segundoFatorAcao,
  type Estado,
} from "@/app/acoes/acesso";
import { Aviso, Botao, Campo } from "@/components/ui/basicos";

/**
 * useActionState que, se a ação devolver um destino, navega no navegador
 * (requisição nova, que passa pelo proxy). Navega a partir do retorno da ação,
 * e não de um efeito, porque o formulário pode sumir quando a página é
 * atualizada após o login.
 */
function useAcao(acao: (estado: Estado, dados: FormData) => Promise<Estado>) {
  return useActionState(async (anterior: Estado, dados: FormData) => {
    const r = await acao(anterior, dados);
    if (r?.destino) window.location.assign(r.destino);
    return r;
  }, undefined);
}

export function FormSair() {
  const t = useTranslations("acesso.geral");
  const [, acao] = useAcao(sairAcao);
  return (
    <form action={acao}>
      <button className="text-primary font-medium">{t("sair")}</button>
    </form>
  );
}

export function FormEntrar() {
  const t = useTranslations("acesso.geral");
  const [estado, acao, enviando] = useAcao(entrarAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo={t("email")} name="email" type="email" autoComplete="username" required />
      <Campo rotulo={t("senha")} name="senha" type="password" autoComplete="current-password" required />
      <Botao disabled={enviando}>{enviando ? t("entrando") : t("entrar")}</Botao>
    </form>
  );
}

/** Só no ambiente local, com a entrada de desenvolvimento ligada. */
/** Entrada de desenvolvimento; `emailPadrao` vem de DEV_EMAIL_PADRAO (.env local, nunca no código). */
export function FormEntrarSoComEmail({ emailPadrao }: { emailPadrao?: string }) {
  const t = useTranslations("acesso.desenvolvimento");
  const tGeral = useTranslations("acesso.geral");
  const [estado, acao, enviando] = useAcao(entrarSoComEmailAcao);
  return (
    <form action={acao} className="border-warning bg-warning-surface mt-6 rounded-md border p-4">
      <p className="text-warning mb-3 text-xs font-semibold tracking-wide uppercase">{t("aviso")}</p>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo={t("rotuloEmail")} name="email" type="email" defaultValue={emailPadrao} required />
      <Botao disabled={enviando}>{enviando ? tGeral("entrando") : t("botao")}</Botao>
    </form>
  );
}

export function FormSegundoFator() {
  const t = useTranslations("acesso.segundoFator");
  const [estado, acao, enviando] = useAcao(segundoFatorAcao);
  const [recuperacao, setRecuperacao] = useState(false);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo
        rotulo={recuperacao ? t("codigoDeRecuperacao") : t("codigoDoAplicativo")}
        name="codigo"
        autoComplete="one-time-code"
        inputMode={recuperacao ? "text" : "numeric"}
        required
        autoFocus
      />
      <label className="text-muted mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="recuperacao"
          checked={recuperacao}
          onChange={(e) => setRecuperacao(e.target.checked)}
        />
        {t("usarRecuperacao")}
      </label>
      <Botao disabled={enviando}>{enviando ? t("verificando") : t("verificar")}</Botao>
    </form>
  );
}

export function FormConvite({
  token,
  contaExiste,
  nome,
}: {
  token: string;
  contaExiste: boolean;
  nome: string;
}) {
  const t = useTranslations("acesso.convite");
  const [estado, acao, enviando] = useAcao(aceitarConviteAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="token" value={token} />
      {contaExiste ? (
        <Campo
          rotulo={t("senhaAtual")}
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      ) : (
        <>
          <Campo rotulo={t("nome")} name="nome" defaultValue={nome} autoComplete="name" required />
          <Campo
            rotulo={t("criarSenha")}
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Campo
            rotulo={t("repitaSenha")}
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </>
      )}
      <Botao disabled={enviando}>{enviando ? t("aceitando") : t("aceitar")}</Botao>
    </form>
  );
}

export function FormAutenticador() {
  const t = useTranslations("acesso.autenticador");
  const tGeral = useTranslations("acesso.geral");
  const [inicio, iniciar, iniciando] = useActionState(iniciarAutenticadorAcao, undefined);
  const [confirmacao, confirmar, confirmando] = useAcao(confirmarAutenticadorAcao);

  if (!inicio?.qr) {
    return (
      <form action={iniciar}>
        {inicio?.erro && <Aviso>{inicio.erro}</Aviso>}
        <p className="text-muted mb-4 text-sm">{t("intro")}</p>
        <Campo
          rotulo={tGeral("senha")}
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
        <Botao disabled={iniciando}>{iniciando ? t("preparando") : t("continuar")}</Botao>
      </form>
    );
  }

  return (
    <form action={confirmar}>
      {confirmacao?.erro && <Aviso>{confirmacao.erro}</Aviso>}
      <ol className="text-text mb-4 list-decimal space-y-2 pl-5 text-sm">
        <li>{t("passo1")}</li>
        <li>{t("passo2")}</li>
        <li>{t("passo3")}</li>
      </ol>
      <div
        className="bg-background mx-auto mb-4 w-48"
        aria-label={t("qrAlt")}
        dangerouslySetInnerHTML={{ __html: inicio.qr }}
      />
      <details className="text-muted mb-4 text-xs">
        <summary>{t("semQr")}</summary>
        <code className="break-all">{inicio.uri}</code>
      </details>
      <div className="border-border mb-4 rounded-md border p-3">
        <p className="text-text mb-2 text-sm font-medium">{t("codigosDeRecuperacao")}</p>
        <ul className="text-text grid grid-cols-2 gap-1 font-mono text-sm">
          {inicio.codigosRecuperacao?.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <Campo
        rotulo={t("codigoDe6Digitos")}
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
      />
      <Botao disabled={confirmando}>{confirmando ? t("confirmando") : t("ativar")}</Botao>
    </form>
  );
}

export function FormNovoTenant() {
  const t = useTranslations("acesso.novoTenant");
  const [estado, acao, enviando] = useAcao(criarTenantAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo={t("nome")} name="nome" required />
      <Campo
        rotulo={t("endereco")}
        name="slug"
        placeholder={t("exemploEndereco")}
        pattern="[a-z0-9-]+"
        required
      />
      <Botao disabled={enviando}>{enviando ? t("criando") : t("criar")}</Botao>
    </form>
  );
}

export function FormConvidarAdministrador({ tenantId }: { tenantId: string }) {
  const t = useTranslations("acesso.convidarAdministrador");
  const tGeral = useTranslations("acesso.geral");
  const [estado, acao, enviando] = useActionState(convidarAdministradorAcao, undefined);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="tenantId" value={tenantId} />
      <Campo rotulo={t("nome")} name="nome" required />
      <Campo rotulo={tGeral("email")} name="email" type="email" required />
      <Botao disabled={enviando}>{enviando ? tGeral("enviando") : t("enviar")}</Botao>
    </form>
  );
}
