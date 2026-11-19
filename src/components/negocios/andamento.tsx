"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  alterarSituacaoDoNegocioAcao,
  alterarSituacaoNoFunilAcao,
  definirExclusividadeAcao,
  encerrarAcessosExternosAcao,
  prorrogarExclusividadeAcao,
  salvarDiasDeAvisoAcao,
} from "@/app/acoes/negocios";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";

/** Andamento do negócio: funil das compradoras, situação, exclusividade e configurações. */

const estiloCampo =
  "border-border bg-background text-text focus:border-primary rounded-md border px-3 py-2 text-sm outline-none";
const estiloBotao =
  "bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60";

function Mensagem({ estado }: { estado?: { erro?: string; ok?: string } }) {
  if (estado?.erro) return <Aviso>{estado.erro}</Aviso>;
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida", "descartada"] as const;

/** Situação de uma compradora no funil (Coordenador e administradores). */
export function FormFunil({
  dealId,
  id,
  situacao,
  nome,
}: {
  dealId: string;
  id: string;
  situacao: string;
  nome: string;
}) {
  const t = useTranslations("negocios.andamento");
  const tf = useTranslations("negocios.funil");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(alterarSituacaoNoFunilAcao);
  const [nova, setNova] = useState(situacao);
  return (
    <form action={salvar} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="id" value={id} />
      <select
        name="situacao"
        value={nova}
        onChange={(e) => setNova(e.target.value)}
        aria-label={t("situacaoNoFunilDe", { nome })}
        className={`${estiloCampo} py-1 text-xs`}
      >
        {FUNIL.map((s) => (
          <option key={s} value={s}>
            {tf(s)}
          </option>
        ))}
      </select>
      {nova === "escolhida" && situacao !== "escolhida" && (
        <label className="text-text flex items-center gap-1 text-xs">
          <input type="checkbox" name="descartarOutras" value="sim" /> {t("descartarOutras")}
        </label>
      )}
      {nova === "descartada" && situacao !== "descartada" && (
        <span className="text-warning text-xs">{t("avisoDescarte")}</span>
      )}
      {nova !== situacao && (
        <button type="submit" disabled={salvando} className="text-primary text-xs font-medium">
          {t("aplicar")}
        </button>
      )}
      <Mensagem estado={estado} />
    </form>
  );
}

/** Mudar a situação do negócio; reabrir e encerrar acessos externos (administradores). */
export function PainelSituacao({
  dealId,
  situacao,
  podeMudar,
  podeReabrir,
  podeEncerrarExternos,
}: {
  dealId: string;
  situacao: string;
  podeMudar: boolean;
  podeReabrir: boolean;
  podeEncerrarExternos: boolean;
}) {
  const t = useTranslations("negocios.andamento");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(alterarSituacaoDoNegocioAcao);
  const [encerrando, setEncerrando] = useState(false);
  const fechado = situacao === "concluido" || situacao === "encerrado";
  const botao = (para: string, rotulo: string, confirmar?: string) => (
    <form
      action={salvar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="situacao" value={para} />
      <button
        type="submit"
        disabled={salvando}
        className="border-border text-text rounded-md border px-3 py-2 text-sm"
      >
        {rotulo}
      </button>
    </form>
  );
  return (
    <div className="border-border mt-6 border-t pt-4">
      <p className="text-accent mb-2 text-xs font-semibold tracking-widest uppercase">
        {t("situacaoTitulo")}
      </p>
      <Mensagem estado={estado} />
      {fechado && <p className="text-muted mb-2 text-sm">{t("soConsulta")}</p>}
      <div className="flex flex-wrap gap-2">
        {podeMudar && !fechado && situacao === "andamento" && botao("suspenso", t("suspender"))}
        {podeMudar && !fechado && situacao === "suspenso" && botao("andamento", t("retomar"))}
        {podeMudar && !fechado && botao("concluido", t("concluir"), t("confirmarConcluir"))}
        {podeMudar && !fechado && !encerrando && (
          <button
            type="button"
            onClick={() => setEncerrando(true)}
            className="border-border text-text rounded-md border px-3 py-2 text-sm"
          >
            {t("encerrar")}
          </button>
        )}
        {podeReabrir && botao("andamento", t("reabrir"), t("confirmarReabrir"))}
      </div>
      {encerrando && (
        <form action={salvar} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="situacao" value="encerrado" />
          <select name="motivo" required defaultValue="" aria-label={t("motivo")} className={estiloCampo}>
            <option value="" disabled>
              {t("motivo")}
            </option>
            {(
              ["desistencia_vendedora", "desistencia_compradora", "preco", "diligencia", "outro"] as const
            ).map((m) => (
              <option key={m} value={m}>
                {t(`motivos.${m}`)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={salvando} className={estiloBotao}>
            {t("confirmarEncerramento")}
          </button>
          <button type="button" onClick={() => setEncerrando(false)} className="text-muted text-sm">
            {t("cancelar")}
          </button>
        </form>
      )}
      {podeEncerrarExternos && (
        <div className="mt-3">
          <BotaoDeAcao
            acao={encerrarAcessosExternosAcao}
            campos={{ dealId }}
            rotulo={t("encerrarExternos")}
            confirmar={t("confirmarEncerrarExternos")}
            perigo
          />
        </div>
      )}
    </div>
  );
}

/** Exclusividade: definir (com a compradora escolhida) e prorrogar. */
export function PainelExclusividade({
  dealId,
  exclusividade,
  podeEditar,
  hoje,
}: {
  dealId: string;
  exclusividade: {
    compradora: string | null;
    inicio: string;
    fim: string;
    prorrogacoes: { fimAnterior: string; novoFim: string; motivo: string | null }[];
  } | null;
  podeEditar: boolean;
  hoje: string;
}) {
  const t = useTranslations("negocios.andamento");
  const [estadoDef, definir, definindo] = useAcaoComAtualizacao(definirExclusividadeAcao);
  const [estadoPro, prorrogar, prorrogando] = useAcaoComAtualizacao(prorrogarExclusividadeAcao);
  const br = (d: string) => d.split("-").reverse().join("/");
  if (!exclusividade)
    return podeEditar ? (
      <form action={definir} className="max-w-md">
        <p className="text-muted mb-3 text-sm">{t("exclusividadeExplicacao")}</p>
        <Mensagem estado={estadoDef} />
        <input type="hidden" name="dealId" value={dealId} />
        <label className="mb-3 block">
          <span className="text-text mb-1 block text-sm font-medium">{t("inicio")}</span>
          <input type="date" name="inicio" required defaultValue={hoje} className={`${estiloCampo} w-full`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("dias")}</span>
            <input name="dias" inputMode="numeric" className={`${estiloCampo} w-full`} />
          </label>
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("ouFim")}</span>
            <input type="date" name="fim" className={`${estiloCampo} w-full`} />
          </label>
        </div>
        <button type="submit" disabled={definindo} className={estiloBotao}>
          {t("definir")}
        </button>
      </form>
    ) : (
      <p className="text-muted text-sm">{t("semExclusividade")}</p>
    );
  return (
    <div className="max-w-md text-sm">
      <p>
        <span className="font-medium">{exclusividade.compradora}</span>
        <span className="text-muted block">
          {t("periodo", { inicio: br(exclusividade.inicio), fim: br(exclusividade.fim) })}
        </span>
      </p>
      {exclusividade.prorrogacoes.length > 0 && (
        <ul className="text-muted mt-2 text-xs">
          {exclusividade.prorrogacoes.map((p, i) => (
            <li key={i}>
              {t("prorrogada", { de: br(p.fimAnterior), para: br(p.novoFim) })}
              {p.motivo && ` · ${p.motivo}`}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && (
        <form action={prorrogar} className="border-border mt-4 border-t pt-3">
          <p className="text-text mb-2 font-medium">{t("prorrogar")}</p>
          <Mensagem estado={estadoPro} />
          <input type="hidden" name="dealId" value={dealId} />
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("novoFim")}</span>
            <input type="date" name="novoFim" required className={`${estiloCampo} w-full`} />
          </label>
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("motivoOpcional")}</span>
            <input name="motivo" maxLength={500} className={`${estiloCampo} w-full`} />
          </label>
          <button type="submit" disabled={prorrogando} className={estiloBotao}>
            {t("prorrogar")}
          </button>
        </form>
      )}
    </div>
  );
}

/** Configurações gerais do tenant: antecedência dos avisos da exclusividade. */
export function FormConfiguracoes({ dias }: { dias: number[] }) {
  const t = useTranslations("negocios.configuracoes");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarDiasDeAvisoAcao);
  return (
    <form action={salvar} className="max-w-md">
      <Mensagem estado={estado} />
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("diasAviso")}</span>
        <input name="dias" defaultValue={dias.join(", ")} required className={`${estiloCampo} w-full`} />
        <span className="text-muted mt-1 block text-xs">{t("diasAvisoAjuda")}</span>
      </label>
      <button type="submit" disabled={salvando} className={estiloBotao}>
        {t("salvar")}
      </button>
    </form>
  );
}
