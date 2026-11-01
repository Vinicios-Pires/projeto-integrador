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
npm run test:arquivos    # confere o correio de arquivos (pasta temporária)
npm run test:supabase-storage # confere a ligação com o Supabase Storage (contra um Supabase simulado)
npm run test:notas       # confere as avaliações e as notas
npm run test:medias      # confere as médias arredondadas
npm run test:provas      # confere as provas e os gabaritos
npm run test:correcao    # confere a correção das provas
npm run test:planejamentos # confere o planejamento bimestral e a validação
npm run test:planos      # confere os planos de aula, duplicar, ajustes e a trava
npm run test:aprovacao   # confere a aprovação dos planos e os anexos
npm run test:diario      # confere o diário de classe
npm run test:agenda      # confere a agenda do professor
npm run test:escola      # confere eventos da escola, apoio presencial e lembretes
npm run test:ocorrencias # confere as ocorrências (notebook, com fotos, e escolares)
npm run test:pdi         # confere as evidências do PDI, com fotos e documentos
npm run test:tutoria     # confere a tutoria (tutorados e acompanhamento)
npm run test:replicabilidade # confere o mural de replicabilidade
npm run test:tela-login  # confere as telas de login no navegador (precisa do npm install no frontend)
npm run test:tela-cadastros # confere as telas de turmas, eletivas, alunos e matérias no navegador
npm run test:tela-notas  # confere as telas de notas, correção de provas e Prova Paulista no navegador
npm run test:tela-planos # confere a tela de plano de aula (planilha, anexos e validação) no navegador
npm run test:tela-diario-agenda # confere diário, agenda, lembretes, relatórios e painel da gestão no navegador
npm run test:tela-ocorrencias-pdi # confere ocorrências, PDI, tutoria e replicabilidade (com arquivos) no navegador
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
| `npm run test:arquivos` | Conferência do correio de arquivos: enviar, links temporários, excluir e quem pode (armazenamento local temporário) |
| `npm run test:supabase-storage` | Conferência do driver do Supabase Storage contra um Supabase simulado (chave, caminhos, links em lote, nada vaza) |
| `npm run test:notas` | Conferência das avaliações e notas, com o padrão A (usuários e dados temporários) |
| `npm run test:medias` | Conferência das médias arredondadas (ajuste manual da média final, usuários e dados temporários) |
| `npm run test:provas` | Conferência das provas e gabaritos, com o padrão A (usuários e dados temporários) |
| `npm run test:correcao` | Conferência da correção de provas: acertos, nota e recálculo (usuários e dados temporários) |
| `npm run test:planejamentos` | Conferência do planejamento bimestral e da validação pela gestão (usuários e dados temporários) |
| `npm run test:planos` | Conferência dos planos de aula: aulas, duplicar, copiar para baixo, ajustes e a trava do validado |
| `npm run test:aprovacao` | Conferência da aprovação dos planos pela gestão e dos anexos (pasta temporária de arquivos) |
| `npm run test:diario` | Conferência do diário de classe: atividades, lançamentos e observações (usuários e dados temporários) |
| `npm run test:agenda` | Conferência da agenda do professor: rotina e exceções (horários de grade próprios do teste) |
| `npm run test:escola` | Conferência dos eventos da escola, do apoio presencial e dos lembretes (eventos no ano de 2099) |
| `npm run test:ocorrencias` | Conferência das ocorrências do notebook (com fotos, pasta temporária) e das escolares |
| `npm run test:pdi` | Conferência das evidências do PDI, com fotos e documentos (pasta temporária) |
| `npm run test:tutoria` | Conferência da tutoria: tutorados, check-ins, registros, combinados, foto e documentos (pasta temporária) |
| `npm run test:replicabilidade` | Conferência do mural de replicabilidade, com fotos (pasta temporária) |
| `npm run test:tela-login` | Conferência das telas de login do frontend num navegador de verdade (sobe API e Vite em portas livres; usa o Chromium do Playwright do frontend) |
| `npm run test:tela-cadastros` | Conferência das telas de Turmas (com eletivas), Alunos (com importação) e Matérias no navegador |
| `npm run test:tela-notas` | Conferência das telas de Notas (com colar notas e médias arredondadas), Correção de Provas e Prova Paulista no navegador |
| `npm run test:tela-planos` | Conferência da tela de Plano de Aula: planilha, datas em sequência, copiar para baixo, ajustes, anexos e validação, no navegador |
| `npm run test:tela-diario-agenda` | Conferência do Diário, da Agenda (rotina, escola, apoio presencial), dos lembretes, dos Relatórios e do painel da gestão, no navegador |
| `npm run test:tela-ocorrencias-pdi` | Conferência das Ocorrências (notebook e escolares), do PDI, da Tutoria e da Replicabilidade, com fotos e documentos, no navegador |

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

