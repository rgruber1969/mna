// Reinicia o servidor de desenvolvimento: encerra quem estiver escutando na
// porta (padrão 3000) e sobe `next dev` de novo, neste mesmo terminal.
// Uso: pnpm dev:reiniciar
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const porta = Number(process.env.PORT ?? 3000);

function processosNaPorta() {
  try {
    if (process.platform === "win32") {
      const saida = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
      return [
        ...new Set(
          saida
            .split("\n")
            .map((l) => l.trim().split(/\s+/))
            .filter((c) => c[1]?.endsWith(`:${porta}`) && c[3] === "LISTENING")
            .map((c) => Number(c[4]))
            .filter((pid) => pid > 0),
        ),
      ];
    }
    return execSync(`lsof -ti tcp:${porta} -sTCP:LISTEN`, { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

for (const pid of processosNaPorta()) {
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(pid, "SIGTERM");
    console.log(`Servidor anterior encerrado (processo ${pid}).`);
  } catch {
    console.warn(`Não foi possível encerrar o processo ${pid}.`);
  }
}

// Espera a porta liberar (até 10 s).
for (let i = 0; i < 20 && processosNaPorta().length; i++) await new Promise((r) => setTimeout(r, 500));

// Cache do servidor de desenvolvimento: limpo a cada reinício, porque o Turbopack às vezes
// continua servindo CSS antigo depois de mudanças (aconteceu com os tokens do tema).
rmSync(fileURLToPath(new URL("../.next/dev", import.meta.url)), {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 300,
});

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const filho = spawn(process.execPath, [next, "dev", "--port", String(porta)], { stdio: "inherit" });
filho.on("exit", (codigo) => process.exit(codigo ?? 0));

// Compila as telas principais em segundo plano (primeira visita sem espera).
if (process.env.AQUECER !== "nao")
  spawn(process.execPath, [fileURLToPath(new URL("./dev-aquecer.mjs", import.meta.url))], {
    stdio: "inherit",
  });
