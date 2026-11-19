CREATE TABLE "anexo_cadastro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"empresa_id" uuid,
	"pessoa_id" uuid,
	"categoria" text NOT NULL,
	"descricao" text,
	"nome_arquivo_cifrado" text NOT NULL,
	"tipo_de_conteudo" text NOT NULL,
	"tamanho" integer NOT NULL,
	"chave" text NOT NULL,
	"situacao" text DEFAULT 'verificando' NOT NULL,
	"enviado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anexo_cadastro_alvo_ck" CHECK ((empresa_id is null) <> (pessoa_id is null))
);
--> statement-breakpoint
ALTER TABLE "anexo_cadastro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anexo_cadastro" ADD CONSTRAINT "anexo_cadastro_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexo_cadastro" ADD CONSTRAINT "anexo_cadastro_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexo_cadastro" ADD CONSTRAINT "anexo_cadastro_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexo_cadastro" ADD CONSTRAINT "anexo_cadastro_enviado_por_usuario_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexo_cadastro_empresa_idx" ON "anexo_cadastro" USING btree ("tenant_id","empresa_id");--> statement-breakpoint
CREATE INDEX "anexo_cadastro_pessoa_idx" ON "anexo_cadastro" USING btree ("tenant_id","pessoa_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "anexo_cadastro" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "anexo_cadastro" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "anexo_cadastro" TO mna_app;
