"use client";

import { IconeDeAcao } from "@/components/ui/icone-de-acao";
import { useFormatter, useTranslations } from "next-intl";
import { enviarAnexoAcao, removerAnexoAcao } from "@/app/acoes/anexos";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Botao, Campo } from "@/components/ui/basicos";
import { Miniatura, temPrevia, Visualizar } from "./previa-do-anexo";

export type AnexoNaTela = {
  id: string;
  categoria: string;
  descricao: string | null;
  nomeArquivo: string;
  tipoDeConteudo: string;
  tamanho: number;
  situacao: string;
  enviadoPor: string | null;
  criadoEm: Date;
};

const tamanhoLegivel = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Documentos anexados a uma empresa ou pessoa (escopo-v1.md, item 34): lista,
 * download pelo servidor (criptografados; ADR-0017) e envio.
 */
export function AnexosDoCadastro({
  alvo,
  anexos,
  categorias,
  podeEnviar,
  podeBaixar,
}: {
  alvo: { tipo: "empresa" | "pessoa"; id: string };
  anexos: AnexoNaTela[];
  categorias: readonly string[];
  podeEnviar: boolean;
  podeBaixar: boolean;
}) {
  const t = useTranslations("cadastros.anexos");
  const formato = useFormatter();
  const [estado, enviar, enviando] = useAcaoComAtualizacao(enviarAnexoAcao);

  return (
    <div>
      <p className="text-muted mb-3 text-sm">{t("explicacao")}</p>
      {anexos.length === 0 ? (
        <p className="text-muted mb-3 text-sm">{t("nenhum")}</p>
      ) : (
        <ul className="divide-border mb-3 divide-y text-sm">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2">
              {podeBaixar && a.situacao === "disponivel" && (
                <Miniatura
                  id={a.id}
                  tipo={a.tipoDeConteudo}
                  rotulo={a.nomeArquivo.split(".").pop()?.slice(0, 4) ?? ""}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-text block font-medium">
                  {t(`categorias.${a.categoria}` as "categorias.outro")}
                  {a.descricao && <span className="text-muted font-normal"> · {a.descricao}</span>}
                </span>
                <span className="text-muted block truncate text-xs">
                  {a.nomeArquivo} · {tamanhoLegivel(a.tamanho)}
                  {a.enviadoPor &&
                    ` · ${t("enviadoPor", {
                      nome: a.enviadoPor,
                      data: formato.dateTime(a.criadoEm, { dateStyle: "short" }),
                    })}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {a.situacao === "disponivel" ? (
                  podeBaixar && (
                    <>
                      {temPrevia(a.tipoDeConteudo) && (
                        <Visualizar id={a.id} tipo={a.tipoDeConteudo} nome={a.nomeArquivo} />
                      )}
                      <a
                        href={`/api/anexos/${a.id}`}
                        title={t("baixar")}
                        aria-label={t("baixar")}
                        className="text-muted hover:bg-primary-soft hover:text-primary inline-grid h-7 w-7 place-items-center rounded-md"
                      >
                        <IconeDeAcao tipo="baixar" />
                      </a>
                    </>
                  )
                ) : (
                  <span className="text-warning text-xs">
                    {a.situacao === "bloqueado" ? t("bloqueado") : t("verificando")}
                  </span>
                )}
                {podeEnviar && (
                  <BotaoDeAcao
                    acao={removerAnexoAcao}
                    campos={{ id: a.id }}
                    rotulo={t("remover")}
                    icone="excluir"
                    confirmar={t("confirmarRemover", { nome: a.nomeArquivo })}
                    perigo
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {podeEnviar && (
        <form action={enviar} className="border-border border-t pt-3">
          {estado?.erro && <Aviso>{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
          <input type="hidden" name="alvoTipo" value={alvo.tipo} />
          <input type="hidden" name="alvoId" value={alvo.id} />
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("categoria")}</span>
            <select
              name="categoria"
              required
              defaultValue=""
              className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="" disabled />
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {t(`categorias.${c}` as "categorias.outro")}
                </option>
              ))}
            </select>
          </label>
          <Campo rotulo={t("descricao")} name="descricao" maxLength={200} />
          <input
            type="file"
            name="arquivo"
            required
            aria-label={t("arquivo")}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
            className="text-muted file:border-border file:bg-background file:text-primary mb-3 block text-xs file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Botao type="submit" disabled={enviando}>
            {enviando ? t("enviando") : t("enviar")}
          </Botao>
        </form>
      )}
    </div>
  );
}
