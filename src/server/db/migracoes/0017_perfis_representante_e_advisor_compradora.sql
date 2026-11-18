-- Papel (da empresa) × perfil (da pessoa), decidido em 2026-11-18: nos tenants
-- existentes, os perfis padrão "Vendedora" e "Compradora" passam a se chamar
-- "Representante da vendedora/compradora" (só se o tenant não os renomeou) e
-- entra o perfil padrão que faltava, "Advisor da compradora", sugerido ao papel
-- de mesmo nome. Tenants novos já nascem assim (perfis-padrao.ts).
UPDATE "perfil" SET "nome" = 'Representante da vendedora',
  "descricao" = 'Pessoa da empresa vendedora (ex.: sócio ou diretor): envia documentos, atualiza as próprias tarefas, comenta e aprova o e-book e acompanha as ofertas.'
WHERE "padrao" = 'vendedora' AND "nome" = 'Vendedora';
--> statement-breakpoint
UPDATE "perfil" SET "nome" = 'Representante da compradora',
  "descricao" = 'Pessoa da empresa compradora: vê e baixa os documentos liberados, atualiza as próprias tarefas e vê o e-book liberado.'
WHERE "padrao" = 'compradora' AND "nome" = 'Compradora';
--> statement-breakpoint
INSERT INTO "perfil" ("tenant_id", "camada", "nome", "descricao", "matriz", "padrao")
SELECT p."tenant_id", 'deal', 'Advisor da compradora',
  'Advisor do lado comprador: envia e baixa documentos, cuida das tarefas e vê o e-book depois que o lado vendedor o libera.',
  '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb,
  'advisor-compradora'
FROM "perfil" p
WHERE p."padrao" = 'advisor-vendedora'
  AND NOT EXISTS (SELECT 1 FROM "perfil" x WHERE x."tenant_id" = p."tenant_id" AND (x."padrao" = 'advisor-compradora' OR (x."camada" = 'deal' AND x."nome" = 'Advisor da compradora')));
--> statement-breakpoint
UPDATE "papel_empresa" pe SET "perfil_sugerido_id" = n."id"
FROM "perfil" n
WHERE pe."padrao" = 'advisor-compradora' AND n."tenant_id" = pe."tenant_id" AND n."padrao" = 'advisor-compradora';
