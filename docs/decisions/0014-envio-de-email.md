---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Envio de e-mail: Mailpit local, Resend na demonstração, Amazon SES São Paulo em produção

## Contexto e problema

As aplicações enviam e-mails transacionais desde a primeira versão:
convites com confirmação, link mágico, recuperação de senha, avisos de
pendências e notificações. Os e-mails precisam mostrar a marca do tenant
(ADR-0010), chegar à caixa de entrada (autenticação de domínio) e não expor
dados sensíveis. A demonstração deve ter custo zero; a produção, dados
preferencialmente no Brasil, em linha com o ADR-0012. Qual serviço usar e
com quais regras?

## Fatores de decisão

* Entregabilidade (SPF, DKIM, DMARC)
* Custo zero na demonstração e baixo em produção
* Dados de produção no Brasil
* Simplicidade de configuração
* Trocar de provedor sem reescrever código
* Desenvolvimento local sem envio real
* Templates com a marca de cada tenant

## Alternativas consideradas

* (A) Resend
* (B) Amazon SES (região São Paulo)
* (C) Postmark
* (D) Brevo

## Decisão

Alternativa escolhida: **um módulo de e-mail único, com um provedor por
ambiente**:

| Ambiente | Provedor | Observação |
|---|---|---|
| Local | **Mailpit** no `docker-compose.yml` | Captura os e-mails numa página local; nada é entregue |
| Demonstração | **Resend** (franquia gratuita) | Configuração mais simples |
| Produção | **Amazon SES em São Paulo** | Dados no Brasil, menor custo, mesma conta AWS do S3 |

**Alternativa registrada:** usar **Resend também em produção**, trocando
dados no Brasil e menor custo por comodidade (~US$ 20/mês na faixa de ~50
mil e-mails; dados nos EUA, com conteúdo mínimo). Pode ser adotada por
configuração, sem mudança de código.

Regras:

1. **Módulo único de envio**, sem recursos exclusivos de provedor no
   restante do código; a troca de provedor é feita por configuração.
2. **Templates em React Email** (componentes TypeScript), recebendo nome,
   logo e cores do tenant.
3. **Remetente com a marca do tenant:** nome de exibição
   `"<Tenant> via <Produto>"`, endereço `nao-responda@<domínio>`, e
   "responder para" apontando para o contato definido pelo tenant.
4. **Domínio autenticado** com SPF, DKIM e DMARC antes de enviar a
   terceiros (inclusive na demonstração).
5. **Nenhum dado sensível no corpo** (CPF, conteúdo de documentos etc.): o
   e-mail avisa e leva ao sistema por link que exige login.
6. **Links com validade curta:** link mágico em minutos; convites conforme
   a política do projeto.
7. **Envio em segundo plano, com novas tentativas** em falhas temporárias;
   a interface não espera o envio.
8. **Auditoria do envio:** tipo de e-mail, destinatário (por ID) e
   resultado; nunca o conteúdo.
9. **Rejeições e reclamações** (bounces, spam) tratadas: endereços
   inválidos são marcados para não receber novos envios.

### Consequências

* Positiva: custo zero na demonstração; dados de produção no Brasil.
* Positiva: migração demonstração → produção apenas por configuração.
* Positiva: desenvolvimento seguro, sem e-mails reais.
* Positiva: e-mails com a marca do tenant.
* Negativa: o **domínio passa a ser pré-requisito já na demonstração** (o
  Resend só envia a terceiros com domínio verificado).
* Negativa: o SES exige pedido à AWS para sair do modo de teste antes da
  produção.
* Negativa: o envio em segundo plano depende da decisão sobre tarefas em
  segundo plano (pendente).

### Confirmação

* Nenhuma importação de SDK de provedor de e-mail fora do módulo de envio.
* Testes dos templates com o tema padrão e com um tenant fictício.
* Teste garantindo que templates não recebem campos classificados como
  sensíveis.
* Verificação de SPF, DKIM e DMARC antes de cada ambiente enviar a
  terceiros.

## Prós e contras das alternativas

### (A) Resend

* Prós: o mais simples; franquia gratuita; templates React nativos.
* Contras: dados nos EUA; mais caro que SES em volume.

### (B) Amazon SES São Paulo

* Prós: dados no Brasil; menor custo; mesma conta do S3.
* Contras: configuração mais trabalhosa; saída do modo de teste.

### (C) Postmark

* Prós: excelente entregabilidade.
* Contras: sem franquia gratuita útil; dados fora do Brasil.

### (D) Brevo

* Prós: franquia diária gratuita; também faz marketing.
* Contras: foco misto; dados fora do Brasil.

## Mais informações

* Relacionado: ADR-0005 (autenticação), ADR-0007 (dados pessoais),
  ADR-0010 (white label), ADR-0012 (padrão de provedor por ambiente).
* Pendentes: domínio definitivo; tarefas em segundo plano.
* Adendo (2026-11-17): envio por subdomínio dedicado
  (`notificacoes.rgruber.com.br` na demonstração), separado do e-mail
  corporativo, para isolar a reputação; nome do produto no remetente vem de
  configuração.
* Backlog: envio pelo domínio do próprio cliente.
