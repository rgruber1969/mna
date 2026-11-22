"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  concluirArquivoDaOfertaAcao,
  excluirOfertaAcao,
  iniciarArquivoDaOfertaAcao,
  linkDoArquivoDaOfertaAcao,
  salvarOfertaAcao,
  salvarRateioAcao,
} from "@/app/acoes/ofertas";
import { lerNumero, ratear, totalNominal, valorPresente } from "@/config/ofertas";
import { Ajuda, Aviso, estiloTabela } from "@/components/ui/basicos";
import type { OfertaNaTela, OfertasDoNegocio, OpcoesDaOferta } from "@/server/services/ofertas";

const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
const rotulo = "text-text mb-1 block text-sm font-medium";
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
const paraCampo = (v: string | null) => (v === null ? "" : String(Number(v)).replace(".", ","));

type Valores = {
  compradoraId: string;
  anteriorId: string;
  data: string;
  instrumento: OfertaNaTela["instrumento"];
  enterpriseValue: string;
  equityValue: string;
  parcelaVista: string;
  parcelas: { valor: string; data: string }[];
  earnout: string;
  earnoutValor: string;
  retencao: string;
  retencaoValor: string;
  condicoesPrecedentes: string;
  validade: string;
  garantiasCompradora: string;
  garantiasVendedora: string;
  correcaoParcelas: string;
  condicoesTransicao: string;
  exclusividade: string;
  naoConcorrencia: string;
  observacoes: string;
  rateio: { empresaId: string; percentual: string }[];
  criterioRateio: string;
  perfis: string[];
  usuarios: string[];
};

const TEXTOS_LONGOS = [
  "condicoesPrecedentes",
  "garantiasCompradora",
  "garantiasVendedora",
  "condicoesTransicao",
  "correcaoParcelas",
] as const;

function valoresDe(o: OfertaNaTela | null, opcoes: OpcoesDaOferta): Valores {
  const hoje = new Date().toISOString().slice(0, 10);
  if (!o)
    return {
      compradoraId: opcoes.compradoras.length === 1 ? opcoes.compradoras[0].id : "",
      anteriorId: "",
      data: hoje,
      instrumento: "informal",
      enterpriseValue: "",
      equityValue: "",
      parcelaVista: "",
      parcelas: [],
      earnout: "",
      earnoutValor: "",
      retencao: "",
      retencaoValor: "",
      condicoesPrecedentes: "",
      validade: "",
      garantiasCompradora: "",
      garantiasVendedora: "",
      correcaoParcelas: "",
      condicoesTransicao: "",
      exclusividade: "",
      naoConcorrencia: "",
      observacoes: "",
      rateio: [],
      criterioRateio: "",
      perfis: [],
      usuarios: opcoes.meuLado,
    };
  return {
    compradoraId: o.compradoraId,
    anteriorId: o.anteriorId ?? "",
    data: o.data,
    instrumento: o.instrumento,
    enterpriseValue: paraCampo(o.enterpriseValue),
    equityValue: paraCampo(o.equityValue),
    parcelaVista: paraCampo(o.parcelaVista),
    parcelas: o.parcelas.map((p) => ({ valor: paraCampo(p.valor), data: p.data })),
    earnout: o.earnout ?? "",
    earnoutValor: paraCampo(o.earnoutValor),
    retencao: o.retencao ?? "",
    retencaoValor: paraCampo(o.retencaoValor),
    condicoesPrecedentes: o.condicoesPrecedentes ?? "",
    validade: o.validade ?? "",
    garantiasCompradora: o.garantiasCompradora ?? "",
    garantiasVendedora: o.garantiasVendedora ?? "",
    correcaoParcelas: o.correcaoParcelas ?? "",
    condicoesTransicao: o.condicoesTransicao ?? "",
    exclusividade: o.exclusividade ?? "",
    naoConcorrencia: o.naoConcorrencia ?? "",
    observacoes: o.observacoes ?? "",
    rateio: o.rateioProprio
      ? o.rateio.map((r) => ({ empresaId: r.empresaId, percentual: paraCampo(r.percentual) }))
      : [],
    criterioRateio: o.rateioProprio ? (o.criterioRateio ?? "") : "",
    perfis: o.acessoIds.perfis,
    usuarios: o.acessoIds.usuarios,
  };
}

