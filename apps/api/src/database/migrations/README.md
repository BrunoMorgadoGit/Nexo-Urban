# Migrations TypeORM

Versione neste diretório somente migrations revisadas. O schema de inventário, monitoramento e inteligência já é criado por migrations versionadas. Revise o SQL de cada mudança aditiva e execute `npm run db:migrate` apenas no banco pretendido.

`synchronize` e `migrationsRun` permanecem desativados na inicialização da API. Para E2E, use somente um banco dedicado identificado por `E2E_DATABASE_NAME`; nunca execute migrations ou seeds no banco de operação como preparação dos testes.
