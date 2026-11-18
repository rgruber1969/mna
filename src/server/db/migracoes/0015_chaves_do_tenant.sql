CREATE TABLE "chave_tenant" (
	"tenant_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"chave_trancada" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chave_tenant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chave_tenant" ADD CONSTRAINT "chave_tenant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chave_tenant_uq" ON "chave_tenant" USING btree ("tenant_id","versao");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "chave_tenant" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- RLS vale também para o dono da tabela (ADR-0009).
ALTER TABLE "chave_tenant" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Chaves: criadas (e rotacionadas) e destruídas pela aplicação; nunca alteradas.
GRANT SELECT, INSERT, DELETE ON "chave_tenant" TO mna_app;
