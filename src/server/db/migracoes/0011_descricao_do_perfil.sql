ALTER TABLE "perfil" ADD COLUMN "descricao" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Descrições dos perfis padrão já copiados (tenants existentes).
UPDATE "perfil" SET "descricao" = 'Para quem coordena o contratante: cria e exclui deals, mantém os cadastros gerais (etapas padrão, catálogo de documentos, templates) e consulta a auditoria.' WHERE "padrao" = 'gestor-contratante' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Para quem trabalha nos deals no dia a dia: cria e edita deals, valuations, empresas e pessoas; só consulta os cadastros gerais e não vê a auditoria.' WHERE "padrao" = 'equipe-contratante' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Para clientes, compradores e parceiros: vê o painel e a lista dos deals em que participa; o que faz em cada deal depende do perfil que recebe nele.' WHERE "padrao" = 'usuario-externo' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Conduz o deal: edita os dados do deal e tem acesso completo a etapas, documentos, tarefas, contratos, e-book e ofertas.' WHERE "padrao" = 'coordenador-deal' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Advogado do lado vendedor: trabalha em etapas, documentos, tarefas, contratos e ofertas; comenta o e-book.' WHERE "padrao" = 'advogado-vendedora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Advisor do lado vendedor: trabalha em etapas, documentos, tarefas e ofertas; monta o e-book e o libera ao comprador.' WHERE "padrao" = 'advisor-vendedora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Contador do lado vendedor: envia e edita documentos e cuida das tarefas.' WHERE "padrao" = 'contador-vendedora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Empresa vendedora: envia documentos, atualiza as próprias tarefas, comenta e aprova o e-book e acompanha as ofertas.' WHERE "padrao" = 'vendedora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Empresa compradora: vê e baixa os documentos liberados, atualiza as próprias tarefas e vê o e-book liberado.' WHERE "padrao" = 'compradora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Advogado do lado comprador: vê, envia e baixa documentos, cuida de tarefas e vê o e-book liberado.' WHERE "padrao" = 'advogado-compradora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Contador do lado comprador: envia e edita documentos e cuida das tarefas.' WHERE "padrao" = 'contador-compradora' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Diligências (contábil, jurídica, trabalhista etc.), normalmente só na subetapa da sua diligência: documentos e tarefas.' WHERE "padrao" = 'auditor' AND "descricao" = '';
--> statement-breakpoint
UPDATE "perfil" SET "descricao" = 'Só consulta: vê deal, etapas, documentos liberados, tarefas e mensagens, sem baixar nem alterar.' WHERE "padrao" = 'somente-leitura' AND "descricao" = '';
