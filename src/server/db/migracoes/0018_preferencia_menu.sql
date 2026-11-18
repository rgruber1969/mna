CREATE TABLE "preferencia_menu" (
	"tenant_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"favoritos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recolhido" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferencia_menu" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preferencia_menu" ADD CONSTRAINT "preferencia_menu_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencia_menu" ADD CONSTRAINT "preferencia_menu_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preferencia_menu_uq" ON "preferencia_menu" USING btree ("tenant_id","usuario_id");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "preferencia_menu" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "preferencia_menu" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "preferencia_menu" TO mna_app;
