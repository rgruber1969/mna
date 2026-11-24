"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  alterarSituacaoDoNegocioAcao,
  alterarSituacaoNoFunilAcao,
  definirExclusividadeAcao,
  encerrarAcessosExternosAcao,
  prorrogarExclusividadeAcao,
  salvarObservacoesDoFunilAcao,
  salvarDiasDeAvisoAcao,
} from "@/app/acoes/negocios";
import { BotaoDeAcao, useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso } from "@/components/ui/basicos";

/** Andamento do negócio: funil das compradoras, situação, exclusividade e configurações. */

const estiloCampo =
  "border-border bg-background text-text focus:border-primary rounded-md border px-3 py-2 text-sm outline-none";
const estiloBotao =
  "bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60";

function Mensagem({ estado }: { estado?: { erro?: string; ok?: string } }) {
  if (estado?.erro) return <Aviso>{estado.erro}</Aviso>;
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}

const FUNIL = ["prospectada", "teaser", "nda", "proposta", "escolhida", "descartada"] as const;

type Cartao = {
  id: string;
  nome: string;
  situacao: string;
  equipe: string[];
  historico: { de: string; para: string; quando: Date | string; ator: string | null }[];
  observacoes: string | null;
};

/** Observações do cartão: texto livre, editado ali mesmo. */
export function ObservacoesDoCartao({
  dealId,
  cartao,
  podeEditar,
}: {
  dealId: string;
  cartao: Cartao;
  podeEditar: boolean;
}) {
  const t = useTranslations("negocios.andamento");
  const [editando, setEditando] = useState(false);
  const [estado, salvar, salvando] = useAcaoComAtualizacao(async (anterior, dados) => {
    const r = await salvarObservacoesDoFunilAcao(anterior, dados);
    if (r?.ok) setEditando(false);
    return r;
  });
  if (editando)
    return (
      <form action={salvar} className="mt-2">
        {estado?.erro && <Aviso>{estado.erro}</Aviso>}
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="id" value={cartao.id} />
        <textarea
          name="observacoes"
          rows={4}
          maxLength={4000}
          defaultValue={cartao.observacoes ?? ""}
          aria-label={t("observacoesDe", { nome: cartao.nome })}
          className="border-border bg-background text-text focus:border-primary w-full rounded-md border px-2 py-1 text-xs outline-none"
        />
        <span className="flex gap-2">
          <button type="submit" disabled={salvando} className="text-primary text-xs font-medium">
            {t("salvarObservacoes")}
          </button>
          <button type="button" onClick={() => setEditando(false)} className="text-muted text-xs">
            {t("cancelar")}
          </button>
        </span>
      </form>
    );
  return (
    <div className="mt-1">
      {cartao.observacoes && (
        <p className="text-text line-clamp-3 text-xs whitespace-pre-line" title={cartao.observacoes}>
          {cartao.observacoes}
        </p>
      )}
      {podeEditar && (
        <button type="button" onClick={() => setEditando(true)} className="text-primary text-xs">
          {cartao.observacoes ? t("editarObservacoes") : t("adicionarObservacoes")}
        </button>
      )}
    </div>
  );
}

/**
 * Funil de compradoras em kanban: arrastar o cartão muda a situação. Para
 * teclado e celular, cada cartão também tem "Mover para". Escolher pergunta
 * se descarta as demais; descartar avisa que o acesso acaba na hora.
 */
