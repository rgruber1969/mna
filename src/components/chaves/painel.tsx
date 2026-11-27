import { getTranslations } from "next-intl/server";
import { revogarChaveAcao } from "@/app/acoes/chaves-api";
import type { AcessoTenant } from "@/server/services/acesso";
import { listarChaves } from "@/server/services/chaves-api";
import { listarPerfis } from "@/server/services/perfis";
import { FormNovaChave } from "@/components/chaves/formulario";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Ajuda, Etiqueta, estiloTabela } from "@/components/ui/basicos";
import { dominio, protocolo } from "@/server/enderecos";

/**
 * Bloco "Como usar a API": endereço deste tenant, documentação interativa,
 * autenticação e regras principais (guia completo: docs/integracao/guia-da-api.md).
 */
function SobreAApi({ slug, t }: { slug: string; t: Awaited<ReturnType<typeof getTranslations<"chaves">>> }) {
  const raiz = `${protocolo()}://${slug}.${dominio()}/api`;
  const docs = process.env.NODE_ENV !== "production" || process.env.API_DOCS_ENABLED === "true";
  const codigo = "bg-surface text-text rounded px-1.5 py-0.5 font-mono text-xs break-all";
  return (
    <section className="border-border bg-primary-soft/40 mb-6 rounded-xl border p-4">
      <h3 className="text-text mb-3 text-sm font-semibold">{t("api.titulo")}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-[180px_1fr]">
        <dt className="text-muted">{t("api.endereco")}</dt>
        <dd>
          <code className={codigo}>{raiz}/v1</code>
        </dd>
        <dt className="text-muted">{t("api.documentacao")}</dt>
        <dd>
          {docs ? (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t("api.swagger")}
              </a>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t("api.openapi")}
              </a>
            </span>
          ) : (
            <span className="text-muted">{t("api.documentacaoFechada")}</span>
          )}
        </dd>
        <dt className="text-muted">{t("api.autenticacao")}</dt>
        <dd>
          <code className={codigo}>Authorization: Bearer chv_…</code>
        </dd>
        <dt className="text-muted">{t("api.status")}</dt>
        <dd>
          <code className={codigo}>GET {raiz}/status</code>
        </dd>
      </dl>
      <ul className="text-muted mt-4 list-disc space-y-1 pl-5 text-xs leading-relaxed">
        <li>{t("api.regras.perfil")}</li>
        <li>{t("api.regras.segredo")}</li>
        <li>{t("api.regras.endereco")}</li>
        <li>{t("api.regras.listas")}</li>
        <li>{t("api.regras.erros")}</li>
        <li>{t("api.regras.guia")}</li>
      </ul>
    </section>
  );
}

/** Chaves de API do tenant (itens 25 e 26), dentro de Configurações: só administradores. */
export async function PainelDeChaves({ acesso }: { acesso: AcessoTenant }) {
  const [chaves, perfis, t] = await Promise.all([
    listarChaves(acesso),
    listarPerfis(acesso).then((p) => p.perfis.filter((x) => x.camada === "tenant")),
    getTranslations("chaves"),
  ]);
  const br = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  return (
    <div>
      <div className="text-muted mb-4 flex items-center gap-2 text-sm">
        <Ajuda texto={t("ajuda")} />
        {t("titulo")}
      </div>

      <SobreAApi slug={acesso.tenant.slug} t={t} />
      <div className="mb-6">
        <FormNovaChave perfis={perfis.map((p) => ({ id: p.id, nome: p.nome }))} />
      </div>
      {chaves.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhuma")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={estiloTabela.tabela}>
            <thead className={estiloTabela.cabecalho}>
              <tr>
                <th className={estiloTabela.th}>{t("nome")}</th>
                <th className={estiloTabela.th}>{t("perfil")}</th>
                <th className={estiloTabela.th}>{t("criada")}</th>
                <th className={estiloTabela.th}>{t("ultimoUso")}</th>
                <th className={estiloTabela.th}>{t("expiraEm")}</th>
                <th className={estiloTabela.th}>{t("situacao")}</th>
                <th className={estiloTabela.th}>{t("acoes")}</th>
              </tr>
            </thead>
            <tbody>
              {chaves.map((c) => (
                <tr key={c.id} className={estiloTabela.linha}>
                  <td className={estiloTabela.td}>
                    <span className="font-medium">{c.nome}</span>
                    <code className="text-muted block text-xs">{c.prefixo}…</code>
                  </td>
                  <td className={`${estiloTabela.td} text-xs`}>{c.perfil ?? "—"}</td>
                  <td className={`${estiloTabela.td} text-muted text-xs`}>
                    {br(c.criadaEm)}
                    {c.criadaPor && <span className="block">{c.criadaPor}</span>}
                  </td>
                  <td className={`${estiloTabela.td} text-muted text-xs`}>{br(c.ultimoUsoEm)}</td>
                  <td className={`${estiloTabela.td} text-muted text-xs`}>
                    {c.expiraEm ? c.expiraEm.split("-").reverse().join("/") : t("semValidade")}
                  </td>
                  <td className={estiloTabela.td}>
                    <Etiqueta tom={c.situacao === "ativa" ? "sucesso" : "neutra"}>
                      {t(`situacoes.${c.situacao}`)}
                    </Etiqueta>
                  </td>
                  <td className={estiloTabela.td}>
                    {c.situacao !== "revogada" && (
                      <BotaoDeAcao
                        acao={revogarChaveAcao}
                        campos={{ id: c.id }}
                        rotulo={t("revogar")}
                        confirmar={t("confirmarRevogar", { nome: c.nome })}
                        perigo
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
