# Roteiro de apresentação — F.O.G.O. Mission Control

Duração prevista: 4 minutos. Todos os valores vêm do PostgreSQL e da API em execução; o incidente reproduzido é explicitamente demonstrativo.

## Preparação antes da gravação

Na raiz do projeto, confirme o estado inicial do recurso. Em desenvolvimento, você também pode restaurá-lo pela interface **Mission Control**.

```bash
nvm use
docker compose ps
npm run db:migrations:show
```

Se for uma instalação nova, siga primeiro as instruções de instalação do README. Depois, em dois terminais:

```bash
nvm use
npm run dev:api
```

```bash
nvm use
npm run dev:web
```

Abra <http://127.0.0.1:4200> em uma janela de 1440 × 900 ou similar. Aguarde o estado **Tempo real conectado** e o carregamento do mapa. Não recarregue a página durante a simulação: a atualização SSE deve ser visível.

Se o cenário já estiver ativo, use **Restaurar equipamento** antes de iniciar a apresentação. Isso normaliza o equipamento, mas preserva os eventos anteriores na timeline.

## Apresentação, fala e ações

### 0:00–0:30 — Problema e proposta

**Fala:** “Uma operação urbana precisa relacionar ativos, equipes e ocorrências. O F.O.G.O. reúne inventário, monitoramento e análise histórica em um fluxo que o gestor pode consultar e auditar.”

**Ação:** inicie em **Central de Operações**. Aponte o estado da conexão SSE e o aviso de ambiente demonstrativo.

### 0:30–1:05 — Inventário, mapa e indicadores

**Fala:** “Os indicadores e as posições são consultados da API; a disponibilidade usa a política documentada. No mapa, cada símbolo representa um recurso persistido, e o detalhe leva ao cadastro.”

**Ação:** mostre os indicadores do topo, selecione um marcador no mapa e abra rapidamente o equipamento. Retorne à Central pelo menu lateral.

### 1:05–2:20 — Mission Control e resposta ao incidente

**Fala:** “Agora vou aplicar uma falha determinística em um radar de demonstração. O backend persiste a mudança, reconcilia os alertas e publica os eventos. O navegador atualiza o snapshot sem recarga.”

**Ação:** em **Mission Control**, clique **Simular mau funcionamento**. Aguarde a situação mudar para **Mau funcionamento**. Mostre a disponibilidade atualizada, o alerta crítico, a entrada de falha e a criação do alerta na timeline. Clique **Reconhecer** no alerta e abra **Consultar equipamento**.

**Fala:** “Reconhecer registra o atendimento, mas não apaga o alerta. A linha do tempo distingue o evento de demonstração e a ação do operador.”

### 2:20–3:10 — Inteligência e limites

**Ação:** navegue para **Inteligência Preditiva**. Selecione uma região com dados suficientes e mostre os fatores, a tendência, a manutenção prioritária e a validação retrospectiva.

**Fala:** “A análise usa histórico sintético identificado e regras explicáveis. O escore organiza prioridades; não é uma probabilidade. O backtest conta falhas nas 24 horas após cada corte, e a tela expõe falsos positivos, prevalência e o baseline. Isso não prova eficácia em operação real.”

**Ação:** aponte a origem e a qualidade dos dados. Evite chamar a falha que acabou de simular de previsão: ela é uma ocorrência observada, posterior à análise histórica.

### 3:10–4:00 — Normalização e encerramento

**Ação:** retorne à Central e clique **Restaurar equipamento**. Aguarde a atualização SSE. Mostre a situação operacional, a resolução do alerta e as entradas de restauração/resolução na timeline.

**Fala:** “A condição normalizada encerra o alerta e recupera os indicadores. A ocorrência permanece no histórico persistido. O gestor consegue acompanhar o estado, entender a recomendação e conferir o que aconteceu.”

## Sequência curta de cliques

1. Central de Operações → selecionar um marcador → **Consultar equipamento**.
2. Voltar à Central → Mission Control → **Simular mau funcionamento**.
3. Alertas prioritários → **Reconhecer** → abrir o cadastro relacionado.
4. Menu → **Inteligência Preditiva** → selecionar região → mostrar fatores, manutenção e backtest.
5. Voltar à Central → Mission Control → **Restaurar equipamento**.
6. Confirmar timeline com alerta resolvido e indicador atualizado.

## Gravação manual

Não há arquivo de vídeo incluído nesta entrega. Para gravar, use um gravador local de tela, mantenha o navegador em `127.0.0.1`, não exiba o terminal com conteúdo de `.env` e siga o roteiro sem editar a timeline. O resultado da gravação deve ser reproduzido e conferido antes de ser enviado à organização do desafio.
