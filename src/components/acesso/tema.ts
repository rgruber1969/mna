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
  if (ouvinte) midiaEscura().removeEventListener("change", ouvinte);
  ouvinte = null;
  if (p === "sistema") {
    ouvinte = () => (document.documentElement.dataset.tema = resolverTema("sistema"));
    midiaEscura().addEventListener("change", ouvinte);
  }
}

/** Script curto, executado antes de pintar a página, que aplica o tema guardado no navegador. */
export const SCRIPT_DO_TEMA = `try{var t=localStorage.getItem("tema")||"claro";if(t==="sistema")t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";document.documentElement.dataset.tema=t}catch(e){}`;
