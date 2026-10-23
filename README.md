# F.O.G.O. — Urban Intelligence Platform

Plataforma demonstrativa de inteligência urbana criada para o DSIN Challenge 2026. O F.O.G.O. conecta inventário, monitoramento operacional em tempo real e análise histórica explicável em um único fluxo de trabalho.

Todos os cadastros `DEMO-*` e o histórico da cidade demonstrativa são sintéticos. A origem aparece nas telas e nos contratos da API.

## As três partes do desafio

### 1. Inventário Inteligente

- Cadastro, consulta, edição, filtros e paginação de equipamentos e agentes.
- Tipos extensíveis e características JSONB validadas por tipo no backend.
- Localização estruturada, posição conhecida, órgãos, regiões e histórico de manutenção.
- Persistência PostgreSQL com migrations TypeORM.

### 2. Central de Operações

- Indicadores do banco, Mapa Vivo com MapLibre, recursos e agentes georreferenciados.
- Alertas persistidos, reconhecimento, observações, histórico e resolução após normalização.
- Atualizações por SSE, reconexão e recarga do snapshot REST.
- Mission Control dentro do Centro de Comando: incidente determinístico, alerta, ação do operador e timeline persistida.

### 3. Cidade Preditiva

- Índice regional explicável de priorização (24 horas) e inspeções de manutenção prioritárias (7 dias).
- Histórico sintético versionado de 90 dias, separado de registros operacionais.
- Backtest temporal e baseline simples, com prevalência, matriz de confusão, distribuição de classes e precisão top-1.
- O escore é um índice de prioridade, não uma probabilidade calibrada nem uma garantia de falha futura.

## Arquitetura e tecnologias

- Monorepo npm workspaces: `apps/web`, `apps/api` e `packages/contracts`.
- Angular 22, TypeScript, componentes standalone, Signals e Vitest.
- NestJS 12, REST `/api/v1`, DTOs validados, TypeORM e migrations.
- PostgreSQL 18.6 via Docker Compose.
- MapLibre GL JS para o mapa; SSE para atualizações operacionais.
- Node.js 22.23.3, definido em `.nvmrc`.

O frontend apresenta e envia comandos. A API valida regras e grava dados. O banco é a fonte de persistência. `synchronize` fica desativado; alterações de schema usam migrations aditivas.

## Requisitos

- Node.js 22.23.3 e npm 10.9.x. Com NVM, execute `nvm use` na raiz do repositório e confirme `node --version`.
- Docker Engine e Docker Compose plugin.
- Portas locais livres: `5437` (PostgreSQL), `3000` (API) e `4200` (Angular), ajustáveis em `.env`.
- Acesso aos tiles do OpenStreetMap para carregar o mapa; a atribuição é exibida na interface.

## Instalação limpa

Em um clone novo, revise `.env.example` e crie `.env`. Se `.env` já existir, preserve-o e não o substitua.

```bash
nvm use
node --version
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:seed:intelligence
```

O seed base é idempotente para os cadastros demonstrativos. O gerador de inteligência é versionado e não duplica eventos quando executado novamente. Nenhum comando de preparação apaga o volume do PostgreSQL.

## Executar

Em terminais separados, na raiz do repositório:

```bash
nvm use
npm run dev:api
```

```bash
nvm use
npm run dev:web
```

Abra <http://127.0.0.1:4200>. A API atende em `127.0.0.1:3000/api/v1`. O Docker Compose também publica o PostgreSQL somente no loopback. Não exponha esses serviços demonstrativos publicamente: não há autenticação de usuário nesta entrega.

Para parar a aplicação, use `Ctrl+C` nos processos Angular e NestJS. `npm run db:down` apenas para o container e preserva o volume. Não use `docker compose down -v` para o banco de desenvolvimento.

## Roteiro de demonstração

