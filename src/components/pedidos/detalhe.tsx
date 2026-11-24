"use client";

import { hojeNoBrasil } from "@/config/prazos";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  criarRodadaAcao,
  excluirPedidoAcao,
  exportarPedidoAcao,
  situacaoDoItemAcao,
} from "@/app/acoes/pedidos";
import { emAberto, SITUACOES_DO_ITEM, situacoesPorPeriodo, type SituacaoDoItem } from "@/config/pedidos";
import { Ajuda, Aviso, estiloTabela } from "@/components/ui/basicos";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Janela } from "@/components/ui/janela";
import { usePaginacao } from "@/components/ui/paginacao-local";
import type { ItemNaTela, PedidoDetalhe, PedidosDoNegocio } from "@/server/services/pedidos";
import {
  botaoPrincipal,
  botaoSecundario,
  br,
  campo,
  FormularioDoPedido,
  rotulo,
  useNavegacaoDePedidos,
} from "./aba";
import { ImportacaoDaPlanilha } from "./importacao";
import { JanelaDoItem } from "./item";

/** Cores das situações (só tokens semânticos). */
export const TOM_DA_SITUACAO: Record<SituacaoDoItem, string> = {
  pendente: "bg-warning-soft text-warning",
  parcial: "bg-warning-soft text-warning",
  em_analise: "bg-primary-soft text-primary",
  entregue: "bg-success-soft text-success",
  aprovado: "bg-success-soft text-success",
  nao_aplicavel: "bg-surface text-muted",
};

