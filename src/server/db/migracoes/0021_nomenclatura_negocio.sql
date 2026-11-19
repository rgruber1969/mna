-- Nomenclatura em PT-BR, decidida em 2026-11-19: "Deal" passa a ser "Negócio"
-- nos textos. Nos tenants existentes, troca o nome e a descrição dos perfis
-- padrão só onde o tenant não os alterou. Tenants novos já nascem assim.
UPDATE "perfil" SET "descricao" = 'Para quem coordena o contratante: cria e exclui negócios, mantém os cadastros gerais (etapas padrão, catálogo de documentos, templates) e consulta a auditoria.' WHERE "descricao" = 'Para quem coordena o contratante: cria e exclui deals, mantém os cadastros gerais (etapas padrão, catálogo de documentos, templates) e consulta a auditoria.';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Para quem trabalha nos negócios no dia a dia: cria e edita negócios, valuations, empresas e pessoas; só consulta os cadastros gerais e não vê a auditoria.' WHERE "descricao" = 'Para quem trabalha nos deals no dia a dia: cria e edita deals, valuations, empresas e pessoas; só consulta os cadastros gerais e não vê a auditoria.';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Para clientes, compradores e parceiros: vê o painel e a lista dos negócios em que participa; o que faz em cada negócio depende do perfil que recebe nele.' WHERE "descricao" = 'Para clientes, compradores e parceiros: vê o painel e a lista dos deals em que participa; o que faz em cada deal depende do perfil que recebe nele.';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Conduz o negócio: edita os dados do negócio e tem acesso completo a etapas, documentos, tarefas, contratos, e-book e ofertas.' WHERE "descricao" = 'Conduz o deal: edita os dados do deal e tem acesso completo a etapas, documentos, tarefas, contratos, e-book e ofertas.';
--> statement-breakpoint
UPDATE "perfil" SET "nome" = 'Coordenador do negócio' WHERE "nome" = 'Coordenador do deal';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Só consulta: vê negócio, etapas, documentos liberados, tarefas e mensagens, sem baixar nem alterar.' WHERE "descricao" = 'Só consulta: vê deal, etapas, documentos liberados, tarefas e mensagens, sem baixar nem alterar.';
