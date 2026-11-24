import Link from "next/link";
import { SeletorPorPagina } from "./paginacao-local";
import { getTranslations } from "next-intl/server";
import {
  enderecoDaLista,
  TAMANHOS_DE_PAGINA,
  type Direcao,
  type Pagina,
  type PedidoDePagina,
} from "@/config/paginacao";

/**
 * Peças comuns das listas paginadas (decisão menor "Listas"): título de
 * coluna que ordena e rodapé com total, páginas e tamanho. Só links: tudo
 * fica no endereço (voltar à lista mantém página, busca e ordem).
 */

type Parametros = Record<string, string | string[] | undefined>;

/** Título de coluna que ordena por um campo (clicar de novo inverte a direção). */
export async function TituloOrdenavel({
  rotulo,
  campo,
  pedido,
  caminho,
  parametros,
  className = "",
}: {
  rotulo: string;
  campo: string;
  pedido: PedidoDePagina;
  caminho: string;
  parametros: Parametros;
  className?: string;
}) {
  const t = await getTranslations("comum.lista");
  const ativo = pedido.ordem === campo;
  const proxima: Direcao = ativo && pedido.direcao === "asc" ? "desc" : "asc";
  const href = enderecoDaLista(caminho, parametros, { ordem: campo, direcao: proxima, pagina: null });
  return (
    <th
      className={className}
      aria-sort={ativo ? (pedido.direcao === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={href}
        className="inline-flex items-center gap-1"
        title={t("ordenarPor", { coluna: rotulo })}
      >
        {rotulo}
        <span aria-hidden className={ativo ? "" : "opacity-30"}>
          {ativo && pedido.direcao === "desc" ? "▼" : "▲"}
        </span>
      </Link>
    </th>
  );
}

/** Rodapé: "1–25 de 340", páginas e quantidade por página. */
export async function Paginacao({
  pagina,
  caminho,
  parametros,
}: {
  pagina: Pagina<unknown>;
  caminho: string;
  parametros: Parametros;
}) {
  const t = await getTranslations("comum.lista");
  const { total, porPagina } = pagina;
  const atual = pagina.pagina;
  const ultima = Math.max(1, Math.ceil(total / porPagina));
  const de = total === 0 ? 0 : (atual - 1) * porPagina + 1;
  const ate = Math.min(total, atual * porPagina);
  // Páginas próximas da atual, com a primeira e a última sempre visíveis.
  const numeros = [...new Set([1, atual - 1, atual, atual + 1, ultima])]
    .filter((n) => n >= 1 && n <= ultima)
    .sort((a, b) => a - b);
  const link = (n: number) => enderecoDaLista(caminho, parametros, { pagina: n === 1 ? null : n });
  const botao = "border-border rounded-md border px-2.5 py-1 text-xs font-medium";

  return (
    <nav
      aria-label={t("paginacao")}
      className="border-border mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"
    >
      <span className="text-muted">{t("intervalo", { de, ate, total })}</span>
      {ultima > 1 && (
        <span className="flex items-center gap-1">
          {atual > 1 ? (
            <Link href={link(atual - 1)} className={`${botao} text-primary`} aria-label={t("anterior")}>
              ‹
            </Link>
          ) : (
            <span className={`${botao} text-muted opacity-50`}>‹</span>
          )}
          {numeros.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - numeros[i - 1] > 1 && <span className="text-muted">…</span>}
              {n === atual ? (
                <span
                  aria-current="page"
                  className={`${botao} bg-primary text-primary-foreground border-primary`}
                >
                  {n}
                </span>
              ) : (
                <Link href={link(n)} className={`${botao} text-primary`} aria-label={t("pagina", { n })}>
                  {n}
                </Link>
              )}
            </span>
          ))}
          {atual < ultima ? (
            <Link href={link(atual + 1)} className={`${botao} text-primary`} aria-label={t("proxima")}>
              ›
            </Link>
          ) : (
            <span className={`${botao} text-muted opacity-50`}>›</span>
          )}
        </span>
      )}
      <SeletorPorPagina
        valor={porPagina}
        enderecos={Object.fromEntries(
          TAMANHOS_DE_PAGINA.map((n) => [
            n,
            enderecoDaLista(caminho, parametros, { porPagina: n, pagina: null }),
          ]),
        )}
      />
    </nav>
  );
}
