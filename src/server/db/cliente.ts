import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as esquema from "./esquema";

/**
 * Acesso ao banco: usado SOMENTE pela camada de serviços (ADR-0004).
 * A conexão usa o papel da aplicação (mna_app), sujeito ao RLS (ADR-0009).
 */
export type Banco = NodePgDatabase<typeof esquema>;

export function criarBanco(url = process.env.DATABASE_URL): { banco: Banco; pool: Pool } {
  if (!url) throw new Error("DATABASE_URL não definida.");
  const pool = new Pool({ connectionString: url });
  return { banco: drizzle(pool, { schema: esquema }), pool };
}

let padrao: ReturnType<typeof criarBanco> | undefined;

/** Banco padrão da aplicação (criado na primeira chamada). */
export function banco(): Banco {
  padrao ??= criarBanco();
  return padrao.banco;
}

type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];

/**
 * Executa `operacao` numa transação vinculada a um tenant: o RLS só enxerga
 * e só aceita linhas desse tenant. O tenantId deve vir da sessão ou da chave
 * de API, nunca de parâmetro enviado pelo cliente.
 */
export async function comTenant<T>(
  tenantId: string,
  operacao: (tx: Transacao) => Promise<T>,
  db: Banco = banco(),
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return operacao(tx);
  });
}
