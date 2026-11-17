# MNA: escopo da versão 1

A versão 1 é a **demonstração** para escritórios de advocacia (tenant
piloto: BT). Decisão de 2026-11-17: **nenhuma funcionalidade é removida da
demonstração**; as mais caras ou ainda indefinidas aparecem **simuladas**,
sempre com aviso. Valor e esforço são estimativas do Claude, revisadas com o
responsável.

* **Valor:** Essencial (sem isso não há produto) · Alto · Médio · Baixo
* **Esforço:** P (pequeno) · M (médio) · G (grande)
* **Demonstração:**
  * **Real:** funciona de verdade (banco, regras, permissões).
  * **Simulado:** tela navegável com dados fictícios fixos e aviso visível
    "Funcionalidade em demonstração: dados simulados". Usa os mesmos
    componentes das telas reais, para ser aproveitada quando a função real
    for construída.

Resumo: **23 reais e 8 simuladas**. A ordem de tornar reais as simuladas
será definida depois da demonstração, conforme a reação do cliente.

| # | Funcionalidade | Valor | Esforço | Depende de | Demonstração |
|---|---|---|---|---|---|
| 1 | Console RGRUBER: cadastro de tenants, administradores iniciais, retenção de auditoria | Essencial | M | 2 | Real |
| 2 | Autenticação: convite com confirmação, e-mail e senha, link mágico, sessão 8 h / 1 h, sessão única | Essencial | M | Envio de e-mail | Real |
| 3 | Login com Google e Microsoft | Médio | P | 2 | Real |
| 4 | 2FA (passkey ou autenticador) configurável por tenant, códigos de recuperação | Alto | M | 2 | Real |
| 5 | Permissões configuráveis (perfil ou usuário, menu × ações, cópia, escopo por deal) | Essencial | G | ADR de permissões | Real |
| 6 | White label (logos, nome, cores, fonte, contraste) | Alto | M | Armazenamento de arquivos | Real |
| 7 | Cadastro de empresas, papéis, pessoas e usuários | Essencial | M | 5 | Real |
| 8 | Deals: participantes, papéis, várias vendedoras | Essencial | M | 7 | Real |
| 9 | Etapas: cadastro padrão e adaptação por deal (lista e linha do tempo) | Essencial | M | 8 | Real |
| 10 | Etapas com subetapas, dependências e paralelismo, com manuseio gráfico | Alto | G | 9 | Simulado |
| 11 | Documentos com versões, comentários, classificação, filtros e lista de acesso por versão (data room) | Essencial | G | 8, Armazenamento | Real |
| 12 | Lista padrão de documentos por etapa/subetapa | Alto | M | 9, 11 | Real |
| 13 | Templates DOCX com preenchimento de campos | Médio | M | 12 | Simulado |
| 14 | Tela principal: KPIs e gráficos, pendências, prazos, status dos deals, últimas mensagens | Alto | M | 8, 9 | Real |
| 15 | Kanban de deals (funil por etapa principal) + visão em tabela + histórico do deal | Alto | M | 9 | Real |
| 16 | Mensageria em deal, etapa, versão de documento e tarefa (sem tempo real, imutável, anexos) + configuração de avisos do tenant | Médio | G | 11, 14 | Real |
| 17 | Contratos de serviço (mandato, honorários) | Médio | M | 7, 11 | Real |
| 18 | Valuation | Médio | G | Definição da estrutura | Simulado |
| 19 | E-book e OnePager (teaser e completo) em PDF, com versões, comentários da vendedora, liberação ao comprador e logo da vendedora no deal | Médio | G | 7, 8, 11 | Simulado |
| 20 | Auditoria de tudo + tela de consulta | Essencial | M | 2 | Real |
| 21 | Limpeza de auditoria com exportação PDF/XLSX | Baixo no início | M | 20 | Simulado |
| 22 | Exportação completa do deal em PDF (fim da retenção) | Baixo no início | M | 8, 11 | Simulado |
| 23 | Anonimização a pedido do titular (LGPD) | Médio | M | 7 | Real |
| 24 | Criptografia de campos sensíveis | Essencial | P | Gestão de chaves | Real |
| 25 | API REST com Swagger (cresce junto com cada funcionalidade) | Essencial | M | 5 | Real |
| 26 | Chaves de API geradas por administradores | Médio | P | 25 | Real |
| 27 | Tarefas: vários responsáveis (usuários/perfis), checklist, documentos ligados | Alto | M | 8 | Real |
| 28 | Tarefas automáticas por gatilhos fixos (a informar) | Médio | M | 27 | Simulado |
| 29 | Gatilhos de tarefas configuráveis pelo tenant | Baixo | G | 28 | Simulado |
| 30 | Menções (@pessoa) e marcar mensagem como tarefa | Médio | M | 16, 27 | Real |
| 31 | Resumos automáticos (mensagens e histórico de documento): resumo local sem IA | Médio | M | 11, 16 | Real |

Como cada item simulado aparece na demonstração:

| # | Simulação |
|---|---|
| 10 | Diagrama visual das etapas do deal de exemplo, navegável, sem edição gráfica (a edição em lista é real) |
| 13 | Lista de templates e botão "gerar" que devolve um DOCX de exemplo |
| 18 | Telas com um valuation fictício completo (premissas, métodos, resultado) |
| 19 | Fluxo real de status (versões, comentários, liberação ao comprador) com PDFs de exemplo, sem geração automática |
| 21, 22 | Telas com botão de exportação que devolve PDF/XLSX de exemplo |
| 28, 29 | Tela de configuração de gatilhos com exemplos; tarefas de exemplo marcadas como "geradas automaticamente" |

Observações:

* Itens 21 e 22 só são necessários quando os prazos de retenção vencerem;
  podem entrar depois sem risco, desde que os dados sejam guardados
  corretamente desde o início.
* Item 18 (valuation) precisa de definição de estrutura antes de estimar
  melhor.
* Item 31: resumo local sem IA no desenvolvimento e na demonstração; na
  produção, manter ou adotar IA é decisão pendente (`pendencias.md`).
