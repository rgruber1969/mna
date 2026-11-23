/**
 * Funcionalidades simuladas (decisão menor "Funcionalidades simuladas",
 * 2026-11-17; escopo-v1.md, itens marcados "Simulado"):
 * - cada funcionalidade tem um modo: **real**, **simulada** (telas de
 *   demonstração, sempre com aviso visível) ou **desligada** (não aparece);
 * - o modo vem da variável `FUNCIONALIDADES` (ex.:
 *   `FUNCIONALIDADES=loginSocial:desligada,valuation:simulada`); sem ela,
 *   fora da produção tudo o que ainda não é real fica **simulado** e, em
 *   produção, **desligado**;
 * - a aplicação **recusa iniciar em produção** com alguma funcionalidade
 *   simulada (src/instrumentation.ts).
 */

export const FUNCIONALIDADES = {
  /** Item 3: entrar com Google e Microsoft. */
  loginSocial: { item: 3, real: false },
  /** Item 10: diagrama navegável das etapas. */
  diagramaDeEtapas: { item: 10, real: false },
  /** Item 13: templates DOCX com preenchimento de campos. */
  templatesDocx: { item: 13, real: false },
  /** Item 18: valuation. */
  valuation: { item: 18, real: false },
  /** Item 19: e-book e OnePager. */
  ebook: { item: 19, real: false },
  /** Item 21: limpeza da auditoria com exportação. */
  limpezaDeAuditoria: { item: 21, real: false },
  /** Item 22: exportação completa do negócio em PDF. */
  exportacaoDoNegocio: { item: 22, real: false },
  /** Itens 28 e 29: tarefas automáticas e gatilhos configuráveis. */
  gatilhosDeTarefas: { item: 28, real: false },
} as const;

export type Funcionalidade = keyof typeof FUNCIONALIDADES;
export type ModoDaFuncionalidade = "real" | "simulada" | "desligada";

const MODOS = new Set<ModoDaFuncionalidade>(["real", "simulada", "desligada"]);

/** Lê `FUNCIONALIDADES` ("id:modo,id:modo"); entradas inválidas são ignoradas. */
function lerConfiguracao(texto: string | undefined): Partial<Record<Funcionalidade, ModoDaFuncionalidade>> {
  const r: Partial<Record<Funcionalidade, ModoDaFuncionalidade>> = {};
  for (const parte of (texto ?? "").split(",")) {
    const [id, modo] = parte.split(":").map((x) => x.trim());
    if (id in FUNCIONALIDADES && MODOS.has(modo as ModoDaFuncionalidade))
      r[id as Funcionalidade] = modo as ModoDaFuncionalidade;
  }
  return r;
}

export function modoDa(
  id: Funcionalidade,
  ambiente: { FUNCIONALIDADES?: string; NODE_ENV?: string } = process.env,
): ModoDaFuncionalidade {
  const escolhido = lerConfiguracao(ambiente.FUNCIONALIDADES)[id];
  // "real" só vale para o que já foi construído de verdade.
  if (escolhido === "real" && !FUNCIONALIDADES[id].real) return "simulada";
  if (escolhido) return escolhido;
  if (FUNCIONALIDADES[id].real) return "real";
  return ambiente.NODE_ENV === "production" ? "desligada" : "simulada";
}

export const estaSimulada = (id: Funcionalidade) => modoDa(id) === "simulada";
export const estaLigada = (id: Funcionalidade) => modoDa(id) !== "desligada";

/** Recusa iniciar em produção com alguma funcionalidade simulada. */
export function conferirFuncionalidadesSimuladas(
  ambiente: { FUNCIONALIDADES?: string; NODE_ENV?: string } = process.env,
): void {
  if (ambiente.NODE_ENV !== "production") return;
  const simuladas = (Object.keys(FUNCIONALIDADES) as Funcionalidade[]).filter(
    (id) => modoDa(id, ambiente) === "simulada",
  );
  if (simuladas.length)
    throw new Error(
      `Funcionalidades simuladas em produção: ${simuladas.join(", ")}. Em produção elas só podem ser reais ou desligadas (FUNCIONALIDADES).`,
    );
}
