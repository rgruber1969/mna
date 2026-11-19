"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  excluirTarefaAcao,
  marcarItemAcao,
  mudarSituacaoDaTarefaAcao,
  salvarTarefaAcao,
} from "@/app/acoes/tarefas";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, estiloTabela } from "@/components/ui/basicos";

/** Aba Tarefas do negócio (item 27): lista, filtros, criação e detalhes com checklist. */

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  prazo: string | null;
  situacao: "a_fazer" | "andamento" | "aguardando" | "concluida" | "cancelada";
  etapaId: string | null;
  etapa: string | null;
  responsaveis: string[];
  responsavelIds: { usuarios: string[]; perfis: string[] };
  semResponsavel: boolean;
  concluidaPor: string | null;
  automatica: boolean;
  checklist: { id: string; texto: string; feito: boolean }[];
  documentos: { id: string; titulo: string }[];
  souResponsavel: boolean;
  podeEditar: boolean;
  podeMudarSituacao: boolean;
  podeExcluir: boolean;
};
type Quadro = {
  tarefas: Tarefa[];
  destinos: { id: string | null; nome: string }[];
  opcoes: {
    usuarios: { id: string; nome: string; lado: string | null }[];
    perfis: { id: string; nome: string }[];
  };
  documentos: { id: string; titulo: string }[];
  fechado: boolean;
};

const SITUACOES = ["a_fazer", "andamento", "aguardando", "concluida", "cancelada"] as const;
const PRIORIDADES = ["baixa", "normal", "alta", "urgente"] as const;
const campo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none";
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

