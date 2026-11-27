# Guia de integração da API (v1)

Para equipes técnicas que vão ligar outro sistema à plataforma. Cobre só as
rotas que já existem; a lista completa e sempre atualizada, com todos os
campos, fica na documentação interativa (Swagger) de cada ambiente.

## 1. Endereço

Cada escritório (tenant) tem o seu endereço, e a API fica nele:

```
https://<slug>.<domínio>/api/v1
```

Exemplo no ambiente local: `http://bt.localhost:3000/api/v1`. A chave de um
escritório só funciona no endereço dele.

- **Documentação interativa (Swagger):** `https://<slug>.<domínio>/api/docs`
  (em produção, só se o ambiente a liberar).
- **Especificação OpenAPI 3.1:** `https://<slug>.<domínio>/api/openapi.json`
  (serve para gerar clientes automaticamente).
- **Status (sem autenticação):** `GET https://<slug>.<domínio>/api/status`.

## 2. Autenticação

Um administrador do escritório cria a chave em **Configurações › Chaves de
API**, escolhendo um **perfil** (o que a chave pode ver e fazer) e, se
quiser, uma data de validade. O segredo começa com `chv_` e **aparece uma
única vez**; guarde-o num cofre de segredos, nunca no código.

Envie o segredo em todas as chamadas:

```
Authorization: Bearer chv_...
```

- A chave age como um usuário de serviço: **as mesmas permissões e a mesma
  auditoria das telas**, pelo perfil escolhido. Não existe "acesso total"
  pela API.
- Revogar a chave corta o acesso na hora. O último uso aparece na lista.
- Dados sensíveis (CPF, contas bancárias) saem **mascarados**, como na tela.

## 3. Respostas e erros

Tudo em JSON. Códigos usados:

| Código | Quando | Corpo |
|---|---|---|
| 200 | Deu certo | O resultado |
| 400 | Dado inválido ou regra de negócio | `{ "erro": "<código>" }` |
| 401 | Sem chave, chave inválida, vencida ou revogada | `{ "erro": "nao_autenticado" }` |
| 403 | O perfil da chave não permite | `{ "erro": "sem_permissao" }` |
| 404 | Não existe ou a chave não vê | `{ "erro": "nao_encontrado" }` |

Por segurança, um registro que existe mas que a chave não pode ver responde
404, como se não existisse.

## 4. Listas e paginação

As listas (`/negocios`, `/empresas`, `/pessoas`, `/auditoria`...) aceitam:

| Parâmetro | Padrão | Limite |
|---|---|---|
| `pagina` | 1 | — |
| `porPagina` | 25 | 100 |
| `busca` | — | 200 caracteres |

A resposta traz os itens da página e o total, para saber quantas páginas
existem.

## 5. Datas e valores

- Datas: `AAAA-MM-DD` (ex.: `2026-12-31`); horários em ISO 8601 (UTC).
- Valores em reais nas escritas: ponto como separador decimal, sem milhar
  (ex.: `1234567.89`).

## 6. Rotas disponíveis

