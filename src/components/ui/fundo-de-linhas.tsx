"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo decorativo das telas de entrada do tenant: feixe de linhas finas que
 * ondulam devagar, com um brilho suave no vértice (inspirado no site da
 * RGRUBER). As cores vêm dos tokens (`--accent`, `--backdrop-foreground`),
 * nunca fixas. Com "reduzir movimento" ligado no sistema, fica parado.
 */
export function FundoDeLinhas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const estilo = getComputedStyle(document.documentElement);
    const corLinha = estilo.getPropertyValue("--accent").trim() || "currentColor";
    const corBrilho = estilo.getPropertyValue("--backdrop-foreground").trim() || "currentColor";
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const LINHAS = 46;
    let quadro = 0;

    function ajustar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function desenhar(t: number) {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      ctx!.clearRect(0, 0, w, h);

      // Vértice do feixe à esquerda, para o feixe aparecer ao lado do cartão.
      const vx = w * 0.2 + Math.sin(t * 0.00015) * w * 0.01;
      const vy = h * 0.55;

      const brilho = ctx!.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * 0.22);
      brilho.addColorStop(0, corBrilho);
      brilho.addColorStop(1, "transparent");
      ctx!.globalAlpha = 0.12;
      ctx!.fillStyle = brilho;
      ctx!.fillRect(0, 0, w, h);

      ctx!.strokeStyle = corLinha;
      ctx!.lineWidth = 0.7;
      for (let i = 0; i < LINHAS; i++) {
        const k = i / (LINHAS - 1);
        const fase = t * 0.0004 + k * 2.4;
        const abre = (k - 0.5) * h * 0.18;
        ctx!.globalAlpha = 0.14 + 0.36 * Math.sin(Math.PI * k);
        ctx!.beginPath();
        // Entra pelo alto, à direita; curva no vértice; sai por baixo, à direita.
        ctx!.moveTo(w * (0.78 + k * 0.3), -h * 0.05);
        ctx!.bezierCurveTo(
          w * (0.5 + 0.04 * Math.sin(fase)),
          h * 0.2 + abre,
          vx - w * 0.05 + abre * 0.2,
          vy - h * 0.08 + 8 * Math.sin(fase * 1.3),
          vx + abre * 0.15,
          vy,
        );
        ctx!.bezierCurveTo(
          vx + w * 0.02,
          vy + h * 0.1 + 8 * Math.cos(fase),
          w * (0.55 + 0.05 * Math.cos(fase)),
          h * 0.85 + abre,
          w * (0.9 + k * 0.25),
          h * 1.05,
        );
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    function animar(t: number) {
      desenhar(t);
      quadro = requestAnimationFrame(animar);
    }

    ajustar();
    if (parado) desenhar(0);
    else quadro = requestAnimationFrame(animar);
    const aoRedimensionar = () => {
      ajustar();
      if (parado) desenhar(0);
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
