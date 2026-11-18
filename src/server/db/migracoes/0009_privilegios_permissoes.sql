-- Privilégios das tabelas de permissões (ADR-0009, ADR-0013).

-- RLS vale também para o dono da tabela.
ALTER TABLE "perfil" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "perfil_usuario" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "matriz_usuario" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Perfis: criados, editados e excluídos pelos administradores do tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON "perfil" TO mna_app;
--> statement-breakpoint

-- Atribuições e matrizes individuais.
GRANT SELECT, INSERT, DELETE ON "perfil_usuario" TO mna_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "matriz_usuario" TO mna_app;