## Arquivos (correio de arquivos)

Fotos e documentos passam **só pelo backend** (o navegador não fala mais com o Storage). O armazenamento é
escolhido por `STORAGE_DRIVER`: `local` (pasta `STORAGE_LOCAL_DIR`, padrão `.storage`, fora do git) para
desenvolvimento e testes, ou `supabase` (Supabase Storage, produção).

Regra única para os 7 buckets, pela convenção do sistema atual (primeira pasta do caminho = dono):
**enviar** sempre na própria pasta; **abrir** o dono e a gestão (em `replicabilidade-fotos`, qualquer usuário
logado); **excluir** o dono e o admin. Quem não pode abrir recebe 404, como se o arquivo não existisse.

| Rota | O que faz |
|---|---|
| `POST /files/:bucket?pasta=&nome=` | Corpo = o próprio arquivo, tipo no `Content-Type`. Guarda em `<usuário>/<pasta>/<data>-<sorteio>-<nome seguro>`. 201 `{ bucket, path, nome, mime_type, tamanho_bytes }` |
| `GET /files/:bucket/url?path=&segundos=&download=` | Link temporário `{ path, url, expira_em }` (padrão 1 h; `download` = baixar com esse nome) |
| `POST /files/:bucket/urls` `{ paths, segundos? }` | Vários links (até 200); arquivo inexistente → `url: null` |
| `DELETE /files/:bucket?path=` | 204 |
| `POST /files/:bucket/excluir` `{ paths }` | `{ excluidos }`; se algum não puder, nenhum sai |
| `GET /files/link/:token` | (só `local`) abre o link temporário, sem login, até vencer |

| Bucket | Tipos | Limite |
|---|---|---|
| `ocorrencias-fotos`, `pdi-fotos`, `replicabilidade-fotos`, `tutoria-fotos` | imagens (jpeg, png, webp, gif, heic) | 10 MB |
| `pdi-documentos` | documentos (pdf, Word, Excel, PowerPoint, OpenDocument, txt, csv) | 20 MB |
| `plano-anexos`, `tutoria-documentos` | documentos e imagens | 20 MB |

Com `STORAGE_DRIVER=supabase`, o backend usa a API REST do Storage com `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` (obrigatórias nesse modo; a chave **nunca** vai para o navegador nem para as respostas,
e sai mascarada nos logs). Os links devolvidos são as URLs assinadas do próprio Supabase, geradas em lote
(uma ida só para vários arquivos). Os 7 buckets precisam existir no projeto (no atual, já existem).

Erros: `DADOS_INVALIDOS` (400, pasta ou caminho inválido), `ARQUIVO_VAZIO` (400), `SEM_PERMISSAO` (403),
`ARQUIVO_NAO_ENCONTRADO` / `BUCKET_NAO_ENCONTRADO` (404), `ARQUIVO_GRANDE_DEMAIS` (413), `TIPO_NAO_PERMITIDO` (415).

## Avaliações e notas

