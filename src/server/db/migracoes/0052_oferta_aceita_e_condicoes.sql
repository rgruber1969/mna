CREATE TABLE "condicoes_do_negocio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"oferta_id" uuid,
	"condicoes" jsonb NOT NULL,
	"original" jsonb NOT NULL,
	"escolhida_por" uuid,
	"escolhida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oferta" ADD COLUMN "aceita_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oferta" ADD COLUMN "aceita_por" uuid;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ADD CONSTRAINT "condicoes_do_negocio_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ADD CONSTRAINT "condicoes_do_negocio_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ADD CONSTRAINT "condicoes_do_negocio_oferta_id_oferta_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."oferta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ADD CONSTRAINT "condicoes_do_negocio_escolhida_por_usuario_id_fk" FOREIGN KEY ("escolhida_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" ADD CONSTRAINT "condicoes_do_negocio_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "condicoes_do_negocio_deal_uq" ON "condicoes_do_negocio" USING btree ("tenant_id","deal_id");--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_aceita_por_usuario_id_fk" FOREIGN KEY ("aceita_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "condicoes_do_negocio" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "condicoes_do_negocio" TO mna_app;--> statement-breakpoint
ALTER TABLE "condicoes_do_negocio" FORCE ROW LEVEL SECURITY;
