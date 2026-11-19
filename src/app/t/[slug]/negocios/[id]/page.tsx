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
import {
  FormDadosDoNegocio,
  FormIncluirEmpresa,
  FormIncluirParticipante,
} from "@/components/negocios/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { KanbanDoFunil, PainelExclusividade, PainelSituacao } from "@/components/negocios/andamento";
import { etapasDoNegocio, opcoesDeAlcance } from "@/server/services/etapas";
import { EtapasDoNegocio } from "@/components/negocios/etapas";
import { andamentoDoNegocio, funilDoNegocio, hojeEmSaoPaulo } from "@/server/services/negocios-andamento";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

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
async function Painel({ id, aba }: { id: Promise<string>; aba: Promise<string | undefined> }) {
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
  const [tipos, opcoesEmp, opcoesPart, andamento] = await Promise.all([
    listarTiposDeOperacao(acesso),
    n.podeEditar ? opcoesDeEmpresas(acesso, n.id) : null,
    n.podeGerirParticipantes ? opcoesDeParticipantes(acesso, n.id) : null,
    andamentoDoNegocio(acesso, n.id),
  ]);
  const funil = await funilDoNegocio(acesso, n.id);
  const [etapas, alcances] = await Promise.all([
    etapasDoNegocio(acesso, n.id),
    n.podeGerirParticipantes ? opcoesDeAlcance(acesso, n.id) : [],
  ]);
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
          <Abas
            inicial={await aba}
            abas={[
              { id: "resumo", rotulo: t("abaResumo") },
              ...(etapas ? [{ id: "etapas", rotulo: t("abaEtapas") }] : []),
              ...(funil ? [{ id: "funil", rotulo: `${t("abaFunil")} (${funil.cartoes.length})` }] : []),
              { id: "empresas", rotulo: `${t("abaEmpresas")} (${n.empresas.length})` },
              { id: "participantes", rotulo: `${t("abaParticipantes")} (${n.participantes.length})` },
              ...(andamento.verExclusividade && (andamento.exclusividade || temEscolhida)
                ? [{ id: "exclusividade", rotulo: t("abaExclusividade") }]
                : []),
              { id: "historico", rotulo: t("abaHistorico") },
            ]}
          >
            <PainelDeAba id="resumo">
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
            <PainelDeAba id="empresas">
              <ul className="divide-border divide-y text-sm">
                {n.empresas.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{e.nome}</span>
                      {e.doContratante && (
                        <span className="text-accent ml-2 text-xs font-medium">{te("contratante")}</span>
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
            </PainelDeAba>
            <PainelDeAba id="participantes">
              <ul className="divide-border divide-y text-sm">
                {n.participantes.map((p) => (
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
              </ul>
              {opcoesPart && (
                <FormIncluirParticipante
                  dealId={n.id}
                  pessoas={opcoesPart.pessoas}
                  perfis={opcoesPart.perfis}
                  etapas={alcances}
                />
              )}
            </PainelDeAba>
            {funil && (
              <PainelDeAba id="funil">
                <KanbanDoFunil dealId={n.id} cartoes={funil.cartoes} podeEditar={funil.podeEditar} />
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
                />
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
              {andamento.historico.length === 0 ? (
                <p className="text-muted text-sm">{th("nenhum")}</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {andamento.historico.map((h, i) => (
                    <li key={i} className="py-2">
                      <span>
                        {th.has(`tipos.${h.tipo.replaceAll(".", "_")}`)
                          ? th(
                              `tipos.${h.tipo.replaceAll(".", "_")}`,
                              traduzirParametros(h.tipo, h.parametros, ts, tf),
                            )
                          : h.tipo}
                      </span>
                      <span className="text-muted block text-xs">
                        {[h.ator, h.quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PainelDeAba>
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/negocios/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel
        id={params.then((p) => p.id)}
        aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))}
      />
    </Suspense>
  );
}