1. Abra **Central de Operações** e leia os indicadores calculados pela API.
2. Examine o Mapa Vivo e selecione um recurso.
3. No painel **Mission Control**, use **Simular mau funcionamento**.
4. Aguarde a atualização SSE; confira o estado, a disponibilidade, o alerta e a linha do tempo sem recarregar.
5. Reconheça o alerta e consulte o equipamento.
6. Abra **Inteligência Preditiva**. Explique os fatores históricos e deixe claro que o incidente atual não foi previsto retrospectivamente.
7. Volte ao Centro de Operações e use **Restaurar equipamento**. Confirme a resolução do alerta e os novos eventos na timeline.

Os eventos operacionais permanecem no banco para auditoria. Restaurar o cenário retorna o equipamento ao estado demonstrativo operacional, mas não apaga o histórico. O roteiro completo está em [docs/demo-script.md](docs/demo-script.md).

## Testes e manutenção

```bash
npm run db:migrations:show
npm run build
npm run lint
npm test
npm run test:e2e
npm audit --audit-level=high
```

Os E2E usam PostgreSQL. `npm run test:e2e` define `NODE_ENV=development` para testar os endpoints de demonstração protegidos pela própria condição de ambiente; a inicialização normal de produção não registra esses endpoints.

Na revisão final, a instalação limpa com `npm ci`, migrations, os dois seeds, build, lint, unitários e E2E foram executados em cópia temporária isolada. A auditoria npm encontrou 0 vulnerabilidades. O build Angular conclui sem erros, mas registra avisos não bloqueantes de orçamento CSS em alguns componentes; eles estão documentados no checklist de avaliação.

## Rotas principais

Todos os endpoints abaixo usam o prefixo `/api/v1`.

| Área | Rotas |
| --- | --- |
| Inventário | `GET/POST /equipments`, `GET/PUT/DELETE /equipments/:id`, `GET/POST /agents`, `GET/PUT /agents/:id` |
| Domínio | `GET /equipment-types`, `/organizations`, `/regions`; `GET/POST /maintenance` |
| Monitoramento | `GET /monitoring/overview`, `/map`, `/regions`, `/alerts`, `/alerts/:id`; ações de alerta em `/monitoring/alerts/:id/*` |
| Eventos | `GET /monitoring/events/stream` (SSE); timeline da simulação em `GET /monitoring/demo/scenario/timeline` |
| Mission Control | `GET /monitoring/demo/scenario`; `POST /monitoring/demo/scenario/outage` e `/reset` somente em desenvolvimento |
| Inteligência | `GET /intelligence/overview`, `/regions`, `/regions/:id`, `/maintenance-priorities`, `/trends`, `/validation` |

Políticas operacionais e detalhes SSE: [docs/monitoring.md](docs/monitoring.md). Fórmulas, critérios de qualidade e backtest: [docs/intelligence.md](docs/intelligence.md). Decisões de arquitetura: [docs/architecture.md](docs/architecture.md).

## Limitações conhecidas

- A demonstração não possui autenticação/autorização de usuário; API e banco ficam limitados ao loopback e não são uma implantação pública.
- Os dados da cidade e o backtest são sintéticos. Os resultados não validam desempenho em operação real; há poucas regiões e baixa prevalência de eventos.
- O índice não é uma probabilidade. A validação retrospectiva usa cortes diários, eventos na janela seguinte de 24 horas e uma regra-base de falha prévia na região. A interface mostra matriz de confusão, prevalência, distribuição de classificações e ranking top-1.
- A análise manual tem histórico temporal reduzido e pode indicar dados insuficientes.
- O provedor padrão de tiles é OpenStreetMap, sujeito à disponibilidade e aos termos de uso; atribuição permanece visível.
- Mission Control grava novos eventos a cada transição real do cenário. Repetir uma ação idempotente não duplica o evento enquanto o estado não mudar. A timeline é somente leitura; não há replay visual nesta entrega.

## Checklist de avaliação

Consulte [docs/evaluation-checklist.md](docs/evaluation-checklist.md). A matriz distingue funcionalidades concluídas e limitações e informa que o texto integral do edital não está versionado neste repositório.