Padrão A: o professor vê e altera as próprias avaliações e notas; a gestão vê todas (só leitura); o admin pode
tudo. A média é calculada pela tela; o backend guarda as notas. Colunas decimais (`peso`, `nota`) saem como
**número**, como o Supabase devolve.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /tipos-avaliacao?turma_id=&disciplina_id=&bimestre=` | logado | Avaliações (colunas da planilha) em ordem |
| `POST /tipos-avaliacao` | logado | `{ nome, turma_id, disciplina_id, bimestre, peso?, categoria?, ordem?, descricao? }`. Turma e matéria precisam ser visíveis para quem cria. Sem `ordem`, vai para o fim |
| `PATCH /tipos-avaliacao/:id` | dono, admin | Altera só o enviado; mudar `bimestre` leva o das notas. Turma e matéria não mudam |
| `PUT /tipos-avaliacao/ordem` | dono, admin | `{ ids: [...] }`: nova ordem (1, 2, 3…) numa operação só |
| `DELETE /tipos-avaliacao/:id` | dono, admin | 204. As notas dela saem junto |
| `GET /notas?aluno_id=&tipo_avaliacao_id=&bimestre=&turma_id=&disciplina_id=` | logado | Notas com `tipos_avaliacao: { nome, peso, bimestre, disciplina_id, turma_id, categoria }`. `aluno_id` e `tipo_avaliacao_id` aceitam vários |
| `PUT /notas` | dono, admin | `{ notas: [{ aluno_id, tipo_avaliacao_id, nota, observacoes? }] }` (até 2000). `nota` de 0 a 10; `null` apaga. Tudo ou nada. Devolve `{ salvas, apagadas }` |

`categoria`: `normal` (padrão) ou `prova_paulista`. O bimestre e o dono da nota vêm da avaliação. O aluno precisa ser
da turma da avaliação ou membro da eletiva. Erros: `DADOS_INVALIDOS` (400), `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` /
`ALUNO_INVALIDO` / `ALUNO_FORA_DA_TURMA` (400), `SEM_PERMISSAO` (403), `AVALIACAO_NAO_ENCONTRADA` (404).

### Médias arredondadas

A média final que o professor ajusta à mão (6,8 → 7). Padrão A; uma por aluno, matéria e bimestre, no nome do
professor dono da matéria (mesmo quando o admin altera). `nota_arredondada` sai como número.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /medias-arredondadas?turma_id=&disciplina_id=&bimestre=&aluno_id=` | logado | Ajustes guardados. `aluno_id` aceita vários |
| `PUT /medias-arredondadas` | dono, admin | `{ turma_id, disciplina_id, bimestre, medias: [{ aluno_id, nota_arredondada, manual? }] }` (até 2000). De 0 a 10; `null` volta ao cálculo automático. Tudo ou nada. Devolve `{ salvas, apagadas }` |
| `POST /medias-arredondadas/descartar` | dono, admin | `{ turma_id, disciplina_id, bimestre, aluno_ids? }`: "descartar todas" (ou só as desses alunos). Devolve `{ apagadas }` |

Erros: `DADOS_INVALIDOS` (400), `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` / `ALUNO_INVALIDO` / `ALUNO_FORA_DA_TURMA` (400),
`SEM_PERMISSAO` (403).

## Provas e gabaritos

Tela "Correção de Provas". Padrão A (o professor altera as próprias provas; a gestão vê todas; o admin pode tudo).
`valor_total` e `peso` saem como número; `data_aplicacao` como `AAAA-MM-DD`.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /provas?turma_id=&disciplina_id=&bimestre=` | logado | Provas (mais novas primeiro) com `turmas: { nome, serie }` e `disciplinas: { nome }` |
| `GET /provas/:id` | dono, gestão | Uma prova |
| `POST /provas` | logado | `{ titulo, turma_id?, disciplina_id?, bimestre?, numero_questoes?, data_aplicacao?, valor_total?, observacoes?, escola?, professor? }`. Padrões: 10 questões (1 a 100), valor 10, 1º bimestre |
| `PATCH /provas/:id` | dono, admin | Altera só o enviado. Menos questões apaga o gabarito das que sobram. Com respostas de alunos, a turma não muda (409 `PROVA_COM_RESULTADOS`) |
| `DELETE /provas/:id` | dono, admin | 204. Gabarito e respostas saem junto |
| `GET /provas/:id/gabarito` | dono, gestão | Gabarito em ordem de questão |
| `PUT /provas/:id/gabarito` | dono, admin | `{ questoes: [{ numero_questao, resposta_correta, anulada?, peso? }] }`: o gabarito inteiro (as que não vierem saem). Alternativas `A` a `E` |

Erros: `DADOS_INVALIDOS` (400), `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` (400), `SEM_PERMISSAO` (403),
`PROVA_NAO_ENCONTRADA` (404), `PROVA_COM_RESULTADOS` (409).

### Correção

O backend confere as respostas com o gabarito e calcula `acertos` e `nota`, com a mesma conta da tela: questão
anulada vale acerto para todos; nota = acertos ÷ número de questões × `valor_total` (2 casas). Mudar o gabarito,
o número de questões ou o valor **recalcula** as notas já corrigidas, menos as ajustadas à mão.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /provas/:id/resultados` | dono, gestão | Folhas corrigidas, em ordem de chamada, com `alunos: { nome, numero_chamada }` |
| `PUT /provas/:id/resultados` | dono, admin | `{ resultados: [{ aluno_id, respostas: { "1": "A", ... }, nota?, observacoes? }] }` (até 500). Com `nota` (0 até o valor), vira ajuste manual; `null` volta ao automático. Tudo ou nada |
| `DELETE /provas/:id/resultados/:alunoId` | dono, admin | 204. Apaga a folha de um aluno |

Erros: `DADOS_INVALIDOS` / `ALUNO_INVALIDO` / `ALUNO_FORA_DA_TURMA` (400), `SEM_PERMISSAO` (403),
`PROVA_NAO_ENCONTRADA` / `RESULTADO_NAO_ENCONTRADO` (404), `PROVA_SEM_TURMA` / `PROVA_SEM_GABARITO` (409).

