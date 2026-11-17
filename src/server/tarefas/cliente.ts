import { Inngest } from "inngest";

/**
 * Módulo único de tarefas em segundo plano (ADR-0015).
 * Só este diretório importa o SDK do Inngest. Regras:
 * - eventos e retornos de etapas levam apenas identificadores, nunca dados
 *   pessoais;
 * - a lógica de cada tarefa é uma função comum da camada de serviços;
 * - toda tarefa é idempotente (pode rodar mais de uma vez sem duplicar efeito).
 *
 * Em desenvolvimento, INNGEST_DEV=1 aponta para o servidor local
 * (docker compose, serviço "inngest").
 */
export const inngest = new Inngest({ id: "mna" });
