# F.O.G.O. API

API NestJS da Etapa 3. Use os scripts da raiz para manter os contratos e a configuração compartilhados:

```bash
nvm use
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api
```

A API REST fica em `http://127.0.0.1:3000/api/v1`, limitada a loopback neste ambiente demonstrativo. Não publique a API sem definir autenticação, autorização e configuração de produção.

## Módulos

- `equipment`, `equipment-types`, `agents`, `organizations`, `regions` e `locations`.
- `maintenance` e `inventory` para agenda, histórico e indicadores.
- `health` para verificação da conexão com PostgreSQL.

Schema somente por migrations; `synchronize` permanece desabilitado. Consulte [a documentação do domínio](../../docs/inventory-domain.md) e [o README da raiz](../../README.md) para endpoints, seed e validações.

## Verificações

```bash
npm --workspace fogo-api run build
npm --workspace fogo-api run lint
npm --workspace fogo-api run test
npm --workspace fogo-api run test:e2e
```

Os testes E2E precisam do PostgreSQL local com migrations e seed aplicados.
