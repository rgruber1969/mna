import { EsqueletoDeTela } from "@/components/ui/esqueletos";
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
import { listarFontes, obterPrioridades } from "@/server/services/pedidos";
import { FormPrioridades, TabelaDeFontes } from "@/components/pedidos/configuracoes";
import {
  hojeEmSaoPaulo,
  obterDiasDeAviso,
  obterDiasDeAvisoDoPrazo,
  obterDiasDeLembreteDeTarefa,
  obterDiasDeCompradoraParada,
} from "@/server/services/negocios-andamento";
import { FormPainelPrincipal } from "@/components/cadastros/painel-principal";
import { GatilhosDeTarefas } from "@/components/cadastros/gatilhos";
import { estaLigada, estaSimulada } from "@/config/funcionalidades";
import { telaDeTemplates } from "@/server/services/templates";
import { ListaDeTemplates } from "@/components/templates/lista";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { pode } from "@/server/services/permissoes/verificador";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { FormConfiguracoes } from "@/components/negocios/andamento";
import { obterHorasDoResumo } from "@/server/services/mensagens";
import { TabelaDeEtapas, TabelaDePapeis, TabelaDeTipos } from "@/components/cadastros/configuracoes";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { PainelDeIdentidade } from "@/components/identidade/painel";
import { PainelDeChaves } from "@/components/chaves/painel";
import { Cartao, Titulo } from "@/components/ui/basicos";

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
  const [
    dias,
    papeis,
    perfis,
    vinculos,
    operacoes,
    etapas,
    categorias,
    diasTarefa,
    horasResumo,
    diasPrazo,
    fontes,
    prioridades,
    templates,
    diasParada,
  ] = await Promise.all([
    acesso.administrador ? obterDiasDeAviso(acesso) : null,
    verCadastros ? listarPapeis(acesso) : [],
    verCadastros ? perfisDeDeal(acesso) : [],
    verCadastros ? listarTiposDeVinculo(acesso) : [],
    verCadastros ? listarTiposDeOperacao(acesso) : [],
    verCadastros ? listarEtapasPadrao(acesso) : [],
    verCadastros ? listarCategorias(acesso) : [],
    acesso.administrador ? obterDiasDeLembreteDeTarefa(acesso) : [],
    acesso.administrador ? obterHorasDoResumo(acesso) : 1,
    acesso.administrador ? obterDiasDeAvisoDoPrazo(acesso) : 7,
    verCadastros ? listarFontes(acesso) : [],
    verCadastros ? obterPrioridades(acesso) : [],
    verCadastros && estaLigada("templatesDocx") ? telaDeTemplates(acesso) : null,
    acesso.administrador ? obterDiasDeCompradoraParada(acesso) : 30,
  ]);
  const tt = await getTranslations("templates");
  const comTemplates = templates && !("erro" in templates) ? templates : null;
  // Abas verticais em dois grupos (assunto), em ordem alfabética dentro de cada grupo.
  const porNome = (x: { rotulo: string }, y: { rotulo: string }) => x.rotulo.localeCompare(y.rotulo, "pt-BR");
  const doTenant = acesso.administrador
    ? [
        { id: "geral", rotulo: t("abaGeral") },
        { id: "painel", rotulo: t("abaPainel") },
        { id: "identidade", rotulo: t("abaIdentidade") },
        { id: "chaves", rotulo: t("abaChaves") },
        ...(estaLigada("gatilhosDeTarefas") ? [{ id: "gatilhos", rotulo: t("abaGatilhos") }] : []),
      ].sort(porNome)
    : [];
  const cadastros = verCadastros
    ? [
        { id: "papeis", rotulo: t("abaPapeis") },
        { id: "vinculos", rotulo: t("abaVinculos") },
        { id: "operacoes", rotulo: t("abaOperacoes") },
        { id: "etapas", rotulo: t("abaEtapas") },
        { id: "categorias", rotulo: t("abaCategorias") },
        { id: "fontes", rotulo: t("abaFontes") },
        { id: "prioridades", rotulo: t("abaPrioridades") },
        ...(comTemplates ? [{ id: "templates", rotulo: tt("titulo") }] : []),
      ].sort(porNome)
    : [];
  const abas = [
    ...doTenant.map((a) => ({ ...a, grupo: t("grupoTenant") })),
    ...cadastros.map((a) => ({ ...a, grupo: t("grupoCadastros") })),
  ];
  const pedida = await aba;
  const abaInicial = abas.some((a) => a.id === pedida) ? pedida : doTenant.length ? "geral" : abas[0]?.id;
  const permissoes = { podeCriar, podeEditar, podeExcluir };
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-[1600px]">
          <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
            {t("titulo")}
          </Titulo>
          <Abas vertical inicial={abaInicial} abas={abas}>
            {dias && (
              <PainelDeAba id="geral">
                <FormConfiguracoes
                  dias={dias}
                  diasTarefa={diasTarefa}
                  horasResumo={horasResumo}
                  diasParada={diasParada}
                />
              </PainelDeAba>
            )}
            {dias && (
              <PainelDeAba id="painel">
                <FormPainelPrincipal dias={diasPrazo} hoje={hojeEmSaoPaulo()} />
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
                <PainelDeAba id="fontes">
                  <TabelaDeFontes fontes={fontes} {...permissoes} />
                </PainelDeAba>
                <PainelDeAba id="prioridades">
                  <FormPrioridades prioridades={prioridades} podeEditar={podeEditar} />
                </PainelDeAba>
                {comTemplates && (
                  <PainelDeAba id="templates">
                    <p className="text-muted mb-3 text-sm">{tt("ajuda")}</p>
                    {estaSimulada("templatesDocx") && <AvisoDeSimulacao texto={tt("aviso")} />}
                    <ListaDeTemplates
                      templates={comTemplates.templates}
                      negocios={comTemplates.negocios}
                      contratos={comTemplates.contratos}
                    />
                  </PainelDeAba>
                )}
                <PainelDeAba id="categorias">
                  <TabelaDeTipos
                    tipos={categorias.map((c) => ({ ...c, comPercentual: c.semNda }))}
                    qual="categoria"
                    {...permissoes}
                  />
                </PainelDeAba>
              </>
            )}
            {acesso.administrador && (
              <>
                <PainelDeAba id="identidade">
                  <PainelDeIdentidade acesso={acesso} />
                </PainelDeAba>
                <PainelDeAba id="gatilhos">
                  <GatilhosDeTarefas />
                </PainelDeAba>
                <PainelDeAba id="chaves">
                  <PainelDeChaves acesso={acesso} />
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
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))} />
    </Suspense>
  );
}
