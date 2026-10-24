# Checklist de avaliação — F.O.G.O.

## Escopo da matriz

O texto integral do edital/enunciado original da DSIN não está versionado neste repositório nem foi fornecido como arquivo nesta tarefa. Para não inventar requisitos, a matriz abaixo cobre os requisitos funcionais das três partes descritos nas etapas de Inventário Inteligente, Central de Operações e Cidade Preditiva passadas pelo solicitante. Antes da submissão, compare esta matriz com o documento oficial da organização e ajuste a redação literal se necessário.

## Parte 1 — Inventário Inteligente da Cidade

| Requisito do escopo | Implementação | Tela ou endpoint | Evidência | Limitação declarada |
| --- | --- | --- | --- | --- |
| Cadastro e consulta de equipamentos urbanos | CRUD, filtros, paginação, detalhe e desativação lógica | `/equipments`; `/api/v1/equipments` | E2E de inventário e persistência PostgreSQL | Tipos e dados de demonstração são mantidos por seed versionado |
| Categorias de radares, câmeras, balanças, veículos, cancelas, transporte, totens, patinetes, motos e viaturas | Tipos cadastrados; características JSONB validadas por esquema do tipo | Formulário de equipamento; `/api/v1/equipment-types` | Testes de contrato/tipos e validação de características | Novo tipo exige descritor e esquema no backend, mas não exige coluna nova |
| Número de série único, marca/modelo, órgão e estado operacional | Campos persistidos com constraints e DTOs | Formulário/detalhe; `/api/v1/equipments` | E2E de criação, consulta e atualização | Autenticação de usuários não faz parte da aplicação demonstrativa |
| Endereço, bairro/região e coordenadas | Localização estruturada e ponto GPS; localização fixa/base separada de posição móvel | Formulário, detalhe e mapa | E2E de localização e filtros geográficos | Não há geocodificação externa |
| Agentes de trânsito, guardas e policiais | Cadastro, categoria, órgão, disponibilidade e posição conhecida | `/agents`; `/api/v1/agents` | E2E de cadastro/consulta | São usados nomes sintéticos; não se coletam dados pessoais adicionais |
| Manutenção urgente, periódica e histórico básico | Registro, agenda, estado, vencimento e histórico | `/maintenance`; `/api/v1/maintenance` | E2E de manutenção e indicadores | Não há ordem automática gerada pelo motor preditivo |

## Parte 2 — Central de Operações

| Requisito do escopo | Implementação | Tela ou endpoint | Evidência | Limitação declarada |
| --- | --- | --- | --- | --- |
| Centro de comando com disponibilidade, equipamentos, agentes, alertas e vencimentos | Indicadores calculados pela API com fórmulas documentadas | Central de Operações; `/api/v1/monitoring/overview` | E2E e navegação no navegador | Sem fonte externa de telemetria física |
| Mapa operacional de recursos e agentes | MapLibre com GeoJSON, agrupamento, filtros e detalhe real | Mapa Vivo; `/api/v1/monitoring/map` | Validação de filtros e inspeção desktop/mobile | Regiões são exibidas sem polígonos inventados; tiles dependem do provedor OSM |
| Atualização de alterações em tempo real | SSE com ID persistido, recuperação por cursor e refresh do snapshot | `/api/v1/monitoring/events/stream` | E2E de eventos SSE e cenário Mission Control | Barramento ao vivo é local ao processo; replay entre reinícios usa eventos persistidos e snapshot |
| Alertas com severidade, reconhecimento, observação e resolução | Alertas/actions persistidos, deduplicação de condição ativa e resolução após normalização | Alertas; `/api/v1/monitoring/alerts/*` | E2E de ciclo de alerta e demonstração | Sem despacho automático de agentes |
| Simular ocorrência e observar a resposta ponta a ponta | Painel Mission Control usa `DEMO-RAD-001`, altera estado persistente, gera alerta, publica SSE e mantém timeline | Central de Operações; `/api/v1/monitoring/demo/scenario/*` | E2E PostgreSQL e cenário no navegador sem recarregar | Endpoint existe somente com `NODE_ENV=development`; a timeline é somente leitura, sem replay visual |

## Parte 3 — Cidade Preditiva

| Requisito do escopo | Implementação | Tela ou endpoint | Evidência | Limitação declarada |
| --- | --- | --- | --- | --- |
| Priorizar risco regional com histórico e contexto | `risk-rules-v1`, taxas normalizadas, classificação, fatores e recomendações | Inteligência Preditiva; `/api/v1/intelligence/regions` | Testes unitários determinísticos e endpoint PostgreSQL | Índice de 0–100 é priorização, não probabilidade calibrada |
| Identificar inspeções de manutenção prioritárias | Ranking por falhas, tendência, estado, severidade e agenda | `/api/v1/intelligence/maintenance-priorities` | E2E e tela com evidências por equipamento | Não estima uma data futura de falha |
| Exibir tendências e explicar fatores | Série histórica por região, origem e qualidade explícitas | `/api/v1/intelligence/regions/:id`, `/trends` | Navegador e contrato REST | Ponto geográfico representa média de coordenadas, não limite oficial |
| Validar sem vazamento temporal e comparar baseline | Cortes diários; dados até o corte formam escore; falha nas 24 horas posteriores é o desfecho; matriz de confusão, prevalência, classes e precisão top-1 | `/api/v1/intelligence/validation` | Teste E2E e relatório exposto na UI | Amostra sintética não demonstra desempenho em operação real; regra-base é simples |
| Gerar dados históricos demonstrativos reproduzíveis | Dataset sintético identificado por chave/versão, chaves de evento únicas e seed idempotente | `npm run db:seed:intelligence` | Execução repetida e auditoria no PostgreSQL | Histórico é criado retroativamente para demonstração e vinculado ao inventário DEMO |

