"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acessoDaUltimaVersaoAcao,
  concluirEnvioAcao,
  excluirVersaoAcao,
  iniciarEnvioAcao,
  linkDeDownloadAcao,
} from "@/app/acoes/documentos";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { Aviso, estiloTabela } from "@/components/ui/basicos";

/**
 * Data room do negócio (item 11): documentos com versões, pastas por etapa e
 * lista de acesso por versão. O arquivo vai do navegador direto ao
 * armazenamento (com barra de progresso) e só fica disponível depois da
 * verificação no servidor.
 */

type Versao = {
  id: string;
  numero: number;
  nomeArquivo: string;
  tamanho: number;
  situacao: "enviando" | "disponivel" | "bloqueado";
  enviadoPor: string | null;
  criadoEm: Date;
  comentario: string | null;
  acesso: string[];
  podeBaixar: boolean;
  podeExcluir: boolean;
};
type Documento = {
  id: string;
  titulo: string;
  categoria: string | null;
  etapaId: string | null;
  etapa: string | null;
  versoes: Versao[];
  podeNovaVersao: boolean;
};
type Opcao = { id: string; nome: string };
type DataRoom = {
  documentos: Documento[];
  destinos: { id: string | null; nome: string }[];
  categorias: Opcao[];
  opcoesDeAcesso: { perfis: Opcao[]; usuarios: (Opcao & { lado: string | null })[] };
  meuLado: string[];
  fechado: boolean;
};

const campo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none";
const tamanho = (b: number) =>
  b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
const data = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Envia o arquivo direto ao armazenamento, com progresso. */
function enviarArquivo(url: string, arquivo: File, progresso: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && progresso(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(arquivo);
  });
}

