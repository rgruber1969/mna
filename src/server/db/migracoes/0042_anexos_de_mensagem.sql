CREATE TABLE "mensagem_anexo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"mensagem_id" uuid,
	"nome_arquivo" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"tipo_de_conteudo" text,
	"chave" text NOT NULL,
	"situacao" text DEFAULT 'enviando' NOT NULL,
	"enviado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensagem_anexo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mensagem_anexo" ADD CONSTRAINT "mensagem_anexo_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_anexo" ADD CONSTRAINT "mensagem_anexo_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_anexo" ADD CONSTRAINT "mensagem_anexo_mensagem_id_mensagem_id_fk" FOREIGN KEY ("mensagem_id") REFERENCES "public"."mensagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_anexo" ADD CONSTRAINT "mensagem_anexo_enviado_por_usuario_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensagem_anexo_mensagem_idx" ON "mensagem_anexo" USING btree ("tenant_id","mensagem_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "mensagem_anexo" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "mensagem_anexo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "mensagem_anexo" TO mna_app;
