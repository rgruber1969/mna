import { inngest } from "./cliente";
import { obterStatusDoSistema } from "@/server/services/sistema";

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

/** Todas as tarefas registradas na aplicação. */
export const funcoes = [verificarSistema];
