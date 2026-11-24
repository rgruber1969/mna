"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { excluirItemAcao, ligarDocumentoAcao, salvarItemAcao } from "@/app/acoes/pedidos";
import {
  ASSUNTOS_PADRAO,
  SEM_PERIODO,
  SITUACOES_DO_ITEM,
  situacoesPorPeriodo,
  type SituacaoDoItem,
} from "@/config/pedidos";
import { Ajuda, Aviso } from "@/components/ui/basicos";
import { Janela } from "@/components/ui/janela";
import type { ItemNaTela, PedidoDetalhe } from "@/server/services/pedidos";
import { botaoPrincipal, botaoSecundario, campo, rotulo } from "./aba";
import { TOM_DA_SITUACAO } from "./detalhe";

/** Item do pedido: o que foi pedido, a resposta do lado vendedor, situação por período e documentos. */
export function JanelaDoItem({
  detalhe: d,
  item,
  assuntoInicial,
  fechar,
}: {
  detalhe: PedidoDetalhe;
  item: ItemNaTela | null;
  assuntoInicial: string;
  fechar: () => void;
}) {
  const t = useTranslations("pedidos.item");
  const ts = useTranslations("pedidos.situacoes");
  const tt = useTranslations("pedidos.tipos");
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({
    rodadaId: item?.rodadaId ?? d.rodadas[d.rodadas.length - 1]?.id ?? "",
    assunto: item?.assunto ?? assuntoInicial ?? d.painel.assuntos[0] ?? "",
    codigo: item?.codigo ?? "",
    grupo: item?.grupo ?? "",
    subgrupo: item?.subgrupo ?? "",
    prioridade: item?.prioridade ?? "",
    descricao: item?.descricao ?? "",
    formato: item?.formato ?? "",
    tipo: item?.tipo ?? ("documento" as "documento" | "pergunta"),
    dataPedido: item?.dataPedido ?? hoje,
    dataEntrega: item?.dataEntrega ?? "",
    departamento: item?.departamento ?? "",
    responsavelId: item?.responsavelId ?? "",
    observacaoSolicitante: item?.observacaoSolicitante ?? "",
    resposta: item?.resposta ?? "",
    ondeObter: item?.ondeObter ?? "",
    fonteId: item?.fonteId ?? "",
  });
  const [situacoes, setSituacoes] = useState<Record<string, SituacaoDoItem>>(
    Object.fromEntries(situacoesPorPeriodo(item?.situacoes ?? {}, d.periodos)),
  );
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const somenteLeitura = !d.podeEditar;
  const muda = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  const fonte = d.fontes.find((f) => f.id === v.fonteId);
  const assuntos = [...new Set([...d.painel.assuntos, ...ASSUNTOS_PADRAO])];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarItemAcao(d.id, item?.id ?? null, { ...v, situacoes });
    setSalvando(false);
    if (r.erro) return setErro({ texto: r.erro, campo: r.campo });
    fechar();
    router.refresh();
  }
  async function excluir() {
    if (!item || !window.confirm(t("confirmarExcluir"))) return;
    const r = await excluirItemAcao(item.id);
    if (r.erro) return setErro({ texto: r.erro });
    fechar();
    router.refresh();
  }
  async function ligar(documentoId: string, sim: boolean) {
    if (!item || !documentoId) return;
    const r = await ligarDocumentoAcao(item.id, documentoId, sim);
    if (r.erro) return setErro({ texto: r.erro });
    router.refresh();
  }
  function escolherFonte(id: string) {
    const f = d.fontes.find((x) => x.id === id);
    setV({
      ...v,
      fonteId: id,
      ondeObter: f && !v.ondeObter ? `${f.orgao}${f.link ? ` — ${f.link}` : ""}` : v.ondeObter,
    });
  }
  const comErro = (c: string) => (erro?.campo === c ? "border-danger" : "");
  const linkDaConversa = item
    ? `?${new URLSearchParams({ aba: "mensagens", conversa: `pedidoItem:${item.id}` }).toString()}`
    : null;

  return (
    <Janela
      titulo={item ? t("tituloEditar", { codigo: item.codigo ?? "" }) : t("tituloNovo")}
      rotuloFechar={t("fechar")}
      fechar={fechar}
      largura="max-w-4xl"
    >
      <form onSubmit={salvar} className="space-y-5">
        {erro && <Aviso>{erro.texto}</Aviso>}
        <fieldset disabled={somenteLeitura} className="grid gap-3 sm:grid-cols-6">
          <legend className="text-muted mb-2 text-xs font-semibold uppercase">{t("grupoPedido")}</legend>
          <label className="sm:col-span-2">
            <span className={`${rotulo} flex items-center gap-1`}>
              {t("assunto")} <Ajuda texto={t("assuntoAjuda")} />
            </span>
            <input
              list="assuntos-do-pedido"
              value={v.assunto}
              onChange={muda("assunto")}
              required
              maxLength={80}
              className={`${campo} ${comErro("assunto")}`}
            />
            <datalist id="assuntos-do-pedido">
              {assuntos.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("rodada")}</span>
            <select value={v.rodadaId} onChange={muda("rodadaId")} className={campo}>
              {d.rodadas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={rotulo}>{t("codigo")}</span>
            <input value={v.codigo} onChange={muda("codigo")} maxLength={40} className={campo} />
          </label>
          <label>
            <span className={rotulo}>{t("tipo")}</span>
            <select value={v.tipo} onChange={muda("tipo")} className={campo}>
              <option value="documento">{tt("documento")}</option>
              <option value="pergunta">{tt("pergunta")}</option>
            </select>
          </label>
          <label className="sm:col-span-6">
            <span className={rotulo}>{t("descricao")}</span>
            <textarea
              value={v.descricao}
              onChange={muda("descricao")}
              required
              rows={3}
              maxLength={4000}
              className={`${campo} ${comErro("descricao")}`}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("grupo")}</span>
            <input value={v.grupo} onChange={muda("grupo")} maxLength={160} className={campo} />
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("subgrupo")}</span>
            <input value={v.subgrupo} onChange={muda("subgrupo")} maxLength={160} className={campo} />
          </label>
          <label>
            <span className={rotulo}>{t("prioridade")}</span>
            <select value={v.prioridade} onChange={muda("prioridade")} className={campo}>
              <option value="">{t("prioridadeNenhuma")}</option>
              {[...new Set([...d.prioridades, ...(v.prioridade ? [v.prioridade] : [])])].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={rotulo}>{t("formato")}</span>
            <input
              value={v.formato}
              onChange={muda("formato")}
              placeholder={t("formatoExemplo")}
              maxLength={80}
              className={campo}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("dataPedido")}</span>
            <input
              type="date"
              value={v.dataPedido}
              onChange={muda("dataPedido")}
              required
              className={`${campo} ${comErro("dataPedido")}`}
            />
          </label>
          <label className="sm:col-span-4">
            <span className={rotulo}>{t("observacao")}</span>
            <textarea
              value={v.observacaoSolicitante}
              onChange={muda("observacaoSolicitante")}
              rows={2}
              maxLength={4000}
              className={campo}
            />
          </label>
        </fieldset>

        <fieldset disabled={somenteLeitura} className="border-border grid gap-3 border-t pt-4 sm:grid-cols-6">
          <legend className="text-muted mb-2 text-xs font-semibold uppercase">{t("grupoResposta")}</legend>
          <div className="sm:col-span-6">
            <span className={rotulo}>{d.periodos.length ? t("situacoesPorPeriodo") : t("situacoes")}</span>
            <div className="flex flex-wrap gap-3">
              {Object.keys(situacoes).map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  {p !== SEM_PERIODO && <span className="text-muted tabular-nums">{p}</span>}
                  <select
                    value={situacoes[p]}
                    onChange={(e) => setSituacoes({ ...situacoes, [p]: e.target.value as SituacaoDoItem })}
                    className={`${TOM_DA_SITUACAO[situacoes[p]]} rounded-full border-0 px-2 py-1 text-xs font-medium`}
                  >
                    {SITUACOES_DO_ITEM.map((s) => (
                      <option key={s} value={s}>
                        {ts(s)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <label className="sm:col-span-6">
            <span className={rotulo}>{t("resposta")}</span>
            <textarea
              value={v.resposta}
              onChange={muda("resposta")}
              rows={3}
              maxLength={4000}
              className={campo}
            />
          </label>
          <label className="sm:col-span-3">
            <span className={rotulo}>{t("fonte")}</span>
            <select value={v.fonteId} onChange={(e) => escolherFonte(e.target.value)} className={campo}>
              <option value="">{t("fonteNenhuma")}</option>
              {d.fontes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.gratuito ? t("fonteGratuita") : t("fontePaga")})
                </option>
              ))}
            </select>
            {fonte?.link && (
              <a
                href={fonte.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-1 inline-block text-xs"
              >
                {t("abrirLink")} ↗
              </a>
            )}
          </label>
          <label className="sm:col-span-3">
            <span className={rotulo}>{t("ondeObter")}</span>
            <input value={v.ondeObter} onChange={muda("ondeObter")} maxLength={1000} className={campo} />
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("responsavel")}</span>
            <select value={v.responsavelId} onChange={muda("responsavelId")} className={campo}>
              <option value="">{t("responsavelNenhum")}</option>
              {d.responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={rotulo}>{t("departamento")}</span>
            <input value={v.departamento} onChange={muda("departamento")} maxLength={120} className={campo} />
          </label>
          <label className="sm:col-span-2">
            <span className={`${rotulo} flex items-center gap-1`}>
              {t("dataEntrega")} <Ajuda texto={t("dataEntregaAjuda")} />
            </span>
            <input type="date" value={v.dataEntrega} onChange={muda("dataEntrega")} className={campo} />
          </label>
        </fieldset>

        {item && (
          <section className="border-border grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <span className={rotulo}>{t("documentos")}</span>
              {item.documentos.length === 0 ? (
                <p className="text-muted text-sm">{t("documentosVazio")}</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {item.documentos.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 py-1.5">
                      <a href="?aba=documentos" className="text-primary min-w-0 truncate hover:underline">
                        {doc.titulo}
                      </a>
                      {d.podeEditar && (
                        <button
                          type="button"
                          onClick={() => ligar(doc.id, false)}
                          className="text-danger text-xs"
                        >
                          {t("desligar")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {d.podeEditar && (
                <select
                  value=""
                  onChange={(e) => ligar(e.target.value, true)}
                  aria-label={t("ligar")}
                  className={`${campo} mt-2`}
                >
                  <option value="">{t("ligar")}</option>
                  {d.documentos
                    .filter((doc) => !item.documentos.some((x) => x.id === doc.id))
                    .map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.titulo}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div>
              <span className={rotulo}>{t("conversa")}</span>
              <a href={linkDaConversa!} className={`${botaoSecundario} inline-block`}>
                {t("abrirConversa")}
              </a>
              <p className="text-muted mt-1 text-xs">{t("conversaAjuda")}</p>
            </div>
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {item && d.podeEditar && (
            <button
              type="button"
              onClick={excluir}
              className="text-danger hover:bg-danger-soft mr-auto rounded-md px-3 py-2 text-sm font-medium"
            >
              {t("excluir")}
            </button>
          )}
          <button type="button" onClick={fechar} className={botaoSecundario}>
            {t("fechar")}
          </button>
          {!somenteLeitura && (
            <button disabled={salvando} className={botaoPrincipal}>
              {salvando ? t("salvando") : t("salvar")}
            </button>
          )}
        </div>
      </form>
    </Janela>
  );
}
