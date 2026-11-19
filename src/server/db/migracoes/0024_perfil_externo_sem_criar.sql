-- Questionário de negócios (N4, 2026-11-19): a descrição do perfil padrão
-- "Usuário externo" passa a dizer que ele não cria negócios (só onde o
-- tenant não alterou o texto). Tenants novos já nascem assim.
UPDATE "perfil" SET "descricao" = 'Para clientes, compradores e parceiros: vê o painel e a lista dos negócios em que participa, sem criar negócios; o que faz em cada negócio depende do perfil que recebe nele.'
WHERE "padrao" = 'usuario-externo' AND "descricao" = 'Para clientes, compradores e parceiros: vê o painel e a lista dos negócios em que participa; o que faz em cada negócio depende do perfil que recebe nele.';
