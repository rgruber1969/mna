"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { contasDasEmpresasAcao, salvarContratoAcao } from "@/app/acoes/contratos";
import { Aviso } from "@/components/ui/basicos";
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
  const [contas, setContas] = useState<{ id: string; empresaId: string; descricao: string }[]>([]);
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
  // Ao ligar a um negócio, as opções de perfis e pessoas passam a ser as do negócio (depois de salvar).
  const ligando = !inicial.dealId && v.dealId;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const r = await salvarContratoAcao(id ?? null, {
      ...v,
      contaBancariaId:
        v.contratadas.length && contas.some((c) => c.id === v.contaBancariaId) ? v.contaBancariaId : "",
    });
    setSalvando(false);
    if (r.erro) return setErro({ texto: r.erro, campo: r.campo });
    router.push(`/contratos/${r.id}?salvo=1`);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      {erro && <Aviso>{erro.texto}</Aviso>}
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
      <fieldset className="border-border grid gap-4 rounded-md border p-3 sm:grid-cols-2">
        <legend className="text-text px-1 text-sm font-medium">{t("condicoes")}</legend>
        <label>
          <span className={rotulo}>{t("honorarioFixo")}</span>
          <input
            inputMode="decimal"
            value={v.honorarioFixo}
            onChange={(e) => mudar("honorarioFixo", e.target.value)}
            className={`${campo} ${erro?.campo === "honorarioFixo" ? "border-danger" : ""}`}
          />
        </label>
        <label>
          <span className={rotulo}>{t("periodicidade")}</span>
          <select
            value={v.periodicidade}
            onChange={(e) => mudar("periodicidade", e.target.value as ValoresDoContrato["periodicidade"])}
            className={campo}
            disabled={!v.honorarioFixo}
          >
            <option value="">—</option>
            {(["unico", "mensal", "trimestral", "semestral", "anual"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`periodicidades.${x}`)}
              </option>
            ))}
          </select>
        </label>
        {v.honorarioFixo && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={v.retainerDescontado}
              onChange={(e) => mudar("retainerDescontado", e.target.checked)}
            />
            {t("retainerDescontado")}
          </label>
        )}
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
          <input
            inputMode="decimal"
            value={v.successFeeMinimo}
            onChange={(e) => mudar("successFeeMinimo", e.target.value)}
            className={`${campo} ${erro?.campo === "successFeeMinimo" ? "border-danger" : ""}`}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={rotulo}>{t("formaPagamento")}</span>
          <input
            value={v.formaPagamento}
            onChange={(e) => mudar("formaPagamento", e.target.value)}
            maxLength={1000}
            className={campo}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={rotulo}>{t("conta")}</span>
          <select
            value={v.contaBancariaId}
            onChange={(e) => mudar("contaBancariaId", e.target.value)}
            className={`${campo} ${erro?.campo === "contaBancariaId" ? "border-danger" : ""}`}
          >
            <option value="">{t("semConta")}</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeDaEmpresa.get(c.empresaId) ?? ""} · {c.descricao}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
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
  );
}