export function PilulaDaSituacao({ situacao, prefixo }: { situacao: SituacaoDoItem; prefixo?: string }) {
  const t = useTranslations("pedidos.situacoes");
  return (
    <span
      className={`${TOM_DA_SITUACAO[situacao]} inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}
    >
      {prefixo ? `${prefixo}: ` : ""}
      {t(situacao)}
    </span>
  );
}

const lerFiltro = (k: string) =>
  typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get(k) ?? "");

export function DetalheDoPedido({ detalhe: d, dados }: { detalhe: PedidoDetalhe; dados: PedidosDoNegocio }) {
  const t = useTranslations("pedidos");
  const td = useTranslations("pedidos.detalhe");
  const tf = useTranslations("pedidos.filtros");
  const ti = useTranslations("pedidos.itens");
  const ts = useTranslations("pedidos.situacoes");
  const router = useRouter();
  const voltar = useNavegacaoDePedidos();
  const [vista, setVista] = useState<"itens" | "painel">(() =>
    lerFiltro("vista") === "painel" ? "painel" : "itens",
  );
  const [filtro, setFiltro] = useState(() => ({
    busca: lerFiltro("busca"),
    assunto: lerFiltro("assunto"),
    situacao: lerFiltro("situacao"),
    rodada: lerFiltro("rodada"),
    responsavel: lerFiltro("responsavel"),
  }));
  const [itemAberto, setItemAberto] = useState<string | "novo" | null>(null);
  const [janela, setJanela] = useState<"editar" | "rodada" | "importar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  /** Filtros e vista no endereço (voltar e recarregar mantêm). */
  function guardar(chaves: Record<string, string>) {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(chaves)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    window.history.replaceState(null, "", `?${q.toString()}`);
  }
  const mudaFiltro = (k: keyof typeof filtro) => (e: { target: { value: string } }) => {
    const novo = { ...filtro, [k]: e.target.value };
    setFiltro(novo);
    guardar(novo);
  };
  const limpar = () => {
    const vazio = { busca: "", assunto: "", situacao: "", rodada: "", responsavel: "" };
    setFiltro(vazio);
    guardar(vazio);
  };

  const filtrados = useMemo(() => {
    const termo = filtro.busca.trim().toLowerCase();
    return d.itens.filter(
      (i) =>
        (!filtro.assunto || i.assunto === filtro.assunto) &&
        (!filtro.rodada || i.rodadaId === filtro.rodada) &&
        (!filtro.responsavel ||
          (filtro.responsavel === "-" ? !i.responsavelId : i.responsavelId === filtro.responsavel)) &&
        (!filtro.situacao ||
          (filtro.situacao === "aberto" ? emAberto(i.situacao) : i.situacao === filtro.situacao)) &&
        (!termo ||
          [i.codigo, i.descricao, i.grupo, i.subgrupo, i.resposta, i.observacaoSolicitante]
            .filter(Boolean)
            .some((x) => x!.toLowerCase().includes(termo))),
    );
  }, [d.itens, filtro]);
  const { atual: paginaDeItens, controles } = usePaginacao(filtrados, 50);
  const porAssunto = Map.groupBy(paginaDeItens, (i) => i.assunto);
  const filtrado = Object.values(filtro).some(Boolean);

  async function exportar() {
    setExportando(true);
    setErro(null);
    const r = await exportarPedidoAcao(d.id);
    setExportando(false);
    if (r.erro || !r.conteudo || !r.nome) return setErro(r.erro ?? "");
    const bytes = Uint8Array.from(atob(r.conteudo), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  async function excluir() {
    if (!window.confirm(td("confirmarExcluir", { titulo: d.titulo }))) return;
    const r = await excluirPedidoAcao(d.id);
    if (r.erro) return setErro(r.erro);
    voltar(null);
  }
  async function mudarSituacao(i: ItemNaTela, situacao: SituacaoDoItem) {
    const r = await situacaoDoItemAcao(i.id, "", situacao);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }

  const aberto = itemAberto && itemAberto !== "novo" ? d.itens.find((i) => i.id === itemAberto) : null;
  const meta = [
    d.compradora && td("compradora", { nome: d.compradora }),
    d.solicitante &&
      td("solicitante", { nome: [d.solicitante, d.solicitantePessoas].filter(Boolean).join(" — ") }),
    br(d.data),
    d.dataBase && td("dataBase", { data: br(d.dataBase) }),
    d.periodos.length > 0 && td("periodos", { periodos: d.periodos.join(", ") }),
    d.amostragem && td("amostragem", { texto: d.amostragem }),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => voltar(null)} className="text-primary text-sm">
        {td("voltar")}
      </button>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-text text-lg font-bold tracking-tight">
            <span className="text-muted mr-1 font-normal tabular-nums">{d.numero}.</span>
            {d.titulo}
          </h3>
          <p className="text-muted text-sm">{meta.join(" · ")}</p>
          {d.origem && <p className="text-muted text-xs">{td("origem", { origem: d.origem })}</p>}
          {d.descricao && <p className="text-text mt-1 text-sm whitespace-pre-line">{d.descricao}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {d.podeEditar && (
            <>
              <button type="button" onClick={() => setJanela("importar")} className={botaoSecundario}>
                {td("importar")}
              </button>
              <button type="button" onClick={() => setJanela("rodada")} className={botaoSecundario}>
                {td("novaRodada")}
              </button>
              <button type="button" onClick={() => setJanela("editar")} className={botaoSecundario}>
                {td("editar")}
              </button>
            </>
          )}
          {d.podeBaixar && (
            <button type="button" onClick={exportar} disabled={exportando} className={botaoSecundario}>
              {exportando ? td("exportando") : td("exportar")}
            </button>
          )}
          {d.podeExcluir && (
            <button
              type="button"
              onClick={excluir}
              className="border-danger/40 text-danger hover:bg-danger-soft rounded-md border px-3 py-2 text-sm font-medium"
            >
              {td("excluir")}
            </button>
          )}
        </div>
      </header>
      {erro && <Aviso>{erro}</Aviso>}
      <p className="text-muted text-xs">
        <span className="font-medium">{td("rodadas")}:</span>{" "}
        {d.rodadas.map((r) => td("rodada", { numero: r.numero, nome: r.nome, data: br(r.data) })).join(" · ")}
      </p>

      <div role="tablist" className="border-border flex gap-4 border-b">
        {(["itens", "painel"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => {
              setVista(v);
              guardar({ vista: v === "painel" ? "painel" : "" });
            }}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
              vista === v ? "border-primary text-primary" : "text-muted hover:text-text border-transparent"
            }`}
          >
            {v === "itens" ? td("abaItens", { n: d.itens.length }) : td("abaPainel")}
          </button>
        ))}
      </div>

      {vista === "painel" ? (
        <Painel detalhe={d} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="text-muted mb-1 block">{tf("busca")}</span>
              <input
                type="search"
                value={filtro.busca}
                onChange={mudaFiltro("busca")}
                placeholder={tf("buscaExemplo")}
                className={`${campo} w-56`}
              />
            </label>
            <label className="text-xs">
              <span className="text-muted mb-1 block">{tf("assunto")}</span>
              <select value={filtro.assunto} onChange={mudaFiltro("assunto")} className={campo}>
                <option value="">{tf("todos")}</option>
                {d.painel.assuntos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="text-muted mb-1 block">{tf("situacao")}</span>
              <select value={filtro.situacao} onChange={mudaFiltro("situacao")} className={campo}>
                <option value="">{tf("todas")}</option>
                <option value="aberto">{t("colAbertos")}</option>
                {SITUACOES_DO_ITEM.map((s) => (
                  <option key={s} value={s}>
                    {ts(s)}
                  </option>
                ))}
              </select>
            </label>
            {d.rodadas.length > 1 && (
              <label className="text-xs">
                <span className="text-muted mb-1 block">{tf("rodada")}</span>
                <select value={filtro.rodada} onChange={mudaFiltro("rodada")} className={campo}>
                  <option value="">{tf("todas")}</option>
                  {d.rodadas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {d.responsaveis.length > 0 && (
              <label className="text-xs">
                <span className="text-muted mb-1 block">{tf("responsavel")}</span>
                <select value={filtro.responsavel} onChange={mudaFiltro("responsavel")} className={campo}>
                  <option value="">{tf("todos")}</option>
                  <option value="-">—</option>
                  {d.responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {filtrado && (
              <button type="button" onClick={limpar} className="text-primary py-2 text-sm font-semibold">
                {tf("limpar")}
              </button>
            )}
            <span className="flex-1" />
            {d.podeEditar && (
              <button type="button" onClick={() => setItemAberto("novo")} className={botaoPrincipal}>
                {ti("novo")}
              </button>
            )}
          </div>
          <p className="text-muted text-xs">
            {tf("mostrando", { n: filtrados.length, total: d.itens.length })}
          </p>
          {d.itens.length === 0 ? (
            <EstadoVazio titulo={ti("vazio")} />
          ) : filtrados.length === 0 ? (
            <EstadoVazio titulo={tf("nenhum")} limpar={{ onClick: limpar, rotulo: tf("limpar") }} />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    <th className={estiloTabela.th}>{ti("colCodigo")}</th>
                    <th className={estiloTabela.th}>{ti("colDescricao")}</th>
                    <th className={estiloTabela.th}>{ti("colPrioridade")}</th>
                    <th className={estiloTabela.th}>{ti("colSituacao")}</th>
                    <th className={`${estiloTabela.th} text-right`}>
                      <span className="inline-flex items-center gap-1">
                        {ti("colDias")} <Ajuda texto={ti("colDiasAjuda")} />
                      </span>
                    </th>
                    <th className={estiloTabela.th}>{ti("colResponsavel")}</th>
                    <th className={`${estiloTabela.th} text-right`}>{ti("colDocumentos")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...porAssunto].map(([assunto, itens]) => (
                    <Fragment key={assunto}>
                      <tr>
                        <td
                          colSpan={7}
                          className="text-text bg-surface px-3 py-1.5 text-xs font-semibold uppercase"
                        >
                          {assunto} <span className="text-muted font-normal">({itens.length})</span>
                        </td>
                      </tr>
                      {itens.map((i) => (
                        <tr
                          key={i.id}
                          className={`${estiloTabela.linha} hover:bg-surface cursor-pointer`}
                          onClick={() => setItemAberto(i.id)}
                        >
                          <td className={`${estiloTabela.td} text-muted font-mono text-xs whitespace-nowrap`}>
                            {i.codigo ?? "—"}
                          </td>
                          <td className={`${estiloTabela.td} max-w-md min-w-64 text-sm`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemAberto(i.id);
                              }}
                              title={ti("editar")}
                              className="text-text line-clamp-2 text-left hover:underline"
                            >
                              {i.descricao}
                            </button>
                            <span className="text-muted block text-xs">
                              {[i.grupo, i.subgrupo, i.tipo === "pergunta" && ti("pergunta"), i.formato]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </td>
                          <td className={`${estiloTabela.td} text-xs`}>{i.prioridade ?? "—"}</td>
                          <td className={estiloTabela.td} onClick={(e) => e.stopPropagation()}>
                            {d.periodos.length === 0 && d.podeEditar ? (
                              <select
                                value={i.situacao}
                                onChange={(e) => mudarSituacao(i, e.target.value as SituacaoDoItem)}
                                aria-label={ti("colSituacao")}
                                className={`${TOM_DA_SITUACAO[i.situacao]} rounded-full border-0 px-2 py-0.5 text-xs font-medium`}
                              >
                                {SITUACOES_DO_ITEM.map((s) => (
                                  <option key={s} value={s}>
                                    {ts(s)}
                                  </option>
                                ))}
                              </select>
                            ) : d.periodos.length === 0 ? (
                              <PilulaDaSituacao situacao={i.situacao} />
                            ) : (
                              <span className="flex flex-wrap gap-1" title={ts(i.situacao)}>
                                {situacoesPorPeriodo(i.situacoes, d.periodos).map(([p, s]) => (
                                  <span
                                    key={p}
                                    className={`${TOM_DA_SITUACAO[s]} rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums`}
                                    title={`${p}: ${ts(s)}`}
                                  >
                                    {p}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className={`${estiloTabela.td} text-right text-xs tabular-nums`}>
                            {i.diasEmAberto ?? "—"}
                          </td>
                          <td className={`${estiloTabela.td} text-xs`}>{i.responsavel ?? "—"}</td>
                          <td className={`${estiloTabela.td} text-right text-xs tabular-nums`}>
                            {i.documentos.length || "—"}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {controles}
            </div>
          )}
        </>
      )}

      {(itemAberto === "novo" || aberto) && (
        <JanelaDoItem
          key={itemAberto ?? ""}
          detalhe={d}
          item={aberto ?? null}
          assuntoInicial={filtro.assunto}
          fechar={() => setItemAberto(null)}
        />
      )}
      {janela === "editar" && (
        <FormularioDoPedido dealId={d.dealId} dados={dados} pedido={d} fechar={() => setJanela(null)} />
      )}
      {janela === "rodada" && <NovaRodada pedidoId={d.id} fechar={() => setJanela(null)} />}
      {janela === "importar" && <ImportacaoDaPlanilha detalhe={d} fechar={() => setJanela(null)} />}
    </div>
  );
}

function NovaRodada({ pedidoId, fechar }: { pedidoId: string; fechar: () => void }) {
  const t = useTranslations("pedidos.detalhe");
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [data, setData] = useState(hojeNoBrasil());
  const [erro, setErro] = useState<string | null>(null);
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const r = await criarRodadaAcao(pedidoId, nome, data);
    if (r.erro) return setErro(r.erro);
    fechar();
    router.refresh();
  }
  return (
    <Janela titulo={t("novaRodada")} rotuloFechar={t("fechar")} fechar={fechar} largura="max-w-md">
      <form onSubmit={criar} className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        <label className="block">
          <span className={rotulo}>{t("nomeDaRodada")}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("nomeDaRodadaExemplo")}
            required
            maxLength={80}
            className={campo}
          />
        </label>
        <label className="block">
          <span className={rotulo}>{t("dataDaRodada")}</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className={campo}
          />
        </label>
        <div className="flex justify-end">
          <button className={botaoPrincipal}>{t("criarRodada")}</button>
        </div>
      </form>
    </Janela>
  );
}

/** Painel do pedido (a "capa"): situação × assunto, com a parte atendida de cada assunto. */
function Painel({ detalhe: d }: { detalhe: PedidoDetalhe }) {
  const t = useTranslations("pedidos.painel");
  const ts = useTranslations("pedidos.situacoes");
  if (d.painel.itens === 0) return <EstadoVazio titulo={t("vazio")} />;
  const atendidos = (c: Record<SituacaoDoItem, number>) => c.entregue + c.aprovado + c.nao_aplicavel;
  const linha = (nome: string, c: Record<SituacaoDoItem, number>, total = false) => {
    const soma = Object.values(c).reduce((x, y) => x + y, 0);
    const pct = soma ? Math.round((atendidos(c) / soma) * 100) : 0;
    return (
      <tr key={nome} className={total ? "border-border border-t-2 font-semibold" : estiloTabela.linha}>
        <td className={`${estiloTabela.td} text-sm`}>{nome}</td>
        {SITUACOES_DO_ITEM.map((s) => (
          <td key={s} className={`${estiloTabela.td} text-right text-sm tabular-nums`}>
            {c[s] ? (
              <span className={`${TOM_DA_SITUACAO[s]} rounded px-1.5 py-0.5`}>{c[s]}</span>
            ) : (
              <span className="text-muted">0</span>
            )}
          </td>
        ))}
        <td className={`${estiloTabela.td} text-right text-sm tabular-nums`}>{soma}</td>
        <td className={`${estiloTabela.td} w-40`}>
          <span className="flex items-center gap-2">
            <span className="bg-surface h-2 flex-1 overflow-hidden rounded-full">
              <span className="bg-success block h-full rounded-full" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-muted w-9 text-right text-xs tabular-nums">{pct}%</span>
          </span>
        </td>
      </tr>
    );
  };
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className={estiloTabela.tabela}>
        <thead className={estiloTabela.cabecalho}>
          <tr>
            <th className={estiloTabela.th}>{t("assunto")}</th>
            {SITUACOES_DO_ITEM.map((s) => (
              <th key={s} className={`${estiloTabela.th} text-right`}>
                {ts(s)}
              </th>
            ))}
            <th className={`${estiloTabela.th} text-right`}>{t("total")}</th>
            <th className={estiloTabela.th}>
              <span className="inline-flex items-center gap-1">
                {t("andamento")} <Ajuda texto={t("andamentoAjuda")} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {d.painel.assuntos.map((a) => linha(a, d.painel.porAssunto[a]))}
          {linha(t("total"), d.painel.total, true)}
        </tbody>
      </table>
    </div>
  );
}
