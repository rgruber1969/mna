import { describe, expect, it } from "vitest";
import { problemaNoSlug, resolverArea, urlDaArea } from "./enderecos";

const base = "mna.exemplo.com.br";

describe("resolverArea (ADR-0011)", () => {
  it("identifica console, tenant e raiz", () => {
    expect(resolverArea(`admin.${base}`, base)).toEqual({ tipo: "console" });
    expect(resolverArea(`bt.${base}`, base)).toEqual({ tipo: "tenant", slug: "bt" });
    expect(resolverArea(`BT.${base.toUpperCase()}`, base)).toEqual({ tipo: "tenant", slug: "bt" });
    expect(resolverArea(base, base)).toEqual({ tipo: "raiz" });
  });

  it("recusa hosts de fora, subníveis e slugs reservados", () => {
    expect(resolverArea("evil.com", base)).toEqual({ tipo: "invalido" });
    expect(resolverArea(`x${base}`, base)).toEqual({ tipo: "invalido" });
    expect(resolverArea(`a.bt.${base}`, base)).toEqual({ tipo: "invalido" });
    expect(resolverArea(`www.${base}`, base)).toEqual({ tipo: "invalido" });
    expect(resolverArea(`-bt.${base}`, base)).toEqual({ tipo: "invalido" });
    expect(resolverArea("", base)).toEqual({ tipo: "invalido" });
    expect(resolverArea(null, base)).toEqual({ tipo: "invalido" });
  });

  it("funciona com porta no desenvolvimento local", () => {
    expect(resolverArea("bt.localhost:3000", "localhost:3000")).toEqual({ tipo: "tenant", slug: "bt" });
    expect(resolverArea("admin.localhost:3000", "localhost:3000")).toEqual({ tipo: "console" });
  });
});

describe("problemaNoSlug", () => {
  it("aceita slugs válidos e recusa reservados e mal formados", () => {
    expect(problemaNoSlug("bt")).toBeNull();
    expect(problemaNoSlug("escritorio-1")).toBeNull();
    expect(problemaNoSlug("admin")).toBe("console.erros.enderecoReservado");
    expect(problemaNoSlug("Bt")).not.toBeNull();
    expect(problemaNoSlug("bt-")).not.toBeNull();
    expect(problemaNoSlug("a".repeat(41))).not.toBeNull();
  });
});

describe("urlDaArea", () => {
  it("monta a URL com o subdomínio da área", () => {
    expect(urlDaArea({ tipo: "tenant", slug: "bt" }, "/convite/x")).toMatch(
      /^https?:\/\/bt\.[^/]+\/convite\/x$/,
    );
    expect(urlDaArea({ tipo: "console" }, "entrar")).toMatch(/^https?:\/\/admin\.[^/]+\/entrar$/);
  });
});
