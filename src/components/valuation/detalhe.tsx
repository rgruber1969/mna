import { useTranslations } from "next-intl";
import {
  CENARIOS,
  METODOS,
  projecaoDoValuation,
  type DadosDoValuation,
  type ResultadoDoValuation,
} from "@/config/valuation";
import { estiloTabela } from "@/components/ui/basicos";
import type { TelaDoValuation } from "@/server/services/valuation";
import { br, milhoes, pct, reais } from "./formato";
import { GraficoDoValuation } from "./grafico";

/** Partes da tela do valuation (item 18, simulado), cada uma numa aba. */

const td = estiloTabela.td;
const tdNum = `${estiloTabela.td} text-right whitespace-nowrap tabular-nums`;
const thNum = `${estiloTabela.th} text-right`;

function Tabela({ cabecalho, children }: { cabecalho: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={estiloTabela.tabela}>
        <thead className={estiloTabela.cabecalho}>
          <tr>{cabecalho}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="border-border rounded-lg border p-3">
      <p className="text-muted text-xs">{rotulo}</p>
      <p className="text-text text-xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="text-muted mt-1 text-xs">{detalhe}</p>}
    </div>
  );
}

export function PainelDoValuation({
  dados,
  resultado,
  comparacao,
}: Pick<TelaDoValuation, "dados" | "resultado" | "comparacao">) {
  const t = useTranslations("valuation");
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Numero rotulo={t("painel.ponderado")} valor={milhoes(resultado.ponderado)} />
        <Numero
          rotulo={t("painel.faixa")}
          valor={t("painel.faixaValor", {
            minimo: milhoes(dados.faixa.minimo),
            maximo: milhoes(dados.faixa.maximo),
          })}
          detalhe={t("painel.faixaExplicacao")}
        />
        <Numero
          rotulo={t("painel.cenarios")}
          valor={t("painel.cenariosValor", {
            pessimista: milhoes(resultado.cenarios.pessimista),
            otimista: milhoes(resultado.cenarios.otimista),
          })}
        />
      </div>
      <GraficoDoValuation
        valores={resultado.valores}
        ponderado={resultado.ponderado}
        faixa={dados.faixa}
        ofertas={(comparacao?.ofertas ?? []).map((o) => ({
          id: o.id,
          rotulo: `${o.compradora} (${t("comparacao.rodada")} ${o.rodada})`,
          total: o.total,
        }))}
      />
      {!comparacao && <p className="text-muted text-xs">{t("painel.semOfertas")}</p>}
    </div>
  );
}