function FormTarefa({
  dealId,
  quadro,
  tarefa,
  etapaInicial,
  fechar,
}: {
  dealId: string;
  quadro: Quadro;
  tarefa?: Tarefa;
  etapaInicial: string;
  fechar: () => void;
}) {
  const t = useTranslations("tarefas");
  const tc = useTranslations("comum");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(async (anterior, dados) => {
    const r = await salvarTarefaAcao(anterior, dados);
    if (r?.ok) fechar();
    return r;
  });
  const marcado = (lista: string[] | undefined, id: string) => lista?.includes(id) ?? false;
  return (
    <form action={salvar} className="border-border bg-background mb-4 rounded-md border p-3">
      <p className="text-text mb-2 text-sm font-medium">{tarefa ? t("editarTarefa") : t("novaTarefa")}</p>
      {estado?.erro && <Aviso>{estado.erro}</Aviso>}
      <input type="hidden" name="dealId" value={dealId} />
      {tarefa && <input type="hidden" name="id" value={tarefa.id} />}
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block sm:col-span-4">
          <span className="text-muted mb-0.5 block text-xs">{t("titulo")}</span>
          <input name="titulo" required maxLength={200} defaultValue={tarefa?.titulo} className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-muted mb-0.5 block text-xs">{t("etapa")}</span>
          <select
            name="etapaId"
            defaultValue={tarefa ? (tarefa.etapaId ?? "") : etapaInicial}
            className={campo}
          >
            {quadro.destinos.map((d) => (
              <option key={d.id ?? "geral"} value={d.id ?? ""}>
                {d.id ? d.nome : t("geral")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted mb-0.5 block text-xs">{t("prioridade")}</span>
          <select name="prioridade" defaultValue={tarefa?.prioridade ?? "normal"} className={campo}>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {t(`prioridades.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted mb-0.5 block text-xs">{t("prazo")}</span>
          <input type="date" name="prazo" defaultValue={tarefa?.prazo ?? ""} className={campo} />
        </label>
        <label className="block sm:col-span-4">
          <span className="text-muted mb-0.5 block text-xs">{t("descricao")}</span>
          <textarea
            name="descricao"
            rows={2}
            maxLength={4000}
            defaultValue={tarefa?.descricao ?? ""}
            className={campo}
          />
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-text text-sm font-medium">{t("responsaveis")}</legend>
        <p className="text-muted mb-1 text-xs">{t("responsaveisAjuda")}</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div>
            <p className="text-muted text-xs font-semibold">{t("pessoas")}</p>
            {quadro.opcoes.usuarios.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="usuarios"
                  value={u.id}
                  defaultChecked={marcado(tarefa?.responsavelIds.usuarios, u.id)}
                />
                {u.nome}
              </label>
            ))}
          </div>
          <div>
            <p className="text-muted text-xs font-semibold">{t("perfis")}</p>
            {quadro.opcoes.perfis.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="perfis"
                  value={p.id}
                  defaultChecked={marcado(tarefa?.responsavelIds.perfis, p.id)}
                />
                {p.nome}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      {!tarefa && (
        <label className="mt-3 block">
          <span className="text-text block text-sm font-medium">{t("checklist")}</span>
          <span className="text-muted mb-0.5 block text-xs">{t("checklistAjuda")}</span>
          <textarea name="checklist" rows={3} className={campo} />
        </label>
      )}
      {quadro.documentos.length > 0 && (
        <fieldset className="mt-3">
          <legend className="text-text text-sm font-medium">{t("documentosLigados")}</legend>
          <div className="border-border max-h-40 overflow-y-auto rounded-md border p-2 text-sm">
            {quadro.documentos.map((d) => (
              <label key={d.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="documentos"
                  value={d.id}
                  defaultChecked={tarefa?.documentos.some((x) => x.id === d.id)}
                />
                {d.titulo}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-3 flex gap-3">
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

export function TarefasDoNegocio({
  dealId,
  quadro,
  etapaFiltro,
}: {
  dealId: string;
  quadro: Quadro;
  etapaFiltro: string;
}) {
  const t = useTranslations("tarefas");
  const router = useRouter();
  const [mudando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"abertas" | "minhas" | "todas">("abertas");
  const [etapa, setEtapa] = useState(etapaFiltro);
  const [aberta, setAberta] = useState<string | null>(null);
  const [form, setForm] = useState<{ tarefa?: Tarefa } | null>(null);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const lista = quadro.tarefas.filter(
    (x) =>
      (filtro === "todas" ||
        (filtro === "minhas" ? x.souResponsavel : !["concluida", "cancelada"].includes(x.situacao))) &&
      (etapa === "" || (etapa === "geral" ? x.etapaId === null : x.etapaId === etapa)),
  );
  const etapas = [
    ...new Map(quadro.tarefas.filter((x) => x.etapaId).map((x) => [x.etapaId!, x.etapa!])).entries(),
  ];
  function executar(fn: () => Promise<{ erro?: string }>) {
    iniciar(async () => {
      const r = await fn();
      setErro(r.erro ?? null);
      if (!r.erro) router.refresh();
    });
  }
  return (
    <div className={mudando ? "opacity-70" : ""}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          {(["abertas", "minhas", "todas"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filtro === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted"}`}
            >
              {t(`filtros.${f}`)}
            </button>
          ))}
          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
            aria-label={t("etapa")}
            className={`${campo} w-auto py-1 text-xs`}
          >
            <option value="">{t("todasEtapas")}</option>
            <option value="geral">{t("geral")}</option>
            {etapas.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </span>
        {!quadro.fechado && quadro.destinos.length > 0 && !form && (
          <button
            type="button"
            onClick={() => setForm({})}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t("novaTarefa")}
          </button>
        )}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {form && (
        <FormTarefa
          dealId={dealId}
          quadro={quadro}
          tarefa={form.tarefa}
          etapaInicial={etapa && etapa !== "geral" ? etapa : ""}
          fechar={() => setForm(null)}
        />
      )}
      {lista.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhuma")}</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className={estiloTabela.tabela}>
            <thead className={estiloTabela.cabecalho}>
              <tr>
                <th className={estiloTabela.th}>{t("tarefa")}</th>
                <th className={estiloTabela.th}>{t("responsaveis")}</th>
                <th className={estiloTabela.th}>{t("prazo")}</th>
                <th className={estiloTabela.th}>{t("situacao")}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => {
                const atrasada =
                  x.prazo && x.prazo < hoje && !["concluida", "cancelada"].includes(x.situacao);
                return (
                  <Fragment key={x.id}>
                    <tr className={estiloTabela.linha}>
                      <td className={estiloTabela.td}>
                        <button
                          type="button"
                          aria-expanded={aberta === x.id}
                          onClick={() => setAberta((v) => (v === x.id ? null : x.id))}
                          className="text-text text-left font-medium"
                        >
                          {aberta === x.id ? "▾" : "▸"} {x.titulo}
                        </button>
                        <span className="text-muted block text-xs">
                          {[
                            x.etapa ?? t("geral"),
                            x.prioridade !== "normal" && t(`prioridades.${x.prioridade}`),
                            x.checklist.length > 0 &&
                              t("checklistResumo", {
                                feitos: x.checklist.filter((i) => i.feito).length,
                                total: x.checklist.length,
                              }),
                            x.automatica && t("automatica"),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </td>
                      <td className={`${estiloTabela.td} text-xs`}>
                        {x.semResponsavel ? (
                          <span className="text-warning">{t("semResponsavel")}</span>
                        ) : (
                          x.responsaveis.join(", ")
                        )}
                      </td>
                      <td
                        className={`${estiloTabela.td} text-xs whitespace-nowrap ${atrasada ? "text-danger font-medium" : "text-muted"}`}
                      >
                        {br(x.prazo) ?? "—"}
                        {atrasada && <span className="block">{t("atrasada")}</span>}
                      </td>
                      <td className={`${estiloTabela.td} text-xs`}>
                        {x.podeMudarSituacao ? (
                          <select
                            value={x.situacao}
                            onChange={(e) => executar(() => mudarSituacaoDaTarefaAcao(x.id, e.target.value))}
                            aria-label={t("situacaoDe", { titulo: x.titulo })}
                            className={`${campo} w-auto py-1 text-xs`}
                          >
                            {SITUACOES.map((s) => (
                              <option key={s} value={s}>
                                {t(`situacoes.${s}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          t(`situacoes.${x.situacao}`)
                        )}
                        {x.situacao === "concluida" && x.concluidaPor && (
                          <span className="text-muted block">
                            {t("concluidaPor", { nome: x.concluidaPor })}
                          </span>
                        )}
                      </td>
                    </tr>
                    {aberta === x.id && (
                      <tr>
                        <td colSpan={4} className="bg-background px-4 py-3 text-sm">
                          {x.descricao && <p className="text-text mb-2 whitespace-pre-line">{x.descricao}</p>}
                          {x.checklist.length > 0 && (
                            <ul className="mb-2">
                              {x.checklist.map((i) => (
                                <li key={i.id}>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={i.feito}
                                      disabled={!x.podeMudarSituacao}
                                      onChange={(e) => executar(() => marcarItemAcao(i.id, e.target.checked))}
                                    />
                                    <span className={i.feito ? "text-muted line-through" : "text-text"}>
                                      {i.texto}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                          {x.documentos.length > 0 && (
                            <p className="text-muted mb-2 text-xs">
                              {t("documentosLigados")}:{" "}
                              {x.documentos.map((d, k) => (
                                <Fragment key={d.id}>
                                  {k > 0 && ", "}
                                  <a href="?aba=documentos" className="text-primary">
                                    {d.titulo}
                                  </a>
                                </Fragment>
                              ))}
                            </p>
                          )}
                          <span className="flex flex-wrap gap-3">
                            {x.podeEditar && !form && (
                              <button
                                type="button"
                                onClick={() => setForm({ tarefa: x })}
                                className="text-primary text-xs"
                              >
                                {t("editar")}
                              </button>
                            )}
                            {x.podeExcluir && (
                              <BotaoDeAcao
                                acao={excluirTarefaAcao}
                                campos={{ id: x.id }}
                                rotulo={t("excluir")}
                                confirmar={t("confirmarExcluir", { titulo: x.titulo })}
                                perigo
                              />
                            )}
                          </span>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
