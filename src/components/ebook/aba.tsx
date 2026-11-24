"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  aprovarVersaoDoEbookAcao,
  comentarVersaoDoEbookAcao,
  criarVersaoDoEbookAcao,
  excluirVersaoDoEbookAcao,
  liberarVersaoDoEbookAcao,
  pdfDaVersaoDoEbookAcao,
} from "@/app/acoes/ebook";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { Aviso } from "@/components/ui/basicos";
import { baixarBase64 } from "@/components/ui/baixar";
import type { EbookDoNegocio, VersaoDoEbook } from "@/server/services/ebook";

/** Aba "E-book" do negócio (item 19): versões dos quatro materiais, revisão e liberação. */

const MATERIAIS = ["ebook_teaser", "ebook_completo", "onepager_teaser", "onepager_completo"] as const;
const IDENTIDADES = ["tenant", "vendedora", "advisor", "combinada"] as const;
const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none";
const botao =
  "border-border text-text hover:border-primary rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60";
const corDaSituacao = {
  em_revisao: "border-warning text-warning",
  aprovada: "border-primary text-primary",
  disponivel: "border-success text-success",
} as const;
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

function NovaVersao({ dealId, aoCriar }: { dealId: string; aoCriar: () => void }) {
  const t = useTranslations("ebook");
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
      >
        {t("novaVersao")}
      </button>
    );
  return (
    <form
      className="border-border w-full space-y-3 rounded-lg border p-3"
      action={(f) =>
        iniciar(async () => {
          setErro(null);
          const r = await criarVersaoDoEbookAcao(dealId, {
            material: String(f.get("material")) as (typeof MATERIAIS)[number],
            identidade: String(f.get("identidade")) as (typeof IDENTIDADES)[number],
            incluiValuation: f.get("incluiValuation") === "on",
            observacoes: String(f.get("observacoes") ?? ""),
          });
          if (r.erro) return setErro(r.erro);
          setAberto(false);
          aoCriar();
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text mb-1 block font-medium">{t("material")}</span>
          <select name="material" className={estiloCampo}>
            {MATERIAIS.map((m) => (
              <option key={m} value={m}>
                {t(`materiais.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-text mb-1 block font-medium">{t("identidade")}</span>
          <select name="identidade" className={estiloCampo}>
            {IDENTIDADES.map((i) => (
              <option key={i} value={i}>
                {t(`identidades.${i}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-text flex items-start gap-2 text-sm">
        <input type="checkbox" name="incluiValuation" className="mt-1" />
        <span>{t("incluiValuation")}</span>
      </label>
      <label className="block text-sm">
        <span className="text-text mb-1 block font-medium">{t("observacoes")}</span>
        <textarea name="observacoes" rows={2} maxLength={2000} className={estiloCampo} />
      </label>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendente}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {pendente ? t("criando") : t("criarVersao")}
        </button>
        <button type="button" onClick={() => setAberto(false)} className={botao}>
          ✕
        </button>
      </div>
    </form>
  );
}

function Versao({ v, vendedor, aoMudar }: { v: VersaoDoEbook; vendedor: boolean; aoMudar: () => void }) {
  const t = useTranslations("ebook");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [pendente, iniciar] = useTransition();
  const material = t(`materiais.${v.material}`);
  const executar = (fn: () => Promise<{ erro?: string; avisados?: number }>, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    iniciar(async () => {
      setErro(null);
      const r = await fn();
      if (r.erro) return setErro(r.erro);
      if (r.avisados !== undefined) setAviso(t("liberada", { n: r.avisados }));
      aoMudar();
    });
  };
  const abrir = () =>
    iniciar(async () => {
      setErro(null);
      const r = await pdfDaVersaoDoEbookAcao(v.id);
      if (r.erro || !r.conteudo || !r.nome) return setErro(r.erro ?? "");
      baixarBase64(r.conteudo, r.nome, "application/pdf");
    });
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text text-sm font-medium">{t("versao", { numero: v.numero })}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${corDaSituacao[v.situacao]}`}>
          {t(`situacoes.${v.situacao}`)}
        </span>
        <span className="text-muted text-xs">
          {t(`identidades.${v.identidade}`)}
          {v.incluiValuation && ` · ${t("comValuation")}`}
        </span>
      </div>
      <p className="text-muted mt-1 text-xs">
        {[
          v.criadoPor && t("criadaPor", { nome: v.criadoPor, data: quando(v.criadoEm) }),
          v.aprovadoPor &&
            v.aprovadoEm &&
            t("aprovadaPor", { nome: v.aprovadoPor, data: quando(v.aprovadoEm) }),
          v.liberadoPor &&
            v.liberadoEm &&
            t("liberadaPor", { nome: v.liberadoPor, data: quando(v.liberadoEm) }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {v.observacoes && <p className="text-text mt-1 text-xs whitespace-pre-line">{v.observacoes}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pendente} onClick={abrir} className={botao}>
          {pendente ? t("abrindo") : t("abrirPdf")}
        </button>
        {v.podeAprovar && (
          <button
            type="button"
            disabled={pendente}
            className={botao}
            onClick={() =>
              executar(
                () => aprovarVersaoDoEbookAcao(v.id),
                t("confirmarAprovar", { numero: v.numero, material }),
              )
            }
          >
            {t("aprovar")}
          </button>
        )}
        {v.podeLiberar && (
          <button
            type="button"
            disabled={pendente}
            className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60"
            onClick={() =>
              executar(
                () => liberarVersaoDoEbookAcao(v.id),
                t("confirmarLiberar", { numero: v.numero, material }),
              )
            }
          >
            {t("liberar")}
          </button>
        )}
        {v.podeExcluir && (
          <button
            type="button"
            disabled={pendente}
            className="text-danger px-1 text-xs font-medium"
            onClick={() =>
              executar(
                () => excluirVersaoDoEbookAcao(v.id),
                t("confirmarExcluir", { numero: v.numero, material }),
              )
            }
          >
            {t("excluir")}
          </button>
        )}
      </div>
      {erro && (
        <div className="mt-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mt-2">
          <Aviso tipo="ok">{aviso}</Aviso>
        </div>
      )}
      {vendedor && (v.comentarios.length > 0 || v.podeComentar) && (
        <div className="border-border mt-2 border-l-2 pl-3">
          <p className="text-muted text-xs font-semibold">{t("comentarios")}</p>
          {v.comentarios.length === 0 && <p className="text-muted text-xs">{t("semComentarios")}</p>}
          <ul className="space-y-1">
            {v.comentarios.map((c) => (
              <li key={c.id} className="text-xs">
                <span className="text-text font-medium">{c.autor ?? "—"}</span>
                <span className="text-muted"> · {quando(c.criadoEm)}</span>
                <span className="text-text block whitespace-pre-line">{c.texto}</span>
              </li>
            ))}
          </ul>
          {v.podeComentar && (
            <form
              className="mt-2 flex gap-2"
              action={() =>
                executar(async () => {
                  const r = await comentarVersaoDoEbookAcao(v.id, comentario);
                  if (!r.erro) setComentario("");
                  return r;
                })
              }
            >
              <label className="sr-only" htmlFor={`comentario-${v.id}`}>
                {t("comentario")}
              </label>
              <input
                id={`comentario-${v.id}`}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                maxLength={4000}
                className={estiloCampo}
              />
              <button type="submit" disabled={pendente || comentario.trim().length < 2} className={botao}>
                {t("comentar")}
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

export function AbaDoEbook({
  dealId,
  dados,
  simulado,
}: {
  dealId: string;
  dados: EbookDoNegocio;
  simulado: boolean;
}) {
  const t = useTranslations("ebook");
  const router = useRouter();
  const atualizar = () => router.refresh();
  return (
    <div>
      {simulado && <AvisoDeSimulacao texto={t("aviso")} />}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted max-w-2xl text-sm">
          {dados.vendedor ? t("explicacaoVendedor") : t("explicacaoComprador")}
        </p>
        {dados.podeCriar && <NovaVersao dealId={dealId} aoCriar={atualizar} />}
      </div>
      {dados.materiais.length === 0 && <p className="text-muted text-sm">{t("nadaLiberado")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {dados.materiais.map((m) => (
          <section key={m.material} className="border-border rounded-lg border p-3">
            <h3 className="text-text font-semibold">{t(`materiais.${m.material}`)}</h3>
            <p className="text-muted text-xs">{t(`descricoes.${m.material}`)}</p>
            {m.versoes.length === 0 ? (
              <p className="text-muted mt-3 text-sm">{t("nenhumaVersao")}</p>
            ) : (
              <ul className="divide-border divide-y">
                {m.versoes.map((v) => (
                  <Versao key={v.id} v={v} vendedor={dados.vendedor} aoMudar={atualizar} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
