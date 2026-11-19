ALTER TABLE "deal_etapa" ADD COLUMN "etapa_padrao_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_etapa" ADD COLUMN "escala" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "etapa_padrao" ADD COLUMN "escala" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
UPDATE "etapa_padrao" SET "escala" = 20 WHERE "padrao" = 'pos-closing';--> statement-breakpoint
-- Liga as etapas dos negócios às etapas padrão de mesmo nome e copia a escala.
UPDATE "deal_etapa" de SET "etapa_padrao_id" = p.id, "escala" = p.escala
FROM "etapa_padrao" p
WHERE p.tenant_id = de.tenant_id AND p.nome = de.nome
  AND ((p.pai_id IS NULL AND de.pai_id IS NULL) OR (p.pai_id IS NOT NULL AND de.pai_id IS NOT NULL))
  AND de.etapa_padrao_id IS NULL;
