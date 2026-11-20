CREATE TABLE "mensagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"alvo_tipo" text NOT NULL,
	"alvo_id" uuid,
	"canal" text NOT NULL,
	"autor_id" uuid,
	"texto" text NOT NULL,
	"mencoes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tarefa_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensagem" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mensagem_leitura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"lida_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensagem_leitura" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "horas_resumo_mensagens" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ADD COLUMN "resumo_mensagens" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vinculo_tenant" ADD COLUMN "resumo_mensagens_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_tarefa_id_tarefa_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_leitura" ADD CONSTRAINT "mensagem_leitura_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_leitura" ADD CONSTRAINT "mensagem_leitura_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_leitura" ADD CONSTRAINT "mensagem_leitura_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensagem_conversa_idx" ON "mensagem" USING btree ("tenant_id","deal_id","alvo_tipo","alvo_id","canal","criado_em");--> statement-breakpoint
CREATE INDEX "mensagem_recentes_idx" ON "mensagem" USING btree ("tenant_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "mensagem_leitura_uq" ON "mensagem_leitura" USING btree ("tenant_id","usuario_id","chave");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "mensagem" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "mensagem_leitura" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "mensagem" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mensagem_leitura" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Mensagens imutáveis: a aplicação só inclui e liga a uma tarefa (nunca edita nem apaga).
GRANT SELECT, INSERT ON "mensagem" TO mna_app;--> statement-breakpoint
GRANT UPDATE ("tarefa_id") ON "mensagem" TO mna_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "mensagem_leitura" TO mna_app;
