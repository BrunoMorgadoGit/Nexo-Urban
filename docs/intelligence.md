# Inteligência Preditiva

O Intelligence Engine usa estatística descritiva e regras determinísticas. O resultado é um **índice de priorização operacional**, não uma probabilidade calibrada de incidente nem uma previsão de data de falha.

## Escopos e origem

Todos os endpoints aceitam `sourceScope=demo|manual|all`; o padrão é `demo`.

- `demo`: histórico sintético versionado e estado/manutenções atuais dos equipamentos demonstrativos.
- `manual`: alertas operacionais persistidos e estado/manutenções atuais de equipamentos cadastrados manualmente. Ainda não há observações temporais de estado suficientes para classificar regiões como risco baixo; a resposta sinaliza dados insuficientes quando os critérios não são atendidos.
- `all`: combina as duas fontes de forma explícita. `sourceComposition` informa contagens sintéticas e operacionais. A origem de cada recomendação de equipamento também é retornada.

O conjunto `campinas-city-history-v1` contém observações e eventos sintéticos reproduzíveis, marcados com `origin=synthetic`, `datasetKey` e `datasetVersion`. A chave de evento é única e o gerador usa `ON CONFLICT DO NOTHING`; executá-lo novamente não duplica linhas nem altera os cadastros existentes.

```bash
npm run db:seed:intelligence
```

O histórico `occurred_at` foi gerado retroativamente para demonstração. `created_at` continua representando o momento real de inserção no banco. Não misture o conjunto com métricas operacionais sem selecionar o escopo combinado.

## Risco regional

Versão: `risk-rules-v1`. Horizonte: 24 horas. Janela: 90 dias.

```text
risco = round(
  0,26 × pressão_de_falhas
+ 0,22 × tendência_temporal
+ 0,18 × indisponibilidade
+ 0,14 × recorrência
+ 0,10 × pressão_de_manutenção
+ 0,05 × severidade
+ 0,05 × idade_da_informação
)
```

Cada fator é normalizado para 0–100, e os pesos somam 1:

- **Pressão de falhas:** falhas nos últimos 30 dias por 10 equipamentos elegíveis por mês, multiplicadas por 25 e limitadas a 100.
- **Tendência:** comparação da taxa recente de 30 dias com os 30 dias anteriores: `clamp(50 + 50 × (taxa_recente − taxa_anterior) / max(taxa_anterior, 0,5))`. Sem falhas em ambas as janelas, o fator vale zero.
- **Indisponibilidade:** proporção atual de recursos em mau funcionamento, manutenção ou furtados. `not_installed` e `deactivated` ficam fora do denominador; furtados permanecem no denominador e contam como indisponíveis.
- **Recorrência:** equipamentos com pelo menos duas falhas na janela de 90 dias, normalizados pelo total elegível e limitados a 100.
- **Pressão de manutenção:** eventos históricos de manutenção pendente mais manutenções atuais vencidas ou imediatas, normalizados pela exposição.
- **Severidade:** média de falhas com pesos `low=0,25`, `medium=0,5`, `high=0,75`, `critical=1`.
- **Idade da informação:** penaliza observações com mais de sete dias; atinge 100 aos 21 dias. A data da última observação também aparece no detalhe.

Classificação: `0–24 baixo`, `25–49 moderado`, `50–69 elevado`, `70–100 crítico`. Se uma região não tiver ao menos 10 observações, 60 dias de cobertura e um equipamento elegível observado, o escore fica `null` e a classe é `insufficient_data`; ausência de eventos não vira automaticamente baixo risco. Qualidade `sufficient` requer também 20 observações, 75 dias de cobertura e dado mais recente com até 14 dias; casos entre os mínimos e esse patamar são `limited`.

As taxas usam equipamentos elegíveis como denominador e não a quantidade bruta de eventos ou recursos. A visualização geográfica usa um ponto representativo calculado pela média das coordenadas atuais dos equipamentos cadastrados na região. Não representa limites, área ou centroide oficial da região.

## Prioridade de manutenção

A lista usa falhas nos últimos 90 dias, comparação de 30 dias contra os 30 anteriores, estado operacional, severidade máxima observada, data da última falha, serviços atuais vencidos/imediatos e próxima manutenção cadastrada para até sete dias. Estados `not_installed`, `deactivated` e `stolen` não entram como inspeção de manutenção.

A pontuação explicável soma: até 30 pontos por contagem de falhas de 90 dias; até 30 por falhas recentes; 12 por tendência crescente; até 30 por serviços vencidos; até 36 por serviços imediatos; 8 por manutenção prevista em até sete dias; até 12 por severidade; até 5 pela recência da última falha; 45 para mau funcionamento atual ou 28 para manutenção em andamento. O resultado é limitado a 100. Mau funcionamento ou manutenção imediata ativa é `corrective_urgent`; evidência preventiva é `preventive_inspection`; manutenção em curso pode ser apenas `monitor`. Nenhuma data futura de falha é estimada.

## Avaliação retrospectiva

O backtest cria cortes diários ao longo do período disponível. Para cada corte, o cálculo recebe somente eventos com `occurred_at <= cutoff`; observações posteriores não são usadas para compor a pontuação nem o estado histórico. Uma falha em `(cutoff, cutoff + 24h]` é consultada somente como desfecho.

Baseline: sinaliza a região se houve ao menos uma falha nela nos 30 dias anteriores. Precisão e recall só são retornados quando existem pelo menos 30 janelas avaliáveis e cinco janelas com incidente; do contrário, vêm como `null`, com `evaluationQuality=insufficient_sample`. O histórico é sintético e foi criado para demonstração, não é uma amostra independente nem valida desempenho real. Não use suas métricas para prometer acurácia operacional.

## Atualização e persistência

Os endpoints reaproveitam um snapshot em memória por até cinco minutos por escopo para evitar recálculo a cada consulta. Uma avaliação por região, escopo, versão e hora é persistida em `intelligence_assessments` e `intelligence_region_assessments`, com referência, janela, origem, versão, fatores e recomendações. A persistência de snapshots não altera equipamento nem cria ordem de serviço.

## Endpoints

Todos sob `/api/v1`:

| Endpoint | Uso |
| --- | --- |
| `GET /intelligence/overview` | Resumo, regiões em destaque, recomendações e tendências |
| `GET /intelligence/regions` | Avaliações atuais ordenadas |
| `GET /intelligence/regions/:id` | Fatores e evolução semanal da região |
| `GET /intelligence/maintenance-priorities` | Equipamentos priorizados e evidências |
| `GET /intelligence/trends` | Séries semanais das regiões em destaque, com `regionId` e `regionName` |
| `GET /intelligence/validation` | Backtest diário, baseline, amostra e limitações |

## Limitações atuais

- Registros operacionais manuais têm pouco histórico de estado; podem aparecer como insuficientes até haver observações ao longo do tempo.
- Os registros sintéticos são vinculados ao inventário demonstrativo atual para manter integridade relacional.
- O ponto regional usa coordenadas cadastradas e não substitui cartografia ou limites oficiais.
- O cache pode levar até cinco minutos para refletir eventos recentes; no próximo ciclo a API recalcula e persiste o snapshot.
- O método não é ML, não estima probabilidade nem cria ações automaticamente; a decisão permanece com o gestor.
