CREATE TABLE "categoria_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"padrao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categoria_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"etapa_id" uuid,
	"categoria_id" uuid,
	"titulo" text NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documento_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nome_arquivo" text NOT NULL,
	"tipo_de_conteudo" text,
	"tamanho" bigint NOT NULL,
	"chave" text NOT NULL,
	"situacao" text DEFAULT 'enviando' NOT NULL,
	"comentario" text,
	"enviado_por" uuid,
	"baixada_por_outros" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documento_versao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "versao_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"versao_id" uuid NOT NULL,
	"perfil_id" uuid,
	"usuario_id" uuid,
	CONSTRAINT "versao_acesso_alvo_ck" CHECK ((perfil_id is null) <> (usuario_id is null))
);
--> statement-breakpoint
ALTER TABLE "versao_acesso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categoria_documento" ADD CONSTRAINT "categoria_documento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_etapa_id_deal_etapa_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."deal_etapa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_categoria_id_categoria_documento_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria_documento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versao" ADD CONSTRAINT "documento_versao_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versao" ADD CONSTRAINT "documento_versao_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versao" ADD CONSTRAINT "documento_versao_enviado_por_usuario_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_acesso" ADD CONSTRAINT "versao_acesso_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_acesso" ADD CONSTRAINT "versao_acesso_versao_id_documento_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."documento_versao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_acesso" ADD CONSTRAINT "versao_acesso_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_acesso" ADD CONSTRAINT "versao_acesso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categoria_documento_nome_uq" ON "categoria_documento" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE INDEX "documento_deal_idx" ON "documento" USING btree ("tenant_id","deal_id","etapa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documento_versao_uq" ON "documento_versao" USING btree ("tenant_id","documento_id","numero");--> statement-breakpoint
CREATE INDEX "versao_acesso_versao_idx" ON "versao_acesso" USING btree ("tenant_id","versao_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "categoria_documento" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "documento" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "documento_versao" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "versao_acesso" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "categoria_documento" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documento" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documento_versao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "versao_acesso" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "categoria_documento", "documento", "documento_versao", "versao_acesso" TO mna_app;--> statement-breakpoint
-- Categorias padrão (resposta D2) para os tenants que já existem.
INSERT INTO "categoria_documento" ("tenant_id", "nome", "padrao")
SELECT t.id, v.nome, v.padrao FROM "tenant" t
CROSS JOIN (VALUES
  ('Societário', 'societario'), ('Contábil e financeiro', 'contabil'), ('Fiscal', 'fiscal'),
  ('Trabalhista', 'trabalhista'), ('Contratos comerciais', 'contratos'), ('Imobiliário', 'imobiliario'),
  ('Ambiental', 'ambiental'), ('Propriedade intelectual', 'pi'), ('Tecnologia', 'tecnologia'),
  ('Contencioso', 'contencioso'), ('Outros', 'outros')
) AS v(nome, padrao)
ON CONFLICT DO NOTHING;
