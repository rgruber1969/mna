-- Permissão "Funil de compradoras" (deal × funil) nos perfis de negócio já
-- copiados para os tenants, como no conjunto padrão: Coordenador, Advogado e
-- Advisor veem e editam; Representante da empresa só vê. Só vale para o lado
-- vendedor (regra na camada de serviços).
UPDATE "perfil" SET "matriz" = "matriz" || '{"funil": ["ver", "editar"]}'::jsonb
WHERE "camada" = 'deal' AND "padrao" IN ('coordenador-deal', 'advogado', 'advisor') AND NOT ("matriz" ? 'funil');
--> statement-breakpoint
UPDATE "perfil" SET "matriz" = "matriz" || '{"funil": ["ver"]}'::jsonb
WHERE "camada" = 'deal' AND "padrao" = 'representante' AND NOT ("matriz" ? 'funil');
--> statement-breakpoint
UPDATE "matriz_usuario" mu SET "matriz" = mu."matriz" || jsonb_build_object('funil', p."matriz" -> 'funil')
FROM "perfil" p
WHERE p."id" = mu."perfil_id" AND p."matriz" ? 'funil' AND NOT (mu."matriz" ? 'funil');
