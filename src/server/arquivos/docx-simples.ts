import { strToU8, zipSync } from "fflate";

/**
 * DOCX simples (Word), sem dependências além do fflate: um .docx é um ZIP
 * com alguns XML. Usado pelos templates de demonstração (item 13, simulado);
 * a geração real a partir de arquivos .docx enviados pelo tenant vai usar
 * um preenchedor de modelos completo.
 */
export type ParagrafoDocx = { texto: string; estilo?: "titulo" | "subtitulo" | "negrito" | "pequeno" };

const escaparXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de controle não são válidos em XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function paragrafo({ texto, estilo }: ParagrafoDocx): string {
  const tamanho = estilo === "titulo" ? 32 : estilo === "subtitulo" ? 26 : estilo === "pequeno" ? 18 : 22;
  const negrito = estilo === "titulo" || estilo === "subtitulo" || estilo === "negrito";
  const props = `<w:rPr>${negrito ? "<w:b/>" : ""}<w:sz w:val="${tamanho}"/></w:rPr>`;
  const alinhamento = estilo === "titulo" ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : "";
  return `<w:p>${alinhamento}<w:r>${props}<w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r></w:p>`;
}

export function docxDeParagrafos(paragrafos: ParagrafoDocx[]): Uint8Array {
  const documento =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paragrafos.map(paragrafo).join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>";
  const tipos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";
  const relacoes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";
  return zipSync({
    "[Content_Types].xml": strToU8(tipos),
    "_rels/.rels": strToU8(relacoes),
    "word/document.xml": strToU8(documento),
  });
}
