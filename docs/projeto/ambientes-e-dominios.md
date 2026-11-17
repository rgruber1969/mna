# MNA: ambientes, domínios e nome do produto

Configurações do MNA que dependem de nome e domínio. Regras gerais nos
ADRs 0011 (endereços), 0012 (arquivos) e 0014 (e-mail).

## Nome do produto

* **"MNA" é codinome interno** (pastas, repositório, código, banco). O
  usuário nunca o vê diretamente.
* **Nome comercial e logomarca do produto** vêm de configuração
  (`PRODUCT_NAME` e arquivo de logo); nunca escritos diretamente em telas,
  e-mails ou textos.
* Identidade visual do produto: a da RGRUBER (`docs/marca/rgruber/`), até
  existir logomarca própria.

## Ambientes

| | Local | Demonstração | Produção |
|---|---|---|---|
| Endereço base | `localhost:3000` | `mna.rgruber.com.br` | Domínio definitivo (pendente) |
| Console | `admin.localhost:3000` | `admin.mna.rgruber.com.br` | `admin.<domínio>` |
| Tenant | `bt.localhost:3000` | `bt.mna.rgruber.com.br` | `bt.<domínio>` |
| Banco | Postgres no Docker | Neon, qualquer região gratuita | Neon em São Paulo |
| Arquivos | MinIO no Docker | Cloudflare R2 | AWS S3 São Paulo |
| E-mail | Mailpit no Docker | Resend | Amazon SES São Paulo |
| Tarefas | Servidor local do Inngest | Inngest (franquia gratuita) | Inngest |
| Antivírus | Simulado (bloqueia EICAR) | Simulado | AWS GuardDuty (S3) |
| Dados | Fictícios | **Só fictícios** | Reais |

## Domínio e e-mail da demonstração

* DNS de `rgruber.com.br` no Registro.br (sem subdomínio coringa): cada
  tenant da demonstração exige um registro criado manualmente.
* **Remetente:** `nao-responda@notificacoes.rgruber.com.br`, com nome de
  exibição `"<Tenant> via <PRODUCT_NAME>"`. Subdomínio dedicado para separar
  a reputação do e-mail corporativo (Zoho).
* **Tarefa de configuração:** acrescentar DMARC em `rgruber.com.br`,
  começando em `p=none`.

## Pendente: nome comercial, marca e domínio definitivo

* Escolher nome comercial sem registro de marca no INPI, registrar a marca,
  criar a logomarca e registrar o domínio (DNS na Vercel, com coringa).
* **Prazo: antes da produção com usuários reais.** Passkeys ficam
  vinculadas ao domínio; trocar de domínio depois obriga todos a
  cadastrá-las de novo.
* Na troca: atualizar `PRODUCT_NAME`, logo, domínio, remetente de e-mail
  (novo SPF/DKIM) e redirecionar os endereços antigos.
