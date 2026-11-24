import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfValido,
  formatarCnpj,
  formatarCpf,
  mascararCpf,
  mascararDocumento,
} from "./documentos";

describe("documentos", () => {
  it("valida CPF pelos dígitos verificadores", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224726")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  it("valida CNPJ pelos dígitos verificadores", () => {
    expect(cnpjValido("00.000.000/0001-91")).toBe(true);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("formata e mascara", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(mascararCpf("52998224725")).toBe("***.982.247-**");
    expect(mascararDocumento("12.345.678-9")).toBe("******-9");
    expect(mascararDocumento("AB")).toBe("***");
  });
});

describe("digitação de CNPJ e CPF", () => {
  it("limita aos dígitos do documento e formata enquanto digita", async () => {
    const { digitandoCnpj, digitandoCpf } = await import("./documentos");
    expect(digitandoCnpj("112223330001819999")).toBe("11.222.333/0001-81");
    expect(digitandoCnpj("11222")).toBe("11.222");
    expect(digitandoCpf("529982247259999")).toBe("529.982.247-25");
    expect(digitandoCpf("5299")).toBe("529.9");
  });
});
