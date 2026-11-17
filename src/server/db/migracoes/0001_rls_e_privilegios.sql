-- RLS forçado e privilégios mínimos do papel da aplicação (ADR-0009).

-- RLS vale também para o dono da tabela.
ALTER TABLE "evento_auditoria" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Acesso ao esquema.
GRANT USAGE ON SCHEMA public TO mna_app;
--> statement-breakpoint

-- Tenants: a aplicação só lê (cadastro e alteração ficam no console, com
-- caminho administrativo próprio).
GRANT SELECT ON "tenant" TO mna_app;
--> statement-breakpoint

-- Auditoria imutável: a aplicação só insere e lê; nunca altera nem apaga.
GRANT SELECT, INSERT ON "evento_auditoria" TO mna_app;
