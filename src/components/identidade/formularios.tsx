"use client";

import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import {
  enviarImagemAcao,
  removerImagemAcao,
  restaurarPadraoAcao,
  salvarIdentidadeAcao,
} from "@/app/acoes/identidade-visual";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Botao, Campo, LogoDoTenant } from "@/components/ui/basicos";
import {
  FONTES,
  TOKENS_PADRAO,
  corValida,
  distanciaDeMatiz,
  MATIZ_MINIMA_DO_ACENTO,
  problemasDeContraste,
  sugestoesDeAcento,
  tonsDaCor,
  variaveisDoTema,
  TAMANHO_PADRAO,
  TAMANHOS_DE_FONTE,
} from "@/config/marca";

type Inicial = {
  nome: string;
  nomeExibicao: string | null;
  corPrimaria: string | null;
  corDestaque: string | null;
  corAcento: string | null;
  fonte: string | null;
  tamanhoFonte: number | null;
};

/** Faixa com os tons derivados da cor (do mais escuro ao mais claro). */
function Rampa({ cor }: { cor: string }) {
  if (!corValida(cor)) return null;
  const tons = tonsDaCor(cor);
  return (
    <span className="mt-1.5 flex h-2 w-48 overflow-hidden rounded" aria-hidden="true">
      {tons.map((t, i) => (
        <span key={i} className="flex-1" style={{ background: t }} />
      ))}
    </span>
  );
}

function CampoDeCor({
  rotulo,
  ajuda,
  nome,
  valor,
  mudar,
}: {
  rotulo: string;
  ajuda: string;
  nome: string;
  valor: string;
  mudar: (v: string) => void;
}) {
  const t = useTranslations("administracao.identidade.formulario");
  return (
    <div className="mb-4 max-w-64">
      <span className="text-text block text-sm font-medium">{rotulo}</span>
      <span className="text-muted mb-1 block text-xs">{ajuda}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t("seletor", { rotulo })}
          value={corValida(valor) ? valor : TOKENS_PADRAO.primaria}
          onChange={(e) => mudar(e.target.value)}
          className="border-border h-9 w-12 cursor-pointer rounded border"
        />
        <input
          name={nome}
          aria-label={rotulo}
          value={valor}
          onChange={(e) => mudar(e.target.value.trim())}
          maxLength={7}
          className="border-border bg-background text-text focus:border-primary w-28 rounded-md border px-3 py-2 font-mono text-sm outline-none"
        />
      </div>
      <Rampa cor={valor} />
    </div>
  );
}

/**
 * Nome de exibição, cores e fonte, com prévia ao vivo e aviso de contraste
 * antes de salvar (o servidor confere de novo; ADR-0010).
 */
