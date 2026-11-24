import { EsqueletoDoNegocio } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  excluirNegocioAcao,
  removerEmpresaDoNegocioAcao,
  removerParticipanteAcao,
} from "@/app/acoes/negocios";
import { AcessoNegado, obterAcesso } from "@/server/services/acesso";
import {
  listarTiposDeOperacao,
  obterNegocio,
  opcoesDeEmpresas,
  opcoesDeParticipantes,
  type NegocioDetalhe,
} from "@/server/services/negocios";
import { formatarCnpj } from "@/config/documentos";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { ExportarNegocio } from "@/components/negocios/exportar";
import { estaLigada, estaSimulada, modoDa } from "@/config/funcionalidades";
import { ebookDoNegocio } from "@/server/services/ebook";
import { AbaDoEbook } from "@/components/ebook/aba";
import {
  FormDadosDoNegocio,
  FormIncluirEmpresa,
  FormIncluirParticipante,
} from "@/components/negocios/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { KanbanDoFunil, PainelExclusividade, PainelSituacao } from "@/components/negocios/andamento";
import { etapasDoNegocio, opcoesDeAlcance } from "@/server/services/etapas";
import { EtapasDoNegocio } from "@/components/negocios/etapas";
import { DataRoomDoNegocio } from "@/components/negocios/documentos";
import { TarefasDoNegocio } from "@/components/negocios/tarefas";
import { AbaDeMensagens } from "@/components/negocios/mensagens";
import { ListaPaginada } from "@/components/ui/paginacao-local";
import { totaisDeMensagens } from "@/server/services/mensagens";
import { tarefasDoNegocio } from "@/server/services/tarefas";
import { dataRoomDoNegocio } from "@/server/services/documentos";
import { HistoricoPaginado } from "@/components/negocios/historico";
import {
  andamentoDoNegocio,
  funilDoNegocio,
  hojeEmSaoPaulo,
  obterDiasDeAvisoDoPrazo,
} from "@/server/services/negocios-andamento";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { listarContratos, opcoesDoContrato } from "@/server/services/contratos";
import { TabelaDeContratos } from "@/components/contratos/detalhe";
import { condicoesDaOferta, ofertasDoNegocio, opcoesDaOferta } from "@/server/services/ofertas";
import { CondicoesDaOfertaEscolhida } from "@/components/ofertas/condicoes";
import { LinhaDasEtapas, ResumoDoNegocio } from "@/components/negocios/painel-do-negocio";
import { Alternador } from "@/components/ui/alternador";
import { AbaDeOfertas } from "@/components/ofertas/aba";
import { obterPedido, pedidosDoNegocio } from "@/server/services/pedidos";
import { AbaDePedidos } from "@/components/pedidos/aba";
import { Cartao, Titulo } from "@/components/ui/basicos";

/** Abas antigas (links já enviados, e-mails, avisos) → aba nova que as reúne. */
const ABA_ANTIGA: Record<string, string> = {
  tarefas: "atividade",
  mensagens: "atividade",
  empresas: "pessoas",
  participantes: "pessoas",
  funil: "compradoras",
  ofertas: "compradoras",
};

/** Traduz códigos dos parâmetros do histórico (situações, funil, datas). */
function traduzirParametros(
  tipo: string,
  p: Record<string, string>,
  ts: (k: string) => string,
  tf: (k: string) => string,
): Record<string, string> {
  const r = { ...p };
  if (tipo === "negocio.situacao" && r.para) r.para = ts(r.para);
  if (tipo === "negocio.funil" && r.para) r.para = tf(r.para);
  for (const k of ["de", "para", "inicio", "fim"])
    if (r[k] && /^\d{4}-\d{2}-\d{2}$/.test(r[k])) r[k] = r[k].split("-").reverse().join("/");
  return r;
}

