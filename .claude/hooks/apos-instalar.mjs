// Hook PostToolUse (Bash): depois de um `pnpm add` ou `pnpm install` feito
// pelo Claude, verifica se o pnpm bloqueou scripts de instalação de algum
// pacote e lembra de decidir em pnpm-workspace.yaml (allowBuilds: true para
// liberar, false para manter bloqueado). Não altera nada sozinho.
import fs from "node:fs";
import path from "node:path";
import { lerEntrada, raiz } from "./comum.mjs";

const entrada = await lerEntrada();
const comando = entrada.tool_input?.command ?? "";
if (!/\bpnpm\s+(add|install|i|update|up)\b/.test(comando)) process.exit(0);

const r = entrada.tool_response ?? {};
const saida = [r.stdout, r.stderr, typeof r === "string" ? r : ""].filter(Boolean).join("\n");
if (!/ignored[ _-]?builds|ignored build scripts|IGNORED_BUILDS/i.test(saida)) process.exit(0);

// Pacotes citados no aviso que ainda não têm decisão em allowBuilds.
const workspace = fs.readFileSync(path.join(raiz, "pnpm-workspace.yaml"), "utf8");
const decididos = new Set(
  [...workspace.matchAll(/^\s{2}["']?([@\w./-]+)["']?:\s*(true|false)/gm)].map((m) => m[1]),
);
const citados = [...saida.matchAll(/(@?[a-z0-9][\w.-]*(?:\/[\w.-]+)?)@\d+\.\d+\.\d+/gi)].map((m) => m[1]);
const pendentes = [...new Set(citados)].filter((p) => !decididos.has(p));

const lista = pendentes.length ? pendentes.join(", ") : "veja a saída do comando";
console.log(
  JSON.stringify({
    systemMessage: `pnpm bloqueou scripts de instalação (${lista}).`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `O pnpm bloqueou scripts de instalação de pacotes (${lista}). ` +
        "Decida cada um em pnpm-workspace.yaml > allowBuilds: true só se o pacote precisar compilar algo " +
        "para funcionar (ex.: esbuild); caso contrário, false. Registre a decisão no mesmo commit.",
    },
  }),
);
