CREATE TABLE "conta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"id_no_provedor" text NOT NULL,
	"provedor" text NOT NULL,
	"token_acesso" text,
	"token_renovacao" text,
	"token_id" text,
	"token_acesso_expira_em" timestamp with time zone,
	"token_renovacao_expira_em" timestamp with time zone,
	"escopo" text,
	"senha_hash" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"administrador" boolean DEFAULT false NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"aceito_em" timestamp with time zone,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "convite" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "convite_plataforma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"aceito_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convite_plataforma_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "dois_fatores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"segredo" text NOT NULL,
	"codigos_recuperacao" text NOT NULL,
	"verificado" boolean DEFAULT true NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evento_plataforma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"ator_id" uuid,
	"alvo_tipo" text,
	"alvo_id" uuid,
	"detalhes" jsonb,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limite_tentativas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"contagem" integer NOT NULL,
	"ultima_requisicao" bigint NOT NULL,
	CONSTRAINT "limite_tentativas_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"area" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"endereco_ip" text,
	"navegador" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessao_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"imagem" text,
	"dois_fatores_ativo" boolean DEFAULT false NOT NULL,
	"papel_plataforma" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identificador" text NOT NULL,
	"valor" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculo_tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"situacao" text NOT NULL,
	"administrador" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conta" ADD CONSTRAINT "conta_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dois_fatores" ADD CONSTRAINT "dois_fatores_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ADD CONSTRAINT "vinculo_tenant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ADD CONSTRAINT "vinculo_tenant_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conta_usuario_idx" ON "conta" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "convite_tenant_idx" ON "convite" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dois_fatores_usuario_idx" ON "dois_fatores" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "dois_fatores_segredo_idx" ON "dois_fatores" USING btree ("segredo");--> statement-breakpoint
CREATE INDEX "evento_plataforma_ocorrido_idx" ON "evento_plataforma" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE INDEX "sessao_usuario_area_idx" ON "sessao" USING btree ("usuario_id","area");--> statement-breakpoint
CREATE INDEX "verificacao_identificador_idx" ON "verificacao" USING btree ("identificador");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculo_tenant_usuario_uq" ON "vinculo_tenant" USING btree ("tenant_id","usuario_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "convite" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "vinculo_tenant" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);