"use client";

import { hojeNoBrasil } from "@/config/prazos";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  concluirArquivoDaOfertaAcao,
  excluirOfertaAcao,
  iniciarArquivoDaOfertaAcao,
  linkDoArquivoDaOfertaAcao,
  salvarOfertaAcao,
  aceitarOfertaAcao,
} from "@/app/acoes/ofertas";
import { lerNumero, ratear, totalNominal, valorPresente } from "@/config/ofertas";
import { Abas, PainelDeAba, useAbas } from "@/components/ui/abas";
import {
  EditorDeParcelas,
  EditorDeRateio,
  parcelaParaEnvio,
  parcelaParaFormulario,
  rateioInicial,
  type ParcelaNoFormulario,
} from "./campos";
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
  parcelas: ParcelaNoFormulario[];
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

function valoresDe(o: OfertaNaTela | null, opcoes: OpcoesDaOferta): Valores {
  const hoje = hojeNoBrasil();
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
      rateio: rateioInicial(opcoes.vendedoras, []),
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
    parcelas: o.parcelas.map(parcelaParaFormulario),
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
    rateio: rateioInicial(opcoes.vendedoras, o.rateio),
    criterioRateio: o.criterioRateio ?? "",
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

/** Cadastro e edição da oferta (O1, O2, O4), em abas. */
function FormOferta({
  dealId,
  oferta,
  opcoes,
  ofertas,
  previsao,
  fechar,
}: {
  dealId: string;
  oferta: OfertaNaTela | null;
  opcoes: OpcoesDaOferta;
  ofertas: OfertaNaTela[];
  previsao: string | null;
  fechar: (salvou: boolean) => void;
}) {
  const t = useTranslations("ofertas");
  const [v, setV] = useState<Valores>(() => valoresDe(oferta, opcoes));
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
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
  const comRateio = opcoes.vendedoras.length > 1;
  const comAcesso = opcoes.perfis.length > 0 || opcoes.usuarios.length > 0;
  const abas = [
    { id: "valores", rotulo: t("abas.valores") },
    { id: "condicoes", rotulo: t("abas.condicoes") },
    { id: "garantias", rotulo: t("abas.garantias") },
    ...(comRateio ? [{ id: "rateio", rotulo: t("abas.rateio") }] : []),
    ...(comAcesso ? [{ id: "acesso", rotulo: t("abas.acesso") }] : []),
  ];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarOfertaAcao(dealId, oferta?.id ?? null, {
      ...v,
      parcelas: v.parcelas.map(parcelaParaEnvio),
      rateio: comRateio ? v.rateio : [],
      criterioRateio: comRateio ? v.criterioRateio : "",
    });
    setSalvando(false);
    if (r.erro) return setErro({ texto: r.erro, campo: r.campo });
    fechar(true);
  }

  return (
    <form onSubmit={salvar} className="border-border bg-background mb-4 space-y-4 rounded-md border p-4">
      {erro && <Aviso>{erro.texto}</Aviso>}
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="sm:col-span-2">
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
        <label className="sm:col-span-2">
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
        <label>
          <span className={rotulo}>{t("validade")}</span>
          <input
            type="date"
            value={v.validade}
            onChange={(e) => mudar("validade", e.target.value)}
            className={campo}
          />
        </label>
      </div>
      <Abas parametro="secao" abas={abas}>
        <AbrirAbaDaOferta campo={erro?.campo} />
        <PainelDeAba id="valores">
          <div className="grid gap-4 sm:grid-cols-3">
            {valor("enterpriseValue")}
            {valor("equityValue")}
            {valor("parcelaVista")}
            <div className="sm:col-span-3">
              <EditorDeParcelas
                parcelas={v.parcelas}
                mudar={(p) => mudar("parcelas", p)}
                previsao={previsao}
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
              vendedoras={opcoes.vendedoras}
              rateio={v.rateio}
              criterio={v.criterioRateio}
              mudarRateio={(r) => mudar("rateio", r)}
              mudarCriterio={(c) => mudar("criterioRateio", c)}
            />
          </PainelDeAba>
        )}
        {comAcesso && (
          <PainelDeAba id="acesso">
            <div className="space-y-3">
              <p className="text-muted text-xs">{t("quemVe")}</p>
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
            </div>
          </PainelDeAba>
        )}
      </Abas>
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

/** Erro num campo de outra aba: abre a aba dele. */
const ABA_DO_CAMPO: Record<string, string> = {
  enterpriseValue: "valores",
  equityValue: "valores",
  parcelaVista: "valores",
  parcelas: "valores",
  earnoutValor: "valores",
  retencaoValor: "valores",
  rateio: "rateio",
};
function AbrirAbaDaOferta({ campo }: { campo?: string }) {
  const abas = useAbas();
  useEffect(() => {
    if (campo && ABA_DO_CAMPO[campo]) abas?.ativar(ABA_DO_CAMPO[campo]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o erro muda
  }, [campo]);
  return null;
}

/** Comparação lado a lado (O3): total, valor presente pela taxa e parte de cada vendedora. */
function Comparacao({ ofertas, previsao }: { ofertas: OfertaNaTela[]; previsao: string | null }) {
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
              const vp = valorPresente(o, taxaNum, previsao);
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
          previsao={dados.previsaoFechamento}
          fechar={(salvou) => {
            setEditando(null);
            if (salvou) {
              setOk(t("salva"));
              atualizar();
            }
          }}
        />
      )}
      {dados.completa && dados.ofertas.length > 1 && (
        <Comparacao ofertas={dados.ofertas} previsao={dados.previsaoFechamento} />
      )}
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
                      <span className="text-muted block text-xs">
                        {t("rodada", { n: o.rodada })}
                        {o.aceita && (
                          <span className="text-success ml-2 font-semibold">{t("escolhida")}</span>
                        )}
                      </span>
                    </td>
                    <td className={`${estiloTabela.td} text-xs whitespace-nowrap`}>{br(o.data)}</td>
                    <td className={`${estiloTabela.td} text-xs`}>{t(`instrumentos.${o.instrumento}`)}</td>
                    <td className={`${estiloTabela.td} whitespace-nowrap`}>{moeda(totalNominal(o))}</td>
                    <td className={`${estiloTabela.td} whitespace-nowrap`}>
                      <span className="flex gap-3 text-xs">
                        {dados.podeAceitar && !o.aceita && (
                          <button
                            type="button"
                            className="text-primary font-semibold"
                            onClick={async () => {
                              const jaHa = dados.ofertas.some((x) => x.aceita);
                              if (
                                !confirm(
                                  t(jaHa ? "confirmarTrocarEscolha" : "confirmarEscolher", {
                                    compradora: o.compradora,
                                  }),
                                )
                              )
                                return;
                              const r = await aceitarOfertaAcao(o.id);
                              if (r.erro) return setErro(r.erro);
                              setOk(t(r.funil ? "escolhidaComFunil" : "escolhidaSemFunil"));
                              atualizar();
                            }}
                          >
                            {t("escolher")}
                          </button>
                        )}
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
                                ? o.parcelas
                                    .map(
                                      (p) =>
                                        `${p.meses ? t("mesesAposClosingCurto", { n: p.meses }) : br(p.data)}: ${moeda(Number(p.valor))}`,
                                    )
                                    .join("\n")
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
