# Guia de integração da API

O guia agora fica dentro da aplicação, como introdução da página de
referência da API (Scalar), sempre igual ao código:

- **Página:** `https://<slug>.<domínio>/api/referencia` (local:
  `http://bt.localhost:3000/api/referencia`), também aberta pelo botão
  "Como usar a API" em Configurações › Chaves de API.
- **Texto do guia:** `src/server/api/guia-da-api.ts` (Markdown).
- Em produção, a página só aparece com `API_DOCS_ENABLED=true` (mesma regra do
  Swagger).