## Planejamento bimestral

Padrão A para ver (o professor vê os seus; a gestão, todos) e fluxo de validação pela gestão.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /planejamentos?bimestre=&ano=&turma_id=&disciplina_id=&user_id=` | logado | Planejamentos (ano mais recente primeiro) com `turmas: { nome, serie }`, `disciplinas: { nome }` e `aulas_count` (quantas aulas a planilha tem) |
| `GET /planejamentos/:id` | dono, gestão | Um planejamento |
| `POST /planejamentos` | logado | `{ turma_id, disciplina_id?, bimestre, ano? }`. Devolve o que já existe (200) ou cria um rascunho (201). Ano padrão: o atual |
| `POST /planejamentos/:id/status` | ver abaixo | `{ status, observacao? }` |
| `DELETE /planejamentos/:id` | dono, admin | 204. As aulas continuam, fora do planejamento. Validado não sai (409 `PLANEJAMENTO_VALIDADO`) |

| De | Para | Quem |
|---|---|---|
| `rascunho` | `aguardando_validacao` | dono (ou admin) |
| `rascunho` ou `aguardando_validacao` | `validado` | gestão; grava `validado_por` e `validado_em` |
| `aguardando_validacao` ("solicitar ajustes") ou `validado` ("reabrir") | `rascunho` | gestão; limpa `validado_por` e `validado_em` |

Erros: `DADOS_INVALIDOS` / `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` (400), `SEM_PERMISSAO` (403),
`PLANEJAMENTO_NAO_ENCONTRADO` (404), `STATUS_INVALIDO` / `PLANEJAMENTO_VALIDADO` (409).

## Planos de aula

As aulas da planilha do planejamento (ou soltas). Padrão A. `data_aula` sai como `AAAA-MM-DD`; o `dia_semana` é
calculado a partir da data. **Aulas de um planejamento validado não mudam** (409 `PLANEJAMENTO_VALIDADO`), nem pelo
admin: a gestão precisa reabrir.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /planos-aula?planejamento_id=&turma_id=&disciplina_id=&bimestre=&user_id=&status=&data=&de=&ate=&limite=` | logado | Aulas em ordem de data, com `turmas: { nome, serie }` e `disciplinas: { nome }` |
| `GET /planos-aula/:id` | dono, gestão | Uma aula |
| `POST /planos-aula` | logado | `{ data_aula, planejamento_id?, turma_id?, disciplina_id?, bimestre?, numero_aulas?, ...textos }`. No planejamento, turma, matéria, bimestre e dono vêm dele |
| `POST /planejamentos/:id/aulas` | dono, admin | `{ datas: [...], numero_aulas? }` (até 200): "datas em sequência" |
| `PATCH /planos-aula/:id` | dono, admin | Altera só o enviado (data, número de aulas, textos). Turma, matéria e bimestre só em aula solta |
| `PATCH /planos-aula/lote` | dono, admin | `{ ids, dados }` (até 200): "copiar para baixo". Devolve `{ alteradas }` |
| `DELETE /planos-aula/:id` | dono, admin | 204. Anexos e ajustes saem junto; as cópias ficam, sem a ligação |
| `POST /planos-aula/:id/duplicar` | dono, admin | `{ data_aula? }` (padrão: uma semana depois). Cópia pendente, com `duplicado_de` |
| `GET /planos-aula/:id/ajustes` | dono, gestão | Histórico de ajustes (PDCA), o mais novo primeiro |
| `POST /planos-aula/:id/ajustes` | dono, admin | `{ descricao }` |

Textos: `aprendizagem_essencial`, `conteudo`, `objetivos`, `recursos`, `desenvolvimento`, `material_digital`,
`avaliacao_aprendizagem`, `professor`, `habilidades`, `objetivo_geral` (vazio apaga). Erros: `DADOS_INVALIDOS` /
`TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` (400), `SEM_PERMISSAO` (403), `PLANO_NAO_ENCONTRADO` /
`PLANEJAMENTO_NAO_ENCONTRADO` (404), `PLANEJAMENTO_VALIDADO` (409).

### Aprovação e anexos