export function FormIdentidade({ inicial }: { inicial: Inicial }) {
  const t = useTranslations("administracao.identidade.formulario");
  const tErro = useTranslations();
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarIdentidadeAcao);
  const [estadoPadrao, restaurar, restaurando] = useAcaoComAtualizacao(restaurarPadraoAcao);
  const [nome, setNome] = useState(inicial.nomeExibicao ?? "");
  const [primaria, setPrimaria] = useState(inicial.corPrimaria ?? TOKENS_PADRAO.primaria);
  const [destaque, setDestaque] = useState(inicial.corDestaque ?? TOKENS_PADRAO.destaque);
  const [acento, setAcento] = useState(inicial.corAcento ?? TOKENS_PADRAO.acento);
  const [fonte, setFonte] = useState(inicial.fonte ?? "manrope");
  const [tamanho, setTamanho] = useState(inicial.tamanhoFonte ?? TAMANHO_PADRAO);
  const problemas = problemasDeContraste({ primaria, destaque, acento }).map((p) =>
    tErro(p.erro, p.parametros),
  );
  const tema = variaveisDoTema({ primaria, destaque, acento }, fonte) as CSSProperties;
  const sugestoes = sugestoesDeAcento(primaria);
  const parecido =
    corValida(primaria) && corValida(acento) && distanciaDeMatiz(primaria, acento) < MATIZ_MINIMA_DO_ACENTO;
  const mensagem = estado ?? estadoPadrao;

  return (
    <div>
      {mensagem?.erro && <Aviso>{mensagem.erro}</Aviso>}
      {mensagem?.ok && <Aviso tipo="ok">{mensagem.ok}</Aviso>}
      <form action={salvar}>
        <Campo
          rotulo={t("nomeExibicao")}
          name="nomeExibicao"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={inicial.nome}
          maxLength={80}
        />
        <p className="text-muted -mt-3 mb-4 text-xs">{t("nomeAjuda", { nome: inicial.nome })}</p>
        <div className="flex flex-wrap gap-x-8">
          <CampoDeCor
            rotulo={t("corPrimaria")}
            ajuda={t("corPrimariaAjuda")}
            nome="corPrimaria"
            valor={primaria}
            mudar={setPrimaria}
          />
          <CampoDeCor
            rotulo={t("corDestaque")}
            ajuda={t("corDestaqueAjuda")}
            nome="corDestaque"
            valor={destaque}
            mudar={setDestaque}
          />
          <CampoDeCor
            rotulo={t("corAcento")}
            ajuda={t("corAcentoAjuda")}
            nome="corAcento"
            valor={acento}
            mudar={setAcento}
          />
        </div>
        {sugestoes.length > 0 && (
          <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">{t("sugestoes")}</span>
            {sugestoes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAcento(c)}
                aria-label={t("usarSugestao", { cor: c })}
                className="border-border text-text hover:border-primary flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono"
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: c }} />
                {c}
              </button>
            ))}
          </div>
        )}
        {parecido && (
          <p className="text-warning bg-warning-soft mb-4 rounded-md px-3 py-2 text-xs">{t("avisoMatiz")}</p>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">{t("coresDeSituacao")}</span>
          <span className="bg-danger-soft text-danger rounded-full px-2 py-0.5 font-semibold">
            {t("vencido")}
          </span>
          <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 font-semibold">
            {t("venceLogo")}
          </span>
          <span className="bg-success-soft text-success rounded-full px-2 py-0.5 font-semibold">
            {t("emDia")}
          </span>
        </div>
        <label className="mb-4 block">
          <span className="text-text mb-1 block text-sm font-medium">{t("fonte")}</span>
          <select
            name="fonte"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
          >
            {FONTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id === "manrope" ? t("fontePadrao", { nome: f.nome }) : f.nome}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mb-4">
          <legend className="text-text mb-1 block text-sm font-medium">{t("tamanho")}</legend>
          <div className="flex flex-wrap gap-2">
            {TAMANHOS_DE_FONTE.map((n) => (
              <label
                key={n}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                  tamanho === n ? "border-primary text-primary font-semibold" : "border-border text-text"
                }`}
              >
                <input
                  type="radio"
                  name="tamanhoFonte"
                  value={n}
                  checked={tamanho === n}
                  onChange={() => setTamanho(n)}
                  className="sr-only"
                />
                {t(`tamanhos.t${n}`)}
              </label>
            ))}
          </div>
          <p className="text-muted mt-1 text-xs">{t("tamanhoAjuda")}</p>
        </fieldset>

        <p className="text-text mb-2 text-sm font-medium">{t("previa")}</p>
        <div
          aria-label={t("previaAria")}
          style={{ ...tema, zoom: tamanho / TAMANHO_PADRAO }}
          className="border-border mb-4 overflow-hidden rounded-lg border font-sans"
        >
          <div className="bg-backdrop text-backdrop-foreground px-4 py-3 text-sm font-semibold">
            {nome || inicial.nome}
          </div>
          <div className="bg-background space-y-2 p-4">
            <p className="text-accent text-xs font-semibold tracking-widest uppercase">{t("destaque")}</p>
            <p className="text-text text-sm">
              {t.rich("textoComum", {
                link: (c) => <span className="text-primary font-medium">{c}</span>,
              })}
            </p>
            <span className="flex flex-wrap gap-2">
              <span className="bg-cta text-cta-foreground inline-block rounded-md px-4 py-2 text-sm font-semibold">
                + {t("botaoPrincipal")}
              </span>
              <span className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium">
                {t("botaoComum")}
              </span>
            </span>
            <span
              className="mt-2 flex h-5 overflow-hidden rounded text-[10px] font-semibold"
              aria-hidden="true"
            >
              <span className="bg-surface text-text flex w-[60%] items-center px-2">60%</span>
              <span className="bg-primary text-primary-foreground flex w-[30%] items-center px-2">30%</span>
              <span className="bg-cta text-cta-foreground flex w-[10%] items-center justify-center">10</span>
            </span>
            <span className="text-muted block text-xs">{t("proporcao")}</span>
          </div>
        </div>
        {problemas.length > 0 && (
          <div role="alert" className="text-danger border-danger mb-4 rounded-md border px-3 py-2 text-sm">
            {problemas.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
        <Botao type="submit" disabled={salvando || problemas.length > 0}>
          {salvando ? t("salvando") : t("salvar")}
        </Botao>
      </form>
      <form action={restaurar} className="mt-3 text-center">
        <button type="submit" disabled={restaurando} className="text-primary text-sm font-medium">
          {t("restaurar")}
        </button>
      </form>
    </div>
  );
}

/** Envio, troca e remoção de uma imagem da marca (logo ou ícone). */
export function FormImagemDaMarca({
  tipo,
  titulo,
  explicacao,
  atual,
  nome,
  fundoEscuro = false,
}: {
  tipo: "logoClaro" | "logoEscuro" | "icone";
  titulo: string;
  explicacao: string;
  atual: string | null;
  nome: string;
  fundoEscuro?: boolean;
}) {
  const t = useTranslations("administracao.identidade.formulario");
  const [estado, enviar, enviando] = useAcaoComAtualizacao(enviarImagemAcao);
  const [estadoRemocao, remover, removendo] = useAcaoComAtualizacao(removerImagemAcao);
  const mensagem = estado ?? estadoRemocao;
  return (
    <div className="border-border border-t py-4 first:border-t-0 first:pt-0">
      <p className="text-text text-sm font-medium">{titulo}</p>
      <p className="text-muted mb-3 text-xs">{explicacao}</p>
      {mensagem?.erro && <Aviso>{mensagem.erro}</Aviso>}
      {mensagem?.ok && <Aviso tipo="ok">{mensagem.ok}</Aviso>}
      <div
        className={`${fundoEscuro ? "bg-backdrop" : "bg-surface"} border-border mb-3 flex h-24 items-center justify-center rounded-lg border p-3`}
      >
        {atual ? (
          <LogoDoTenant
            src={atual}
            nome={t("imagemDe", { titulo, nome })}
            className={tipo === "icone" ? "h-12" : "h-16"}
          />
        ) : (
          <span className={`${fundoEscuro ? "text-backdrop-foreground" : "text-muted"} text-xs`}>
            {t("nenhumaImagem")}
          </span>
        )}
      </div>
      <form action={enviar} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tipo" value={tipo} />
        <input
          type="file"
          name="imagem"
          required
          aria-label={t("arquivo", { titulo })}
          accept="image/png,image/jpeg,image/webp"
          className="text-muted file:border-border file:bg-background file:text-primary text-xs file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={enviando}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {enviando ? t("enviando") : t("enviar")}
        </button>
      </form>
      {atual && (
        <form action={remover} className="mt-2">
          <input type="hidden" name="tipo" value={tipo} />
          <button type="submit" disabled={removendo} className="text-danger text-xs font-medium">
            {t("remover")}
          </button>
        </form>
      )}
    </div>
  );
}