/** Tela do negócio: cabeçalho e abas Resumo, Empresas e Participantes (dominio.md). */
async function Painel({
  id,
  aba,
  etapa,
  conversa,
  pedido,
  vista,
}: {
  id: Promise<string>;
  pedido: Promise<string | undefined>;
  vista: Promise<string | undefined>;
  aba: Promise<string | undefined>;
  etapa: Promise<string | undefined>;
  conversa: Promise<{ alvo?: string; canal?: string }>;
}) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  let n: NegocioDetalhe | null;
  try {
    n = await obterNegocio(acesso, await id);
  } catch (e) {
    if (e instanceof AcessoNegado) notFound();
    throw e;
  }
  if (!n) notFound();
  const t = await getTranslations("negocios.tela");
  const ts = await getTranslations("negocios.situacoes");
  const tf = await getTranslations("negocios.funil");
  const te = await getTranslations("negocios.empresas");
  const tp = await getTranslations("negocios.participantes");
  const tt = await getTranslations("negocios.andamento");
  const th = await getTranslations("negocios.historico");
  const tm = await getTranslations("mensagens");
  // Tudo em uma rodada só: as consultas são independentes (antes eram 4 rodadas em sequência).
  const [
    [tipos, opcoesEmp, opcoesPart, andamento],
    [funil, totalMsg, contratos, opcoesContrato, tc],
    [ofertas, opcoesOferta, to, pedidos, pedidoAberto, tpd, condicoes, diasDeAviso],
    [etapas, alcances, dataRoom, tarefas, ebook, tb],
  ] = await Promise.all([
    Promise.all([
      listarTiposDeOperacao(acesso),
      n.podeEditar ? opcoesDeEmpresas(acesso, n.id) : null,
      n.podeGerirParticipantes ? opcoesDeParticipantes(acesso, n.id) : null,
      andamentoDoNegocio(acesso, n.id),
    ]),
    Promise.all([
      funilDoNegocio(acesso, n.id),
      totaisDeMensagens(acesso, n.id),
      listarContratos(acesso, { dealId: n.id }),
      opcoesDoContrato(acesso, n.id),
      getTranslations("contratos"),
    ]),
    Promise.all([
      ofertasDoNegocio(acesso, n.id),
      opcoesDaOferta(acesso, n.id),
      getTranslations("ofertas"),
      pedidosDoNegocio(acesso, n.id),
      pedido.then((p) => (p ? obterPedido(acesso, p) : null)),
      getTranslations("pedidos"),
      condicoesDaOferta(acesso, n.id),
      obterDiasDeAvisoDoPrazo(acesso),
    ]),
    Promise.all([
      etapasDoNegocio(acesso, n.id),
      n.podeGerirParticipantes ? opcoesDeAlcance(acesso, n.id) : [],
      dataRoomDoNegocio(acesso, n.id),
      tarefasDoNegocio(acesso, n.id),
      ebookDoNegocio(acesso, n.id),
      getTranslations("ebook"),
    ]),
  ]);
  const mostraContratos = contratos.length > 0 || opcoesContrato.podeCriar;
  const tarefasAbertas = (tarefas?.tarefas ?? []).filter(
    (x) => !["concluida", "cancelada"].includes(x.situacao),
  );
  const tarefasPorEtapa: Record<string, number> = {};
  for (const x of tarefasAbertas)
    if (x.etapaId) tarefasPorEtapa[x.etapaId] = (tarefasPorEtapa[x.etapaId] ?? 0) + 1;
  const documentosPorEtapa: Record<string, number> = {};
  for (const d of dataRoom?.documentos ?? [])
    if (d.etapaId) documentosPorEtapa[d.etapaId] = (documentosPorEtapa[d.etapaId] ?? 0) + 1;
  if (!andamento) notFound();
  const hoje = hojeEmSaoPaulo();
  const temEscolhida = n.empresas.some((e) => e.situacaoFunil === "escolhida");
  const inicial: Record<string, string> = {
    codinome: n.codinome,
    nomeInterno: n.nomeInterno ?? "",
    tipoOperacaoId: n.tipoOperacaoId ?? "",
    percentual: n.percentual ? String(Number(n.percentual)).replace(".", ",") : "",
    dataInicio: n.dataInicio,
    previsaoFechamento: n.previsaoFechamento ?? "",
    valorEstimado: n.valorEstimado ? String(Number(n.valorEstimado)).replace(".", ",") : "",
    descricao: n.descricao ?? "",
  };
  // Resumo em consulta (o mesmo do painel do kanban): etapa atual, coordenadores e o funil por situação.
  const etapaAtual = etapas?.principal
    ? etapas.etapas.find((e) => e.nome === etapas.principal!.nome && e.situacao === "andamento")
    : null;
  const cartaoDoResumo = {
    id: n.id,
    nome: n.nome,
    nomeInterno: n.nomeInterno,
    situacao: n.situacao,
    etapa: etapas?.principal?.nome ?? null,
    coordenadores: n.participantes.filter((p) => p.coordenador).map((p) => p.nome),
    funil: funil
      ? Object.fromEntries(
          [...Map.groupBy(funil.cartoes, (c) => c.situacao)].map(([k, v]) => [k, v.map((c) => c.nome)]),
        )
      : null,
    prazo: null,
    nivelDoPrazo: null,
    fimDaEtapa: etapaAtual?.fimPrevisto ?? null,
    valorEstimado: n.valorEstimado ? Number(n.valorEstimado) : null,
  };
  const lado = (l: "vendedor" | "comprador" | null) =>
    l === "vendedor" ? t("ladoVendedor") : l === "comprador" ? t("ladoComprador") : null;

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-6xl">
          <Link href="/negocios" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {n.nome}
          </Titulo>
          <p className="text-muted -mt-2 mb-4 text-sm">
            {[
              n.nomeInterno,
              n.tipo,
              ts(n.situacao),
              etapas?.principal &&
                (etapas.principal.paralelas
                  ? t("etapaComParalelas", { etapa: etapas.principal.nome, n: etapas.principal.paralelas })
                  : t("etapaAtual", { etapa: etapas.principal.nome })),
              n.objeto === "grupo" && n.grupo && t("grupo", { grupo: n.grupo }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {!n.podeVerVendedora && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoSigilo")}
            </p>
          )}
          {etapas && etapas.etapas.length > 0 && (
            <div className="mb-6">
              <LinhaDasEtapas
                etapas={etapas.etapas}
                hoje={hoje}
                dias={diasDeAviso}
                atalho={
                  funil || ofertas
                    ? { href: `/negocios/${n.id}?aba=compradoras`, rotulo: t("abaCompradoras") }
                    : null
                }
              />
            </div>
          )}
          <Abas
            key={(await aba) ?? ""}
            vertical
            inicial={ABA_ANTIGA[(await aba) ?? ""] ?? (await aba)}
            abas={[
              { id: "resumo", rotulo: t("abaResumo"), grupo: t("grupoNegocio") },
              { id: "dados", rotulo: t("abaDadosGerais"), grupo: t("grupoNegocio") },
              ...(etapas ? [{ id: "etapas", rotulo: t("abaEtapas"), grupo: t("grupoNegocio") }] : []),
              {
                id: "pessoas",
                rotulo: `${t("abaPessoas")} (${n.empresas.length + n.participantes.length})`,
                grupo: t("grupoNegocio"),
              },
              ...(andamento.verExclusividade && (andamento.exclusividade || temEscolhida)
                ? [{ id: "exclusividade", rotulo: t("abaExclusividade"), grupo: t("grupoNegocio") }]
                : []),
              { id: "historico", rotulo: t("abaHistorico"), grupo: t("grupoNegocio") },
              {
                id: "atividade",
                rotulo:
                  totalMsg && totalMsg.novas > 0
                    ? `${t("abaAtividade")} (${tarefasAbertas.length}) · ${tm("novas", { n: totalMsg.novas })}`
                    : `${t("abaAtividade")} (${tarefasAbertas.length + (totalMsg?.total ?? 0)})`,
                grupo: t("grupoTrabalho"),
              },
              ...(dataRoom
                ? [
                    {
                      id: "documentos",
                      rotulo: `${t("abaDocumentos")} (${dataRoom.documentos.length})`,
                      grupo: t("grupoTrabalho"),
                    },
                  ]
                : []),
              ...(pedidos
                ? [
                    {
                      id: "pedidos",
                      rotulo: `${tpd("aba")} (${pedidos.pedidos.length})`,
                      grupo: t("grupoTrabalho"),
                    },
                  ]
                : []),
              ...(funil || ofertas
                ? [
                    {
                      id: "compradoras",
                      rotulo: `${t("abaCompradoras")} (${funil?.cartoes.length ?? ofertas?.ofertas.length ?? 0})`,
                      grupo: t("grupoComercial"),
                    },
                  ]
                : []),
              ...(ebook ? [{ id: "ebook", rotulo: tb("aba"), grupo: t("grupoComercial") }] : []),
              ...(condicoes
                ? [{ id: "condicoes", rotulo: to("condicoesDaOferta.aba"), grupo: t("grupoComercial") }]
                : []),
              ...(mostraContratos
                ? [
                    {
                      id: "contratos",
                      rotulo: `${tc("titulo")} (${contratos.length})`,
                      grupo: t("grupoComercial"),
                    },
                  ]
                : []),
            ]}
          >
            <PainelDeAba id="resumo">
              <ResumoDoNegocio
                painel={{
                  tarefas,
                  resumo: {
                    nomeInterno: n.nomeInterno,
                    tipo: n.tipo,
                    dataInicio: n.dataInicio,
                    previsaoFechamento: n.previsaoFechamento,
                    valorEstimado: n.valorEstimado,
                    descricao: n.descricao,
                  },
                }}
                cartao={cartaoDoResumo}
                hoje={hoje}
                dias={diasDeAviso}
              />
            </PainelDeAba>
            <PainelDeAba id="dados">
              <FormDadosDoNegocio
                id={n.id}
                inicial={inicial}
                tipos={tipos}
                podeSalvar={n.podeEditar}
                mostraNomeInterno={n.podeVerVendedora}
              />
              <PainelSituacao
                dealId={n.id}
                situacao={andamento.situacao}
                podeMudar={andamento.podeMudarSituacao}
                podeReabrir={andamento.podeReabrir}
                podeEncerrarExternos={andamento.podeEncerrarExternos}
              />
              {andamento.motivoEncerramento && (
                <p className="text-muted mt-2 text-sm">
                  {tt("motivoRegistrado", { motivo: tt(`motivos.${andamento.motivoEncerramento}`) })}
                </p>
              )}
              {acesso.administrador && estaLigada("exportacaoDoNegocio") && (
                <div className="border-border mt-6 border-t pt-4">
                  <ExportarNegocio dealId={n.id} />
                </div>
              )}
              {n.podeExcluir && (
                <div className="border-border mt-6 border-t pt-4">
                  <BotaoDeAcao
                    acao={excluirNegocioAcao}
                    campos={{ id: n.id }}
                    rotulo={t("excluir")}
                    confirmar={t("confirmarExcluir", { nome: n.nome })}
                    perigo
                  />
                </div>
              )}
            </PainelDeAba>
            <PainelDeAba id="pessoas">
              <div className="grid gap-8 xl:grid-cols-2">
                <section aria-label={t("abaEmpresas")}>
                  <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                    {`${t("abaEmpresas")} (${n.empresas.length})`}
                  </h3>
                  <ul className="divide-border divide-y text-sm">
                    {n.empresas.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">{e.nome}</span>
                          {e.doContratante && (
                            <span className="text-primary ml-2 text-xs font-medium">{te("contratante")}</span>
                          )}
                          <span className="text-muted block text-xs">
                            {[
                              e.papel,
                              lado(e.lado),
                              e.situacaoFunil && tf(e.situacaoFunil),
                              e.atuaPara && te("trabalhaPara", { nome: e.atuaPara }),
                              e.cnpj && formatarCnpj(e.cnpj),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {n.podeEditar && (
                          <BotaoDeAcao
                            acao={removerEmpresaDoNegocioAcao}
                            campos={{ dealId: n.id, id: e.id }}
                            rotulo={te("remover")}
                            confirmar={te("confirmarRemover", { nome: e.nome, papel: e.papel })}
                            perigo
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                  {opcoesEmp && (
                    <FormIncluirEmpresa
                      dealId={n.id}
                      papeis={opcoesEmp.papeis}
                      empresas={opcoesEmp.empresas}
                      compradoras={n.compradoras}
                    />
                  )}
                </section>
                <section aria-label={t("abaParticipantes")}>
                  <h3 className="text-muted mb-1 text-xs font-semibold tracking-wider uppercase">
                    {`${t("abaParticipantes")} (${n.participantes.length})`}
                  </h3>
                  <ListaPaginada
                    className="divide-border divide-y text-sm"
                    itens={n.participantes.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">{p.nome}</span>
                          <span className="text-muted block text-xs">
                            {[
                              p.perfil ?? tp("contato"),
                              p.empresa ? tp("representando", { empresa: p.empresa }) : null,
                              lado(p.lado),
                              p.prazo && tp("ate", { data: p.prazo.split("-").reverse().join("/") }),
                              p.alcance && tp("alcanceEtapas", { etapas: p.alcance.join(", ") }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {n.podeGerirParticipantes && (
                          <BotaoDeAcao
                            acao={removerParticipanteAcao}
                            campos={{ dealId: n.id, id: p.id }}
                            rotulo={tp("remover")}
                            confirmar={tp("confirmarRemover", { nome: p.nome })}
                            perigo
                          />
                        )}
                      </li>
                    ))}
                  />
                  {opcoesPart && (
                    <FormIncluirParticipante
                      dealId={n.id}
                      pessoas={opcoesPart.pessoas}
                      perfis={opcoesPart.perfis}
                      etapas={alcances}
                    />
                  )}
                </section>
              </div>
            </PainelDeAba>
            {(funil || ofertas) && (
              <PainelDeAba id="compradoras">
                <div className="space-y-8">
                  {funil && (
                    <section>
                      <h3 className="text-text mb-3 text-base font-semibold">
                        {`${t("abaFunil")} (${funil.cartoes.length})`}
                      </h3>
                      <KanbanDoFunil dealId={n.id} cartoes={funil.cartoes} podeEditar={funil.podeEditar} />
                    </section>
                  )}
                  {ofertas && (
                    <section className={funil ? "border-border border-t pt-6" : ""}>
                      <h3 className="text-text mb-3 text-base font-semibold">
                        {`${to("titulo")} (${ofertas.ofertas.length})`}
                      </h3>
                      <AbaDeOfertas dealId={n.id} dados={ofertas} opcoes={opcoesOferta} />
                    </section>
                  )}
                </div>
              </PainelDeAba>
            )}
            {ebook && (
              <PainelDeAba id="ebook">
                <AbaDoEbook dealId={n.id} dados={ebook} simulado={estaSimulada("ebook")} />
              </PainelDeAba>
            )}
            {condicoes && (
              <PainelDeAba id="condicoes">
                <CondicoesDaOfertaEscolhida dealId={n.id} dados={condicoes} />
              </PainelDeAba>
            )}
            {etapas && (
              <PainelDeAba id="etapas">
                <EtapasDoNegocio
                  dealId={n.id}
                  etapas={etapas.etapas}
                  podeIncluir={etapas.podeIncluir}
                  podeExcluir={etapas.podeExcluir}
                  hoje={hoje}
                  documentosPorEtapa={documentosPorEtapa}
                  tarefasPorEtapa={tarefasPorEtapa}
                  diagrama={modoDa("diagramaDeEtapas")}
                />
              </PainelDeAba>
            )}
            <PainelDeAba id="atividade">
              <Alternador
                parametro="vista"
                inicial={(await aba) === "mensagens" || (await conversa).alvo ? "mensagens" : await vista}
                partes={[
                  ...(tarefas
                    ? [
                        {
                          id: "tarefas",
                          rotulo: `${t("abaTarefas")} (${tarefasAbertas.length})`,
                          conteudo: (
                            <TarefasDoNegocio
                              dealId={n.id}
                              quadro={tarefas}
                              etapaFiltro={(await etapa) ?? ""}
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    id: "mensagens",
                    rotulo:
                      totalMsg && totalMsg.novas > 0
                        ? tm("abaComNovas", totalMsg)
                        : tm("abaComTotal", { total: totalMsg?.total ?? 0 }),
                    conteudo: (
                      <AbaDeMensagens
                        dealId={n.id}
                        conversaInicial={(await conversa).alvo}
                        canalInicial={(await conversa).canal}
                      />
                    ),
                  },
                ]}
              />
            </PainelDeAba>
            {dataRoom && (
              <PainelDeAba id="documentos">
                <DataRoomDoNegocio dealId={n.id} dr={dataRoom} etapaFiltro={(await etapa) ?? ""} />
              </PainelDeAba>
            )}
            {pedidos && (
              <PainelDeAba id="pedidos">
                <AbaDePedidos
                  dealId={n.id}
                  dados={pedidos}
                  detalhe={pedidoAberto && pedidoAberto.dealId === n.id ? pedidoAberto : null}
                />
              </PainelDeAba>
            )}
            {mostraContratos && (
              <PainelDeAba id="contratos">
                {opcoesContrato.podeCriar && (
                  <div className="mb-3 flex justify-end">
                    <Link
                      href={"/contratos/novo?negocio=" + n.id}
                      className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                    >
                      {tc("novo")}
                    </Link>
                  </div>
                )}
                <TabelaDeContratos contratos={contratos} mostrarNegocio={false} />
              </PainelDeAba>
            )}
            <PainelDeAba id="exclusividade">
              <PainelExclusividade
                dealId={n.id}
                exclusividade={andamento.exclusividade}
                podeEditar={n.podeEditar}
                hoje={hoje}
              />
            </PainelDeAba>
            <PainelDeAba id="historico">
              <HistoricoPaginado
                eventos={andamento.historico.map((h) => ({
                  texto: th.has(`tipos.${h.tipo.replaceAll(".", "_")}`)
                    ? th(
                        `tipos.${h.tipo.replaceAll(".", "_")}`,
                        traduzirParametros(h.tipo, h.parametros, ts, tf),
                      )
                    : h.tipo,
                  detalhe: [h.ator, h.quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]
                    .filter(Boolean)
                    .join(" · "),
                }))}
              />
            </PainelDeAba>
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/negocios/[id]">) {
  return (
    <Suspense fallback={<EsqueletoDoNegocio />}>
      <Painel
        id={params.then((p) => p.id)}
        aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))}
        etapa={searchParams.then((q) => (typeof q.etapa === "string" ? q.etapa : undefined))}
        pedido={searchParams.then((q) => (typeof q.pedido === "string" ? q.pedido : undefined))}
        vista={searchParams.then((q) => (typeof q.vista === "string" ? q.vista : undefined))}
        conversa={searchParams.then((q) => ({
          alvo: typeof q.conversa === "string" ? q.conversa : undefined,
          canal: typeof q.canal === "string" ? q.canal : undefined,
        }))}
      />
    </Suspense>
  );
}
