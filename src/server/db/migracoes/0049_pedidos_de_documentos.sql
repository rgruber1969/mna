CREATE TABLE "fonte_de_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"orgao" text NOT NULL,
	"link" text,
	"abrangencia" text NOT NULL,
	"gratuito" boolean DEFAULT true NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fonte_de_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pedido_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"compradora_id" uuid,
	"solicitante_id" uuid,
	"solicitante_pessoas" text,
	"data" date NOT NULL,
	"data_base" date,
	"periodos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amostragem" text,
	"colunas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origem_id" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido_documentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pedido_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"rodada_id" uuid NOT NULL,
	"assunto" text NOT NULL,
	"codigo" text,
	"grupo" text,
	"subgrupo" text,
	"prioridade" text,
	"descricao" text NOT NULL,
	"formato" text,
	"tipo" text DEFAULT 'documento' NOT NULL,
	"data_pedido" date NOT NULL,
	"data_entrega" date,
	"departamento" text,
	"responsavel_id" uuid,
	"observacao_solicitante" text,
	"resposta" text,
	"onde_obter" text,
	"fonte_id" uuid,
	"situacoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"situacao" text DEFAULT 'pendente' NOT NULL,
	"original" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pedido_item_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"documento_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pedido_rodada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"nome" text NOT NULL,
	"data" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido_rodada" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "prioridades_pedido" jsonb DEFAULT '["Imediata","Alta","Média","Baixa"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fonte_de_documento" ADD CONSTRAINT "fonte_de_documento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_compradora_id_empresa_id_fk" FOREIGN KEY ("compradora_id") REFERENCES "public"."empresa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_solicitante_id_empresa_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."empresa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_origem_id_pedido_documentos_id_fk" FOREIGN KEY ("origem_id") REFERENCES "public"."pedido_documentos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_documentos" ADD CONSTRAINT "pedido_documentos_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_pedido_id_pedido_documentos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_rodada_id_pedido_rodada_id_fk" FOREIGN KEY ("rodada_id") REFERENCES "public"."pedido_rodada"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_fonte_id_fonte_de_documento_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."fonte_de_documento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD CONSTRAINT "pedido_item_documento_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD CONSTRAINT "pedido_item_documento_item_id_pedido_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."pedido_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item_documento" ADD CONSTRAINT "pedido_item_documento_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_rodada" ADD CONSTRAINT "pedido_rodada_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_rodada" ADD CONSTRAINT "pedido_rodada_pedido_id_pedido_documentos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fonte_de_documento_nome_idx" ON "fonte_de_documento" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_documentos_numero_uq" ON "pedido_documentos" USING btree ("tenant_id","deal_id","numero");--> statement-breakpoint
CREATE INDEX "pedido_item_pedido_idx" ON "pedido_item" USING btree ("tenant_id","pedido_id","assunto","ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_item_documento_uq" ON "pedido_item_documento" USING btree ("tenant_id","item_id","documento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_rodada_numero_uq" ON "pedido_rodada" USING btree ("tenant_id","pedido_id","numero");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "fonte_de_documento" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "pedido_documentos" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "pedido_item" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "pedido_item_documento" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "pedido_rodada" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);