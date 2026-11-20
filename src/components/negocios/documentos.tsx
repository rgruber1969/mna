"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  acessoDaUltimaVersaoAcao,
  alterarAcessoDaVersaoAcao,
  concluirEnvioAcao,
  excluirVersaoAcao,
  iniciarEnvioAcao,
  linkDeDownloadAcao,
} from "@/app/acoes/documentos";
import { BotaoDeAcao } from "@/components/usuarios/formularios";
import { temPrevia, Visualizar } from "@/components/cadastros/previa-do-anexo";
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
  tipo: string | null;
  situacao: "enviando" | "disponivel" | "bloqueado";
  enviadoPor: string | null;
  criadoEm: Date;
  comentario: string | null;
  acesso: string[];
  acessoIds: { todos: boolean; perfis: string[]; usuarios: string[] };
  podeAlterarAcesso: boolean;
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
  etapas: Opcao[];
  opcoesDeAcesso: { perfis: Opcao[]; usuarios: (Opcao & { lado: string | null })[] };
  meuLado: string[];
  fechado: boolean;
};

const campo =
  "border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1.5 text-sm outline-none";
/** Tem prévia na tela: PDF ou imagem, até 50 MB, para quem pode baixar. */
const podeVer = (v: { podeBaixar: boolean; tipo: string | null; tamanho: number }) =>
  v.podeBaixar && Boolean(v.tipo && temPrevia(v.tipo)) && v.tamanho <= 50 * 1024 * 1024;
const tamanho = (b: number) =>
  b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
const data = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

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

type Escolha = { todos: boolean; perfis: Set<string>; usuarios: Set<string> };

/**
 * "Quem pode ver": todos os participantes (os dois lados) ou uma lista de
 * perfis e pessoas, com atalhos por lado.
 */
function EscolhaDeAcesso({
  dr,
  escolha,
  mudar,
}: {
  dr: DataRoom;
  escolha: Escolha;
  mudar: (e: Escolha) => void;
}) {
  const t = useTranslations("documentos");
  const alternar = (campo: "perfis" | "usuarios", id: string) => {
    const n = new Set(escolha[campo]);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    mudar({ ...escolha, [campo]: n });
  };
  const doLado = (lado: string) => dr.opcoesDeAcesso.usuarios.filter((u) => u.lado === lado).map((u) => u.id);
  const atalho = (rotulo: string, ids: string[] | null) => (
    <button
      type="button"
      disabled={escolha.todos}
      onClick={() =>
        mudar({
          ...escolha,
          perfis: ids ? escolha.perfis : new Set(),
          usuarios: ids ? new Set([...escolha.usuarios, ...ids]) : new Set(),
        })
      }
      className="border-border text-muted hover:text-primary rounded-full border px-2 py-0.5 text-xs disabled:opacity-50"
    >
      {rotulo}
    </button>
  );
  return (
    <fieldset className="mt-3">
      <legend className="text-text text-sm font-medium">{t("quemVe")}</legend>
      <p className="text-muted mb-1 text-xs">{t("quemVeAjuda")}</p>
      <label className="text-text mb-2 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={escolha.todos}
          onChange={(e) => mudar({ ...escolha, todos: e.target.checked })}
        />
        {t("todosParticipantes")}
      </label>
      <div className={escolha.todos ? "pointer-events-none opacity-50" : ""}>
        <div className="mb-2 flex flex-wrap gap-2">
          {atalho(t("meuLado"), dr.meuLado)}
          {atalho(t("ladoVendedor"), doLado("vendedor"))}
          {atalho(t("ladoComprador"), doLado("comprador"))}
          {atalho(t("limpar"), null)}
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div>
            <p className="text-muted text-xs font-semibold">{t("porPerfil")}</p>
            {dr.opcoesDeAcesso.perfis.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={escolha.perfis.has(p.id)}
                  onChange={() => alternar("perfis", p.id)}
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
                  checked={escolha.usuarios.has(u.id)}
                  onChange={() => alternar("usuarios", u.id)}
                />
                {u.nome}
                {u.lado && <span className="text-muted text-xs">({t(`lados.${u.lado}`)})</span>}
              </label>
            ))}
          </div>
        </div>
        <p className="text-muted mt-1 text-xs">{t("soQuemTemUsuario")}</p>
      </div>
    </fieldset>
  );
}

