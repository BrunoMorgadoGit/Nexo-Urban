# Banco demonstrativo local

## Destino

O banco preparado para a demonstração chama-se `fogo_demo_final`. É um banco PostgreSQL separado de `fogo` e `fogo_e2e`; migrations, seeds, consultas e a validação operacional desta etapa apontaram somente para ele. O banco principal `fogo` foi consultado apenas em modo somente leitura e os registros BROWSER-E2E permaneceram intactos. A suíte E2E não foi executada.

Neste computador, `fogo_demo_final` está no mesmo PostgreSQL Compose local, cluster e volume persistente de `fogo`, com o proprietário local `fogo`. A separação é por banco PostgreSQL; ela não isola um processo local com privilégios de superusuário. Não use esse modelo de credenciais em uma implantação compartilhada ou pública. Uma implantação real exige outro servidor e usuários de menor privilégio.

## `.env` local

Em um clone novo, copie `.env.example` uma única vez. Não sobrescreva um `.env` existente. Configure localmente:

- `POSTGRES_DB=fogo_demo_final`
- `POSTGRES_PASSWORD` com uma senha local
- `DATABASE_URL` com o mesmo usuário/senha e o banco `fogo_demo_final`, por exemplo no formato `postgresql://fogo:<senha-local>@127.0.0.1:5437/fogo_demo_final` (substitua `<senha-local>`; não inclua os sinais `< >`)
- `POSTGRES_PORT=5437`
- `E2E_DATABASE_NAME=` e `E2E_DATABASE_URL=` sem valor para a execução normal

Restrinja `.env` com `chmod 600 .env` e não o envie ao Git.

Em um volume Compose novo, `POSTGRES_DB` faz o entrypoint criar `fogo_demo_final`. Se o volume já foi inicializado com `fogo`, mudar `POSTGRES_DB` não cria outro banco. Não apague o volume. Primeiro confira se o destino existe:

```bash
docker compose exec -T db psql -U fogo -d postgres -c "SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = 'fogo_demo_final';"
```

Se não houver linha, use `CREATE DATABASE` apenas após confirmar que a conexão é o administrador local esperado e que o nome continua ausente:

```bash
docker compose exec -T db psql -U fogo -d postgres -c 'CREATE DATABASE fogo_demo_final OWNER fogo TEMPLATE template0;'
```

Não execute esse comando se o banco já existir. Não remova bancos nem volumes existentes.

## Validar antes de migrations ou seeds

Depois de `npm run db:up`, execute esta verificação com a URL efetiva do `.env`. Ela exige host de loopback e o nome exato `fogo_demo_final`, conecta usando `DATABASE_URL` e imprime somente banco e usuário:

```bash
node --env-file=.env -e 'const { Client } = require("pg"); const url = new URL(process.env.DATABASE_URL); if (url.hostname !== "127.0.0.1" || url.pathname !== "/fogo_demo_final") throw new Error("DATABASE_URL deve apontar ao PostgreSQL local e a fogo_demo_final."); const client = new Client({ connectionString: url.toString() }); (async () => { try { await client.connect(); const result = await client.query("SELECT current_database() AS database, current_user AS username"); if (result.rows[0].database !== "fogo_demo_final") throw new Error("O banco conectado não é fogo_demo_final."); console.log(`Destino validado: ${result.rows[0].database}; usuário ${result.rows[0].username}.`); } finally { await client.end(); } })().catch((error) => { console.error(error.message); process.exitCode = 1; });'
```

Continue somente se a saída disser `fogo_demo_final`. Repita a verificação antes de cada migration ou seed; não substitua o destino por `fogo` nem por `fogo_e2e`.

## Migrations, dados e idempotência

Com o alvo validado:

```bash
npm run db:migrations:show
npm run db:migrate
npm run db:seed
npm run db:seed:intelligence
```

O inventário base deve conter 12 equipamentos demonstrativos, 8 agentes e 4 manutenções. O dataset `campinas-city-history-v1` contém 219 eventos sintéticos. Confirme também a ausência de seriais BROWSER-E2E:

```bash
docker compose exec -T db psql -U fogo -d fogo_demo_final -c "SELECT (SELECT count(*) FROM equipment) AS equipment, (SELECT count(*) FROM agents) AS agents, (SELECT count(*) FROM maintenances) AS maintenances, (SELECT count(*) FROM intelligence_history_events) AS historical_events, (SELECT count(*) FROM equipment WHERE serial_number LIKE 'BROWSER-E2E%') AS browser_e2e;"
```

Reexecute `db:seed` e `db:seed:intelligence` somente depois de validar o destino. O resultado esperado permanece em 12 equipamentos, 8 agentes e 219 eventos históricos; a segunda execução do seed histórico deve retornar `inserted: 0`. Os seeds fazem upsert e não limpam tabelas.

Quando a API iniciar, o monitoramento reconcilia condições dos equipamentos de demonstração e cria os alertas correspondentes. A Análise Preventiva usa o histórico sintético marcado como `synthetic`; o incidente do Mission Control é uma simulação operacional separada.

## Iniciar a demonstração

Confirme primeiro que `DATABASE_URL` no `.env` termina em `/fogo_demo_final`, rode a verificação de destino acima e só então inicie os processos em terminais separados:

```bash
nvm use
npm run dev:api
```

```bash
nvm use
npm run dev:web
```

Acesse `http://127.0.0.1:4200`. `dev:api` habilita o Mission Control em desenvolvimento; a API continua sem autenticação e vinculada a loopback. Não publique a API. O Mapa Vivo precisa de conectividade com os tiles do OpenStreetMap e da atribuição visível.

## Estado desta preparação

No banco deste computador, as três migrations estão aplicadas; os seeds criaram 12 equipamentos, 8 agentes e 219 eventos sem seriais BROWSER-E2E. As duas seeds foram executadas outra vez e mantiveram essas contagens. A validação operacional persistiu um ciclo restaurado de `DEMO-RAD-001` com seis eventos na timeline (falha, alerta, ações e restauração). Esse histórico é intencionalmente persistente; não foi apagado após o teste. Os bancos `fogo` e `fogo_e2e` não foram modificados.
