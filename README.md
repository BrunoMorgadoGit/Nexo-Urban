# F.O.G.O. — Urban Intelligence Platform

Central de Operações urbanas para o DSIN Challenge 2026, com inventário persistente, Mapa Vivo, alertas e eventos em tempo real. O conjunto de dados incluído é sintético e demonstrativo.

## Stack

- Node.js 22.23.3 (`.nvmrc`) e npm workspaces.
- Angular standalone, TypeScript e Signal Forms em `apps/web`.
- NestJS, REST versionada e TypeORM em `apps/api`.
- PostgreSQL 18.6 no Docker Compose local.
- Contratos de transporte compartilhados em `packages/contracts`.
- MapLibre GL JS 6.15.0 para o Mapa Vivo.

## Preparação inicial

```bash
nvm use
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
```

`npm run setup` cria `.env` a partir de `.env.example` apenas quando necessário e instala dependências do lockfile. Revise valores locais; nunca versione `.env`. Se Node `22.23.3` não estiver instalado no NVM, instale-o antes de executar os comandos npm.

O seed pode ser executado novamente sem duplicar equipamentos, agentes, regiões, órgãos ou tipos.

## Executar

Em terminais separados:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Abra `http://127.0.0.1:4200`. A API atende em `http://127.0.0.1:3000/api/v1`; tanto a API quanto o PostgreSQL ficam vinculados ao loopback para uso demonstrativo local.

## Central de Operações e inventário

- Central com indicadores obtidos do PostgreSQL, prioridade de alertas, resumo por região e manutenção próxima.
- Mapa Vivo com camadas GeoJSON agrupadas, filtros por categoria, situação, órgão e região, seleção de recursos e indicação de posições antigas.
- Alertas persistidos, sem duplicidade simultânea; reconhecimento, observações, histórico e encerramento condicionado à normalização.
- Atualizações SSE com cursor persistido, reconexão e recarga de snapshot. O frontend mantém uma conexão por aplicação.
- Cenário determinístico de indisponibilidade para `DEMO-RAD-001`, disponível somente com API iniciada por `npm run dev:api`.
- Inteligência Preditiva com taxas normalizadas, histórico sintético versionado, fatores explicáveis, priorização de manutenção e backtest com corte temporal.

Detalhes das fórmulas, rotas, eventos, demo e tiles: [docs/monitoring.md](docs/monitoring.md).
Método, fontes, limitações e endpoints de inteligência: [docs/intelligence.md](docs/intelligence.md).

### Inventário implementado
- Equipamentos: busca, filtros por tipo, situação, órgão e bairro, paginação, detalhe, edição e desativação preservando o histórico.
- Tipos: radar, câmera, balança, veículo de fiscalização, cancela, transporte, totem, patinete, motocicleta e viatura. Cada tipo expõe campos técnicos; o backend valida cada objeto JSONB com um esquema estrito.
- Localização: endereço e ponto fixo ou base em tabela própria; posição conhecida de recursos móveis fica separada.
- Agentes: cadastro, busca, filtros, consulta, edição, disponibilidade e última posição conhecida.
- Manutenções: prioridade imediata, agenda, vencimentos, histórico e transições de serviço.
- Indicadores: resumo consultado pela interface na API.

### Endpoints REST

Todos estão sob `/api/v1`:

| Recurso | Rotas |
| --- | --- |
| Saúde | `GET /health` |
| Equipamentos | `GET, POST /equipments`; `GET, PUT, DELETE /equipments/:id`; `PATCH /equipments/:id/deactivate` |
| Tipos | `GET /equipment-types` |
| Agentes | `GET, POST /agents`; `GET, PUT /agents/:id` |
| Órgãos e regiões | `GET /organizations`; `GET /regions` |
| Inventário | `GET /inventory/summary` |
| Manutenção | `GET, POST /maintenance`; `GET /maintenance/overview`; `PATCH /maintenance/:id/status` |
| Monitoramento | Consulte [docs/monitoring.md](docs/monitoring.md) para overview, mapa, regiões, alertas e SSE |
| Inteligência | `GET /intelligence/overview`; `/regions`; `/regions/:id`; `/maintenance-priorities`; `/trends`; `/validation` |

