import { produto } from "@/config/produto";

/**
 * Camada de serviços (ADR-0004): toda regra de negócio fica aqui.
 * Telas, API (Hono) e o futuro servidor MCP apenas chamam estas funções.
 */
export type StatusDoSistema = {
  produto: string;
  versao: string;
  status: "ok";
  horario: string;
};

export function obterStatusDoSistema(agora: Date = new Date()): StatusDoSistema {
  return {
    produto: produto.nome,
    versao: produto.versao,
    status: "ok",
    horario: agora.toISOString(),
  };
}
