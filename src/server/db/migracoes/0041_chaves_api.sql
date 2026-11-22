CREATE TABLE "chave_api" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"prefixo" text NOT NULL,
	"hash" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" date,
	"ultimo_uso_em" timestamp with time zone,
	"revogada_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chave_api" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chave_api" ADD CONSTRAINT "chave_api_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chave_api" ADD CONSTRAINT "chave_api_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chave_api" ADD CONSTRAINT "chave_api_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chave_api_hash_uq" ON "chave_api" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "chave_api_tenant_idx" ON "chave_api" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "chave_api" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "chave_api" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "chave_api" TO mna_app;