/** "Alterar quem vê" de uma versão já enviada (ex.: liberar ao outro lado). */
function AlterarAcesso({
  dr,
  versao,
  fechar,
}: {
  dr: DataRoom;
  versao: Versao;
  fechar: (mudou: boolean) => void;
}) {
  const t = useTranslations("documentos");
  const [escolha, setEscolha] = useState<Escolha>({
    todos: versao.acessoIds.todos,
    perfis: new Set(versao.acessoIds.perfis),
    usuarios: new Set(versao.acessoIds.usuarios),
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="border-border bg-background mt-2 rounded-md border p-3">
      {erro && <Aviso>{erro}</Aviso>}
      <EscolhaDeAcesso dr={dr} escolha={escolha} mudar={setEscolha} />
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            const r = await alterarAcessoDaVersaoAcao(versao.id, {
              todos: escolha.todos,
              perfis: [...escolha.perfis],
              usuarios: [...escolha.usuarios],
            });
            setSalvando(false);
            if (r.erro) return setErro(r.erro);
            fechar(true);
          }}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
        >
          {t("salvarAcesso")}
        </button>
        <button type="button" onClick={() => fechar(false)} className="text-muted text-sm">
          {t("cancelar")}
        </button>
      </div>
    </div>
  );
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
  aoEnviar?: (gravados: number) => void;
  dealId: string;
  dr: DataRoom;
  documento?: Documento;
  etapaInicial: string;
  inicial: { todos?: boolean; perfis: string[]; usuarios: string[] };
  fechar: () => void;
}) {
  const t = useTranslations("documentos");
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [atual, setAtual] = useState<{ n: number; total: number; nome: string } | null>(null);
  const [varios, setVarios] = useState(false);
  const [nomes, setNomes] = useState<string[]>([]);
  const [escolha, setEscolha] = useState<Escolha>({
    todos: inicial.todos ?? false,
    perfis: new Set(inicial.perfis),
    usuarios: new Set(inicial.usuarios),
  });
  async function enviar(f: FormData) {
    const arquivos = f.getAll("arquivo").filter((x): x is File => x instanceof File && x.size > 0);
    if (arquivos.length === 0) return setErro(t("erros.escolhaArquivo"));
    // Nova versão: um arquivo só. Documento novo: cada arquivo vira um documento.
    const lista = documento ? arquivos.slice(0, 1) : arquivos;
    setErro(null);
    const etapa = String(f.get("etapaId") ?? "");
    const tituloDigitado = String(f.get("titulo") ?? "").trim();
    const falhas: string[] = [];
    let gravados = 0;
    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      setAtual({ n: i + 1, total: lista.length, nome: arquivo.name });
      setProgresso(0);
      const titulo =
        lista.length === 1 && tituloDigitado
          ? tituloDigitado
          : arquivo.name.replace(/\.[^.]+$/, "").slice(0, 200);
      const inicio = await iniciarEnvioAcao(dealId, {
        documentoId: documento?.id,
        titulo,
        etapaId: etapa === "geral" ? null : etapa || null,
        categoriaId: String(f.get("categoriaId") ?? ""),
        nomeArquivo: arquivo.name,
        tamanho: arquivo.size,
        comentario: String(f.get("comentario") ?? ""),
        perfis: [...escolha.perfis],
        usuarios: [...escolha.usuarios],
        todos: escolha.todos,
      });
      if (inicio.erro || !inicio.url || !inicio.versaoId) {
        falhas.push(`${arquivo.name}: ${inicio.erro ?? t("erros.envio")}`);
        continue;
      }
      if (!(await enviarArquivo(inicio.url, arquivo, setProgresso))) {
        await concluirEnvioAcao(inicio.versaoId);
        falhas.push(`${arquivo.name}: ${t("erros.envio")}`);
        continue;
      }
      const concluido = await concluirEnvioAcao(inicio.versaoId);
      if (concluido.erro) falhas.push(`${arquivo.name}: ${concluido.erro}`);
      else gravados++;
    }
    setProgresso(null);
    setAtual(null);
    router.refresh();
    aoEnviar?.(gravados);
    if (falhas.length) return setErro(falhas.join(" · "));
    fechar();
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
              <input
                name="titulo"
                required={!varios}
                disabled={varios}
                maxLength={200}
                placeholder={varios ? t("tituloPeloArquivo") : undefined}
                className={campo}
              />
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
          <span className="flex flex-wrap items-center gap-3">
            <span className="bg-primary text-primary-foreground inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm hover:opacity-90">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
              </svg>
              {documento ? t("escolherArquivo") : t("escolherArquivos")}
            </span>
            <span className="text-text text-sm">
              {nomes.length === 0
                ? t("nenhumArquivo")
                : nomes.length === 1
                  ? nomes[0]
                  : t("arquivosEscolhidos", { n: nomes.length })}
            </span>
            <input
              name="arquivo"
              type="file"
              required
              multiple={!documento}
              onChange={(e) => {
                const lista = [...(e.target.files ?? [])].map((f) => f.name);
                setNomes(lista);
                setVarios(lista.length > 1);
              }}
              className="sr-only"
            />
          </span>
          {nomes.length > 1 && (
            <ul className="text-muted mt-1 list-disc pl-5 text-xs">
              {nomes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <span className="text-muted block text-xs">{t("arquivoAjuda")}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-muted mb-0.5 block text-xs">{t("comentario")}</span>
          <input name="comentario" maxLength={2000} className={campo} />
        </label>
      </div>
      <EscolhaDeAcesso dr={dr} escolha={escolha} mudar={setEscolha} />
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
          <span className="text-muted text-xs">
            {atual && atual.total > 1
              ? t("enviandoVarios", { n: atual.n, total: atual.total, nome: atual.nome, p: progresso })
              : t("enviando", { p: progresso })}
          </span>
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
    inicial: { todos?: boolean; perfis: string[]; usuarios: string[] };
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editandoAcesso, setEditandoAcesso] = useState<string | null>(null);
  const router = useRouter();
  const etapas = dr.etapas.map((e) => [e.id, e.nome] as const);
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
            onClick={() => {
              setOk(null);
              setEnvio({ inicial: { perfis: [], usuarios: dr.meuLado } });
            }}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t("enviarDocumento")}
          </button>
        )}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
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
          aoEnviar={(gravados) => {
            setErro(null);
            setOk(gravados > 0 ? t("gravados", { n: gravados }) : null);
            aoMudar?.();
          }}
        />
      )}
      {lista.length === 0 ? (
        <p className="text-muted text-sm">{t("nenhum")}</p>
      ) : (
        <div className="overflow-x-auto">
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
                          {podeVer(ultima) && (
                            <Visualizar
                              id={ultima.id}
                              tipo={ultima.tipo!}
                              nome={ultima.nomeArquivo}
                              endereco={`/api/documentos/versoes/${ultima.id}/previa`}
                            />
                          )}
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
                                    {t("acessoDaVersao", {
                                      lista:
                                        v.acesso
                                          .map((x) => (x === "__todos__" ? t("todosParticipantes") : x))
                                          .join(", ") || t("soQuemEnviou"),
                                    })}
                                  </span>
                                </span>
                                <span className="flex items-center gap-3">
                                  {podeVer(v) && (
                                    <Visualizar
                                      id={v.id}
                                      tipo={v.tipo!}
                                      nome={v.nomeArquivo}
                                      endereco={`/api/documentos/versoes/${v.id}/previa`}
                                    />
                                  )}
                                  {v.podeBaixar && (
                                    <button
                                      type="button"
                                      onClick={() => baixar(v.id)}
                                      className="text-primary"
                                    >
                                      {t("baixar")}
                                    </button>
                                  )}
                                  <a
                                    href={`/negocios/${dealId}?aba=mensagens&conversa=versao:${v.id}`}
                                    className="text-primary"
                                  >
                                    {t("conversa")}
                                  </a>
                                  {v.podeAlterarAcesso && editandoAcesso !== v.id && (
                                    <button
                                      type="button"
                                      onClick={() => setEditandoAcesso(v.id)}
                                      className="text-primary"
                                    >
                                      {t("alterarQuemVe")}
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
                                {editandoAcesso === v.id && (
                                  <div className="basis-full">
                                    <AlterarAcesso
                                      dr={dr}
                                      versao={v}
                                      fechar={(mudou) => {
                                        setEditandoAcesso(null);
                                        if (mudou) {
                                          router.refresh();
                                          aoMudar?.();
                                        }
                                      }}
                                    />
                                  </div>
                                )}
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
