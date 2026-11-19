/**
 * Módulo único de verificação de arquivos enviados (ADR-0016). Um verificador
 * por ambiente; por enquanto só o **simulado** (local e demonstração): aprova
 * tudo, exceto o arquivo de teste EICAR, que bloqueia. O verificador real da
 * produção entra aqui, sem mudar quem chama (pendencias.md).
 *
 * Arquivos que serão criptografados (anexos do cadastro) são verificados
 * ANTES da criptografia: depois dela, nenhum antivírus enxerga o conteúdo.
 */

export type ResultadoDaVerificacao = "disponivel" | "bloqueado";

/** Trecho da assinatura do arquivo de teste EICAR (padrão da indústria; inofensivo). */
const EICAR = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";

export async function verificarArquivo(conteudo: Uint8Array): Promise<ResultadoDaVerificacao> {
  const inicio = Buffer.from(conteudo.subarray(0, 4096)).toString("latin1");
  return inicio.includes(EICAR) ? "bloqueado" : "disponivel";
}

/**
 * Tipo real do arquivo pelo conteúdo (não pela extensão), entre os aceitos
 * nos anexos do cadastro. Executáveis, scripts e demais formatos: null.
 */
export function tipoRealDoArquivo(conteudo: Uint8Array, nome: string): string | null {
  const b = Buffer.from(conteudo.subarray(0, 16));
  const comeca = (assinatura: number[], deslocamento = 0) =>
    assinatura.every((x, i) => b[deslocamento + i] === x);
  if (comeca([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (comeca([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (comeca([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  // DOCX e XLSX são pacotes ZIP: aceitos só com a extensão correspondente.
  if (comeca([0x50, 0x4b, 0x03, 0x04])) {
    const n = nome.toLowerCase();
    if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return null;
}
