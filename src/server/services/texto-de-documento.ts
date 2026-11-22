import { sql } from "drizzle-orm";
import { comTenant } from "@/server/db/cliente";
import { unzipSync, strFromU8 } from "fflate";
import { lerArquivo } from "@/server/arquivos/armazenamento";
import { textoDoPdf } from "./leitor-de-documentos";

/**
 * Texto de um documento do data room para a busca por conteúdo (ADR-0022).
 * Tudo no servidor, sem enviar o arquivo a terceiros. PDF só com texto
 * (escaneado fica de fora até existir OCR); Word, Excel e PowerPoint pelo
 * XML de dentro do arquivo; CSV e TXT direto. Nunca registra o texto em log.
 */

/** Limite de texto guardado por versão (o resto do arquivo não entra na busca). */
export const LIMITE_DE_TEXTO = 1_000_000;
/** Acima disso o arquivo não é lido (busca só pelo nome). */
export const TAMANHO_MAXIMO_PARA_LER = 50 * 1024 * 1024;

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function textoDoXml(xml: string, quebraEm: RegExp): string {
  return xml
    .replace(quebraEm, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTIDADES[e])
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function arquivosDoZip(conteudo: Uint8Array, filtro: (nome: string) => boolean): string[] {
  const zip = unzipSync(conteudo, { filter: (f) => filtro(f.name) });
  return Object.keys(zip)
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    .map((n) => strFromU8(zip[n]));
}

function textoPuro(conteudo: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(conteudo);
  // Muitos CSV vêm em Latin-1 (Excel no Windows): se o UTF-8 quebrou, tenta Latin-1.
  return utf8.includes("�") ? new TextDecoder("latin1").decode(conteudo) : utf8;
}

/** Extrai o texto conforme o tipo real do arquivo; null se o tipo não tem texto legível. */
export async function textoDoDocumento(conteudo: Uint8Array, tipo: string): Promise<string | null> {
  if (conteudo.length > TAMANHO_MAXIMO_PARA_LER) return null;
  let texto: string | null = null;
  if (tipo === "application/pdf") texto = await textoDoPdf(conteudo);
  else if (tipo === "text/plain" || tipo === "text/csv") texto = textoPuro(conteudo);
  else if (tipo.includes("wordprocessingml"))
    texto = arquivosDoZip(conteudo, (n) => /^word\/(document|header\d*|footer\d*|footnotes)\.xml$/.test(n))
      .map((x) => textoDoXml(x, /<\/w:p>|<w:br\/>|<w:tab\/>/g))
      .join("\n");
  else if (tipo.includes("spreadsheetml"))
    texto = arquivosDoZip(
      conteudo,
      (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
    )
      .map((x) => textoDoXml(x.replace(/<f>[^<]*<\/f>/g, ""), /<\/si>|<\/c>|<\/row>/g))
      .join("\n");
  else if (tipo.includes("presentationml"))
    texto = arquivosDoZip(conteudo, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .map((x) => textoDoXml(x, /<\/a:p>/g))
      .join("\n");
  if (!texto) return null;
  const limpo = texto
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return limpo ? limpo.slice(0, LIMITE_DE_TEXTO) : null;
}

/**
 * Grava (ou troca) o texto de uma versão com o vetor de busca em português,
 * sem acentos. Falha na leitura não impede o envio: a versão só fica fora da
 * busca por conteúdo.
 */
export async function guardarTextoDaVersao(
  tenantId: string,
  versaoId: string,
  conteudo: Uint8Array,
  tipo: string,
): Promise<boolean> {
  try {
    const texto = await textoDoDocumento(conteudo, tipo);
    if (!texto) return false;
    await comTenant(tenantId, (tx) =>
      tx.execute(sql`
        insert into documento_texto (tenant_id, versao_id, texto, busca)
        values (${tenantId}, ${versaoId}, ${texto}, to_tsvector('portuguese', unaccent(${texto})))
        on conflict (tenant_id, versao_id)
        do update set texto = excluded.texto, busca = excluded.busca`),
    );
    return true;
  } catch {
    // Sem log do conteúdo (ADR-0022, regra 4).
    return false;
  }
}

/**
 * Extrai o texto das versões disponíveis que ainda não têm (ex.: enviadas
 * antes da busca por conteúdo). Pode rodar de novo sem repetir trabalho.
 */
export async function indexarVersoesSemTexto(tenantId: string): Promise<{ lidas: number; comTexto: number }> {
  const pendentes = await comTenant(tenantId, (tx) =>
    tx.execute<{ id: string; chave: string; tipo: string }>(sql`
      select v.id, v.chave, v.tipo_de_conteudo as tipo
      from documento_versao v
      left join documento_texto t on t.versao_id = v.id
      where v.situacao = 'disponivel' and v.tipo_de_conteudo is not null and t.id is null`),
  );
  let comTexto = 0;
  for (const v of pendentes.rows) {
    const conteudo = await lerArquivo(v.chave).catch(() => null);
    if (conteudo && (await guardarTextoDaVersao(tenantId, v.id, conteudo, v.tipo))) comTexto++;
  }
  return { lidas: pendentes.rows.length, comTexto };
}