`DELETE /equipments/:id` realiza desativação lógica; não remove o registro nem seu histórico. `GET /maintenance?overdueOnly=true` retorna serviços vencidos. A prioridade e a agenda de manutenção não alteram automaticamente a situação operacional.

## Banco, seed e testes

```bash
npm run db:up
npm run db:migrations:show
npm run db:migrate
npm run db:seed
npm run db:seed:intelligence
npm run build
npm run lint
npm test
npm run test:e2e
```

O E2E da API requer PostgreSQL em execução, migrations aplicadas e seed inicial. Os testes integrados criam registros temporários e removem somente os próprios registros ao terminar.

### Validação da Etapa 3 (23/10/2026)

- Build e lint dos contratos, Angular e NestJS; TypeScript verificado nos dois aplicativos.
- 5 testes web e 17 testes unitários da API aprovados; 10 testes E2E aprovados no PostgreSQL.
- Migration aplicada, seed idempotente e `npm audit --audit-level=high` sem vulnerabilidades.
- Fluxos de equipamento, agente e manutenção exercitados no navegador após reiniciar os serviços. A interface foi verificada em 1440 px e 390 px, sem overflow horizontal.
- O build do Angular ainda informa avisos de orçamento CSS em seis estilos de componentes; não impedem a compilação.

### Validação da Etapa 5 (23/10/2026)

- Migration preditiva aditiva aplicada ao PostgreSQL existente; nenhuma tabela ou volume foi recriado. O seed versionado `campinas-city-history-v1` foi executado duas vezes: a segunda execução inseriu zero eventos.
- O conjunto demonstrativo contém 219 eventos (157 observações de estado e 32 falhas), todos marcados como sintéticos e limitados ao período de 90 dias. A auditoria encontrou zero eventos posteriores ao instante âncora e zero eventos sintéticos fora do dataset identificado.
- Build e lint passaram; `npm test` passou com 7 testes web e 25 testes unitários da API; `npm run test:e2e` passou com 15 testes no PostgreSQL; `npm audit --audit-level=high` encontrou zero vulnerabilidades.
- A tela foi exercitada no Chrome em desktop (1440 px) e mobile (390 px). A documentação e a UI identificam a origem dos dados, o horizonte, a suficiência e as limitações; o documento não apresenta o escore como probabilidade.
- O build Angular mantém avisos não bloqueantes de orçamento CSS nos estilos de alguns componentes, incluindo dois componentes de inteligência. Não houve erro de compilação.
- O backtest usa apenas histórico anterior ao corte e compara com um baseline simples. Os resultados atuais são experimentais sobre dados sintéticos, não uma comprovação de precisão para operação real.

Para recriar apenas o histórico demonstrativo (sem apagar dados existentes), use `npm run db:seed:intelligence`. Fórmulas, pesos, critérios de suficiência, fontes e limitações estão em [docs/intelligence.md](docs/intelligence.md).

`synchronize` permanece desabilitado. Toda mudança de schema deve entrar em migration revisada. Para encerrar a API/web, use `Ctrl+C`; `npm run db:down` apenas para o container, sem remover o volume persistente.

## Estrutura

```text
apps/
  api/src/{agents,common,database,equipment,equipment-types,intelligence,inventory,locations,maintenance,organizations,regions}/
  web/src/app/{agents,core,equipment,intelligence,maintenance,shared}/
packages/contracts/
docs/
```

Decisões do domínio: [docs/inventory-domain.md](docs/inventory-domain.md). Roadmap: [docs/roadmap.md](docs/roadmap.md).
