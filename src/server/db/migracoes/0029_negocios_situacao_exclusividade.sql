CREATE TABLE "prorrogacao_exclusividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"fim_anterior" date NOT NULL,
	"novo_fim" date NOT NULL,
	"motivo" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prorrogacao_exclusividade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "encerrado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "exclusividade_empresa_id" uuid;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "exclusividade_inicio" date;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "exclusividade_fim" date;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "avisos_enviados" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD COLUMN "cortada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD COLUMN "prazo_antes_do_corte" date;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD COLUMN "motivo_do_corte" text;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD COLUMN "vencimento_avisado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "dias_aviso_exclusividade" jsonb DEFAULT '[15,5]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prorrogacao_exclusividade" ADD CONSTRAINT "prorrogacao_exclusividade_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prorrogacao_exclusividade" ADD CONSTRAINT "prorrogacao_exclusividade_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prorrogacao_exclusividade" ADD CONSTRAINT "prorrogacao_exclusividade_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prorrogacao_exclusividade_deal_idx" ON "prorrogacao_exclusividade" USING btree ("tenant_id","deal_id");--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_exclusividade_empresa_id_empresa_id_fk" FOREIGN KEY ("exclusividade_empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "prorrogacao_exclusividade" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "prorrogacao_exclusividade" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "prorrogacao_exclusividade" TO mna_app;
