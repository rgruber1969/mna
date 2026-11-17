// Utilitários compartilhados pelos hooks do Claude Code deste projeto.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raiz do projeto (dois níveis acima de .claude/hooks). */
export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Lê o JSON que o Claude Code envia pela entrada padrão. */
export async function lerEntrada() {
  let texto = "";
  for await (const parte of process.stdin) texto += parte;
  try {
    return JSON.parse(texto || "{}");
  } catch {
    return {};
  }
}

/** Executa uma ferramenta Node do projeto (sem depender do pnpm no PATH). */
export function executarNode(scriptRelativo, args, opcoes = {}) {
  return spawnSync(process.execPath, [path.join(raiz, scriptRelativo), ...args], {
    cwd: raiz,
    encoding: "utf8",
    ...opcoes,
  });
}

export function git(args) {
  return spawnSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 50e6 });
}
