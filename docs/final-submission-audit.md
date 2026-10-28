# Auditoria final de submissão — NEXO Urbano

Data: 24/10/2026
Escopo: integridade do checkout, qualidade do código, segurança, dados demonstrativos e reprodução local. Nenhum commit ou ZIP definitivo foi criado. A atualização ao fim deste documento registra a preparação de `fogo_demo_final`; `fogo` e `fogo_e2e` não foram alterados.

## Estado de prontidão

**Estado inicial desta auditoria: NÃO PRONTO para submissão final.** A seção “Correção dos bloqueadores — 24/10/2026” registra a atualização posterior e substitui esta decisão inicial.

Este estado não significa que o build esteja quebrado: build, lint, testes unitários, migrations, seeds e smoke HTTP/SSE passaram nos escopos descritos abaixo. A API não possui autenticação e deve permanecer restrita a loopback durante a demonstração.

## Checkout e arquivos

- `main` está no mesmo commit que `origin/main` (`50541c5`). Não há commits locais adicionais.
- O working tree contém **30 arquivos rastreados modificados, 3 arquivos novos de código não rastreados** (dois testes e o helper da distribuição) e este relatório novo. As mudanças não foram commitadas.
- Esta auditoria atualizou `docs/demo-script.md` e `docs/evaluation-checklist.md` e adicionou este relatório.
- O snapshot usado para os testes incluiu o diff e os três arquivos novos de código. Este relatório foi escrito depois dos testes e só altera documentação. Arquivar apenas `HEAD` excluiria as alterações de UX/código.
- `git diff --check` passou. Não foi encontrado ZIP no repositório nem nas pastas de submissão inspecionadas; nenhum ZIP foi criado ou sobrescrito.

## Build, testes e contratos

Ambiente selecionado: Node `v22.23.3`, npm `10.9.9`, conforme `.nvmrc` e `engines`.

Em snapshot temporário do working tree, sem `.env` real:

| Comando | Resultado |
| --- | --- |
| `npm ci --no-audit` | Passou; instalou 512 pacotes. A tentativa offline anterior não passou porque os metadados do registry não estavam no cache. |
| `npm run build` | Passou: contratos compartilhados, Angular e NestJS. Bundle inicial Angular: 409,23 KB; CSS: 99,88 KB. |
| `npm run lint` | Passou para web e API. |
| `npm test` | Passou: web 6 arquivos/12 testes; API 10 arquivos/41 testes. |
| `docker compose config --quiet` | Passou. |
| `git diff --check` | Passou. |

O build informa estouro do orçamento CSS configurado em nove componentes (entre 4,35 e 7,83 KB; limite 4 KB). São avisos, sem falha de compilação.

O frontend e a API importam os contratos do workspace `@fogo/contracts`; o build dos contratos e dos dois aplicativos passou. A distribuição do gráfico da Central é calculada a partir do resumo operacional da API (`GET /api/v1/monitoring/overview`), incluindo todas as categorias de estado e total zero tratado sem divisão por zero. A Análise Preventiva busca overview, regiões, detalhes, prioridades, tendências e validação nos endpoints `/api/v1/intelligence/*`, com `sourceScope` explícito. Não há números fixos adicionados aos gráficos.

## Reprodução isolada

A instalação foi reproduzida num snapshot em `/tmp`, com PostgreSQL `18.6` temporário, porta aleatória em loopback e armazenamento `tmpfs`. O contêiner foi encerrado ao final; `fogo` e `fogo_e2e` não foram usados para essa reprodução.

- Três migrations aplicadas e confirmadas por `db:migrations:show`.
- Seed base: 12 equipamentos e 8 agentes.
- Seed histórico: 219 eventos; segunda execução retornou `inserted: 0`.
- API iniciada em loopback: health, inventário, agentes, manutenção, monitoramento, alertas, mapa, regiões, endpoints de inteligência e Mission Control responderam HTTP 200. O stream SSE respondeu `200 text/event-stream`.
- Angular e proxy local iniciaram; Central, endpoints proxied, mapa e logotipo responderam HTTP 200.
- Fluxo manual no banco temporário: falha em `DEMO-RAD-001` → alerta crítico → atualização SSE/indicadores → reconhecimento → observação → restauração → alerta resolvido e timeline persistida.

