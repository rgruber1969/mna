"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { salvarCondicoesAcao } from "@/app/acoes/ofertas";
import { ratear, totalNominal } from "@/config/ofertas";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { Ajuda, Aviso } from "@/components/ui/basicos";
import { Janela } from "@/components/ui/janela";
import type { CondicoesDaOferta, CondicoesNaTela } from "@/server/services/ofertas";
import {
  EditorDeParcelas,
  EditorDeRateio,
  parcelaParaEnvio,
  parcelaParaFormulario,
  rateioInicial,
  type ParcelaNoFormulario,
} from "./campos";

const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
const rotulo = "text-text mb-1 block text-sm font-medium";
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCampo = (v: string | null) => (v === null ? "" : String(Number(v)).replace(".", ","));
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

type Valores = {
  instrumento: "informal" | "term_sheet" | "loi" | "mou";
  enterpriseValue: string;
  equityValue: string;
  parcelaVista: string;
  parcelas: ParcelaNoFormulario[];
  earnout: string;
  earnoutValor: string;
  retencao: string;
  retencaoValor: string;
  condicoesPrecedentes: string;
  garantiasCompradora: string;
  garantiasVendedora: string;
  correcaoParcelas: string;
  condicoesTransicao: string;
  exclusividade: string;
  naoConcorrencia: string;
  observacoes: string;
  rateio: { empresaId: string; percentual: string }[];
  criterioRateio: string;
};

const valoresDe = (c: CondicoesDaOferta, vendedoras: { id: string; nome: string }[]): Valores => ({
  instrumento: c.instrumento as Valores["instrumento"],
  enterpriseValue: paraCampo(c.enterpriseValue),
  equityValue: paraCampo(c.equityValue),
  parcelaVista: paraCampo(c.parcelaVista),
  parcelas: c.parcelas.map(parcelaParaFormulario),
  earnout: c.earnout ?? "",
  earnoutValor: paraCampo(c.earnoutValor),
  retencao: c.retencao ?? "",
  retencaoValor: paraCampo(c.retencaoValor),
  condicoesPrecedentes: c.condicoesPrecedentes ?? "",
  garantiasCompradora: c.garantiasCompradora ?? "",
  garantiasVendedora: c.garantiasVendedora ?? "",
  correcaoParcelas: c.correcaoParcelas ?? "",
  condicoesTransicao: c.condicoesTransicao ?? "",
  exclusividade: c.exclusividade ?? "",
  naoConcorrencia: c.naoConcorrencia ?? "",
  observacoes: c.observacoes ?? "",
  rateio: rateioInicial(vendedoras, c.rateio),
  criterioRateio: c.criterioRateio ?? "",
});

/**
 * Aba "Condições da oferta" do negócio: os atributos da oferta escolhida como
 * sugestão, ajustáveis por quem pode editar ofertas (lado vendedor), com o
 * botão "Oferta original" para consultar como estava na escolha.
 */
