import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso, type AcessoTenant } from "@/server/services/acesso";
import { listarTiposDeOperacao, ORDENS_DE_NEGOCIOS, paginaDeNegocios } from "@/server/services/negocios";
import { lerPedido } from "@/config/paginacao";
import { quadroDeNegocios } from "@/server/services/negocios-kanban";
import { hojeEmSaoPaulo } from "@/server/services/negocios-andamento";
import { KanbanDeNegocios } from "@/components/negocios/kanban";
import { Paginacao, TituloOrdenavel } from "@/components/ui/lista";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Cartao, estiloTabela, Titulo } from "@/components/ui/basicos";
import {
  EsqueletoDeListaConteudo,
  EsqueletoDeTela,
  EsqueletoDoKanbanConteudo,
} from "@/components/ui/esqueletos";

/** Lista dos negócios que a pessoa vê (dominio.md, "Lista"). */
type Parametros = Record<string, string | string[] | undefined>;

/** Casca primeiro; o quadro (ou a lista) chega depois, com o skeleton no lugar. */
async function Painel({ busca }: { busca: Promise<Parametros> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "deals", "ver"))) notFound();
  const parametros = await busca;
  const kanban = parametros.vista === "kanban";
  return (
    <EstruturaDoTenant acesso={acesso}>
      <Suspense fallback={kanban ? <EsqueletoDoKanbanConteudo /> : <EsqueletoDeListaConteudo />}>
        <Conteudo acesso={acesso} parametros={parametros} />
      </Suspense>
    </EstruturaDoTenant>
  );
}

