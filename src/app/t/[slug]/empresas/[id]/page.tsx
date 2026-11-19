import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { excluirEmpresaAcao, inativarEmpresaAcao, removerVinculoAcao } from "@/app/acoes/cadastros";
import { obterAcesso } from "@/server/services/acesso";
import { listarTiposDeVinculo } from "@/server/services/cadastros";
import { CATEGORIAS_DE_EMPRESA, listarAnexos } from "@/server/services/anexos";
import { listarGrupos, obterEmpresa } from "@/server/services/empresas";
import { AnexosDoCadastro } from "@/components/cadastros/anexos";
import { listarPessoas } from "@/server/services/pessoas";
import { pode } from "@/server/services/permissoes/verificador";
import { formatarCep, formatarCnpj } from "@/config/documentos";
import { AcessoDaPessoa } from "@/components/cadastros/acesso-da-pessoa";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormEmpresa, FormNovoVinculo, SociosDaReceita } from "@/components/cadastros/formularios";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

async function Painel({ id }: { id: Promise<string> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "empresas", "ver"))) notFound();
  const t = await getTranslations("cadastros.empresas");
  const e = await obterEmpresa(acesso, await id);
  if (!e) notFound();
  const tAnexos = await getTranslations("cadastros.anexos");
  const [grupos, podeEditar, podeExcluir, podeCriar, podeBaixar, anexos] = await Promise.all([
    listarGrupos(acesso),
    pode(acesso, "empresas", "editar"),
    pode(acesso, "empresas", "excluir"),
    pode(acesso, "empresas", "criar"),
    pode(acesso, "empresas", "baixar"),
    listarAnexos(acesso, { tipo: "empresa", id: e.id }),
  ]);
  const [tipos, pessoas] = podeEditar
    ? await Promise.all([listarTiposDeVinculo(acesso), listarPessoas(acesso)])
    : [[], []];
  const inicial = Object.fromEntries(
    Object.entries(e).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  ) as Record<string, string>;
  inicial.cnpj = e.cnpj ? formatarCnpj(e.cnpj) : "";
  inicial.cep = e.cep ? formatarCep(e.cep) : "";
  inicial.grupoId = e.grupoId ?? "";

  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 flex-wrap items-start justify-start gap-6 px-3 py-6 sm:px-6">
        <Cartao largura="max-w-2xl">
          <Link href="/empresas" className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo sobre={e.doContratante ? t("sobreContratante") : t("sobreEmpresa")}>{e.razaoSocial}</Titulo>
          {e.inativaEm && (
            <p className="text-warning bg-warning-surface mb-4 rounded-md px-3 py-2 text-sm">
              {t("avisoInativa")}
            </p>
          )}
          <FormEmpresa id={e.id} inicial={inicial} grupos={grupos} podeSalvar={podeEditar} />
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
        </Cartao>
        <div className="flex w-full max-w-md flex-col gap-6">
          <Cartao largura="max-w-md">
            <Titulo sobre={t("sobreEmpresa")}>{t("pessoasVinculadas")}</Titulo>
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
              <FormNovoVinculo
                empresaId={e.id}
                pessoas={pessoas.filter((p) => !p.inativa).map((p) => ({ id: p.id, nome: p.nome }))}
                tipos={tipos}
              />
            )}
          </Cartao>
          <Cartao largura="max-w-md">
            <Titulo sobre={tAnexos("sobre")}>{tAnexos("titulo")}</Titulo>
            <AnexosDoCadastro
              alvo={{ tipo: "empresa", id: e.id }}
              anexos={anexos}
              categorias={CATEGORIAS_DE_EMPRESA}
              podeEnviar={podeEditar}
              podeBaixar={podeBaixar}
            />
          </Cartao>
          {e.cnpj && podeCriar && podeEditar && (
            <Cartao largura="max-w-md">
              <Titulo sobre={t("receitaFederal")}>{t("quadroDeSocios")}</Titulo>
              <p className="text-muted mb-3 text-sm">{t("sociosExplicacao")}</p>
              <SociosDaReceita
                empresaId={e.id}
                cnpj={e.cnpj}
                jaCadastrados={e.vinculos.map((v) => v.pessoa)}
              />
            </Cartao>
          )}
        </div>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params }: PageProps<"/t/[slug]/empresas/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel id={params.then((p) => p.id)} />
    </Suspense>
  );
}
