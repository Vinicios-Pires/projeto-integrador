# painelescolar-api

Backend próprio do Painel Escolar Inteligente (Node.js + Express + TypeScript + Prisma + PostgreSQL/Neon).
O Supabase fica apenas como armazenamento de arquivos.

Planejamento e progresso por fase: [`../docs/`](../docs/).

## Rodando localmente

```bash
npm install
cp .env.example .env     # preencher DATABASE_URL / DIRECT_URL (Neon) e ADMIN_BOOTSTRAP_EMAIL
npm run prisma:deploy    # aplica as migrations no banco
npm run seed             # grade de horários, ano letivo e 1º admin
npm run db:check         # confere estrutura, regras e dados iniciais
npm run test:login       # confere o login (cria e apaga usuários de teste)
npm run test:cadastro    # confere cadastro, papéis e limite de tentativas
npm run test:usuarios    # confere a gestão de usuários pelo admin
npm run dev              # http://localhost:3333/health
```

> Neon no plano gratuito "dorme" após alguns minutos sem uso; o `connect_timeout=15`
> nas strings de conexão dá tempo para ele acordar.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe a API com recarga automática |
| `npm run typecheck` | Confere os tipos sem gerar build |
| `npm run build` / `npm start` | Build de produção e execução |
| `npm run prisma:migrate` | Cria/aplica migration em desenvolvimento (`prisma migrate dev`) |
| `npm run prisma:deploy` | Aplica migrations pendentes (produção) |
| `npm run prisma:studio` | Abre um visualizador do banco no navegador |
| `npm run seed` | Dados iniciais (idempotente) |
| `npm run db:check` | Conferência do banco (não altera dados) |
| `npm run test:login` | Conferência do login via HTTP (usuários de teste temporários, apagados no fim) |
| `npm run test:cadastro` | Conferência do cadastro, dos papéis nas rotas e do limite de tentativas (idem) |
| `npm run test:usuarios` | Conferência da gestão de usuários: listar, aprovar, inativar, papel, resetar senha (idem) |

## Schema

`prisma/schema.prisma`: 40 tabelas do modelo de dados original (mesmos nomes, snake_case) + `usuarios`
(login próprio). Regras que o Prisma não expressa (CHECKs e um índice único parcial) estão no final de
`prisma/migrations/*_init/migration.sql`.

## Primeiro administrador

Criado pelo seed com o e-mail de `ADMIN_BOOTSTRAP_EMAIL`. Se `ADMIN_BOOTSTRAP_PASSWORD` estiver vazio,
uma senha temporária é gerada e exibida uma única vez; a troca é exigida no primeiro acesso.

## Autenticação

JWT próprio (`Authorization: Bearer <token>`), assinado com `JWT_SECRET` e válido por `JWT_EXPIRES_IN`.
O token só carrega o id do usuário; status, papel e "precisa trocar a senha" são relidos do banco a cada
requisição (inativar alguém corta o acesso na hora).

| Rota | O que faz |
|---|---|
| `POST /auth/signup` `{ nome, email, senha }` | Cria conta `pendente` + papel `professor` (só `@ALLOWED_EMAIL_DOMAIN`). 201, sem token |
| `POST /auth/login` `{ email, senha }` | Devolve `{ token, user, role, profile, deve_trocar_senha }` |
| `GET /me` | Mesmos dados (sem token) do dono do token |
| `POST /auth/change-password` `{ senha_atual, nova_senha }` | Troca a própria senha (8 a 72 caracteres) e libera a senha temporária |

Erros vêm como `{ error: { code, message } }`. Códigos do login: `CREDENCIAIS_INVALIDAS`, `CONTA_PENDENTE`,
`CONTA_INATIVA`, `NAO_AUTENTICADO`, `SENHA_TEMPORARIA`, `SENHA_ATUAL_INCORRETA`, `SENHA_FRACA`,
`SENHA_REPETIDA`, `SENHA_LONGA`, `DADOS_INVALIDOS`, `EMAIL_INVALIDO`, `DOMINIO_NAO_PERMITIDO`,
`EMAIL_JA_CADASTRADO` (409), `SEM_PERMISSAO` (403), `MUITAS_TENTATIVAS` (429).

Novas rotas protegidas usam `requireAuth()` (`src/middlewares/auth.ts`), que também barra quem ainda está
com senha temporária. Só `/me` e `/auth/change-password` usam `requireAuth({ allowTempPassword: true })`.

### Gestão de usuários

| Rota | Quem | O que faz |
|---|---|---|
| `GET /users?status=&busca=` | gestão | Lista `{ id, nome, email, status, role, deve_trocar_senha, created_at }`, mais recentes primeiro |
| `PATCH /users/:id/status` `{ status }` | admin | `ativo` (aprovar/reativar) ou `inativo` |
| `PATCH /users/:id/role` `{ role }` | admin | Substitui os papéis por exatamente um |
| `POST /users/:id/reset-password` | admin | Devolve `{ usuario, senha_temporaria }` (exibida só aqui; troca obrigatória no próximo acesso) |

O admin não pode inativar, rebaixar nem resetar a si mesmo (`ACAO_EM_SI_MESMO`), o que garante que sempre
sobra um admin ativo. Id inexistente ou malformado → 404 `USUARIO_NAO_ENCONTRADO`.

Rotas por papel usam `requireRole(...)` (`src/middlewares/roles.ts`), que já inclui o `requireAuth()`.
O admin sempre passa. `GESTAO` = coordenador, direção, vice-direção e admin (igual ao `isGestao` do frontend).

```ts
router.get('/x', requireRole(...GESTAO), handler); // só gestão
router.patch('/y', requireRole('admin'), handler); // só admin
```

Limite de tentativas por IP (em memória): login conta só as **erradas** (`LOGIN_MAX_TENTATIVAS` a cada
15 min) e cadastro conta todas (`CADASTRO_MAX_POR_HORA`). No Render, use `TRUST_PROXY=1` para o limite
enxergar o IP real de quem acessa.

## Collection do Bruno

Em [`bruno/`](bruno/): abra no Bruno com **Open Collection**, escolha o ambiente **Local** e preencha a
variável secreta `senha` (e `novaSenha`, para trocar a senha). **Auth > Entrar** salva o token sozinho na
variável `token`. As variáveis secretas ficam só no seu Bruno, nunca no git.

Também roda pelo terminal (com a API ligada):

```bash
cd bruno
npx @usebruno/cli run --env Local --env-var senha=SUA_SENHA
```
