"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { IDIOMAS } from "@/i18n/idiomas";
import { definirTemaAcao } from "@/app/acoes/conta";
import { alternarFavoritoAcao, definirMenuRecolhidoAcao } from "@/app/acoes/menu";
import {
  marcarTodasComoLidasAcao,
  minhasNotificacoesAcao,
  removerNotificacaoAcao,
} from "@/app/acoes/notificacoes";
import { Avatar, LogoDoTenant } from "@/components/ui/basicos";
import { FormSair } from "./formularios";
import { aplicarTema, resolverTema, type PreferenciaDeTema } from "./tema";

type Item = { id: string; href: string; icone: string };
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
  grade: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  sino: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
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

// --- Busca do cabeçalho ------------------------------------------------------------

function BuscaNoMenu({ itens }: { itens: { item: Item; rotulo: string }[] }) {
  const t = useTranslations("cabecalho");
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useFecharFora(caixa, aberto, () => setAberto(false));
  const achados = termo.trim()
    ? itens.filter((i) => normalizar(i.rotulo).includes(normalizar(termo.trim())))
    : [];
  return (
    <div ref={caixa} className="relative hidden sm:block">
      <label className="bg-surface flex w-72 items-center gap-2 rounded-full px-4 py-2">
        <input
          type="search"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && achados[0]) {
              router.push(achados[0].item.href);
              setTermo("");
              setAberto(false);
            }
          }}
          aria-label={t("procurar")}
          placeholder={t("procurarDica")}
          className="text-text placeholder:text-muted w-full bg-transparent text-sm outline-none"
        />
        <Icone nome="lupa" className="text-primary h-4 w-4" />
      </label>
      {aberto && termo.trim() && (
        <ul className={`${painelSuspenso} left-0 w-72 py-2`}>
          {achados.length === 0 ? (
            <li className="text-muted px-4 py-2 text-sm">{t("procurar")}: —</li>
          ) : (
            achados.map(({ item, rotulo }) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => {
                    setTermo("");
                    setAberto(false);
                  }}
                  className="text-text hover:bg-surface flex items-center gap-3 px-4 py-2 text-sm"
                >
                  <Icone nome={item.icone} className="text-muted h-4 w-4" />
                  {rotulo}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
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

function MenuDoUsuario({
  usuario,
  temaInicial,
}: {
  usuario: { nome: string; foto?: string | null; papel: "administrador" | "usuario" };
  temaInicial: PreferenciaDeTema;
}) {
  const t = useTranslations("cabecalho");
  const localeAtual = useLocale();
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<PreferenciaDeTema>(temaInicial);
  const [, iniciar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);
  useFecharFora(caixa, aberto, () => setAberto(false));

  // A preferência da conta vale em qualquer computador: sincroniza o navegador com ela.
  useEffect(() => aplicarTema(temaInicial), [temaInicial]);

  function escolher(p: PreferenciaDeTema) {
    setTema(p);
    aplicarTema(p);
    iniciar(() => definirTemaAcao(p));
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-label={t("menuDoUsuario")}
        aria-expanded={aberto}
        className="flex items-center gap-3 text-left"
      >
        <Avatar nome={usuario.nome} foto={usuario.foto} tamanho={40} />
        <span className="hidden md:block">
          <span className="text-primary block text-xs">{t(usuario.papel)}</span>
          <span className="text-text flex items-center gap-1 text-sm font-semibold">
            {usuario.nome}
            <Icone nome="seta" className="h-4 w-4" />
          </span>
        </span>
      </button>
      {aberto && (
        <div className={`${painelSuspenso} w-60 py-2`}>
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
  const [, iniciar] = useTransition();

  // Logo certo para o tema da tela (o atributo é ajustado por aplicarTema).
  useEffect(() => {
    const ver = () => setEscuro(document.documentElement.dataset.tema === "escuro");
    ver();
    const obs = new MutationObserver(ver);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => obs.disconnect();
  }, []);
  void resolverTema;

  const rotulo = (i: Item) => t(`itens.${i.id}`);
  const todos = grupos.flatMap((g) => g.itens);
  const favoritosVisiveis = favoritos
    .map((id) => todos.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));
  const compacto = recolhido && !aberto;
  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));
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

  const linha = (item: Item, emFavoritos = false) => {
    const favorito = favoritos.includes(item.id);
    const nome = rotulo(item);
    return (
      <li key={`${emFavoritos ? "f" : "g"}-${item.id}`} className="group relative">
        <Link
          href={item.href}
          onClick={() => setAberto(false)}
          title={compacto ? nome : undefined}
          aria-current={ativo(item.href) ? "page" : undefined}
          className={`${ativo(item.href) ? "bg-primary-soft text-primary font-semibold" : "text-text hover:bg-surface"} flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${compacto ? "justify-center" : "pr-9"}`}
        >
          <Icone nome={item.icone} />
          <span className={compacto ? "sr-only" : "truncate"}>{nome}</span>
        </Link>
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
      {aberto && (
        <button
          type="button"
          aria-label={t("fecharMenu")}
          onClick={() => setAberto(false)}
          className="bg-backdrop/40 fixed inset-0 z-30 md:hidden"
        />
      )}
      <aside
        className={`${aberto ? "translate-x-0" : "-translate-x-full"} ${compacto ? "md:w-[72px]" : "md:w-60"} bg-background shadow-cartao fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-[transform,width] duration-200 md:translate-x-0`}
      >
        <div className={`flex h-[72px] items-center px-5 ${compacto ? "justify-center px-2" : ""}`}>
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
        <nav aria-label={t("rotulo")} className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
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
      </aside>
      <div
        className={`${compacto ? "md:pl-[72px]" : "md:pl-60"} flex min-w-0 flex-1 flex-col transition-[padding] duration-200`}
      >
        <header className="bg-background shadow-cartao sticky top-0 z-20 mx-3 flex h-[72px] items-center gap-3 rounded-b-[10px] px-4 sm:mx-6 sm:px-5">
          <button
            type="button"
            onClick={alternarRecolhido}
            aria-label={recolhido ? t("expandir") : t("recolher")}
            className={botaoRedondo}
          >
            <Icone nome="grade" />
          </button>
          <BuscaNoMenu itens={todos.map((item) => ({ item, rotulo: rotulo(item) }))} />
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <Sino inicial={notificacoes} />
            <MenuDoUsuario usuario={usuario} temaInicial={tema} />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="bg-background shadow-cartao text-muted mx-3 mt-6 flex flex-col items-center gap-2 rounded-t-[10px] px-4 py-5 text-sm sm:mx-6">
          {rodape}
        </footer>
      </div>
    </div>
  );
}
