"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { resumoDoDocumentoAcao } from "@/app/acoes/documentos";
import type { ResumoDasMensagens, ResumoDoDocumento } from "@/server/services/resumos";

/** Resumo das mensagens não lidas (módulo de resumos; local, sem IA). */
export function ResumoDeMensagens({ resumo }: { resumo: ResumoDasMensagens }) {
  const t = useTranslations("resumos");
  const formato = useFormatter();
  if (resumo.naoLidas === 0) return null;
  return (
    <section
      aria-label={t("titulo")}
      className="border-border bg-primary-soft mb-4 rounded-md border p-3 text-sm"
    >
      <p className="text-text">
        <span className="font-semibold">{t("titulo")}: </span>
        {t("mensagens", {
          n: resumo.naoLidas,
          pessoas: resumo.pessoas,
          negocios: resumo.negocios,
          desde: resumo.desde ? formato.dateTime(new Date(resumo.desde), { dateStyle: "short" }) : "",
        })}
        {resumo.mencoes > 0 && ` ${t("mencoes", { n: resumo.mencoes })}`}
      </p>
      {resumo.trechos.length > 0 && (
        <ul className="text-muted mt-1 list-disc pl-5 text-xs">
          {resumo.trechos.map((x, i) => (
            <li key={i}>
              <Link href={x.link} className="hover:text-primary">
                <span className="text-text">{x.autor ?? "—"}</span> ({x.negocio}): {x.trecho}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted mt-1 text-xs">{t("aviso")}</p>
    </section>
  );
}

/** Resumo do histórico de um documento, carregado ao abrir o documento. */
export function ResumoDeDocumento({ documentoId }: { documentoId: string }) {
  const t = useTranslations("resumos");
  const [r, setR] = useState<ResumoDoDocumento | null | undefined>(undefined);
  useEffect(() => {
    let ativo = true;
    resumoDoDocumentoAcao(documentoId)
      .then((x) => ativo && setR(x))
      .catch(() => ativo && setR(null));
    return () => {
      ativo = false;
    };
  }, [documentoId]);
  if (!r) return null;
  const partes = [
    t("versoes", { n: r.versoes, dias: r.dias }),
    r.autores.length ? t("autores", { nomes: r.autores.join(", ") }) : null,
    r.ultima.mudancas &&
      t("mudancas", {
        v: r.ultima.numero,
        mais: r.ultima.mudancas.adicionadas,
        menos: r.ultima.mudancas.removidas,
      }) +
        (r.ultima.mudancas.secoes.length
          ? ` ${t("secoes", { lista: r.ultima.mudancas.secoes.join(", ") })}`
          : ""),
    r.comentarios ? t("comentarios", { n: r.comentarios }) : null,
  ].filter(Boolean);
  return (
    <p className="text-muted mb-2 text-xs">
      <span className="text-text font-semibold">{t("historico")}: </span>
      {partes.join("; ")}.
    </p>
  );
}
