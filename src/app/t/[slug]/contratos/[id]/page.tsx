import { connection } from "next/server";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { negociosParaLigar, obterContrato, opcoesDoContrato } from "@/server/services/contratos";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { AcoesDoContrato, ArquivosDoContrato, SimulacaoDeSuccessFee } from "@/components/contratos/detalhe";
import { FormContrato } from "@/components/contratos/formulario";
import { Aviso, Cartao, Carregando, Etiqueta, Titulo } from "@/components/ui/basicos";

const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const moeda = (v: string | null) =>
  v === null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCampo = (v: string | null) => (v === null ? "" : String(Number(v)).replace(".", ","));
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[14rem_1fr]">
      <dt className="text-muted text-sm">{rotulo}</dt>
      <dd className="text-text text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Contrato de serviço: dados, condições, arquivos e ações (item 17). */
async function Painel({
  id,
  editar,
  salvo,
}: {
  id: Promise<string>;
  editar: Promise<boolean>;
  salvo: Promise<boolean>;
}) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const c = await obterContrato(acesso, await id);
  if (!c) notFound();
  const t = await getTranslations("contratos");
  const voltar = c.dealId ? `/negocios/${c.dealId}?aba=contratos` : "/contratos";
  const editando = (await editar) && c.podeEditar;
  const opcoes = editando ? await opcoesDoContrato(acesso, c.dealId) : null;
  const negocios = editando && !c.dealId ? await negociosParaLigar(acesso) : [];
  // Partes atuais continuam escolhíveis mesmo fora das opções (ex.: empresa inativada).
  const empresas = opcoes
    ? [
        ...opcoes.empresas,
        ...c.partes
          .filter((p) => !opcoes.empresas.some((e) => e.id === p.empresaId))
          .map((p) => ({ id: p.empresaId, nome: p.nome })),
      ]
    : [];
  const fixo = c.honorarioFixo
    ? [moeda(c.honorarioFixo), c.periodicidade ? t(`periodicidades.${c.periodicidade}`) : null]
        .filter(Boolean)
        .join(" · ") + (c.retainerDescontado ? `\n${t("retainerDescontado")}` : "")
    : null;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-4xl">
          <Link href={voltar} className="text-primary text-sm">
            {t("voltar")}
          </Link>
          <Titulo ajuda={t("ajuda")}>{c.titulo}</Titulo>
          <p className="text-muted -mt-2 mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span>{t(`tipos.${c.tipo}`)}</span>
            <span>·</span>
            <span>{c.negocio ?? t("avulso")}</span>
            <Etiqueta tom={c.vigente ? "sucesso" : "neutra"}>
              {c.vigente ? t("vigente") : t("naoVigente")}
            </Etiqueta>
          </p>
          {(await salvo) && !editando && <Aviso tipo="ok">{t("salvo")}</Aviso>}
          {editando && opcoes ? (
            <FormContrato
              id={c.id}
              opcoes={{ ...opcoes, empresas }}
              negocios={negocios}
              aoCancelar={`/contratos/${c.id}`}
              inicial={{
                dealId: c.dealId,
                tipo: c.tipo,
                titulo: c.titulo,
                objeto: c.objeto ?? "",
                dataAssinatura: c.dataAssinatura ?? "",
                inicio: c.inicio ?? "",
                fim: c.fim ?? "",
                exclusivo: c.exclusivo,
                exclusividadeAte: c.exclusividadeAte ?? "",
                honorarioFixo: paraCampo(c.honorarioFixo),
                periodicidade: c.periodicidade ?? "",
                retainerDescontado: c.retainerDescontado,
                successFeePercentual: paraCampo(c.successFeePercentual),
                successFeeMinimo: paraCampo(c.successFeeMinimo),
                formaPagamento: c.formaPagamento ?? "",
                contaBancariaId: c.contaBancariaId ?? "",
                observacoes: c.observacoes ?? "",
                contratantes: c.partes.filter((p) => p.papel === "contratante").map((p) => p.empresaId),
                contratadas: c.partes.filter((p) => p.papel === "contratada").map((p) => p.empresaId),
                perfis: c.acessoIds.perfis,
                usuarios: c.acessoIds.usuarios,
              }}
            />
          ) : (
            <>
              <AcoesDoContrato
                id={c.id}
                titulo={c.titulo}
                podeEditar={c.podeEditar}
                podeExcluir={c.podeExcluir}
                voltar={voltar}
              />
              <h2 className="text-text mt-6 mb-2 text-base font-semibold">{t("partes")}</h2>
              <dl>
                <Linha rotulo={t("contratantes")}>{c.contratantes.join("\n")}</Linha>
                <Linha rotulo={t("contratadas")}>{c.contratadas.join("\n")}</Linha>
                <Linha rotulo={t("objeto")}>{c.objeto}</Linha>
                <Linha rotulo={t("dataAssinatura")}>{br(c.dataAssinatura)}</Linha>
                <Linha rotulo={t("vigencia")}>
                  {c.inicio || c.fim ? `${br(c.inicio) ?? "…"} – ${br(c.fim) ?? "…"}` : null}
                </Linha>
                <Linha rotulo={t("exclusividadeAte")}>
                  {c.exclusivo ? (br(c.exclusividadeAte) ?? t("exclusivo")) : null}
                </Linha>
              </dl>
              <h2 className="text-text mt-6 mb-2 text-base font-semibold">{t("condicoes")}</h2>
              <dl>
                <Linha rotulo={t("honorarioFixo")}>{fixo}</Linha>
                <Linha rotulo={t("successFeePercentual")}>
                  {c.successFeePercentual
                    ? `${Number(c.successFeePercentual).toLocaleString("pt-BR")}%`
                    : null}
                </Linha>
                <Linha rotulo={t("successFeeMinimo")}>{moeda(c.successFeeMinimo)}</Linha>
                <Linha rotulo={t("formaPagamento")}>{c.formaPagamento}</Linha>
                <Linha rotulo={t("conta")}>{c.conta}</Linha>
                <Linha rotulo={t("observacoes")}>{c.observacoes}</Linha>
                <Linha rotulo={t("quemVe")}>{c.acesso.length ? c.acesso.join(", ") : null}</Linha>
                <Linha rotulo={t("criadoPor")}>{c.criadoPor}</Linha>
                <Linha rotulo={t("enviarFinanceiro")}>
                  {c.financeiroAvisadoEm
                    ? t("financeiroAvisadoEm", { data: quando(c.financeiroAvisadoEm) })
                    : null}
                </Linha>
              </dl>
              <div className="mt-3">
                <SimulacaoDeSuccessFee contrato={c} />
              </div>
              <h2 className="text-text mt-6 mb-2 text-base font-semibold">{t("arquivos")}</h2>
              <ArquivosDoContrato
                contratoId={c.id}
                arquivos={c.arquivosLista}
                podeEnviar={c.podeEditar}
                podeBaixar={c.podeBaixar}
              />
            </>
          )}
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ params, searchParams }: PageProps<"/t/[slug]/contratos/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Painel
        id={params.then((p) => p.id)}
        editar={searchParams.then((q) => q.editar === "1")}
        salvo={searchParams.then((q) => q.salvo === "1")}
      />
    </Suspense>
  );
}
