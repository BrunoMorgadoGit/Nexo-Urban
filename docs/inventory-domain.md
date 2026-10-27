# Modelo do Inventário Inteligente

## Equipamentos e tipos

`equipment_types` registra código, rótulo, mobilidade e descritores de campos para a interface. `equipment.characteristics` é JSONB, mas não aceita propriedades arbitrárias: `equipment-characteristics.ts` mantém schemas Zod estritos para radar, câmera, balança, veículo de fiscalização, cancela, transporte, totem, patinete, motocicleta e viatura.

Para adicionar um tipo, registre seus descritores e validador, adicione o tipo ao seed e crie exemplos sintéticos. A estrutura do banco permanece a mesma. Regras de mobilidade separam o endereço fixo ou a base operacional da última posição conhecida.

Os estados de equipamento são `not_installed`, `operational`, `malfunctioning`, `maintenance`, `deactivated` e `stolen`. A prioridade de manutenção (`low`, `normal`, `high`, `immediate`) é independente desse estado. Matrícula/série, estados, coordenadas, CEP e chaves estrangeiras têm validação no backend e constraints no PostgreSQL.

## Agentes e localização

O cadastro guarda nome, identificador funcional único, categoria (`traffic_agent`, `municipal_guard`, `military_police_officer`, `civil_police_officer`, `other`; `police_officer` permanece para compatibilidade com registros antigos), órgão, situação (`available`, `on_duty`, `unavailable`, `off_duty`), observações operacionais opcionais e equipamento vinculado opcional. `agents.equipment_id` referencia um equipamento existente; vários agentes podem compartilhar o mesmo equipamento.

`operational_bases` contém bases reutilizáveis com região e coordenadas opcionais. `agent_positions` mantém separadamente uma última posição conhecida e o instante de coleta. O Mapa Vivo usa a última posição informada do agente, a última posição conhecida do equipamento vinculado ou, na ausência dessas, as coordenadas fixas da base, identificando claramente a fonte. Uma base nunca é apresentada como localização atual; não há rastreamento contínuo de pessoas nem integração com dispositivos de telemetria.

Endereços de equipamento ficam em `equipment_locations`, ligados a `regions` como referência de bairro. Cidade e UF vêm do endereço informado (preenchidas pela consulta ViaCEP/OpenStreetMap quando disponível) e são persistidas independentemente da cidade da região; a região não sobrescreve esses campos. Coordenadas são números decimais validados em longitude/latitude. Posições de equipamentos e agentes ficam em tabelas próprias, evitando confundir a base fixa com deslocamento.

## Manutenção

`maintenances` conserva histórico, tipo de serviço, prioridade, descrição, data prevista e estado (`scheduled`, `in_progress`, `completed`, `cancelled`). Serviços vencidos são consultas derivadas de data e situação; registros concluídos ou cancelados não entram na fila vencida. O fluxo aceita agendado → em andamento → concluído ou cancelado. Prioridade e estado operacional não são sincronizados automaticamente.

## Dados demonstrativos e privacidade

O seed usa identificadores e nomes fictícios, bairros de referência e coordenadas aproximadas para demonstração da região de Campinas. Os registros de agentes não contêm nomes de pessoas reais. `npm run db:seed` faz upsert por chaves únicas, mantendo o mesmo conjunto em execuções sucessivas.

## API

A API atende sob `/api/v1`, vinculada a `127.0.0.1` neste ambiente. `GET/POST/PUT/DELETE /agents` executam o CRUD operacional, `GET /agents/operational-bases` lista bases reutilizáveis e `POST/PUT /agents` podem criar uma nova base junto com o agente. DTOs rejeitam campos desconhecidos; JSONB técnico recebe validação por tipo; erros de banco retornam mensagens seguras. A migration `ExtendOperationalAgents` adiciona bases, vínculo de equipamento, observações e categorias profissionais; `synchronize` permanece desabilitado.
