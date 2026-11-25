import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso, type AcessoTenant } from "@/server/services/acesso";
import { painelDoUsuario, type NegocioDoPainel } from "@/server/services/painel";
import { minhasMensagens } from "@/server/services/mensagens";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { PrecisaDeVoce } from "@/components/painel/precisa-de-voce";
import { PergunteAoSistema } from "@/components/painel/assistente";
import { estaLigada, estaSimulada } from "@/config/funcionalidades";
import { EsqueletoDoPainel, EsqueletoDoPainelConteudo } from "@/components/ui/esqueletos";
import { CORES_DO_NIVEL, diasAte, type NivelDoPrazo } from "@/config/prazos";

/**
 * Tela principal do tenant (item 14; propostas de layout v3): frase de
 * resumo, números com o semáforo dos prazos, progresso dos meus negócios e
 * "Precisa de você" (prazos e mensagens) com a faixa da semana.
 */

const br = (d: string) => d.split("-").reverse().join("/");
const reais = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Bloco({
  titulo,
  link,
  children,
}: {
  titulo: string;
  link?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <section className="bg-background border-border min-w-0 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-muted text-xs font-semibold tracking-wider uppercase">{titulo}</h2>
        {link && (
          <Link href={link.href} className="text-primary text-xs font-semibold">
            {link.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Número do topo: fundo fosco na cor da situação quando há algo a fazer; neutro quando não há. */
function Numero({
  rotulo,
  valor,
  detalhe,
  nivel,
  href,
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  nivel?: NivelDoPrazo;
  href: string;
}) {
  const cor = nivel ? CORES_DO_NIVEL[nivel] : null;
  return (
    <Link
      href={href}
      className={`${cor ? cor.fundo : "bg-background"} border-border hover:border-primary block rounded-xl border p-4 transition-colors`}
    >
      <span className="text-muted flex items-center gap-1.5 text-xs font-semibold">
        {cor && <span className={`${cor.faixa} h-2 w-2 rounded-full`} aria-hidden="true" />}
        {rotulo}
      </span>
      <span
        className={`block text-3xl leading-tight font-bold tabular-nums ${cor ? cor.texto : "text-text"}`}
      >
        {valor}
      </span>
      {detalhe && <span className="text-muted block truncate text-xs">{detalhe}</span>}
    </Link>
  );
}

function Segmentos({ n, nivel }: { n: NegocioDoPainel; nivel: NivelDoPrazo | null }) {
  const total = Math.max(n.progresso.total, 1);
  const cheio = nivel ? CORES_DO_NIVEL[nivel].faixa : "bg-primary";
  return (
    <span className="flex w-24 gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-sm ${
            i < n.progresso.feitas ? cheio : i === n.progresso.feitas ? `${cheio} opacity-45` : "bg-border"
          }`}
        />
      ))}
    </span>
  );
}

/** Casca primeiro (rápida); o conteúdo chega depois, com o skeleton no lugar. */
async function Inicio() {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <Suspense fallback={<EsqueletoDoPainelConteudo />}>
        <Conteudo acesso={acesso} />
      </Suspense>
    </EstruturaDoTenant>
  );
}

async function Conteudo({ acesso }: { acesso: AcessoTenant }) {
  const tp = await getTranslations("painel");
  const tk = await getTranslations("negocios.kanban");
  const ts = await getTranslations("negocios.situacoes");
  const [p, mensagens] = await Promise.all([painelDoUsuario(acesso), minhasMensagens(acesso, 10)]);
  const { numeros: q, diasDeAviso: dias } = p;
  const primeiro = p.prazos.find((z) => z.nivel !== "emDia");
  const tituloDoItem = (z: (typeof p.prazos)[number]) => tp(`precisa.titulos.${z.tipo}`, { texto: z.texto });
  const novas = mensagens.conversas
    .filter((c) => c.naoLidas > 0)
    .slice(0, 3)
    .map((c) => ({ autor: c.autor, negocio: c.negocio, trecho: c.trecho, link: c.link }));
  const chipDoFim = (n: NegocioDoPainel) => {
    if (!n.fimDaEtapa || !n.nivel) return null;
    const d = diasAte(n.fimDaEtapa, p.hoje);
    const data = br(n.fimDaEtapa).slice(0, 5);
    const texto =
      d < 0
        ? tp("progresso.atraso", { data, n: -d })
        : d === 0
          ? tp("progresso.hoje", { data })
          : n.nivel === "proximo"
            ? tp("progresso.emDias", { data, n: d })
            : tp("progresso.emDia", { data });
    return (
      <span
        className={`${CORES_DO_NIVEL[n.nivel].fundo} ${CORES_DO_NIVEL[n.nivel].texto} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap`}
      >
        <span className={`${CORES_DO_NIVEL[n.nivel].faixa} h-1.5 w-1.5 rounded-full`} aria-hidden="true" />
        {texto}
      </span>
    );
  };

  return (
    <main className="entra-em-cascata flex flex-1 flex-col gap-4 px-3 py-4 sm:px-6">
      <h1 className="sr-only">{tp("tituloDaTela")}</h1>
      {p.veNegocios && (
        <p className="text-text text-sm">
          {q.vencidos + q.proximos === 0
            ? tp("tudoEmDia", { dias })
            : tp.rich("resumo", {
                vencidos: q.vencidos,
                proximos: q.proximos,
                dias,
                v: (c) => <b className={q.vencidos ? "text-danger" : ""}>{c}</b>,
              })}{" "}
          {primeiro &&
            tp.rich("comece", {
              negocio: primeiro.negocio,
              item: tituloDoItem(primeiro),
              venceu: primeiro.nivel === "atrasado" ? "sim" : "nao",
              data: br(primeiro.data),
              b: (c) => <b>{c}</b>,
            })}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo={tp("kpi.vencidos")}
          valor={q.vencidos}
          detalhe={q.vencidos ? tp("kpi.verLista") : undefined}
          nivel={q.vencidos ? "atrasado" : undefined}
          href="/tarefas?filtro=atrasadas"
        />
        <Numero
          rotulo={tp("kpi.proximos", { dias })}
          valor={q.proximos}
          nivel={q.proximos ? "proximo" : undefined}
          href="/tarefas"
        />
        <Numero
          rotulo={tp("kpi.emDia")}
          valor={q.emDia}
          nivel={q.emDia ? "emDia" : undefined}
          href="/tarefas"
        />
        <Numero
          rotulo={tp("kpi.negocios")}
          valor={q.negocios}
          detalhe={q.carteira !== null ? tp("kpi.carteira", { valor: reais(q.carteira) }) : undefined}
          href="/negocios?vista=kanban"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Bloco
          titulo={tp("progresso.titulo")}
          link={p.veNegocios ? { href: "/negocios?vista=kanban", texto: tp("verKanban") } : undefined}
        >
          {p.negocios.length === 0 ? (
            <EstadoVazio
              titulo={tp("semNegocios")}
              texto={tp("semNegociosTexto")}
              acao={p.podeCriar ? { href: "/negocios/novo", rotulo: tp("novoNegocio") } : undefined}
            />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-border border-b text-left text-xs">
                    <th className="px-1 pb-2 font-semibold">{tp("progresso.colNegocio")}</th>
                    <th className="px-1 pb-2 font-semibold">{tp("progresso.colEtapa")}</th>
                    <th className="px-1 pb-2 font-semibold">{tp("progresso.colProgresso")}</th>
                    <th className="px-1 pb-2 font-semibold">{tp("progresso.colFim")}</th>
                    <th className="px-1 pb-2 text-right font-semibold">{tp("progresso.colValor")}</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {p.negocios.map((n) => (
                    <tr key={n.id} className="group hover:bg-surface relative transition-colors duration-150">
                      <td className="px-1 py-2.5">
                        {/* A linha inteira leva ao negócio (o link se estende sobre a linha). */}
                        <Link
                          href={`/negocios/${n.id}`}
                          className="text-text group-hover:text-primary font-semibold transition-colors duration-150 after:absolute after:inset-0"
                        >
                          {n.nome}
                        </Link>
                        {n.situacao !== "andamento" && (
                          <span className="text-warning block text-xs">{ts(n.situacao as never)}</span>
                        )}
                      </td>
                      <td className="text-text px-1 py-2.5">{n.etapa ?? tk("aIniciar")}</td>
                      <td className="px-1 py-2.5" title={tp("progresso.etapasFeitas", n.progresso)}>
                        <Segmentos n={n} nivel={n.nivel} />
                      </td>
                      <td className="px-1 py-2.5">
                        {chipDoFim(n) ?? (
                          <span className="text-muted text-xs">{tp("progresso.semPrazo")}</span>
                        )}
                      </td>
                      <td className="text-text px-1 py-2.5 text-right whitespace-nowrap tabular-nums">
                        {n.valorEstimado !== null ? reais(n.valorEstimado) : "—"}
                        <span
                          aria-hidden="true"
                          className="text-primary ml-2 inline-block -translate-x-1 opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                        >
                          →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloco>
        <Bloco titulo={tp("precisa.titulo")} link={{ href: "/tarefas", texto: tp("precisa.agenda") }}>
          <PrecisaDeVoce hoje={p.hoje} semana={p.semana} prazos={p.prazos} mensagens={novas} />
        </Bloco>
      </div>
      {estaLigada("assistente") && <PergunteAoSistema simulado={estaSimulada("assistente")} />}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoDoPainel />}>
      <Inicio />
    </Suspense>
  );
}
