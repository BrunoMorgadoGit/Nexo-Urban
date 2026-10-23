# F.O.G.O. — instruções do projeto

Estas regras complementam o `AGENTS.md` global e as skills selecionadas conforme a tarefa. Não replique aqui seus checklists especializados.

## Escopo e arquitetura

- Monorepo npm com `apps/web` (Angular), `apps/api` (NestJS), `packages/contracts` (tipos compartilhados estáveis) e `docs`.
- O frontend cuida da apresentação, navegação e interação; o backend é a autoridade para regras de negócio, autenticação, autorização, validação e acesso a dados.
- A API usa REST sob `/api/v1`; mantenha contratos aptos a evoluir para eventos SSE sem acoplar o cliente a detalhes internos.
- A camada de persistência pertence à API: TypeORM, PostgreSQL e migrations versionadas. `synchronize` deve permanecer desabilitado; não altere schema implicitamente em runtime.
- Preserve fronteiras simples. Compartilhe em `packages/contracts` apenas tipos de transporte que sejam realmente usados por mais de um workspace; nunca compartilhe entidades ORM.
- MapLibre e domínios do desafio serão introduzidos em etapas próprias, após definir requisitos e dados de inventário.

## Angular

- Use standalone components, templates e estilos pequenos e co-localizados; mantenha lazy loading quando surgirem áreas independentes.
- Use Signals para estado local derivado ou reativo quando trouxer clareza; não introduza estado global sem necessidade funcional.
- Componentes de apresentação não fazem chamadas HTTP diretas nem incorporam regras de domínio. Encapsule integração em serviços tipados.
- Prefira APIs e padrões compatíveis com a versão Angular instalada e siga a skill local `angular-developer` em tarefas Angular.
- Preserve identidade, tokens e acessibilidade ao alterar a interface; consulte a skill global `product-ui-standards` para trabalho de UI.

## NestJS, DTOs e persistência

- Organize `src` por módulos de domínio conforme os requisitos forem definidos; cada módulo mantém controller (HTTP), service (casos de uso) e persistência próximos, sem criar camadas vazias antecipadamente.
- Controllers traduzem HTTP e delegam. Services concentram casos de uso; repositórios/TypeORM encapsulam persistência quando houver complexidade ou necessidade de teste.
- DTOs de entrada definem contratos HTTP e validações explícitas. Entidades TypeORM representam persistência e não devem ser serializadas como DTOs públicos.
- Configure `ValidationPipe` global com transformação, whitelist e rejeição de propriedades desconhecidas. Normalize erros em respostas seguras e não exponha stack traces ou mensagens internas.
- Use transações para operações que precisem de atomicidade, índices/constraints no banco para invariantes persistentes e migrations revisadas para toda alteração de schema.
- Mantenha endpoints protegidos com autenticação e autorização no servidor quando o modelo de acesso for introduzido. Não crie controles simulados.

## Segurança e configuração

- Use a skill global `secure-web-development` para mudanças com impacto em autenticação, autorização, dados, API, sessões ou segredos.
- Leia configuração do ambiente por validação tipada; não registre credenciais, tokens, payloads sensíveis ou URLs com segredos.
- Restrinja CORS às origens configuradas, valide limites e formatos no servidor e use consultas parametrizadas/ORM.
- Segredos locais ficam em `.env`, ignorado pelo Git. Atualize `.env.example` apenas com nomes e valores de exemplo não sensíveis.

## Interface e acessibilidade

- A identidade-base é escura, profissional e responsiva. Tokens globais vivem em `apps/web/src/styles.scss`; estilos de componente permanecem locais.
- Reutilize padrões apenas quando houver repetição real. Evite adicionar bibliotecas de UI, ícones ou componentes ainda sem uso.
- Use HTML semântico, rótulos associados a campos, foco visível, contraste suficiente e navegação por teclado. Trate loading, vazio, erro, sucesso e disabled quando a interação os exigir.
- Em telas existentes, mudanças pontuais devem preservar hierarquia e estrutura, salvo pedido explícito de redesenho.

## Testes e qualidade

- Angular usa Vitest/TestBed; API usa Vitest para unidade e Supertest para integração HTTP. Escolha a menor camada que prove o comportamento e cubra falhas relevantes.
- Mantenha testes determinísticos; mocks devem representar fronteiras externas e não substituir a regra testada.
- Antes de concluir mudanças, execute build, lint e testes pertinentes disponíveis; para mudanças de persistência, valide as migrations contra PostgreSQL local quando possível.
- Registre no relato o que foi executado, o que falhou e o que não foi executado. Não afirme validação sem saída observada.
