# Roteiro do vídeo demonstrativo — NEXO Urbano

Duração prevista: **2 minutos e 50 segundos**. O vídeo cobre as três partes do desafio: inventário, operação e análise preventiva.

## Preparação

- Use uma base local de demonstração limpa, populada pelas migrations, pelo seed base e pelo histórico sintético. Não grave usando uma base que contenha registros de teste ainda não revisados.
- Na raiz, confirme `nvm use`, `node --version`, `npm run db:migrations:show` e que a API e o frontend iniciaram conforme o README.
- Abra `http://127.0.0.1:4200`, aguarde **Tempo real conectado** e o mapa. O mapa precisa de conectividade com os tiles do OpenStreetMap; mantenha a atribuição visível.
- Confira que `DEMO-RAD-001` está operacional e que o cenário do Mission Control está restaurado. Restaurar o cenário preserva o histórico já gravado.
- Não mostre o terminal com `.env`, URLs de banco ou credenciais. Grave a aplicação local em loopback.

## Roteiro cronometrado

### 0:00–0:20 — Problema e proposta

**Fala:** “O NEXO Urbano conecta o inventário de equipamentos, a resposta a ocorrências e a análise preventiva em uma visão operacional.”

**Ação:** mostre a Central de Operações, o estado SSE e a identificação do ambiente demonstrativo.

### 0:20–0:50 — Inventário e localização

**Fala:** “Os equipamentos, estados e posições vêm da API. O mapa permite localizar o recurso e abrir seu cadastro.”

**Ação:** selecione um equipamento cadastrado, mostre seu detalhe e localização no Mapa Vivo; retorne à Central.

### 0:50–1:45 — Falha e atendimento

**Fala:** “Vou simular uma falha operacional pelo Mission Control. A simulação altera o estado persistido, gera um alerta e publica eventos para a Central atualizar sem recarga.”

**Ação:** clique **Simular mau funcionamento**. Mostre a atualização SSE dos indicadores e do mapa, abra **Ver ocorrência**, reconheça o alerta e registre uma observação de atendimento.

**Fala:** “Esse incidente foi provocado agora para demonstrar a resposta operacional; ele não foi previsto pelo modelo.”

### 1:45–2:05 — Normalização e histórico

**Ação:** volte à Central, clique **Restaurar equipamento** e confira o estado operacional, o alerta resolvido e os eventos persistidos na timeline.

**Fala:** “A normalização encerra o alerta. A timeline preserva a falha simulada e as ações do operador.”

### 2:05–2:40 — Análise preventiva

**Ação:** abra **Análise Preventiva**, escolha uma região com dados suficientes e mostre os fatores, a prioridade de manutenção e a validação histórica.

**Fala:** “A análise usa histórico sintético identificado. O índice ajuda a ordenar prioridades, não é uma probabilidade calibrada. O backtest é limitado e não comprova eficácia preditiva em uma cidade real.”

### 2:40–2:50 — Encerramento

**Fala:** “O NEXO reúne recursos, localização, atendimento persistido e evidências históricas para apoiar decisões urbanas.”

## Conferência da gravação

Assista ao vídeo final antes de enviá-lo. Confirme que os dados demonstrativos estão identificados, que o incidente é apresentado como simulação, que o histórico não foi editado e que nenhuma credencial ou dado pessoal aparece na tela. O arquivo de vídeo não faz parte do pacote de código até ser gravado e revisado.