function FormEnvio({
  dealId,
  dr,
  documento,
  etapaInicial,
  inicial,
  fechar,
  aoEnviar,
}: {
  aoEnviar?: () => void;
  dealId: string;
  dr: DataRoom;
  documento?: Documento;
  etapaInicial: string;
  inicial: { perfis: string[]; usuarios: string[] };
  fechar: () => void;
}) {
  const t = useTranslations("documentos");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [perfis, setPerfis] = useState(new Set(inicial.perfis));
  const [usuarios, setUsuarios] = useState(new Set(inicial.usuarios));
  const alternar = (conj: Set<string>, definir: (s: Set<string>) => void, id: string) => {
    const n = new Set(conj);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    definir(n);
  };
  async function enviar(f: FormData) {
    const arquivo = f.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return setErro(t("erros.escolhaArquivo"));
    setErro(null);
    setProgresso(0);
    const etapa = String(f.get("etapaId") ?? "");
    const inicio = await iniciarEnvioAcao(dealId, {
      documentoId: documento?.id,
      titulo: String(f.get("titulo") ?? ""),
      etapaId: etapa === "geral" ? null : etapa || null,
      categoriaId: String(f.get("categoriaId") ?? ""),
      nomeArquivo: arquivo.name,
      tamanho: arquivo.size,
      comentario: String(f.get("comentario") ?? ""),
      perfis: [...perfis],
      usuarios: [...usuarios],
    });
    if (inicio.erro || !inicio.url || !inicio.versaoId) {
      setProgresso(null);
      return setErro(inicio.erro ?? t("erros.envio"));
    }
    if (!(await enviarArquivo(inicio.url, arquivo, setProgresso))) {
      setProgresso(null);
      await concluirEnvioAcao(inicio.versaoId);
      return setErro(t("erros.envio"));
    }
    const fim = await concluirEnvioAcao(inicio.versaoId);
    setProgresso(null);
    if (fim.erro) return setErro(fim.erro);
    fechar();
    router.refresh();
    aoEnviar?.();
  }
  return (
    <form action={enviar} className="border-border bg-background mb-4 rounded-md border p-3">
      <p className="text-text mb-2 text-sm font-medium">
        {documento ? t("novaVersaoDe", { titulo: documento.titulo }) : t("novoDocumento")}
      </p>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-2 sm:grid-cols-2">
        {!documento && (
          <>
            <label className="block sm:col-span-2">
              <span className="text-muted mb-0.5 block text-xs">{t("titulo")}</span>
              <input name="titulo" required maxLength={200} className={campo} />
            </label>
            <label className="block">
              <span className="text-muted mb-0.5 block text-xs">{t("etapa")}</span>
              <select name="etapaId" defaultValue={etapaInicial} className={campo}>
                {dr.destinos.map((d) => (
                  <option key={d.id ?? "geral"} value={d.id ?? "geral"}>
                    {d.id ? d.nome : t("geral")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-muted mb-0.5 block text-xs">{t("categoria")}</span>
              <select name="categoriaId" defaultValue="" className={campo}>
                <option value="">{t("semCategoria")}</option>
                {dr.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="block sm:col-span-2">
          <span className="text-muted mb-0.5 block text-xs">{t("arquivo")}</span>
          <input name="arquivo" type="file" required className="text-sm" />
          <span className="text-muted block text-xs">{t("arquivoAjuda")}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-muted mb-0.5 block text-xs">{t("comentario")}</span>
          <input name="comentario" maxLength={2000} className={campo} />
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-text text-sm font-medium">{t("quemVe")}</legend>
        <p className="text-muted mb-1 text-xs">{t("quemVeAjuda")}</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div>
            <p className="text-muted text-xs font-semibold">{t("porPerfil")}</p>
            {dr.opcoesDeAcesso.perfis.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={perfis.has(p.id)}
                  onChange={() => alternar(perfis, setPerfis, p.id)}
                />
                {p.nome}
              </label>
            ))}
          </div>
          <div>
            <p className="text-muted text-xs font-semibold">{t("porPessoa")}</p>
            {dr.opcoesDeAcesso.usuarios.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usuarios.has(u.id)}
                  onChange={() => alternar(usuarios, setUsuarios, u.id)}
                />
                {u.nome}
                {u.lado && <span className="text-muted text-xs">({t(`lados.${u.lado}`)})</span>}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      {progresso !== null && (
        <div
          className="mt-3"
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="bg-border h-2 rounded">
            <div className="bg-primary h-2 rounded" style={{ width: `${progresso}%` }} />
          </div>
          <span className="text-muted text-xs">{t("enviando", { p: progresso })}</span>
        </div>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={progresso !== null}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {t("enviar")}
        </button>
        <button type="button" onClick={fechar} className="text-muted text-sm">
          {t("cancelar")}
        </button>
      </div>
    </form>
  );
}

export function DataRoomDoNegocio({
  dealId,
  dr,
  etapaFiltro,
  aoMudar,
}: {
  dealId: string;
  dr: DataRoom;
  etapaFiltro: string;
  /** Chamado depois de enviar (ex.: o painel do kanban recarrega a lista). */
  aoMudar?: () => void;
}) {
  const t = useTranslations("documentos");
  const [filtro, setFiltro] = useState(etapaFiltro);
  const [aberto, setAberto] = useState<string | null>(null);
  const [envio, setEnvio] = useState<{
    documento?: Documento;
    inicial: { perfis: string[]; usuarios: string[] };
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const etapas = [
    ...new Map(dr.documentos.filter((d) => d.etapaId).map((d) => [d.etapaId!, d.etapa!])).entries(),
  ];
  for (const d of dr.destinos) if (d.id && !etapas.some(([id]) => id === d.id)) etapas.push([d.id, d.nome]);
  const lista = dr.documentos.filter((d) =>
    filtro === "" ? true : filtro === "geral" ? d.etapaId === null : d.etapaId === filtro,
  );
  async function baixar(versaoId: string) {
    const r = await linkDeDownloadAcao(versaoId);
    if (r.erro || !r.url) return setErro(r.erro ?? t("erros.download"));
    window.location.assign(r.url);
  }
  async function novaVersao(d: Documento) {
    setEnvio({ documento: d, inicial: await acessoDaUltimaVersaoAcao(d.id) });
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t("filtrarEtapa")}</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${campo} w-auto`}>
            <option value="">{t("todas")}</option>
            <option value="geral">{t("geral")}</option>
            {etapas.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        {!dr.fechado && dr.destinos.length > 0 && !envio && (
          <button
            type="button"
            onClick={() => setEnvio({ inicial: { perfis: [], usuarios: dr.meuLado } })}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t("enviarDocumento")}
          </button>
        )}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {envio && (
        <FormEnvio
          dealId={dealId}
          dr={dr}
          documento={envio.documento}
          etapaInicial={
            filtro && filtro !== "geral" && dr.destinos.some((d) => d.id === filtro) ? filtro : "geral"
          }
          inicial={envio.inicial}
          fechar={() => setEnvio(null)}
          aoEnviar={aoMudar}
        />
      )}
      {lista.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhum")}</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className={estiloTabela.tabela}>
            <thead className={estiloTabela.cabecalho}>
              <tr>
                <th className={estiloTabela.th}>{t("documento")}</th>
                <th className={estiloTabela.th}>{t("categoria")}</th>
                <th className={estiloTabela.th}>{t("etapa")}</th>
                <th className={estiloTabela.th}>{t("ultimaVersao")}</th>
                <th className={estiloTabela.th}>{t("acoes")}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const ultima = d.versoes[0];
                return (
                  <Fragment key={d.id}>
                    <tr className={estiloTabela.linha}>
                      <td className={estiloTabela.td}>
                        <button
                          type="button"
                          aria-expanded={aberto === d.id}
                          onClick={() => setAberto((x) => (x === d.id ? null : d.id))}
                          className="text-text text-left font-medium"
                        >
                          {aberto === d.id ? "▾" : "▸"} {d.titulo}
                        </button>
                        <span className="text-muted block text-xs">{ultima.nomeArquivo}</span>
                      </td>
                      <td className={`${estiloTabela.td} text-muted text-xs`}>{d.categoria ?? "—"}</td>
                      <td className={`${estiloTabela.td} text-xs`}>{d.etapa ?? t("geral")}</td>
                      <td className={`${estiloTabela.td} text-muted text-xs whitespace-nowrap`}>
                        {t("versaoResumo", {
                          n: ultima.numero,
                          data: data(ultima.criadoEm),
                          autor: ultima.enviadoPor ?? "—",
                        })}
                        {ultima.situacao !== "disponivel" && (
                          <span className="text-warning block">{t(`situacoes.${ultima.situacao}`)}</span>
                        )}
                      </td>
                      <td className={`${estiloTabela.td} whitespace-nowrap`}>
                        <span className="flex gap-3 text-xs">
                          {ultima.podeBaixar && (
                            <button
                              type="button"
                              onClick={() => baixar(ultima.id)}
                              className="text-primary font-medium"
                            >
                              {t("baixar")}
                            </button>
                          )}
                          {d.podeNovaVersao && !envio && (
                            <button type="button" onClick={() => novaVersao(d)} className="text-primary">
                              {t("novaVersao")}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {aberto === d.id && (
                      <tr>
                        <td colSpan={5} className="bg-background px-4 py-2">
                          <ul className="divide-border divide-y text-xs">
                            {d.versoes.map((v) => (
                              <li
                                key={v.id}
                                className="flex flex-wrap items-start justify-between gap-2 py-1.5"
                              >
                                <span>
                                  <span className="text-text font-medium">
                                    {t("versaoN", { n: v.numero })} · {v.nomeArquivo} · {tamanho(v.tamanho)}
                                  </span>
                                  <span className="text-muted block">
                                    {[v.enviadoPor, data(v.criadoEm), v.comentario]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                  <span className="text-muted block">
                                    {t("acessoDaVersao", { lista: v.acesso.join(", ") || t("soQuemEnviou") })}
                                  </span>
                                </span>
                                <span className="flex items-center gap-3">
                                  {v.podeBaixar && (
                                    <button
                                      type="button"
                                      onClick={() => baixar(v.id)}
                                      className="text-primary"
                                    >
                                      {t("baixar")}
                                    </button>
                                  )}
                                  {v.podeExcluir && (
                                    <BotaoDeAcao
                                      acao={excluirVersaoAcao}
                                      campos={{ id: v.id }}
                                      rotulo={t("excluir")}
                                      confirmar={t("confirmarExcluir", { n: v.numero })}
                                      perigo
                                    />
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
