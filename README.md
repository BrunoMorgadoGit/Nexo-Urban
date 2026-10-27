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
- Portas locais livres: `5437` (PostgreSQL), `3000` (API, configurável por `API_PORT`) e `4200` (Angular). Banco e API são configurados por `.env`.
- Banco local de demonstração: `fogo_demo_final`, separado logicamente de `fogo` e do banco reservado aos testes E2E.
- Acesso aos tiles do OpenStreetMap para carregar o mapa; a atribuição é exibida na interface.

## Instalação limpa

Em um clone novo, copie `.env.example` para `.env`. O modelo define `POSTGRES_DB=fogo_demo_final` e deixa senha e URL vazias para não distribuir credenciais. Defina `POSTGRES_PASSWORD` e `DATABASE_URL` localmente antes de iniciar o banco; a URL deve apontar para `fogo_demo_final` no mesmo host e porta do Compose, e usar a mesma senha configurada em `POSTGRES_PASSWORD`. O Compose falha com mensagem clara se a senha estiver ausente. Restrinja o arquivo local com `chmod 600 .env`. Se `.env` já existir, preserve-o e não o substitua.

O PostgreSQL local usa `POSTGRES_USER` tanto para migrations quanto para a API. Isso simplifica a demonstração isolada; não reutilize essa configuração em implantação pública ou compartilhada. Nesse caso, crie usuário de runtime com privilégios mínimos e usuário separado para migrations.

```bash
nvm use
node --version
cp .env.example .env
npm ci
npm run db:up
# Antes de qualquer migration ou seed, valide o destino conforme docs/demo-database.md.
npm run db:migrate
npm run db:seed
npm run db:seed:intelligence
```

Se o volume local já existia quando estava configurado para `fogo`, mudar `POSTGRES_DB` não cria um banco novo: siga [o procedimento seguro de `fogo_demo_final`](docs/demo-database.md) e crie o banco somente se estiver ausente, usando uma conexão administrativa local validada. Não apague nem recrie volumes. O seed base é idempotente para os cadastros demonstrativos. O gerador de inteligência é versionado e não duplica eventos quando executado novamente. Nenhum comando de preparação apaga o volume do PostgreSQL.

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

Abra <http://127.0.0.1:4200>. O frontend usa `/api/v1` para HTTP e SSE; o proxy de desenvolvimento gerado pelo `prestart` aponta para `127.0.0.1:API_PORT` a partir do `.env` ou do ambiente. A API permanece vinculada a `127.0.0.1` e o Compose publica o PostgreSQL somente no loopback. As rotas de simulação exigem ambiente de desenvolvimento e opt-in explícito. O sistema não tem autenticação de usuário: não o exponha por proxy público. Exposição pública exige autenticação e autorização implementadas e verificadas no servidor, além de configuração de produção apropriada.

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
npm run test:web:e2e
npm run test:e2e
npm audit --audit-level=high
```

`npm run test:web:e2e` executa os fluxos de navegador com respostas de API controladas e requer Chrome instalado. `npm run test:e2e` cobre a API e exige um PostgreSQL local dedicado, conforme as instruções abaixo.

Os E2E usam exclusivamente PostgreSQL local dedicado. Crie previamente um banco cujo nome contenha `_e2e` ou `_test`. Configure as variáveis apenas no seu shell:

```bash
export E2E_DATABASE_NAME=fogo_e2e
export E2E_DATABASE_URL='postgresql://<usuario>:<senha>@127.0.0.1:5437/fogo_e2e'
DATABASE_URL="$E2E_DATABASE_URL" npm run db:migrate
DATABASE_URL="$E2E_DATABASE_URL" npm run db:seed
DATABASE_URL="$E2E_DATABASE_URL" npm run db:seed:intelligence
npm run test:e2e
```

O runner rejeita URL ausente, nome incompatível, host não local e o mesmo nome de banco definido em `DATABASE_URL`; antes de iniciar os testes consulta apenas `current_database()` e `current_user`. Mission Control e os testes de inventário podem alterar o banco E2E, por isso nunca direcione essa URL a dados operacionais. Nenhum teste E2E é iniciado sem validação da identidade conectada.

Use os resultados de build, lint, testes, migrations e auditoria registrados para o checkout atual; resultados de cópias anteriores não demonstram o estado deste checkout.

## Rotas principais

Todos os endpoints abaixo usam o prefixo `/api/v1`.

| Área | Rotas |
| --- | --- |
| Inventário | `GET/POST /equipments`, `GET/PUT/DELETE /equipments/:id`, `GET/POST /agents`, `GET/PUT /agents/:id` |
| Domínio | `GET /equipment-types`, `/organizations`, `/regions`; `GET/POST /maintenance` |
| Monitoramento | `GET /monitoring/overview`, `/map`, `/regions`, `/alerts`, `/alerts/:id`; ações de alerta em `/monitoring/alerts/:id/*` |
| Eventos | `GET /monitoring/events/stream` (SSE); timeline da simulação em `GET /monitoring/demo/scenario/timeline` |
| Mission Control | `GET /monitoring/demo/scenario`; `POST /monitoring/demo/scenario/outage` e `/reset` somente com `NODE_ENV=development` e `DEMO_SCENARIO_ENABLED=true` |
| Inteligência | `GET /intelligence/overview`, `/regions`, `/regions/:id`, `/maintenance-priorities`, `/trends`, `/validation` |

Políticas operacionais e detalhes SSE: [docs/monitoring.md](docs/monitoring.md). Fórmulas, critérios de qualidade e backtest: [docs/intelligence.md](docs/intelligence.md). Decisões de arquitetura: [docs/architecture.md](docs/architecture.md).

## Uso de IA

OpenAI Codex foi usado como apoio nesta etapa para revisar o fluxo de erros, separar a apresentação das mensagens da camada de API e criar testes unitários e de navegador. O formatador preserva mensagens seguras da API e fornece alternativas por status HTTP; o componente compartilhado só apresenta a mensagem e emite o pedido de repetição, sem fazer chamadas HTTP. Rotas desconhecidas levam à página 404. O e2e web verifica esse fluxo e uma falha 503 com retry usando respostas de API controladas.

Na apresentação, a pessoa responsável pela entrega deve explicar essas decisões, os limites dos dados sintéticos e por que a API permanece restrita a loopback sem autenticação.

## Limitações conhecidas

- A demonstração não possui autenticação/autorização de usuário; API e banco ficam limitados ao loopback e não são uma implantação pública.
- Os dados da cidade e o backtest são sintéticos. Os resultados não validam desempenho em operação real; há poucas regiões e baixa prevalência de eventos.
- O índice não é uma probabilidade. A validação retrospectiva usa cortes diários, eventos na janela seguinte de 24 horas e uma regra-base de falha prévia na região. A interface mostra matriz de confusão, prevalência, distribuição de classificações e ranking top-1.
- A análise manual tem histórico temporal reduzido e pode indicar dados insuficientes.
- O provedor padrão de tiles é OpenStreetMap, sujeito à disponibilidade e aos termos de uso; atribuição permanece visível.
- Mission Control grava novos eventos a cada transição real do cenário. Repetir uma ação idempotente não duplica o evento enquanto o estado não mudar. A timeline é somente leitura; não há replay visual nesta entrega.

## Checklist de avaliação

Consulte [docs/evaluation-checklist.md](docs/evaluation-checklist.md). A matriz distingue funcionalidades concluídas e limitações e informa que o texto integral do edital não está versionado neste repositório.
