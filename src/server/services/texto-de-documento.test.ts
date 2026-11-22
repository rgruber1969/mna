import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { textoDoDocumento } from "./texto-de-documento";

/** Extração de texto para a busca por conteúdo (ADR-0022). */
describe("texto do documento", () => {
  it("Word: parágrafos e entidades", async () => {
    const docx = zipSync({
      "word/document.xml": strToU8(
        "<w:document><w:body><w:p><w:r><w:t>Cláusula 7 &amp; multa</w:t></w:r></w:p><w:p><w:r><w:t>Rescisão</w:t></w:r></w:p></w:body></w:document>",
      ),
    });
    const t = await textoDoDocumento(
      docx,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(t).toBe("Cláusula 7 & multa\nRescisão");
  });

  it("Excel: textos das células, sem fórmulas", async () => {
    const xlsx = zipSync({
      "xl/sharedStrings.xml": strToU8("<sst><si><t>Passivo trabalhista</t></si><si><t>Multa</t></si></sst>"),
      "xl/worksheets/sheet1.xml": strToU8("<worksheet><row><c><f>SUM(A1)</f><v>10</v></c></row></worksheet>"),
    });
    const t = await textoDoDocumento(
      xlsx,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(t).toContain("Passivo trabalhista");
    expect(t).toContain("Multa");
    expect(t).not.toContain("SUM");
  });

  it("CSV em Latin-1 e tipo sem texto", async () => {
    const latin1 = Uint8Array.from([
      0x4d, 0x75, 0x6c, 0x74, 0x61, 0x3b, 0x72, 0x65, 0x73, 0x63, 0x69, 0x73, 0xe3, 0x6f,
    ]);
    expect(await textoDoDocumento(latin1, "text/csv")).toBe("Multa;rescisão");
    expect(await textoDoDocumento(Uint8Array.from([1, 2, 3]), "image/png")).toBeNull();
  });
});
