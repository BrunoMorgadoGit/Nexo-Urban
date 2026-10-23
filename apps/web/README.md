# F.O.G.O. Web

Aplicação Angular standalone para equipamentos, agentes e manutenções. As listas e detalhes são carregados da API; o frontend não mantém registros demonstrativos locais.

Execute a partir da raiz do monorepo:

```bash
nvm use
npm run dev:web
```

Abra `http://127.0.0.1:4200`. Para a API local, use um segundo terminal com `npm run dev:api` e aplique migration/seed conforme [o README da raiz](../../README.md).

## Rotas

- `/equipments`: busca, filtros, indicadores e paginação.
- `/equipments/new`, `/equipments/:id`, `/equipments/:id/edit`.
- `/agents`, `/agents/new`, `/agents/:id`, `/agents/:id/edit`.
- `/maintenance`: fila e histórico de serviços.

Os componentes são standalone e lazy-loaded. Estado local usa Signals; formulários usam Signal Forms. O tema escuro e os tokens ficam em `src/styles.scss`.

## Verificações

```bash
npm --workspace fogo-web run build
npm --workspace fogo-web run lint
npm --workspace fogo-web run test
```
