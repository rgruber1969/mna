-- Perfis de negócio por função, sem lado (decidido em 2026-11-19): Advogado,
-- Advisor, Contador e Representante da empresa substituem os pares "da
-- vendedora" / "da compradora". O lado vem do papel da empresa no negócio e o
-- sigilo, da lista de acesso definida por quem cria cada registro.
-- Nos tenants existentes, o perfil do lado vendedor vira o perfil por função
-- (textos e matriz só se não foram alterados) e o do lado comprador sai, se
-- não foi alterado, com papéis e matrizes individuais apontando para o novo.
-- Perfis alterados pelo tenant ficam como estão. Tenants novos já nascem assim.
UPDATE "perfil" p SET "padrao" = 'advogado',
  "nome" = CASE WHEN p."nome" = 'Advogado da vendedora' AND NOT EXISTS (SELECT 1 FROM "perfil" x WHERE x."tenant_id" = p."tenant_id" AND x."camada" = 'deal' AND x."nome" = 'Advogado') THEN 'Advogado' ELSE p."nome" END,
  "descricao" = CASE WHEN p."nome" = 'Advogado da vendedora' THEN 'Advogado de qualquer lado: trabalha em etapas, documentos, tarefas, contratos e ofertas; comenta o e-book. Vê só o que quem criou liberou para ele.' ELSE p."descricao" END,
  "matriz" = CASE WHEN p."matriz" = '{"deal":["ver"],"etapas":["ver","editar"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"contratos":["ver","criar","editar","baixar"],"ebook":["ver","comentar"],"ofertas":["ver","criar","editar"]}'::jsonb THEN '{"deal":["ver"],"etapas":["ver","editar"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"contratos":["ver","criar","editar","baixar"],"ebook":["ver","comentar"],"ofertas":["ver","criar","editar"]}'::jsonb ELSE p."matriz" END
WHERE p."padrao" = 'advogado-vendedora';
--> statement-breakpoint
UPDATE "papel_empresa" pe SET "perfil_sugerido_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE pe."perfil_sugerido_id" = s."id" AND s."padrao" = 'advogado-compradora' AND s."nome" = 'Advogado da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'advogado';
--> statement-breakpoint
UPDATE "matriz_usuario" mu SET "perfil_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE mu."perfil_id" = s."id" AND s."padrao" = 'advogado-compradora' AND s."nome" = 'Advogado da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'advogado'
  AND NOT EXISTS (SELECT 1 FROM "matriz_usuario" y WHERE y."tenant_id" = mu."tenant_id" AND y."usuario_id" = mu."usuario_id" AND y."perfil_id" = n."id");
--> statement-breakpoint
DELETE FROM "perfil" s
WHERE s."padrao" = 'advogado-compradora' AND s."nome" = 'Advogado da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND EXISTS (SELECT 1 FROM "perfil" n WHERE n."tenant_id" = s."tenant_id" AND n."padrao" = 'advogado')
  AND NOT EXISTS (SELECT 1 FROM "perfil_usuario" u WHERE u."perfil_id" = s."id");
--> statement-breakpoint
UPDATE "perfil" p SET "padrao" = 'advisor',
  "nome" = CASE WHEN p."nome" = 'Advisor da vendedora' AND NOT EXISTS (SELECT 1 FROM "perfil" x WHERE x."tenant_id" = p."tenant_id" AND x."camada" = 'deal' AND x."nome" = 'Advisor') THEN 'Advisor' ELSE p."nome" END,
  "descricao" = CASE WHEN p."nome" = 'Advisor da vendedora' THEN 'Advisor de qualquer lado: trabalha em etapas, documentos, tarefas, contratos e ofertas; monta o e-book e o libera. Vê só o que quem criou liberou para ele.' ELSE p."descricao" END,
  "matriz" = CASE WHEN p."matriz" = '{"deal":["ver"],"etapas":["ver","editar"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"contratos":["ver","baixar"],"ebook":["ver","criar","editar","baixar","liberar"],"ofertas":["ver","criar","editar"]}'::jsonb THEN '{"deal":["ver"],"etapas":["ver","editar"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"contratos":["ver","criar","editar","baixar"],"ebook":["ver","criar","editar","baixar","liberar"],"ofertas":["ver","criar","editar"]}'::jsonb ELSE p."matriz" END
WHERE p."padrao" = 'advisor-vendedora';
--> statement-breakpoint
UPDATE "papel_empresa" pe SET "perfil_sugerido_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE pe."perfil_sugerido_id" = s."id" AND s."padrao" = 'advisor-compradora' AND s."nome" = 'Advisor da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'advisor';
--> statement-breakpoint
UPDATE "matriz_usuario" mu SET "perfil_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE mu."perfil_id" = s."id" AND s."padrao" = 'advisor-compradora' AND s."nome" = 'Advisor da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'advisor'
  AND NOT EXISTS (SELECT 1 FROM "matriz_usuario" y WHERE y."tenant_id" = mu."tenant_id" AND y."usuario_id" = mu."usuario_id" AND y."perfil_id" = n."id");
