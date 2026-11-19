CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nome_interno" text NOT NULL,
	"codinome" text NOT NULL,
	"tipo_operacao_id" uuid,
	"percentual" numeric(7, 4),
	"objeto" text DEFAULT 'empresas' NOT NULL,
	"grupo_id" uuid,
	"data_inicio" date NOT NULL,
	"previsao_fechamento" date,
	"valor_estimado" numeric(18, 2),
	"descricao" text,
	"situacao" text DEFAULT 'andamento' NOT NULL,
	"motivo_encerramento" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deal_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"papel_id" uuid NOT NULL,
	"situacao_funil" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_empresa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "participacao_deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"empresa_id" uuid,
	"lado" text,
	"perfil_id" uuid,
	"alcance" text DEFAULT 'deal' NOT NULL,
	"prazo" date,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participacao_deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipo_operacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"com_percentual" boolean DEFAULT false NOT NULL,
	"padrao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipo_operacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "papel_empresa" ADD COLUMN "lado" text;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_tipo_operacao_id_tipo_operacao_id_fk" FOREIGN KEY ("tipo_operacao_id") REFERENCES "public"."tipo_operacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_grupo_id_grupo_economico_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupo_economico"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_empresa" ADD CONSTRAINT "deal_empresa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_empresa" ADD CONSTRAINT "deal_empresa_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_empresa" ADD CONSTRAINT "deal_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_empresa" ADD CONSTRAINT "deal_empresa_papel_id_papel_empresa_id_fk" FOREIGN KEY ("papel_id") REFERENCES "public"."papel_empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD CONSTRAINT "participacao_deal_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_operacao" ADD CONSTRAINT "tipo_operacao_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_numero_uq" ON "deal" USING btree ("tenant_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_empresa_uq" ON "deal_empresa" USING btree ("tenant_id","deal_id","empresa_id","papel_id");--> statement-breakpoint
CREATE INDEX "deal_empresa_empresa_idx" ON "deal_empresa" USING btree ("tenant_id","empresa_id");--> statement-breakpoint
CREATE INDEX "participacao_deal_deal_idx" ON "participacao_deal" USING btree ("tenant_id","deal_id");--> statement-breakpoint
CREATE INDEX "participacao_deal_pessoa_idx" ON "participacao_deal" USING btree ("tenant_id","pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_operacao_nome_uq" ON "tipo_operacao" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "deal" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "deal_empresa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "participacao_deal" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tipo_operacao" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "tipo_operacao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal_empresa" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participacao_deal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tipo_operacao", "deal", "deal_empresa", "participacao_deal" TO mna_app;--> statement-breakpoint
-- Lado de cada papel padrão (vem do nome do código: "-vendedora" / "-compradora").
UPDATE "papel_empresa" SET "lado" = 'vendedor' WHERE "padrao" = 'vendedora' OR "padrao" LIKE '%-vendedora';--> statement-breakpoint
UPDATE "papel_empresa" SET "lado" = 'comprador' WHERE "padrao" = 'compradora' OR "padrao" LIKE '%-compradora';--> statement-breakpoint
-- Tipos de operação padrão para os tenants que já existem.
INSERT INTO "tipo_operacao" ("tenant_id", "nome", "com_percentual", "padrao")
SELECT t.id, v.nome, v.com_percentual, v.padrao
FROM "tenant" t
CROSS JOIN (VALUES
  ('Aquisição total', false, 'aquisicao-total'),
  ('Aquisição parcial', true, 'aquisicao-parcial'),
  ('Fusão', false, 'fusao'),
  ('Incorporação', false, 'incorporacao'),
  ('Investimento (aporte)', false, 'investimento')
) AS v(nome, com_percentual, padrao)
ON CONFLICT DO NOTHING;
