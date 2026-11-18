"use client";

import { useState, type CSSProperties } from "react";
import {
  enviarImagemAcao,
  removerImagemAcao,
  restaurarPadraoAcao,
  salvarIdentidadeAcao,
} from "@/app/acoes/identidade-visual";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Botao, Campo, LogoDoTenant } from "@/components/ui/basicos";
import { FONTES, TOKENS_PADRAO, corValida, problemasDeContraste, variaveisDoTema } from "@/config/marca";

type Inicial = {
  nome: string;
  nomeExibicao: string | null;
  corPrimaria: string | null;
  corDestaque: string | null;
  fonte: string | null;
};

function CampoDeCor({
  rotulo,
  nome,
  valor,
  mudar,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  mudar: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <span className="text-text mb-1 block text-sm font-medium">{rotulo}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${rotulo} (seletor)`}
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
    </div>
  );
}

/**
 * Nome de exibição, cores e fonte, com prévia ao vivo e aviso de contraste
 * antes de salvar (o servidor confere de novo; ADR-0010).
 */
export function FormIdentidade({ inicial }: { inicial: Inicial }) {
  const [estado, salvar, salvando] = useAcaoComAtualizacao(salvarIdentidadeAcao);
  const [estadoPadrao, restaurar, restaurando] = useAcaoComAtualizacao(restaurarPadraoAcao);
  const [nome, setNome] = useState(inicial.nomeExibicao ?? "");
  const [primaria, setPrimaria] = useState(inicial.corPrimaria ?? TOKENS_PADRAO.primaria);
  const [destaque, setDestaque] = useState(inicial.corDestaque ?? TOKENS_PADRAO.destaque);
  const [fonte, setFonte] = useState(inicial.fonte ?? "manrope");
  const problemas = problemasDeContraste({ primaria, destaque });
  const tema = variaveisDoTema({ primaria, destaque }, fonte) as CSSProperties;
  const mensagem = estado ?? estadoPadrao;

  return (
    <div>
      {mensagem?.erro && <Aviso>{mensagem.erro}</Aviso>}
      {mensagem?.ok && <Aviso tipo="ok">{mensagem.ok}</Aviso>}
      <form action={salvar}>
        <Campo
          rotulo="Nome de exibição"
          name="nomeExibicao"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={inicial.nome}
          maxLength={80}
        />
        <p className="text-muted -mt-3 mb-4 text-xs">
          Aparece nas telas e nos e-mails. Vazio: usa o nome do cadastro ({inicial.nome}).
        </p>
        <div className="flex flex-wrap gap-x-8">
          <CampoDeCor rotulo="Cor primária" nome="corPrimaria" valor={primaria} mudar={setPrimaria} />
          <CampoDeCor rotulo="Cor de destaque" nome="corDestaque" valor={destaque} mudar={setDestaque} />
        </div>
        <label className="mb-4 block">
          <span className="text-text mb-1 block text-sm font-medium">Fonte</span>
          <select
            name="fonte"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            className="border-border bg-background text-text w-full rounded-md border px-3 py-2 text-sm"
          >
            {FONTES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <p className="text-text mb-2 text-sm font-medium">Prévia</p>
        <div
          aria-label="Prévia da identidade visual"
          style={tema}
          className="border-border mb-4 overflow-hidden rounded-lg border font-sans"
        >
          <div className="bg-backdrop text-backdrop-foreground px-4 py-3 text-sm font-semibold">
            {nome || inicial.nome}
          </div>
          <div className="bg-background space-y-2 p-4">
            <p className="text-accent text-xs font-semibold tracking-widest uppercase">Destaque</p>
            <p className="text-text text-sm">
              Texto comum com um <span className="text-primary font-medium">link na cor primária</span>.
            </p>
            <span className="bg-primary text-primary-foreground inline-block rounded-md px-4 py-2 text-sm font-medium">
              Botão principal
            </span>
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
          {salvando ? "Salvando..." : "Salvar identidade visual"}
        </Botao>
      </form>
      <form action={restaurar} className="mt-3 text-center">
        <button type="submit" disabled={restaurando} className="text-primary text-sm font-medium">
          Restaurar cores e fonte padrão
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
            nome={`${titulo} de ${nome}`}
            className={tipo === "icone" ? "h-12" : "h-16"}
          />
        ) : (
          <span className={`${fundoEscuro ? "text-backdrop-foreground" : "text-muted"} text-xs`}>
            Nenhuma imagem (usa o padrão)
          </span>
        )}
      </div>
      <form action={enviar} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tipo" value={tipo} />
        <input
          type="file"
          name="imagem"
          required
          aria-label={`Arquivo: ${titulo}`}
          accept="image/png,image/jpeg,image/webp"
          className="text-muted file:border-border file:bg-background file:text-primary text-xs file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={enviando}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </form>
      {atual && (
        <form action={remover} className="mt-2">
          <input type="hidden" name="tipo" value={tipo} />
          <button type="submit" disabled={removendo} className="text-danger text-xs font-medium">
            Remover
          </button>
        </form>
      )}
    </div>
  );
}