| Rota | Quem | O que faz |
|---|---|---|
| `POST /planos-aula/aprovacao` | gestão | `{ ids, status, comentario? }` (até 200). `aprovado`, `ajustado` (devolvida para ajuste) ou `pendente`. Grava `aprovado_por`, `data_aprovacao`, `comentario_aprovacao` |
| `GET /planos-aula/:id/anexos?tipo=` | dono, gestão | Anexos (`documento` ou `adaptada`). Para abrir: `GET /files/plano-anexos/url?path=<storage_path>` |
| `POST /planos-aula/:id/anexos?tipo=&nome=` | dono, admin | Corpo: o arquivo, com o `Content-Type` (até 20 MB). Fica na pasta do professor dono |
| `DELETE /planos-aula/:id/anexos/:anexoId` | dono, admin | 204. Apaga a linha e o arquivo |

Aula aprovada ou devolvida que o professor edita **volta a pendente** (o comentário fica). Excluir a aula apaga os
arquivos dos anexos. Planilha validada não recebe nem perde anexos. Erros extras: `ANEXO_NAO_ENCONTRADO` (404),
`ARQUIVO_GRANDE_DEMAIS` (413), `TIPO_NAO_PERMITIDO` (415).

## Diário de classe

Padrão A. Atividades são as colunas; lançamentos, as células (texto livre: "8,5", "MB"…); e uma observação por
aluno, turma, matéria e bimestre. `peso` sai como número; `data` como `AAAA-MM-DD`.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /diario/atividades?turma_id=&disciplina_id=&bimestre=` | logado | Colunas, na ordem |
| `POST /diario/atividades` | logado | `{ nome, turma_id, disciplina_id?, bimestre?, tipo?, data?, peso?, categoria?, observacao? }`. `tipo`: `nota` ou `conceito` |
| `PATCH /diario/atividades/:id` | dono, admin | Altera só o enviado; turma e matéria não mudam |
| `PUT /diario/atividades/ordem` | dono, admin | `{ ids }`: nova ordem (0, 1, 2…) |
| `DELETE /diario/atividades/:id` | dono, admin | 204. Os lançamentos saem junto |
| `GET /diario/lancamentos?atividade_id=&aluno_id=` | logado | Células; os dois filtros aceitam vários |
| `PUT /diario/lancamentos` | dono, admin | `{ lancamentos: [{ atividade_id, aluno_id, valor, fez?, observacao? }] }` (até 2000). Vazio apaga. Tudo ou nada |
| `GET /diario/observacoes?turma_id=&disciplina_id=&bimestre=&aluno_id=` | logado | Observações dos alunos |
| `PUT /diario/observacoes` | dono, admin | `{ aluno_id, turma_id, disciplina_id?, bimestre, observacao }`. Vazio apaga (204) |

Erros: `DADOS_INVALIDOS` / `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` / `ALUNO_INVALIDO` / `ALUNO_FORA_DA_TURMA` (400),
`SEM_PERMISSAO` (403), `ATIVIDADE_NAO_ENCONTRADA` (404).

## Agenda do professor

Cada um grava **a própria** agenda; a gestão vê a de um professor com `?user_id=`; o admin pode limpar itens de
qualquer um. Itens em lista, com "grava ou corrige" (tudo ou nada, até 400).

| Rota | Quem | O que faz |
|---|---|---|
| `GET /agenda/rotina?user_id=` | logado | A rotina da semana |
| `PUT /agenda/rotina` | logado | `{ itens: [{ dia_semana (0 = domingo … 6), horario_grade_id, turma_id?, disciplina_id?, atividade?, cor? }] }`. Um por dia e horário |
| `DELETE /agenda/rotina/:id` | dono, admin | 204. "Limpar" a célula |
| `GET /agenda/excecoes?de=&ate=&user_id=` | logado | Exceções (`data` como `AAAA-MM-DD`) |
| `PUT /agenda/excecoes` | logado | `{ itens: [{ data, horario_grade_id, turma_id?, disciplina_id?, atividade?, cancelado?, observacao? }] }`. Uma por data e horário |
| `DELETE /agenda/excecoes/:id` | dono, admin | 204. O dia volta à rotina |

Erros: `DADOS_INVALIDOS` / `HORARIO_INVALIDO` / `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` (400), `SEM_PERMISSAO` (403),
`AGENDA_NAO_ENCONTRADA` (404).

## Eventos da escola, apoio presencial e lembretes

| Rota | Quem | O que faz |
|---|---|---|
| `GET /eventos-escola?de=&ate=&tipo=` | logado | Calendário da escola, em ordem de início (`ate` inclui o dia) |
| `POST /eventos-escola` | gestão | `{ titulo, data_inicio, data_fim?, dia_todo?, tipo?, descricao?, cor? }`. Datas `AAAA-MM-DD` ou `AAAA-MM-DDTHH:MM` (sem fuso = UTC) |
| `PATCH` / `DELETE /eventos-escola/:id` | gestão | Qualquer pessoa da gestão, não só quem criou |
| `GET /apoio-presencial?de=&ate=&professor_id=` | logado | Gestão vê todos; o professor, só os seus (como professor ou responsável). Com `professor_nome` e `responsavel_nome` |
| `POST /apoio-presencial` | gestão | `{ data, professor_id, responsavel_id, horario_grade_id?, observacao? }` |
| `PATCH` / `DELETE /apoio-presencial/:id` | gestão | |
| `GET /lembretes` | logado | Os **próprios** post-its (fixados primeiro) |
| `POST /lembretes` | logado | `{ titulo, descricao?, data?, prioridade?, cor?, turma_id?, disciplina_id?, fixado? }` |
| `PATCH` / `DELETE /lembretes/:id` | dono | Ninguém mexe nos lembretes de outra pessoa, nem o admin |

`tipo` do evento: `reuniao`, `formacao`, `evento`, `avaliacao_externa`, `conselho`, `apoio_presencial`, `acompanhamento`,
`observacao`, `visita`, `aviso` (padrão). Lembretes: `prioridade` baixa/media/alta; `cor` amarelo, verde, azul, rosa,
laranja, roxo. Erros: `DADOS_INVALIDOS` / `USUARIO_INVALIDO` / `HORARIO_INVALIDO` / `TURMA_INVALIDA` (400),
`SEM_PERMISSAO` (403), `EVENTO_NAO_ENCONTRADO` / `APOIO_NAO_ENCONTRADO` / `LEMBRETE_NAO_ENCONTRADO` (404).

## Ocorrências

**Do notebook** (padrão A; cada ocorrência vem com `turmas` e `fotos`):

| Rota | Quem | O que faz |
|---|---|---|
| `GET /ocorrencias-notebook?turma_id=&de=&ate=` | logado | As mais recentes primeiro |
| `GET /ocorrencias-notebook/:id` | dono, gestão | Uma ocorrência |
| `POST /ocorrencias-notebook` | logado | `{ turma_id?, data_ocorrencia?, quantidade_notebooks?, alunos_envolvidos?, problema_encontrado?, descricao?, equipamento_danificado?, internet_funcionou?, solucao_adotada?, observacoes? }` |
| `PATCH` / `DELETE /ocorrencias-notebook/:id` | dono, admin | Excluir leva as fotos (banco e armazenamento) |
| `POST /ocorrencias-notebook/:id/fotos?nome=` | dono, admin | Corpo: a imagem (até 10 MB). Fica na pasta de quem registrou. Abrir: `GET /files/ocorrencias-fotos/url?path=` |
| `DELETE /ocorrencias-notebook/:id/fotos/:fotoId` | dono, admin | 204 |

**Escolares** (o professor registra; a gestão vê todas e responde):

| Rota | Quem | O que faz |
|---|---|---|
| `GET /ocorrencias-escolares?status=&tipo=&user_id=&aluno=&de=&ate=` | logado | O professor vê as suas; a gestão, todas. `aluno` busca parte do nome. Com `professor_nome` e `gestao_nome` |
| `POST /ocorrencias-escolares` | logado | `{ tipo, descricao, data?, turma?, disciplina?, alunos? }`. Nasce `nova` |
| `PATCH /ocorrencias-escolares/:id` | dono, admin | Só enquanto `nova` (409 `OCORRENCIA_EM_ATENDIMENTO`) |
| `POST /ocorrencias-escolares/:id/resposta` | gestão | `{ status, providencias? }`. Grava `gestao_user_id`, `respondido_em` e marca "não vista" |
| `POST /ocorrencias-escolares/:id/visto` | dono | O professor viu a resposta |
| `DELETE /ocorrencias-escolares/:id` | dono, admin | 204 |

`status`: `nova`, `em_andamento`, `resolvida`. `tipo`: comportamento, falta de atividade, uso inadequado de
equipamento, conflito, atraso, sem material, conversa excessiva, outro. Erros: `DADOS_INVALIDOS` / `TURMA_INVALIDA` /
`ARQUIVO_VAZIO` (400), `SEM_PERMISSAO` (403), `OCORRENCIA_NAO_ENCONTRADA` / `FOTO_NAO_ENCONTRADA` (404),
`OCORRENCIA_EM_ATENDIMENTO` (409), `ARQUIVO_GRANDE_DEMAIS` (413), `TIPO_NAO_PERMITIDO` (415).

## PDI (evidências)

Padrão A. Cada evidência vem com `fotos` e `documentos`; os arquivos ficam na pasta do professor dono, e os links
saem de `/files/pdi-fotos/url` e `/files/pdi-documentos/url`.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /pdi-evidencias?turma_id=&disciplina_id=&bimestre=&ano_letivo=&tipo_atividade=&user_id=` | logado | As mais recentes primeiro |
| `GET /pdi-evidencias/:id` | dono, gestão | Uma evidência |
| `POST /pdi-evidencias` | logado | `{ titulo, data_realizacao?, ano_letivo?, bimestre?, turma_id?, disciplina_id?, tipo_atividade?, objetivo?, descricao?, resultados? }` |
| `PATCH` / `DELETE /pdi-evidencias/:id` | dono, admin | Excluir leva fotos e documentos (banco e armazenamento) |
| `POST /pdi-evidencias/:id/fotos?nome=` | dono, admin | Corpo: a imagem (até 10 MB) |
| `POST /pdi-evidencias/:id/documentos?nome=` | dono, admin | Corpo: o documento (até 20 MB) |
| `DELETE /pdi-evidencias/:id/fotos/:fotoId` · `/documentos/:docId` | dono, admin | 204 |

