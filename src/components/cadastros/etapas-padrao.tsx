"use client";

import { useTranslations } from "next-intl";
import { definirEtapaPadraoAtivaAcao, moverEtapaPadraoAcao, salvarEtapaPadraoAcao } from "@/app/acoes/etapas";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";

/** Etapas padrão do tenant (cadastros auxiliares): renomear, ordenar, desativar e incluir. */

type EtapaPadrao = { id: string; nome: string; ativa: boolean; subetapas: EtapaPadrao[] };

const estiloCampo =
  "border-border bg-background text-text focus:border-primary rounded-md border px-2 py-1 text-sm outline-none";

function FormNome({ id, nome, paiId, novo }: { id?: string; nome?: string; paiId?: string; novo?: string }) {
  const t = useTranslations("etapas.padrao");
  const tc = useTranslations("comum");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarEtapaPadraoAcao);
  return (
    <form action={salvar} className="flex flex-wrap items-center gap-2">
      {id && <input type="hidden" name="id" value={id} />}
      {paiId && <input type="hidden" name="paiId" value={paiId} />}
      <input
        name="nome"
        required
        maxLength={120}
        defaultValue={nome}
        placeholder={novo}
        aria-label={nome ? t("nomeDe", { nome }) : novo}
        className={`${estiloCampo} w-56`}
      />
      <button type="submit" disabled={salvando} className="text-primary text-xs font-medium">
        {id ? tc("salvar") : "+"}
      </button>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
    </form>
  );
}

function Linha({ e, sub }: { e: EtapaPadrao; sub?: boolean }) {
  const t = useTranslations("etapas.padrao");
  return (
    <li className={sub ? "border-border ml-4 border-l pl-3" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
        <span className="flex items-center gap-2">
          <FormNome id={e.id} nome={e.nome} />
          {!e.ativa && <span className="text-muted text-xs">{t("desativada")}</span>}
        </span>
        <span className="flex items-center gap-2">
          <BotaoDeAcao acao={moverEtapaPadraoAcao} campos={{ id: e.id, direcao: "subir" }} rotulo="↑" />
          <BotaoDeAcao acao={moverEtapaPadraoAcao} campos={{ id: e.id, direcao: "descer" }} rotulo="↓" />
          <BotaoDeAcao
            acao={definirEtapaPadraoAtivaAcao}
            campos={{ id: e.id, ativa: e.ativa ? "nao" : "sim" }}
            rotulo={e.ativa ? t("desativar") : t("reativar")}
          />
        </span>
      </div>
      {!sub && (
        <ul>
          {e.subetapas.map((s) => (
            <Linha key={s.id} e={s} sub />
          ))}
          <li className="ml-4 py-1 pl-3">
            <FormNome paiId={e.id} novo={t("novaSubetapa")} />
          </li>
        </ul>
      )}
    </li>
  );
}

export function EtapasPadrao({ etapas, podeEditar }: { etapas: EtapaPadrao[]; podeEditar: boolean }) {
  const t = useTranslations("etapas.padrao");
  if (!podeEditar)
    return (
      <ol className="list-decimal pl-5 text-sm">
        {etapas.map((e) => (
          <li key={e.id} className={e.ativa ? "" : "text-muted line-through"}>
            {e.nome}
            {e.subetapas.length > 0 && (
              <span className="text-muted block text-xs">{e.subetapas.map((s) => s.nome).join(", ")}</span>
            )}
          </li>
        ))}
      </ol>
    );
  return (
    <ul className="divide-border divide-y">
      {etapas.map((e) => (
        <Linha key={e.id} e={e} />
      ))}
      <li className="pt-2">
        <FormNome novo={t("novaEtapa")} />
      </li>
    </ul>
  );
}
