---
status: aceito
date: 2026-11-19
decision-makers: Ricardo Gruber
scope: plataforma
---

# Internacionalização: base de idiomas preparada desde a primeira versão, começando só com português

## Contexto e problema

A aplicação poderá ser usada em mais de um idioma (português do Brasil,
inglês e espanhol): em processos com partes estrangeiras, usuários de fora
do país precisam entender as telas e os e-mails. Hoje todos os textos estão
escritos direto no código (telas, mensagens de erro dos serviços, e-mails).
Traduzir depois exige passar por todos os arquivos, e esse custo cresce a
cada funcionalidade nova. Quando e como preparar a aplicação para vários
idiomas?

## Fatores de decisão

* Custo de adaptar depois, que cresce com o tamanho do código
* Custo e ritmo de desenvolvimento agora
* Usuários estrangeiros comuns no tipo de processo atendido
* Datas, números e moeda no formato de cada idioma
* E-mails no idioma de quem recebe
* Compatível com Next.js (componentes de servidor e de cliente)

## Alternativas consideradas

* (A) Preparar agora a base de idiomas, só com português na primeira versão
* (B) Deixar para depois
* (C) Preparar agora e já entregar inglês e espanhol na primeira versão

## Decisão

Alternativa escolhida: "(A) preparar agora, só com português", porque o
código ainda é pequeno (a adaptação custa uma etapa agora, e muito mais
depois) e porque, com a base pronta, inglês e espanhol passam a ser só
tradução de arquivos, sem mexer nas telas.

Regras:

1. **Biblioteca:** `next-intl`, que funciona em componentes de servidor e
   de cliente do Next.js.
2. **Textos fora do código:** todo texto mostrado ao usuário (telas,
   mensagens de erro, avisos, e-mails) fica em arquivos de mensagens por
   idioma (`messages/pt-BR.json` etc.), referido por chave. Código novo já
   nasce assim.
3. **Serviços devolvem códigos, não frases:** a camada de serviços devolve
   um código de erro (com parâmetros); a tela, a API e o e-mail traduzem.
   A API devolve o código e a mensagem no idioma pedido.
4. **Idioma por usuário:** preferência guardada na conta; sem preferência,
   o idioma do navegador, caindo para português. O tenant pode definir o
   idioma padrão dos seus usuários.
5. **Formatos pelo idioma:** datas, números e moeda formatados pela API
   `Intl` conforme o idioma (sem formatação escrita à mão).
6. **E-mails no idioma de quem recebe.**
7. **Conteúdo do usuário não é traduzido:** nomes de documentos, etapas,
   mensagens e cadastros ficam como foram escritos.
8. **Primeira versão:** só português. Inglês e espanhol entram quando
   houver necessidade, traduzindo os arquivos (revisados por pessoa
   fluente).
9. **Endereço sem idioma:** o idioma não entra na URL (é preferência do
   usuário), para não mudar os endereços de tenant (ADR-0011).

### Consequências

* Positiva: inglês e espanhol depois sem retrabalho nas telas.
* Positiva: textos revisáveis num só lugar (consistência de termos).
* Positiva: datas e números corretos para cada idioma.
* Negativa: uma etapa agora para mover os textos existentes.
* Negativa: um pouco mais de cuidado em cada tela (chave em vez de texto).
* Risco aceito: até haver tradução, quem escolher inglês ou espanhol vê
  português (a opção só aparece quando a tradução existir).

### Confirmação

* Teste que compara as chaves de todos os arquivos de idioma existentes
  (nenhuma chave faltando).
* Revisão: nenhum texto visível escrito direto em componente, serviço ou
  e-mail novo.
* Teste de formatação de data e número no idioma do usuário.

## Prós e contras das alternativas

### (A) Preparar agora, só português (escolhida)

* Prós: custo menor que adaptar depois; idiomas novos viram só tradução;
  sem custo de tradução agora.
* Contras: uma etapa agora; disciplina de chaves em todo código novo.

### (B) Deixar para depois

* Prós: nenhum custo agora.
* Contras: retrabalho grande depois (todas as telas, mensagens e e-mails),
  maior quanto mais o sistema crescer.

### (C) Preparar agora, já com inglês e espanhol

* Prós: aplicação pronta para estrangeiros desde a demonstração.
* Contras: cada texto novo precisa de três versões desde já; revisão por
  pessoa fluente; desenvolvimento mais lento.

## Mais informações

* Relacionados: ADR-0004 (stack), ADR-0011 (endereços), ADR-0014 (e-mail).
* Revisitar quando houver o primeiro cliente ou usuário que precise de
  outro idioma.