`tipo_atividade`: Aula prática, Jogo educativo, Projeto, Experimento, Tecnologia/Robótica, Atividade avaliativa, Outro
(padrão). Erros: `DADOS_INVALIDOS` / `TURMA_INVALIDA` / `DISCIPLINA_INVALIDA` / `ARQUIVO_VAZIO` (400), `SEM_PERMISSAO` (403),
`EVIDENCIA_NAO_ENCONTRADA` / `ARQUIVO_NAO_ENCONTRADO` (404), `ARQUIVO_GRANDE_DEMAIS` (413), `TIPO_NAO_PERMITIDO` (415).

## Tutoria

Padrão A sobre o tutorado (o tutor vê e altera; a gestão vê; o admin pode tudo). O acompanhamento fica no nome do
tutor, mesmo quando o admin registra; os arquivos ficam na pasta dele.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /tutorados?status=&user_id=` | logado | Tutorados em ordem de nome |
| `POST /tutorados` | logado | `{ nome, aluno_id?, turma?, numero_chamada?, status?, observacoes?, data_inicio? }`. O mesmo aluno duas vezes → 409 `TUTORADO_DUPLICADO` |
| `POST /tutorados/vincular` | logado | `{ aluno_ids }` (até 200): dados do cadastro do aluno; os já tutorados ficam de fora. Devolve `{ criados, ja_existiam }` |
| `GET /tutorados/:id` | tutor, gestão | Com `checkins`, `registros`, `combinados` e `documentos` |
| `PATCH` / `DELETE /tutorados/:id` | tutor, admin | Excluir leva o acompanhamento, a foto e os documentos |
| `PUT` / `DELETE /tutorados/:id/foto` | tutor, admin | Corpo: a imagem (até 10 MB); troca a anterior |
| `POST /tutorados/:id/checkins` | tutor, admin | `{ humor, observacao? }`. `humor`: bem, mais_ou_menos, dificil, observar |
| `POST /tutorados/:id/registros` | tutor, admin | `{ como_esta, observacao?, combinado?, proxima_acao?, data? }` |
| `POST /tutorados/:id/combinados` | tutor, admin | `{ descricao, data? }` (nasce `pendente`) |
| `PATCH /tutorados/:id/combinados/:itemId` | tutor, admin | `{ status?: pendente \| concluido, descricao? }` |
| `POST /tutorados/:id/documentos?nome=` | tutor, admin | Corpo: o documento ou imagem (até 20 MB) |
| `DELETE /tutorados/:id/{checkins\|registros\|combinados\|documentos}/:itemId` | tutor, admin | 204 |
| `GET /tutoria-registros?tutorado_id=` | logado | Registros de vários tutorados de uma vez |

Erros: `DADOS_INVALIDOS` / `ALUNO_INVALIDO` / `ARQUIVO_VAZIO` (400), `SEM_PERMISSAO` (403), `TUTORADO_NAO_ENCONTRADO` /
`ITEM_NAO_ENCONTRADO` / `ARQUIVO_NAO_ENCONTRADO` (404), `TUTORADO_DUPLICADO` (409), `ARQUIVO_GRANDE_DEMAIS` (413),
`TIPO_NAO_PERMITIDO` (415).

## Replicabilidade (mural)

Padrão D: **todo usuário logado vê tudo**, com `fotos` (em ordem) e `autor: { nome }`. Professores e admin publicam
(a gestão só vê); quem publicou e o admin alteram e excluem.

| Rota | Quem | O que faz |
|---|---|---|
| `GET /replicabilidades?user_id=` | logado | O mural, as mais novas primeiro |
| `GET /replicabilidades/:id` | logado | Uma publicação |
| `POST /replicabilidades` | professor, admin | `{ titulo, descricao? }` |
| `PATCH` / `DELETE /replicabilidades/:id` | dono, admin | Excluir leva as fotos (banco e armazenamento) |
| `POST /replicabilidades/:id/fotos?nome=` | dono, admin | Corpo: a imagem (até 10 MB); vai para o fim da ordem |
| `DELETE /replicabilidades/:id/fotos/:fotoId` | dono, admin | 204 |

Erros: `DADOS_INVALIDOS` / `ARQUIVO_VAZIO` (400), `SEM_PERMISSAO` (403), `REPLICABILIDADE_NAO_ENCONTRADA` /
`ARQUIVO_NAO_ENCONTRADO` (404), `ARQUIVO_GRANDE_DEMAIS` (413), `TIPO_NAO_PERMITIDO` (415).

## Ligando o frontend

O frontend (`../frontend`) fala com a API pelo cliente `src/lib/api.ts`, no endereço de `VITE_API_URL`
(no `.env` do frontend; em dev, `http://localhost:3333`). O token do login fica no `localStorage` do
navegador e vai no cabeçalho `Authorization`; quando a API recusa o token (401), o frontend volta para o login.

