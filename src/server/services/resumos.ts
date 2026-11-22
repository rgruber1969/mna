import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { comTenant } from "@/server/db/cliente";
import { documento, documentoTexto, documentoVersao } from "@/server/db/esquema";
import { exigirTenant, type Acesso } from "./acesso";
import { dataRoomDoNegocio } from "./documentos";
import { conversasDoNegocio, linkDaConversa, recentesDe } from "./mensagens";
import { nomeVisivel } from "./negocios";

/**
 * Resumos automáticos (item 31; decisão menor "Resumos automáticos"): módulo
 * único. Por ora, resumo **local, sem IA**, por regras no servidor (nada sai
 * do ambiente). Se a produção adotar IA, a troca é feita aqui, sem mudar as
 * telas: elas recebem os mesmos dados estruturados e montam o texto.
 */

const uuidValido = (id: string) => z.uuid().safeParse(id).success;

// --- Mensagens ---------------------------------------------------------------------------

export type ResumoDasMensagens = {
  naoLidas: number;
  pessoas: number;
  negocios: number;
  /** Quantas das não lidas mencionam a pessoa. */
  mencoes: number;
  /** Data da não lida mais antiga. */
  desde: string | null;
  /** Até 3 trechos: primeiro as que mencionam a pessoa, depois as mais recentes. */
  trechos: { autor: string | null; negocio: string; rotulo: string; trecho: string; link: string }[];
};

export async function resumoDasMensagens(
  acesso: Acesso | null,
  dealId?: string | null,
): Promise<ResumoDasMensagens> {
  const a = exigirTenant(acesso);
  const naoLidas = (await recentesDe(a)).filter((m) => m.naoLida && (!dealId || m.dealId === dealId));
  const minhas = (m: (typeof naoLidas)[number]) => m.mencoes.includes(a.usuario.id);
  const ordenadas = [...naoLidas.filter(minhas), ...naoLidas.filter((m) => !minhas(m))];
  return {
    naoLidas: naoLidas.length,
    pessoas: new Set(naoLidas.map((m) => m.autorId ?? "?")).size,
    negocios: new Set(naoLidas.map((m) => m.dealId)).size,
    mencoes: naoLidas.filter(minhas).length,
    desde: naoLidas.length ? naoLidas[naoLidas.length - 1].criadoEm.toISOString() : null,
    trechos: ordenadas.slice(0, 3).map((m) => ({
      autor: m.autor,
      negocio: nomeVisivel(m.numero, m.codinome),
      rotulo: m.rotulo,
      trecho: m.texto.length > 160 ? `${m.texto.slice(0, 160)}…` : m.texto,
      link: linkDaConversa(m.dealId, { tipo: m.alvoTipo, id: m.alvoId }, m.canal),
    })),
  };
}

// --- Histórico de um documento -----------------------------------------------------------

export type MudancasEntreVersoes = {
  /** Linhas que entraram e que saíram do texto. */
  adicionadas: number;
  removidas: number;
  /** Cláusulas, seções ou itens numerados onde houve mudança (até 8). */
  secoes: string[];
};

export type ResumoDoDocumento = {
  versoes: number;
  /** Dias entre a primeira e a última versão que a pessoa vê. */
  dias: number;
  autores: string[];
  comentarios: number;
  ultima: { numero: number; mudancas: MudancasEntreVersoes | null };
};

/** "Cláusula 7", "Seção 4.2", "Artigo 3º", "Capítulo II" ou itens numerados ("4.1 ..."). */
const TITULO =
  /^(?:(cl[áa]usula|se[çc][ãa]o|artigo|art\.|cap[íi]tulo|item|anexo)\s+([\w.º°ª-]+)|(\d+(?:\.\d+){0,3})[.)]?\s+\S)/i;

function rotuloDaSecao(linha: string): string | null {
  const m = TITULO.exec(linha.trim());
  if (!m) return null;
  if (m[3]) return m[3];
  const tipo = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return `${tipo} ${m[2].replace(/[.-]+$/, "")}`;
}

/** Comparação por linhas (texto extraído): o que entrou, o que saiu e em quais seções. */
export function compararTextos(anterior: string, atual: string): MudancasEntreVersoes {
  const limpa = (t: string) =>
    t
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const antes = limpa(anterior);
  const depois = limpa(atual);
  const conjuntoAntes = new Set(antes);
  const conjuntoDepois = new Set(depois);
  const secoes = new Set<string>();
  const percorrer = (linhas: string[], outro: Set<string>) => {
    let secao: string | null = null;
    let mudou = 0;
    for (const l of linhas) {
      secao = rotuloDaSecao(l) ?? secao;
      if (!outro.has(l)) {
        mudou++;
        if (secao) secoes.add(secao);
      }
    }
    return mudou;
  };
  const adicionadas = percorrer(depois, conjuntoAntes);
  const removidas = percorrer(antes, conjuntoDepois);
  return { adicionadas, removidas, secoes: [...secoes].slice(0, 8) };
}

export async function resumoDoDocumento(
  acesso: Acesso | null,
  documentoId: string,
): Promise<ResumoDoDocumento | null> {
  const a = exigirTenant(acesso);
  if (!uuidValido(documentoId)) return null;
  const [doc] = await comTenant(a.tenant.id, (tx) =>
    tx.select({ dealId: documento.dealId }).from(documento).where(eq(documento.id, documentoId)),
  );
  if (!doc) return null;
  const dr = await dataRoomDoNegocio(a, doc.dealId).catch(() => null);
  const naTela = dr?.documentos.find((d) => d.id === documentoId);
  if (!naTela || naTela.versoes.length === 0) return null;
  // Só as versões que a pessoa vê, da mais antiga para a mais nova.
  const ids = naTela.versoes.map((v) => v.id);
  const linhas = await comTenant(a.tenant.id, (tx) =>
    tx
      .select({ id: documentoVersao.id, numero: documentoVersao.numero, texto: documentoTexto.texto })
      .from(documentoVersao)
      .leftJoin(documentoTexto, eq(documentoTexto.versaoId, documentoVersao.id))
      .where(inArray(documentoVersao.id, ids))
      .orderBy(asc(documentoVersao.numero)),
  );
  const versoes = [...naTela.versoes].sort((x, y) => x.numero - y.numero);
  const primeira = new Date(versoes[0].criadoEm).getTime();
  const ultima = versoes[versoes.length - 1];
  const textoDe = new Map(linhas.map((l) => [l.numero, l.texto]));
  const anterior = versoes.length > 1 ? textoDe.get(versoes[versoes.length - 2].numero) : null;
  const atual = textoDe.get(ultima.numero);
  const conversas = await conversasDoNegocio(a, doc.dealId);
  const comentarios = (conversas ?? [])
    .filter((c) => c.alvo.tipo === "versao" && c.alvo.id && ids.includes(c.alvo.id))
    .reduce((s, c) => s + c.total, 0);
  return {
    versoes: versoes.length,
    dias: Math.round((new Date(ultima.criadoEm).getTime() - primeira) / 86_400_000),
    autores: [...new Set(versoes.map((v) => v.enviadoPor).filter((x): x is string => Boolean(x)))],
    comentarios,
    ultima: { numero: ultima.numero, mudancas: anterior && atual ? compararTextos(anterior, atual) : null },
  };
}
