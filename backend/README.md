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
npm run test:turmas      # confere as turmas e a regra dono/gestão/admin
npm run test:alunos      # confere os alunos, a regra "só a gestão exclui" e a importação
npm run test:disciplinas # confere as matérias e os vínculos matéria ↔ turma
npm run test:membros     # confere os membros das eletivas
npm run test:calendario  # confere a grade de horários e o ano letivo
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
| `npm run test:turmas` | Conferência das turmas: CRUD, validação e padrão A (dono altera, gestão só lê, admin tudo) (idem) |
| `npm run test:alunos` | Conferência dos alunos: CRUD, filtros, padrão C (só a gestão exclui) e importação da planilha (idem) |
| `npm run test:disciplinas` | Conferência das matérias e dos vínculos matéria ↔ turma, com o padrão A (idem) |
| `npm run test:membros` | Conferência dos membros das turmas personalizadas (eletivas) (idem) |
| `npm run test:calendario` | Conferência da grade de horários e do ano letivo (só o admin altera; não mexe nos dados reais) |

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

## Turmas

Padrão A do PRD (§3.1), em `src/lib/acesso.ts`: o professor vê e altera só as próprias turmas, a gestão vê
todas (só leitura) e o admin pode tudo. Turma de outro professor responde 404, como se não existisse.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /turmas` | logado | Lista em ordem de nome: colunas da tabela + `alunos_count` e `membros_count` |
| `GET /turmas/:id` | dono, gestão | Uma turma, no mesmo formato |
| `POST /turmas` | logado | `{ nome, serie, turno?, ano_letivo?, capacidade?, observacoes?, tipo? }`. 201. O dono é quem cria (`user_id` do corpo é ignorado) |
| `PATCH /turmas/:id` | dono, admin | Altera só os campos enviados (corpo vazio → 400) |
| `DELETE /turmas/:id` | dono, admin | 204. Só turma **sem alunos** (inclusive inativos) → senão 409 `TURMA_COM_ALUNOS`. Vínculos de eletiva saem junto |

`turno`: `Manhã` (padrão), `Tarde`, `Noturno`, `Integral`. `tipo`: `regular` (padrão) ou `personalizada`.

### Membros das eletivas (turmas personalizadas)

| Rota | Quem | O que faz |
|---|---|---|
| `GET /turmas/:id/membros?ativo=` | dono, gestão | Membros em ordem de nome, com `alunos: { id, nome, numero_chamada, serie, ativo, turma_id, turmas: { nome, serie } }` (turma de origem) |
| `PUT /turmas/:id/membros` | dono, admin | `{ aluno_ids: [...] }`: substitui os membros (`[]` esvazia). Só em turma `personalizada` |

Os alunos continuam na turma de origem; os vínculos ficam no nome do dono da eletiva. Excluir a eletiva ou o
aluno remove o vínculo. Erros: `ALUNO_INVALIDO` (400), `TURMA_NAO_PERSONALIZADA` (400), além dos das turmas.
Erros: `DADOS_INVALIDOS` (400), `SEM_PERMISSAO` (403, gestão tentando alterar), `TURMA_NAO_ENCONTRADA` (404),
`TURMA_COM_ALUNOS` (409).

## Alunos

Padrão C do PRD: cadastro compartilhado da escola. Qualquer usuário logado lê, cadastra e edita; **só a gestão
exclui** (o professor inativa com `"ativo": false`). Cada aluno vem com as colunas da tabela + `turmas: { nome, serie }`
(mesmo formato do `select('*, turmas(nome, serie)')` do Supabase) e `data_nascimento` como `AAAA-MM-DD`.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /alunos?turma_id=&ativo=&ordem=` | logado | `turma_id`: uma ou várias (vírgula ou parâmetro repetido); `ativo`: `true`/`false`; `ordem`: `turma` (padrão), `numero_chamada` ou `nome` |
| `GET /alunos/:id` | logado | Um aluno |
| `POST /alunos` | logado | `{ turma_id, nome, numero_chamada?, serie?, data_nascimento?, email?, telefone?, responsavel?, observacoes?, ativo? }`. 201. Sem `serie`, herda a da turma |
| `PATCH /alunos/:id` | logado | Altera só os campos enviados (inclusive trocar de turma) |
| `DELETE /alunos/:id` | gestão | 204. Notas e registros do aluno saem junto |
| `POST /alunos/importar` | logado | `{ linhas: [{ numero_chamada?, nome, turma }] }` (até 2000). Devolve `{ importados, turmas_criadas, erros: [{ linha, motivo }] }` |

