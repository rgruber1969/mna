CREATE TABLE "deal_etapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"pai_id" uuid,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"situacao" text DEFAULT 'nao_iniciada' NOT NULL,
	"inicio_previsto" date,
	"fim_previsto" date,
	"inicio_real" date,
	"fim_real" date,
	"depende_de_id" uuid,
	"responsaveis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_etapa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "etapa_padrao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pai_id" uuid,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"padrao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "etapa_padrao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participacao_deal" ADD COLUMN "etapa_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_etapa" ADD CONSTRAINT "deal_etapa_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_etapa" ADD CONSTRAINT "deal_etapa_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_padrao" ADD CONSTRAINT "etapa_padrao_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_etapa_deal_idx" ON "deal_etapa" USING btree ("tenant_id","deal_id","pai_id","ordem");--> statement-breakpoint
CREATE INDEX "etapa_padrao_tenant_idx" ON "etapa_padrao" USING btree ("tenant_id","pai_id","ordem");--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "deal_etapa" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "isolamento_tenant" ON "etapa_padrao" AS PERMISSIVE FOR ALL TO "mna_app" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "etapa_padrao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal_etapa" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "etapa_padrao", "deal_etapa" TO mna_app;--> statement-breakpoint
-- Etapas padrão (dominio.md) para os tenants que já existem.
INSERT INTO "etapa_padrao" ("tenant_id", "nome", "ordem", "padrao")
SELECT t.id, v.nome, v.ordem, v.padrao FROM "tenant" t
CROSS JOIN (VALUES
  ('Prospecção', 1, 'prospeccao'),
  ('Negociação informal', 2, 'negociacao'),
  ('Term Sheet', 3, 'term-sheet'),
  ('Diligência', 4, 'diligencia'),
  ('QPA', 5, 'qpa'),
  ('QPA → Closing', 6, 'condicoes'),
  ('Closing', 7, 'closing'),
  ('Pós-closing', 8, 'pos-closing')
) AS v(nome, ordem, padrao)
WHERE NOT EXISTS (SELECT 1 FROM "etapa_padrao" e WHERE e.tenant_id = t.id);--> statement-breakpoint
INSERT INTO "etapa_padrao" ("tenant_id", "pai_id", "nome", "ordem", "padrao")
SELECT p.tenant_id, p.id, v.nome, v.ordem, v.padrao FROM "etapa_padrao" p
CROSS JOIN (VALUES
  ('Diligência jurídica', 1, 'diligencia-juridica'),
  ('Diligência contábil e financeira', 2, 'diligencia-contabil'),
  ('Diligência fiscal', 3, 'diligencia-fiscal'),
  ('Diligência trabalhista', 4, 'diligencia-trabalhista')
) AS v(nome, ordem, padrao)
WHERE p.padrao = 'diligencia' AND p.pai_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM "etapa_padrao" s WHERE s.pai_id = p.id);--> statement-breakpoint
-- Negócios já existentes recebem as etapas padrão (sequenciais).
INSERT INTO "deal_etapa" ("tenant_id", "deal_id", "nome", "ordem")
SELECT d.tenant_id, d.id, e.nome, e.ordem FROM "deal" d
JOIN "etapa_padrao" e ON e.tenant_id = d.tenant_id AND e.pai_id IS NULL AND e.ativa
WHERE NOT EXISTS (SELECT 1 FROM "deal_etapa" x WHERE x.deal_id = d.id);--> statement-breakpoint
INSERT INTO "deal_etapa" ("tenant_id", "deal_id", "pai_id", "nome", "ordem")
SELECT de.tenant_id, de.deal_id, de.id, s.nome, s.ordem FROM "deal_etapa" de
JOIN "etapa_padrao" p ON p.tenant_id = de.tenant_id AND p.pai_id IS NULL AND p.nome = de.nome
JOIN "etapa_padrao" s ON s.pai_id = p.id AND s.ativa
WHERE de.pai_id IS NULL AND NOT EXISTS (SELECT 1 FROM "deal_etapa" y WHERE y.pai_id = de.id);--> statement-breakpoint
UPDATE "deal_etapa" de SET "depende_de_id" = anterior.id FROM (
  SELECT id, lag(id) OVER (PARTITION BY deal_id ORDER BY ordem) AS anterior_id FROM "deal_etapa" WHERE pai_id IS NULL
) s JOIN "deal_etapa" anterior ON anterior.id = s.anterior_id
WHERE de.id = s.id AND de.depende_de_id IS NULL;
