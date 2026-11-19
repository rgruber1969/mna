import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { listarPapeis, listarTiposDeVinculo, perfisDeDeal } from "@/server/services/cadastros";
import { listarEtapasPadrao } from "@/server/services/etapas";
import { listarCategorias } from "@/server/services/documentos";
import { listarTiposDeOperacao } from "@/server/services/negocios";
import { obterDiasDeAviso } from "@/server/services/negocios-andamento";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormConfiguracoes } from "@/components/negocios/andamento";
import { TabelaDeEtapas, TabelaDePapeis, TabelaDeTipos } from "@/components/cadastros/configuracoes";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { Cartao, Carregando, Titulo } from "@/components/ui/basicos";

/**
 * Configurações do tenant: regras gerais (administradores) e cadastros
 * auxiliares (permissão "Cadastros gerais"), em abas por assunto.
 */
async function Painel({ aba }: { aba: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const verCadastros = await pode(acesso, "cadastros", "ver");
  if (!acesso.administrador && !verCadastros) notFound();
  const t = await getTranslations("configuracoes");
  const [podeCriar, podeEditar, podeExcluir] = await Promise.all([
    pode(acesso, "cadastros", "criar"),
    pode(acesso, "cadastros", "editar"),
    pode(acesso, "cadastros", "excluir"),
  ]);
  const [dias, papeis, perfis, vinculos, operacoes, etapas, categorias] = await Promise.all([
    acesso.administrador ? obterDiasDeAviso(acesso) : null,
    verCadastros ? listarPapeis(acesso) : [],
    verCadastros ? perfisDeDeal(acesso) : [],
    verCadastros ? listarTiposDeVinculo(acesso) : [],
    verCadastros ? listarTiposDeOperacao(acesso) : [],
    verCadastros ? listarEtapasPadrao(acesso) : [],
    verCadastros ? listarCategorias(acesso) : [],
  ]);
  const permissoes = { podeCriar, podeEditar, podeExcluir };
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-5xl">
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {t("titulo")}
          </Titulo>
          <Abas
            inicial={await aba}
            abas={[
              ...(dias ? [{ id: "geral", rotulo: t("abaGeral") }] : []),
              ...(verCadastros
                ? [
                    { id: "papeis", rotulo: t("abaPapeis") },
                    { id: "vinculos", rotulo: t("abaVinculos") },
                    { id: "operacoes", rotulo: t("abaOperacoes") },
                    { id: "etapas", rotulo: t("abaEtapas") },
                    { id: "categorias", rotulo: t("abaCategorias") },
                  ]
                : []),
            ]}
          >
            {dias && (
              <PainelDeAba id="geral">
                <FormConfiguracoes dias={dias} />
              </PainelDeAba>
            )}
            {verCadastros && (
              <>
                <PainelDeAba id="papeis">
                  <TabelaDePapeis papeis={papeis} perfis={perfis} {...permissoes} />
                </PainelDeAba>
                <PainelDeAba id="vinculos">
                  <TabelaDeTipos tipos={vinculos} qual="vinculo" {...permissoes} />
                </PainelDeAba>
                <PainelDeAba id="operacoes">
                  <TabelaDeTipos tipos={operacoes} qual="operacao" {...permissoes} />
                </PainelDeAba>
                <PainelDeAba id="etapas">
                  <TabelaDeEtapas etapas={etapas} {...permissoes} />
                </PainelDeAba>
                <PainelDeAba id="categorias">
                  <TabelaDeTipos
                    tipos={categorias.map((c) => ({ ...c, comPercentual: false }))}
                    qual="categoria"
                    {...permissoes}
                  />
                </PainelDeAba>
              </>
            )}
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/configuracoes">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))} />
    </Suspense>
  );
}
