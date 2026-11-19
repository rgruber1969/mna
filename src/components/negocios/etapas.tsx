"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  editarEtapaAcao,
  incluirEtapaAcao,
  moverEtapaAcao,
  mudarSituacaoDaEtapaAcao,
  removerEtapaAcao,
  type EstadoEtapa,
} from "@/app/acoes/etapas";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";

/** Aba Etapas do negócio: lista editável e linha do tempo (itens 9 e 10). */

type Etapa = {
  id: string;
  nome: string;
  situacao: "nao_iniciada" | "andamento" | "concluida" | "pulada";
  inicioPrevisto: string | null;
  fimPrevisto: string | null;
  inicioReal: string | null;
  fimReal: string | null;
  dependeDeId: string | null;
  dependeDe: string | null;
  escala: number;
  observacoes: string | null;
  podeEditar: boolean;
  subetapas: Etapa[];
};

const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none";
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const corDaSituacao = {
  nao_iniciada: "border-border text-muted",
  andamento: "border-primary text-primary",
  concluida: "border-success text-success",
  pulada: "border-border text-muted line-through",
} as const;

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted mb-0.5 block text-xs">{texto}</span>
      {children}
    </label>
  );
}

function FormEtapa({
  dealId,
  etapa,
  irmas,
  fechar,
}: {
  dealId: string;
  etapa: Etapa;
  irmas: Etapa[];
  fechar: () => void;
}) {
  const t = useTranslations("etapas");
  const tc = useTranslations("comum");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(async (anterior, dados) => {
    const r = await editarEtapaAcao(anterior, dados);
    if (r?.ok) fechar();
    return r;
  });
  const data = (nome: keyof Etapa, rotulo: string) => (
    <Rotulo texto={rotulo}>
      <input
        type="date"
        name={nome}
        defaultValue={(etapa[nome] as string | null) ?? ""}
        className={estiloCampo}
      />
    </Rotulo>
  );
  return (
    <form action={salvar} className="border-border bg-background mt-2 rounded-md border p-3">
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="id" value={etapa.id} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Rotulo texto={t("nome")}>
            <input name="nome" required maxLength={120} defaultValue={etapa.nome} className={estiloCampo} />
          </Rotulo>
        </div>
        <div className="sm:col-span-2">
          <Rotulo texto={t("dependeDe")}>
            <select name="dependeDeId" defaultValue={etapa.dependeDeId ?? ""} className={estiloCampo}>
              <option value="">{t("semDependencia")}</option>
              {irmas
                .filter((e) => e.id !== etapa.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
            </select>
          </Rotulo>
        </div>
        {data("inicioPrevisto", t("inicioPrevisto"))}
        {data("fimPrevisto", t("fimPrevisto"))}
        {data("inicioReal", t("inicioReal"))}
        {data("fimReal", t("fimReal"))}
        <Rotulo texto={t("escala")}>
          <input
            type="number"
            name="escala"
            min={5}
            max={100}
            defaultValue={etapa.escala}
            className={estiloCampo}
          />
        </Rotulo>
      </div>
      <div className="mt-2">
        <Rotulo texto={t("observacoes")}>
          <textarea
            name="observacoes"
            rows={2}
            maxLength={2000}
            defaultValue={etapa.observacoes ?? ""}
            className={estiloCampo}
          />
        </Rotulo>
      </div>
      <div className="mt-2 flex gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
        >
          {tc("salvar")}
        </button>
        <button type="button" onClick={fechar} className="text-muted text-sm">
          {tc("cancelar")}
        </button>
      </div>
    </form>
  );
}

function LinhaDaEtapa({
  dealId,
  etapa,
  irmas,
  podeExcluir,
  podeIncluir,
  sub = false,
}: {
  dealId: string;
  etapa: Etapa;
  irmas: Etapa[];
  podeExcluir: boolean;
  podeIncluir: boolean;
  sub?: boolean;
}) {
  const t = useTranslations("etapas");
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [estado, setEstado] = useState<EstadoEtapa>();
  const [mudando, iniciar] = useTransition();
  function mudar(situacao: string, confirmado = false) {
    const f = new FormData();
    f.set("dealId", dealId);
    f.set("id", etapa.id);
    f.set("situacao", situacao);
    if (confirmado) f.set("confirmado", "sim");
    iniciar(async () => {
      const r = await mudarSituacaoDaEtapaAcao(undefined, f);
      setEstado(r);
      if (r?.ok) router.refresh();
    });
  }
  const datas = [
    etapa.inicioReal || etapa.fimReal
      ? t("real", { de: br(etapa.inicioReal) ?? "…", ate: br(etapa.fimReal) ?? "…" })
      : null,
    etapa.inicioPrevisto || etapa.fimPrevisto
      ? t("previsto", { de: br(etapa.inicioPrevisto) ?? "…", ate: br(etapa.fimPrevisto) ?? "…" })
      : null,
    etapa.dependeDe && t("dependeDeNome", { nome: etapa.dependeDe }),
  ].filter(Boolean);
  const botao = (situacao: string, rotulo: string) => (
    <button
      type="button"
      disabled={mudando}
      onClick={() => mudar(situacao)}
      className="text-primary text-xs font-medium"
    >
      {rotulo}
    </button>
  );
  return (
    <li className={sub ? "border-border ml-4 border-l pl-3" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-2 py-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${corDaSituacao[etapa.situacao]}`}
            >
              {t(`situacoes.${etapa.situacao}`)}
            </span>
            <span className={`text-text ${sub ? "text-sm" : "font-medium"}`}>{etapa.nome}</span>
          </span>
          {datas.length > 0 && <span className="text-muted mt-0.5 block text-xs">{datas.join(" · ")}</span>}
          {etapa.observacoes && (
            <span className="text-muted block text-xs whitespace-pre-line">{etapa.observacoes}</span>
          )}
        </div>
        {etapa.podeEditar && (
          <span className="flex flex-wrap items-center gap-3">
            {etapa.situacao === "nao_iniciada" && botao("andamento", t("iniciar"))}
            {etapa.situacao === "nao_iniciada" && botao("pulada", t("pular"))}
            {etapa.situacao === "andamento" && botao("concluida", t("concluir"))}
            {(etapa.situacao === "concluida" || etapa.situacao === "pulada") &&
              botao("andamento", t("reabrir"))}
            <button type="button" onClick={() => setEditando((x) => !x)} className="text-primary text-xs">
              {t("editar")}
            </button>
            <BotaoDeAcao
              acao={moverEtapaAcao}
              campos={{ dealId, id: etapa.id, direcao: "subir" }}
              rotulo="↑"
            />
            <BotaoDeAcao
              acao={moverEtapaAcao}
              campos={{ dealId, id: etapa.id, direcao: "descer" }}
              rotulo="↓"
            />
            {podeExcluir && etapa.situacao === "nao_iniciada" && (
              <BotaoDeAcao
                acao={removerEtapaAcao}
                campos={{ dealId, id: etapa.id }}
                rotulo={t("remover")}
                confirmar={t("confirmarRemover", { nome: etapa.nome })}
                perigo
              />
            )}
          </span>
        )}
      </div>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      {estado?.aviso === "dependencia" && (
        <div
          role="alert"
          className="border-warning bg-warning-surface text-text mb-2 rounded-md border p-2 text-sm"
        >
          {t("avisoDependencia", { nome: estado.etapaAnterior ?? "" })}
          <span className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => mudar("andamento", true)}
              className="text-primary text-xs font-medium"
            >
              {t("iniciarMesmoAssim")}
            </button>
            <button type="button" onClick={() => setEstado(undefined)} className="text-muted text-xs">
              {t("cancelar")}
            </button>
          </span>
        </div>
      )}
      {editando && (
        <FormEtapa dealId={dealId} etapa={etapa} irmas={irmas} fechar={() => setEditando(false)} />
      )}
      {(etapa.subetapas.length > 0 || (!sub && podeIncluir)) && (
        <ul className="mb-2">
          {etapa.subetapas.map((s) => (
            <LinhaDaEtapa
              key={s.id}
              dealId={dealId}
              etapa={s}
              irmas={etapa.subetapas}
              podeExcluir={podeExcluir}
              podeIncluir={false}
              sub
            />
          ))}
          {!sub && podeIncluir && <NovaEtapa dealId={dealId} paiId={etapa.id} />}
        </ul>
      )}
    </li>
  );
}

function NovaEtapa({ dealId, paiId }: { dealId: string; paiId?: string }) {
  const t = useTranslations("etapas");
  const [aberto, setAberto] = useState(false);
  const [estado, incluir, incluindo] = useAcaoComAtualizacao(async (anterior, dados) => {
    const r = await incluirEtapaAcao(anterior, dados);
    if (r?.ok) setAberto(false);
    return r;
  });
  if (!aberto)
    return (
      <li className={paiId ? "ml-4 pl-3" : "pt-2"}>
        <button type="button" onClick={() => setAberto(true)} className="text-primary text-xs">
          {paiId ? t("novaSubetapa") : t("novaEtapa")}
        </button>
      </li>
    );
  return (
    <li className={paiId ? "ml-4 pl-3" : "pt-2"}>
      <form action={incluir} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="dealId" value={dealId} />
        {paiId && <input type="hidden" name="paiId" value={paiId} />}
        <input
          name="nome"
          required
          maxLength={120}
          autoFocus
          aria-label={paiId ? t("nomeDaSubetapa") : t("nomeDaEtapa")}
          className={`${estiloCampo} max-w-xs`}
        />
        <button type="submit" disabled={incluindo} className="text-primary text-xs font-medium">
          {t("incluir")}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-muted text-xs">
          {t("cancelar")}
        </button>
      </form>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
    </li>
  );
}

/**
 * Linha do tempo (só leitura): barras pelas datas reais ou previstas. A
 * escala de cada etapa (ex.: pós-closing a 20%) encolhe o período dela, para
 * as etapas curtas não sumirem ao lado de uma que dura anos.
 */
function LinhaDoTempo({ etapas, hoje }: { etapas: Etapa[]; hoje: string }) {
  const t = useTranslations("etapas");
  const linhas = etapas.flatMap((e) => [{ e, sub: false }, ...e.subetapas.map((s) => ({ e: s, sub: true }))]);
  const inicio = (e: Etapa) => e.inicioReal ?? e.inicioPrevisto;
  const fim = (e: Etapa) =>
    e.fimReal ?? e.fimPrevisto ?? (e.situacao === "andamento" ? hoje : null) ?? inicio(e);
  const dia = (d: string) => Date.parse(`${d}T12:00:00Z`);
  const datas = linhas.flatMap(({ e }) => [inicio(e), fim(e)]).filter((d): d is string => Boolean(d));
  if (datas.length === 0) return <p className="text-muted text-sm">{t("semDatas")}</p>;
  const min = Math.min(...datas.map(dia));
  const max = Math.max(...datas.map(dia), min + 86_400_000);
  // Trechos entre as datas; cada um pesa a menor escala das etapas que o cobrem.
  const comEscala = etapas.filter((e) => e.escala < 100 && inicio(e) && fim(e));
  const marcos = [...new Set([min, max, ...comEscala.flatMap((e) => [dia(inicio(e)!), dia(fim(e)!)])])]
    .filter((x) => x >= min && x <= max)
    .sort((a, b) => a - b);
  const trechos = marcos.slice(1).map((q, k) => {
    const p = marcos[k];
    const meio = (p + q) / 2;
    const peso = Math.min(
      1,
      ...comEscala.filter((e) => dia(inicio(e)!) <= meio && meio <= dia(fim(e)!)).map((e) => e.escala / 100),
    );
    return { p, q, peso };
  });
  const visual = (x: number) =>
    trechos.reduce((soma, { p, q, peso }) => soma + Math.max(0, Math.min(x, q) - p) * peso, 0);
  const total = visual(max) || 1;
  const pos = (d: string) => (visual(dia(d)) / total) * 100;
  const corBarra = {
    nao_iniciada: "bg-border",
    andamento: "bg-primary",
    concluida: "bg-success",
    pulada: "bg-border opacity-50",
  };
  const hojeEmPos = dia(hoje) >= min && dia(hoje) <= max ? pos(hoje) : null;
  const brDe = (x: number) => br(new Date(x).toISOString().slice(0, 10));
  return (
    <div>
      <div className="text-muted mb-1 flex justify-between pl-[38%] text-xs">
        <span>{brDe(min)}</span>
        <span>{brDe(max)}</span>
      </div>
      <ul className="space-y-1.5">
        {linhas.map(({ e, sub }) => {
          const i = inicio(e);
          const f = fim(e);
          return (
            <li key={e.id} className="flex items-center gap-2 text-xs">
              <span
                className={`text-text w-[38%] shrink-0 truncate ${sub ? "text-muted pl-4" : "font-medium"}`}
                title={e.nome}
              >
                {e.nome}
                {!sub && e.escala < 100 && (
                  <span className="text-muted font-normal"> · {t("escalaCurta", { n: e.escala })}</span>
                )}
              </span>
              <span className="bg-background relative h-4 flex-1 rounded">
                {hojeEmPos !== null && (
                  <span
                    className="bg-accent absolute top-0 bottom-0 w-px"
                    style={{ left: `${hojeEmPos}%` }}
                  />
                )}
                {i && f ? (
                  <span
                    className={`absolute top-0.5 bottom-0.5 rounded ${corBarra[e.situacao]}`}
                    style={{ left: `${pos(i)}%`, width: `${Math.max(pos(f) - pos(i), 0.8)}%` }}
                    title={`${t(`situacoes.${e.situacao}`)}: ${br(i)} – ${br(f)}`}
                  />
                ) : (
                  <span className="text-muted absolute inset-0 pl-1 leading-4">{t("semDatasCurto")}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted mt-3 text-xs">
        {comEscala.length > 0 && `${t("avisoEscala")} `}
        {t("edicaoGraficaFutura")}
      </p>
    </div>
  );
}

export function EtapasDoNegocio({
  dealId,
  etapas,
  podeIncluir,
  podeExcluir,
  hoje,
}: {
  dealId: string;
  etapas: Etapa[];
  podeIncluir: boolean;
  podeExcluir: boolean;
  hoje: string;
}) {
  const t = useTranslations("etapas");
  const [vista, setVista] = useState<"lista" | "tempo">("lista");
  return (
    <div>
      <div className="mb-3 flex gap-2" role="group" aria-label={t("vista")}>
        {(["lista", "tempo"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => setVista(v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${vista === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted"}`}
          >
            {t(v === "lista" ? "vistaLista" : "vistaTempo")}
          </button>
        ))}
      </div>
      {vista === "tempo" ? (
        <LinhaDoTempo etapas={etapas} hoje={hoje} />
      ) : (
        <ul className="divide-border divide-y">
          {etapas.map((e) => (
            <LinhaDaEtapa
              key={e.id}
              dealId={dealId}
              etapa={e}
              irmas={etapas}
              podeExcluir={podeExcluir}
              podeIncluir={podeIncluir}
            />
          ))}
          {podeIncluir && <NovaEtapa dealId={dealId} />}
        </ul>
      )}
    </div>
  );
}
