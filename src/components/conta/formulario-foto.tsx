"use client";

import { useTranslations } from "next-intl";
import { startTransition, useRef, useState, type PointerEvent } from "react";
import { enviarFotoAcao, removerFotoAcao } from "@/app/acoes/conta";
import { useAcaoComAtualizacao } from "@/components/usuarios/formularios";
import { Aviso, Avatar, Botao } from "@/components/ui/basicos";

/** Lado da área de recorte na tela e da imagem enviada (o servidor reduz a 256 px). */
const JANELA = 220;
const SAIDA = 512;
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

type Imagem = { url: string; largura: number; altura: number; elemento: HTMLImageElement };

/**
 * Envio e remoção da foto da própria conta: escolher a imagem, ver a prévia
 * no formato redondo, aproximar (zoom) e arrastar para enquadrar, e só então
 * salvar. O recorte é feito no navegador; o servidor ainda confere e gera a
 * imagem final (foto-da-conta.ts).
 */
export function FormFoto({ nome, foto }: { nome: string; foto?: string | null }) {
  const t = useTranslations("administracao.foto");
  const [estado, enviar, enviando] = useAcaoComAtualizacao(enviarFotoAcao);
  const [estadoRemocao, remover, removendo] = useAcaoComAtualizacao(removerFotoAcao);
  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [zoom, setZoom] = useState(1);
  const [desloc, setDesloc] = useState({ x: 0, y: 0 });
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const arrasto = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const mensagem = erroLocal ? { erro: erroLocal } : (estado ?? estadoRemocao);

  // Escala que cobre a janela inteira, vezes o zoom escolhido.
  const escala = imagem ? Math.max(JANELA / imagem.largura, JANELA / imagem.altura) * zoom : 1;

  /** Mantém a imagem cobrindo toda a janela (sem bordas vazias). */
  function limitar(x: number, y: number) {
    if (!imagem) return { x: 0, y: 0 };
    const folgaX = Math.max(0, (imagem.largura * escala - JANELA) / 2);
    const folgaY = Math.max(0, (imagem.altura * escala - JANELA) / 2);
    return { x: Math.min(folgaX, Math.max(-folgaX, x)), y: Math.min(folgaY, Math.max(-folgaY, y)) };
  }

  function escolher(arquivo: File | undefined) {
    setErroLocal(null);
    if (!arquivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type))
      return setErroLocal(t("formatoInvalido"));
    if (arquivo.size > TAMANHO_MAXIMO) return setErroLocal(t("imagemGrande"));
    const url = URL.createObjectURL(arquivo);
    const elemento = new Image();
    elemento.onload = () => {
      setImagem({ url, largura: elemento.naturalWidth, altura: elemento.naturalHeight, elemento });
      setZoom(1);
      setDesloc({ x: 0, y: 0 });
    };
    elemento.onerror = () => setErroLocal(t("naoAbriu"));
    elemento.src = url;
  }

  function cancelar() {
    if (imagem) URL.revokeObjectURL(imagem.url);
    setImagem(null);
    if (entrada.current) entrada.current.value = "";
  }

  function salvar() {
    if (!imagem) return;
    const canvas = document.createElement("canvas");
    canvas.width = SAIDA;
    canvas.height = SAIDA;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Canto superior esquerdo da imagem dentro da janela.
    const esquerda = (JANELA - imagem.largura * escala) / 2 + desloc.x;
    const topo = (JANELA - imagem.altura * escala) / 2 + desloc.y;
    const lado = JANELA / escala;
    ctx.drawImage(imagem.elemento, -esquerda / escala, -topo / escala, lado, lado, 0, 0, SAIDA, SAIDA);
    canvas.toBlob((blob) => {
      if (!blob) return setErroLocal(t("naoPreparou"));
      const dados = new FormData();
      dados.set("foto", new File([blob], "foto.png", { type: "image/png" }));
      startTransition(() => enviar(dados));
      cancelar();
    }, "image/png");
  }

  function aoPressionar(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, dx: desloc.x, dy: desloc.y };
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (a) setDesloc(limitar(a.dx + e.clientX - a.x, a.dy + e.clientY - a.y));
  }

  return (
    <div>
      {mensagem?.erro && <Aviso>{mensagem.erro}</Aviso>}
      {mensagem?.ok && !imagem && <Aviso tipo="ok">{mensagem.ok}</Aviso>}

      {!imagem ? (
        <>
          <div className="mb-4 flex items-center gap-4">
            <Avatar nome={nome} foto={foto} tamanho={72} />
            <p className="text-muted text-xs">{t("explicacao")}</p>
          </div>
          <input
            ref={entrada}
            id="escolher-foto"
            type="file"
            name="foto"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          <label
            htmlFor="escolher-foto"
            className="border-primary text-primary hover:bg-surface flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm font-medium"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 8h3l2-2h6l2 2h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {t("escolher")}
          </label>
          <p className="text-muted mt-1 text-center text-xs">{t("formatos")}</p>
          {foto && (
            <form action={remover} className="mt-4 text-center">
              <button disabled={removendo} className="text-danger text-sm font-medium disabled:opacity-60">
                {removendo ? t("removendo") : t("removerAtual")}
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <p className="text-text mb-2 text-sm font-medium">{t("previa")}</p>
          <div
            role="img"
            aria-label={t("previaAria")}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={() => (arrasto.current = null)}
            className="border-border relative mx-auto mb-3 cursor-grab touch-none overflow-hidden rounded-full border active:cursor-grabbing"
            style={{ width: JANELA, height: JANELA }}
          >
            {/* Prévia local (objeto do navegador): next/image não se aplica. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagem.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: imagem.largura * escala,
                height: imagem.altura * escala,
                left: (JANELA - imagem.largura * escala) / 2 + desloc.x,
                top: (JANELA - imagem.altura * escala) / 2 + desloc.y,
              }}
            />
          </div>
          <label className="mb-4 flex items-center gap-3 text-sm">
            <span className="text-muted">{t("zoom")}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              aria-label={t("zoom")}
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setDesloc((d) => limitar(d.x, d.y));
              }}
              className="flex-1"
            />
          </label>
          <Botao type="button" onClick={salvar} disabled={enviando}>
            {enviando ? t("enviando") : t("salvar")}
          </Botao>
          <button type="button" onClick={cancelar} className="text-muted mt-3 w-full text-sm font-medium">
            {t("cancelar")}
          </button>
        </>
      )}
    </div>
  );
}
