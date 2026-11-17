"use client";

import { useActionState, useState } from "react";
import {
  aceitarConviteAcao,
  confirmarAutenticadorAcao,
  convidarAdministradorAcao,
  criarTenantAcao,
  entrarAcao,
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
  const [, acao] = useAcao(sairAcao);
  return (
    <form action={acao}>
      <button className="text-primary font-medium">Sair</button>
    </form>
  );
}

export function FormEntrar() {
  const [estado, acao, enviando] = useAcao(entrarAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="username" required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Botao disabled={enviando}>{enviando ? "Entrando..." : "Entrar"}</Botao>
    </form>
  );
}

export function FormSegundoFator() {
  const [estado, acao, enviando] = useAcao(segundoFatorAcao);
  const [recuperacao, setRecuperacao] = useState(false);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo
        rotulo={recuperacao ? "Código de recuperação" : "Código do aplicativo autenticador"}
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
        Usar um código de recuperação
      </label>
      <Botao disabled={enviando}>{enviando ? "Verificando..." : "Verificar"}</Botao>
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
  const [estado, acao, enviando] = useAcao(aceitarConviteAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="token" value={token} />
      {contaExiste ? (
        <Campo
          rotulo="Sua senha atual"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      ) : (
        <>
          <Campo rotulo="Nome" name="nome" defaultValue={nome} autoComplete="name" required />
          <Campo
            rotulo="Crie uma senha (mínimo 12 caracteres)"
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Campo
            rotulo="Repita a senha"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </>
      )}
      <Botao disabled={enviando}>{enviando ? "Aceitando..." : "Aceitar convite"}</Botao>
    </form>
  );
}

export function FormAutenticador() {
  const [inicio, iniciar, iniciando] = useActionState(iniciarAutenticadorAcao, undefined);
  const [confirmacao, confirmar, confirmando] = useAcao(confirmarAutenticadorAcao);

  if (!inicio?.qr) {
    return (
      <form action={iniciar}>
        {inicio?.erro && <Aviso>{inicio.erro}</Aviso>}
        <p className="text-muted mb-4 text-sm">
          Para proteger o acesso, configure um aplicativo autenticador (por exemplo, Google ou Microsoft
          Authenticator). Confirme sua senha para começar.
        </p>
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
        <Botao disabled={iniciando}>{iniciando ? "Preparando..." : "Continuar"}</Botao>
      </form>
    );
  }

  return (
    <form action={confirmar}>
      {confirmacao?.erro && <Aviso>{confirmacao.erro}</Aviso>}
      <ol className="text-text mb-4 list-decimal space-y-2 pl-5 text-sm">
        <li>No aplicativo autenticador, escolha adicionar conta e leia o código abaixo.</li>
        <li>
          Guarde os códigos de recuperação em local seguro (gerenciador de senhas). Cada um vale uma vez.
        </li>
        <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
      </ol>
      <div
        className="bg-background mx-auto mb-4 w-48"
        aria-label="QR code do aplicativo autenticador"
        dangerouslySetInnerHTML={{ __html: inicio.qr }}
      />
      <details className="text-muted mb-4 text-xs">
        <summary>Não consegue ler o QR code?</summary>
        <code className="break-all">{inicio.uri}</code>
      </details>
      <div className="border-border mb-4 rounded-md border p-3">
        <p className="text-text mb-2 text-sm font-medium">Códigos de recuperação</p>
        <ul className="text-text grid grid-cols-2 gap-1 font-mono text-sm">
          {inicio.codigosRecuperacao?.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <Campo
        rotulo="Código de 6 dígitos"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
      />
      <Botao disabled={confirmando}>{confirmando ? "Confirmando..." : "Ativar"}</Botao>
    </form>
  );
}

export function FormNovoTenant() {
  const [estado, acao, enviando] = useAcao(criarTenantAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <Campo rotulo="Nome do tenant" name="nome" required />
      <Campo rotulo="Endereço (subdomínio)" name="slug" placeholder="ex.: bt" pattern="[a-z0-9-]+" required />
      <Botao disabled={enviando}>{enviando ? "Criando..." : "Criar tenant"}</Botao>
    </form>
  );
}

export function FormConvidarAdministrador({ tenantId }: { tenantId: string }) {
  const [estado, acao, enviando] = useActionState(convidarAdministradorAcao, undefined);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="tenantId" value={tenantId} />
      <Campo rotulo="Nome" name="nome" required />
      <Campo rotulo="E-mail" name="email" type="email" required />
      <Botao disabled={enviando}>{enviando ? "Enviando..." : "Enviar convite"}</Botao>
    </form>
  );
}
