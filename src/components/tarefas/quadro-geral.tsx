"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  excluirTarefaGeralAcao,
  moverTarefaGeralAcao,
  salvarTarefaGeralAcao,
} from "@/app/acoes/tarefas-gerais";
import { Janela } from "@/components/ui/janela";
import { Aviso } from "@/components/ui/basicos";
import type { ColunaGeral, TarefaGeralNaTela } from "@/server/services/tarefas-gerais";

const COLUNAS: ColunaGeral[] = ["a_fazer", "andamento", "aguardando", "concluida"];
const campo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-3 py-2 text-sm outline-none";
const COR_DA_PRIORIDADE: Record<string, string> = {
  urgente: "bg-danger-soft text-danger",
  alta: "bg-warning-soft text-warning",
  normal: "bg-surface text-muted",
  baixa: "bg-surface text-muted",
};

type Edicao = {
  id: string | null;
  titulo: string;
  descricao: string;
  prioridade: string;
  prazo: string;
  responsavelId: string;
};

/**
 * Kanban de tarefas gerais (fora de negócio): quatro colunas fixas; arrastar
 * o cartão (ou usar "Mover para") muda a situação; clicar abre a edição.
 */
export function QuadroDeTarefasGerais({
  tarefas,
  pessoas,
  eu,
}: {
  tarefas: TarefaGeralNaTela[];
  pessoas: { id: string; nome: string }[];
  eu: string;
}) {
  const t = useTranslations("tarefas");
  const tg = useTranslations("tarefas.gerais");
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [sobre, setSobre] = useState<ColunaGeral | null>(null);
  const br = (d: string) => d.split("-").reverse().join("/");

  function executar(fn: () => Promise<{ erro?: string }>, depois?: () => void) {
    iniciar(async () => {
      const r = await fn();
      if (r.erro) return setErro(r.erro);
      setErro(null);
      depois?.();
      router.refresh();
    });
  }
  const mover = (id: string, col: ColunaGeral) => executar(() => moverTarefaGeralAcao(id, col));
  const nova = (): Edicao => ({
    id: null,
    titulo: "",
    descricao: "",
    prioridade: "normal",
    prazo: "",
    responsavelId: eu,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted text-sm">{tg("explicacao")}</p>
        <button
          type="button"
          onClick={() => setEdicao(nova())}
          className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold"
        >
          {t("novaTarefa")}
        </button>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${pendente ? "opacity-70" : ""}`}>
        {COLUNAS.map((col) => {
          const lista = tarefas.filter((x) => x.situacao === col);
          return (
            <section
              key={col}
              aria-label={t(`situacoes.${col}`)}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(col);
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id && tarefas.find((x) => x.id === id)?.situacao !== col) mover(id, col);
              }}
              className={`bg-surface min-h-40 rounded-xl p-2 transition-colors ${sobre === col ? "ring-primary ring-2" : ""}`}
            >
              <h3 className="text-text flex items-center justify-between px-2 py-2 text-sm font-semibold">
                {t(`situacoes.${col}`)}
                <span className="text-muted text-xs font-normal">{lista.length}</span>
              </h3>
              <ul className="space-y-2">
                {lista.map((x) => (
                  <li
                    key={x.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", x.id)}
                    className="bg-background border-border shadow-cartao cursor-grab rounded-lg border p-3 active:cursor-grabbing"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setEdicao({
                          id: x.id,
                          titulo: x.titulo,
                          descricao: x.descricao ?? "",
                          prioridade: x.prioridade,
                          prazo: x.prazo ?? "",
                          responsavelId: x.responsavelId ?? "",
                        })
                      }
                      className="text-text hover:text-primary block w-full text-left text-sm font-medium"
                    >
                      {x.titulo}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 ${COR_DA_PRIORIDADE[x.prioridade]}`}>
                        {t(`prioridades.${x.prioridade}`)}
                      </span>
                      {x.prazo && (
                        <span className={x.atrasada ? "text-danger font-medium" : "text-muted"}>
                          {br(x.prazo)}
                          {x.atrasada && ` · ${t("atrasada")}`}
                        </span>
                      )}
                    </div>
                    <p className="text-muted mt-1 truncate text-xs">{x.responsavel ?? t("semResponsavel")}</p>
                    <select
                      value={x.situacao}
                      onChange={(e) => mover(x.id, e.target.value as ColunaGeral)}
                      aria-label={tg("moverPara", { titulo: x.titulo })}
                      className="border-border bg-background text-muted mt-2 w-full rounded-md border px-2 py-1 text-xs"
                    >
                      {COLUNAS.map((c) => (
                        <option key={c} value={c}>
                          {t(`situacoes.${c}`)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              {lista.length === 0 && (
                <p className="text-muted px-2 py-4 text-center text-xs">{tg("colunaVazia")}</p>
              )}
            </section>
          );
        })}
      </div>

      {edicao && (
        <Janela
          titulo={edicao.id ? t("editarTarefa") : t("novaTarefa")}
          rotuloFechar={tg("fechar")}
          fechar={() => setEdicao(null)}
          largura="max-w-lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const { id, ...dados } = edicao;
              executar(
                () => salvarTarefaGeralAcao(id, dados),
                () => setEdicao(null),
              );
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-text mb-1 block text-sm font-medium">{t("titulo")}</span>
              <input
                required
                maxLength={200}
                value={edicao.titulo}
                onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })}
                className={campo}
              />
            </label>
            <label className="block">
              <span className="text-text mb-1 block text-sm font-medium">{t("descricao")}</span>
              <textarea
                rows={3}
                maxLength={4000}
                value={edicao.descricao}
                onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })}
                className={campo}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-text mb-1 block text-sm font-medium">{t("prioridade")}</span>
                <select
                  value={edicao.prioridade}
                  onChange={(e) => setEdicao({ ...edicao, prioridade: e.target.value })}
                  className={campo}
                >
                  {(["baixa", "normal", "alta", "urgente"] as const).map((p) => (
                    <option key={p} value={p}>
                      {t(`prioridades.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-text mb-1 block text-sm font-medium">{t("prazo")}</span>
                <input
                  type="date"
                  value={edicao.prazo}
                  onChange={(e) => setEdicao({ ...edicao, prazo: e.target.value })}
                  className={campo}
                />
              </label>
              <label className="block">
                <span className="text-text mb-1 block text-sm font-medium">{tg("responsavel")}</span>
                <select
                  value={edicao.responsavelId}
                  onChange={(e) => setEdicao({ ...edicao, responsavelId: e.target.value })}
                  className={campo}
                >
                  <option value="">{t("semResponsavel")}</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              {edicao.id ? (
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => {
                    if (window.confirm(t("confirmarExcluir", { titulo: edicao.titulo })))
                      executar(
                        () => excluirTarefaGeralAcao(edicao.id!),
                        () => setEdicao(null),
                      );
                  }}
                  className="text-danger text-sm font-medium"
                >
                  {t("excluir")}
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={pendente}
                className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {pendente ? tg("salvando") : tg("salvar")}
              </button>
            </div>
          </form>
        </Janela>
      )}
    </div>
  );
}
