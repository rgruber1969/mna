/**
 * Endereços da aplicação (ADR-0011): o host identifica a área; a sessão
 * autoriza. Módulo puro (sem banco), usado pelo proxy e pelos serviços.
 */

export type Area =
  { tipo: "console" } | { tipo: "tenant"; slug: string } | { tipo: "raiz" } | { tipo: "invalido" };

/** Subdomínios que nunca podem ser tenant (ADR-0011, regra 5). */
export const SLUGS_RESERVADOS = new Set([
  "admin",
  "www",
  "api",
  "app",
  "mail",
  "email",
  "smtp",
  "static",
  "assets",
  "cdn",
  "status",
  "docs",
  "suporte",
  "ajuda",
  "blog",
  "login",
  "auth",
  "conta",
  "console",
  "teste",
  "demo",
]);

const FORMATO_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function dominio(): string {
  return (process.env.APP_DOMINIO ?? "localhost:3000").toLowerCase();
}

export function protocolo(): "http" | "https" {
  return process.env.APP_PROTOCOLO === "http"
    ? "http"
    : process.env.NODE_ENV === "production"
      ? "https"
      : "http";
}

/** Motivo da recusa do slug, ou null se ele é válido. */
/** Problema no endereço (subdomínio): chave das mensagens (ADR-0020) ou null se estiver bom. */
export function problemaNoSlug(slug: string): string | null {
  if (!FORMATO_SLUG.test(slug)) return "console.erros.enderecoInvalido";
  if (SLUGS_RESERVADOS.has(slug)) return "console.erros.enderecoReservado";
  return null;
}

/** Identifica a área pelo host da requisição. */
export function resolverArea(host: string | null | undefined, base: string = dominio()): Area {
  const h = (host ?? "").trim().toLowerCase();
  if (!h) return { tipo: "invalido" };
  if (h === base) return { tipo: "raiz" };
  const sufixo = `.${base}`;
  if (!h.endsWith(sufixo)) return { tipo: "invalido" };
  const sub = h.slice(0, -sufixo.length);
  if (sub === "admin") return { tipo: "console" };
  if (sub.includes(".") || problemaNoSlug(sub)) return { tipo: "invalido" };
  return { tipo: "tenant", slug: sub };
}

/** URL absoluta de um caminho numa área (ex.: link de convite no e-mail). */
export function urlDaArea(
  area: { tipo: "console" } | { tipo: "tenant"; slug: string },
  caminho: string,
): string {
  const sub = area.tipo === "console" ? "admin" : area.slug;
  return `${protocolo()}://${sub}.${dominio()}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

/** Hosts aceitos pela autenticação (ADR-0011). */
export function hostsPermitidos(): string[] {
  return [dominio(), `*.${dominio()}`];
}
