CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE TABLE "documento_texto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"versao_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"busca" "tsvector" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_texto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documento_texto" ADD CONSTRAINT "documento_texto_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_texto" ADD CONSTRAINT "documento_texto_versao_id_documento_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."documento_versao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documento_texto_versao_uq" ON "documento_texto" USING btree ("tenant_id","versao_id");--> statement-breakpoint
CREATE INDEX "documento_texto_busca_idx" ON "documento_texto" USING gin ("busca");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "documento_texto" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "documento_texto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "documento_texto" TO mna_app;
