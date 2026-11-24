"use client";

import { BotaoDeIcone } from "@/components/ui/icone-de-acao";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Prévia de anexos (PDF e imagens) desenhada pela própria página: o arquivo
 * vem do servidor como download comum (com permissão e auditoria) e é
 * desenhado aqui, sem o navegador abrir o arquivo diretamente (ADR-0016).
 * DOCX e XLSX não têm prévia.
 */

const MAXIMO_DE_PAGINAS = 30;

export const temPrevia = (tipo: string) => tipo === "application/pdf" || tipo.startsWith("image/");

async function buscar(id: string, modo: "visualizar" | "miniatura", endereco?: string): Promise<ArrayBuffer> {
  const r = await fetch(endereco ?? `/api/anexos/${id}?modo=${modo}`, { cache: "no-store" });
  if (!r.ok) throw new Error("indisponível");
  return r.arrayBuffer();
}

/** Desenha páginas de um PDF em canvases (pdf.js embutido no unpdf, carregado só quando preciso). */
async function desenharPdf(
  dados: ArrayBuffer,
  destino: HTMLElement,
  largura: number,
  paginas: number,
): Promise<number> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(dados));
  const total = Math.min(pdf.numPages, paginas);
  destino.replaceChildren();
  for (let n = 1; n <= total; n++) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const escala = (largura / base.width) * (window.devicePixelRatio || 1);
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${largura}px`;
    canvas.className = "shadow-cartao mx-auto mb-3 block";
    destino.appendChild(canvas);
    await pagina.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
  }
  return pdf.numPages;
}

/** Miniatura da 1ª página (PDF) ou da imagem, carregada quando aparece na tela. */
export function Miniatura({ id, tipo, rotulo }: { id: string; tipo: string; rotulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [imagem, setImagem] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el || !temPrevia(tipo)) return;
    let url: string | null = null;
    let cancelado = false;
    const observador = new IntersectionObserver(async ([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      try {
        const dados = await buscar(id, "miniatura");
        if (cancelado) return;
        if (tipo.startsWith("image/")) {
          url = URL.createObjectURL(new Blob([dados], { type: tipo }));
          setImagem(url);
        } else {
          const alvo = el.querySelector<HTMLElement>("[data-paginas]");
          if (alvo) await desenharPdf(dados, alvo, 44, 1);
        }
      } catch {
        if (!cancelado) setFalhou(true);
      }
    });
    observador.observe(el);
    return () => {
      cancelado = true;
      observador.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, tipo]);

  return (
    <div
      ref={caixa}
      aria-hidden
      className="border-border bg-surface flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded border"
    >
      {imagem ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem local (blob) do anexo
        <img src={imagem} alt="" className="h-full w-full object-cover" />
      ) : temPrevia(tipo) && !falhou ? (
        <div data-paginas className="[&_canvas]:m-0 [&_canvas]:shadow-none" />
      ) : (
        <span className="text-muted text-[10px] font-semibold uppercase">{rotulo}</span>
      )}
    </div>
  );
}

/** Botão "Visualizar" e a janela sobre a tela com o documento (zoom; Esc fecha). */
export function Visualizar({
  id,
  tipo,
  nome,
  endereco,
}: {
  id: string;
  tipo: string;
  nome: string;
  /** Endereço do conteúdo (padrão: anexos do cadastro). */
  endereco?: string;
}) {
  const t = useTranslations("cadastros.anexos");
  const janela = useRef<HTMLDialogElement>(null);
  const paginas = useRef<HTMLDivElement>(null);
  const [dados, setDados] = useState<ArrayBuffer | null>(null);
  const [imagem, setImagem] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [total, setTotal] = useState(0);

  async function abrir() {
    janela.current?.showModal();
    if (dados) return;
    setEstado("carregando");
    try {
      const d = await buscar(id, "visualizar", endereco);
      setDados(d);
      if (tipo.startsWith("image/")) {
        setImagem(URL.createObjectURL(new Blob([d], { type: tipo })));
        setEstado("pronto");
      }
    } catch {
      setEstado("erro");
    }
  }

  // Desenha (de novo) as páginas do PDF quando chegam os dados ou muda o zoom.
  useEffect(() => {
    if (!dados || tipo.startsWith("image/")) return;
    if (!paginas.current) return;
    const largura = Math.min(780, window.innerWidth - 64) * zoom;
    desenharPdf(dados, paginas.current, largura, MAXIMO_DE_PAGINAS)
      .then((n) => {
        setTotal(n);
        setEstado("pronto");
      })
      .catch(() => setEstado("erro"));
  }, [dados, zoom, tipo]);

  useEffect(() => () => void (imagem && URL.revokeObjectURL(imagem)), [imagem]);

  const botao = "border-border text-text rounded-md border px-2 py-1 text-xs font-medium";
  return (
    <>
      <BotaoDeIcone tipo="visualizar" rotulo={t("visualizar")} onClick={abrir} />
      <dialog
        ref={janela}
        aria-label={t("visualizando", { nome })}
        onClick={(e) => e.target === janela.current && janela.current?.close()}
        className="bg-background text-text backdrop:bg-backdrop/70 m-auto h-[90vh] w-[min(860px,95vw)] max-w-none rounded-[10px] p-0"
      >
        <div className="flex h-full flex-col">
          <div className="border-border flex items-center gap-2 border-b px-4 py-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{nome}</p>
            <button type="button" className={botao} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              −
            </button>
            <span className="text-muted w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
            <button type="button" className={botao} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              +
            </button>
            {/* Baixar daqui só para anexos de cadastro; documentos e materiais baixam pelo ícone da linha (link auditado do data room). */}
            {!endereco && (
              <a href={`/api/anexos/${id}`} className={botao}>
                {t("baixar")}
              </a>
            )}
            <button type="button" className={botao} onClick={() => janela.current?.close()}>
              {t("fechar")}
            </button>
          </div>
          <div className="bg-surface flex-1 overflow-auto p-4">
            {estado === "carregando" && <p className="text-muted text-sm">{t("carregando")}</p>}
            {estado === "erro" && <p className="text-danger text-sm">{t("previaIndisponivel")}</p>}
            {imagem && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem local (blob) do anexo
              <img
                src={imagem}
                alt={nome}
                style={{ width: `${zoom * 100}%` }}
                className="mx-auto block max-w-none"
              />
            )}
            <div ref={paginas} />
            {total > MAXIMO_DE_PAGINAS && (
              <p className="text-muted text-center text-xs">
                {t("maisPaginas", { total, mostradas: MAXIMO_DE_PAGINAS })}
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