Não pode haver dois alunos com o mesmo nome (sem diferenciar maiúsculas) na mesma turma: 409 `ALUNO_DUPLICADO`.
Na importação, `turma` aceita `7°A`, `7A`, `7º A`…; as turmas que o usuário ainda não enxerga são criadas no
nome dele (série inferida: `7º Ano`, `1º Ano EM`; turno Manhã). Linhas com problema são puladas e informadas;
as demais entram numa única transação. Erros: `DADOS_INVALIDOS` (400), `TURMA_INVALIDA` (400, turma inexistente),
`SEM_PERMISSAO` (403), `ALUNO_NAO_ENCONTRADO` (404), `ALUNO_DUPLICADO` (409), `CORPO_GRANDE_DEMAIS` (413, acima de 1 MB).

## Matérias (disciplinas)

Padrão A, como as turmas: o professor vê e altera só as próprias matérias e os vínculos delas; a gestão vê
todas (só leitura); o admin pode tudo. Matéria de outro professor responde 404.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /disciplinas` | logado | Lista em ordem de nome (colunas da tabela) |
| `GET /disciplinas/:id` | dono, gestão | Uma matéria |
| `POST /disciplinas` | logado | `{ nome, cor?, professor?, carga_horaria? }`. 201. O dono é quem cria |
| `PATCH /disciplinas/:id` | dono, admin | Altera só os campos enviados |
| `DELETE /disciplinas/:id` | dono, admin | 204. Vínculos saem junto; planos, notas e provas ficam sem matéria (`SetNull`) |
| `PUT /disciplinas/:id/turmas` | dono, admin | `{ turma_ids: [...] }`: substitui as turmas em que a matéria aparece (`[]` tira de todas). Devolve os vínculos |
| `GET /turma-disciplinas?turma_id=&disciplina_id=&user_id=` | logado | Vínculos com `turmas: { id, nome, serie, tipo }` e `disciplinas: { id, nome, cor, user_id }` |

`cor`: `azul` (padrão), `roxo`, `verde`, `vermelho`, `laranja`, `rosa`, `amarelo`, `ciano`, `indigo`, `cinza`, ou
`__inativa` (a tela usa essa "cor" para marcar matéria inativa). No `PUT`, só entram turmas que quem altera
enxerga, e os vínculos ficam sempre no nome do dono da matéria. Erros: `DADOS_INVALIDOS` (400),
`TURMA_INVALIDA` (400), `SEM_PERMISSAO` (403), `DISCIPLINA_NAO_ENCONTRADA` (404).

## Grade de horários e ano letivo

Padrão C: cadastro da escola. Qualquer usuário logado lê; **só o admin** cria, altera e exclui.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /horario-grade` | logado | Faixas do dia em ordem, com `hora_inicio`/`hora_fim` como `HH:MM:SS` |
| `POST /horario-grade` | admin | `{ ordem, rotulo, hora_inicio: 'HH:MM', hora_fim: 'HH:MM', tipo? }` (`aula` (padrão), `intervalo`, `almoco`, `planejamento`) |
| `PATCH /horario-grade/:id` | admin | Altera só o enviado |
| `DELETE /horario-grade/:id` | admin | 204. Faixa usada na agenda de algum professor → 409 `HORARIO_EM_USO` (no banco, a rotina dele sairia junto) |
| `GET /ano-letivo` | logado | Anos do mais recente para o mais antigo, datas como `AAAA-MM-DD` |
| `POST /ano-letivo` | admin | `{ ano, data_inicio, data_fim, ativo? }`. Ano repetido → 409 `ANO_LETIVO_DUPLICADO` |
| `PATCH /ano-letivo/:id` / `DELETE /ano-letivo/:id` | admin | Altera só o enviado / 204 |

O fim precisa ser depois do início (horário e período). Erros: `DADOS_INVALIDOS` (400), `SEM_PERMISSAO` (403),
`HORARIO_NAO_ENCONTRADO` / `ANO_LETIVO_NAO_ENCONTRADO` (404), `HORARIO_EM_USO` / `ANO_LETIVO_DUPLICADO` (409).

## Collection do Bruno

Em [`bruno/`](bruno/): abra no Bruno com **Open Collection**, escolha o ambiente **Local** e preencha a
variável secreta `senha` (e `novaSenha`, para trocar a senha). **Auth > Entrar** salva o token sozinho na
variável `token`. As variáveis secretas ficam só no seu Bruno, nunca no git.

Também roda pelo terminal (com a API ligada):

```bash
cd bruno
npx @usebruno/cli run --env Local --env-var senha=SUA_SENHA
```
