import { describe, expect, it } from "vitest";
import { chaveDoArquivo, gerarLinkDeDownload, gerarLinkDeEnvio } from "./armazenamento";

/** Teste contra o armazenamento REAL local (RustFS no Docker). */
describe("armazenamento de arquivos", () => {
  it("monta a chave sob o tenant e recusa partes perigosas", () => {
    expect(chaveDoArquivo("t1", "documento", "v1.pdf")).toBe("tenant/t1/documento/v1.pdf");
    expect(() => chaveDoArquivo("t1", "../outro-tenant")).toThrow();
  });

  it("envia por link temporário e baixa como anexo", async () => {
    const chave = chaveDoArquivo("teste", `arquivo-${Date.now()}.txt`);
    const conteudo = "conteúdo de teste";

    const envio = await fetch(await gerarLinkDeEnvio(chave, "text/plain"), {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: conteudo,
    });
    expect(envio.ok).toBe(true);

    const download = await fetch(await gerarLinkDeDownload(chave, "relatório final.txt"));
    expect(download.ok).toBe(true);
    expect(await download.text()).toBe(conteudo);
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("link de download vencido é recusado", async () => {
    const link = await gerarLinkDeDownload(chaveDoArquivo("teste", "qualquer.txt"), "x.txt", 1);
    await new Promise((r) => setTimeout(r, 2100));
    expect((await fetch(link)).ok).toBe(false);
  });
});
