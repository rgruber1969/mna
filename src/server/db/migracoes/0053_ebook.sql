CREATE TABLE "ebook_comentario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"versao_id" uuid NOT NULL,
	"autor_id" uuid,
	"texto" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ebook_comentario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ebook_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"material" text NOT NULL,
	"numero" integer NOT NULL,
	"situacao" text DEFAULT 'em_revisao' NOT NULL,
	"identidade" text DEFAULT 'tenant' NOT NULL,
	"inclui_valuation" boolean DEFAULT false NOT NULL,
	"observacoes" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"aprovado_por" uuid,
	"aprovado_em" timestamp with time zone,
	"liberado_por" uuid,
	"liberado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ebook_versao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ebook_comentario" ADD CONSTRAINT "ebook_comentario_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_comentario" ADD CONSTRAINT "ebook_comentario_versao_id_ebook_versao_id_fk" FOREIGN KEY ("versao_id") REFERENCES "public"."ebook_versao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_comentario" ADD CONSTRAINT "ebook_comentario_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_versao" ADD CONSTRAINT "ebook_versao_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_versao" ADD CONSTRAINT "ebook_versao_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_versao" ADD CONSTRAINT "ebook_versao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_versao" ADD CONSTRAINT "ebook_versao_aprovado_por_usuario_id_fk" FOREIGN KEY ("aprovado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebook_versao" ADD CONSTRAINT "ebook_versao_liberado_por_usuario_id_fk" FOREIGN KEY ("liberado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ebook_comentario_versao_idx" ON "ebook_comentario" USING btree ("tenant_id","versao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ebook_versao_numero_uq" ON "ebook_versao" USING btree ("tenant_id","deal_id","material","numero");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "ebook_comentario" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "ebook_versao" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- RLS forçado também para o dono das tabelas (como nas demais tabelas de negócio).
ALTER TABLE "ebook_versao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ebook_comentario" FORCE ROW LEVEL SECURITY;
