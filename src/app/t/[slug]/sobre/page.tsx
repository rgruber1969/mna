import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Abas, PainelDeAba } from "@/components/ui/abas";
import { AssinaturaRgruber, Cartao, Titulo } from "@/components/ui/basicos";
import { EsqueletoDeTela } from "@/components/ui/esqueletos";
import { FUNCIONALIDADES, modoDa, type Funcionalidade } from "@/config/funcionalidades";
import { produto } from "@/config/produto";
import { VERSAO } from "@/config/versao";

const ITENS_CRIPTOGRAFADOS = ["cpf", "conjuge", "banco", "anexos", "senha", "links"] as const;
const NOVIDADES = ["a", "b", "c", "d", "e"] as const;

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-border grid gap-1 border-b py-3 sm:grid-cols-[200px_1fr]">
      <dt className="text-muted text-sm">{rotulo}</dt>
      <dd className="text-text text-sm">{children}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-text mb-2 text-base font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

/** Tela "Sobre" (pedido de 2026-11-25): versão, segurança dos dados e funcionalidades. */
async function Painel({ aba }: { aba: Promise<string | undefined> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  const [t, tRodape] = await Promise.all([getTranslations("sobre"), getTranslations("rodape")]);
  const ids = Object.keys(FUNCIONALIDADES) as Funcionalidade[];
  const modos = ids.map((id) => [id, modoDa(id)] as const);
  const ambiente =
    process.env.NODE_ENV !== "production"
      ? "local"
      : modos.some(([, m]) => m === "simulada")
        ? "demonstracao"
        : "producao";
  const p = "text-muted text-sm leading-relaxed";
  return (
    <EstruturaDoTenant acesso={acesso}>
      <main className="flex flex-1 items-start justify-start px-3 py-6 sm:px-6">
        <Cartao largura="max-w-[1100px]">
          <Titulo sobre={t("subtitulo", { produto: produto.nome })}>{t("titulo")}</Titulo>
          <Abas
            inicial={await aba}
            abas={[
              { id: "versao", rotulo: t("abas.versao") },
              { id: "seguranca", rotulo: t("abas.seguranca") },
              { id: "funcionalidades", rotulo: t("abas.funcionalidades") },
            ]}
          >
            <PainelDeAba id="versao">
              <dl className="mb-6">
                <Linha rotulo={t("versao.produto")}>{produto.nome}</Linha>
                <Linha rotulo={t("versao.numero")}>{VERSAO.numero}</Linha>
                <Linha rotulo={t("versao.data")}>
                  {new Date(`${VERSAO.data}T12:00:00`).toLocaleDateString("pt-BR")}
                </Linha>
                <Linha rotulo={t("versao.ambiente")}>{t(`versao.ambientes.${ambiente}`)}</Linha>
                <Linha rotulo={t("versao.escritorio")}>{acesso.tenant.nomeExibido}</Linha>
                <Linha rotulo={t("versao.suporte")}>{t("versao.suporteTexto")}</Linha>
                <Linha rotulo={t("versao.direitos")}>
                  <span className="flex flex-wrap items-center gap-3">
                    {tRodape("direitos", { ano: new Date().getFullYear(), produto: produto.nome })}
                    <AssinaturaRgruber className="" escuro="auto" />
                  </span>
                </Linha>
              </dl>
              <Secao titulo={t("versao.novidadesTitulo")}>
                <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
                  {NOVIDADES.map((n) => (
                    <li key={n}>{t(`versao.novidades.${n}`)}</li>
                  ))}
                </ul>
              </Secao>
            </PainelDeAba>
            <PainelDeAba id="seguranca">
              <p className={`${p} mb-6`}>{t("seguranca.intro")}</p>
              <Secao titulo={t("seguranca.lgpdTitulo")}>
                <p className={p}>{t("seguranca.lgpd")}</p>
              </Secao>
              <Secao titulo={t("seguranca.criptografiaTitulo")}>
                <p className={`${p} mb-3`}>{t("seguranca.criptografia")}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted border-border border-b text-xs uppercase">
                      <tr>
                        <th className="py-2 pr-4 font-semibold">{t("seguranca.colunaDado")}</th>
                        <th className="py-2 pr-4 font-semibold">{t("seguranca.colunaOnde")}</th>
                        <th className="py-2 font-semibold">{t("seguranca.colunaComo")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ITENS_CRIPTOGRAFADOS.map((i) => (
                        <tr key={i} className="border-border hover:bg-surface border-b">
                          <td className="text-text py-2 pr-4 font-medium">
                            {t(`seguranca.itens.${i}.dado`)}
                          </td>
                          <td className="text-muted py-2 pr-4">{t(`seguranca.itens.${i}.onde`)}</td>
                          <td className="text-muted py-2">{t(`seguranca.itens.${i}.como`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Secao>
              {(["isolamento", "acesso", "auditoria", "arquivos", "local"] as const).map((s) => (
                <Secao key={s} titulo={t(`seguranca.${s}Titulo`)}>
                  <p className={p}>{t(`seguranca.${s}`)}</p>
                </Secao>
              ))}
            </PainelDeAba>
            <PainelDeAba id="funcionalidades">
              <p className={`${p} mb-4`}>{t("funcionalidades.intro")}</p>
              <table className="w-full text-left text-sm">
                <thead className="text-muted border-border border-b text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">{t("funcionalidades.colunaNome")}</th>
                    <th className="py-2 font-semibold">{t("funcionalidades.colunaSituacao")}</th>
                  </tr>
                </thead>
                <tbody>
                  {modos.map(([id, modo]) => (
                    <tr key={id} className="border-border hover:bg-surface border-b">
                      <td className="text-text py-2 pr-4">{t(`funcionalidades.nomes.${id}`)}</td>
                      <td
                        className={`py-2 ${modo === "real" ? "text-success" : modo === "simulada" ? "text-warning" : "text-muted"}`}
                      >
                        {t(`funcionalidades.modos.${modo}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PainelDeAba>
          </Abas>
        </Cartao>
      </main>
    </EstruturaDoTenant>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/sobre">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel aba={searchParams.then((q) => (typeof q.aba === "string" ? q.aba : undefined))} />
    </Suspense>
  );
}
