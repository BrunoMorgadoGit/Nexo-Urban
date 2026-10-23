# F.O.G.O. — Urban Intelligence Platform

Fundação técnica para o DSIN Challenge 2026. Este repositório está na Etapa 2: monorepo, base Angular/NestJS, PostgreSQL local, contratos e tokens visuais. As funcionalidades do desafio serão implementadas em etapas verificáveis.

## Requisitos locais

- Node.js `22.23.3` (use `nvm use` se NVM estiver instalado) e npm `10.9.x`.
- Docker Engine com Docker Compose.

Angular 22 e o CLI NestJS 12 exigem uma versão compatível de Node. Em uma máquina sem gerenciador de versões, instale Node `22.23.3` antes de usar os comandos npm. O `.nvmrc` registra a versão escolhida.

## Preparar

```sh
nvm install
nvm use
npm run setup
```

`nvm` usa a versão registrada em `.nvmrc`; se ainda não estiver instalado, instale/ative Node.js `22.23.3` por um gerenciador de versões ou pelo pacote oficial antes de continuar. Esta estação tinha Node `22.12.0`, abaixo do mínimo, então usei uma cópia temporária oficial `22.23.3` para as validações e não alterei o Node global. A checagem `preinstall` bloqueia versões incompatíveis.

`setup` cria `.env` somente se o arquivo não existir e instala os workspaces. Revise os valores locais antes de iniciar serviços; `.env` é ignorado pelo Git.

## Executar

Em terminais separados:

```sh
npm run db:up
npm run dev:api
npm run dev:web
```

- Web: <http://127.0.0.1:4200>
- Health da API: <http://127.0.0.1:3000/api/v1/health>
- PostgreSQL: `127.0.0.1:5437` (porta ajustada para não conflitar com outro serviço local).

O health check consulta `SELECT 1`; retorna indisponibilidade segura se não conseguir conectar ao banco.

## Qualidade e persistência

```sh
npm run build
npm run lint
npm test
npm run test:e2e
npm run db:migrations:show
npm run db:migrate
```

`db:migrate` executa migrations compiladas com TypeORM. A infraestrutura está configurada, mas o primeiro schema de domínio ainda não foi criado: será definido junto ao levantamento do inventário na próxima etapa.

Depois de criar entidades e validar o modelo, gere uma migration com `npm run db:migration:generate -- src/database/migrations/NomeDaMigration` e revise o arquivo gerado antes de executá-lo.

## Workspaces

- `apps/web`: Angular standalone, TypeScript, SCSS, Vitest.
- `apps/api`: NestJS, REST versionada, TypeORM, PostgreSQL, Vitest/Supertest.
- `packages/contracts`: tipos de transporte compartilhados e enxutos.
- `docs`: arquitetura e roadmap.

Consulte [a arquitetura](docs/architecture.md), [o roadmap](docs/roadmap.md) e [as instruções locais](AGENTS.md). MapLibre, SSE e as telas do desafio serão introduzidos quando houver casos de uso definidos.
