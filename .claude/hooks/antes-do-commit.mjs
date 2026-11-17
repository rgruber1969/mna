// Hook PreToolUse (Bash): antes de um `git commit` feito pelo Claude, procura
// segredos no que vai ser commitado e bloqueia o commit se encontrar (ADR-0017).
// Examina o que já está preparado (staged), as alterações ainda não preparadas
// e os arquivos novos, porque o commit costuma vir junto de um `git add -A`.
import fs from "node:fs";
import path from "node:path";
import { git, lerEntrada, raiz } from "./comum.mjs";

const entrada = await lerEntrada();
const comando = entrada.tool_input?.command ?? "";
if (!/\bgit\s+commit\b/.test(comando)) process.exit(0);

const padroes = [
  ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["chave de acesso AWS", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["chave de API Anthropic", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["chave de API OpenAI", /\bsk-(proj-)?[A-Za-z0-9]{32,}/],
  ["chave de API Resend", /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/],
  ["token GitHub", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}/],
  ["token Slack", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["chave Google", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["chave de assinatura Inngest", /\bsignkey-(prod|test|branch)-[A-Za-z0-9]{20,}/],
  ["conexão de banco na nuvem com senha", /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@[^\s/]*(neon\.tech|amazonaws\.com|supabase\.co)/],
];

const achados = [];
const examinar = (origem, texto) => {
  for (const linha of texto.split("\n")) {
    if (origem === "diff" && !(linha.startsWith("+") && !linha.startsWith("+++"))) continue;
    for (const [nome, re] of padroes) if (re.test(linha)) achados.push(`${nome}: ${linha.slice(0, 120).trim()}`);
  }
};

// Alterações preparadas e não preparadas de arquivos já versionados.
examinar("diff", git(["diff", "--cached", "--no-color", "-U0"]).stdout);
examinar("diff", git(["diff", "--no-color", "-U0"]).stdout);

// Arquivos novos que um `git add -A` incluiria.
const novos = git(["ls-files", "--others", "--exclude-standard"]).stdout.split("\n").filter(Boolean);
const preparados = git(["diff", "--cached", "--name-only"]).stdout.split("\n").filter(Boolean);
for (const rel of [...novos, ...preparados]) {
  if (/(^|\/)\.env$|(^|\/)\.env\.(?!example$)/.test(rel)) achados.push(`arquivo de segredos sendo versionado: ${rel}`);
  const abs = path.join(raiz, rel);
  if (novos.includes(rel) && fs.existsSync(abs) && fs.statSync(abs).size < 1e6) {
    examinar("arquivo", fs.readFileSync(abs, "utf8"));
  }
}

if (achados.length) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Commit bloqueado: possível segredo no que seria commitado (ADR-0017). Remova o segredo (use .env, nunca versionado) e tente de novo.\n- ${[...new Set(achados)].join("\n- ")}`,
      },
    }),
  );
}
