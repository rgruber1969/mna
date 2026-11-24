"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { gerarDocumentoDoTemplateAcao } from "@/app/acoes/templates";
import { Aviso, estiloTabela } from "@/components/ui/basicos";
import { baixarBase64 } from "@/components/ui/baixar";

type Opcao = { id: string; nome: string; tipo?: string };
type Template = { codigo: string; alvo: "negocio" | "contrato"; campos: string[] };

const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const estiloCampo =
  "border-border bg-background text-text focus:border-primary w-full min-w-48 rounded-md border px-2 py-1.5 text-sm outline-none";

/** Uma linha da lista: escolher o negócio ou contrato e gerar o DOCX. */
function LinhaDoTemplate({ template, opcoes }: { template: Template; opcoes: Opcao[] }) {
  const t = useTranslations("templates");
  const [alvo, setAlvo] = useState(opcoes[0]?.id ?? "");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function gerar() {
    setGerando(true);
    setErro(null);
    const r = await gerarDocumentoDoTemplateAcao(template.codigo, alvo);
    setGerando(false);
    if (r.erro || !r.conteudo || !r.nome) return setErro(r.erro ?? "");
    baixarBase64(r.conteudo, r.nome, TIPO_DOCX);
  }
  const base = `modelos.${template.codigo}`;
  return (
    <tr className={estiloTabela.linha}>
      <td className={`${estiloTabela.td} min-w-56`}>
        <span className="text-text block font-medium">{t(`${base}.nome`)}</span>
        <span className="text-muted block text-xs">{t(`${base}.descricao`)}</span>
      </td>
      <td className={`${estiloTabela.td} text-muted text-xs`}>
        {template.campos.map((c) => t(`campos.${c}`)).join(", ")}
      </td>
      <td className={estiloTabela.td}>
        <label className="sr-only" htmlFor={`alvo-${template.codigo}`}>
          {t(template.alvo === "negocio" ? "escolhaNegocio" : "escolhaContrato")}
        </label>
        {opcoes.length ? (
          <select
            id={`alvo-${template.codigo}`}
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
            className={estiloCampo}
          >
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted text-xs">
            {t(template.alvo === "negocio" ? "semNegocios" : "semContratos")}
          </span>
        )}
        {erro && (
          <div className="mt-2">
            <Aviso>{erro}</Aviso>
          </div>
        )}
      </td>
      <td className={`${estiloTabela.td} text-right`}>
        <button
          type="button"
          onClick={gerar}
          disabled={gerando || !alvo}
          className="border-border text-text hover:border-primary rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap disabled:opacity-60"
        >
          {gerando ? t("gerando") : t("gerar")}
        </button>
      </td>
    </tr>
  );
}

/** Lista de templates DOCX (item 13, simulado). */
export function ListaDeTemplates({
  templates,
  negocios,
  contratos,
}: {
  templates: Template[];
  negocios: Opcao[];
  contratos: Opcao[];
}) {
  const t = useTranslations("templates");
  return (
    <div className="overflow-x-auto">
      <table className={estiloTabela.tabela}>
        <thead className={estiloTabela.cabecalho}>
          <tr>
            <th className={estiloTabela.th}>{t("colTemplate")}</th>
            <th className={estiloTabela.th}>{t("colCampos")}</th>
            <th className={estiloTabela.th}>{t("colPreencherCom")}</th>
            <th className={estiloTabela.th}>
              <span className="sr-only">{t("gerar")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {(["negocio", "contrato"] as const).flatMap((alvo) => [
            <tr key={alvo}>
              <td colSpan={4} className="text-muted px-4 pt-4 pb-1 text-xs font-semibold uppercase">
                {t(`alvos.${alvo}`)}
              </td>
            </tr>,
            ...templates
              .filter((x) => x.alvo === alvo)
              .map((x) => (
                <LinhaDoTemplate
                  key={x.codigo}
                  template={x}
                  opcoes={
                    alvo === "negocio"
                      ? negocios
                      : // Mandato de venda: só contratos de mandato (advisor); carta de honorários: só os de honorários.
                        contratos.filter((c) => !c.tipo || c.tipo === x.codigo || c.tipo === "outro")
                  }
                />
              )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
