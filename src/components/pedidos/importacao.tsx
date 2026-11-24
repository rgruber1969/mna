"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { importarPlanilhaAcao } from "@/app/acoes/pedidos";
import { Aviso, estiloTabela } from "@/components/ui/basicos";
import { Janela } from "@/components/ui/janela";
import type { AbaImportada, PedidoDetalhe } from "@/server/services/pedidos";
import { botaoPrincipal, botaoSecundario, campo, rotulo } from "./aba";

const paraBase64 = (arquivo: File) =>
  new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

/** Importação da planilha do solicitante: confere primeiro (sem gravar) e depois importa. */
export function ImportacaoDaPlanilha({ detalhe: d, fechar }: { detalhe: PedidoDetalhe; fechar: () => void }) {
  const t = useTranslations("pedidos.importacao");
  const router = useRouter();
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ abas: AbaImportada[]; total: number } | null>(null);
  const [rodada, setRodada] = useState(d.itens.length === 0 ? (d.rodadas[0]?.id ?? "nova") : "nova");
  const [nomeDaRodada, setNomeDaRodada] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"conferindo" | "importando" | null>(null);
  const [feito, setFeito] = useState<number | null>(null);

  async function conferir(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setPrevia(null);
    setOcupado("conferindo");
    try {
      const base64 = await paraBase64(arquivo);
      const r = await importarPlanilhaAcao(d.id, base64, { simular: true, rodada: "nova" });
      if (r.erro) return setErro(r.erro);
      setConteudo(base64);
      setPrevia({ abas: r.abas ?? [], total: r.total ?? 0 });
    } finally {
      setOcupado(null);
    }
  }
  async function importar() {
    if (!conteudo) return;
    setOcupado("importando");
    setErro(null);
    const r = await importarPlanilhaAcao(d.id, conteudo, { simular: false, rodada, nomeDaRodada });
    setOcupado(null);
    if (r.erro) return setErro(r.erro);
    setFeito(r.total ?? 0);
    router.refresh();
  }

  return (
    <Janela titulo={t("titulo")} rotuloFechar={t("fechar")} fechar={fechar}>
      <div className="space-y-4">
        <p className="text-muted text-sm">{t("texto")}</p>
        {erro && <Aviso>{erro}</Aviso>}
        {feito !== null ? (
          <>
            <Aviso tipo="ok">{t("importados", { total: feito })}</Aviso>
            <div className="flex justify-end">
              <button type="button" onClick={fechar} className={botaoPrincipal}>
                {t("fechar")}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <span className={rotulo}>{t("arquivo")}</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => conferir(e.target.files?.[0])}
                className="text-sm"
              />
            </label>
            {ocupado === "conferindo" && <p className="text-muted text-sm">{t("conferindo")}</p>}
            {previa && (
              <>
                <p className="text-text text-sm font-semibold">{t("resultado", { total: previa.total })}</p>
                <div className="-mx-2 overflow-x-auto">
                  <table className={estiloTabela.tabela}>
                    <thead className={estiloTabela.cabecalho}>
                      <tr>
                        <th className={estiloTabela.th}>{t("aba")}</th>
                        <th className={`${estiloTabela.th} text-right`}>{t("itens")}</th>
                        <th className={`${estiloTabela.th} text-right`}>{t("existentes")}</th>
                        <th className={estiloTabela.th}>{t("colunas")}</th>
                        <th className={estiloTabela.th}>{t("periodos")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.abas.map((a) => (
                        <tr key={a.aba} className={estiloTabela.linha}>
                          <td className={`${estiloTabela.td} text-sm font-medium`}>{a.aba}</td>
                          {a.ignorada ? (
                            <td colSpan={4} className={`${estiloTabela.td} text-muted text-xs`}>
                              {t("ignorada")}
                            </td>
                          ) : (
                            <>
                              <td className={`${estiloTabela.td} text-right text-sm tabular-nums`}>
                                {a.itens}
                              </td>
                              <td className={`${estiloTabela.td} text-muted text-right text-sm tabular-nums`}>
                                {a.existentes}
                              </td>
                              <td className={`${estiloTabela.td} text-muted text-xs`}>
                                {a.colunas.map((c) => t(`campos.${c}`)).join(", ")}
                              </td>
                              <td className={`${estiloTabela.td} text-muted text-xs`}>
                                {a.periodos.join(", ") || "—"}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previa.total > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={rotulo}>{t("rodada")}</span>
                      <select value={rodada} onChange={(e) => setRodada(e.target.value)} className={campo}>
                        {d.rodadas.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome}
                          </option>
                        ))}
                        <option value="nova">{t("rodadaNova")}</option>
                      </select>
                    </label>
                    {rodada === "nova" && (
                      <label>
                        <span className={rotulo}>{t("nomeDaRodada")}</span>
                        <input
                          value={nomeDaRodada}
                          onChange={(e) => setNomeDaRodada(e.target.value)}
                          maxLength={80}
                          className={campo}
                        />
                      </label>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={fechar} className={botaoSecundario}>
                {t("cancelar")}
              </button>
              {previa && previa.total > 0 && (
                <button
                  type="button"
                  onClick={importar}
                  disabled={ocupado !== null}
                  className={botaoPrincipal}
                >
                  {ocupado === "importando" ? t("importando") : t("importar", { total: previa.total })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Janela>
  );
}
