import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { connection } from "next/server";
import { BANCOS, listarContasBancarias } from "@/server/services/contas-bancarias";
import { ContasBancarias } from "@/components/cadastros/contas-bancarias";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { excluirEmpresaAcao, inativarEmpresaAcao, removerVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarTiposDeVinculo } from "@/server/services/cadastros";
import { CATEGORIAS_DE_EMPRESA, listarAnexos } from "@/server/services/anexos";
import { listarEmpresas, listarGrupos, obterEmpresa } from "@/server/services/empresas";
import { listarParticipacoes } from "@/server/services/participacoes";
import { removerParticipacaoAcao } from "@/app/acoes/cadastros";
import { AnexosDoCadastro } from "@/components/cadastros/anexos";
import { listarPessoas } from "@/server/services/pessoas";
import { pode } from "@/server/services/permissoes/verificador";
import { formatarCep, formatarCnpj } from "@/config/documentos";
import { AcessoDaPessoa } from "@/components/cadastros/acesso-da-pessoa";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import {
  FormEmpresa,
  FormNovaParticipacao,
  FormNovoVinculo,
  SociosDaReceita,
} from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Titulo } from "@/components/ui/basicos";
import { Abas, PainelDeAba } from "@/components/ui/abas";

async function Painel({ id, aba }: { id: Promise<string>; aba: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const t = await getTranslations("cadastros.empresas");
  const e = await obterEmpresa(acesso, await id);
  if (!e) notFound();
  const [grupos, podeEditar, podeExcluir, podeCriar, podeBaixar, anexos] = await Promise.all([
    listarGrupos(acesso),
    pode(acesso, "empresas", "editar"),
    pode(acesso, "empresas", "excluir"),
    pode(acesso, "empresas", "criar"),
    pode(acesso, "empresas", "baixar"),
    listarAnexos(acesso, { tipo: "empresa", id: e.id }),
  ]);
  const contas = await listarContasBancarias(acesso, { tipo: "empresa", id: e.id });
  const [tipos, pessoas, todasEmpresas] = podeEditar
    ? await Promise.all([listarTiposDeVinculo(acesso), listarPessoas(acesso), listarEmpresas(acesso)])
    : [[], [], []];
  const participacoes = await listarParticipacoes(acesso, e.id);
  const tPart = await getTranslations("cadastros.participacoes");
  const inicial = Object.fromEntries(
    Object.entries(e).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  ) as Record<string, string>;
  inicial.cnpj = e.cnpj ? formatarCnpj(e.cnpj) : "";
  inicial.cep = e.cep ? formatarCep(e.cep) : "";
  inicial.grupoId = e.grupoId ?? "";
  const tAbas = await getTranslations("cadastros.abas");
  const abaInicial = await aba;
  const comReceita = Boolean(e.cnpj && podeCriar && podeEditar);

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Link href="/empresas" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={e.doContratante ? t("sobreContratante") : t("sobreEmpresa")}>{e.razaoSocial}</Titulo>
          {e.doContratante && !e.cnpj && !e.identificadorEstrangeiro && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoContratanteSemCnpj")}
            </p>
          )}
          {e.inativaEm && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoInativa")}
            </p>
          )}
          <Abas
            inicial={abaInicial}
            abas={[
              { id: "dados", rotulo: tAbas("dados") },
              { id: "endereco", rotulo: tAbas("endereco") },
              { id: "pessoas", rotulo: `${tAbas("pessoas")} (${e.vinculos.length})` },
              {
                id: "participacoes",
                rotulo: `${tAbas("participacoes")} (${participacoes.socias.length + participacoes.participaEm.length})`,
              },
              { id: "bancarios", rotulo: `${tAbas("bancarios")} (${contas.length})` },
              { id: "anexos", rotulo: `${tAbas("anexos")} (${anexos.length})` },
              ...(comReceita ? [{ id: "receita", rotulo: tAbas("receita") }] : []),
            ]}
          >
            <FormEmpresa id={e.id} inicial={inicial} grupos={grupos} podeSalvar={podeEditar} />
            <PainelDeAba id="dados">
              {(podeEditar || podeExcluir) && !e.doContratante && (
                <div className="border-border mt-6 flex flex-wrap gap-3 border-t pt-4">
                  {podeEditar && (
                    <BotaoDeAcao
                      acao={inativarEmpresaAcao}
                      campos={{ id: e.id, inativa: e.inativaEm ? "nao" : "sim" }}
                      rotulo={e.inativaEm ? t("reativar") : t("inativar")}
                    />
                  )}
                  {podeExcluir && (
                    <BotaoDeAcao
                      acao={excluirEmpresaAcao}
                      campos={{ id: e.id }}
                      rotulo={t("excluirEmpresa")}
                      confirmar={t("confirmarExcluir", { nome: e.razaoSocial })}
                      perigo
                    />
                  )}
                </div>
              )}
            </PainelDeAba>
            <PainelDeAba id="pessoas">
              {e.vinculos.length === 0 ? (
                <p className="text-muted text-sm">{t("nenhumaPessoaVinculada")}</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {e.vinculos.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-2 py-2">
                      <span>
                        <Link href={`/pessoas/${v.pessoaId}`} className="text-primary font-medium">
                          {v.pessoa}
                        </Link>
                        <span className="text-muted block text-xs">
                          {[v.tipo, v.cargo, v.percentual && `${Number(v.percentual)}%`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <AcessoDaPessoa
                          acesso={v.acesso}
                          nome={v.pessoa}
                          email={v.email}
                          podeConvidar={acesso.administrador}
                        />
                        {podeEditar && (
                          <BotaoDeAcao
                            acao={removerVinculoAcao}
                            campos={{ id: v.id }}
                            rotulo={t("remover")}
                            perigo
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {podeEditar && (
                <div className="max-w-md">
                  <FormNovoVinculo
                    empresaId={e.id}
                    pessoas={pessoas.filter((p) => !p.inativa).map((p) => ({ id: p.id, nome: p.nome }))}
                    tipos={tipos}
                  />
                </div>
              )}
            </PainelDeAba>
            <PainelDeAba id="participacoes">
              <div className="grid gap-6 md:grid-cols-2">
                {(
                  [
                    ["socias", participacoes.socias, tPart("nenhumaSocia")],
                    ["participaEm", participacoes.participaEm, tPart("nenhumaParticipacao")],
                  ] as const
                ).map(([chave, lista, vazio]) => (
                  <div key={chave}>
                    <p className="text-accent mb-2 text-xs font-semibold tracking-widest uppercase">
                      {tPart(chave)}
                    </p>
                    {lista.length === 0 ? (
                      <p className="text-muted text-sm">{vazio}</p>
                    ) : (
                      <ul className="divide-border divide-y text-sm">
                        {lista.map((p) => (
                          <li key={p.id} className="flex items-start justify-between gap-2 py-2">
                            <span>
                              <Link href={`/empresas/${p.empresaId}`} className="text-primary font-medium">
                                {p.nome}
                              </Link>
                              <span className="text-muted block text-xs">
                                {[
                                  p.cnpj && formatarCnpj(p.cnpj),
                                  p.qualificacao,
                                  p.percentual && `${Number(p.percentual)}%`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            {podeEditar && (
                              <BotaoDeAcao
                                acao={removerParticipacaoAcao}
                                campos={{ id: p.id }}
                                rotulo={tPart("remover")}
                                perigo
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {podeEditar && (
                <div className="max-w-md">
                  <FormNovaParticipacao
                    empresaId={e.id}
                    empresas={todasEmpresas
                      .filter((x) => x.id !== e.id && !x.inativa)
                      .map((x) => ({ id: x.id, nome: x.razaoSocial }))}
                  />
                </div>
              )}
            </PainelDeAba>
            <PainelDeAba id="bancarios">
              <ContasBancarias
                alvo={{ tipo: "empresa", id: e.id }}
                contas={contas}
                bancos={BANCOS}
                podeEditar={podeEditar}
                podeRevelar={true}
              />
            </PainelDeAba>
            <PainelDeAba id="anexos">
              <div className="max-w-xl">
                <AnexosDoCadastro
                  alvo={{ tipo: "empresa", id: e.id }}
                  anexos={anexos}
                  categorias={CATEGORIAS_DE_EMPRESA}
                  podeEnviar={podeEditar}
                  podeBaixar={podeBaixar}
                />
              </div>
            </PainelDeAba>
            {comReceita && (
              <PainelDeAba id="receita">
                <div className="max-w-xl">
                  <p className="text-muted mb-3 text-sm">{t("sociosExplicacao")}</p>
                  <SociosDaReceita
                    empresaId={e.id}
                    cnpj={e.cnpj!}
                    jaCadastrados={[
                      ...e.vinculos.map((v) => v.pessoa),
                      ...participacoes.socias.map((p) => p.nome),
                    ]}
                  />
                </div>
              </PainelDeAba>
            )}
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/empresas/[id]">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel
        id={params.then((p) => p.id)}
        aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))}
      />
    </Suspense>
  );
}