async function Conteudo({ acesso, parametros }: { acesso: AcessoTenant; parametros: Parametros }) {
  const t = await getTranslations("negocios.lista");
  const ts = await getTranslations("negocios.situacoes");
  const um = (k: string) => (typeof parametros[k] === "string" ? (parametros[k] as string) : "");
  const kanban = um("vista") === "kanban";
  // No kanban, o padrão é mostrar só os negócios em aberto (em andamento e suspensos).
  const situacao = typeof parametros.situacao === "string" ? um("situacao") : kanban ? "abertos" : "";
  const filtro = { busca: um("busca"), situacao, tipo: um("tipo"), lado: um("lado") };
  const pedido = lerPedido(parametros, ORDENS_DE_NEGOCIOS, "numero", "desc");
  const [pagina, quadro, tipos, podeCriar] = await Promise.all([
    paginaDeNegocios(acesso, filtro, pedido),
    kanban ? quadroDeNegocios(acesso, filtro) : null,
    listarTiposDeOperacao(acesso),
    pode(acesso, "deals", "criar"),
  ]);
  const estiloFiltro = "border-border bg-background text-text rounded-md border px-3 py-2 text-sm";
  const ordenavel = (rotulo: string, campo: (typeof ORDENS_DE_NEGOCIOS)[number]) => (
    <TituloOrdenavel
      rotulo={rotulo}
      campo={campo}
      pedido={pedido}
      caminho="/negocios"
      parametros={parametros}
      className={estiloTabela.th}
    />
  );

  return (
    <main className="entra-em-cascata flex flex-1 items-start justify-start px-3 py-4 sm:px-6">
      <Cartao largura={kanban ? "max-w-none" : "max-w-6xl"}>
        <div className="flex items-start justify-between gap-4">
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {t("titulo")}
          </Titulo>
          <span className="flex shrink-0 flex-wrap items-center justify-end gap-3">
            <nav className="flex gap-2" aria-label={t("vista")}>
              {(["lista", "kanban"] as const).map((v) => {
                const q = new URLSearchParams();
                for (const k of ["busca", "tipo", "lado"]) if (um(k)) q.set(k, um(k));
                if (v === "kanban") q.set("vista", "kanban");
                const ativo = (v === "kanban") === kanban;
                return (
                  <Link
                    key={v}
                    href={`/negocios${q.size ? `?${q}` : ""}`}
                    aria-current={ativo ? "page" : undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted"}`}
                  >
                    {t(v === "kanban" ? "vistaKanban" : "vistaLista")}
                  </Link>
                );
              })}
            </nav>
            {podeCriar && (
              <Link
                href="/negocios/novo"
                className="bg-cta text-cta-foreground shrink-0 rounded-md px-3 py-2 text-sm font-semibold"
              >
                {t("novo")}
              </Link>
            )}
          </span>
        </div>
        {!kanban && (
          <form className="mb-4 flex flex-wrap items-center gap-3">
            <input
              name="busca"
              defaultValue={filtro.busca}
              aria-label={t("buscarAria")}
              placeholder={t("buscarPlaceholder")}
              className={`${estiloFiltro} w-full max-w-xs`}
            />
            <select
              name="situacao"
              defaultValue={filtro.situacao}
              aria-label={t("filtroSituacao")}
              className={estiloFiltro}
            >
              <option value="">{t("todasSituacoes")}</option>
              <option value="abertos">{t("emAberto")}</option>
              {(["andamento", "suspenso", "concluido", "encerrado"] as const).map((s) => (
                <option key={s} value={s}>
                  {ts(s)}
                </option>
              ))}
            </select>
            <select
              name="lado"
              defaultValue={filtro.lado}
              aria-label={t("filtroLado")}
              className={estiloFiltro}
            >
              <option value="">{t("todosLados")}</option>
              <option value="vendedor">{t("ladoVendedor")}</option>
              <option value="comprador">{t("ladoComprador")}</option>
            </select>
            <select
              name="tipo"
              defaultValue={filtro.tipo}
              aria-label={t("filtroTipo")}
              className={estiloFiltro}
            >
              <option value="">{t("todosTipos")}</option>
              {tipos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
            <button className="text-primary text-sm font-medium">{t("buscar")}</button>
          </form>
        )}
        {quadro ? (
          <KanbanDeNegocios
            colunas={quadro.colunas}
            cartoes={quadro.cartoes}
            hoje={hojeEmSaoPaulo()}
            diasDeAviso={quadro.diasDeAviso}
            filtros={{ situacao: filtro.situacao, lado: filtro.lado, tipo: filtro.tipo }}
            tipos={tipos.map((x) => ({ id: x.id, nome: x.nome }))}
          />
        ) : pagina.total === 0 ? (
          <p className="text-muted text-sm">{t("nenhum")}</p>
        ) : (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    {ordenavel(t("colNegocio"), "numero")}
                    <th className={estiloTabela.th}>{t("colVendedoras")}</th>
                    <th className={estiloTabela.th}>{t("colCompradora")}</th>
                    <th className={estiloTabela.th}>{t("colDescricao")}</th>
                    {ordenavel(t("colSituacao"), "situacao")}
                    <th className={estiloTabela.th}>{t("colEtapa")}</th>
                    <th className={estiloTabela.th}>{t("colCoordenador")}</th>
                    {ordenavel(t("colInicio"), "inicio")}
                  </tr>
                </thead>
                <tbody>
                  {pagina.itens.map((n) => (
                    <tr key={n.id} className={estiloTabela.linha}>
                      <td className={estiloTabela.td}>
                        <Link href={`/negocios/${n.id}`} className="text-text font-semibold">
                          {n.nome}
                        </Link>
                        {n.nomeInterno && <span className="text-muted block text-xs">{n.nomeInterno}</span>}
                        {n.tipo && <span className="text-muted block text-xs">{n.tipo}</span>}
                      </td>
                      <td className={`${estiloTabela.td} text-xs`}>
                        {n.vendedoras ? (
                          n.vendedoras.join(", ") || "—"
                        ) : (
                          <span className="text-muted">{t("sigilo")}</span>
                        )}
                      </td>
                      <td className={`${estiloTabela.td} text-xs`}>{n.compradoraEscolhida ?? "—"}</td>
                      <td className={`${estiloTabela.td} text-muted max-w-xs text-xs`}>
                        {n.descricao ? (
                          <span className="line-clamp-2" title={n.descricao}>
                            {n.descricao}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${estiloTabela.td} text-xs whitespace-nowrap`}>{ts(n.situacao)}</td>
                      <td className={`${estiloTabela.td} text-xs`}>
                        {n.etapa ?? "—"}
                        {n.etapasEmParalelo > 0 && (
                          <span className="text-muted block">
                            {t("emParalelo", { n: n.etapasEmParalelo })}
                          </span>
                        )}
                      </td>
                      <td className={`${estiloTabela.td} text-muted text-xs`}>
                        {n.coordenadores.join(", ") || "—"}
                      </td>
                      <td className={`${estiloTabela.td} text-muted text-xs whitespace-nowrap`}>
                        {n.dataInicio.split("-").reverse().join("/")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} caminho="/negocios" parametros={parametros} />
          </>
        )}
      </Cartao>
    </main>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/negocios">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel busca={searchParams as Promise<Record<string, string | string[] | undefined>>} />
    </Suspense>
  );
}
