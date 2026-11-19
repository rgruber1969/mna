CREATE TABLE "tarefa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"etapa_id" uuid,
	"titulo" text NOT NULL,
	"descricao" text,
	"prioridade" text DEFAULT 'normal' NOT NULL,
	"prazo" date,
	"situacao" text DEFAULT 'a_fazer' NOT NULL,
	"lado" text,
	"concluida_por" uuid,
	"concluida_em" timestamp with time zone,
	"automatica" boolean DEFAULT false NOT NULL,
	"lembretes_enviados" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tarefa_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tarefa_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"feito" boolean DEFAULT false NOT NULL,
	"ordem" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tarefa_responsavel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"usuario_id" uuid,
	"perfil_id" uuid,
	CONSTRAINT "tarefa_responsavel_alvo_ck" CHECK ((usuario_id is null) <> (perfil_id is null))
);
--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "dias_lembrete_tarefa" jsonb DEFAULT '[2,0]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_etapa_id_deal_etapa_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."deal_etapa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_concluida_por_usuario_id_fk" FOREIGN KEY ("concluida_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_documento" ADD CONSTRAINT "tarefa_documento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_documento" ADD CONSTRAINT "tarefa_documento_tarefa_id_tarefa_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_documento" ADD CONSTRAINT "tarefa_documento_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_item" ADD CONSTRAINT "tarefa_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_item" ADD CONSTRAINT "tarefa_item_tarefa_id_tarefa_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" ADD CONSTRAINT "tarefa_responsavel_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" ADD CONSTRAINT "tarefa_responsavel_tarefa_id_tarefa_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" ADD CONSTRAINT "tarefa_responsavel_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" ADD CONSTRAINT "tarefa_responsavel_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefa_deal_idx" ON "tarefa" USING btree ("tenant_id","deal_id","situacao");--> statement-breakpoint
CREATE UNIQUE INDEX "tarefa_documento_uq" ON "tarefa_documento" USING btree ("tenant_id","tarefa_id","documento_id");--> statement-breakpoint
CREATE INDEX "tarefa_item_tarefa_idx" ON "tarefa_item" USING btree ("tenant_id","tarefa_id");--> statement-breakpoint
CREATE INDEX "tarefa_responsavel_tarefa_idx" ON "tarefa_responsavel" USING btree ("tenant_id","tarefa_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tarefa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tarefa_documento" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tarefa_item" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tarefa_responsavel" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "tarefa" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarefa_responsavel" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarefa_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarefa_documento" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tarefa", "tarefa_responsavel", "tarefa_item", "tarefa_documento" TO mna_app;
