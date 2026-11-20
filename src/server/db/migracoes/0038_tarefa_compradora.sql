ALTER TABLE "tarefa" ADD COLUMN "compradora_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_compradora_id_empresa_id_fk" FOREIGN KEY ("compradora_id") REFERENCES "public"."empresa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Tarefas já criadas no lado comprador: a compradora de quem criou (sigilo entre compradoras).
UPDATE "tarefa" t SET "compradora_id" = sub.grupo
FROM (
  SELECT DISTINCT ON (t2.id) t2.id,
    CASE WHEN pe.padrao = 'compradora' THEN de.empresa_id ELSE de.atua_para_id END AS grupo
  FROM "tarefa" t2
  JOIN "pessoa" p ON p.usuario_id = t2.criado_por AND p.tenant_id = t2.tenant_id
  JOIN "participacao_deal" pd ON pd.pessoa_id = p.id AND pd.deal_id = t2.deal_id
  JOIN "deal_empresa" de ON de.deal_id = t2.deal_id AND de.empresa_id = pd.empresa_id
  JOIN "papel_empresa" pe ON pe.id = de.papel_id AND pe.lado = 'comprador'
  WHERE t2.lado = 'comprador'
) sub
WHERE sub.id = t.id AND sub.grupo IS NOT NULL;