function Marcas({
  titulo,
  opcoes,
  escolhidas,
  mudar,
}: {
  titulo: string;
  opcoes: { id: string; nome: string }[];
  escolhidas: string[];
  mudar: (ids: string[]) => void;
}) {
  if (opcoes.length === 0) return null;
  return (
    <div>
      <span className="text-muted mb-1 block text-xs font-medium uppercase">{titulo}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {opcoes.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={escolhidas.includes(o.id)}
              onChange={(e) =>
                mudar(e.target.checked ? [...escolhidas, o.id] : escolhidas.filter((x) => x !== o.id))
              }
            />
            {o.nome}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Cadastro e edição da oferta (O1, O2, O4). */
function FormOferta({
  dealId,
  oferta,
  opcoes,
  ofertas,
  fechar,
}: {
  dealId: string;
  oferta: OfertaNaTela | null;
  opcoes: OpcoesDaOferta;
  ofertas: OfertaNaTela[];
  fechar: (salvou: boolean) => void;
}) {
  const t = useTranslations("ofertas");
  const [v, setV] = useState<Valores>(() => valoresDe(oferta, opcoes));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [rateioProprio, setRateioProprio] = useState(Boolean(oferta?.rateioProprio));
  const mudar = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((x) => ({ ...x, [k]: valor }));
  const anteriores = ofertas.filter((o) => o.compradoraId === v.compradoraId && o.id !== oferta?.id);
  const texto = (k: keyof Valores, longo = false) => (
    <label key={k} className={longo ? "sm:col-span-2" : ""}>
      <span className={rotulo}>{t(k as never)}</span>
      {longo ? (
        <textarea
          value={v[k] as string}
          onChange={(e) => mudar(k, e.target.value as never)}
          rows={2}
          maxLength={3000}
          className={campo}
        />
      ) : (
        <input value={v[k] as string} onChange={(e) => mudar(k, e.target.value as never)} className={campo} />
      )}
    </label>
  );
  const valor = (k: keyof Valores) => (
    <label key={k}>
      <span className={rotulo}>{t(k as never)}</span>
      <input
        inputMode="decimal"
        value={v[k] as string}
        onChange={(e) => mudar(k, e.target.value as never)}
        className={campo}
      />
    </label>
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarOfertaAcao(dealId, oferta?.id ?? null, {
      ...v,
      rateio: rateioProprio ? v.rateio : [],
      criterioRateio: rateioProprio ? v.criterioRateio : "",
    });
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    fechar(true);
  }

  return (
    <form onSubmit={salvar} className="border-border bg-background mb-4 space-y-4 rounded-md border p-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={rotulo}>{t("compradora")}</span>
          <select
            value={v.compradoraId}
            onChange={(e) => setV((x) => ({ ...x, compradoraId: e.target.value, anteriorId: "" }))}
            required
            className={campo}
          >
            <option value="">{t("escolha")}</option>
            {opcoes.compradoras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>{t("anterior")}</span>
          <select
            value={v.anteriorId}
            onChange={(e) => mudar("anteriorId", e.target.value)}
            className={campo}
          >
            <option value="">{t("nenhumaAnterior")}</option>
            {anteriores.map((o) => (
              <option key={o.id} value={o.id}>
                {t("rodada", { n: o.rodada })} · {br(o.data)} · {moeda(totalNominal(o))}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>{t("data")}</span>
          <input
            type="date"
            required
            value={v.data}
            onChange={(e) => mudar("data", e.target.value)}
            className={campo}
          />
        </label>
        <label>
          <span className={rotulo}>{t("instrumento")}</span>
          <select
            value={v.instrumento}
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
      </div>
      <fieldset className="border-border grid gap-4 rounded-md border p-3 sm:grid-cols-2">
        <legend className="text-text px-1 text-sm font-medium">{t("valores")}</legend>
        {valor("enterpriseValue")}
        {valor("equityValue")}
        {valor("parcelaVista")}
        <div className="sm:col-span-2">
          <span className={rotulo}>{t("parcelas")}</span>
          {v.parcelas.map((p, i) => (
            <div key={i} className="mb-2 flex flex-wrap items-end gap-2">
              <label className="w-44">
                <span className="text-muted block text-xs">{t("parcela", { n: i + 1 })}</span>
                <input
                  inputMode="decimal"
                  value={p.valor}
                  aria-label={`${t("parcela", { n: i + 1 })}: ${t("valor")}`}
                  onChange={(e) =>
                    mudar(
                      "parcelas",
                      v.parcelas.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)),
                    )
                  }
                  className={campo}
                />
              </label>
              <label className="w-44">
                <span className="text-muted block text-xs">{t("vencimento")}</span>
                <input
                  type="date"
                  value={p.data}
                  aria-label={`${t("parcela", { n: i + 1 })}: ${t("vencimento")}`}
                  onChange={(e) =>
                    mudar(
                      "parcelas",
                      v.parcelas.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)),
                    )
                  }
                  className={campo}
                />
              </label>
              <button
                type="button"
                aria-label={t("tirarParcela", { n: i + 1 })}
                onClick={() =>
                  mudar(
                    "parcelas",
                    v.parcelas.filter((_, j) => j !== i),
                  )
                }
                className="text-danger px-2 py-2 text-sm"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => mudar("parcelas", [...v.parcelas, { valor: "", data: "" }])}
            className="text-primary text-sm font-medium"
          >
            {t("incluirParcela")}
          </button>
        </div>
        {texto("earnout")}
        {valor("earnoutValor")}
        {texto("retencao")}
        {valor("retencaoValor")}
      </fieldset>
      <fieldset className="border-border grid gap-4 rounded-md border p-3 sm:grid-cols-2">
        <legend className="text-text px-1 text-sm font-medium">{t("condicoes")}</legend>
        <label>
          <span className={rotulo}>{t("validade")}</span>
          <input
            type="date"
            value={v.validade}
            onChange={(e) => mudar("validade", e.target.value)}
            className={campo}
          />
        </label>
        {texto("exclusividade")}
        {texto("naoConcorrencia")}
        {TEXTOS_LONGOS.map((k) => texto(k, true))}
        {texto("observacoes", true)}
      </fieldset>
      {opcoes.vendedoras.length > 1 && (
        <fieldset className="border-border space-y-2 rounded-md border p-3">
          <legend className="text-text px-1 text-sm font-medium">{t("rateio")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rateioProprio}
              onChange={(e) => setRateioProprio(e.target.checked)}
            />
            {t("rateioProprio")}
          </label>
          {rateioProprio && (
            <>
              {opcoes.vendedoras.map((vd) => (
                <label key={vd.id} className="flex items-center gap-2 text-sm">
                  <span className="w-64">{vd.nome}</span>
                  <input
                    inputMode="decimal"
                    aria-label={`${vd.nome} ${t("percentual")}`}
                    value={v.rateio.find((r) => r.empresaId === vd.id)?.percentual ?? ""}
                    onChange={(e) =>
                      mudar("rateio", [
                        ...v.rateio.filter((r) => r.empresaId !== vd.id),
                        { empresaId: vd.id, percentual: e.target.value },
                      ])
                    }
                    className={`${campo} w-24`}
                  />
                  %
                </label>
              ))}
              {texto("criterioRateio")}
            </>
          )}
        </fieldset>
      )}
      {(opcoes.perfis.length > 0 || opcoes.usuarios.length > 0) && (
        <fieldset className="border-border space-y-3 rounded-md border p-3">
          <legend className="text-text px-1 text-sm font-medium">{t("quemVe")}</legend>
          <Marcas
            titulo={t("perfis")}
            opcoes={opcoes.perfis}
            escolhidas={v.perfis}
            mudar={(x) => mudar("perfis", x)}
          />
          <Marcas
            titulo={t("usuarios")}
            opcoes={opcoes.usuarios}
            escolhidas={v.usuarios}
            mudar={(x) => mudar("usuarios", x)}
          />
        </fieldset>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          {t("salvar")}
        </button>
        <button type="button" onClick={() => fechar(false)} className="text-muted px-2 text-sm">
          {t("cancelar")}
        </button>
      </div>
    </form>
  );
}

/** Rateio do negócio entre as vendedoras (O4). */
function RateioDoNegocio({ dealId, dados }: { dealId: string; dados: OfertasDoNegocio }) {
  const t = useTranslations("ofertas");
  const router = useRouter();
  const lista = dados.rateioDoNegocio ?? [];
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(lista.map((v) => [v.empresaId, paraCampo(v.percentual)])),
  );
  const [criterio, setCriterio] = useState(dados.criterioDoNegocio ?? "");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  if (lista.length < 2) return null;
  if (!dados.podeEditarRateio)
    return (
      <p className="text-muted mb-3 text-sm">
        {t("rateioDoNegocio")}:{" "}
        {lista.some((v) => v.percentual)
          ? lista.map((v) => `${v.nome} ${paraCampo(v.percentual)}%`).join(" · ")
          : t("semRateio")}
        {dados.criterioDoNegocio && ` (${dados.criterioDoNegocio})`}
      </p>
    );
  return (
    <details className="border-border mb-4 rounded-md border p-3">
      <summary className="text-text cursor-pointer text-sm font-medium">{t("rateioDoNegocio")}</summary>
      {aviso && <Aviso tipo={aviso.ok ? "ok" : "erro"}>{aviso.texto}</Aviso>}
      <div className="mt-2 space-y-2">
        {lista.map((vd) => (
          <label key={vd.empresaId} className="flex items-center gap-2 text-sm">
            <span className="w-64">{vd.nome}</span>
            <input
              inputMode="decimal"
              aria-label={`${vd.nome} ${t("percentual")}`}
              value={valores[vd.empresaId] ?? ""}
              onChange={(e) => setValores((x) => ({ ...x, [vd.empresaId]: e.target.value }))}
              className={`${campo} w-24`}
            />
            %
          </label>
        ))}
        <label className="block">
          <span className={rotulo}>{t("criterio")}</span>
          <input
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            placeholder={t("criterioDica")}
            className={campo}
          />
        </label>
        <button
          type="button"
          className="border-primary text-primary rounded-md border px-3 py-1.5 text-sm font-medium"
          onClick={async () => {
            const r = await salvarRateioAcao(dealId, {
              percentuais: lista.map((vd) => ({
                empresaId: vd.empresaId,
                percentual: valores[vd.empresaId] ?? "",
              })),
              criterio,
            });
            setAviso(r.erro ? { ok: false, texto: r.erro } : { ok: true, texto: t("rateioSalvo") });
            if (!r.erro) router.refresh();
          }}
        >
          {t("salvarRateio")}
        </button>
      </div>
    </details>
  );
}

/** Comparação lado a lado (O3): total, valor presente pela taxa e parte de cada vendedora. */
function Comparacao({ ofertas }: { ofertas: OfertaNaTela[] }) {
  const t = useTranslations("ofertas");
  const [taxa, setTaxa] = useState("12");
  const taxaNum = Number(lerNumero(taxa) ?? "0") || 0;
  const comRateio = ofertas.some((o) => o.rateio.length > 1);
  return (
    <section className="mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text text-sm font-semibold">{t("comparacao")}</h3>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t("taxa")}</span>
          <input
            inputMode="decimal"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            className={`${campo} w-20`}
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className={estiloTabela.tabela}>
          <thead className={estiloTabela.cabecalho}>
            <tr>
              <th className={estiloTabela.th}>{t("compradora")}</th>
              <th className={estiloTabela.th}>{t("instrumento")}</th>
              <th className={estiloTabela.th}>{t("total")}</th>
              <th className={estiloTabela.th}>{t("valorPresente")}</th>
              {comRateio && <th className={estiloTabela.th}>{t("porVendedora")}</th>}
            </tr>
          </thead>
          <tbody>
            {ofertas.map((o) => {
              const vp = valorPresente(o, taxaNum);
              return (
                <tr key={o.id} className={estiloTabela.linha}>
                  <td className={estiloTabela.td}>
                    {o.compradora}
                    <span className="text-muted block text-xs">
                      {t("rodada", { n: o.rodada })} · {br(o.data)}
                    </span>
                  </td>
                  <td className={`${estiloTabela.td} text-xs`}>{t(`instrumentos.${o.instrumento}`)}</td>
                  <td className={`${estiloTabela.td} whitespace-nowrap`}>{moeda(totalNominal(o))}</td>
                  <td className={`${estiloTabela.td} font-medium whitespace-nowrap`}>{moeda(vp)}</td>
                  {comRateio && (
                    <td className={`${estiloTabela.td} text-xs`}>
                      {ratear(vp, o.rateio).map((r) => (
                        <span key={r.empresaId} className="block whitespace-nowrap">
                          {o.rateio.find((x) => x.empresaId === r.empresaId)?.nome}: {moeda(r.valor)}
                        </span>
                      ))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Detalhe({ rotuloTexto, valor }: { rotuloTexto: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="grid gap-1 py-1 sm:grid-cols-[16rem_1fr]">
      <dt className="text-muted text-xs">{rotuloTexto}</dt>
      <dd className="text-text text-sm whitespace-pre-line">{valor}</dd>
    </div>
  );
}

/** Arquivos da oferta: envio conferido e download auditado. */
function ArquivosDaOferta({ oferta, aoMudar }: { oferta: OfertaNaTela; aoMudar: () => void }) {
  const t = useTranslations("ofertas");
  const td = useTranslations("documentos");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    const i = await iniciarArquivoDaOfertaAcao(oferta.id, {
      nomeArquivo: arquivo.name,
      tamanho: arquivo.size,
    });
    if (i.erro || !i.url || !i.arquivoId) {
      setEnviando(false);
      return setErro(i.erro ?? td("erros.envioIncompleto"));
    }
    const envio = await fetch(i.url, {
      method: "PUT",
      body: arquivo,
      headers: { "content-type": "application/octet-stream" },
    }).catch(() => null);
    const fim = envio?.ok
      ? await concluirArquivoDaOfertaAcao(i.arquivoId)
      : { erro: td("erros.envioIncompleto") };
    setEnviando(false);
    if (fim.erro) return setErro(fim.erro);
    aoMudar();
  }
  return (
    <div className="mt-2">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted text-xs font-medium uppercase">{t("arquivos")}</span>
        {oferta.arquivos.map((x) => (
          <button
            key={x.id}
            type="button"
            disabled={x.situacao !== "disponivel"}
            className="text-primary underline disabled:no-underline disabled:opacity-60"
            onClick={async () => {
              const r = await linkDoArquivoDaOfertaAcao(x.id);
              if (r.erro || !r.url) return setErro(r.erro ?? td("erros.download"));
              window.location.assign(r.url);
            }}
          >
            📎 {x.nomeArquivo}
          </button>
        ))}
        {oferta.podeEditar && (
          <label className="border-primary text-primary cursor-pointer rounded-md border px-2 py-1 text-xs font-medium">
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
        )}
      </div>
    </div>
  );
}

/** Aba Ofertas do negócio (item 32). */
export function AbaDeOfertas({
  dealId,
  dados,
  opcoes,
}: {
  dealId: string;
  dados: OfertasDoNegocio;
  opcoes: OpcoesDaOferta | null;
}) {
  const t = useTranslations("ofertas");
  const router = useRouter();
  const [editando, setEditando] = useState<OfertaNaTela | "nova" | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const atualizar = () => router.refresh();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Ajuda texto={t("ajuda")} />
        </span>
        {dados.podeCriar && opcoes && !editando && (
          <button
            type="button"
            onClick={() => {
              setOk(null);
              setEditando("nova");
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t("nova")}
          </button>
        )}
      </div>
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      {editando && opcoes && (
        <FormOferta
          dealId={dealId}
          oferta={editando === "nova" ? null : editando}
          opcoes={opcoes}
          ofertas={dados.ofertas}
          fechar={(salvou) => {
            setEditando(null);
            if (salvou) {
              setOk(t("salva"));
              atualizar();
            }
          }}
        />
      )}
      <RateioDoNegocio dealId={dealId} dados={dados} />
      {dados.completa && dados.ofertas.length > 1 && <Comparacao ofertas={dados.ofertas} />}
      {dados.ofertas.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhuma")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={estiloTabela.tabela}>
            <thead className={estiloTabela.cabecalho}>
              <tr>
                <th className={estiloTabela.th}>{t("compradora")}</th>
                <th className={estiloTabela.th}>{t("data")}</th>
                <th className={estiloTabela.th}>{t("instrumento")}</th>
                <th className={estiloTabela.th}>{t("total")}</th>
                <th className={estiloTabela.th}></th>
              </tr>
            </thead>
            <tbody>
              {dados.ofertas.map((o) => (
                <Fragment key={o.id}>
                  <tr className={estiloTabela.linha}>
                    <td className={estiloTabela.td}>
                      <button
                        type="button"
                        aria-expanded={aberta === o.id}
                        onClick={() => setAberta((x) => (x === o.id ? null : o.id))}
                        className="text-text text-left font-medium"
                      >
                        {aberta === o.id ? "▾" : "▸"} {o.compradora}
                      </button>
                      <span className="text-muted block text-xs">{t("rodada", { n: o.rodada })}</span>
                    </td>
                    <td className={`${estiloTabela.td} text-xs whitespace-nowrap`}>{br(o.data)}</td>
                    <td className={`${estiloTabela.td} text-xs`}>{t(`instrumentos.${o.instrumento}`)}</td>
                    <td className={`${estiloTabela.td} whitespace-nowrap`}>{moeda(totalNominal(o))}</td>
                    <td className={`${estiloTabela.td} whitespace-nowrap`}>
                      <span className="flex gap-3 text-xs">
                        {o.podeEditar && !editando && (
                          <button type="button" className="text-primary" onClick={() => setEditando(o)}>
                            {t("editar")}
                          </button>
                        )}
                        {o.podeExcluir && (
                          <button
                            type="button"
                            className="text-danger"
                            onClick={async () => {
                              if (!confirm(t("confirmarExcluir"))) return;
                              const r = await excluirOfertaAcao(o.id);
                              if (r.erro) return setErro(r.erro);
                              atualizar();
                            }}
                          >
                            {t("excluir")}
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                  {aberta === o.id && (
                    <tr>
                      <td colSpan={5} className="bg-background px-4 py-3">
                        <dl>
                          <Detalhe
                            rotuloTexto={t("enterpriseValue")}
                            valor={o.enterpriseValue && moeda(Number(o.enterpriseValue))}
                          />
                          <Detalhe
                            rotuloTexto={t("equityValue")}
                            valor={o.equityValue && moeda(Number(o.equityValue))}
                          />
                          <Detalhe
                            rotuloTexto={t("parcelaVista")}
                            valor={o.parcelaVista && moeda(Number(o.parcelaVista))}
                          />
                          <Detalhe
                            rotuloTexto={t("parcelas")}
                            valor={
                              o.parcelas.length
                                ? o.parcelas.map((p) => `${br(p.data)}: ${moeda(Number(p.valor))}`).join("\n")
                                : null
                            }
                          />
                          <Detalhe rotuloTexto={t("correcaoParcelas")} valor={o.correcaoParcelas} />
                          <Detalhe
                            rotuloTexto={t("earnout")}
                            valor={
                              [o.earnout, o.earnoutValor && moeda(Number(o.earnoutValor))]
                                .filter(Boolean)
                                .join("\n") || null
                            }
                          />
                          <Detalhe
                            rotuloTexto={t("retencao")}
                            valor={
                              [o.retencao, o.retencaoValor && moeda(Number(o.retencaoValor))]
                                .filter(Boolean)
                                .join("\n") || null
                            }
                          />
                          <Detalhe rotuloTexto={t("validade")} valor={br(o.validade) || null} />
                          <Detalhe rotuloTexto={t("condicoesPrecedentes")} valor={o.condicoesPrecedentes} />
                          <Detalhe rotuloTexto={t("garantiasCompradora")} valor={o.garantiasCompradora} />
                          <Detalhe rotuloTexto={t("garantiasVendedora")} valor={o.garantiasVendedora} />
                          <Detalhe rotuloTexto={t("condicoesTransicao")} valor={o.condicoesTransicao} />
                          <Detalhe rotuloTexto={t("exclusividade")} valor={o.exclusividade} />
                          <Detalhe rotuloTexto={t("naoConcorrencia")} valor={o.naoConcorrencia} />
                          <Detalhe rotuloTexto={t("observacoes")} valor={o.observacoes} />
                          <Detalhe
                            rotuloTexto={t("rateio")}
                            valor={
                              o.rateio.length > 1
                                ? ratear(totalNominal(o), o.rateio)
                                    .map(
                                      (r) =>
                                        `${o.rateio.find((x) => x.empresaId === r.empresaId)?.nome}: ${r.percentual.toLocaleString("pt-BR")}% · ${moeda(r.valor)}`,
                                    )
                                    .join("\n") +
                                  (o.criterioRateio ? `\n${t("criterio")}: ${o.criterioRateio}` : "")
                                : null
                            }
                          />
                          <Detalhe
                            rotuloTexto={t("quemVe")}
                            valor={o.acesso.length ? o.acesso.join(", ") : null}
                          />
                        </dl>
                        <p className="text-muted mt-1 text-xs">
                          {t("registradaPor", {
                            nome: o.criadoPor ?? "—",
                            data: new Date(o.criadoEm).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              dateStyle: "short",
                              timeStyle: "short",
                            }),
                          })}
                        </p>
                        <ArquivosDaOferta oferta={o} aoMudar={atualizar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
