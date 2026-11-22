CREATE TABLE "contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"objeto" text,
	"data_assinatura" date,
	"inicio" date,
	"fim" date,
	"exclusivo" boolean DEFAULT false NOT NULL,
	"exclusividade_ate" date,
	"honorario_fixo" numeric(18, 2),
	"periodicidade" text,
	"retainer_descontado" boolean DEFAULT false NOT NULL,
	"success_fee_percentual" numeric(7, 4),
	"success_fee_minimo" numeric(18, 2),
	"forma_pagamento" text,
	"conta_bancaria_id" uuid,
	"observacoes" text,
	"criado_por" uuid,
	"financeiro_avisado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contrato" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contrato_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"perfil_id" uuid,
	"usuario_id" uuid,
	CONSTRAINT "contrato_acesso_alvo_ck" CHECK ((perfil_id is null) <> (usuario_id is null))
);
--> statement-breakpoint
ALTER TABLE "contrato_acesso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contrato_arquivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nome_arquivo" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"tipo_de_conteudo" text,
	"chave" text NOT NULL,
	"situacao" text DEFAULT 'enviando' NOT NULL,
	"comentario" text,
	"enviado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contrato_arquivo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contrato_parte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"papel" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contrato_parte" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "empresa" ADD COLUMN "email_financeiro" text;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_conta_bancaria_id_conta_bancaria_id_fk" FOREIGN KEY ("conta_bancaria_id") REFERENCES "public"."conta_bancaria"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_acesso" ADD CONSTRAINT "contrato_acesso_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_acesso" ADD CONSTRAINT "contrato_acesso_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_acesso" ADD CONSTRAINT "contrato_acesso_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_acesso" ADD CONSTRAINT "contrato_acesso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_arquivo" ADD CONSTRAINT "contrato_arquivo_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_arquivo" ADD CONSTRAINT "contrato_arquivo_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_arquivo" ADD CONSTRAINT "contrato_arquivo_enviado_por_usuario_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_parte" ADD CONSTRAINT "contrato_parte_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_parte" ADD CONSTRAINT "contrato_parte_contrato_id_contrato_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contrato"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_parte" ADD CONSTRAINT "contrato_parte_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contrato_deal_idx" ON "contrato" USING btree ("tenant_id","deal_id");--> statement-breakpoint
CREATE INDEX "contrato_acesso_contrato_idx" ON "contrato_acesso" USING btree ("tenant_id","contrato_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contrato_arquivo_uq" ON "contrato_arquivo" USING btree ("tenant_id","contrato_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "contrato_parte_uq" ON "contrato_parte" USING btree ("tenant_id","contrato_id","empresa_id","papel");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "contrato" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "contrato_acesso" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "contrato_arquivo" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "contrato_parte" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "contrato" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contrato" TO mna_app;--> statement-breakpoint
ALTER TABLE "contrato_parte" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contrato_parte" TO mna_app;--> statement-breakpoint
ALTER TABLE "contrato_acesso" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contrato_acesso" TO mna_app;--> statement-breakpoint
ALTER TABLE "contrato_arquivo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contrato_arquivo" TO mna_app;