| Assunto | Método e caminho | O que faz |
|---|---|---|
| Negócios | `GET /negocios` | Negócios que a chave vê (filtro `situacao`) |
| | `GET /negocios/{id}` | Detalhe, com empresas e participantes visíveis |
| Documentos | `GET /negocios/{id}/documentos` | Documentos e versões do data room |
| | `GET /documentos/versoes/{id}/download` | Link temporário de download (auditado) |
| | `GET /busca/documentos?q=` | Busca por nome ou conteúdo (só o que a chave vê; `negocio=` opcional) |
| Tarefas | `GET /negocios/{id}/tarefas` | Tarefas do negócio |
| | `POST /negocios/{id}/tarefas` | Cria tarefa |
| Mensagens | `GET /negocios/{id}/conversas` | Conversas do negócio |
| | `GET /negocios/{id}/mensagens` | Mensagens de uma conversa, por canal |
| | `POST /negocios/{id}/mensagens` | Envia mensagem (imutável) |
| Resumos | `GET /resumos/mensagens` | Resumo das mensagens não lidas |
| | `GET /documentos/{id}/resumo` | Resumo do histórico de um documento |
| Cadastros | `GET /empresas`, `GET /empresas/{id}` | Empresas |
| | `GET /pessoas`, `GET /pessoas/{id}` | Pessoas (sensíveis mascarados) |
| Contratos | `GET /contratos`, `GET /contratos/{id}` | Contratos |
| | `POST /contratos` | Cria contrato (no negócio ou avulso) |
| | `GET /contratos/arquivos/{id}/download` | Link temporário do arquivo |
| Ofertas | `GET /negocios/{id}/ofertas` | Ofertas, com rateio |
| | `POST /negocios/{id}/ofertas` | Registra oferta ou contraproposta |
| | `GET /ofertas/arquivos/{id}/download` | Link temporário do arquivo |
| Pedidos de documentos | `GET /negocios/{id}/pedidos` | Pedidos, com totais por situação |
| | `POST /negocios/{id}/pedidos` | Cria pedido |
| | `GET /pedidos/{id}` | Pedido com rodadas, itens e painel |
| | `POST /pedidos/{id}/itens` | Inclui item |
| | `POST /pedidos/itens/{id}/situacao` | Muda a situação de um período do item |
| E-book e OnePager | `GET /negocios/{id}/ebook`, `POST /negocios/{id}/ebook` | Versões; nova versão |
| | `POST /ebook/{id}/comentarios`, `/aprovar`, `/liberar` | Fluxo de revisão |
| Auditoria | `GET /auditoria` | Eventos de auditoria (perfil com permissão) |
| Demonstração | `GET /templates`, `POST /templates/{codigo}/gerar`, `GET /valuations/demonstracao` | Funcionalidades simuladas |

## 7. Exemplos

Nos exemplos, `BASE` é o endereço da API e `CHAVE` o segredo.

### curl

```bash
BASE="https://bt.exemplo.com.br/api/v1"
CHAVE="chv_..."   # leia de um cofre; nunca deixe no código

# Primeira página de negócios abertos
curl -s "$BASE/negocios?situacao=abertos&porPagina=10" \
  -H "Authorization: Bearer $CHAVE"

# Busca de documentos que citam "multa"
curl -s "$BASE/busca/documentos?q=multa" -H "Authorization: Bearer $CHAVE"

# Criar uma tarefa num negócio
curl -s -X POST "$BASE/negocios/<id-do-negocio>/tarefas" \
  -H "Authorization: Bearer $CHAVE" -H "Content-Type: application/json" \
  -d '{"titulo":"Revisar minuta do SPA","prazo":"2026-12-15","prioridade":"alta"}'
```

### TypeScript (Node 20+ ou navegador do lado do servidor)

```ts
const BASE = process.env.API_BASE!; // ex.: https://bt.exemplo.com.br/api/v1
const CHAVE = process.env.API_CHAVE!; // segredo chv_...

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json", ...init.headers },
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${corpo.erro}`);
  return corpo as T;
}

// Percorre todas as páginas de empresas
async function todasAsEmpresas() {
  const todas: unknown[] = [];
  for (let pagina = 1; ; pagina++) {
    const p = await chamar<{ itens: unknown[]; total: number }>(`/empresas?pagina=${pagina}&porPagina=100`);
    todas.push(...p.itens);
    if (todas.length >= p.total || p.itens.length === 0) return todas;
  }
}

// Registra uma oferta (valores com ponto decimal)
await chamar(`/negocios/${negocioId}/ofertas`, {
  method: "POST",
  body: JSON.stringify({ compradoraId, instrumento: "loi", data: "2026-12-01", parcelaVista: "10000000.00" }),
});
```

Os nomes exatos dos campos de cada rota (obrigatórios, opcionais e formatos)
estão no Swagger; os exemplos acima mostram o formato geral.

## 8. Boas práticas

- Uma chave por sistema integrado, com o perfil mínimo necessário e data de
  validade; revogue a que não for mais usada.
- Trate 401 (renovar a chave) e 403 (pedir ajuste do perfil) de forma
  diferente.
- Não guarde dados pessoais além do necessário; tudo o que a chave lê fica
  registrado na auditoria do escritório.
- Ainda não existem: avisos automáticos (webhooks), criação de empresas,
  pessoas e negócios pela API, e limite de chamadas por chave (estão no
  backlog).
