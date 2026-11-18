"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { alternarFavoritoAcao, definirMenuRecolhidoAcao } from "@/app/acoes/menu";
import { LogoDoTenant } from "@/components/ui/basicos";

type Item = { id: string; rotulo: string; href: string; icone: string };
type Grupo = { titulo: string; itens: Item[] };

/** Ícones simples em traço (cor pelo texto atual, tokens semânticos). */
const ICONES: Record<string, ReactNode> = {
  casa: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  predio: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
    </>
  ),
  lista: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  escudo: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  paleta: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z" />
      <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
    </>
  ),
  estrela: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  lupa: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  recolher: <path d="M15 6l-6 6 6 6" />,
  expandir: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};

function Icone({ nome, className = "h-5 w-5" }: { nome: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${className} shrink-0`}
    >
      {ICONES[nome] ?? ICONES.lista}
    </svg>
  );
}

/** "Cadastros auxiliares" encontra "cadastros" mesmo com acento ou maiúscula. */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Estrutura das telas do tenant: menu lateral (grupos, busca nas opções,
 * favoritos e recolher/expandir; no celular, gaveta) e a barra superior.
 * Favoritos e recolhido são guardados no servidor, por usuário e tenant.
 */
export function CascaDoTenant({
  grupos,
  favoritosIniciais,
  recolhidoInicial,
  marca,
  barra,
  children,
}: {
  grupos: Grupo[];
  favoritosIniciais: string[];
  recolhidoInicial: boolean;
  marca: { nome: string; logo: string | null };
  barra: ReactNode;
  children: ReactNode;
}) {
  const caminho = usePathname();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [favoritos, setFavoritos] = useState(favoritosIniciais);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [, iniciar] = useTransition();

  const todos = grupos.flatMap((g) => g.itens);
  const termo = normalizar(busca.trim());
  const filtrar = (itens: Item[]) =>
    termo ? itens.filter((i) => normalizar(i.rotulo).includes(termo)) : itens;
  const favoritosVisiveis = filtrar(
    favoritos.map((id) => todos.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)),
  );
  // Recolhido só no computador; no celular a gaveta mostra tudo.
  const compacto = recolhido && !aberto;

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

  function alternarRecolhido() {
    const novo = !recolhido;
    setRecolhido(novo);
    iniciar(() => definirMenuRecolhidoAcao(novo));
  }

  function alternarFavorito(id: string) {
    setFavoritos((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    iniciar(async () => setFavoritos(await alternarFavoritoAcao(id)));
  }

  const linha = (item: Item, emFavoritos = false) => {
    const favorito = favoritos.includes(item.id);
    return (
      <li key={`${emFavoritos ? "f" : "g"}-${item.id}`} className="group relative">
        <Link
          href={item.href}
          onClick={() => setAberto(false)}
          title={compacto ? item.rotulo : undefined}
          aria-current={ativo(item.href) ? "page" : undefined}
          className={`${ativo(item.href) ? "bg-primary text-primary-foreground" : "text-text hover:bg-surface"} flex items-center gap-3 rounded-md px-3 py-2 text-sm ${compacto ? "justify-center" : "pr-9"}`}
        >
          <Icone nome={item.icone} />
          <span className={compacto ? "sr-only" : "truncate"}>{item.rotulo}</span>
        </Link>
        {!compacto && !emFavoritos && (
          <button
            type="button"
            onClick={() => alternarFavorito(item.id)}
            aria-label={favorito ? `Tirar ${item.rotulo} dos favoritos` : `Favoritar ${item.rotulo}`}
            aria-pressed={favorito}
            className={`${favorito ? "text-accent opacity-100" : "text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"} absolute top-1/2 right-2 -translate-y-1/2`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4 w-4"
              fill={favorito ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              {ICONES.estrela}
            </svg>
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1">
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="bg-backdrop/40 fixed inset-0 z-30 md:hidden"
        />
      )}
      <aside
        className={`${aberto ? "translate-x-0" : "-translate-x-full"} ${compacto ? "md:w-16" : "md:w-64"} border-border bg-background fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-[transform,width] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0`}
      >
        <div
          className={`flex items-center gap-2 px-3 py-4 ${compacto ? "justify-center" : "justify-between"}`}
        >
          {!compacto && (
            <Link href="/" className="text-primary min-w-0 truncate font-semibold" title={marca.nome}>
              {marca.logo ? <LogoDoTenant src={marca.logo} nome={marca.nome} /> : marca.nome}
            </Link>
          )}
          <button
            type="button"
            onClick={alternarRecolhido}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            className="text-muted hover:text-text hidden rounded-md p-1 md:block"
          >
            <Icone nome={recolhido ? "expandir" : "recolher"} />
          </button>
        </div>
        {!compacto && (
          <div className="px-3 pb-3">
            <label className="border-border flex items-center gap-2 rounded-md border px-2 py-1.5">
              <Icone nome="lupa" className="text-muted h-4 w-4" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Procurar no menu"
                placeholder="Procurar no menu"
                className="text-text w-full bg-transparent text-sm outline-none"
              />
            </label>
          </div>
        )}
        <nav aria-label="Menu" className="flex-1 overflow-y-auto px-2 pb-4">
          {favoritosVisiveis.length > 0 && (
            <div className="mb-3">
              {!compacto && (
                <p className="text-muted px-3 py-1 text-xs font-semibold tracking-widest uppercase">
                  Favoritos
                </p>
              )}
              <ul>{favoritosVisiveis.map((i) => linha(i, true))}</ul>
            </div>
          )}
          {grupos.map((g) => {
            const itens = filtrar(g.itens);
            if (itens.length === 0) return null;
            return (
              <div key={g.titulo} className="mb-3">
                {compacto ? (
                  <div className="border-border mx-3 mb-1 border-t" />
                ) : (
                  <p className="text-muted px-3 py-1 text-xs font-semibold tracking-widest uppercase">
                    {g.titulo}
                  </p>
                )}
                <ul>{itens.map((i) => linha(i))}</ul>
              </div>
            );
          })}
          {termo && favoritosVisiveis.length === 0 && grupos.every((g) => filtrar(g.itens).length === 0) && (
            <p className="text-muted px-3 text-sm">Nada encontrado.</p>
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="text-text rounded-md p-1 md:hidden"
          >
            <Icone nome="menu" />
          </button>
          <div className="ml-auto">{barra}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
