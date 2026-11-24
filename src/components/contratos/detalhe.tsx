"use client";

import { BotaoDeIcone } from "@/components/ui/icone-de-acao";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  avisarFinanceiroAcao,
  concluirArquivoDoContratoAcao,
  excluirContratoAcao,
  iniciarArquivoDoContratoAcao,
  linkDoArquivoDoContratoAcao,
} from "@/app/acoes/contratos";
import { successFeeEstimado } from "@/config/success-fee";
import { Aviso, estiloTabela } from "@/components/ui/basicos";

type Arquivo = {
  id: string;
  numero: number;
  nomeArquivo: string;
  tamanho: number;
  situacao: "enviando" | "disponivel" | "bloqueado";
  comentario: string | null;
  enviadoPor: string | null;
  criadoEm: string;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
const tamanho = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
const campo = "border-border bg-background text-text rounded-md border px-3 py-1.5 text-sm";

/** Versões dos arquivos do contrato: envio (antivírus e tipo conferidos) e download auditado. */
export function ArquivosDoContrato({
  contratoId,
  arquivos,
  podeEnviar,
  podeBaixar,
}: {
  contratoId: string;
  arquivos: Arquivo[];
  podeEnviar: boolean;
  podeBaixar: boolean;
}) {
  const t = useTranslations("contratos");
  const td = useTranslations("documentos");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [comentario, setComentario] = useState("");

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    setOk(null);
    const inicio = await iniciarArquivoDoContratoAcao(contratoId, {
      nomeArquivo: arquivo.name,
      tamanho: arquivo.size,
      comentario,
    });
    if (inicio.erro || !inicio.url || !inicio.arquivoId) {
      setEnviando(false);
      return setErro(inicio.erro ?? td("erros.envioIncompleto"));
    }
    const envio = await fetch(inicio.url, {
      method: "PUT",
      body: arquivo,
      headers: { "content-type": "application/octet-stream" },
    }).catch(() => null);
    const fim = envio?.ok
      ? await concluirArquivoDoContratoAcao(inicio.arquivoId)
      : { erro: td("erros.envioIncompleto") };
    setEnviando(false);
    if (fim.erro) return setErro(fim.erro);
    setComentario("");
    setOk(t("arquivoGravado"));
    router.refresh();
  }

  return (
    <div>
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      {podeEnviar && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={1000}
            placeholder={t("comentario")}
            aria-label={t("comentario")}
            className={`${campo} w-72`}
          />
          <label className="border-primary text-primary cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium">
            {enviando ? t("enviando") : t("enviarArquivo")}
            <input
              type="file"
              className="sr-only"
              disabled={enviando}
              onChange={(e) => {
                void enviar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {arquivos.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhumArquivo")}</p>
      ) : (
        <ul className="border-border ml-1 border-l text-sm">
          {arquivos.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2 pl-4">
              <span>
                <span className="text-text font-medium">
                  {t("versaoN", { n: x.numero })} · {x.nomeArquivo} · {tamanho(x.tamanho)}
                </span>
                <span className="text-muted block text-xs">
                  {[x.enviadoPor, quando(x.criadoEm)].filter(Boolean).join(" · ")}
                  {x.situacao === "bloqueado" && (
                    <span className="text-danger"> · {td("situacoes.bloqueado")}</span>
                  )}
                </span>
                {x.comentario && <span className="text-muted block text-xs italic">{x.comentario}</span>}
              </span>
              {podeBaixar && x.situacao === "disponivel" && (
                <BotaoDeIcone
                  tipo="baixar"
                  rotulo={t("baixar")}
                  onClick={async () => {
                    const r = await linkDoArquivoDoContratoAcao(x.id);
                    if (r.erro || !r.url) return setErro(r.erro ?? td("erros.download"));
                    window.location.assign(r.url);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Simulação do success fee sobre um valor informado (ex.: o da oferta). */
export function SimulacaoDeSuccessFee({
  contrato,
}: {
  contrato: {
    successFeePercentual: string | null;
    successFeeMinimo: string | null;
    retainerDescontado: boolean;
  };
}) {
  const t = useTranslations("contratos");
  const [valor, setValor] = useState("");
  if (contrato.successFeePercentual === null && contrato.successFeeMinimo === null) return null;
  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  const r = valor && Number.isFinite(numero) ? successFeeEstimado(contrato, numero) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-muted">{t("successFeeSimulacao")}</span>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`${campo} w-40`}
        />
      </label>
      {r !== null && (
        <span className="text-text font-medium">
          {t("successFeeResultado", {
            valor: r.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          })}
        </span>
      )}
    </div>
  );
}

/** Enviar ao financeiro e excluir. */
export function AcoesDoContrato({
  id,
  titulo,
  podeEditar,
  podeExcluir,
  voltar,
}: {
  id: string;
  titulo: string;
  podeEditar: boolean;
  podeExcluir: boolean;
  voltar: string;
}) {
  const t = useTranslations("contratos");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      <div className="flex flex-wrap gap-3">
        {podeEditar && (
          <a
            href={`/contratos/${id}?editar=1`}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t("editar")}
          </a>
        )}
        {podeEditar && (
          <button
            type="button"
            className="border-primary text-primary rounded-md border px-3 py-1.5 text-sm font-medium"
            onClick={async () => {
              if (!confirm(t("confirmarFinanceiro"))) return;
              setErro(null);
              const r = await avisarFinanceiroAcao(id);
              if (r.erro) return setErro(r.erro);
              setOk(t("financeiroEnviado", { n: r.enviados ?? 0 }));
              router.refresh();
            }}
          >
            {t("enviarFinanceiro")}
          </button>
        )}
        {podeExcluir && (
          <button
            type="button"
            className="border-danger text-danger rounded-md border px-3 py-1.5 text-sm font-medium"
            onClick={async () => {
              if (!confirm(t("confirmarExcluir", { titulo }))) return;
              const r = await excluirContratoAcao(id);
              if (r.erro) return setErro(r.erro);
              router.push(voltar);
              router.refresh();
            }}
          >
            {t("excluir")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Tabela de contratos (tela de contratos e aba do negócio). */
export function TabelaDeContratos({
  contratos,
  mostrarNegocio,
}: {
  contratos: {
    id: string;
    titulo: string;
    tipo: "mandato" | "honorarios" | "outro";
    negocio: string | null;
    contratantes: string[];
    contratadas: string[];
    inicio: string | null;
    fim: string | null;
    vigente: boolean;
    arquivos: number;
  }[];
  mostrarNegocio: boolean;
}) {
  const t = useTranslations("contratos");
  const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "…");
  if (contratos.length === 0) return <p className="text-muted text-sm">{t("nenhum")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={estiloTabela.tabela}>
        <thead className={estiloTabela.cabecalho}>
          <tr>
            <th className={estiloTabela.th}>{t("tituloDoContrato")}</th>
            {mostrarNegocio && <th className={estiloTabela.th}>{t("negocio")}</th>}
            <th className={estiloTabela.th}>{t("partes")}</th>
            <th className={estiloTabela.th}>{t("vigencia")}</th>
            <th className={estiloTabela.th}>{t("arquivos")}</th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => (
            <tr key={c.id} className={`${estiloTabela.linha} ${estiloTabela.linhaClicavel}`}>
              <td className={estiloTabela.td}>
                <a
                  href={`/contratos/${c.id}`}
                  className={`text-primary font-medium ${estiloTabela.linkDaLinha}`}
                >
                  {c.titulo}
                </a>
                <span className="text-muted block text-xs">{t(`tipos.${c.tipo}`)}</span>
              </td>
              {mostrarNegocio && <td className={`${estiloTabela.td} text-xs`}>{c.negocio ?? t("avulso")}</td>}
              <td className={`${estiloTabela.td} text-xs`}>
                <span className="block">{c.contratantes.join(", ")}</span>
                <span className="text-muted block">→ {c.contratadas.join(", ")}</span>
              </td>
              <td className={`${estiloTabela.td} text-xs whitespace-nowrap`}>
                {c.inicio || c.fim ? `${br(c.inicio)} – ${br(c.fim)}` : "—"}
                <span className={`block ${c.vigente ? "text-success" : "text-muted"}`}>
                  {c.vigente ? t("vigente") : t("naoVigente")}
                </span>
              </td>
              <td className={`${estiloTabela.td} text-xs`}>{c.arquivos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
