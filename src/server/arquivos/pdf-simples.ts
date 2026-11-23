/**
 * PDF simples de texto (uma página por bloco de linhas, Helvetica, acentos em
 * WinAnsi), para as exportações de demonstração. Sem dependências: as
 * exportações reais (itens 21 e 22) vão usar um gerador completo.
 */
export function pdfDeTexto(paginas: string[][]): Uint8Array {
  const escapar = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const objetos: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const kids: string[] = [];
  const fonte = 3;
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  for (const linhas of paginas) {
    const conteudo = [
      "BT /F1 10 Tf 48 790 Td 15 TL",
      ...linhas.map((l) => `(${escapar(l)}) Tj T*`),
      "ET",
    ].join("\n");
    objetos.push(`<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`);
    const conteudoId = objetos.length;
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${conteudoId} 0 R /Resources << /Font << /F1 ${fonte} 0 R >> >> >>`,
    );
    kids.push(`${objetos.length} 0 R`);
  }
  objetos[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