--> statement-breakpoint
DELETE FROM "perfil" s
WHERE s."padrao" = 'advisor-compradora' AND s."nome" = 'Advisor da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND EXISTS (SELECT 1 FROM "perfil" n WHERE n."tenant_id" = s."tenant_id" AND n."padrao" = 'advisor')
  AND NOT EXISTS (SELECT 1 FROM "perfil_usuario" u WHERE u."perfil_id" = s."id");
--> statement-breakpoint
UPDATE "perfil" p SET "padrao" = 'contador',
  "nome" = CASE WHEN p."nome" = 'Contador da vendedora' AND NOT EXISTS (SELECT 1 FROM "perfil" x WHERE x."tenant_id" = p."tenant_id" AND x."camada" = 'deal' AND x."nome" = 'Contador') THEN 'Contador' ELSE p."nome" END,
  "descricao" = CASE WHEN p."nome" = 'Contador da vendedora' THEN 'Contador de qualquer lado: envia e edita documentos e cuida das tarefas.' ELSE p."descricao" END,
  "matriz" = CASE WHEN p."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"]}'::jsonb THEN '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"]}'::jsonb ELSE p."matriz" END
WHERE p."padrao" = 'contador-vendedora';
--> statement-breakpoint
UPDATE "papel_empresa" pe SET "perfil_sugerido_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE pe."perfil_sugerido_id" = s."id" AND s."padrao" = 'contador-compradora' AND s."nome" = 'Contador da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'contador';
--> statement-breakpoint
UPDATE "matriz_usuario" mu SET "perfil_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE mu."perfil_id" = s."id" AND s."padrao" = 'contador-compradora' AND s."nome" = 'Contador da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'contador'
  AND NOT EXISTS (SELECT 1 FROM "matriz_usuario" y WHERE y."tenant_id" = mu."tenant_id" AND y."usuario_id" = mu."usuario_id" AND y."perfil_id" = n."id");
--> statement-breakpoint
DELETE FROM "perfil" s
WHERE s."padrao" = 'contador-compradora' AND s."nome" = 'Contador da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","editar","baixar"],"tarefas":["ver","criar","editar"],"mensagens":["ver","criar"]}'::jsonb
  AND EXISTS (SELECT 1 FROM "perfil" n WHERE n."tenant_id" = s."tenant_id" AND n."padrao" = 'contador')
  AND NOT EXISTS (SELECT 1 FROM "perfil_usuario" u WHERE u."perfil_id" = s."id");
--> statement-breakpoint
UPDATE "perfil" p SET "padrao" = 'representante',
  "nome" = CASE WHEN p."nome" = 'Representante da vendedora' AND NOT EXISTS (SELECT 1 FROM "perfil" x WHERE x."tenant_id" = p."tenant_id" AND x."camada" = 'deal' AND x."nome" = 'Representante da empresa') THEN 'Representante da empresa' ELSE p."nome" END,
  "descricao" = CASE WHEN p."nome" = 'Representante da vendedora' THEN 'Pessoa de uma empresa do negócio (vendedora, compradora, sócios, investidores): envia documentos, atualiza as próprias tarefas, comenta e aprova o e-book e acompanha contratos e ofertas a que tem acesso.' ELSE p."descricao" END,
  "matriz" = CASE WHEN p."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","editar"],"mensagens":["ver","criar"],"contratos":["ver","baixar"],"ebook":["ver","comentar","aprovar"],"ofertas":["ver"]}'::jsonb THEN '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","criar","baixar"],"tarefas":["ver","editar"],"mensagens":["ver","criar"],"contratos":["ver","baixar"],"ebook":["ver","comentar","aprovar"],"ofertas":["ver"]}'::jsonb ELSE p."matriz" END
WHERE p."padrao" = 'vendedora';
--> statement-breakpoint
UPDATE "papel_empresa" pe SET "perfil_sugerido_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE pe."perfil_sugerido_id" = s."id" AND s."padrao" = 'compradora' AND s."nome" = 'Representante da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","baixar"],"tarefas":["ver","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'representante';
--> statement-breakpoint
UPDATE "matriz_usuario" mu SET "perfil_id" = n."id"
FROM "perfil" s, "perfil" n
WHERE mu."perfil_id" = s."id" AND s."padrao" = 'compradora' AND s."nome" = 'Representante da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","baixar"],"tarefas":["ver","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND n."tenant_id" = s."tenant_id" AND n."padrao" = 'representante'
  AND NOT EXISTS (SELECT 1 FROM "matriz_usuario" y WHERE y."tenant_id" = mu."tenant_id" AND y."usuario_id" = mu."usuario_id" AND y."perfil_id" = n."id");
--> statement-breakpoint
DELETE FROM "perfil" s
WHERE s."padrao" = 'compradora' AND s."nome" = 'Representante da compradora' AND s."matriz" = '{"deal":["ver"],"etapas":["ver"],"documentos":["ver","baixar"],"tarefas":["ver","editar"],"mensagens":["ver","criar"],"ebook":["ver"]}'::jsonb
  AND EXISTS (SELECT 1 FROM "perfil" n WHERE n."tenant_id" = s."tenant_id" AND n."padrao" = 'representante')
  AND NOT EXISTS (SELECT 1 FROM "perfil_usuario" u WHERE u."perfil_id" = s."id");