Esse smoke HTTP/SSE não é a suíte E2E automatizada nem uma nova sessão de Chromium. A validação visual em Chromium e a demonstração manual integrada citadas no escopo foram feitas na etapa anterior; não foram repetidas aqui.

## E2E automatizado

`node scripts/run-e2e.mjs --check-config` passou e verificou o formato/isolamento configurado, mas não testou conectividade. `npm run test:e2e` permanece pendente: o runner limpa e altera fixtures próprios no banco E2E, e uma execução anterior foi bloqueada pela revisão automática. O bloqueio não foi contornado. `fogo_e2e` não foi usado nem alterado nesta auditoria.

## Inventário BROWSER-E2E no banco principal `fogo`

As consultas foram feitas em transações `BEGIN READ ONLY` e finalizadas com `ROLLBACK`. Nenhum registro foi alterado. Foram encontrados sete registros com o marcador literal: quatro equipamentos e três alertas. A relação completa dos registros associados que foram identificados está abaixo.

### Equipamentos e vínculos de localização

Todos os quatro equipamentos têm `data_origin=manual`, organização `mobilidade-demo`, região Centro, e foram criados em 23/10/2026 UTC. O prefixo serial e o horário sugerem resíduos de browser/E2E, mas a origem de sessão/usuário não é persistida e isso não prova sua procedência.

| Equipamento (PK) | Serial / estado | `equipment_locations.id` | `equipment_positions.id` |
| --- | --- | --- | --- |
| `6457f7bb-cd23-4d65-ab82-87f5806b80dd` | `BROWSER-E2E-1792757121854` / operacional | `c3172482-382d-40ac-a7ec-83162979699e` | `394c8a0c-42c7-4994-ad1d-e6ae313f0861` |
| `9bfc76fa-3aaf-462b-a465-19ec470778ee` | `BROWSER-E2E-1792757178056` / mau funcionamento | `d3983aed-d6da-465c-beb2-b9bfff882f8d` | `3dd2571a-dbca-440e-a754-8540cde5fe99` |
| `38cff322-2942-4447-83fb-bfe8d819b1d3` | `BROWSER-E2E-1792757193125` / mau funcionamento | `7be64e14-30d7-4729-8f5b-dd45ee048b47` | `c6becd59-906a-484a-8779-e92578474f1f` |
| `c03ea717-00f6-4c0b-8241-b63b1c682822` | `BROWSER-E2E-1792757320581` / mau funcionamento | `6e1e9d08-07c4-48ca-bb40-bd2a9d511cf6` | `85ee3c94-7aa3-4f93-b309-53cf6996f46e` |

Os quatro registros de posição têm `recorded_at=2026-10-23T12:01:00Z` e coordenadas do Centro (`-22.906,-47.061`). Na auditoria, estavam com mais de um dia; a política API considera posição antiga após 15 minutos. O marcador continua no mapa, mas a idade deve ser interpretada como dado antigo, não localização atual.

### Alertas e histórico operacional associados

| Alerta (PK) | Equipamento | Estado / gravidade | Ação `operational_alert_actions.id` | Evento `operational_events.id` |
| --- | --- | --- | --- | --- |
| `75263192-45c7-46ba-9115-ae9acb6f9f64` | `9bfc76fa-3aaf-462b-a465-19ec470778ee` | aberto / crítico | `7a917e25-f7b4-4f91-959c-32193c743a41` | `1` (`alert.created`) |
| `a3b69adb-855c-4886-98fe-4b1d30191e4f` | `38cff322-2942-4447-83fb-bfe8d819b1d3` | aberto / crítico | `b4445e09-a021-49d0-9625-ec049a6e5a5d` | `3` (`alert.created`) |
| `6bde0fb9-bbff-4507-86e9-c934c9630da6` | `c03ea717-00f6-4c0b-8241-b63b1c682822` | aberto / crítico | `cb9c91fb-2372-4e38-b0ac-f0cfb9b11373` | `2` (`alert.created`) |

