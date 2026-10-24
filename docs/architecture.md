# Arquitetura F.O.G.O.

## Workspaces

- `apps/web`: Angular standalone, acessível e responsivo.
- `apps/api`: módulos NestJS REST versionados, validação HTTP e persistência PostgreSQL/TypeORM.
- `packages/contracts`: tipos de transporte usados por mais de um workspace; sem regras de negócio ou entidades ORM.
- `docs`: decisões do domínio e roadmap.

## Fluxo

O Angular consome REST sob `/api/v1` e eventos operacionais por SSE. Requisições e SSE usam caminhos relativos `/api/v1`; no servidor Angular local, um proxy gerado em `.angular/` aponta para `API_PORT`. A API é a autoridade para validação, regras operacionais e persistência. Nesta demonstração ela atende somente no loopback e não possui autenticação de usuários. As rotas de simulação só são registradas com `NODE_ENV=development` e `DEMO_SCENARIO_ENABLED=true`. Uma implantação pública exige autenticação e autorização no servidor e um proxy configurado deliberadamente.

## Persistência e domínio

TypeORM usa migrations explícitas e `synchronize: false`. A migration `CreateInventoryDomain` cria órgãos, regiões, tipos, equipamentos, endereços, posições conhecidas, agentes e manutenções. Campos técnicos variáveis ficam em JSONB, descritos pela API e validados por schemas Zod estritos por tipo. Equipamentos móveis guardam endereço de base separado da posição GPS conhecida. O histórico de manutenção não muda automaticamente a situação operacional do ativo.

As entidades ORM ficam no backend. Os contratos compartilhados descrevem somente payloads de transporte. Novos tipos são cadastrados sem mudança estrutural no PostgreSQL; cada novo tipo precisa de descritores e um validador de características no código.

## Ambiente local

Node `22.23.3` via `.nvmrc`, npm workspaces e Docker Compose com PostgreSQL 18.6. O banco publica apenas em loopback e mantém dados em volume nomeado. A API também atende em `127.0.0.1` e limita CORS à origem web configurada.

O teste E2E exige `E2E_DATABASE_URL` e `E2E_DATABASE_NAME` próprios, ambos destinados a um banco local cujo nome contenha `e2e` ou `test`. O runner compara o alvo com `DATABASE_URL` e consulta, sem escrita, o nome e usuário efetivos antes de iniciar Vitest. O usuário `POSTGRES_USER` do Compose também é usado localmente pela aplicação e pelas migrations; antes de qualquer implantação compartilhada, separe usuário de migração e usuário de runtime com privilégios mínimos.

Na inicialização, a API reconcilia alertas existentes percorrendo os equipamentos em série; adequado ao conjunto demonstrativo atual, não dimensionado para inventários de grande escala. As consultas do mapa limitam cada categoria a 5.000 recursos, sem paginação geográfica.
