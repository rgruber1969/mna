// Aquece o servidor de desenvolvimento: pede as telas principais uma vez para
// o Next compilar cada rota antes da primeira visita de verdade (no `next dev`
// cada rota só é compilada quando alguém a abre, o que leva de 5 a 20 s).
// Sem sessão, as telas só redirecionam para a entrada; a compilação acontece
// do mesmo jeito. Uso: pnpm dev:aquecer (o dev:reiniciar já chama sozinho).
import { request } from "node:http";

const porta = Number(process.env.PORT ?? 3000);
const tenant = process.env.AQUECER_TENANT ?? "bt";
const zero = "00000000-0000-0000-0000-000000000000";
const rotas = [
  "/entrar",
  "/",
  "/negocios",
  "/negocios?vista=kanban",
  `/negocios/${zero}`,
  "/negocios/novo",
  "/contratos",
  `/contratos/${zero}`,
  "/contratos/novo",
  "/tarefas",
  "/mensagens",
  "/busca?q=aquecer",
  "/empresas",
  `/empresas/${zero}`,
  "/pessoas",
  `/pessoas/${zero}`,
  "/configuracoes",
  "/usuarios",
  "/perfis",
  "/cadastro-por-documento",
  "/configurar-2fa",
  "/notificacoes",
];
// Console da RGRUBER (admin.<domínio>).
const rotasDoConsole = ["/entrar", "/", "/configurar-2fa", "/equipe", `/tenants/${zero}`, "/convite/aquecer"];

// node:http em 127.0.0.1 com o Host do tenant (o Windows não resolve *.localhost para o Node).
const pedir = (caminho, sub = tenant) =>
  new Promise((resolver) => {
    const req = request(
      { host: "127.0.0.1", port: porta, path: caminho, headers: { host: `${sub}.localhost:${porta}` } },
      (r) => {
        r.resume();
        r.on("end", () => resolver(r.statusCode ?? 0));
      },
    );
    req.on("error", () => resolver(0));
    req.setTimeout(120_000, () => req.destroy());
    req.end();
  });

// Espera o servidor responder (até 2 min).
for (let i = 0; i < 120 && (await pedir("/entrar")) === 0; i++) await new Promise((r) => setTimeout(r, 1000));

const inicio = Date.now();
for (const rota of rotas) await pedir(rota);
for (const rota of rotasDoConsole) await pedir(rota, "admin");
console.log(
  `[aquecer] ${rotas.length + rotasDoConsole.length} telas compiladas em ${Math.round((Date.now() - inicio) / 1000)} s.`,
);
