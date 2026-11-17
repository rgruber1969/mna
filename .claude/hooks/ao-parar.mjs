// Hook Stop: antes de o Claude encerrar uma tarefa, roda a checagem de tipos e
// os testes. Se falharem, o Claude continua trabalhando até corrigir.
// - Trava de ciclo: se o Claude já está continuando por causa deste hook
//   (stop_hook_active), não roda de novo.
// - Só roda se o código mudou desde a última verificação bem-sucedida.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { executarNode, git, lerEntrada, raiz } from "./comum.mjs";

const entrada = await lerEntrada();
if (entrada.stop_hook_active) process.exit(0);

// "Impressão digital" do código: último commit + alterações pendentes.
const pastas = ["src", "e2e", "scripts", "package.json", "tsconfig.json", "vitest.config.mts", "drizzle.config.ts"];
const head = git(["rev-parse", "HEAD"]).stdout.trim();
const pendente = git(["status", "--porcelain", "--", ...pastas]).stdout;
const diff = git(["diff", "HEAD", "--", ...pastas]).stdout;
const chave = createHash("sha256").update(head + pendente + diff).digest("hex");

const marcador = path.join(raiz, ".git", "claude-ultima-verificacao");
if (fs.existsSync(marcador) && fs.readFileSync(marcador, "utf8") === chave) process.exit(0);

const etapas = [
  ["Checagem de tipos", "node_modules/typescript/bin/tsc", ["--noEmit"]],
  ["Testes", "node_modules/vitest/vitest.mjs", ["run"]],
];
for (const [nome, script, args] of etapas) {
  const r = executarNode(script, args, { maxBuffer: 50e6 });
  if (r.status !== 0) {
    const saida = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n");
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Falha na etapa "${nome}". Corrija antes de encerrar (se os serviços do Docker estiverem parados, rode docker compose up -d):\n${saida}`,
      }),
    );
    process.exit(0);
  }
}
fs.writeFileSync(marcador, chave);
