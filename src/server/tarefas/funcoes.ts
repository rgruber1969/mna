import { inngest } from "./cliente";
import { obterStatusDoSistema } from "@/server/services/sistema";
import { enviarAvisosDePrazoDeTodos } from "@/server/services/negocios-andamento";

/**
 * Tarefa de verificação: confirma que o ciclo evento → Inngest → aplicação
 * funciona. Retorna só o status, sem dados pessoais (ADR-0015).
 */
export const verificarSistema = inngest.createFunction(
  { id: "sistema-verificar", triggers: [{ event: "sistema/verificar" }] },
  async ({ step }) => {
    const status = await step.run("obter-status", () => obterStatusDoSistema().status);
    return { status };
  },
);

/**
 * Avisos de prazo dos negócios (exclusividade e vencimento de participação),
 * todo dia às 8 h de Brasília. Idempotente: cada aviso sai uma vez.
 */
export const avisosDePrazo = inngest.createFunction(
  { id: "negocios-avisos-de-prazo", triggers: [{ cron: "TZ=America/Sao_Paulo 0 8 * * *" }] },
  async ({ step }) => {
    const enviados = await step.run("enviar", () => enviarAvisosDePrazoDeTodos());
    return { enviados };
  },
);

/** Todas as tarefas registradas na aplicação. */
export const funcoes = [verificarSistema, avisosDePrazo];
