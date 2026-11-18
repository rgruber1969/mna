"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import type { Estado } from "@/app/acoes/acesso";
import {
  convidarParaEquipeAcao,
  convidarUsuarioAcao,
  redefinirPelaPlataformaAcao,
  renomearTenantAcao,
} from "@/app/acoes/usuarios";
import { Aviso, Botao, Campo, OpcoesDePerfil } from "@/components/ui/basicos";

type Acao = (estado: Estado, dados: FormData) => Promise<Estado>;

/**
 * Executa a ação; com destino, navega no navegador (passa pelo proxy); com
 * sucesso, recarrega os dados da página.
 */
export function useAcaoComAtualizacao(acao: Acao) {
  const router = useRouter();
  return useActionState(async (anterior: Estado, dados: FormData) => {
    const r = await acao(anterior, dados);
    if (r?.destino) window.location.assign(r.destino);
    else if (r?.ok) router.refresh();
    return r;
  }, undefined);
}

/**
 * Botão de uma ação sobre um item (ex.: reenviar convite, remover passkey).
 * Com `confirmar`, pede confirmação antes; `perigo` destaca ações destrutivas.
 */
export function BotaoDeAcao({
  acao,
  campos,
  rotulo,
  confirmar,
  perigo = false,
}: {
  acao: Acao;
  campos: Record<string, string>;
  rotulo: string;
  confirmar?: string;
  perigo?: boolean;
}) {
  const [estado, executar, enviando] = useAcaoComAtualizacao(acao);
  return (
    <form
      action={executar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
      className="inline-block"
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        disabled={enviando}
        className={`${perigo ? "border-danger text-danger" : "border-primary text-primary"} rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-60`}
      >
        {enviando ? "Aguarde..." : rotulo}
      </button>
      {estado?.erro && (
        <span role="alert" className="text-danger ml-2 text-xs">
          {estado.erro}
        </span>
      )}
      {estado?.ok && (
        <span role="status" className="text-success ml-2 text-xs">
          {estado.ok}
        </span>
      )}
    </form>
  );
}

export function FormConvidarUsuario({
  perfis,
  inicial,
}: {
  perfis: { id: string; nome: string; descricao: string }[];
  /** Convite a partir do cadastro de uma pessoa: nome e e-mail já preenchidos. */
  inicial?: { nome?: string; email?: string };
}) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(convidarUsuarioAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <Campo rotulo="Nome" name="nome" required defaultValue={inicial?.nome} />
      <Campo rotulo="E-mail do convidado" name="email" type="email" required defaultValue={inicial?.email} />
      {perfis.length > 0 && <OpcoesDePerfil perfis={perfis} />}
      <label className="text-text mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="exige2fa" defaultChecked /> Exigir verificação em duas etapas
        (recomendado)
      </label>
      <label className="text-text mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" name="administrador" /> Administrador do tenant (acesso total; sempre com 2FA)
      </label>
      <Botao disabled={enviando}>{enviando ? "Enviando..." : "Enviar convite"}</Botao>
    </form>
  );
}

export function FormRedefinirPelaPlataforma({ motivos }: { motivos: Record<string, string> }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(redefinirPelaPlataformaAcao);
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!window.confirm("Apagar todos os fatores desta conta e encerrar as sessões?")) e.preventDefault();
      }}
    >
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <Campo rotulo="E-mail da conta" name="email" type="email" required />
      <label className="mb-4 block">
        <span className="text-text mb-1 block text-sm font-medium">Motivo</span>
        <select
          name="motivo"
          required
          defaultValue=""
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Escolha
          </option>
          {Object.entries(motivos).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="text-text mb-4 flex items-start gap-2 text-sm">
        <input type="checkbox" name="identidade" className="mt-1" />
        Confirmei a identidade da pessoa (por exemplo, com o administrador do tenant dela).
      </label>
      <Botao disabled={enviando}>{enviando ? "Redefinindo..." : "Redefinir 2FA"}</Botao>
    </form>
  );
}

export function FormRenomearTenant({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, enviando] = useAcaoComAtualizacao(renomearTenantAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <input type="hidden" name="id" value={id} />
      <Campo rotulo="Nome do tenant" name="nome" defaultValue={nome} required />
      <Botao disabled={enviando}>{enviando ? "Salvando..." : "Salvar nome"}</Botao>
    </form>
  );
}

export function FormConvidarParaEquipe() {
  const [estado, acao, enviando] = useAcaoComAtualizacao(convidarParaEquipeAcao);
  return (
    <form action={acao}>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
      <Campo rotulo="Nome" name="nome" required />
      <Campo rotulo="E-mail do convidado" name="email" type="email" required />
      <Botao disabled={enviando}>{enviando ? "Enviando..." : "Enviar convite"}</Botao>
    </form>
  );
}