export function PremissasDoValuation({ dados }: { dados: DadosDoValuation }) {
  const t = useTranslations("valuation.premissas");
  const projecao = projecaoDoValuation(dados);
  const outras: [string, string][] = [
    [t("wacc"), pct(dados.wacc)],
    [t("perpetuidade"), pct(dados.crescimentoPerpetuo)],
    [t("conversao"), pct(dados.conversaoDeCaixa * 100, 0)],
    [t("dividaLiquida"), reais(dados.dividaLiquida)],
    [t("contingencias"), reais(dados.contingencias)],
    [t("regime"), dados.regimeTributario],
    [t("arr"), reais(dados.receitaRecorrenteAnual)],
    [t("pl"), reais(dados.patrimonioLiquidoAjustado)],
  ];
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-text mb-2 text-sm font-semibold">{t("dre")}</h3>
        <Tabela
          cabecalho={
            <>
              <th className={estiloTabela.th}>{t("ano")}</th>
              <th className={thNum}>{t("receita")}</th>
              <th className={thNum}>{t("ebitda")}</th>
              <th className={thNum}>{t("margem")}</th>
              <th className={thNum}>{t("lucro")}</th>
            </>
          }
        >
          {dados.dre.map((d) => (
            <tr key={d.ano} className={estiloTabela.linha}>
              <td className={td}>{d.ano}</td>
              <td className={tdNum}>{reais(d.receita)}</td>
              <td className={tdNum}>{reais(d.ebitda)}</td>
              <td className={tdNum}>{pct((d.ebitda / d.receita) * 100)}</td>
              <td className={tdNum}>{reais(d.lucroLiquido)}</td>
            </tr>
          ))}
        </Tabela>
      </section>
      <section>
        <h3 className="text-text mb-2 text-sm font-semibold">{t("projecao")}</h3>
        <Tabela
          cabecalho={
            <>
              <th className={estiloTabela.th}>{t("ano")}</th>
              <th className={thNum}>{t("crescimento")}</th>
              <th className={thNum}>{t("receita")}</th>
              <th className={thNum}>{t("margem")}</th>
              <th className={thNum}>{t("ebitda")}</th>
            </>
          }
        >
          {projecao.map((p) => (
            <tr key={p.ano} className={estiloTabela.linha}>
              <td className={td}>{p.ano}</td>
              <td className={tdNum}>{pct(p.crescimento)}</td>
              <td className={tdNum}>{reais(p.receita)}</td>
              <td className={tdNum}>{pct(p.margemEbitda)}</td>
              <td className={tdNum}>{reais(p.ebitda)}</td>
            </tr>
          ))}
        </Tabela>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="text-text mb-2 text-sm font-semibold">{t("outras")}</h3>
          <dl className="divide-border divide-y text-sm">
            {outras.map(([r, v]) => (
              <div key={r} className="flex justify-between gap-3 py-1.5">
                <dt className="text-muted">{r}</dt>
                <dd className="text-text tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="text-text mb-2 text-sm font-semibold">{t("transacoes")}</h3>
          <Tabela
            cabecalho={
              <>
                <th className={estiloTabela.th}>{t("alvo")}</th>
                <th className={estiloTabela.th}>{t("ano")}</th>
                <th className={thNum}>{t("multiplo")}</th>
              </>
            }
          >
            {dados.transacoes.map((x) => (
              <tr key={x.alvo} className={estiloTabela.linha}>
                <td className={td}>{x.alvo}</td>
                <td className={td}>{x.ano}</td>
                <td className={tdNum}>{x.evEbitda.toLocaleString("pt-BR")}x</td>
              </tr>
            ))}
          </Tabela>
        </section>
      </div>
    </div>
  );
}

export function MetodosDoValuation({
  dados,
  resultado,
}: {
  dados: DadosDoValuation;
  resultado: ResultadoDoValuation;
}) {
  const t = useTranslations("valuation");
  const multiplos = dados.transacoes.map((x) => x.evEbitda).sort((a, b) => a - b);
  const meio = multiplos.length / 2;
  const mediana =
    multiplos.length % 2 ? multiplos[Math.floor(meio)] : (multiplos[meio - 1] + multiplos[meio]) / 2;
  const bases = {
    dcf: { wacc: dados.wacc.toLocaleString("pt-BR"), g: dados.crescimentoPerpetuo.toLocaleString("pt-BR") },
    multiplos: {
      ebitda: dados.multiplos.evEbitda.toLocaleString("pt-BR"),
      receita: dados.multiplos.evReceita.toLocaleString("pt-BR"),
      arr: dados.multiplos.evArr.toLocaleString("pt-BR"),
    },
    transacoes: { n: String(dados.transacoes.length), mediana: mediana.toLocaleString("pt-BR") },
    patrimonial: {},
    regraDeBolso: { multiplo: dados.regraDeBolso.toLocaleString("pt-BR") },
  };
  return (
    <div>
      <Tabela
        cabecalho={
          <>
            <th className={estiloTabela.th}>{t("tabela.metodo")}</th>
            <th className={estiloTabela.th}>{t("tabela.base")}</th>
            <th className={thNum}>{t("tabela.valor")}</th>
            <th className={thNum}>{t("tabela.peso")}</th>
            <th className={thNum}>{t("tabela.contribuicao")}</th>
          </>
        }
      >
        {METODOS.map((m) => (
          <tr key={m} className={estiloTabela.linha}>
            <td className={`${td} font-medium`}>{t(`metodos.${m}`)}</td>
            <td className={`${td} text-muted text-xs`}>{t(`basesDeCalculo.${m}`, bases[m])}</td>
            <td className={tdNum}>{milhoes(resultado.valores[m])}</td>
            <td className={tdNum}>{pct(dados.pesos[m], 0)}</td>
            <td className={tdNum}>{milhoes((resultado.valores[m] * dados.pesos[m]) / 100)}</td>
          </tr>
        ))}
        <tr>
          <td className={`${td} font-semibold`} colSpan={3}>
            {t("tabela.total")}
          </td>
          <td className={`${tdNum} font-semibold`}>{pct(resultado.somaDosPesos, 0)}</td>
          <td className={`${tdNum} font-semibold`}>{milhoes(resultado.ponderado)}</td>
        </tr>
      </Tabela>
      <p className="text-muted mt-2 text-xs">{t("tabela.explicacao")}</p>
    </div>
  );
}

export function CenariosDoValuation({
  dados,
  resultado,
}: {
  dados: DadosDoValuation;
  resultado: ResultadoDoValuation;
}) {
  const t = useTranslations("valuation");
  const s = resultado.sensibilidade;
  const n = (v: number) => v.toLocaleString("pt-BR");
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-text mb-1 text-sm font-semibold">{t("sensibilidade.cenariosTitulo")}</h3>
        <p className="text-muted mb-2 text-xs">
          {t("sensibilidade.cenariosExplicacao", {
            pc: n(dados.cenarios.pessimista.crescimento),
            pm: n(dados.cenarios.pessimista.margem),
            oc: n(dados.cenarios.otimista.crescimento),
            om: n(dados.cenarios.otimista.margem),
          })}
        </p>
        <Tabela
          cabecalho={
            <>
              <th className={estiloTabela.th}>{t("sensibilidade.cenario")}</th>
              <th className={thNum}>{t("painel.ponderado")}</th>
            </>
          }
        >
          {CENARIOS.map((c) => (
            <tr key={c} className={estiloTabela.linha}>
              <td className={`${td} ${c === "base" ? "font-semibold" : ""}`}>{t(`cenarios.${c}`)}</td>
              <td className={`${tdNum} ${c === "base" ? "font-semibold" : ""}`}>
                {milhoes(resultado.cenarios[c])}
              </td>
            </tr>
          ))}
        </Tabela>
      </section>
      <section>
        <h3 className="text-text mb-1 text-sm font-semibold">{t("sensibilidade.titulo")}</h3>
        <p className="text-muted mb-2 text-xs">{t("sensibilidade.explicacao")}</p>
        <Tabela
          cabecalho={
            <>
              <th className={estiloTabela.th}>
                {t("sensibilidade.wacc")} \ {t("sensibilidade.crescimento")}
              </th>
              {s.crescimentos.map((g) => (
                <th key={g} className={thNum}>
                  {pct(g)}
                </th>
              ))}
            </>
          }
        >
          {s.waccs.map((w, i) => (
            <tr key={w} className={estiloTabela.linha}>
              <td className={`${td} font-medium`}>{pct(w)}</td>
              {s.crescimentos.map((g, j) => (
                <td
                  key={g}
                  className={`${tdNum} ${i === 2 && j === 2 ? "bg-primary-soft text-primary font-semibold" : ""}`}
                >
                  {milhoes(s.valores[i][j])}
                </td>
              ))}
            </tr>
          ))}
        </Tabela>
      </section>
    </div>
  );
}

export function RateioDoValuation({
  dados,
  resultado,
}: {
  dados: DadosDoValuation;
  resultado: ResultadoDoValuation;
}) {
  const t = useTranslations("valuation.rateio");
  return (
    <div>
      <p className="text-muted mb-1 text-sm">{t("explicacao")}</p>
      <p className="text-muted mb-3 text-sm">{t("criterio", { criterio: dados.criterioRateio })}</p>
      <Tabela
        cabecalho={
          <>
            <th className={estiloTabela.th}>{t("vendedora")}</th>
            <th className={thNum}>{t("percentual")}</th>
            <th className={thNum}>{t("valor")}</th>
          </>
        }
      >
        {resultado.rateio.map((r) => (
          <tr key={r.nome} className={estiloTabela.linha}>
            <td className={td}>{r.nome}</td>
            <td className={tdNum}>{pct(r.percentual, 0)}</td>
            <td className={tdNum}>{milhoes(r.valor)}</td>
          </tr>
        ))}
      </Tabela>
    </div>
  );
}

export function TeseDoValuation({ dados }: { dados: DadosDoValuation }) {
  const t = useTranslations("valuation.tese");
  const itens: [string, React.ReactNode][] = [
    [t("setor"), dados.tese.setor],
    [t("ebitda"), dados.tese.ebitda],
    [t("faturamento"), dados.tese.faturamento],
    [
      t("fontes"),
      <ul key="f" className="list-disc pl-4">
        {dados.tese.fontes.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>,
    ],
  ];
  return (
    <dl className="divide-border max-w-2xl divide-y text-sm">
      {itens.map(([r, v]) => (
        <div key={r} className="grid gap-1 py-2 sm:grid-cols-3">
          <dt className="text-muted">{r}</dt>
          <dd className="text-text sm:col-span-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ComparacaoDoValuation({
  dados,
  resultado,
  negocios,
  comparacao,
}: Pick<TelaDoValuation, "dados" | "resultado" | "negocios" | "comparacao">) {
  const t = useTranslations("valuation.comparacao");
  const posicao = (v: number) =>
    v < dados.faixa.minimo ? "abaixo" : v > dados.faixa.maximo ? "acima" : ("dentro" as const);
  const cor = { abaixo: "text-danger", dentro: "text-success", acima: "text-primary" } as const;
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="aba" value="comparacao" />
        <label className="block text-sm">
          <span className="text-text mb-1 block font-medium">{t("negocio")}</span>
          <select
            name="negocio"
            defaultValue={comparacao?.dealId ?? ""}
            className="border-border bg-background text-text focus:border-primary min-w-64 rounded-md border px-2 py-1.5 text-sm outline-none"
          >
            <option value="">{t("escolha")}</option>
            {negocios.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
        >
          {t("comparar")}
        </button>
      </form>
      {!comparacao ? (
        <p className="text-muted text-sm">{t("semNegocio")}</p>
      ) : comparacao.ofertas.length === 0 ? (
        <p className="text-muted text-sm">{t("semOfertas")}</p>
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={estiloTabela.th}>{t("compradora")}</th>
              <th className={thNum}>{t("rodada")}</th>
              <th className={estiloTabela.th}>{t("data")}</th>
              <th className={thNum}>{t("total")}</th>
              <th className={thNum}>{t("sobrePonderado")}</th>
              <th className={estiloTabela.th}>{t("naFaixa")}</th>
            </>
          }
        >
          {comparacao.ofertas.map((o) => {
            const p = posicao(o.total);
            return (
              <tr key={o.id} className={estiloTabela.linha}>
                <td className={td}>{o.compradora}</td>
                <td className={tdNum}>{o.rodada}</td>
                <td className={td}>{br(o.data)}</td>
                <td className={tdNum}>{milhoes(o.total)}</td>
                <td className={tdNum}>{pct((o.total / resultado.ponderado) * 100, 0)}</td>
                <td className={`${td} text-xs font-medium ${cor[p]}`}>
                  {p === "abaixo" ? "▼ " : p === "acima" ? "▲ " : "● "}
                  {t(p)}
                </td>
              </tr>
            );
          })}
        </Tabela>
      )}
    </div>
  );
}
