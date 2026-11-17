-- Privilégios das tabelas de identidade, console e vínculos (ADR-0019).

-- RLS vale também para o dono da tabela.
ALTER TABLE "vinculo_tenant" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "convite" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Tabelas do Better Auth (globais): leitura e escrita pela aplicação.
GRANT SELECT, INSERT, UPDATE, DELETE ON "usuario", "sessao", "conta", "verificacao", "dois_fatores", "limite_tentativas" TO mna_app;
--> statement-breakpoint

-- Console: cadastra e altera tenants (nunca apaga pela aplicação).
GRANT INSERT, UPDATE ON "tenant" TO mna_app;
--> statement-breakpoint

-- Convites e vínculos.
GRANT SELECT, INSERT, UPDATE ON "convite_plataforma" TO mna_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "convite", "vinculo_tenant" TO mna_app;
--> statement-breakpoint

-- Auditoria da plataforma imutável: só insere e lê.
GRANT SELECT, INSERT ON "evento_plataforma" TO mna_app;