As três ações são `created`, feitas por `Monitoramento automático`; os eventos têm `source=api`. Alertas guardam `resource_id` polimórfico, sem FK para equipamento. O equipamento `38cff322-2942-4447-83fb-bfe8d819b1d3` também se relaciona com a manutenção `34468180-7282-4540-bf47-d9ba65bee9f0` (`immediate`, `completed`, descrição “Manutenção E2E urgente demonstrativa”). Não há histórico de inteligência nem evento operacional de equipamento para esses quatro registros.

### Impacto e decisão de saneamento

- O inventário principal contém 16 equipamentos: 12 de origem `demo` e 4 `manual` BROWSER-E2E; 3 dos quatro estão com mau funcionamento.
- Há cinco alertas críticos ativos no total; estes três representam 60%. Eles afetam indicadores, lista de alertas e mapa.
- A manutenção relacionada está concluída, então não compõe a fila aberta, mas aparece no histórico administrativo.
- A origem padrão `demo` da Análise Preventiva não usa o histórico desses equipamentos; escopos `manual`/`all` podem incluí-los na avaliação atual.
- **Saneamento recomendado agora: nenhum.** Use uma base local limpa e dedicada para a demonstração. Não exclua esses dados da `fogo` sem autorização. Uma eventual limpeza exigiria backup, revisão transacional dos IDs acima e tratamento explícito dos vínculos polimórficos e do FK de manutenção (`RESTRICT`); apagar equipamento isoladamente pode deixar alertas/auditoria órfãos.

## Dependências e exposição (estado antes da correção abaixo)

`npm audit --audit-level=high` encontrou quatro findings altos na cadeia `@nestjs/platform-express@12.2.0` → `multer@2.4.0`. O advisory [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) indica correção em `multer@2.5.0`; o caminho de negação de serviço descrito depende de `fileFilter` assíncrono. Não foram encontrados módulos/interceptors de upload no código da API auditado. A API de demonstração não tem autenticação e está configurada para loopback; não exponha publicamente antes de resolver a cadeia vulnerável e rever a segurança da API.

`npm audit fix --force` não foi executado, pois propunha downgrade breaking do `@nestjs/platform-express` para Nest 11. A simulação não forçada do npm falhou internamente (`Cannot read properties of null (reading 'edgesOut')`); portanto, ainda não há correção compatível validada.

O `.env` local está ignorado e com modo `600`; nenhuma credencial foi exibida. `.gitignore` cobre `.env`, `node_modules`, `dist`, caches, `.aws`, `.codex` e dumps. Não há `.env` real, dependências instaladas, artefatos de build/cache ou ZIP versionados.

## Instruções de inicialização revisadas

Use apenas um PostgreSQL local isolado para a demonstração; não aponte os comandos de migration/seed para dados reais ou para a base compartilhada `fogo`.

1. Instale/seleciona a versão declarada e dependências:

   ```bash
   nvm use
   node --version
   npm ci
   ```

2. Crie `.env` a partir de `.env.example`. Configure `POSTGRES_PASSWORD` e `DATABASE_URL` com a mesma senha, usando um banco/volume local descartável dedicado. Mantenha as variáveis E2E sem configurar para a execução normal. Não compartilhe o arquivo.
3. Inicie PostgreSQL e aplique migrations/seeds apenas nessa base descartável:

   ```bash
   npm run db:up
   npm run db:migrate
   npm run db:seed
   npm run db:seed:intelligence
   npm run db:migrations:show
   ```

4. Em terminais separados, inicie API e frontend:

   ```bash
   npm run dev:api
   npm run dev:web
   ```

