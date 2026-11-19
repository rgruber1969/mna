CREATE TABLE "participacao_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"socia_id" uuid NOT NULL,
	"qualificacao" text,
	"percentual" numeric(7, 4),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participacao_empresa_diferentes_ck" CHECK (empresa_id <> socia_id)
);
--> statement-breakpoint
ALTER TABLE "participacao_empresa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participacao_empresa" ADD CONSTRAINT "participacao_empresa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_empresa" ADD CONSTRAINT "participacao_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_empresa" ADD CONSTRAINT "participacao_empresa_socia_id_empresa_id_fk" FOREIGN KEY ("socia_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participacao_empresa_uq" ON "participacao_empresa" USING btree ("tenant_id","empresa_id","socia_id");--> statement-breakpoint
CREATE INDEX "participacao_empresa_socia_idx" ON "participacao_empresa" USING btree ("tenant_id","socia_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "participacao_empresa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "participacao_empresa" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "participacao_empresa" TO mna_app;