export function CondicoesDaOfertaEscolhida({ dealId, dados }: { dealId: string; dados: CondicoesNaTela }) {
  const t = useTranslations("ofertas");
  const tc = useTranslations("ofertas.condicoesDaOferta");
  const router = useRouter();
  const [v, setV] = useState<Valores>(() => valoresDe(dados.condicoes, dados.vendedoras));
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [verOriginal, setVerOriginal] = useState(false);
  const leitura = !dados.podeEditar;
  const mudar = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((x) => ({ ...x, [k]: valor }));
  const comRateio = dados.vendedoras.length > 1;
  const texto = (k: keyof Valores, longo = false) => (
    <label key={k} className={longo ? "sm:col-span-2" : ""}>
      <span className={rotulo}>{t(k as never)}</span>
      {longo ? (
        <textarea
          value={v[k] as string}
          disabled={leitura}
          onChange={(e) => mudar(k, e.target.value as never)}
          rows={2}
          maxLength={3000}
          className={campo}
        />
      ) : (
        <input
          value={v[k] as string}
          disabled={leitura}
          onChange={(e) => mudar(k, e.target.value as never)}
          className={campo}
        />
      )}
    </label>
  );
  const valor = (k: keyof Valores) => (
    <label key={k}>
      <span className={rotulo}>{t(k as never)}</span>
      <input
        inputMode="decimal"
        value={v[k] as string}
        disabled={leitura}
        onChange={(e) => mudar(k, e.target.value as never)}
        className={campo}
      />
    </label>
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setAviso(null);
    const r = await salvarCondicoesAcao(dealId, {
      ...v,
      parcelas: v.parcelas.map(parcelaParaEnvio),
      rateio: comRateio ? v.rateio : [],
      criterioRateio: comRateio ? v.criterioRateio : "",
    });
    setSalvando(false);
    if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
    setAviso({ tipo: "ok", texto: tc("salvas") });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-text flex items-center gap-1 text-base font-semibold">
            {tc("titulo")} <Ajuda texto={tc("ajuda")} />
          </h3>
          <p className="text-muted text-sm">
            {tc("origem", {
              origem: dados.origem,
              data: new Date(dados.escolhidaEm).toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              }),
              quem: dados.escolhidaPor ?? "—",
            })}
            {dados.alterada && <span className="text-warning ml-2 font-medium">· {tc("alterada")}</span>}
          </p>
          {leitura && <p className="text-muted text-xs">{tc("somenteConsulta")}</p>}
        </div>
        <button
          type="button"
          onClick={() => setVerOriginal(true)}
          className="border-border text-text hover:border-primary rounded-md border px-3 py-2 text-sm font-medium"
        >
          {tc("original")}
        </button>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <label className="block max-w-xs">
        <span className={rotulo}>{t("instrumento")}</span>
        <select
          value={v.instrumento}
          disabled={leitura}
          onChange={(e) => mudar("instrumento", e.target.value as Valores["instrumento"])}
          className={campo}
        >
          {(["informal", "term_sheet", "loi", "mou"] as const).map((x) => (
            <option key={x} value={x}>
              {t(`instrumentos.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <Abas
        parametro="secao"
        abas={[
          { id: "valores", rotulo: t("abas.valores") },
          { id: "condicoes", rotulo: t("abas.condicoes") },
          { id: "garantias", rotulo: t("abas.garantias") },
          ...(comRateio ? [{ id: "rateio", rotulo: t("abas.rateio") }] : []),
        ]}
      >
        <PainelDeAba id="valores">
          <div className="grid gap-4 sm:grid-cols-3">
            {valor("enterpriseValue")}
            {valor("equityValue")}
            {valor("parcelaVista")}
            <div className="sm:col-span-3">
              <EditorDeParcelas
                parcelas={v.parcelas}
                mudar={(p) => mudar("parcelas", p)}
                previsao={dados.previsaoFechamento}
                somenteLeitura={leitura}
              />
            </div>
            {texto("earnout")}
            {valor("earnoutValor")}
            <span className="hidden sm:block" />
            {texto("retencao")}
            {valor("retencaoValor")}
          </div>
        </PainelDeAba>
        <PainelDeAba id="condicoes">
          <div className="grid gap-4 sm:grid-cols-2">
            {texto("condicoesPrecedentes", true)}
            {texto("correcaoParcelas", true)}
            {texto("condicoesTransicao", true)}
            {texto("observacoes", true)}
          </div>
        </PainelDeAba>
        <PainelDeAba id="garantias">
          <div className="grid gap-4 sm:grid-cols-2">
            {texto("garantiasCompradora", true)}
            {texto("garantiasVendedora", true)}
            {texto("exclusividade")}
            {texto("naoConcorrencia")}
          </div>
        </PainelDeAba>
        {comRateio && (
          <PainelDeAba id="rateio">
            <EditorDeRateio
              vendedoras={dados.vendedoras}
              rateio={v.rateio}
              criterio={v.criterioRateio}
              mudarRateio={(r) => mudar("rateio", r)}
              mudarCriterio={(c) => mudar("criterioRateio", c)}
              somenteLeitura={leitura}
            />
          </PainelDeAba>
        )}
      </Abas>
      {!leitura && (
        <button
          disabled={salvando}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {salvando ? tc("salvando") : tc("salvar")}
        </button>
      )}
      {verOriginal && (
        <Janela
          titulo={tc("originalTitulo")}
          rotuloFechar={tc("fechar")}
          fechar={() => setVerOriginal(false)}
        >
          <OfertaOriginal c={dados.original} vendedoras={dados.vendedoras} />
        </Janela>
      )}
    </form>
  );
}

/** Consulta das condições como estavam no momento da escolha. */
function OfertaOriginal({
  c,
  vendedoras,
}: {
  c: CondicoesDaOferta;
  vendedoras: { id: string; nome: string }[];
}) {
  const t = useTranslations("ofertas");
  const linhas: [string, string | null][] = [
    [t("compradora"), c.compradora],
    [t("data"), br(c.data)],
    [t("instrumento"), t(`instrumentos.${c.instrumento}` as never)],
    [t("enterpriseValue"), c.enterpriseValue && moeda(Number(c.enterpriseValue))],
    [t("equityValue"), c.equityValue && moeda(Number(c.equityValue))],
    [t("parcelaVista"), c.parcelaVista && moeda(Number(c.parcelaVista))],
    [
      t("parcelas"),
      c.parcelas.length
        ? c.parcelas
            .map(
              (p) =>
                `${p.meses ? t("mesesAposClosingCurto", { n: p.meses }) : br(p.data)}: ${moeda(Number(p.valor))}`,
            )
            .join("\n")
        : null,
    ],
    [
      t("earnout"),
      [c.earnout, c.earnoutValor && moeda(Number(c.earnoutValor))].filter(Boolean).join("\n") || null,
    ],
    [
      t("retencao"),
      [c.retencao, c.retencaoValor && moeda(Number(c.retencaoValor))].filter(Boolean).join("\n") || null,
    ],
    [t("condicoesPrecedentes"), c.condicoesPrecedentes],
    [t("correcaoParcelas"), c.correcaoParcelas],
    [t("condicoesTransicao"), c.condicoesTransicao],
    [t("garantiasCompradora"), c.garantiasCompradora],
    [t("garantiasVendedora"), c.garantiasVendedora],
    [t("exclusividade"), c.exclusividade],
    [t("naoConcorrencia"), c.naoConcorrencia],
    [t("observacoes"), c.observacoes],
    [
      t("rateio"),
      c.rateio.length > 1
        ? ratear(totalNominal({ ...c, data: c.data }), c.rateio)
            .map(
              (r) =>
                `${vendedoras.find((v) => v.id === r.empresaId)?.nome ?? "—"}: ${r.percentual.toLocaleString("pt-BR")}% · ${moeda(r.valor)}`,
            )
            .join("\n") + (c.criterioRateio ? `\n${t("criterio")}: ${c.criterioRateio}` : "")
        : null,
    ],
  ];
  return (
    <dl className="divide-border divide-y text-sm">
      {linhas
        .filter(([, valor]) => valor)
        .map(([r, valor]) => (
          <div key={r} className="grid gap-2 py-2 sm:grid-cols-[14rem_1fr]">
            <dt className="text-muted">{r}</dt>
            <dd className="text-text whitespace-pre-line">{valor}</dd>
          </div>
        ))}
    </dl>
  );
}
