CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cnpj" text,
	"identificador_estrangeiro" text,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"cnae" text,
	"cep" text,
	"logradouro" text,
	"numero" text,
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"uf" text,
	"pais" text DEFAULT 'Brasil' NOT NULL,
	"site" text,
	"telefone" text,
	"email" text,
	"observacoes" text,
	"grupo_id" uuid,
	"do_contratante" boolean DEFAULT false NOT NULL,
	"inativa_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "empresa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grupo_economico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grupo_economico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "papel_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"perfil_sugerido_id" uuid,
	"padrao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "papel_empresa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pessoa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"nacionalidade" text,
	"estado_civil" text,
	"profissao" text,
	"data_nascimento" date,
	"cep" text,
	"logradouro" text,
	"numero" text,
	"complemento" text,
	"bairro" text,
	"cidade" text,
	"uf" text,
	"pais" text DEFAULT 'Brasil' NOT NULL,
	"cpf_cifrado" text,
	"cpf_indice" text,
	"rg_cifrado" text,
	"rg_orgao" text,
	"rg_uf" text,
	"documento_estrangeiro_cifrado" text,
	"conjuge_nome" text,
	"conjuge_email" text,
	"conjuge_cpf_cifrado" text,
	"conjuge_rg_cifrado" text,
	"conjuge_regime_cifrado" text,
	"usuario_id" uuid,
	"inativa_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pessoa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tipo_vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"com_percentual" boolean DEFAULT false NOT NULL,
	"padrao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tipo_vinculo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vinculo_pessoa_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"cargo" text,
	"percentual" numeric(7, 4),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_grupo_id_grupo_economico_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupo_economico"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_economico" ADD CONSTRAINT "grupo_economico_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papel_empresa" ADD CONSTRAINT "papel_empresa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papel_empresa" ADD CONSTRAINT "papel_empresa_perfil_sugerido_id_perfil_id_fk" FOREIGN KEY ("perfil_sugerido_id") REFERENCES "public"."perfil"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_vinculo" ADD CONSTRAINT "tipo_vinculo_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" ADD CONSTRAINT "vinculo_pessoa_empresa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" ADD CONSTRAINT "vinculo_pessoa_empresa_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" ADD CONSTRAINT "vinculo_pessoa_empresa_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" ADD CONSTRAINT "vinculo_pessoa_empresa_tipo_id_tipo_vinculo_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipo_vinculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "empresa_cnpj_uq" ON "empresa" USING btree ("tenant_id","cnpj") WHERE cnpj is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "grupo_economico_nome_uq" ON "grupo_economico" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "papel_empresa_nome_uq" ON "papel_empresa" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_cpf_uq" ON "pessoa" USING btree ("tenant_id","cpf_indice") WHERE cpf_indice is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_email_uq" ON "pessoa" USING btree ("tenant_id","email") WHERE email is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_usuario_uq" ON "pessoa" USING btree ("tenant_id","usuario_id") WHERE usuario_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_vinculo_nome_uq" ON "tipo_vinculo" USING btree ("tenant_id","nome");--> statement-breakpoint
CREATE INDEX "vinculo_pessoa_empresa_empresa_idx" ON "vinculo_pessoa_empresa" USING btree ("tenant_id","empresa_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "empresa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "grupo_economico" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "papel_empresa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "pessoa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tipo_vinculo" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "vinculo_pessoa_empresa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- RLS vale também para o dono das tabelas (ADR-0009).
ALTER TABLE "grupo_economico" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "empresa" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "papel_empresa" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tipo_vinculo" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pessoa" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_empresa" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "grupo_economico", "empresa", "papel_empresa", "tipo_vinculo", "pessoa", "vinculo_pessoa_empresa" TO mna_app;
