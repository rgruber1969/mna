import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { obterAcesso } from "@/server/services/acesso";
import {
  opcoesDaAuditoria,
  ORDENS_DA_AUDITORIA,
  paginaDaAuditoria,
  retencaoDaAuditoria,
} from "@/server/services/auditoria";
import { pode } from "@/server/services/permissoes/verificador";
import { lerPedido } from "@/config/paginacao";
import { estaLigada } from "@/config/funcionalidades";
import { EstruturaDoTenant } from "@/components/acesso/cabecalho";
import { portaoDeDoisFatores } from "@/components/acesso/telas";
import { Paginacao } from "@/components/ui/lista";
import { Cartao, estiloTabela, Titulo } from "@/components/ui/basicos";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { EsqueletoDeListaConteudo, EsqueletoDeTela } from "@/components/ui/esqueletos";
import { LimpezaDaAuditoria } from "@/components/auditoria/limpeza";

type Parametros = Record<string, string | string[] | undefined>;
const um = (p: Parametros, k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");

/**
 * Auditoria (item 20): consulta dos eventos do tenant por quem tem a
 * permissão "Auditoria × ver" ou é administrador; filtros por período,
 * assunto, pessoa e negócio no endereço; paginação no servidor. A limpeza com
 * exportação (item 21) fica embaixo, só para administradores.
 */
async function Painel({ busca }: { busca: Promise<Parametros> }) {
  await connection();
  const acesso = await obterAcesso(new Headers(await headers()));
  if (acesso?.area !== "tenant") redirect("/entrar");
  const portao = portaoDeDoisFatores(acesso);
  if (portao) return portao;
  if (!(await pode(acesso, "auditoria", "ver"))) notFound();
  const parametros = await busca;
  return (
    <EstruturaDoTenant acesso={acesso}>
      <Suspense fallback={<EsqueletoDeListaConteudo />}>
        <Conteudo parametros={parametros} administrador={acesso.administrador} />
      </Suspense>
    </EstruturaDoTenant>
  );
}

async function Conteudo({ parametros, administrador }: { parametros: Parametros; administrador: boolean }) {
  const acesso = await obterAcesso(new Headers(await headers()));
  const t = await getTranslations("auditoria");
  const th = (await getTranslations()) as unknown as {
    has(k: string): boolean;
    raw(k: string): unknown;
    (k: string, p?: Record<string, string | number | boolean | null>): string;
  };
  const filtro = {
    de: um(parametros, "de"),
    ate: um(parametros, "ate"),
    assunto: um(parametros, "assunto"),
    ator: um(parametros, "ator"),
    negocio: um(parametros, "negocio"),
  };
  const pedido = lerPedido(parametros, ORDENS_DA_AUDITORIA, "ocorridoEm", "desc");
  const [pagina, opcoes, retencao] = await Promise.all([
    paginaDaAuditoria(acesso, filtro, pedido),
    opcoesDaAuditoria(acesso),
    administrador ? retencaoDaAuditoria(acesso) : null,
  ]);
  const quando = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "medium",
    });
  /** Nome do evento em linguagem simples (as mesmas frases do histórico do negócio, quando houver). */
  const nomeDoEvento = (tipo: string, detalhes: Record<string, string | number | boolean | null>) => {
    const chave = tipo.replaceAll(".", "_");
    for (const k of [`auditoria.tipos.${chave}`, `negocios.historico.tipos.${chave}`]) {
      if (!th.has(k)) continue;
      // Só usa a frase se todos os parâmetros dela estiverem nos detalhes do evento.
      const bruta = String(th.raw(k));
      const faltam = [...bruta.matchAll(/\{(\w+)/g)].some(([, p]) => !(p in detalhes));
      if (!faltam) return th(k, detalhes);
    }
    return tipo;
  };
  const nomeDoAssunto = (a: string) =>
    th.has(`auditoria.assuntos.${a}`) ? th(`auditoria.assuntos.${a}`) : a;
  const filtrado = Object.values(filtro).some(Boolean);
  const campo = "border-border bg-background text-text rounded-md border px-3 py-2 text-sm";
  return (
    <main className="entra-em-cascata flex flex-1 flex-col items-start gap-4 px-3 py-4 sm:px-6">
      <Cartao largura="max-w-6xl">
        <Titulo sobre={t("sobre")} ajuda={t("ajuda")}>
          {t("titulo")}
        </Titulo>
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="text-muted mb-1 block">{t("de")}</span>
            <input type="date" name="de" defaultValue={filtro.de} className={campo} />
          </label>
          <label className="text-xs">
            <span className="text-muted mb-1 block">{t("ate")}</span>
            <input type="date" name="ate" defaultValue={filtro.ate} className={campo} />
          </label>
          <label className="text-xs">
            <span className="text-muted mb-1 block">{t("assunto")}</span>
            <select name="assunto" defaultValue={filtro.assunto} className={campo}>
              <option value="">{t("todos")}</option>
              {opcoes.assuntos.map((a) => (
                <option key={a} value={a}>
                  {nomeDoAssunto(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted mb-1 block">{t("pessoa")}</span>
            <select name="ator" defaultValue={filtro.ator} className={campo}>
              <option value="">{t("todas")}</option>
              {opcoes.pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted mb-1 block">{t("negocio")}</span>
            <select name="negocio" defaultValue={filtro.negocio} className={campo}>
              <option value="">{t("todos")}</option>
              {opcoes.negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
          </label>
          <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
            {t("filtrar")}
          </button>
          {filtrado && (
            <a href="/auditoria" className="text-primary py-2 text-sm font-semibold">
              {t("limpar")}
            </a>
          )}
        </form>
        <p className="text-muted mb-2 text-xs">{t("total", { n: pagina.total })}</p>
        {pagina.total === 0 ? (
          <EstadoVazio
            titulo={t("nenhum")}
            texto={filtrado ? t("nenhumComFiltro") : undefined}
            limpar={filtrado ? { href: "/auditoria", rotulo: t("limpar") } : undefined}
          />
        ) : (
          <>
            <div className="-mx-2 overflow-x-auto">
              <table className={estiloTabela.tabela}>
                <thead className={estiloTabela.cabecalho}>
                  <tr>
                    <th className={estiloTabela.th}>{t("colQuando")}</th>
                    <th className={estiloTabela.th}>{t("colEvento")}</th>
                    <th className={estiloTabela.th}>{t("colQuem")}</th>
                    <th className={estiloTabela.th}>{t("colSobre")}</th>
                    <th className={estiloTabela.th}>{t("colDetalhes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagina.itens.map((e) => (
                    <tr key={e.id} className={estiloTabela.linha}>
                      <td className={`${estiloTabela.td} text-muted text-xs whitespace-nowrap tabular-nums`}>
                        {quando(e.ocorridoEm)}
                      </td>
                      <td className={`${estiloTabela.td} text-sm`}>
                        <span className="text-text font-medium">{nomeDoEvento(e.tipo, e.detalhes)}</span>
                        <span className="text-muted block font-mono text-[11px]">{e.tipo}</span>
                      </td>
                      <td className={`${estiloTabela.td} text-xs`}>{e.ator ?? t("sistema")}</td>
                      <td className={`${estiloTabela.td} text-xs`}>
                        {e.negocio ??
                          (e.alvoTipo
                            ? `${nomeDoAssunto(e.alvoTipo)} · ${e.alvoId?.slice(0, 8) ?? ""}`
                            : "—")}
                      </td>
                      <td className={`${estiloTabela.td} text-muted max-w-xs text-xs`}>
                        {Object.entries(e.detalhes)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} caminho="/auditoria" parametros={parametros} />
          </>
        )}
      </Cartao>
      {retencao && estaLigada("limpezaDeAuditoria") && (
        <Cartao largura="max-w-6xl">
          <LimpezaDaAuditoria meses={retencao.meses} antigos={retencao.antigos} />
        </Cartao>
      )}
    </main>
  );
}

export default function Page({ searchParams }: PageProps<"/t/[slug]/auditoria">) {
  return (
    <Suspense fallback={<EsqueletoDeTela />}>
      <Painel busca={searchParams as Promise<Parametros>} />
    </Suspense>
  );
}
