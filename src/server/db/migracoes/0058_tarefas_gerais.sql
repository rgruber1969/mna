CREATE TABLE "tarefa_geral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"prioridade" text DEFAULT 'normal' NOT NULL,
	"prazo" date,
	"situacao" text DEFAULT 'a_fazer' NOT NULL,
	"responsavel_id" uuid,
	"criado_por" uuid,
	"concluida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa_geral" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarefa_geral" ADD CONSTRAINT "tarefa_geral_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_geral" ADD CONSTRAINT "tarefa_geral_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_geral" ADD CONSTRAINT "tarefa_geral_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefa_geral_idx" ON "tarefa_geral" USING btree ("tenant_id","situacao");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "tarefa_geral" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "tarefa_geral" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tarefa_geral" TO mna_app;
