"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { IDIOMAS } from "@/i18n/idiomas";
import { definirMenuInvertidoAcao, definirTemaAcao } from "@/app/acoes/conta";
import { alternarFavoritoAcao, definirMenuRecolhidoAcao, ordenarFavoritosAcao } from "@/app/acoes/menu";
import {
  marcarTodasComoLidasAcao,
  minhasNotificacoesAcao,
  removerNotificacaoAcao,
} from "@/app/acoes/notificacoes";
import { minhasMensagensAcao } from "@/app/acoes/mensagens";
import { BarraDeNavegacao } from "@/components/ui/barra-de-navegacao";
import { PilulaDeslizante, useIndicadorDeslizante } from "@/components/ui/indicador";
import { Avatar, LogoDoTenant } from "@/components/ui/basicos";
import { FormSair } from "./formularios";
import { aplicarMenuInvertido, aplicarTema, resolverTema, type PreferenciaDeTema } from "./tema";

type Item = { id: string; href: string; icone: string; tambem?: string[] };
type Grupo = { chave: string; itens: Item[] };
type Notificacao = {
  id: string;
  tipo: string;
  parametros: Record<string, string>;
  link: string | null;
  lida: boolean;
  criadoEm: Date;
};

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
  maleta: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
  contrato: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h3" />
      <path d="M14 17.5l1.2 1.2 2.3-2.4" />
    </>
  ),
  // Barras com linha de tendência (valuation).
  grafico: <path d="M4 20h16M7 16v-4M11 16V9M15 16v-6M19 16V6M6 9l5-4 4 3 5-4" />,
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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
  mais: <path d="M12 5v14M5 12h14" />,
  // Relógio com seta de volta (auditoria: o que aconteceu).
  historico: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2" />,
  // Seta para a esquerda (recolher o menu); girada 180° para expandir.
  chevron: <path d="M15 6l-6 6 6 6" />,
  estrela: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  lupa: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  // Botão padrão de recolher/expandir o menu lateral (três linhas). A grade
  // de quadrados fica reservada para o lançador de módulos (backlog).
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  sino: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  mensagem: <path d="M4 5h16v11H9l-5 4z" />,
  chave: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" />
    </>
  ),
  seta: <path d="M6 9l6 6 6-6" />,
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  lua: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  globo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  conta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
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

/** Fecha um painel suspenso ao clicar fora dele ou apertar Esc. */
function useFecharFora(ref: RefObject<HTMLElement | null>, aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [ref, aberto, fechar]);
}

/** "Cadastros auxiliares" encontra "cadastros" mesmo com acento ou maiúscula. */
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const botaoRedondo =
  "bg-surface text-text hover:text-primary flex h-10 w-10 items-center justify-center rounded-full";
const painelSuspenso =
  "bg-background shadow-cartao border-border absolute right-0 z-40 mt-3 rounded-[10px] border";

// --- Paleta de comandos (Ctrl K) ------------------------------------------------------
//
// A busca do cabeçalho vira paleta (propostas de layout v3; ux-patterns, ⌘K): Ctrl K (ou ⌘K)
// abre de qualquer tela; grupos Ações / Páginas / Documentos; o 1º resultado já vem
// selecionado; ↑ ↓ escolhem, Enter vai, Esc fecha. Só mostra o que o menu da pessoa já
// mostra (as mesmas permissões).

const ACOES: { item: string; href: string; chave: string }[] = [
  { item: "negocios", href: "/negocios/novo", chave: "novoNegocio" },
  { item: "contratos", href: "/contratos/novo", chave: "novoContrato" },
  { item: "empresas", href: "/empresas/nova", chave: "novaEmpresa" },
  { item: "pessoas", href: "/pessoas/nova", chave: "novaPessoa" },
];