5. Acesse `http://127.0.0.1:4200`. O script de desenvolvimento habilita Mission Control; mantenha a API em loopback. O mapa precisa de acesso aos tiles do OpenStreetMap e deve manter a atribuição visível. Falha de tile é conectividade externa, não dado do banco.

O Compose configura a porta conforme o `.env`/defaults do projeto; confirme que `DATABASE_URL` aponta para o mesmo serviço e porta. Mudar a senha no `.env` não altera a senha de um volume PostgreSQL já inicializado.

## Roteiro de demonstração

Roteiro de **2min50** atualizado em [demo-script.md](demo-script.md): Central e status SSE → equipamento cadastrado e localização → falha provocada via Mission Control → alerta e atualização SSE → reconhecimento/observação → restauração → timeline persistida → Análise Preventiva.

Identifique claramente: a falha é simulação operacional; o histórico de inteligência é sintético/demonstrativo; o índice 0–100 é prioridade, não probabilidade calibrada; o backtest tem limitações e não prova eficácia em cidade real. Não apresente a falha simulada como predita.

## Checklist do pacote

- [ ] Revisar o diff do working tree e incluir os 3 arquivos novos não rastreados; não empacotar só `HEAD`.
- [ ] Comparar critérios com o regulamento integral, que não está versionado neste repositório.
- [ ] Escolher uma base de demonstração limpa; não usar os registros BROWSER-E2E de `fogo` sem revisão/decisão.
- [ ] Resolver ou documentar formalmente o advisory de dependência antes de qualquer exposição pública.
- [ ] Rodar a suíte E2E apenas quando a revisão de segurança permitir e a URL apontar a uma base E2E isolada.
- [ ] Excluir `.env`, credenciais, `.aws`, `.codex`, `node_modules`, `dist`, caches, dumps e volumes de banco.
- [ ] Incluir README, `.env.example`, lockfile, workspaces de apps/contracts, scripts, documentação e assets/logotipo necessários.
- [ ] Confirmar um ZIP final menor que 50 MB e validar sua integridade; nenhum ZIP final foi criado nesta auditoria.
- [ ] Gravar e revisar o vídeo de 2–3 minutos, sem credenciais ou dados pessoais; ainda não foi gravado.
- [ ] Repetir build/lint/testes sobre o snapshot exato a distribuir; não criar commit automaticamente.

## Pendências e riscos para a demonstração

1. Confirmar regulamento oficial e requisitos do formato/pacote.
2. Resolver a cadeia vulnerável antes de qualquer deployment público; manter a API de demo em loopback.
3. Definir e preparar a base limpa de demonstração, sem modificar `fogo` automaticamente.
4. Reavaliar a execução da suíte E2E somente com banco isolado e autorização de execução do runner.
5. Tratar os avisos de orçamento CSS sem refazer identidade/estrutura, se houver tempo.
6. Gravar/revisar o vídeo e então gerar/verificar o ZIP definitivo.

O tamanho estimado do snapshot fonte comprimido, sem dependências e caches, foi cerca de 2,75 MB. É apenas uma estimativa; o limite de 50 MB só fica confirmado depois de validar o ZIP final.

## Correção dos bloqueadores — 24/10/2026

### Dependências

O `npm audit` original listou quatro pacotes afetados pelo mesmo advisory `GHSA-q7qp-rjg7-q26m`, não quatro causas independentes:

| Nó reportado pelo npm | Relação com o advisory |
| --- | --- |
| `multer` | Dependência transitiva instalada em `2.4.0`, dentro do intervalo afetado `>=2.0.0 <2.5.0`. |
| `@nestjs/platform-express` | Versão instalada `12.2.0` declara Multer `2.4.0`; o npm propunha descer o adapter para `11.1.1`, uma mudança major. |
| `@nestjs/core` | O audit propaga o finding pela dependência de `@nestjs/platform-express`, para versões `>=12.0.1`. |
| `@nestjs/testing` | O audit propaga o mesmo finding pela dependência de `@nestjs/platform-express`, para versões `>=12.0.1`. |

