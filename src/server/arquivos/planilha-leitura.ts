import { strFromU8, unzipSync } from "fflate";

/**
 * Leitura de planilha XLSX (todas as abas, só os valores das células como
 * texto), sem dependências além do fflate. Para importar pedidos de
 * documentos: cada aba vira uma lista de linhas, na ordem das colunas.
 */
export type AbaLida = { nome: string; linhas: string[][] };

const LIMITE_DE_LINHAS = 5000;
const LIMITE_DE_COLUNAS = 60;

const desfazer = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** Texto de um nó com <t> (shared string ou inline string, inclusive com formatação rica). */
const textoDosT = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desfazer(m[1])).join("");

/** "BC12" → índice da coluna (0 = A). */
function indiceDaColuna(ref: string): number {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

export function lerPlanilha(conteudo: Uint8Array): AbaLida[] {
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(conteudo, {
      filter: (f) => (f.name.startsWith("xl/") && f.name.endsWith(".xml")) || f.name.endsWith(".rels"),
    });
  } catch {
    throw new Error("planilha inválida");
  }
  const ler = (n: string) => (arquivos[n] ? strFromU8(arquivos[n]) : "");
  const workbook = ler("xl/workbook.xml");
  if (!workbook) throw new Error("planilha inválida");
  const compartilhadas = [...ler("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textoDosT(m[1]),
  );
  const rels = new Map(
    [...ler("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      m[0].match(/Id="([^"]+)"/)?.[1] ?? "",
      m[0].match(/Target="([^"]+)"/)?.[1] ?? "",
    ]),
  );
  const abas: AbaLida[] = [];
  for (const s of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = desfazer(s[0].match(/name="([^"]*)"/)?.[1] ?? "");
    const rid = s[0].match(/r:id="([^"]+)"/)?.[1] ?? "";
    const alvo = (rels.get(rid) ?? "").replace(/^\/?(xl\/)?/, "");
    const xml = ler(`xl/${alvo}`);
    if (!xml) continue;
    const linhas: string[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
      if (linhas.length >= LIMITE_DE_LINHAS) break;
      const numero = Number((r[1] ?? r[3] ?? "").match(/r="(\d+)"/)?.[1] ?? linhas.length + 1);
      const linha: string[] = [];
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const atributos = c[1];
        const ref = atributos.match(/r="([A-Z]+)\d*"/)?.[1];
        const col = ref ? indiceDaColuna(ref) : linha.length;
        if (col >= LIMITE_DE_COLUNAS) continue;
        const tipo = atributos.match(/t="(\w+)"/)?.[1];
        const corpo = c[2] ?? "";
        const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let valor = "";
        if (tipo === "s") valor = compartilhadas[Number(v)] ?? "";
        else if (tipo === "inlineStr") valor = textoDosT(corpo);
        else if (v !== undefined) valor = desfazer(v);
        linha[col] = valor.trim();
      }
      // Mantém a posição das linhas (linhas vazias no meio continuam vazias).
      while (linhas.length < numero - 1) linhas.push([]);
      linhas.push(Array.from(linha, (x) => x ?? ""));
    }
    abas.push({ nome, linhas });
  }
  return abas;
}