Como o frontend roda em outro endereço, a API só responde ao navegador para as origens de `CORS_ORIGINS`
(separadas por vírgula; padrão `http://localhost:8080`, a porta do Vite). Outros sites não recebem a liberação.

```bash
cd ../frontend && npm install && npm run dev   # http://localhost:8080 (com a API ligada)
```

**Todas as telas estão ligadas ao backend** (login, cadastros, notas e provas, planos de aula, diário, agenda,
painéis, relatórios, ocorrências, PDI, tutoria e replicabilidade). Os arquivos passam pelo correio de arquivos
(`/files`): o frontend envia o arquivo para a rota do módulo e pede links temporários para mostrar. O frontend
não usa mais o Supabase: o `@supabase/supabase-js`, o cliente gerado e as variáveis `VITE_SUPABASE_*` saíram.
O Supabase continua só como armazenamento de arquivos, acessado pelo backend (`STORAGE_DRIVER=supabase`).

As conferências de tela (`test:tela-*`) usam a base comum `scripts/telas.ts`: API e Vite em portas livres,
Chromium do Playwright do frontend (`npx playwright install chromium` na pasta `frontend`, se faltar) e
usuários de teste apagados no final; os arquivos enviados pelas telas vão para uma pasta temporária
(`STORAGE_DRIVER=local`), também apagada. Se uma conferência parar no meio, ela conta como falha e salva uma foto
da tela na pasta temporária do sistema.