## Histórico de validação anterior ao hardening

Os resultados abaixo já estavam documentados antes das correções de segurança e estabilidade desta etapa. Eles descrevem uma execução anterior em ambiente temporário e não comprovam o estado atual; não foram repetidos nesta auditoria porque Docker/PostgreSQL de teste não está acessível.

| Verificação | Resultado observado |
| --- | --- |
| `npm run build` | Passou para contratos, Angular e NestJS. Angular emitiu avisos de orçamento de CSS de componentes já existentes; não houve erro de build. |
| `npm run lint` | Passou em web e API. |
| `npm test` | Passou: 7 testes web e 25 testes unitários da API. |
| `npm run test:e2e` | Passou: 16 testes em 4 arquivos, contra PostgreSQL isolado. Inclui o ciclo Mission Control, persistência, deduplicação, reconhecimento, timeline e resolução. |
| `npm run db:migrations:show` | Passou: as três migrations aparecem aplicadas no banco isolado. |
| Reexecução `npm run db:seed:intelligence` | Passou sem duplicar: `inserted: 0`; 219 eventos sintéticos preservados. |
| Integridade PostgreSQL | Passou no banco temporário: 12 equipamentos, 8 agentes, 219 eventos históricos (32 falhas), zero referências órfãs e zero eventos posteriores ao marco do dataset. |
| Persistência após reinício | Passou: a falha `DEMO-RAD-001` e sua timeline permaneceram após reiniciar a API; a restauração retornou o equipamento ao estado operacional. |
| Auditoria npm | Passou: `npm audit --audit-level=high` encontrou 0 vulnerabilidades; `npm ci` na cópia limpa também auditou 516 pacotes sem vulnerabilidades. |
| Instalação isolada | Passou em cópia temporária: `npm ci` adicionou 512 pacotes; migrations, seed base, seed sintético, build, lint, unitários, E2E e execução integrada foram validados. |
| Navegador desktop/mobile | Passou em Chromium headless com WebGL por SwiftShader, usando o frontend da instalação limpa a 1440 px e 390 px: Centro, Mapa Vivo, inventário, agentes, manutenção, alertas, inteligência e navegação mobile. O fluxo de simular/reconhecer/restaurar atualizou SSE, alerta, indicadores e timeline sem recarga. |
| Vídeo | Não produzido. Roteiro e instruções de gravação manual estão em `docs/demo-script.md`. |
| Pacote final | Criado como arquivo ZIP por `git archive`; contém somente arquivos versionados, fica abaixo de 50 MB e exclui `.env`, `.aws`, `.codex`, dependências, dados e caches. |

A revisão visual histórica usou Chromium a 1440 px no desktop e 390 px no mobile. Capturas estáticas complementam, mas não substituem, a interação observada no navegador. Esta etapa não reexecutou a validação de navegador.

O pacote do código deve excluir `.env`, `.aws`, `.codex`, `node_modules`, dados/volumes do PostgreSQL e caches. Nenhum arquivo de vídeo é incluído enquanto não houver gravação reproduzida e verificada.

## Validação do hardening em 23/10/2026

| Comando/verificação | Resultado observado nesta revisão |
| --- | --- |
| Node e npm via NVM | Node `v22.23.3`, npm `10.9.9`. |
| `npm run build` | Passou para contratos, Angular e NestJS. Angular ainda emite avisos de orçamento CSS em componentes; sem erros. |
| `npm run lint` | Passou em web e API. |
| `npm test` | Passou: 8 testes web e 41 testes unitários da API, incluindo guard E2E, port proxy, timestamps GPS, data operacional e gate das rotas demonstrativas. |
| `docker compose config --quiet` com senha placeholder | Passou sem iniciar containers. Com `POSTGRES_PASSWORD` vazio, Compose recusou a configuração com a mensagem de campo obrigatório. |
| Proxy Angular com `API_PORT=3456` | Configuração gerada em modo de inspeção apontou `/api/**` para `127.0.0.1:3456`. Não houve validação de tráfego contra uma API ativa. |
| `npm run test:e2e` sem URL dedicada | Recusado antes de iniciar Vitest: exige `E2E_DATABASE_URL`. Nenhuma escrita ou conexão ao PostgreSQL ocorreu. Foi acrescentado caso E2E de rollback quando a gravação do evento falha, ainda não executado. |
| Docker/PostgreSQL, migrations, integração e navegador | Não validados: o socket do Docker retornou `permission denied`; não foi usado `sudo` nem conectado o banco configurado no `.env`. |
| `npm audit --audit-level=high` | Não concluiu: `registry.npmjs.org` retornou `ENOTFOUND`. A auditoria de dependências permanece pendente. |
| `.env` e Git | `.env` ignorado e modo local `600`; não foi exibido nem alterado o conteúdo. `git diff --check` passou. |

Esta execução não comprova preservação ponta a ponta das funcionalidades no PostgreSQL ou navegador. Para liberar uma demonstração validada após estas correções, configure um PostgreSQL E2E separado, execute migrations/seeds nele e rode a suíte E2E pelo guard documentado no README.
