/**
 * Tema da interface (claro, escuro ou igual ao sistema). A preferência fica na
 * conta (servidor) e é copiada no navegador para pintar a primeira tela já no
 * tema certo (script em src/app/layout.tsx). O atributo `data-tema` do <html>
 * recebe sempre o tema resolvido: "claro" ou "escuro".
 */
export type PreferenciaDeTema = "claro" | "escuro" | "sistema";

const midiaEscura = () => window.matchMedia("(prefers-color-scheme: dark)");

export function resolverTema(p: PreferenciaDeTema): "claro" | "escuro" {
  return p === "sistema" ? (midiaEscura().matches ? "escuro" : "claro") : p;
}

let ouvinte: (() => void) | null = null;

export function aplicarTema(p: PreferenciaDeTema) {
  try {
    localStorage.setItem("tema", p);
  } catch {}
  document.documentElement.dataset.tema = resolverTema(p);
  // A preferência (claro, escuro ou sistema), para os dois menus do usuário mostrarem a mesma escolha.
  document.documentElement.dataset.preferenciaTema = p;
  if (ouvinte) midiaEscura().removeEventListener("change", ouvinte);
  ouvinte = null;
  if (p === "sistema") {
    ouvinte = () => (document.documentElement.dataset.tema = resolverTema("sistema"));
    midiaEscura().addEventListener("change", ouvinte);
  }
}

/** Menu lateral no tema oposto ao da tela (ex.: tela clara com menu escuro). */
export function aplicarMenuInvertido(ligado: boolean) {
  try {
    localStorage.setItem("menuInvertido", ligado ? "sim" : "nao");
  } catch {}
  document.documentElement.dataset.menuInvertido = ligado ? "sim" : "nao";
}

/** Script curto, executado antes de pintar a página, que aplica o tema guardado no navegador. */
export const SCRIPT_DO_TEMA = `try{var t=localStorage.getItem("tema")||"claro";if(t==="sistema")t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";document.documentElement.dataset.tema=t;document.documentElement.dataset.menuInvertido=localStorage.getItem("menuInvertido")||"nao"}catch(e){}`;
