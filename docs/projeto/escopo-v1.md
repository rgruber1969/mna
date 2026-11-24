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

Resumo: **24 reais, 9 simuladas e 1 parcial** (item 33); item 35 (busca) real (ADR-0022); item 23 passou para o backlog. A ordem de tornar reais as simuladas
será definida depois da demonstração, conforme a reação do cliente.

| # | Funcionalidade | Valor | Esforço | Depende de | Demonstração |
|---|---|---|---|---|---|
| 1 | Console RGRUBER: cadastro de tenants, administradores iniciais, retenção de auditoria | Essencial | M | 2 | Real |
| 2 | Autenticação: convite com confirmação, e-mail e senha, link mágico, sessão 8 h / 1 h, sessão única | Essencial | M | Envio de e-mail | Real |
| 3 | Login com Google e Microsoft | Médio | P | 2 | Simulado |
| 4 | 2FA (passkey ou autenticador) configurável por tenant, códigos de recuperação | Alto | M | 2 | Real |
| 5 | Permissões configuráveis (perfil ou usuário, menu × ações, cópia, escopo por deal) | Essencial | G | ADR de permissões | Real |
| 6 | White label (logos, nome, cores, fonte, contraste) | Alto | M | Armazenamento de arquivos | Real |
| 7 | Cadastro de empresas, papéis, pessoas e usuários | Essencial | M | 5 | Real |
| 8 | Deals: participantes, papéis, várias vendedoras | Essencial | M | 7 | Real |
| 9 | Etapas: cadastro padrão e adaptação por deal (lista e linha do tempo) | Essencial | M | 8 | Real |
| 10 | Etapas com subetapas, dependências e paralelismo, com manuseio gráfico | Alto | G | 9 | Simulado |
| 11 | Documentos com versões, comentários, classificação, filtros e lista de acesso por versão (data room) | Essencial | G | 8, Armazenamento | Real |
| 12 | Cadastro de documentos com obrigatório/opcional por deal, etapa/subetapa e valuation; lista padrão por etapa | Alto | M | 9, 11 | Real |
| 13 | Templates DOCX com preenchimento de campos | Médio | M | 12 | Simulado |
| 14 | Tela principal: KPIs e gráficos, pendências, prazos, status dos deals, últimas mensagens | Alto | M | 8, 9 | Real |
| 15 | Kanban de deals (funil por etapa principal) + visão em tabela + histórico do deal | Alto | M | 9 | Real |
| 16 | Mensageria em deal, etapa, versão de documento e tarefa (sem tempo real, imutável, anexos) + configuração de avisos do tenant | Médio | G | 11, 14 | Real |
| 17 | Contratos de serviço (mandato, honorários) | Médio | M | 7, 11 | Real |
| 18 | Valuation (com ou sem deal, criado por qualquer lado, vários por deal, visibilidade definida pelo criador): 5 métodos, ponderação, cenários, sensibilidade, tese do setor, faixa de valor mínimo–máximo, painel, versões | Alto | G | 7, 11 | Simulado |
| 19 | E-book e OnePager (teaser e completo) em PDF, com versões, comentários da vendedora, liberação ao comprador e logo da vendedora no deal | Médio | G | 7, 8, 11 | Simulado |
| 20 | Auditoria de tudo + tela de consulta | Essencial | M | 2 | Real |
| 21 | Limpeza de auditoria com exportação PDF/XLSX | Baixo no início | M | 20 | Simulado |
| 22 | Exportação completa do deal em PDF (fim da retenção) | Baixo no início | M | 8, 11 | Simulado |
| 23 | Anonimização a pedido do titular (LGPD) | Médio | M | 7 | Fora da V1 (backlog, decisão de 2026-11-20) |
| 24 | Criptografia de campos sensíveis | Essencial | P | Gestão de chaves | Real |
| 25 | API REST com Swagger (cresce junto com cada funcionalidade) | Essencial | M | 5 | Real |
| 26 | Chaves de API geradas por administradores | Médio | P | 25 | Real |
| 27 | Tarefas: vários responsáveis (usuários/perfis), checklist, documentos ligados | Alto | M | 8 | Real |
| 28 | Tarefas automáticas por gatilhos fixos (a informar) | Médio | M | 27 | Simulado |
| 29 | Gatilhos de tarefas configuráveis pelo tenant | Baixo | G | 28 | Simulado |
| 30 | Menções (@pessoa) e marcar mensagem como tarefa | Médio | M | 16, 27 | Real |
| 31 | Resumos automáticos (mensagens e histórico de documento): resumo local sem IA | Médio | M | 11, 16 | Real |
| 32 | Ofertas recebidas com estrutura de pagamento, rateio entre vendedoras e comparação com o valuation | Alto | M | 8, 18 | Real |
| 33 | Anonimização de clientes: N anonimizações por tenant, aplicadas aos deals escolhidos; clientes com códigos (C00001), variações de grafia e grupo econômico em 2 níveis (C00087.001); importação de planilha; substituição dos nomes pelos códigos nos documentos enviados, guardando original (restrito) e anonimizado | Alto (venda) | G | 7, 11 | Parcial: real em planilhas (XLSX, CSV); simulado em DOCX e PDF |
| 36 | Melhorias de design: revisão visual das telas existentes (consistência de botões, tabelas, espaçamentos, estados vazios, contraste, telas estreitas), para as telas novas já nascerem no padrão; pedido de 2026-11-20 | Alto | M | — | Real |
| 35 | Busca geral, primeira busca: **documentos** no geral ou dentro de um negócio, pelo nome (parte do título ou do arquivo) ou pelo **conteúdo** (ex.: "multa" acha todos os documentos que citam multa), sempre respeitando o que cada pessoa pode ver; pedido de 2026-11-20 | Alto | M | 11 | Real: nome e conteúdo de PDF com texto, DOCX, XLSX, CSV e TXT (ADR-0022); escaneados depois |
| 34 | Cadastro de empresas, pessoas e vínculos a partir de documento (PDF com texto: CNPJs, CPFs e quadro de sócios, sempre com conferência) e anexos de empresas e pessoas (criptografados), ADR-0021 | Alto | M | 7, 24, Armazenamento | Real |

