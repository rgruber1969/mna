import { describe, expect, it } from "vitest";
import { obterStatusDoSistema } from "./sistema";

describe("obterStatusDoSistema", () => {
  it("retorna status ok com o nome do produto vindo da configuração", () => {
    const agora = new Date("2026-11-17T12:00:00.000Z");
    const status = obterStatusDoSistema(agora);
    expect(status.status).toBe("ok");
    expect(status.horario).toBe("2026-11-17T12:00:00.000Z");
    expect(status.produto).toBe(process.env.PRODUCT_NAME ?? "MNA");
  });
});
