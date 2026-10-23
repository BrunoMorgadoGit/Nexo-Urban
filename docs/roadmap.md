# Roadmap — F.O.G.O.

## Etapa 2 — Fundação técnica

- [x] Monorepo npm, Angular standalone e NestJS.
- [x] PostgreSQL local por Docker Compose e infraestrutura TypeORM para migrations.
- [x] Contrato de saúde compartilhado e tokens visuais.
- [x] Skill oficial Angular local ao repositório.
- [x] Commit inicial da fundação (`5fc4593`).

## Etapa 3 — Inventário inteligente

- [x] Modelar equipamentos, tipos extensíveis, órgãos, regiões, localizações, agentes e manutenções.
- [x] Criar migration com constraints e índices.
- [x] Validar características JSONB por tipo e criar seed sintético idempotente.
- [x] Criar APIs REST para inventário, agentes, organizações, regiões, tipos e manutenções.
- [x] Integrar telas de equipamentos, agentes e manutenções com a API real.
- [x] Executar build, lint, testes unitários/E2E, migration/seed no PostgreSQL e revisar navegação desktop/mobile.

## Etapa 4 — Central de Operações

- [x] Criar snapshots REST de disponibilidade, mapa, regiões e manutenção com políticas documentadas.
- [x] Integrar MapLibre e navegação de operações, inventário e alertas.
- [x] Persistir alertas, ações e eventos; servir SSE com cursor e snapshot de recuperação.
- [x] Adicionar cenário de indisponibilidade determinístico, isolado em desenvolvimento.
- [x] Validar migrations, seed, builds, lint, testes HTTP/SSE no PostgreSQL e cenário no navegador desktop/mobile.

## Etapa 5 — Cidade Preditiva

- [x] Definir e documentar índice regional explicável, critérios de suficiência e priorização preventiva de manutenção.
- [x] Gerar histórico sintético versionado e idempotente, separado dos registros operacionais existentes.
- [x] Persistir avaliações, expor overview, regiões, tendências, prioridades e backtest sem vazamento temporal.
- [x] Integrar a tela de Inteligência Preditiva com dados reais da API, explicabilidade e origem dos registros.
- [x] Validar PostgreSQL, builds, lint, testes unitários/E2E, dependências e layout desktop/mobile.

## Etapa 6 — Próximas etapas

- [ ] Replay histórico e simulador avançado de crises.
