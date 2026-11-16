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
| 11 | Documentos com versões, comentários, classificação e filtros (data room) | Essencial | G | 8, Armazenamento | |
| 12 | Lista padrão de documentos por etapa/subetapa | Alto | M | 9, 11 | |
| 13 | Templates DOCX com preenchimento de campos | Médio | M | 12 | |
| 14 | Painel de pendências e status na tela principal | Alto | M | 8, 9 | |
| 15 | Kanban de tarefas | Médio | M | 14 | |
| 16 | Mensageria | Médio | G | 14 | |
| 17 | Contratos de serviço (mandato, honorários) | Médio | M | 7, 11 | |
| 18 | Valuation | Médio | G | Definição da estrutura | |
| 19 | E-book | Médio | G | Definição da estrutura | |
| 20 | Auditoria de tudo + tela de consulta | Essencial | M | 2 | |
| 21 | Limpeza de auditoria com exportação PDF/XLSX | Baixo no início | M | 20 | |
| 22 | Exportação completa do deal em PDF (fim da retenção) | Baixo no início | M | 8, 11 | |
| 23 | Anonimização a pedido do titular (LGPD) | Médio | M | 7 | |
| 24 | Criptografia de campos sensíveis | Essencial | P | Gestão de chaves | |
| 25 | API REST com Swagger (cresce junto com cada funcionalidade) | Essencial | M | 5 | |
| 26 | Chaves de API geradas por administradores | Médio | P | 25 | |

Observações:

* Itens 21 e 22 só são necessários quando os prazos de retenção vencerem;
  podem entrar depois sem risco, desde que os dados sejam guardados
  corretamente desde o início.
* Itens 18 e 19 precisam de definição de estrutura antes de estimar
  melhor.
