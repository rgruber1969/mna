"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { definirPrioridadesAcao, excluirFonteAcao, salvarFonteAcao } from "@/app/acoes/pedidos";
import { Aviso, estiloTabela } from "@/components/ui/basicos";
import type { FonteNaTela } from "@/server/services/pedidos";

const campo = "border-border bg-background text-text w-full rounded-md border px-2 py-1.5 text-sm";
type Valores = Omit<FonteNaTela, "id" | "link" | "observacao"> & { link: string; observacao: string };
const vazio: Valores = {
  nome: "",
  orgao: "",
  link: "",
  abrangencia: "federal",
  gratuito: true,
  observacao: "",
};

/** Catálogo "onde obter" (Configurações › Cadastros auxiliares): tabela com inclusão na última linha. */
export function TabelaDeFontes({
  fontes,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  fontes: FonteNaTela[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const t = useTranslations("pedidos.fontes");
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [v, setV] = useState<Valores>(vazio);
  const [novo, setNovo] = useState<Valores>(vazio);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(id: string | null, valores: Valores) {
    setErro(null);
    const r = await salvarFonteAcao(id, valores);
    if (r.erro) return setErro(r.erro);
    setEditando(null);
    setNovo(vazio);
    router.refresh();
  }
  async function excluir(f: FonteNaTela) {
    if (!window.confirm(t("confirmarExcluir", { nome: f.nome }))) return;
    const r = await excluirFonteAcao(f.id);
    if (r.erro) return setErro(r.erro);
    router.refresh();
  }
  const linhaDeEdicao = (
    valores: Valores,
    mudar: (x: Valores) => void,
    acoes: React.ReactNode,
    chave: string,
  ) => (
    <tr key={chave} className={estiloTabela.linha}>
      <td className={`${estiloTabela.td} min-w-72`}>
        <input
          value={valores.nome}
          onChange={(e) => mudar({ ...valores, nome: e.target.value })}
          aria-label={t("nome")}
          className={campo}
        />
        <input
          value={valores.observacao}
          onChange={(e) => mudar({ ...valores, observacao: e.target.value })}
          aria-label={t("observacao")}
          placeholder={t("observacao")}
          className={`${campo} mt-1 text-xs`}
        />
      </td>
      <td className={estiloTabela.td}>
        <input
          value={valores.orgao}
          onChange={(e) => mudar({ ...valores, orgao: e.target.value })}
          aria-label={t("orgao")}
          className={campo}
        />
        <input
          value={valores.link}
          onChange={(e) => mudar({ ...valores, link: e.target.value })}
          aria-label={t("link")}
          placeholder="https://"
          className={`${campo} mt-1 text-xs`}
        />
      </td>
      <td className={estiloTabela.td}>
        <select
          value={valores.abrangencia}
          onChange={(e) => mudar({ ...valores, abrangencia: e.target.value as Valores["abrangencia"] })}
          aria-label={t("abrangencia")}
          className={campo}
        >
          {(["federal", "estadual", "municipal"] as const).map((x) => (
            <option key={x} value={x}>
              {t(`abrangencias.${x}`)}
            </option>
          ))}
        </select>
      </td>
      <td className={`${estiloTabela.td} text-center`}>
        <input
          type="checkbox"
          checked={valores.gratuito}
          onChange={(e) => mudar({ ...valores, gratuito: e.target.checked })}
          aria-label={t("gratuito")}
        />
      </td>
      <td className={`${estiloTabela.td} text-right whitespace-nowrap`}>{acoes}</td>
    </tr>
  );
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-text text-base font-semibold">{t("titulo")}</h3>
        <p className="text-muted text-sm">{t("texto")}</p>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="-mx-2 overflow-x-auto">
        <table className={estiloTabela.tabela}>
          <thead className={estiloTabela.cabecalho}>
            <tr>
              <th className={estiloTabela.th}>{t("nome")}</th>
              <th className={estiloTabela.th}>{t("orgao")}</th>
              <th className={estiloTabela.th}>{t("abrangencia")}</th>
              <th className={`${estiloTabela.th} text-center`}>{t("gratuito")}</th>
              <th className={estiloTabela.th} />
            </tr>
          </thead>
          <tbody>
            {fontes.length === 0 && (
              <tr>
                <td colSpan={5} className={`${estiloTabela.td} text-muted text-sm`}>
                  {t("vazio")}
                </td>
              </tr>
            )}
            {fontes.map((f) => (
              <Fragment key={f.id}>
                {editando === f.id ? (
                  linhaDeEdicao(
                    v,
                    setV,
                    <>
                      <button
                        type="button"
                        onClick={() => salvar(f.id, v)}
                        className="text-primary mr-3 text-sm font-semibold"
                      >
                        {t("salvar")}
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="text-muted text-sm">
                        {t("cancelar")}
                      </button>
                    </>,
                    f.id,
                  )
                ) : (
                  <tr className={estiloTabela.linha}>
                    <td className={`${estiloTabela.td} min-w-72 text-sm`}>
                      {f.nome}
                      {f.observacao && <span className="text-muted block text-xs">{f.observacao}</span>}
                    </td>
                    <td className={`${estiloTabela.td} text-sm`}>
                      {f.orgao}
                      {f.link && (
                        <a
                          href={f.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary block max-w-xs truncate text-xs"
                        >
                          {f.link}
                        </a>
                      )}
                    </td>
                    <td className={`${estiloTabela.td} text-sm`}>{t(`abrangencias.${f.abrangencia}`)}</td>
                    <td className={`${estiloTabela.td} text-center text-sm`}>
                      {f.gratuito ? t("sim") : t("nao")}
                    </td>
                    <td className={`${estiloTabela.td} text-right whitespace-nowrap`}>
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(f.id);
                            setV({ ...f, link: f.link ?? "", observacao: f.observacao ?? "" });
                          }}
                          className="text-primary mr-3 text-sm"
                        >
                          {t("editar")}
                        </button>
                      )}
                      {podeExcluir && (
                        <button type="button" onClick={() => excluir(f)} className="text-danger text-sm">
                          {t("excluir")}
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {podeCriar &&
              linhaDeEdicao(
                novo,
                setNovo,
                <button
                  type="button"
                  onClick={() => salvar(null, novo)}
                  className="text-primary text-sm font-semibold"
                >
                  {t("adicionar")}
                </button>,
                "novo",
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Escala de prioridade dos itens dos pedidos (uma por linha). */
export function FormPrioridades({ prioridades, podeEditar }: { prioridades: string[]; podeEditar: boolean }) {
  const t = useTranslations("pedidos.prioridades");
  const router = useRouter();
  const [texto, setTexto] = useState(prioridades.join("\n"));
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const r = await definirPrioridadesAcao(texto.split("\n"));
    if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
    setAviso({ tipo: "ok", texto: t("salvo") });
    router.refresh();
  }
  return (
    <form onSubmit={salvar} className="max-w-md space-y-3">
      <div>
        <h3 className="text-text text-base font-semibold">{t("titulo")}</h3>
        <p className="text-muted text-sm">{t("texto")}</p>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <label className="block">
        <span className="text-text mb-1 block text-sm font-medium">{t("campo")}</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          disabled={!podeEditar}
          className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>
      {podeEditar && (
        <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
          {t("salvar")}
        </button>
      )}
    </form>
  );
}
