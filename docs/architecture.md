# Arquitetura inicial

## Workspaces

- `apps/web`: aplicação Angular standalone, acessível e responsiva.
- `apps/api`: API REST NestJS, validação de configuração e integração PostgreSQL por TypeORM.
- `packages/contracts`: tipos de transporte usados em mais de um workspace; não contém regras de negócio nem entidades ORM.
- `docs`: decisões, arquitetura e roadmap.

## Fluxo

O Angular consome a API REST versionada em `/api/v1`. A API valida entrada e permissões, executa casos de uso e persiste no PostgreSQL. SSE pode ser adicionado como canal de atualização em tempo real quando o primeiro caso de uso justificar. MapLibre será integrado junto às funcionalidades geoespaciais, não como dependência vazia da fundação.

## Persistência

TypeORM usa migrations explícitas e `synchronize: false`. A infraestrutura de CLI já está preparada. O schema de domínio inicial será criado após levantamento e aprovação do inventário de ativos, sem antecipar entidades não definidas.

## Ambiente local

Node `22.23.3`, npm workspaces e Docker Compose com PostgreSQL 18.6. O serviço PostgreSQL publica somente em loopback e mantém dados em volume nomeado.
