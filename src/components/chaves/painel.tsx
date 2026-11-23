import { getTranslations } from "next-intl/server";
import { revogarChaveAcao } from "@/app/acoes/chaves-api";
import type { AcessoTenant } from "@/server/services/acesso";
import { listarChaves } from "@/server/services/chaves-api";
import { listarPerfis } from "@/server/services/perfis";
import { FormNovaChave } from "@/components/chaves/formulario";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Ajuda, Etiqueta, estiloTabela } from "@/components/ui/basicos";

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
