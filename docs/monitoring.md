# Central de Operações

## Indicadores e política de disponibilidade

Todos os números são calculados pela API a partir do PostgreSQL. A lista de status aceita pela API continua sendo a fonte comum dos contratos e filtros.

- **Total cadastrado:** todos os equipamentos, inclusive ainda não instalados e desativados.
- **Elegíveis para disponibilidade:** total menos `not_installed` e `deactivated`.
- **Operacionais:** elegíveis com status `operational`.
- **Indisponíveis:** elegíveis menos operacionais. Equipamentos furtados continuam no denominador e na contagem de indisponíveis.
- **Disponibilidade:** `operacionais / elegíveis × 100`, arredondada para uma casa decimal; denominador vazio resulta em `0%`.
- **Agentes em atividade:** agentes com disponibilidade `on_duty`.
- **Alertas críticos ativos:** alertas críticos `open` ou `acknowledged`; reconhecimento não encerra uma ocorrência.
- **Manutenções vencidas:** manutenções `scheduled` ou `in_progress` anteriores à data civil de `America/Sao_Paulo`, aplicada pela API para não depender do fuso configurado no PostgreSQL.

O mapa não inventa fronteiras: a tabela por região agrega os bairros/regiões cadastrados no banco. A última posição móvel só é marcada como recente até 15 minutos; posições antigas continuam visíveis com indicação explícita. Timestamps GPS até dois minutos no futuro são tolerados para compensar relógios, mas qualquer posição ainda no futuro é marcada como desatualizada.

Cada consulta retorna no máximo 5.000 equipamentos e 5.000 agentes, sem paginação geográfica. Esse limite atende ao inventário demonstrativo; não representa uma estratégia de escala para grandes cidades.

## Endpoints

Todos ficam sob `/api/v1`.

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` | `/monitoring/overview` | Indicadores do Centro de Comando e flag de modo demonstrativo |
| `GET` | `/monitoring/map` | Equipamentos e agentes com posição disponível; filtro `resourceType` (`all`, `equipment`, `agent`), além de `typeCode`, `status`, `organizationId`, `regionId` (bairro), `regionZone` e limites `west/south/east/north` |
| `GET` | `/monitoring/regions` | Resumo por região cadastrada, sem geometrias presumidas |
| `GET` | `/monitoring/maintenance-alerts` | Manutenções imediatas, vencidas ou previstas em até sete dias |
| `GET` | `/monitoring/alerts` | Alertas paginados; filtros `severity`, `code`, `status` (`active` inclui abertos e reconhecidos) e `resourceId` |
| `GET` | `/monitoring/alerts/:id` | Detalhes e histórico de atendimento |
| `POST` | `/monitoring/alerts/:id/acknowledge` | Reconhece sem remover o alerta ativo |
| `POST` | `/monitoring/alerts/:id/notes` | Registra observação de 2 a 500 caracteres |
| `POST` | `/monitoring/alerts/:id/resolve` | Encerra apenas após a condição operacional ser normalizada |
| `GET` | `/monitoring/events/stream` | Fluxo Server-Sent Events; aceita `Last-Event-ID` ou `?since=` |
| `GET` | `/monitoring/demo/scenario/timeline` | Últimos eventos persistidos do recurso `DEMO-RAD-001` e dos alertas relacionados; somente com `NODE_ENV=development` e `DEMO_SCENARIO_ENABLED=true` |

### Eventos SSE

O corpo de cada evento possui `id`, `type`, `source` (`api` ou `demo`), `resourceType`, `resourceId`, `payload` e `occurredAt`. Tipos publicados: `equipment.updated`, `agent.updated`, `agent.deleted`, `maintenance.created`, `maintenance.updated`, `alert.created`, `alert.updated`, `alert.resolved` e `demo.scenario.changed`. `heartbeat` não possui identificador persistido.

Agentes são mapeados com marcador distinto dos equipamentos. A referência geográfica informa se o ponto veio da última posição conhecida do agente, da posição conhecida do equipamento vinculado ou de coordenadas fixas da base operacional. O mapa não rastreia profissionais em tempo real e agentes sem coordenadas permanecem disponíveis no cadastro.

Cada alteração grava o evento junto com as ações de alerta na transação de monitoramento; a publicação ao vivo acontece depois do commit. O navegador ignora identificadores duplicados e recarrega os snapshots REST ao conectar ou reconectar. O stream ao vivo usa um barramento em memória de processo único; a tabela `operational_events` permite recuperar eventos persistidos desde o cursor após reinício. O snapshot REST continua sendo a recuperação de estado autoritativa.

## Alertas

As condições ativas usam fingerprints únicos com índice parcial no PostgreSQL, evitando duplicação simultânea. Mau funcionamento e furto são críticos; manutenção, indisponibilidade e vencimento têm gravidade alta ou média conforme a condição. Quando a condição deixa de existir, o serviço registra ação e evento de resolução automática. Alertas reconhecidos continuam ativos até normalização. Um encerramento manual é rejeitado enquanto a condição ainda existir.

## Cenário demonstrativo

O `DemoScenarioModule` só é importado quando a API inicia com `NODE_ENV=development` e `DEMO_SCENARIO_ENABLED=true`; `npm run dev:api` define ambos. O processo de produção não registra esses endpoints, mesmo que a flag esteja ligada.

| Método | Rota | Efeito |
| --- | --- | --- |
| `GET` | `/monitoring/demo/scenario` | Lê o cenário `radar-outage` e verifica o recurso de origem `demo` |
| `GET` | `/monitoring/demo/scenario/timeline` | Lê em ordem cronológica a timeline persistida do recurso e de seus alertas |
| `POST` | `/monitoring/demo/scenario/outage` | Marca `DEMO-RAD-001` com mau funcionamento e prioridade imediata |
| `POST` | `/monitoring/demo/scenario/reset` | Restaura status operacional, prioridade normal e próxima revisão `2026-11-10` |

As operações são determinísticas e idempotentes, alteram apenas o equipamento demonstrativo nomeado, gravam eventos com `source=demo` e não tocam nos cadastros `BROWSER-*` ou manuais. Execute `npm run db:seed` para recriar os dados sintéticos identificados como `DEMO-*`; o seed faz upsert e não limpa o banco.

## Mapa e tiles

O cliente mantém uma instância MapLibre por componente e usa uma fonte GeoJSON clusterizada atualizada por `setData`. O mapa usa tiles raster padrão do OpenStreetMap, com atribuição visível. A política dos tiles exige atribuição e acesso normal, não permite pré-carregamento em massa/offline e oferece serviço best-effort. Para ambientes de produção com maior tráfego, configure um provedor de tiles com capacidade e termos adequados; nenhum download em massa é feito pela aplicação.
