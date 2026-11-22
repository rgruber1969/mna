CREATE TABLE "oferta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"compradora_id" uuid NOT NULL,
	"anterior_id" uuid,
	"rodada" integer DEFAULT 1 NOT NULL,
	"data" date NOT NULL,
	"instrumento" text NOT NULL,
	"enterprise_value" numeric(18, 2),
	"equity_value" numeric(18, 2),
	"parcela_vista" numeric(18, 2),
	"parcelas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"earnout" text,
	"earnout_valor" numeric(18, 2),
	"retencao" text,
	"retencao_valor" numeric(18, 2),
	"condicoes_precedentes" text,
	"validade" date,
	"garantias_compradora" text,
	"garantias_vendedora" text,
	"correcao_parcelas" text,
	"condicoes_transicao" text,
	"exclusividade" text,
	"nao_concorrencia" text,
	"observacoes" text,
	"rateio" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"criterio_rateio" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oferta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oferta_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"oferta_id" uuid NOT NULL,
	"perfil_id" uuid,
	"usuario_id" uuid,
	CONSTRAINT "oferta_acesso_alvo_ck" CHECK ((perfil_id is null) <> (usuario_id is null))
);
--> statement-breakpoint
ALTER TABLE "oferta_acesso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oferta_arquivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"oferta_id" uuid NOT NULL,
	"nome_arquivo" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"tipo_de_conteudo" text,
	"chave" text NOT NULL,
	"situacao" text DEFAULT 'enviando' NOT NULL,
	"enviado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oferta_arquivo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "criterio_rateio" text;--> statement-breakpoint
ALTER TABLE "deal_empresa" ADD COLUMN "percentual_rateio" numeric(7, 4);--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_compradora_id_empresa_id_fk" FOREIGN KEY ("compradora_id") REFERENCES "public"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_anterior_id_oferta_id_fk" FOREIGN KEY ("anterior_id") REFERENCES "public"."oferta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_acesso" ADD CONSTRAINT "oferta_acesso_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_acesso" ADD CONSTRAINT "oferta_acesso_oferta_id_oferta_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."oferta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_acesso" ADD CONSTRAINT "oferta_acesso_perfil_id_perfil_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfil"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_acesso" ADD CONSTRAINT "oferta_acesso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_arquivo" ADD CONSTRAINT "oferta_arquivo_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_arquivo" ADD CONSTRAINT "oferta_arquivo_oferta_id_oferta_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."oferta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta_arquivo" ADD CONSTRAINT "oferta_arquivo_enviado_por_usuario_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oferta_deal_idx" ON "oferta" USING btree ("tenant_id","deal_id","compradora_id");--> statement-breakpoint
CREATE INDEX "oferta_acesso_oferta_idx" ON "oferta_acesso" USING btree ("tenant_id","oferta_id");--> statement-breakpoint
CREATE INDEX "oferta_arquivo_oferta_idx" ON "oferta_arquivo" USING btree ("tenant_id","oferta_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "oferta" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "oferta_acesso" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "oferta_arquivo" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "oferta" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "oferta" TO mna_app;--> statement-breakpoint
ALTER TABLE "oferta_acesso" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "oferta_acesso" TO mna_app;--> statement-breakpoint
ALTER TABLE "oferta_arquivo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "oferta_arquivo" TO mna_app;