O root `package.json` agora fixa Multer `2.5.0` apenas dentro de `@nestjs/platform-express`; o lock instala `node_modules/multer@2.5.0` e conserva a versão declarada pelo Nest no metadado upstream. Multer permanece na major 2, suporta Node a partir de 10.16, e o release `2.5.0` declara correção para esse advisory ([release do Multer](https://github.com/expressjs/multer/releases), [documentação oficial de overrides do npm](https://docs.npmjs.com/files/package.json/)). A API do projeto não registra upload nem interceptors Multer. A compatibilidade do workspace atual foi confirmada por instalação, build, lint e testes; isso não é uma alegação de compatibilidade com rotas de upload que o projeto não possui.

Verificações após a mudança:

- `npm ls multer --all`: `@nestjs/platform-express@12.2.0 overridden` → `multer@2.5.0 overridden`.
- `npm audit`: **0 vulnerabilidades**; os quatro nós reportados deixaram de aparecer.
- `npm ci --no-audit`: passou, 512 pacotes, com Node `v22.23.3` e npm `10.9.9`.
- `npm run build`, `npm run lint` e `npm test`: passaram (6 arquivos/12 testes web; 10 arquivos/41 testes API).
- `npm audit fix --force` não foi usado e NestJS não sofreu downgrade.

Continuam os avisos de orçamento CSS nos mesmos nove componentes. Eles não impediram o build. A API demonstrativa permanece sem autenticação; não a publique.

### Banco demonstrativo e segurança dos dados

O PostgreSQL Compose `postgres:18.6-alpine` já existente estava saudável. A conexão administrativa local foi confirmada como usuário `fogo` com privilégio de superusuário; `fogo_demo_final` ainda não existia. Foi criado somente esse banco vazio, sem apagar nem recriar volume ou bancos. `fogo` e `fogo_e2e` continuaram fora de migrations, seeds e fluxo operacional.

Antes das migrations e antes de cada seed, a URL foi redirecionada em memória para o host/porta local já validados e a aplicação consultou `current_database()`/`current_user`; o destino exigido era exatamente `fogo_demo_final`. O arquivo `.env` real não foi exibido nem modificado. O procedimento reproduzível com a verificação explícita da URL está em [demo-database.md](demo-database.md).

| Verificação em `fogo_demo_final` | Resultado |
| --- | --- |
| Migrations | 3 aplicadas. |
| Seed base | 12 equipamentos demonstrativos, 8 agentes e 4 manutenções. |
| Seed de inteligência | 219 eventos sintéticos: 32 falhas, 26 manutenções concluídas, 4 pendentes e 157 observações. |
| Seriais `BROWSER-E2E` | 0. Os 12 equipamentos têm `data_origin=demo`. |
| Idempotência | Repetir `db:seed` preservou 12/8/4. Repetir `db:seed:intelligence` retornou `inserted: 0` e manteve 219 eventos. |
| Estado após smoke | 8 alertas no total: 7 abertos originados das condições do seed e 1 resolvido pela simulação operacional desta validação. Há 13 eventos operacionais e 1 assessment de inteligência materializado pelos GETs. |

O fluxo de validação deixou seis eventos persistidos para `DEMO-RAD-001`, incluindo a observação de atendimento escrita durante a verificação. O cenário terminou operacional e o alerta resolvido. Esse histórico não é BROWSER-E2E e não foi apagado: preservar histórico é comportamento do produto. Se a gravação precisar iniciar sem essa simulação anterior, prepare outra base demo limpa sem reutilizar `fogo` ou `fogo_e2e`.

Uma consulta somente leitura de `fogo` após a validação confirmou 16 equipamentos, 9 agentes, 5 manutenções, 15 alertas, 29 eventos operacionais, 219 eventos históricos, 5 assessments e os mesmos quatro seriais BROWSER-E2E previamente inventariados. Não houve alteração nesses registros. `fogo_e2e` não foi conectado.

### Fluxo operacional e telas

A API temporária foi iniciada em loopback na porta `33103`, com `DATABASE_URL` de processo apontando a `fogo_demo_final`; o `.env` não foi alterado. Angular e seu proxy iniciaram em `127.0.0.1:4200` apontando para essa API. Health, inventário, agentes, manutenção, Central, mapa, regiões, alertas, Mission Control e endpoints de Análise Preventiva responderam HTTP 200; SSE retornou `text/event-stream`.

Chromium real confirmou as sete rotas em viewport desktop `1440×900` e mobile `390×844`: Central, Mapa Vivo, Alertas e incidentes, Análise Preventiva, Equipamentos, Agentes e Manutenção. Os títulos foram renderizados e `document.documentElement.scrollWidth` não excedeu o viewport nos 14 casos.

O fluxo REST/SSE validou:

1. `DEMO-RAD-001` começou operacional.
2. `POST .../outage` alterou o estado e criou alerta crítico.
3. SSE publicou `alert.created` e `demo.scenario.changed`; os alertas críticos passaram de 2 para 3.
4. Mapa e Central refletiram o mau funcionamento.
5. Reconhecimento e observação persistiram como ações do operador.
6. `POST .../reset` restaurou o equipamento; o alerta foi resolvido e o KPI voltou a 2.
7. A timeline carregou seis eventos persistidos depois da restauração.

A suíte automatizada `npm run test:e2e` não foi executada; ela não foi apontada para `fogo_demo_final` e nenhum guard E2E foi removido ou enfraquecido.

### Arquivos para revisão/commit e arquivos excluídos

Depois das correções desta etapa, o working tree tem **34 arquivos rastreados modificados e 5 novos arquivos não rastreados**. Nenhum commit foi feito. O futuro commit deve incluir:

- Alterações de UX/contratos já existentes em `apps/api/src/monitoring/`, `apps/web/src/app/`, `apps/web/angular.json`, `apps/web/src/index.html`, `apps/web/src/styles.scss` e `packages/contracts/src/index.ts`.
- A correção de dependência: `package.json` e `package-lock.json`.
- Configuração/documentação reproduzível: `.env.example`, `README.md`, `docs/demo-script.md`, `docs/evaluation-checklist.md`, `docs/final-submission-audit.md` e `docs/demo-database.md`.
- Três novos arquivos de código/teste: `apps/web/src/app/monitoring/alerts.component.spec.ts`, `apps/web/src/app/monitoring/equipment-distribution.spec.ts` e `apps/web/src/app/monitoring/equipment-distribution.ts`.

Excluir do pacote de submissão: `.env` e outros segredos locais, `.aws`, `.codex`, `node_modules`, `dist`, `.angular`, coverage/cache/logs, dumps e volumes PostgreSQL, bases `fogo`/`fogo_e2e`, screenshots/perfis temporários e qualquer ZIP anterior. **Incluir `.env.example`**, que contém somente nomes de configuração e agora deixa as variáveis E2E vazias. O tamanho e a integridade do ZIP final ainda não foram medidos porque ele não foi criado.

### Vídeo e decisão atual

O roteiro de 2min50 em `demo-script.md` deve mostrar as três partes do desafio: inventário/localização, operação e análise preventiva. Mostre a conexão SSE; selecione o equipamento no mapa; provoque a falha pelo Mission Control; abra “Ver ocorrência”; reconheça e anote; restaure; confirme estado, resolução e timeline; encerre com prioridades e evidências históricas. Diga explicitamente que a falha foi simulada, que o histórico é sintético e que o índice 0–100 não é probabilidade calibrada nem prova de eficácia. Mantenha atribuição OSM visível e não mostre `.env`, terminal com URLs/credenciais ou dados pessoais. O vídeo ainda não foi gravado.

**Classificação naquela fotografia de 24/10/2026: PRONTO COM RESSALVAS.** A atualização corrente abaixo substitui as pendências operacionais registradas neste parágrafo.

## Revisão de qualidade e prontidão — 27/10/2026

Esta é a evidência corrente após correções pontuais. Nenhuma migration ou dependência foi adicionada e nenhum banco operacional/demo foi alterado por esta etapa. A suíte API E2E utilizou somente o banco dedicado aceito pelo guard do runner.

| Verificação | Resultado observado |
| --- | --- |
| Unitários | `npm test`: 169 testes web e 130 testes API passaram. |
| API E2E | `npm run test:e2e`: 22 testes em quatro arquivos passaram no PostgreSQL E2E. Inclui agente em atividade localizado por base sem posição própria. |
| Web E2E | `npm run test:web:e2e`: 8 cenários Chromium passaram. O retorno do detalhe do equipamento ao inventário foi exercitado no navegador com API interceptada. |
| Lint/build | `npm run lint` e `npm run build` passaram. O Angular ainda apresenta nove avisos de orçamento CSS; o bundle lazy de mapa tem cerca de 1,09 MB bruto. |
| Alterações | Mapa usa siglas por tipo/categoria com legenda, ignora respostas atrasadas de filtros, atualiza após exclusão de agente e compartilha a regra de localização regional com o mapa. O inventário ganhou variantes opcionais de radar/câmera e classes de transporte, com compatibilidade para registros existentes. |
| Inteligência | Regras e métricas permanecem transparentes e sintéticas. O resultado top-1 é uma amostra exploratória pequena, sem comparação validada com baseline de ranking; não representa eficácia em cidade real. |
| Instalação macOS | A checagem `npm ci --dry-run --ignore-scripts --offline --os=darwin --cpu=arm64` da atualização anterior aceitou o lockfile. Não equivale a instalação e execução nativa em macOS. |
| Segurança/submissão | A aplicação não autentica usuários e deve permanecer local/loopback. O vídeo bônus ainda não foi gravado; tiles OSM dependem de internet. |

**Estado corrente: pronto para demonstração local e revisão do pacote, com ressalvas.** As correções estão na branch `feature/event-readiness-polish` e na [PR #2 para `main`](https://github.com/BrunoMorgadoGit/Nexo-Urban/pull/2), aberta e sem conflitos no momento desta atualização. O ZIP de entrega foi gerado separadamente em `/tmp/FOGO-Entrega-2026-10-27.zip` a partir do mesmo snapshot revisado; ele não é versionado. Isso não garante classificação no evento nem comprova efetividade preditiva real.

## Atualização final de submissão — 27/10/2026

Esta atualização substitui o estado de branch, vídeo e pacote descrito na fotografia anterior.

| Verificação | Estado nesta entrega |
| --- | --- |
| Código | Checkout `main`, sincronizado com `origin/main`, com cinco alterações locais incluídas no pacote: índice regional do histórico, teste correspondente e atualização das checklists e auditoria final. |
| Testes/build/lint | `npm test`: 169 testes web e 131 API passaram. `npm run build:api`, lint da API e `git diff --check` passaram. Os E2E PostgreSQL e navegador não foram repetidos após a otimização localizada. |
| Pacote fonte | `/tmp/FOGO-Entrega-2026-10-27-final.zip`, gerado de `HEAD` mais o diff local; cerca de 2,7 MB. `unzip -t` passou. Contém `.env.example` e as alterações atuais; não contém `.env`, `.aws`, `.codex`, `node_modules`, `dist` ou `.git`. |
| Vídeo | O participante informou que foi gravado. O arquivo não está neste checkout; revisar a reprodução e anexá-lo separadamente à submissão. |
| Operação | A API demonstrativa não tem autenticação; manter execução local/loopback. Tiles do OpenStreetMap precisam de internet. |

**Estado:** pacote de código pronto para envio. Antes de submeter, revisar o vídeo e anexá-lo junto com o ZIP. As ressalvas de dados sintéticos e validação preditiva continuam válidas.