Para listas grandes de ids (ex.: as notas de todas as avaliações de Prova Paulista), o frontend usa
`buscarEmLotes` (`src/lib/api.ts`), que divide os ids em lotes separados por vírgula (o backend aceita até 500
por filtro).

## Colocar no ar (Render)

O arquivo [`../render.yaml`](../render.yaml) descreve os dois serviços para o Render (New > Blueprint):

| Serviço | O que é | Como sobe |
|---|---|---|
| `painelescolar-api` | Este backend (Node) | `npm ci && npx prisma generate && npm run build`; ao iniciar, aplica as migrations (`prisma migrate deploy`) e roda `npm start`. Verificação de vida em `/health` |
| `painelescolar-web` | O frontend (site estático) | `npm install && npm run build`, publica `dist/`; todo caminho abre o `index.html` |

Preencha no painel do Render (nunca no git): `DATABASE_URL` e `DIRECT_URL` (Neon), `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` (arquivos), `CORS_ORIGINS` (o endereço do site) e, no site, `VITE_API_URL` (o
endereço da API). O `JWT_SECRET` é gerado pelo próprio Render. Os dois ficam na região de Virgínia, perto do
banco no Neon. O primeiro admin já existe no banco (criado pelo `npm run seed`).

## Collection do Bruno

Em [`bruno/`](bruno/): abra no Bruno com **Open Collection**, escolha o ambiente **Local** e preencha a
variável secreta `senha` (e `novaSenha`, para trocar a senha). **Auth > Entrar** salva o token sozinho na
variável `token`. As variáveis secretas ficam só no seu Bruno, nunca no git.

Também roda pelo terminal (com a API ligada):

```bash
cd bruno
npx @usebruno/cli run --env Local --env-var senha=SUA_SENHA
```
