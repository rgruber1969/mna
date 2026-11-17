---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Armazenamento de arquivos pelo protocolo S3: MinIO local, Cloudflare R2 na demonstração, AWS S3 São Paulo em produção

## Contexto e problema

As aplicações precisam guardar arquivos: documentos confidenciais com
versões (com dados pessoais de terceiros), templates DOCX e logos de
tenants. O PostgreSQL guarda apenas os metadados. Os uploads podem ser
grandes, e as funções da Vercel aceitam no máximo ~4,5 MB por requisição.
Clientes do meio jurídico tendem a exigir dados no Brasil. A primeira versão
é de demonstração, com custo zero desejado; a produção começa com o primeiro
cliente contratante. Onde e como armazenar os arquivos?

## Fatores de decisão

* Dados de produção no Brasil (LGPD, argumento comercial)
* Acesso privado, com permissão e auditoria em cada download
* Uploads grandes sem passar pelas funções da Vercel
* Versionamento, proteção contra exclusão e regras de retenção
* Custo zero na demonstração e baixo em produção
* Trocar de provedor sem reescrever código
* Desenvolvimento 100% local

## Alternativas consideradas

* (A) Vercel Blob
* (B) AWS S3, região São Paulo (sa-east-1)
* (C) Cloudflare R2
* (D) Arquivos dentro do PostgreSQL

## Decisão

Alternativa escolhida: **acesso sempre pelo protocolo S3**, com um provedor
por ambiente:

| Ambiente | Provedor | Observação |
|---|---|---|
| Local | **MinIO** no `docker-compose.yml` | Compatível com S3, sem internet |
| Demonstração | **Cloudflare R2** (franquia gratuita) | Só dados fictícios; limite de tamanho por upload |
| Produção | **AWS S3 em São Paulo** (sa-east-1) | A partir do primeiro cliente contratante |

Motivos: o protocolo S3 único permite migrar da demonstração para a produção
trocando apenas configuração (endereço, região, chaves) e copiando os
arquivos; o R2 tem custo zero na franquia; o S3 em São Paulo mantém os dados
reais no Brasil, com controles maduros de versionamento, bloqueio de
exclusão, criptografia gerenciada, ciclo de vida e logs de acesso.

Regras, válidas para qualquer provedor:

1. **Sem recursos exclusivos de provedor** no código: só operações do
   protocolo S3, encapsuladas num módulo de armazenamento.
2. **Armazenamento privado.** Download apenas por **link temporário**
   (ex.: 5 minutos), emitido pela camada de serviços após verificar a
   permissão e registrar o evento de auditoria.
3. **Envio direto do navegador** ao armazenamento, com autorização
   temporária emitida pela aplicação; ao final, a aplicação confirma o
   upload e registra o documento ou a versão no banco.
4. **Organização por tenant:** chaves no formato
   `tenant/{tenant_id}/.../{arquivo_id}`, permitindo excluir ou exportar
   tudo de um tenant.
5. **Logos de tenant** numa área separada de leitura pública (precisam
   aparecer na tela de login); nenhum documento nessa área.
6. **Limites de tipo e tamanho** por categoria de arquivo, validados antes
   de emitir a autorização de upload e conferidos depois.
7. **Criptografia em repouso** ativada no provedor.
8. **Demonstração só com dados fictícios**; documentos reais apenas em
   produção (ADR-0007).
9. **Região do banco acompanha a dos arquivos:** em produção, Neon em São
   Paulo; na demonstração, qualquer região do plano gratuito.

### Consequências

* Positiva: custo zero na demonstração; migração para produção sem
  reescrever código.
* Positiva: dados de produção no Brasil, com controles maduros.
* Positiva: uploads grandes sem limite das funções da Vercel.
* Positiva: ambiente local completo com MinIO.
* Negativa: em produção, uma conta e um painel a mais (AWS), fora da
  Vercel.
* Negativa: tráfego de download a partir de São Paulo é mais caro que em
  regiões dos EUA (baixo no volume esperado).
* Negativa: migração da demonstração exige copiar os arquivos e atualizar a
  configuração (tarefa operacional planejada).
* Negativa: o R2 pode exigir cartão cadastrado para ativação, mesmo dentro
  da franquia.

### Confirmação

* Nenhuma importação de SDK proprietário de armazenamento fora do módulo
  de armazenamento (revisão e lint).
* Testes: download sem permissão negado; link expirado recusado; upload
  fora do limite recusado; arquivo de um tenant inacessível a outro.
* Todo download gera evento de auditoria.

## Prós e contras das alternativas

### (A) Vercel Blob

* Prós: integração mais simples; franquia gratuita.
* Contras: SDK próprio (migrar exige reescrever código); dados no Brasil
  não garantidos; controles de retenção básicos; não roda localmente.

### (B) AWS S3 São Paulo

* Prós: dados no Brasil; controles completos; padrão de mercado.
* Contras: conta e permissões AWS; custo (baixo) desde o início.

### (C) Cloudflare R2

* Prós: compatível com S3; franquia gratuita; tráfego de download sem
  custo.
* Contras: sem região no Brasil; controles de retenção parciais.

### (D) Dentro do PostgreSQL

* Prós: nenhum serviço a mais.
* Contras: banco lento e caro; backups pesados; inadequado para arquivos
  grandes.

## Mais informações

* Relacionado: ADR-0003 (banco e Docker), ADR-0007 (dados pessoais),
  ADR-0009 (multi-tenant), ADR-0010 (logos de tenant).
* Pendente: antivírus nos uploads.
