import { describe, expect, it } from "vitest";
import { conferirFuncionalidadesSimuladas, modoDa } from "./funcionalidades";

describe("funcionalidades simuladas", () => {
  it("fora da produção, o que ainda não é real fica simulado; em produção, desligado", () => {
    expect(modoDa("valuation", { NODE_ENV: "development" })).toBe("simulada");
    expect(modoDa("valuation", { NODE_ENV: "production" })).toBe("desligada");
  });

  it("a variável escolhe o modo; 'real' não vale para o que ainda não foi construído", () => {
    const ambiente = {
      NODE_ENV: "development",
      FUNCIONALIDADES: "valuation:desligada, ebook:real, x:simulada",
    };
    expect(modoDa("valuation", ambiente)).toBe("desligada");
    expect(modoDa("ebook", ambiente)).toBe("simulada");
  });

  it("recusa iniciar em produção com alguma funcionalidade simulada", () => {
    expect(() => conferirFuncionalidadesSimuladas({ NODE_ENV: "production" })).not.toThrow();
    expect(() =>
      conferirFuncionalidadesSimuladas({ NODE_ENV: "production", FUNCIONALIDADES: "valuation:simulada" }),
    ).toThrow(/valuation/);
    expect(() =>
      conferirFuncionalidadesSimuladas({ NODE_ENV: "development", FUNCIONALIDADES: "valuation:simulada" }),
    ).not.toThrow();
  });
});
