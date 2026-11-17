// Hook PostToolUse (Edit|Write|MultiEdit):
// 1. formata o arquivo editado com Prettier;
// 2. roda o ESLint só nele (regras dos ADRs) e devolve os erros ao Claude;
// 3. se for o CLAUDE.md, avisa quando passar de 80 linhas (ADR-0008).
// Saída 2 = o texto em stderr volta para o Claude corrigir.
import fs from "node:fs";
import path from "node:path";
import { executarNode, lerEntrada, raiz } from "./comum.mjs";

const entrada = await lerEntrada();
const arquivo = entrada.tool_input?.file_path ?? entrada.tool_response?.filePath;
if (!arquivo) process.exit(0);

const absoluto = path.resolve(arquivo);
const relativo = path.relative(raiz, absoluto);
if (relativo.startsWith("..") || path.isAbsolute(relativo) || !fs.existsSync(absoluto)) process.exit(0);

const problemas = [];

// CLAUDE.md: controle de tamanho.
if (path.basename(absoluto) === "CLAUDE.md") {
  const linhas = fs.readFileSync(absoluto, "utf8").split("\n").length;
  if (linhas > 80) {
    problemas.push(
      `CLAUDE.md com ${linhas} linhas (meta: ~80, ADR-0008). Proponha ao responsável o que mover para docs/projeto/, rule ou skill, antes de mover.`,
    );
  }
}

// Prettier (respeita .prettierignore; ignora tipos que não conhece).
executarNode("node_modules/prettier/bin/prettier.cjs", [
  "--write",
  "--ignore-unknown",
  "--log-level",
  "warn",
  relativo,
]);

// ESLint em código-fonte.
if (/\.(m?[jt]sx?)$/.test(absoluto)) {
  const r = executarNode("node_modules/eslint/bin/eslint.js", ["--no-warn-ignored", relativo]);
  if (r.status !== 0)
    problemas.push(`ESLint encontrou problemas em ${relativo}:\n${(r.stdout || r.stderr).trim()}`);
}

if (problemas.length) {
  process.stderr.write(problemas.join("\n\n") + "\n");
  process.exit(2);
}