function BuscaNoMenu({ itens }: { itens: { item: Item; rotulo: string }[] }) {
  const t = useTranslations("cabecalho");
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  useFecharFora(caixa, aberto, () => setAberto(false));
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto(true);
        campo.current?.focus();
        campo.current?.select();
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);
  const q = normalizar(termo.trim());
  const ids = new Set(itens.map((i) => i.item.id));
  const acoes = ACOES.filter((a) => ids.has(a.item))
    .map((a) => ({ href: a.href, rotulo: t(`acoes.${a.chave}`), icone: "mais" as const }))
    .filter((a) => !q || normalizar(a.rotulo).includes(q));
  const paginas = itens
    .filter((i) => !q || normalizar(i.rotulo).includes(q))
    .slice(0, q ? 8 : 6)
    .map(({ item, rotulo }) => ({ href: item.href, rotulo, icone: item.icone }));
  const documentos =
    q.length >= 2
      ? [
          {
            href: `/busca?q=${encodeURIComponent(termo.trim())}`,
            rotulo: t("buscarDocumentos", { termo: termo.trim() }),
            icone: "lupa" as const,
          },
        ]
      : [];
  const grupos = [
    { chave: "acoes", lista: acoes },
    { chave: "paginas", lista: paginas },
    { chave: "documentos", lista: documentos },
  ].filter((g) => g.lista.length);
  const todos = grupos.flatMap((g) => g.lista);
  const atual = Math.min(selecionado, Math.max(todos.length - 1, 0));
  const ir = (href: string) => {
    router.push(href);
    setTermo("");
    setAberto(false);
    campo.current?.blur();
  };
  let indice = -1;
  return (
    <div ref={caixa} className="relative hidden sm:block">
      <label
        className={`${aberto ? "w-[28rem]" : "w-80"} group bg-background border-border focus-within:border-primary flex items-center gap-2 rounded-full border px-4 py-2 transition-[width] duration-150`}
      >
        <Icone nome="lupa" className="text-primary h-4 w-4" />
        <input
          ref={campo}
          type="search"
          aria-controls="paleta-de-comandos"
          aria-activedescendant={aberto && todos.length ? `paleta-${atual}` : undefined}
          value={termo}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setTermo(e.target.value);
            setSelecionado(0);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const passo = e.key === "ArrowDown" ? 1 : -1;
              setSelecionado((atual + passo + todos.length) % Math.max(todos.length, 1));
            } else if (e.key === "Enter" && todos[atual]) {
              e.preventDefault();
              ir(todos[atual].href);
            }
          }}
          aria-label={t("procurar")}
          placeholder={t("procurarDica")}
          className="text-text placeholder:text-muted w-full bg-transparent text-sm outline-none"
        />
        <kbd className="border-border text-muted hidden shrink-0 rounded border px-1.5 text-[10px] font-medium whitespace-nowrap opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 md:inline">
          {t("atalho")}
        </kbd>
      </label>
      {aberto && (
        <div
          id="paleta-de-comandos"
          role="listbox"
          aria-label={t("procurar")}
          className={`${painelSuspenso} left-0 w-[28rem] animate-[entrada-suave_150ms_ease-out] py-2`}
        >
          {todos.length === 0 ? (
            <p className="text-muted px-4 py-2 text-sm">{t("nadaEncontrado")}</p>
          ) : (
            grupos.map((g) => (
              <div key={g.chave} role="group" aria-label={t(`grupos.${g.chave}`)}>
                <p className="text-muted px-4 pt-2 pb-1 text-[10px] font-bold tracking-wider uppercase">
                  {t(`grupos.${g.chave}`)}
                </p>
                {g.lista.map((o) => {
                  indice++;
                  const meu = indice;
                  return (
                    <Link
                      key={o.href}
                      id={`paleta-${meu}`}
                      href={o.href}
                      role="option"
                      aria-selected={meu === atual}
                      onMouseEnter={() => setSelecionado(meu)}
                      onClick={() => {
                        setTermo("");
                        setAberto(false);
                      }}
                      className={`${meu === atual ? "bg-primary-soft text-primary font-semibold" : "text-text"} flex items-center gap-3 px-4 py-2 text-sm`}
                    >
                      <Icone
                        nome={o.icone}
                        className={`${meu === atual ? "text-primary" : "text-muted"} h-4 w-4`}
                      />
                      <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                      {meu === atual && <kbd className="text-muted text-[10px] font-medium">Enter</kbd>}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Mensagens ---------------------------------------------------------------------

/** Ícone de mensagens no topo (item 16): não lidas dos últimos 30 dias, sem travar a página. */
function IconeDeMensagens() {
  const t = useTranslations("mensagens");
  const [naoLidas, setNaoLidas] = useState(0);
  useEffect(() => {
    let ativo = true;
    const buscar = () =>
      minhasMensagensAcao(0)
        .then((r) => ativo && setNaoLidas(r.naoLidas))
        .catch(() => undefined);
    const primeira = setTimeout(buscar, 1500);
    const id = setInterval(buscar, 60_000);
    return () => {
      ativo = false;
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, []);
  return (
    <Link href="/mensagens" aria-label={t("icone", { n: naoLidas })} className={`${botaoRedondo} relative`}>
      <Icone nome="mensagem" />
      {naoLidas > 0 && (
        <span className="bg-danger text-primary-foreground ring-background absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold ring-2">
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </Link>
  );
}

// --- Notificações -----------------------------------------------------------------

function Sino({ inicial }: { inicial: { itens: Notificacao[]; naoLidas: number } }) {
  const t = useTranslations("notificacoes");
  const formato = useFormatter();
  const agora = useNow({ updateInterval: 60_000 });
  const [dados, setDados] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [, iniciar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);
  useFecharFora(caixa, aberto, () => setAberto(false));

  function abrir() {
    const novo = !aberto;
    setAberto(novo);
    if (novo) iniciar(async () => setDados(await minhasNotificacoesAcao()));
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-label={t("abrir", { quantidade: dados.naoLidas })}
        aria-expanded={aberto}
        className={`${botaoRedondo} relative`}
      >
        <Icone nome="sino" />
        {dados.naoLidas > 0 && (
          <span className="bg-danger ring-background absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full ring-2" />
        )}
      </button>
      {aberto && (
        <div className={`${painelSuspenso} w-80 overflow-hidden sm:w-96`}>
          <div className="bg-primary text-primary-foreground flex items-center justify-between px-4 py-3">
            <span className="font-semibold">{t("titulo")}</span>
            {dados.naoLidas > 0 && (
              <button
                type="button"
                onClick={() =>
                  iniciar(async () => {
                    await marcarTodasComoLidasAcao();
                    setDados(await minhasNotificacoesAcao());
                  })
                }
                className="text-sm font-medium opacity-90 hover:opacity-100"
              >
                {t("marcarTodas")}
              </button>
            )}
          </div>
          {dados.itens.length === 0 ? (
            <p className="text-muted px-4 py-6 text-center text-sm">{t("nenhuma")}</p>
          ) : (
            <ul className="divide-border max-h-96 divide-y overflow-y-auto">
              {dados.itens.slice(0, 6).map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${n.lida ? "" : "bg-primary-soft"}`}
                >
                  <span className="bg-surface text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <Icone nome="sino" className="h-4 w-4" />
                  </span>
                  <Link
                    href={n.link ?? "/notificacoes"}
                    onClick={() => setAberto(false)}
                    className="min-w-0 flex-1"
                  >
                    <span className="text-text block text-sm">{t(`tipos.${n.tipo}`, n.parametros)}</span>
                    <span className="text-muted text-xs">
                      {formato.relativeTime(new Date(n.criadoEm), agora)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={t("remover")}
                    onClick={() =>
                      iniciar(async () => {
                        await removerNotificacaoAcao(n.id);
                        setDados(await minhasNotificacoesAcao());
                      })
                    }
                    className="text-muted hover:text-text"
                  >
                    <Icone nome="fechar" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notificacoes"
            onClick={() => setAberto(false)}
            className="text-primary border-border block border-t py-3 text-center text-sm font-medium"
          >
            {t("verTodas")} ›
          </Link>
        </div>
      )}
    </div>
  );
}

// --- Usuário (menu suspenso com conta, tema e sair) ----------------------------------

/**
 * Menu do usuário (conta, tema, idioma, sair). Duas formas: no rodapé do menu
 * lateral, o cartão com foto, nome e papel, abrindo para cima (padrão das
 * skills de app desktop); na barra superior, só a foto (atalho, e o caminho
 * no celular, onde o menu lateral fica escondido).
 */
function MenuDoUsuario({
  usuario,
  temaInicial,
  menuInvertidoInicial,
  variante = "topo",
  compacto = false,
}: {
  usuario: { nome: string; foto?: string | null; papel: "administrador" | "usuario" };
  temaInicial: PreferenciaDeTema;
  menuInvertidoInicial: boolean;
  variante?: "topo" | "lateral";
  compacto?: boolean;
}) {
  const t = useTranslations("cabecalho");
  const localeAtual = useLocale();
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<PreferenciaDeTema>(temaInicial);
  const [, iniciar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);
  useFecharFora(caixa, aberto, () => setAberto(false));

  // A preferência da conta vale em qualquer computador: sincroniza o navegador com ela.
  useEffect(() => {
    if (variante === "topo") aplicarTema(temaInicial);
  }, [temaInicial, variante]);
  const [invertido, setInvertido] = useState(menuInvertidoInicial);
  useEffect(() => {
    if (variante === "topo") aplicarMenuInvertido(menuInvertidoInicial);
  }, [menuInvertidoInicial, variante]);
  // Os dois menus (topo e lateral) mostram a mesma escolha: acompanham o atributo da página.
  useEffect(() => {
    const ver = () => {
      const d = document.documentElement.dataset;
      if (d.preferenciaTema) setTema(d.preferenciaTema as PreferenciaDeTema);
      setInvertido(d.menuInvertido === "sim");
    };
    const obs = new MutationObserver(ver);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-preferencia-tema", "data-menu-invertido"],
    });
    return () => obs.disconnect();
  }, []);

  function escolher(p: PreferenciaDeTema) {
    setTema(p);
    aplicarTema(p);
    iniciar(() => definirTemaAcao(p));
  }

  return (
    <div ref={caixa} className="relative">
      {variante === "topo" ? (
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-label={t("menuDoUsuario")}
          aria-expanded={aberto}
          title={usuario.nome}
          className="hover:ring-primary/30 block rounded-full transition-shadow hover:ring-4"
        >
          <Avatar nome={usuario.nome} foto={usuario.foto} tamanho={36} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-label={t("contaEPreferencias")}
          aria-expanded={aberto}
          title={compacto ? usuario.nome : undefined}
          className={`hover:bg-surface flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors ${compacto ? "justify-center" : ""}`}
        >
          <Avatar nome={usuario.nome} foto={usuario.foto} tamanho={32} />
          {!compacto && (
            <>
              <span className="min-w-0 flex-1">
                <span className="text-text block truncate text-sm font-semibold">{usuario.nome}</span>
                <span className="text-muted block text-xs">{t(usuario.papel)}</span>
              </span>
              <Icone nome="seta" className="text-muted h-4 w-4 rotate-180" />
            </>
          )}
        </button>
      )}
      {aberto && (
        <div
          className={
            variante === "lateral"
              ? "bg-background shadow-cartao border-border absolute bottom-full left-0 z-50 mb-2 w-60 rounded-[10px] border py-2"
              : `${painelSuspenso} w-60 py-2`
          }
        >
          <Link
            href="/seguranca"
            onClick={() => setAberto(false)}
            className="text-text hover:bg-surface flex items-center gap-3 px-4 py-2 text-sm"
          >
            <Icone nome="conta" className="text-muted h-4 w-4" />
            {t("minhaConta")}
          </Link>
          <div className="border-border my-2 border-t" />
          <p className="text-muted px-4 pb-1 text-xs font-semibold tracking-widest uppercase">{t("tema")}</p>
          <div role="radiogroup" aria-label={t("tema")}>
            {(
              [
                ["claro", "sol"],
                ["escuro", "lua"],
                ["sistema", "monitor"],
              ] as const
            ).map(([p, icone]) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={tema === p}
                onClick={() => escolher(p)}
                className={`${tema === p ? "text-primary font-semibold" : "text-text"} hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-sm`}
              >
                <Icone nome={icone} className="h-4 w-4" />
                {t(`temas.${p}`)}
              </button>
            ))}
          </div>
          <label className="text-text hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-sm">
            <input
              type="checkbox"
              checked={invertido}
              onChange={(e) => {
                setInvertido(e.target.checked);
                aplicarMenuInvertido(e.target.checked);
                iniciar(() => definirMenuInvertidoAcao(e.target.checked));
              }}
            />
            {t("menuInvertido")}
          </label>
          <div className="border-border my-2 border-t" />
          <p className="text-muted px-4 pb-1 text-xs font-semibold tracking-widest uppercase">
            {t("idioma")}
          </p>
          <div role="radiogroup" aria-label={t("idioma")}>
            {IDIOMAS.map((idioma) => (
              <button
                key={idioma}
                type="button"
                role="radio"
                aria-checked={idioma === localeAtual}
                className={`${idioma === localeAtual ? "text-primary font-semibold" : "text-text"} hover:bg-surface flex w-full items-center gap-3 px-4 py-2 text-sm`}
              >
                <Icone nome="globo" className="h-4 w-4" />
                {t(`idiomas.${idioma}`)}
              </button>
            ))}
            <p className="text-muted px-4 pt-1 pb-2 text-xs">{t("idiomaEmBreve")}</p>
          </div>
          <div className="border-border my-2 border-t" />
          <Link
            href="/sobre"
            onClick={() => setAberto(false)}
            className="text-text hover:bg-surface flex items-center gap-3 px-4 py-2 text-sm"
          >
            <Icone nome="info" className="text-muted h-4 w-4" />
            {t("sobre")}
          </Link>
          <div className="px-4 py-1">
            <FormSair />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Estrutura --------------------------------------------------------------------

/**
 * Estrutura das telas do tenant (decisão menor "Layout das áreas logadas"):
 * menu lateral recolhível com grupos e favoritos; cabeçalho flutuante com
 * busca nas opções do menu, sino de notificações e menu do usuário (conta,
 * tema, sair); rodapé em cartão. No celular, o menu vira gaveta.
 */
export function CascaDoTenant({
  grupos,
  favoritosIniciais,
  recolhidoInicial,
  marca,
  usuario,
  tema,
  menuInvertido,
  notificacoes,
  rodape,
  children,
}: {
  grupos: Grupo[];
  favoritosIniciais: string[];
  recolhidoInicial: boolean;
  marca: { nome: string; logoClaro: string | null; logoEscuro: string | null; icone: string | null };
  usuario: { nome: string; foto?: string | null; papel: "administrador" | "usuario" };
  tema: PreferenciaDeTema;
  menuInvertido: boolean;
  notificacoes: { itens: Notificacao[]; naoLidas: number };
  rodape: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("menu");
  const caminho = usePathname();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [favoritos, setFavoritos] = useState(favoritosIniciais);
  const [aberto, setAberto] = useState(false);
  const [escuro, setEscuro] = useState(false);
  const [rolou, setRolou] = useState(false);
  // Digitando num campo, Alt + tecla numérica com o Num Lock desligado vira Alt+Home / Alt+← / Alt+→
  // (ex.: o código Alt+167 do §), e o navegador sairia da tela, perdendo o que foi digitado.
  useEffect(() => {
    const proteger = (e: KeyboardEvent) => {
      if (!e.altKey || !["Home", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true]"))
        e.preventDefault();
    };
    window.addEventListener("keydown", proteger, true);
    return () => window.removeEventListener("keydown", proteger, true);
  }, []);
  const [, iniciar] = useTransition();

  // Barra superior sem fundo no topo da página; ao rolar, ganha fundo translúcido e uma linha fina.
  useEffect(() => {
    const ver = () => setRolou(window.scrollY > 4);
    ver();
    window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);

  // Logo certo para o tema da tela (o atributo é ajustado por aplicarTema).
  useEffect(() => {
    // O logo segue o fundo do menu lateral (que pode estar invertido).
    const ver = () => {
      const html = document.documentElement.dataset;
      setEscuro((html.tema === "escuro") !== (html.menuInvertido === "sim"));
    };
    ver();
    const obs = new MutationObserver(ver);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema", "data-menu-invertido"],
    });
    return () => obs.disconnect();
  }, []);
  void resolverTema;

  const rotulo = (i: Item) => t(`itens.${i.id}`);
  const todos = grupos.flatMap((g) => g.itens);
  const favoritosVisiveis = favoritos
    .map((id) => todos.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));
  const compacto = recolhido && !aberto;
  const navegacao = useRef<HTMLElement>(null);
  const { estilo: pilula, pronto: pilulaPronta } = useIndicadorDeslizante(
    navegacao,
    `${caminho}|${compacto}|${favoritos.join()}`,
    '[aria-current="page"]',
    "pilula",
  );
  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));
  /** O item é o atual (o endereço dele ou um dos que ele reúne, como as abas de Usuários e acesso). */
  const itemAtivo = (item: Item) => [item.href, ...(item.tambem ?? [])].some(ativo);
  const logo = escuro ? (marca.logoEscuro ?? marca.logoClaro) : (marca.logoClaro ?? marca.logoEscuro);

  function alternarRecolhido() {
    if (window.matchMedia("(max-width: 767px)").matches) return setAberto(true);
    const novo = !recolhido;
    setRecolhido(novo);
    iniciar(() => definirMenuRecolhidoAcao(novo));
  }

  function alternarFavorito(id: string) {
    setFavoritos((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    iniciar(async () => setFavoritos(await alternarFavoritoAcao(id)));
  }

  // Ordem manual dos favoritos: arrastar (a lista se reorganiza enquanto arrasta) ou, pelo
  // teclado, os botões de subir e descer. Grava ao soltar.
  const [arrastandoFavorito, setArrastandoFavorito] = useState<string | null>(null);
  function moverFavorito(id: string, para: number) {
    setFavoritos((f) => {
      const sem = f.filter((x) => x !== id);
      sem.splice(Math.max(0, Math.min(para, sem.length)), 0, id);
      return sem;
    });
  }
  function gravarOrdem(lista: string[]) {
    iniciar(async () => setFavoritos(await ordenarFavoritosAcao(lista)));
  }

  const linha = (item: Item, emFavoritos = false) => {
    const favorito = favoritos.includes(item.id);
    const nome = rotulo(item);
    return (
      <li
        key={`${emFavoritos ? "f" : "g"}-${item.id}`}
        className={`group relative ${emFavoritos && arrastandoFavorito === item.id ? "opacity-50" : ""}`}
        draggable={emFavoritos && !compacto}
        onDragStart={
          emFavoritos
            ? (e) => {
                e.dataTransfer.effectAllowed = "move";
                setArrastandoFavorito(item.id);
              }
            : undefined
        }
        onDragOver={
          emFavoritos
            ? (e) => {
                if (!arrastandoFavorito || arrastandoFavorito === item.id) return;
                e.preventDefault();
                moverFavorito(arrastandoFavorito, favoritos.indexOf(item.id));
              }
            : undefined
        }
        onDragEnd={
          emFavoritos
            ? () => {
                setArrastandoFavorito(null);
                gravarOrdem(favoritos);
              }
            : undefined
        }
      >
        <Link
          href={item.href}
          onClick={() => setAberto(false)}
          title={compacto ? nome : undefined}
          aria-current={itemAtivo(item) ? "page" : undefined}
          className={`${itemAtivo(item) ? `${pilulaPronta ? "" : "bg-primary-soft"} text-primary font-semibold` : "text-text hover:bg-surface"} relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${compacto ? "justify-center" : "pr-9"}`}
        >
          <Icone nome={item.icone} />
          <span className={compacto ? "sr-only" : "truncate"}>{nome}</span>
        </Link>
        {!compacto && emFavoritos && (
          <span className="absolute top-1/2 right-1 flex -translate-y-1/2 flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            {(
              [
                ["subirFavorito", -1, "rotate-90"],
                ["descerFavorito", 1, "-rotate-90"],
              ] as const
            ).map(([chave, passo, giro]) => {
              const i = favoritos.indexOf(item.id);
              const fora = i + passo < 0 || i + passo >= favoritos.length;
              return (
                <button
                  key={chave}
                  type="button"
                  disabled={fora}
                  aria-label={t(chave, { item: nome })}
                  onClick={() => {
                    const nova = favoritos.filter((x) => x !== item.id);
                    nova.splice(i + passo, 0, item.id);
                    setFavoritos(nova);
                    gravarOrdem(nova);
                  }}
                  className="text-muted hover:text-primary grid h-3.5 w-5 place-items-center disabled:opacity-30"
                >
                  <Icone nome="chevron" className={`h-3 w-3 ${giro}`} />
                </button>
              );
            })}
          </span>
        )}
        {!compacto && !emFavoritos && (
          <button
            type="button"
            onClick={() => alternarFavorito(item.id)}
            aria-label={favorito ? t("desfavoritar", { item: nome }) : t("favoritar", { item: nome })}
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

  const tituloDeGrupo = (texto: string) =>
    compacto ? (
      <div className="border-border mx-3 mb-2 border-t" />
    ) : (
      <p className="text-muted flex items-center gap-2 px-3 pb-2 text-xs tracking-wider uppercase">
        <span aria-hidden className="bg-border h-px w-3" />
        {texto}
      </p>
    );

  return (
    <div className="flex min-h-screen flex-1">
      <Suspense fallback={null}>
        <BarraDeNavegacao />
      </Suspense>
      {aberto && (
        <button
          type="button"
          aria-label={t("fecharMenu")}
          onClick={() => setAberto(false)}
          className="bg-backdrop/40 fixed inset-0 z-30 md:hidden"
        />
      )}
      <aside
        data-menu-lateral
        className={`${aberto ? "translate-x-0" : "-translate-x-full"} ${compacto ? "md:w-[72px]" : "md:w-60"} ${aberto ? "shadow-cartao" : ""} bg-background text-text border-border fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-[transform,width] duration-200 md:translate-x-0 md:border-r md:shadow-none`}
      >
        {/* Recolher/expandir: botão redondo na borda do próprio menu, à altura do logo (padrão das skills). */}
        <button
          type="button"
          onClick={alternarRecolhido}
          aria-label={recolhido ? t("expandir") : t("recolher")}
          title={recolhido ? t("expandir") : t("recolher")}
          className="bg-background border-border text-muted hover:text-primary hover:border-primary absolute top-5 -right-3 z-10 hidden h-6 w-6 place-items-center rounded-full border shadow-sm transition-colors md:grid"
        >
          <Icone
            nome="chevron"
            className={`h-3.5 w-3.5 transition-transform duration-200 ${recolhido ? "rotate-180" : ""}`}
          />
        </button>
        <div className={`flex h-16 items-center px-5 ${compacto ? "justify-center px-2" : ""}`}>
          <Link href="/" className="text-primary min-w-0 truncate text-lg font-bold" title={marca.nome}>
            {compacto && marca.icone ? (
              <LogoDoTenant src={marca.icone} nome={marca.nome} className="h-9" />
            ) : logo ? (
              <LogoDoTenant src={logo} nome={marca.nome} className={compacto ? "h-7" : "h-9"} />
            ) : compacto ? (
              marca.nome.slice(0, 2).toUpperCase()
            ) : (
              marca.nome
            )}
          </Link>
        </div>
        <nav
          ref={navegacao}
          aria-label={t("rotulo")}
          className="relative isolate flex-1 overflow-y-auto px-3 pt-2 pb-6"
        >
          <PilulaDeslizante estilo={pilula} />
          {favoritosVisiveis.length > 0 && (
            <div className="mb-4">
              {tituloDeGrupo(t("grupos.favoritos"))}
              <ul className="space-y-0.5">{favoritosVisiveis.map((i) => linha(i, true))}</ul>
            </div>
          )}
          {grupos.map((g) => (
            <div key={g.chave} className="mb-4">
              {tituloDeGrupo(t(`grupos.${g.chave}`))}
              <ul className="space-y-0.5">{g.itens.map((i) => linha(i))}</ul>
            </div>
          ))}
        </nav>
        <div className="border-border border-t p-2">
          <MenuDoUsuario
            usuario={usuario}
            temaInicial={tema}
            menuInvertidoInicial={menuInvertido}
            variante="lateral"
            compacto={compacto}
          />
        </div>
      </aside>
      <div
        className={`${compacto ? "md:pl-[72px]" : "md:pl-60"} flex min-w-0 flex-1 flex-col transition-[padding] duration-200`}
      >
        <header
          className={`${rolou ? "bg-surface/85 border-border backdrop-blur-md" : "border-transparent"} sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-3 transition-colors duration-200 sm:px-6`}
        >
          {/* No celular, as três linhas abrem o menu (gaveta); no computador, o recolher fica na borda do menu. */}
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label={t("abrirMenu")}
            className={`${botaoRedondo} md:hidden`}
          >
            <Icone nome="menu" />
          </button>
          <BuscaNoMenu itens={todos.map((item) => ({ item, rotulo: rotulo(item) }))} />
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <IconeDeMensagens />
            <Sino inicial={notificacoes} />
            {/* Foto no topo, ao lado das notificações (pedido de 2026-11-26); o mesmo menu também fica no rodapé do menu lateral. */}
            <MenuDoUsuario usuario={usuario} temaInicial={tema} menuInvertidoInicial={menuInvertido} />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="text-muted mx-3 mt-4 mb-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs sm:mx-6">
          {rodape}
        </footer>
      </div>
    </div>
  );
}
