---
status: aceito
date: 2026-11-17
decision-makers: Ricardo Gruber
scope: plataforma
---

# Gestão de chaves de criptografia: variável de ambiente fora da produção, AWS KMS com envelope e chave por tenant em produção

## Contexto e problema

O ADR-0007 determina criptografia por campo para dados sensíveis (ex.: CPF,
RG, dados de cônjuge, salário) e índice cego para busca. Quem obtiver a
chave lê todos esses dados; quem perder a chave perde os dados. A
demonstração usa só dados fictícios e deve ter custo zero; a produção usa
AWS em São Paulo (ADR-0012). Como guardar, proteger, trocar e eventualmente
destruir as chaves?

## Fatores de decisão

* Nenhuma pessoa com acesso direto à chave de produção
* Proteção contra perda e exclusão acidental
* Rotação sem perder dados antigos
* Exclusão definitiva de dados de um tenant, inclusive em backups
* Registro de uso das chaves
* Custo zero fora da produção e baixo em produção

## Alternativas consideradas

* (A) Chave em variável de ambiente (configuração secreta da Vercel)
* (B) AWS KMS (São Paulo) com criptografia em envelope
* (C) Cofre de segredos (Doppler, Infisical, HashiCorp Vault)

## Decisão

Alternativa escolhida: **um módulo único de criptografia, com gestão de
chaves por ambiente**:

| Ambiente | Gestão de chaves |
|---|---|
| Local | Chave fixa de desenvolvimento no `.env` (dados fictícios) |
| Demonstração | **(A)** chave versionada na configuração secreta da Vercel (dados fictícios) |
| Produção | **(B)** AWS KMS São Paulo, criptografia em envelope, **uma chave de dados por tenant** |

Motivos: em produção, a chave mestra nunca sai do KMS, ninguém a vê, a
rotação é automática, a exclusão tem período de espera e todo uso é
registrado; a chave por tenant permite destruição criptográfica. Fora da
produção, com dados fictícios, a simplicidade e o custo zero prevalecem.

Regras:

1. **Módulo único de criptografia:** o restante do código só chama
   "criptografar", "descriptografar" e "calcular índice cego"; a origem da
   chave é configuração.
2. **Etiqueta de versão** em todo dado criptografado (versão da chave),
   permitindo rotação gradual sem perder dados antigos.
3. **Chave separada para o índice cego** (HMAC); trocá-la exige recalcular
   os índices.
4. **Produção:** chave mestra no KMS com rotação automática anual; chaves de
   dados por tenant, guardadas no banco trancadas pela chave mestra; só o
   papel de execução da aplicação pode usar a chave mestra.
5. **Destruição criptográfica:** ao excluir definitivamente um tenant (após
   a retenção), sua chave de dados é destruída, tornando ilegíveis os dados
   sensíveis dele inclusive em backups.
6. **Cache curto em memória** das chaves de dados destrancadas, para não
   chamar o KMS a cada operação.
7. **Nenhuma chave ou segredo** no repositório, em logs, em mensagens de
   erro ou em conversas com o assistente.
8. **Cópia de segurança da chave da demonstração** guardada pelo
   responsável num gerenciador de senhas.
9. **Segredos gerais** (Better Auth, Resend, Inngest, R2, SES etc.) na
   configuração secreta da Vercel por ambiente e no `.env` local; nunca no
   repositório.

### Consequências

* Positiva: chave de produção inacessível a pessoas; uso auditado.
* Positiva: exclusão de tenant efetiva até nos backups.
* Positiva: rotação sem interrupção.
* Positiva: custo zero fora da produção.
* Negativa: em produção, latência e custo (baixos) de chamadas ao KMS,
  mitigados por cache.
* Negativa: na demonstração, quem administra o projeto na Vercel pode ver a
  chave (aceitável com dados fictícios).
* Negativa: migrar dados da demonstração para a produção exige
  recriptografar com as novas chaves (só se houver dados a migrar).

### Confirmação

* Nenhum acesso a variáveis de chave fora do módulo de criptografia.
* Testes: rotação lê dados com a versão antiga e grava com a nova; dado de
  um tenant não é decifrado com a chave de outro; busca por índice cego
  funciona.
* Verificação de que o repositório não contém segredos (varredura
  automatizada, a definir com os hooks).

## Prós e contras das alternativas

### (A) Variável de ambiente

* Prós: simples; custo zero.
* Contras: visível a administradores do projeto; sem rotação automática nem
  proteção contra exclusão; sem registro de uso.

### (B) AWS KMS com envelope

* Prós: chave mestra inacessível; rotação automática; período de espera na
  exclusão; registro de uso; chave por tenant; dados no Brasil.
* Contras: custo e latência baixos; dependência da AWS.

### (C) Cofre de segredos

* Prós: gestão centralizada de segredos.
* Contras: o Vault exige hospedagem própria; os demais geralmente fora do
  Brasil; não substitui o KMS para a chave mestra.

## Mais informações

* Relacionado: ADR-0007 (dados pessoais), ADR-0009 (multi-tenant),
  ADR-0012 (AWS São Paulo).
* Adendo (2026-11-18): **envelope com chave por tenant em todos os
  ambientes**, escolhido pelo responsável entre (A) o mesmo esquema da
  produção, com a chave mestra no `.env` (local) e na configuração secreta
  (demonstração), e (B) uma chave única fora da produção. Escolhida a (A):
  o código é o mesmo nos três ambientes (só muda o "cofre" da chave
  mestra), a destruição criptográfica pode ser testada desde já e não há
  migração de dados ao chegar à produção. Descartada a (B): a parte mais
  delicada (chave por tenant) só seria escrita e testada perto da
  produção. Detalhes: cada dado criptografado leva a versão da chave do
  tenant e fica amarrado ao tenant (não pode ser copiado para outro); o
  índice cego também é calculado por tenant; as chaves locais são geradas
  por script direto no `.env`, sem aparecer na tela.
