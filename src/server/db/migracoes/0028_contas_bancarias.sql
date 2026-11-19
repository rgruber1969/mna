CREATE TABLE "conta_bancaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"empresa_id" uuid,
	"pessoa_id" uuid,
	"banco_codigo" text,
	"banco_nome" text,
	"agencia_cifrada" text,
	"conta_cifrada" text,
	"tipo_conta" text,
	"chave_pix_cifrada" text,
	"tipo_chave_pix" text,
	"principal" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conta_bancaria_alvo_ck" CHECK ((empresa_id is null) <> (pessoa_id is null))
);
--> statement-breakpoint
ALTER TABLE "conta_bancaria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conta_bancaria" ADD CONSTRAINT "conta_bancaria_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_bancaria" ADD CONSTRAINT "conta_bancaria_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_bancaria" ADD CONSTRAINT "conta_bancaria_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conta_bancaria_empresa_idx" ON "conta_bancaria" USING btree ("tenant_id","empresa_id");--> statement-breakpoint
CREATE INDEX "conta_bancaria_pessoa_idx" ON "conta_bancaria" USING btree ("tenant_id","pessoa_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "conta_bancaria" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "conta_bancaria" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "conta_bancaria" TO mna_app;
