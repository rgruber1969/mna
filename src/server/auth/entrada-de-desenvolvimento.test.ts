import { afterEach, describe, expect, it, vi } from "vitest";
import {
  conferirEntradaDeDesenvolvimento,
  entradaDeDesenvolvimentoLigada,
  hostLocal,
} from "./entrada-de-desenvolvimento";

/** Travas da entrada de desenvolvimento (autenticacao-e-sessao.md). */
afterEach(() => vi.unstubAllEnvs());

describe("entrada de desenvolvimento", () => {
  it("só endereços locais", () => {
    expect(hostLocal("localhost:3000")).toBe(true);
    expect(hostLocal("bt.localhost:3000")).toBe(true);
    expect(hostLocal("admin.localhost")).toBe(true);
    expect(hostLocal("bt.mna.rgruber.com.br")).toBe(false);
    expect(hostLocal("localhost.exemplo.com")).toBe(false);
    expect(hostLocal(null)).toBe(false);
  });

  it("desligada sem a marcação e sempre desligada em produção", () => {
    vi.stubEnv("DEV_ENTRAR_SO_COM_EMAIL", "nao");
    expect(entradaDeDesenvolvimentoLigada()).toBe(false);
    vi.stubEnv("DEV_ENTRAR_SO_COM_EMAIL", "sim");
    vi.stubEnv("NODE_ENV", "development");
    expect(entradaDeDesenvolvimentoLigada()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(entradaDeDesenvolvimentoLigada()).toBe(false);
  });

  it("a aplicação recusa iniciar em produção com a marcação ligada", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_ENTRAR_SO_COM_EMAIL", "sim");
    expect(() => conferirEntradaDeDesenvolvimento()).toThrow(/produção/);
    vi.stubEnv("DEV_ENTRAR_SO_COM_EMAIL", "nao");
    expect(() => conferirEntradaDeDesenvolvimento()).not.toThrow();
  });
});