export function KanbanDoFunil({
  dealId,
  cartoes,
  podeEditar,
}: {
  dealId: string;
  cartoes: Cartao[];
  podeEditar: boolean;
}) {
  const t = useTranslations("negocios.andamento");
  const tf = useTranslations("negocios.funil");
  const router = useRouter();
  const [movendo, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  function enviar(id: string, para: string, descartarOutras = false) {
    const f = new FormData();
    f.set("dealId", dealId);
    f.set("id", id);
    f.set("situacao", para);
    if (descartarOutras) f.set("descartarOutras", "sim");
    iniciar(async () => {
      const r = await alterarSituacaoNoFunilAcao(undefined, f);
      setErro(r?.erro ?? null);
      if (!r?.erro) router.refresh();
    });
  }

  function mover(id: string, para: string) {
    const c = cartoes.find((x) => x.id === id);
    if (!c || c.situacao === para) return;
    const outras = cartoes.some((x) => x.id !== id && x.situacao !== "descartada");
    if (para === "escolhida" && outras) return setEscolha(id);
    if (para === "descartada" && !window.confirm(t("confirmarDescarte", { nome: c.nome }))) return;
    enviar(id, para);
  }

  const escolhida = cartoes.find((c) => c.id === escolha);
  return (
    <div>
      <p className="text-muted mb-3 text-sm">{podeEditar ? t("funilExplicacao") : t("funilSoLeitura")}</p>
      {erro && <Aviso>{erro}</Aviso>}
      {escolhida && (
        <div
          role="dialog"
          aria-label={t("escolherTitulo")}
          className="border-primary bg-surface mb-3 rounded-md border p-3 text-sm"
        >
          <p className="text-text mb-2">{t("escolherPergunta", { nome: escolhida.nome })}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={estiloBotao}
              onClick={() => (enviar(escolhida.id, "escolhida", true), setEscolha(null))}
            >
              {t("escolherEDescartar")}
            </button>
            <button
              type="button"
              className="border-border text-text rounded-md border px-3 py-2 text-sm"
              onClick={() => (enviar(escolhida.id, "escolhida"), setEscolha(null))}
            >
              {t("escolherEManter")}
            </button>
            <button type="button" className="text-muted text-sm" onClick={() => setEscolha(null)}>
              {t("cancelar")}
            </button>
          </div>
        </div>
      )}
      {cartoes.length === 0 ? (
        <p className="text-muted text-sm">{t("funilVazio")}</p>
      ) : (
        <div
          className={`grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6 ${movendo ? "opacity-70" : ""}`}
        >
          {FUNIL.map((coluna) => {
            const daColuna = cartoes.filter((c) => c.situacao === coluna);
            return (
              <section
                key={coluna}
                aria-label={tf(coluna)}
                onDragOver={(e) => {
                  if (!podeEditar || !arrastado) return;
                  e.preventDefault();
                  setSobre(coluna);
                }}
                onDragLeave={() => setSobre((x) => (x === coluna ? null : x))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  if (arrastado) mover(arrastado, coluna);
                  setArrastado(null);
                }}
                className={`bg-background min-w-0 rounded-lg border p-2 ${sobre === coluna ? "border-primary" : "border-border"}`}
              >
                <h3 className="text-muted mb-2 flex items-center justify-between px-1 text-xs font-semibold tracking-wide uppercase">
                  {tf(coluna)}
                  <span className="text-muted font-normal">{daColuna.length}</span>
                </h3>
                <ul className="flex min-h-16 flex-col gap-2">
                  {daColuna.map((c) => (
                    <li
                      key={c.id}
                      draggable={podeEditar}
                      onDragStart={(e) => {
                        setArrastado(c.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setArrastado(null)}
                      className={`border-border bg-surface rounded-md border p-2 text-sm shadow-sm ${podeEditar ? "cursor-grab" : ""}`}
                    >
                      <p className="text-text text-xs font-semibold break-words">{c.nome}</p>
                      {c.equipe.length > 0 && (
                        <p className="text-muted text-xs">{t("equipe", { nomes: c.equipe.join(", ") })}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {podeEditar && (
                          <select
                            value=""
                            onChange={(e) => e.target.value && mover(c.id, e.target.value)}
                            aria-label={t("moverPara", { nome: c.nome })}
                            className="border-border bg-background text-muted rounded border px-1 py-0.5 text-xs"
                          >
                            <option value="">{t("moverParaCurto")}</option>
                            {FUNIL.filter((x) => x !== c.situacao).map((x) => (
                              <option key={x} value={x}>
                                {tf(x)}
                              </option>
                            ))}
                          </select>
                        )}
                        {c.historico.length > 0 && (
                          <button
                            type="button"
                            aria-expanded={aberto === c.id}
                            onClick={() => setAberto((x) => (x === c.id ? null : c.id))}
                            className="text-primary text-xs"
                          >
                            {t("historicoDoCartao", { n: c.historico.length })}
                          </button>
                        )}
                      </div>
                      <ObservacoesDoCartao dealId={dealId} cartao={c} podeEditar={podeEditar} />
                      {aberto === c.id && (
                        <ol className="border-border text-muted mt-2 border-t pt-1 text-xs">
                          {c.historico.map((h, i) => (
                            <li key={i} className="py-0.5">
                              {h.de ? `${tf(h.de)} → ` : ""}
                              {tf(h.para)}
                              <span className="block">
                                {[
                                  h.ator,
                                  new Date(h.quando).toLocaleString("pt-BR", {
                                    timeZone: "America/Sao_Paulo",
                                  }),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Mudar a situação do negócio; reabrir e encerrar acessos externos (administradores). */
export function PainelSituacao({
  dealId,
  situacao,
  podeMudar,
  podeReabrir,
  podeEncerrarExternos,
}: {
  dealId: string;
  situacao: string;
  podeMudar: boolean;
  podeReabrir: boolean;
  podeEncerrarExternos: boolean;
}) {
  const t = useTranslations("negocios.andamento");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(alterarSituacaoDoNegocioAcao);
  const [encerrando, setEncerrando] = useState(false);
  const fechado = situacao === "concluido" || situacao === "encerrado";
  const botao = (para: string, rotulo: string, confirmar?: string) => (
    <form
      action={salvar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="situacao" value={para} />
      <button
        type="submit"
        disabled={salvando}
        className="border-border text-text rounded-md border px-3 py-2 text-sm"
      >
        {rotulo}
      </button>
    </form>
  );
  return (
    <div className="border-border mt-6 border-t pt-4">
      <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">{t("situacaoTitulo")}</p>
      <Mensagem estado={estado} />
      {fechado && <p className="text-muted mb-2 text-sm">{t("soConsulta")}</p>}
      <div className="flex flex-wrap gap-2">
        {podeMudar && !fechado && situacao === "andamento" && botao("suspenso", t("suspender"))}
        {podeMudar && !fechado && situacao === "suspenso" && botao("andamento", t("retomar"))}
        {podeMudar && !fechado && botao("concluido", t("concluir"), t("confirmarConcluir"))}
        {podeMudar && !fechado && !encerrando && (
          <button
            type="button"
            onClick={() => setEncerrando(true)}
            className="border-border text-text rounded-md border px-3 py-2 text-sm"
          >
            {t("encerrar")}
          </button>
        )}
        {podeReabrir && botao("andamento", t("reabrir"), t("confirmarReabrir"))}
      </div>
      {encerrando && (
        <form action={salvar} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="situacao" value="encerrado" />
          <select name="motivo" required defaultValue="" aria-label={t("motivo")} className={estiloCampo}>
            <option value="" disabled>
              {t("motivo")}
            </option>
            {(
              ["desistencia_vendedora", "desistencia_compradora", "preco", "diligencia", "outro"] as const
            ).map((m) => (
              <option key={m} value={m}>
                {t(`motivos.${m}`)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={salvando} className={estiloBotao}>
            {t("confirmarEncerramento")}
          </button>
          <button type="button" onClick={() => setEncerrando(false)} className="text-muted text-sm">
            {t("cancelar")}
          </button>
        </form>
      )}
      {podeEncerrarExternos && (
        <div className="mt-3">
          <BotaoDeAcao
            acao={encerrarAcessosExternosAcao}
            campos={{ dealId }}
            rotulo={t("encerrarExternos")}
            confirmar={t("confirmarEncerrarExternos")}
            perigo
          />
        </div>
      )}
    </div>
  );
}

/** Exclusividade: definir (com a compradora escolhida) e prorrogar. */
export function PainelExclusividade({
  dealId,
  exclusividade,
  podeEditar,
  hoje,
}: {
  dealId: string;
  exclusividade: {
    compradora: string | null;
    inicio: string;
    fim: string;
    prorrogacoes: { fimAnterior: string; novoFim: string; motivo: string | null }[];
  } | null;
  podeEditar: boolean;
  hoje: string;
}) {
  const t = useTranslations("negocios.andamento");
  const [estadoDef, definir, definindo] = useAcaoComAtualizacao(definirExclusividadeAcao);
  const [estadoPro, prorrogar, prorrogando] = useAcaoComAtualizacao(prorrogarExclusividadeAcao);
  const br = (d: string) => d.split("-").reverse().join("/");
  if (!exclusividade)
    return podeEditar ? (
      <form action={definir} className="max-w-md">
        <p className="text-muted mb-3 text-sm">{t("exclusividadeExplicacao")}</p>
        <Mensagem estado={estadoDef} />
        <input type="hidden" name="dealId" value={dealId} />
        <label className="mb-3 block">
          <span className="text-text mb-1 block text-sm font-medium">{t("inicio")}</span>
          <input type="date" name="inicio" required defaultValue={hoje} className={`${estiloCampo} w-full`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("dias")}</span>
            <input name="dias" inputMode="numeric" className={`${estiloCampo} w-full`} />
          </label>
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("ouFim")}</span>
            <input type="date" name="fim" className={`${estiloCampo} w-full`} />
          </label>
        </div>
        <button type="submit" disabled={definindo} className={estiloBotao}>
          {t("definir")}
        </button>
      </form>
    ) : (
      <p className="text-muted text-sm">{t("semExclusividade")}</p>
    );
  return (
    <div className="max-w-md text-sm">
      <p>
        <span className="font-medium">{exclusividade.compradora}</span>
        <span className="text-muted block">
          {t("periodo", { inicio: br(exclusividade.inicio), fim: br(exclusividade.fim) })}
        </span>
      </p>
      {exclusividade.prorrogacoes.length > 0 && (
        <ul className="text-muted mt-2 text-xs">
          {exclusividade.prorrogacoes.map((p, i) => (
            <li key={i}>
              {t("prorrogada", { de: br(p.fimAnterior), para: br(p.novoFim) })}
              {p.motivo && ` · ${p.motivo}`}
            </li>
          ))}
        </ul>
      )}
      {podeEditar && (
        <form action={prorrogar} className="border-border mt-4 border-t pt-3">
          <p className="text-text mb-2 font-medium">{t("prorrogar")}</p>
          <Mensagem estado={estadoPro} />
          <input type="hidden" name="dealId" value={dealId} />
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("novoFim")}</span>
            <input type="date" name="novoFim" required className={`${estiloCampo} w-full`} />
          </label>
          <label className="mb-3 block">
            <span className="text-text mb-1 block text-sm font-medium">{t("motivoOpcional")}</span>
            <input name="motivo" maxLength={500} className={`${estiloCampo} w-full`} />
          </label>
          <button type="submit" disabled={prorrogando} className={estiloBotao}>
            {t("prorrogar")}
          </button>
        </form>
      )}
    </div>
  );
}

/** Configurações gerais do tenant: antecedência dos avisos da exclusividade. */
export function FormConfiguracoes({
  dias,
  diasTarefa,
  horasResumo,
  diasParada,
}: {
  dias: number[];
  diasTarefa: number[];
  horasResumo: number;
  diasParada: number;
}) {
  const t = useTranslations("negocios.configuracoes");
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarDiasDeAvisoAcao);
  return (
    <form action={salvar} className="max-w-md">
      <Mensagem estado={estado} />
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("diasAviso")}</span>
        <input name="dias" defaultValue={dias.join(", ")} required className={`${estiloCampo} w-full`} />
        <span className="text-muted mt-1 block text-xs">{t("diasAvisoAjuda")}</span>
      </label>
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("diasTarefa")}</span>
        <input
          name="diasTarefa"
          defaultValue={diasTarefa.join(", ")}
          required
          className={`${estiloCampo} w-full`}
        />
        <span className="text-muted mt-1 block text-xs">{t("diasTarefaAjuda")}</span>
      </label>
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("horasResumo")}</span>
        <input
          name="horasResumo"
          type="number"
          min={1}
          max={72}
          defaultValue={horasResumo}
          required
          className={`${estiloCampo} w-32`}
        />
        <span className="text-muted mt-1 block text-xs">{t("horasResumoAjuda")}</span>
      </label>
      <label className="mb-3 block">
        <span className="text-text mb-1 block text-sm font-medium">{t("diasParada")}</span>
        <input
          name="diasParada"
          type="number"
          min={1}
          max={365}
          defaultValue={diasParada}
          required
          className={`${estiloCampo} w-32`}
        />
        <span className="text-muted mt-1 block text-xs">{t("diasParadaAjuda")}</span>
      </label>
      <button type="submit" disabled={salvando} className={estiloBotao}>
        {t("salvar")}
      </button>
    </form>
  );
}