Como cada item simulado aparece na demonstração:

| # | Simulação |
|---|---|
| 3 | Botões "Entrar com Google" e "Entrar com Microsoft" na tela de entrada, com aviso de demonstração; ao clicar, explicam que a função chega numa próxima versão (decidido em 2026-11-18) |
| 10 | Diagrama visual das etapas do deal de exemplo, navegável, sem edição gráfica (a edição em lista é real) |
| 13 | Menu Templates com NDA, Term Sheet e Procuração (negócio) e mandato e carta de honorários (contrato); "Gerar DOCX" devolve um Word de exemplo preenchido com os campos do negócio ou do contrato escolhido (construído em 2026-11-23) |
| 18 | Telas com um valuation fictício completo (premissas, métodos, ponderação, rateio entre vendedoras, painel); a comparação com ofertas reais usa esses números, com aviso |
| 19 | Fluxo real de status (versões, comentários, liberação ao comprador) com PDFs de exemplo, sem geração automática |
| 21, 22 | Telas com botão de exportação que devolve PDF/XLSX de exemplo |
| 28, 29 | Tela de configuração de gatilhos com exemplos; tarefas de exemplo marcadas como "geradas automaticamente" |
| 33 | Em DOCX e PDF: a pergunta "substituir os nomes dos clientes pelos códigos?" aparece e devolve um documento de exemplo já anonimizado (em planilhas, a substituição é real) |

Observações:

* Itens 21 e 22 só são necessários quando os prazos de retenção vencerem;
  podem entrar depois sem risco, desde que os dados sejam guardados
  corretamente desde o início.
* Item 31: resumo local sem IA no desenvolvimento e na demonstração; na
  produção, manter ou adotar IA é decisão pendente (`pendencias.md`).

## Ordem das próximas construções (combinada em 2026-11-20)

1. Busca de documentos (35).
2. Melhorias de design (36), antes das telas novas.
3. Contratos de serviço (17).
4. Ofertas recebidas (32).
5. Anexos nas mensagens e demais complementos (ZIP de documentos, resumos
   automáticos, lista de documentos obrigatórios, pedidos de documentos
   depois do recorte aprovado).
6. Telas simuladas, em lote (3, 10, 13, 18, 19, 21, 22, 28, 29) e
   anonimização de clientes (33).
7. Por último: exemplo de demonstração (o responsável testa com o próprio
   negócio de exemplo até lá).

