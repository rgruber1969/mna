import { sql } from "drizzle-orm";
import { index, jsonb, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Esquema do banco (ADR-0009, ADR-0018).
 *
 * Regras:
 * - Toda tabela de negócio tem `tenant_id` + RLS ativado e forçado, com a
 *   política `isolamento_tenant`. O teste `rls.test.ts` falha se alguma
 *   tabela com `tenant_id` ficar sem RLS.
 * - A aplicação conecta com o papel `mna_app` (sem privilégio de contornar
 *   RLS). O tenant da transação vem de `set_config('app.tenant_id', ...)`.
 * - Tabelas globais (sem `tenant_id`) são exceções documentadas aqui.
 */

/** Condição de isolamento: a linha pertence ao tenant da transação atual. */
const doTenantAtual = sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`;

// ---------------------------------------------------------------------------
// Tabelas globais (exceções sem tenant_id)
// ---------------------------------------------------------------------------

/** Tenants (contratantes). Global: administrado pelo console da RGRUBER. */
export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tabelas de negócio (sempre com tenant_id + RLS)
// ---------------------------------------------------------------------------

/**
 * Trilha de auditoria (ADR-0007, docs/projeto/dados-pessoais.md).
 * Sem dados pessoais: só identificadores. Imutável: a aplicação só insere e lê.
 */
export const eventoAuditoria = pgTable(
  "evento_auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    atorId: uuid("ator_id"),
    alvoTipo: text("alvo_tipo"),
    alvoId: uuid("alvo_id"),
    detalhes: jsonb("detalhes").$type<Record<string, string | number | boolean | null>>(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evento_auditoria_tenant_ocorrido_idx").on(t.tenantId, t.ocorridoEm),
    pgPolicy("isolamento_tenant", {
      for: "all",
      to: "mna_app",
      using: doTenantAtual,
      withCheck: doTenantAtual,
    }),
  ],
).enableRLS();
