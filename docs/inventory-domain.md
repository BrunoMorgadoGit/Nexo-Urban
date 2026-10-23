# Modelo do Inventário Inteligente

## Equipamentos e tipos

`equipment_types` registra código, rótulo, mobilidade e descritores de campos para a interface. `equipment.characteristics` é JSONB, mas não aceita propriedades arbitrárias: `equipment-characteristics.ts` mantém schemas Zod estritos para radar, câmera, balança, veículo de fiscalização, cancela, transporte, totem, patinete, motocicleta e viatura.

Para adicionar um tipo, registre seus descritores e validador, adicione o tipo ao seed e crie exemplos sintéticos. A estrutura do banco permanece a mesma. Regras de mobilidade separam o endereço fixo ou a base operacional da última posição conhecida.

Os estados de equipamento são `not_installed`, `operational`, `malfunctioning`, `maintenance`, `deactivated` e `stolen`. A prioridade de manutenção (`low`, `normal`, `high`, `immediate`) é independente desse estado. Matrícula/série, estados, coordenadas, CEP e chaves estrangeiras têm validação no backend e constraints no PostgreSQL.

## Agentes e localização

O cadastro guarda somente nome demonstrativo, identificador funcional, categoria (`traffic_agent`, `municipal_guard`, `police_officer`), órgão e disponibilidade (`available`, `on_duty`, `unavailable`, `off_duty`). `agent_positions` mantém uma posição conhecida e seu instante de coleta; telemetria e histórico de posições ficam para etapa futura.

Endereços de equipamento ficam em `equipment_locations`, ligados a `regions` com cidade e UF. Coordenadas são números decimais validados em longitude/latitude. Posições atuais de equipamentos e agentes ficam em tabelas próprias, evitando confundir a base fixa com deslocamento.

## Manutenção

`maintenances` conserva histórico, tipo de serviço, prioridade, descrição, data prevista e estado (`scheduled`, `in_progress`, `completed`, `cancelled`). Serviços vencidos são consultas derivadas de data e situação; registros concluídos ou cancelados não entram na fila vencida. O fluxo aceita agendado → em andamento → concluído ou cancelado. Prioridade e estado operacional não são sincronizados automaticamente.

## Dados demonstrativos e privacidade

O seed usa identificadores e nomes fictícios, bairros de referência e coordenadas aproximadas para demonstração da região de Campinas. Os registros de agentes não contêm nomes de pessoas reais. `npm run db:seed` faz upsert por chaves únicas, mantendo o mesmo conjunto em execuções sucessivas.

## API

A API atende sob `/api/v1`, vinculada a `127.0.0.1` neste ambiente. DTOs rejeitam campos desconhecidos; JSONB técnico recebe validação por tipo; erros de banco retornam mensagens seguras. O esquema de domínio é criado somente pela migration `CreateInventoryDomain`; `synchronize` permanece desabilitado.
