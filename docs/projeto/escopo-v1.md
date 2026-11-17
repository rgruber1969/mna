# MNA: escopo da versão 1

Matriz para decidir o que entra na versão 1. **Valor** e **esforço** são
estimativas iniciais do Claude, para revisão do responsável. A coluna
**V1?** fica em branco até a decisão.

* **Valor:** Essencial (sem isso não há produto) · Alto · Médio · Baixo
* **Esforço:** P (pequeno) · M (médio) · G (grande)

| # | Funcionalidade | Valor | Esforço | Depende de | V1? |
|---|---|---|---|---|---|
| 1 | Console RGRUBER: cadastro de tenants, administradores iniciais, retenção de auditoria | Essencial | M | 2 | |
| 2 | Autenticação: convite com confirmação, e-mail e senha, link mágico, sessão 8 h / 1 h, sessão única | Essencial | M | Envio de e-mail | |
| 3 | Login com Google e Microsoft | Médio | P | 2 | |
| 4 | 2FA (passkey ou autenticador) configurável por tenant, códigos de recuperação | Alto | M | 2 | |
| 5 | Permissões configuráveis (perfil ou usuário, menu × ações, cópia, escopo por deal) | Essencial | G | ADR de permissões | |
| 6 | White label (logos, nome, cores, fonte, contraste) | Alto | M | Armazenamento de arquivos | |
| 7 | Cadastro de empresas, papéis, pessoas e usuários | Essencial | M | 5 | |
| 8 | Deals: participantes, papéis, várias vendedoras | Essencial | M | 7 | |
| 9 | Etapas: cadastro padrão e adaptação por deal (lista e linha do tempo) | Essencial | M | 8 | |
| 10 | Etapas com subetapas, dependências e paralelismo, com manuseio gráfico | Alto | G | 9 | |
| 11 | Documentos com versões, comentários, classificação, filtros e lista de acesso por versão (data room) | Essencial | G | 8, Armazenamento | |
| 12 | Lista padrão de documentos por etapa/subetapa | Alto | M | 9, 11 | |
| 13 | Templates DOCX com preenchimento de campos | Médio | M | 12 | |
| 14 | Tela principal: KPIs e gráficos, pendências, prazos, status dos deals, últimas mensagens | Alto | M | 8, 9 | |
| 15 | Kanban de deals (funil por etapa principal) + visão em tabela + histórico do deal | Alto | M | 9 | |
| 16 | Mensageria em deal, etapa, versão de documento e tarefa (sem tempo real, imutável, anexos) + configuração de avisos do tenant | Médio | G | 11, 14 | |
| 17 | Contratos de serviço (mandato, honorários) | Médio | M | 7, 11 | |
| 18 | Valuation | Médio | G | Definição da estrutura | |
| 19 | E-book e OnePager (teaser e completo) em PDF, com versões, comentários da vendedora, liberação ao comprador e logo da vendedora no deal | Médio | G | 7, 8, 11 | |
| 20 | Auditoria de tudo + tela de consulta | Essencial | M | 2 | |
| 21 | Limpeza de auditoria com exportação PDF/XLSX | Baixo no início | M | 20 | |
| 22 | Exportação completa do deal em PDF (fim da retenção) | Baixo no início | M | 8, 11 | |
| 23 | Anonimização a pedido do titular (LGPD) | Médio | M | 7 | |
| 24 | Criptografia de campos sensíveis | Essencial | P | Gestão de chaves | |
| 25 | API REST com Swagger (cresce junto com cada funcionalidade) | Essencial | M | 5 | |
| 26 | Chaves de API geradas por administradores | Médio | P | 25 | |
| 27 | Tarefas: vários responsáveis (usuários/perfis), checklist, documentos ligados | Alto | M | 8 | |
| 28 | Tarefas automáticas por gatilhos fixos (a informar) | Médio | M | 27 | |
| 29 | Gatilhos de tarefas configuráveis pelo tenant | Baixo | G | 28 | |
| 30 | Menções (@pessoa) e marcar mensagem como tarefa | Médio | M | 16, 27 | |
| 31 | Resumos automáticos (mensagens e histórico de documento): resumo local sem IA | Médio | M | 11, 16 | |

Observações:

* Itens 21 e 22 só são necessários quando os prazos de retenção vencerem;
  podem entrar depois sem risco, desde que os dados sejam guardados
  corretamente desde o início.
* Item 18 (valuation) precisa de definição de estrutura antes de estimar
  melhor.
* Item 31: resumo local sem IA no desenvolvimento e na demonstração; na
  produção, manter ou adotar IA é decisão pendente (`pendencias.md`).
