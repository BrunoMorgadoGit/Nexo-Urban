# F.O.G.O. API

API NestJS do F.O.G.O. Use os scripts da raiz para manter os contratos e a configuração compartilhados:

```bash
nvm use
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api
```

A API REST fica em `http://127.0.0.1:<API_PORT>/api/v1`, limitada a loopback neste ambiente demonstrativo; `API_PORT` tem padrão `3000`. A API não possui autenticação de usuário. Não a exponha por reverse proxy público sem autenticação, autorização e configuração de produção verificadas.

## Módulos

- `equipment`, `equipment-types`, `agents`, `organizations`, `regions` e `locations`.
- `maintenance` e `inventory` para agenda, histórico e indicadores.
- `monitoring` para mapa, alertas persistentes, timeline e SSE; `demo-scenario` somente com desenvolvimento e opt-in explícito.
- `intelligence` para risco regional, manutenção prioritária e backtest.
- `health` para verificação da conexão com PostgreSQL.

Schema somente por migrations; `synchronize` permanece desabilitado. Consulte [a documentação do domínio](../../docs/inventory-domain.md) e [o README da raiz](../../README.md) para endpoints, seed e validações.

## Verificações

```bash
npm --workspace fogo-api run build
npm --workspace fogo-api run lint
npm --workspace fogo-api run test
npm --workspace fogo-api run test:e2e
```

Os testes E2E exigem `E2E_DATABASE_URL` e `E2E_DATABASE_NAME` apontando para um banco local dedicado cujo nome contenha `e2e` ou `test`. A identidade conectada é consultada antes da suíte. Aplique migrations e seeds apenas nesse banco; os testes alteram registros demonstrativos do próprio banco E2E.
