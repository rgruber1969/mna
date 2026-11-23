"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { contasDasEmpresasAcao, salvarContratoAcao } from "@/app/acoes/contratos";
import { Aviso } from "@/components/ui/basicos";
import { CampoDeValor } from "@/components/ui/campo-de-valor";
import { Abas, PainelDeAba, useAbas } from "@/components/ui/abas";

/** Aba de cada campo que o servidor pode recusar (abre sozinha a aba do erro). */
const ABA_DO_CAMPO: Record<string, string> = {
  titulo: "partes",
  contratantes: "partes",
  contratadas: "partes",
  dataAssinatura: "vigencia",
  inicio: "vigencia",
  fim: "vigencia",
  exclusividadeAte: "vigencia",
  honorarioFixo: "honorarios",
  periodicidade: "honorarios",
  variavelCriterio: "honorarios",
  variavelValorHora: "honorarios",
  variavelPercentual: "honorarios",
  variavelBase: "honorarios",
  variavelTeto: "honorarios",
  variavelDiaApuracao: "honorarios",
  successFeePercentual: "honorarios",
  successFeeMinimo: "honorarios",
  contaBancariaId: "pagamento",
};

function AbrirAbaDoErro({ campo }: { campo?: string }) {
  const abas = useAbas();
  useEffect(() => {
    if (campo && ABA_DO_CAMPO[campo]) abas?.ativar(ABA_DO_CAMPO[campo]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o erro muda
  }, [campo]);
  return null;
}
import type { ValoresDoContrato } from "./valores";

type Opcao = { id: string; nome: string };

const campo = "border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm";
const rotulo = "text-text mb-1 block text-sm font-medium";

/** Várias empresas, com filtro (o cadastro pode ser grande no contrato avulso). */
function EscolhaDeEmpresas({
  titulo,
  opcoes,
  escolhidas,
  mudar,
  erro,
}: {
  titulo: string;
  opcoes: Opcao[];
  escolhidas: string[];
  mudar: (ids: string[]) => void;
  erro?: boolean;
}) {
  const t = useTranslations("contratos");
  const [filtro, setFiltro] = useState("");
  const visiveis = opcoes.filter(
    (o) => escolhidas.includes(o.id) || o.nome.toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  return (
    <fieldset className={`rounded-md border p-3 ${erro ? "border-danger" : "border-border"}`}>
      <legend className="text-text px-1 text-sm font-medium">{titulo}</legend>
      {opcoes.length > 8 && (
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder={t("escolhaEmpresas")}
          aria-label={titulo}
          className={`${campo} mb-2`}
        />
      )}
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {visiveis.slice(0, 100).map((o) => (
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
    </fieldset>
  );
}

function Marcas({
  titulo,
  opcoes,
  escolhidas,
  mudar,
}: {
  titulo: string;
  opcoes: Opcao[];
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

/**
 * Cadastro e edição do contrato (C1): partes, vigência, exclusividade,
 * honorários, success fee, pagamento e quem vê. Num contrato avulso, permite
 * ligá-lo a um negócio (C2).
 */
export function FormContrato({
  id,
  inicial,
  opcoes,
  negocios = [],
  aoCancelar,
}: {
  id?: string;
  inicial: ValoresDoContrato;
  opcoes: { empresas: Opcao[]; perfis: Opcao[]; usuarios: Opcao[] };
  negocios?: Opcao[];
  aoCancelar?: string;
}) {
  const t = useTranslations("contratos");
  const router = useRouter();
  const [v, setV] = useState<ValoresDoContrato>(inicial);
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [contas, setContas] = useState<
    { id: string; empresaId: string; descricao: string; pix: string | null }[]
  >([]);
  const [fixoLigado, setFixoLigado] = useState(Boolean(inicial.honorarioFixo));
  const mudar = <K extends keyof ValoresDoContrato>(k: K, valor: ValoresDoContrato[K]) =>
    setV((x) => ({ ...x, [k]: valor }));
  const chaveContratadas = v.contratadas.join(",");
  useEffect(() => {
    let ativo = true;
    const ids = chaveContratadas ? chaveContratadas.split(",") : [];
    const carregar = setTimeout(async () => {
      const lista = ids.length ? await contasDasEmpresasAcao(inicial.dealId, ids) : [];
      if (ativo) setContas(lista);
    }, 0);
    return () => {
      ativo = false;
      clearTimeout(carregar);
    };
  }, [chaveContratadas, inicial.dealId]);
  const nomeDaEmpresa = useMemo(() => new Map(opcoes.empresas.map((e) => [e.id, e.nome])), [opcoes.empresas]);
  const contasDoMeio = v.meioRecebimento === "pix" ? contas.filter((c) => c.pix) : contas;
  // Ao ligar a um negócio, as opções de perfis e pessoas passam a ser as do negócio (depois de salvar).
  const ligando = !inicial.dealId && v.dealId;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarContratoAcao(id ?? null, {
      ...v,
      contaBancariaId:
        v.contratadas.length && contasDoMeio.some((c) => c.id === v.contaBancariaId) ? v.contaBancariaId : "",
    });
    setSalvando(false);
    if (r.erro) return setErro({ texto: r.erro, campo: r.campo });
    router.push(`/contratos/${r.id}?salvo=1`);
    router.refresh();
  }

  const abas = [
    { id: "partes", rotulo: t("abas.partes") },
    { id: "vigencia", rotulo: t("abas.vigencia") },
    { id: "honorarios", rotulo: t("abas.honorarios") },
    { id: "pagamento", rotulo: t("abas.pagamento") },
    { id: "acesso", rotulo: t("abas.acesso") },
  ];
  return (
    <Abas abas={abas}>
      <AbrirAbaDoErro campo={erro?.campo} />
      <form onSubmit={salvar} className="space-y-5">
        {erro && <Aviso>{erro.texto}</Aviso>}
        <PainelDeAba id="partes">
          <div className="space-y-5">
            {!inicial.dealId && negocios.length > 0 && (
              <label className="block">
                <span className={rotulo}>{id ? t("ligarAoNegocio") : t("negocio")}</span>
                <select
                  value={v.dealId ?? ""}
                  onChange={(e) => mudar("dealId", e.target.value || null)}
                  className={campo}
                >
                  <option value="">{t("semNegocio")}</option>
                  {negocios.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <label>
                <span className={rotulo}>{t("tipo")}</span>
                <select
                  value={v.tipo}
                  onChange={(e) => mudar("tipo", e.target.value as ValoresDoContrato["tipo"])}
                  className={campo}
                >
                  {(["mandato", "honorarios", "outro"] as const).map((x) => (
                    <option key={x} value={x}>
                      {t(`tipos.${x}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={rotulo}>{t("tituloDoContrato")}</span>
                <input
                  value={v.titulo}
                  onChange={(e) => mudar("titulo", e.target.value)}
                  required
                  maxLength={200}
                  placeholder={t("tituloDica")}
                  className={`${campo} ${erro?.campo === "titulo" ? "border-danger" : ""}`}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <EscolhaDeEmpresas
                titulo={t("contratantes")}
                opcoes={opcoes.empresas}
                escolhidas={v.contratantes}
                mudar={(ids) => mudar("contratantes", ids)}
                erro={erro?.campo === "contratantes"}
              />
              <EscolhaDeEmpresas
                titulo={t("contratadas")}
                opcoes={opcoes.empresas}
                escolhidas={v.contratadas}
                mudar={(ids) => mudar("contratadas", ids)}
                erro={erro?.campo === "contratadas"}
              />
            </div>
            <label className="block">
              <span className={rotulo}>{t("objeto")}</span>
              <textarea
                value={v.objeto}
                onChange={(e) => mudar("objeto", e.target.value)}
                rows={3}
                maxLength={5000}
                className={campo}
              />
            </label>
          </div>
        </PainelDeAba>
        <PainelDeAba id="vigencia">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {(["dataAssinatura", "inicio", "fim"] as const).map((k) => (
                <label key={k}>
                  <span className={rotulo}>{t(k)}</span>
                  <input
                    type="date"
                    value={v[k]}
                    onChange={(e) => mudar(k, e.target.value)}
                    className={`${campo} ${erro?.campo === k ? "border-danger" : ""}`}
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={v.exclusivo}
                  onChange={(e) => mudar("exclusivo", e.target.checked)}
                />
                {t("exclusivo")}
              </label>
              {v.exclusivo && (
                <label>
                  <span className={rotulo}>{t("exclusividadeAte")}</span>
                  <input
                    type="date"
                    value={v.exclusividadeAte}
                    onChange={(e) => mudar("exclusividadeAte", e.target.value)}
                    className={campo}
                  />
                </label>
              )}
            </div>
          </div>
        </PainelDeAba>
        <PainelDeAba id="honorarios">
          <div className="space-y-4">
            <p className="text-muted text-xs">{t("honorariosAjuda")}</p>
            <div className="space-y-3">
              <label className="text-text flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={fixoLigado}
                  onChange={(e) => {
                    setFixoLigado(e.target.checked);
                    if (!e.target.checked)
                      setV((x) => ({
                        ...x,
                        honorarioFixo: "",
                        periodicidade: "",
                        retainerDescontado: false,
                      }));
                  }}
                />
                {t("temFixo")}
              </label>
              {fixoLigado && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <label>
                    <span className={rotulo}>{t("honorarioFixo")}</span>
                    <CampoDeValor
                      valor={v.honorarioFixo}
                      mudar={(x) => mudar("honorarioFixo", x)}
                      erro={erro?.campo === "honorarioFixo"}
                    />
                  </label>
                  <label>
                    <span className={rotulo}>{t("periodicidade")}</span>
                    <select
                      value={v.periodicidade}
                      onChange={(e) =>
                        mudar("periodicidade", e.target.value as ValoresDoContrato["periodicidade"])
                      }
                      className={campo}
                    >
                      <option value="">—</option>
                      {(["unico", "mensal", "trimestral", "semestral", "anual"] as const).map((x) => (
                        <option key={x} value={x}>
                          {t(`periodicidades.${x}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={v.retainerDescontado}
                      onChange={(e) => mudar("retainerDescontado", e.target.checked)}
                    />
                    {t("retainerDescontado")}
                  </label>
                </div>
              )}
            </div>
            <div className="border-border space-y-3 border-t pt-3">
              <label className="text-text flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={v.honorarioVariavel}
                  onChange={(e) => mudar("honorarioVariavel", e.target.checked)}
                />
                {t("temVariavel")}
              </label>
              {v.honorarioVariavel && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={rotulo}>{t("variavelCriterio")}</span>
                    <select
                      value={v.variavelCriterio}
                      onChange={(e) =>
                        mudar("variavelCriterio", e.target.value as ValoresDoContrato["variavelCriterio"])
                      }
                      className={`${campo} ${erro?.campo === "variavelCriterio" ? "border-danger" : ""}`}
                    >
                      <option value="">—</option>
                      {(["horas", "percentual", "outro"] as const).map((x) => (
                        <option key={x} value={x}>
                          {t(`criterios.${x}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {v.variavelCriterio === "horas" && (
                    <label>
                      <span className={rotulo}>{t("variavelValorHora")}</span>
                      <CampoDeValor
                        valor={v.variavelValorHora}
                        mudar={(x) => mudar("variavelValorHora", x)}
                        erro={erro?.campo === "variavelValorHora"}
                      />
                    </label>
                  )}
                  {v.variavelCriterio === "percentual" && (
                    <label>
                      <span className={rotulo}>{t("variavelPercentual")}</span>
                      <input
                        inputMode="decimal"
                        value={v.variavelPercentual}
                        onChange={(e) => mudar("variavelPercentual", e.target.value)}
                        className={`${campo} ${erro?.campo === "variavelPercentual" ? "border-danger" : ""}`}
                      />
                    </label>
                  )}
                  {(v.variavelCriterio === "percentual" || v.variavelCriterio === "outro") && (
                    <label className={v.variavelCriterio === "outro" ? "sm:col-span-2" : ""}>
                      <span className={rotulo}>
                        {v.variavelCriterio === "percentual" ? t("variavelBase") : t("variavelDescricao")}
                      </span>
                      <input
                        value={v.variavelBase}
                        onChange={(e) => mudar("variavelBase", e.target.value)}
                        maxLength={1000}
                        placeholder={
                          v.variavelCriterio === "percentual"
                            ? t("variavelBaseDica")
                            : t("variavelDescricaoDica")
                        }
                        className={`${campo} ${erro?.campo === "variavelBase" ? "border-danger" : ""}`}
                      />
                    </label>
                  )}
                  <label>
                    <span className={rotulo}>{t("variavelTeto")}</span>
                    <CampoDeValor
                      valor={v.variavelTeto}
                      mudar={(x) => mudar("variavelTeto", x)}
                      erro={erro?.campo === "variavelTeto"}
                    />
                  </label>
                  <label>
                    <span className={rotulo}>{t("variavelDiaApuracao")}</span>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={v.variavelDiaApuracao}
                      onChange={(e) => mudar("variavelDiaApuracao", e.target.value)}
                      className={`${campo} ${erro?.campo === "variavelDiaApuracao" ? "border-danger" : ""}`}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="border-border grid gap-4 border-t pt-3 sm:grid-cols-2">
              <label>
                <span className={rotulo}>{t("successFeePercentual")}</span>
                <input
                  inputMode="decimal"
                  value={v.successFeePercentual}
                  onChange={(e) => mudar("successFeePercentual", e.target.value)}
                  className={`${campo} ${erro?.campo === "successFeePercentual" ? "border-danger" : ""}`}
                />
              </label>
              <label>
                <span className={rotulo}>{t("successFeeMinimo")}</span>
                <CampoDeValor
                  valor={v.successFeeMinimo}
                  mudar={(x) => mudar("successFeeMinimo", x)}
                  erro={erro?.campo === "successFeeMinimo"}
                />
              </label>
            </div>
          </div>
        </PainelDeAba>
        <PainelDeAba id="pagamento">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className={rotulo}>{t("receberPor")}</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(["conta", "pix"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="meioRecebimento"
                      checked={v.meioRecebimento === m}
                      onChange={() => mudar("meioRecebimento", m)}
                    />
                    {t(`meios.${m}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="sm:col-span-2">
              <span className={rotulo}>{v.meioRecebimento === "pix" ? t("chavePix") : t("conta")}</span>
              <select
                value={v.contaBancariaId}
                onChange={(e) => mudar("contaBancariaId", e.target.value)}
                className={`${campo} ${erro?.campo === "contaBancariaId" ? "border-danger" : ""}`}
              >
                <option value="">{v.meioRecebimento === "pix" ? t("semChavePix") : t("semConta")}</option>
                {contasDoMeio.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nomeDaEmpresa.get(c.empresaId) ?? ""} ·{" "}
                    {v.meioRecebimento === "pix" ? c.pix : c.descricao}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={rotulo}>{t("formaPagamento")}</span>
              <input
                value={v.formaPagamento}
                onChange={(e) => mudar("formaPagamento", e.target.value)}
                maxLength={1000}
                placeholder={t("formaPagamentoDica")}
                className={campo}
              />
            </label>
          </div>
        </PainelDeAba>
        <PainelDeAba id="acesso">
          <div className="space-y-5">
            <label className="block">
              <span className={rotulo}>{t("observacoes")}</span>
              <textarea
                value={v.observacoes}
                onChange={(e) => mudar("observacoes", e.target.value)}
                rows={2}
                maxLength={5000}
                className={campo}
              />
            </label>
            {!ligando && (opcoes.perfis.length > 0 || opcoes.usuarios.length > 0) && (
              <fieldset className="border-border space-y-3 rounded-md border p-3">
                <legend className="text-text px-1 text-sm font-medium">{t("quemVe")}</legend>
                <Marcas
                  titulo={t("perfis")}
                  opcoes={opcoes.perfis}
                  escolhidas={v.perfis}
                  mudar={(ids) => mudar("perfis", ids)}
                />
                <Marcas
                  titulo={t("usuarios")}
                  opcoes={opcoes.usuarios}
                  escolhidas={v.usuarios}
                  mudar={(ids) => mudar("usuarios", ids)}
                />
              </fieldset>
            )}
          </div>
        </PainelDeAba>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            {t("salvar")}
          </button>
          {aoCancelar && (
            <a href={aoCancelar} className="text-muted px-2 py-2 text-sm">
              {t("cancelar")}
            </a>
          )}
        </div>
      </form>
    </Abas>
  );
}
