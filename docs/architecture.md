# Arquitetura F.O.G.O.

## Workspaces

- `apps/web`: Angular standalone, acessível e responsivo.
- `apps/api`: módulos NestJS REST versionados, validação HTTP e persistência PostgreSQL/TypeORM.
- `packages/contracts`: tipos de transporte usados por mais de um workspace; sem regras de negócio ou entidades ORM.
- `docs`: decisões do domínio e roadmap.

## Fluxo

O Angular consome a API REST sob `/api/v1`. A API é a autoridade para validação, regras operacionais e persistência. Nesta demonstração ela atende somente no loopback; autenticação e autorização serão definidas quando os requisitos de acesso estiverem claros. SSE e MapLibre entram quando houver um caso de uso que os justifique.

## Persistência e domínio

TypeORM usa migrations explícitas e `synchronize: false`. A migration `CreateInventoryDomain` cria órgãos, regiões, tipos, equipamentos, endereços, posições conhecidas, agentes e manutenções. Campos técnicos variáveis ficam em JSONB, descritos pela API e validados por schemas Zod estritos por tipo. Equipamentos móveis guardam endereço de base separado da posição GPS conhecida. O histórico de manutenção não muda automaticamente a situação operacional do ativo.

As entidades ORM ficam no backend. Os contratos compartilhados descrevem somente payloads de transporte. Novos tipos são cadastrados sem mudança estrutural no PostgreSQL; cada novo tipo precisa de descritores e um validador de características no código.

## Ambiente local

Node `22.23.3` via `.nvmrc`, npm workspaces e Docker Compose com PostgreSQL 18.6. O banco publica apenas em loopback e mantém dados em volume nomeado. A API também atende em `127.0.0.1` e limita CORS à origem web configurada.
