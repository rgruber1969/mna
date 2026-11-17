import { createHmac } from "node:crypto";

/**
 * Apoio aos testes (Vitest e Playwright). Nunca importado pela aplicação.
 */

/** Código TOTP (RFC 6238) a partir do segredo em base32, como num aplicativo autenticador. */
export function totp(segredo: string, instante = Date.now()): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of segredo.replace(/=+$/, "").toUpperCase())
    bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const chave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(instante / 30000)));
  const h = createHmac("sha1", chave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1e6).toString().padStart(6, "0");
}

/** Procura no Mailpit o último e-mail para o destinatário e devolve o primeiro link que casa com o padrão. */
export async function linkDoEmail(para: string, padrao: RegExp, tentativas = 20): Promise<string | null> {
  for (let i = 0; i < tentativas; i++) {
    const busca = await fetch(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`,
    );
    const { messages } = (await busca.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const m = (await (await fetch(`http://localhost:8025/api/v1/message/${messages[0].ID}`)).json()) as {
        Text: string;
      };
      const link = m.Text.match(padrao)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
