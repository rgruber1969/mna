import { useTranslations } from "next-intl";
import { AvisoDeSimulacao } from "@/components/ui/aviso-de-simulacao";
import { estiloTabela } from "@/components/ui/basicos";

/** Gatilhos de exemplo (itens 28 e 29, simulados): evento → tarefa criada, responsável e prazo. */
const EXEMPLOS = ["escolhida", "diligencia", "nda", "exclusividade", "closing"] as const;

/**
 * Configurações → Gatilhos de tarefas (itens 28 e 29, simulados): mostra os
 * gatilhos fixos previstos e como ficará a configuração pelo tenant. Nada é
 * gravado e nenhuma tarefa é criada de verdade; as tarefas de exemplo
 * aparecem marcadas como "automática" nos negócios.
 */
export function GatilhosDeTarefas() {
  const t = useTranslations("configuracoes.gatilhos");
  return (
    <div>
      <AvisoDeSimulacao texto={t("aviso")} />
      <p className="text-muted mb-3 text-sm">{t("explicacao")}</p>
      <div className="-mx-2 overflow-x-auto">
        <table className={estiloTabela.tabela}>
          <thead className={estiloTabela.cabecalho}>
            <tr>
              <th className={estiloTabela.th}>{t("colEvento")}</th>
              <th className={estiloTabela.th}>{t("colTarefa")}</th>
              <th className={estiloTabela.th}>{t("colResponsavel")}</th>
              <th className={estiloTabela.th}>{t("colPrazo")}</th>
              <th className={estiloTabela.th}>{t("colAtivo")}</th>
            </tr>
          </thead>
          <tbody>
            {EXEMPLOS.map((e) => (
              <tr key={e} className={estiloTabela.linha}>
                <td className={`${estiloTabela.td} text-sm`}>{t(`exemplos.${e}.evento`)}</td>
                <td className={`${estiloTabela.td} text-text text-sm font-medium`}>
                  {t(`exemplos.${e}.tarefa`)}
                </td>
                <td className={`${estiloTabela.td} text-muted text-xs`}>{t(`exemplos.${e}.responsavel`)}</td>
                <td className={`${estiloTabela.td} text-muted text-xs whitespace-nowrap`}>
                  {t(`exemplos.${e}.prazo`)}
                </td>
                <td className={estiloTabela.td}>
                  <span
                    role="switch"
                    aria-checked="true"
                    aria-disabled="true"
                    aria-label={t("ativoDe", { tarefa: t(`exemplos.${e}.tarefa`) })}
                    className="bg-primary/60 inline-flex h-5 w-9 cursor-not-allowed items-center rounded-full p-0.5"
                  >
                    <span className="bg-background ml-auto h-4 w-4 rounded-full" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled
        title={t("novoEmBreve")}
        className="border-border text-muted mt-3 cursor-not-allowed rounded-md border border-dashed px-3 py-2 text-sm"
      >
        + {t("novo")}
      </button>
      <p className="text-muted mt-1 text-xs">{t("novoEmBreve")}</p>
    </div>
  );
}
