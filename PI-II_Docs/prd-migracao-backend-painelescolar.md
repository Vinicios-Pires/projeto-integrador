# PRD — Migração de Backend: Painel Escolar Inteligente

Documento de planejamento montado a partir da leitura completa do código-fonte, das 33
migrações SQL (na ordem cronológica, incluindo `DROP POLICY`/reescrituras — não só a
primeira ocorrência de cada tabela) e de todos os pontos do frontend que falam com o
Supabase, do repositório `aplicativoescola2026-main`. Replica, para este projeto, a decisão
de stack registrada em `prd-escolaagenda.md` (2026-09-08): sair do Supabase como
backend-as-a-service e construir uma API própria.

**Data:** 2026-09-14
**Decisão confirmada com o responsável pelo levantamento:** migração completa — substituir
Supabase (Auth + DB + RLS) por Node.js + Express + Prisma + PostgreSQL (Neon) + JWT próprio.

> ⚠️ **Diferença crítica frente ao `prd-escolaagenda.md`:** naquele projeto, quase tudo era
> fachada (login simulado, rotas públicas, modais que não gravavam nada) — a migração trocava
> "quase nada" por um backend real. **Aqui é o oposto.** Este sistema tem autenticação real,
> **327 políticas RLS** já escritas e testadas, e CRUD funcional ponta-a-ponta em 24 páginas.
> Migrar significa **substituir uma camada de segurança que já funciona** por uma nova,
> construída à mão. Este documento assume essa decisão como tomada e detalha o que ela custa.

---

## 1. Stack alvo (replicada do PRD EscolaAgenda)

| Camada | Escolha |
|---|---|
| Frontend | Mantém-se: React 18 + TypeScript + Vite + Tailwind + React Router 6 + shadcn/Radix |
| Backend | **Node.js + Express + TypeScript** |
| ORM | **Prisma** |
| Banco de dados | **PostgreSQL gerenciado via Neon** (sai do Postgres do Supabase) |
| Autenticação | **JWT emitido pelo próprio backend**, validado contra `usuarios.senha_hash` |
| Armazenamento de arquivos | **Supabase Storage** — mantido só como bucket, acessado exclusivamente pelo backend novo (service role), nunca direto do navegador |
| Hospedagem do backend | Render (ou equivalente — ver §9) |

O `@supabase/supabase-js` **sai do frontend por completo**: hoje ele é usado tanto para
DB/Auth quanto para Storage; após a migração, o navegador só fala com a API Express.

---

## 2. Estado atual (linha de base para a migração)

Resumo da arquitetura hoje, para servir de "antes" da migração — detalhamento completo em
`analise-tecnica-aplicativoescola2026.md`:

- **40 tabelas**, 3 enums (`app_role`, `tipo_bloco_horario`, `tipo_evento_escola`), **327
  políticas RLS**, todas Postgres gerenciado pelo Supabase (projeto `yptddvvlxuttggvvrnit`).
- **Autenticação real** via Supabase Auth (`supabase.auth.signUp/signInWithPassword/
  resetPasswordForEmail/updateUser`), com sessão persistida pelo próprio SDK.
- **7 buckets de Storage** (`ocorrencias-fotos`, `plano-anexos`, `pdi-fotos`,
  `pdi-documentos`, `replicabilidade-fotos`, `tutoria-fotos`, `tutoria-documentos`), todos
  acessados **direto do navegador** com upload/URL assinada via `supabase.storage.from(...)`,
  protegidos por políticas de RLS em `storage.objects` (convenção: primeiro segmento do path
  = `user_id` do dono).
- **1 uso de Realtime**: `OcorrenciasEscolares.tsx` assina `postgres_changes` na tabela
  `ocorrencias_escolares` para atualizar a lista ao vivo quando a gestão responde.
- **25 arquivos** chamam `supabase.from(...)` diretamente (nenhuma camada de API própria).

---

## 3. Modelo de autorização atual — o que precisa virar código

As 327 políticas seguem um número pequeno de **padrões repetidos**. Em vez de listar as 327
uma a uma, a tabela abaixo consolida os padrões — é isso que vira middleware/lógica de
autorização no Express. Papéis: **professor** · **gestão** (coordenador/direção/vice-direção)
· **admin**.

### 3.1 Padrões de autorização (cobrem a maior parte das 40 tabelas)

| Padrão | Tabelas | Regra |
|---|---|---|
| **A — Dono CRUD, gestão só lê** | `disciplinas`, `planos_aula`\*, `ocorrencias_notebook`, `provas`, `tipos_avaliacao`, `notas`, `lembretes`, `turma_disciplinas`, `turma_membros`, `medias_arredondadas`, `pdi_evidencias`, `agenda_professor`, `agenda_excecoes`, `planejamentos_bimestrais`, `diario_atividades`, `diario_lancamentos`, `diario_observacoes_aluno`, `tutorados`, `tutoria_checkins`, `tutoria_registros`, `tutoria_combinados`, `tutoria_documentos` | Professor: CRUD onde `user_id = auth.uid()`. Gestão: `SELECT` amplo. Admin: acesso total (em algumas, via `is_admin` explícito no INSERT/UPDATE/DELETE; em outras, via `has_role(...,'admin')` num `FOR ALL` dedicado). |
| **B — Filho via tabela pai (EXISTS)** | `ajustes_plano`, `gabaritos`, `resultados_prova`, `ocorrencia_fotos`, `pdi_evidencia_fotos`, `pdi_evidencia_documentos`, `plano_anexos` | Mesma regra do pai (A), verificada com `EXISTS (SELECT 1 FROM <pai> WHERE ... AND (dono OR gestão))`. |
| **C — Leitura livre para autenticado, escrita restrita** | `alunos` (leitura/escrita liberada a qualquer autenticado; **delete só gestão**), `agenda_escola_eventos` (leitura livre; escrita só gestão), `horario_grade`, `ano_letivo` (leitura livre; escrita só admin) | Sem "dono" — é cadastro compartilhado da escola. |
| **D — Mural público** | `replicabilidades`, `replicabilidade_fotos` | `SELECT` liberado a **qualquer autenticado** (`USING (true)`); escrita/exclusão só dono ou admin. |
| **E — Aprovação por gestão (exceção real)** | `planos_aula` | Diferente do padrão A: gestão pode **UPDATE** (não só SELECT) — é o fluxo de aprovar/rejeitar plano de aula. **Essa é a única tabela do padrão A onde a gestão escreve.** |
| **F — Fluxo com estado (professor perde direito de editar)** | `ocorrencias_escolares` | Professor só edita a própria linha **enquanto `status = 'nova'`**; gestão sempre pode atualizar. Um trigger (`oe_mark_unseen`) zera `visto_pelo_professor`, carimba `gestao_user_id` e `respondido_em` sempre que alguém *diferente do dono* muda `status`/`providencias`. **Essa lógica de trigger precisa virar código no backend**, não é só autorização — é regra de negócio. |
| **G — Apoio presencial** | `apoio_presencial` | `SELECT`: professor envolvido (`professor_id`/`responsavel_id`) ou gestão. Escrita: só gestão. |
| **H — Identidade/papéis** | `profiles`, `user_roles` | Usuário vê/edita o próprio perfil; gestão **vê** todos os perfis e papéis; **só admin** atualiza perfis de terceiros e gerencia `user_roles` (aprovar, trocar papel, ativar/inativar). |

\* `planos_aula` está em A **e** é a exceção E ao mesmo tempo — ver nota acima.

### 3.2 Cadastro e aprovação de usuários (lógica hoje em trigger de banco)

A função `handle_new_user()` (trigger `on_auth_user_created`) hoje faz, no banco, tudo isto
a cada novo cadastro — **precisa virar o endpoint `POST /auth/signup` do Express**:

1. **Rejeita e-mails fora do domínio institucional** (`@prof.educacao.sp.gov.br`), com uma
   exceção hardcoded para um e-mail específico de bootstrap do admin.
2. Cria o perfil com `status = 'pendente'` (ou `'ativo'` só para o e-mail de bootstrap).
3. Para o e-mail de bootstrap, insere automaticamente o papel `admin` em `user_roles`.

**Achado a resolver na migração:** o e-mail de admin está **hardcoded na função SQL**
(`sverzutivendas@gmail.com`), em dois lugares (checagem de domínio + auto-atribuição de
papel). No backend novo isso deve virar uma variável de ambiente (`ADMIN_BOOTSTRAP_EMAIL`)
lida por um **script de seed**, não uma string fixa no código de autorização.

### 3.3 O que se perde ao sair da RLS

Hoje, mesmo que uma tela do frontend tenha um bug e tente ler dados de outro professor, o
**banco recusa** — a segurança não depende do código da UI estar certo. Ao mover toda a
autorização para o Express, **essa rede de segurança desaparece**: um endpoint novo que
esqueça de aplicar o middleware certo vira um vazamento de dados real, sem nenhuma segunda
camada. Duas decisões precisam ser tomadas pela equipe (ver §9):

- Manter RLS **também** no Postgres do Neon como defesa em profundidade (o Prisma consegue
  conviver com isso, mas dá trabalho extra manter as duas camadas em sincronia), **ou**
- Confiar 100% na autorização do Express, compensando com testes de integração que cubram
  os 8 padrões da tabela acima para as 40 tabelas.

---

## 4. Migração de autenticação (Supabase Auth → JWT próprio)

| Hoje (Supabase Auth) | Depois (Express) |
|---|---|
| `supabase.auth.signUp()` | `POST /auth/signup` — valida domínio, hash da senha (bcrypt/argon2), cria `usuarios` com `status='pendente'` |
| `supabase.auth.signInWithPassword()` | `POST /auth/login` — verifica `senha_hash`, exige `status='ativo'`, emite JWT |
| `supabase.auth.resetPasswordForEmail()` + `updateUser()` | `POST /auth/forgot-password` + `POST /auth/reset-password` — **precisa de um provedor de e-mail transacional próprio** (Resend, SendGrid, etc.), algo que o Supabase Auth resolvia de graça |
| `supabase.auth.getUser()` (usado em `Turmas.tsx`) | `GET /me`, ou decodificar o JWT no cliente |
| `onAuthStateChange` + `getSession()` (em `AuthContext.tsx`) | Guardar o JWT (localStorage ou cookie) + `GET /me` no boot da aplicação |
| Aprovação de usuário / troca de papel (`GerenciarUsuarios.tsx`, hoje via `update` direto protegido por RLS) | `PATCH /users/:id/status`, `PATCH /users/:id/role` — endpoints admin-only |

**Risco concreto de corte (cutover):** os hashes de senha do Supabase Auth (GoTrue) **não
são exportáveis nem compatíveis** com um `senha_hash` calculado pelo backend novo. Não existe
caminho para migrar senhas em silêncio — **todo usuário ativo vai precisar redefinir a senha**
no dia da virada (ou a equipe pré-cadastra senhas temporárias e avisa por outro canal). Isso
precisa entrar no planejamento de comunicação com os professores/gestão, não só no técnico.

Arquivos que precisam de reescrita direta: `AuthContext.tsx`, `Login.tsx`, `Cadastro.tsx`,
`RecuperarSenha.tsx`, `RedefinirSenha.tsx`, `GerenciarUsuarios.tsx`, `Turmas.tsx` (linha 76).

---

## 5. Migração de arquivos (Storage) — o ponto mais fácil de subestimar

Hoje o navegador faz upload e gera URLs assinadas **direto no Supabase Storage**, usando a
sessão do Supabase Auth do próprio usuário (a política de RLS em `storage.objects` confere
`owner = auth.uid()`). No dia em que o Supabase Auth for desligado, **o navegador deixa de
ter uma sessão Supabase válida** — essas chamadas passam a falhar, mesmo mantendo os buckets.

**Isso significa que o Storage não pode ficar "como está" apontando pro cliente.** Toda
operação de arquivo precisa passar a ir para o backend novo, que guarda uma chave
`service_role` do Supabase (sem RLS) e expõe:

- `POST /files/:bucket` — upload (multipart), valida dono via JWT antes de repassar ao Supabase
- `GET /files/:bucket/*path/signed-url` — gera a URL assinada no servidor
- `DELETE /files/:bucket/*path` — remove, checando dono/gestão/admin conforme o bucket

**6 arquivos de frontend afetados**, todos precisam trocar `supabase.storage.from(...)` por
chamadas à API nova: `AnexosLinha.tsx` (plano-anexos), `Ocorrencias.tsx` (ocorrencias-fotos),
`PdiEvidencias.tsx` (pdi-fotos, pdi-documentos), `Replicabilidade.tsx`
(replicabilidade-fotos), `Tutoria.tsx` (tutoria-fotos, tutoria-documentos — 2 buckets).

A regra de dono-por-pasta que hoje está em RLS (`storage.foldername(name)[1] = auth.uid()`)
precisa ser replicada exatamente nesses 3 novos endpoints — é o mesmo padrão para os 7
buckets, então dá para escrever uma única função de autorização de arquivo e reutilizar.

---

## 6. Realtime — decisão em aberto

Um único ponto usa Supabase Realtime: `OcorrenciasEscolares.tsx` assina mudanças na tabela
para atualizar a lista ao vivo quando a gestão responde a uma ocorrência. Express/Prisma não
tem equivalente pronto. Três caminhos (ver decisão pendente em §9):

1. **Abandonar por ora** e confiar em atualização manual/ao focar a aba — menor esforço.
2. **Polling curto** (ex.: refetch a cada 15–30s) — baixo esforço, resolve a maior parte do caso de uso.
3. **WebSocket próprio** (`ws`/Socket.IO) emitindo evento a cada mutação em `ocorrencias_escolares` — fiel ao comportamento atual, mas é infraestrutura nova.

---

## 7. Migração de dados (Supabase Postgres → Neon)

1. **Schema**: as 40 tabelas + 3 enums já mapeados nas seções acima viram `schema.prisma`
   (tradução mecânica — posso gerar esse arquivo como próximo passo, ver §11).
2. **Dados**: `pg_dump` na string de conexão Postgres do Supabase (não a REST API — o
   Supabase expõe acesso Postgres direto) → `pg_restore`/`psql` no Neon. Isso exige acesso de
   banco que hoje não tenho (só a chave `publishable`, sem `service_role` nem connection
   string) — precisa ser feito por quem tem acesso ao dashboard do Supabase (a equipe).
3. **`auth.users` não migra** — vira a tabela `usuarios` (ou similar) do backend novo, mas
   **sem senha utilizável** (ver risco em §4). Os demais dados (`profiles`, `user_roles`,
   e as 38 tabelas de domínio) migram normalmente, só trocando as `FOREIGN KEY` que hoje
   apontam para `auth.users(id)` para apontar para a nova tabela `usuarios`.
4. **Arquivos**: seguem no Supabase Storage (não precisam ser copiados) — só o *modo de
   acesso* muda (§5).

---

## 8. Superfície da API nova (inventário de endpoints)

Organizado pelos mesmos 40-tabelas/25-arquivos mapeados acima, agrupado por módulo (cada
grupo reaproveita os padrões de autorização da §3.1):

| Módulo | Tabelas | Endpoints (padrão REST) |
|---|---|---|
| Auth | `usuarios` (novo, substitui `auth.users`) | signup, login, forgot/reset-password, me |
| Usuários (admin) | `profiles`, `user_roles` | listar pendentes, aprovar, status, papel |
| Estrutura | `turmas`, `alunos`, `disciplinas`, `turma_membros`, `turma_disciplinas`, `ano_letivo`, `horario_grade` | CRUD padrão |
| Avaliação | `tipos_avaliacao`, `notas`, `medias_arredondadas`, `provas`, `gabaritos`, `resultados_prova` | CRUD + endpoint de salvar resultado da leitura de QR (a leitura em si continua 100% client-side com `jsqr`) |
| Planejamento | `planos_aula`, `plano_anexos`, `ajustes_plano`, `planejamentos_bimestrais` | CRUD + endpoint de aprovação (padrão E) |
| Diário | `diario_atividades`, `diario_lancamentos`, `diario_observacoes_aluno` | CRUD padrão |
| Agenda | `agenda_professor`, `agenda_excecoes`, `agenda_escola_eventos`, `apoio_presencial` | CRUD padrão |
| Ocorrências | `ocorrencias_notebook` (+fotos), `ocorrencias_escolares` | CRUD + endpoint de "responder" (padrão F) + polling/WS (§6) |
| PDI | `pdi_evidencias` (+fotos/documentos) | CRUD + proxy de arquivo |
| Tutoria | `tutorados`, `tutoria_checkins`, `tutoria_registros`, `tutoria_combinados`, `tutoria_documentos` | CRUD + proxy de arquivo |
| Replicabilidade | `replicabilidades`, `replicabilidade_fotos` | CRUD + proxy de arquivo + leitura pública (padrão D) |
| Arquivos | (transversal aos módulos acima) | upload / signed-url / delete por bucket (§5) |

---

## 9. Decisões — estado em 2026-09-14

Contexto que baliza as recomendações abaixo: **aplicação pequena** (uma escola), **ainda não
totalmente funcional**, indo para produção agora. Isso pesa a favor de soluções manuais e
baratas no dia 1, deixando automação para quando (e se) a escala pedir.

1. **RLS no Neon como camada extra, ou autorização 100% no Express?**
   **Recomendação: 100% Express.** Recriar a RLS no Neon exige trabalho real (o dono das
   tabelas ignora RLS por padrão no Postgres; seria preciso uma role de banco separada e
   informar "quem está perguntando" a cada chamada, algo que hoje o Supabase resolve sozinho
   dentro do login). Para o tamanho deste projeto, o retorno não compensa o esforço.
   **Mitigação em troca:** todo endpoint novo passa pelos mesmos 8 padrões de autorização já
   mapeados na §3.1 (nunca lógica de permissão "avulsa" por endpoint), e escrever testes
   automatizados que tentem ativamente violar cada padrão (ex.: "professor A lê nota do
   professor B" deve falhar).

2. **Corte de senha em massa** — **Resolvido: caminho manual.** Sem e-mail automático. No dia
   da virada, um script gera senha temporária por usuário `status = 'ativo'`; a equipe avisa
   por canal já existente (grupo da escola, e-mail direto) pedindo troca de senha no primeiro
   acesso. Só precisa existir uma tela de "trocar minha senha" (item barato).

3. **Realtime de `ocorrencias_escolares`** — **Resolvido (provisório): abandonar.** Sem
   Supabase Realtime nem substituto (polling/WebSocket) por enquanto; atualização manual da
   tela. *Pendente confirmação final da equipe.*

4. **Estratégia de corte** — **Resolvido: big-bang.** Troca tudo de uma vez, numa janela de
   manutenção curta — evita manter duas bases de dados sincronizadas ao mesmo tempo, dado que
   quase toda tabela referencia `turmas`/`alunos`/`user_id` entre si.

5. **Provedor de e-mail transacional** — **Recomendação: nenhum, por enquanto.** Em vez de
   contratar Resend/SendGrid/SES só para o fluxo de "esqueci minha senha", a tela
   *Gerenciar Usuários* (admin) ganha um botão "resetar senha desta pessoa", que gera uma
   senha nova para o admin repassar manualmente — mesmo espírito do item 2. Revisitar só se a
   escola crescer e isso virar operacionalmente chato.

6. **Hospedagem** — **Decisão de organização, não técnica.** Hoje: 1 fornecedor (Supabase)
   cobre tudo. Depois da migração: **3** (Render roda o backend, Neon guarda o banco, Supabase
   fica só com os arquivos) — 3 contas, 3 conjuntos de credenciais, 3 painéis para checar se
   algo quebrar. Pendente: **definir quem da equipe é o dono de cada uma das três contas.**

7. **Analytics** — **Fácil, mas depende do resto pronto.** Não dá para adiantar isoladamente
   hoje (não tem onde rodar a agregação sem o backend); "pega carona" no final da migração,
   usando o mesmo Express já construído. Uma vez as fases 1–5 prontas, adicionar 4–5 endpoints
   de resumo (`groupBy`/`count` via Prisma) + uma tela com `recharts` (já instalado, sem uso
   hoje) é questão de dias.

---

## 10. Ordem de execução sugerida

| Fase | Escopo | Por quê nessa ordem |
|---|---|---|
| 0 | `schema.prisma` + provisionar Neon + dry-run de migração de dados | Não quebra nada em produção ainda |
| 1 | Auth (signup/login/JWT) + aprovação/papéis (admin) | Bloqueia tudo o resto — nenhuma outra rota funciona sem isso |
| 2 | Estrutura de apoio: `turmas`, `alunos`, `disciplinas`, `turma_membros`, `turma_disciplinas` | Lida por quase todos os outros módulos |
| 3 | Proxy de arquivos (upload/signed-url/delete) | Pré-requisito de 5 dos próximos módulos |
| 4 | Avaliação (notas/provas/QR) + Planejamento (planos_aula + aprovação) | Módulos mais complexos e de maior valor de negócio |
| 5 | Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade | Mesmo padrão repetido, mecânico uma vez que 1–4 existem |
| 6 | Corte: congelar escrita no Supabase, sincronizar dados finais, trocar o frontend, avisar reset de senha | — |

---

## 11. Próximo passo concreto

Este documento **não altera nada no código** — é material de alinhamento, como o
`prd-escolaagenda.md`. Ficam disponíveis como próximos entregáveis, sob demanda:

- O `schema.prisma` completo (tradução mecânica do que já está mapeado nas seções 2 e 3).
- Um esqueleto do projeto Express (estrutura de pastas, middlewares de autorização dos 8
  padrões da §3.1, cliente Prisma).
- O rascunho dos 3 endpoints de arquivo (§5), já que são reutilizados por 5 módulos diferentes.

**Aviso de escala:** isto é 40 tabelas, 8 padrões de autorização distintos, 6 fluxos de
upload de arquivo e reescrita de 25 arquivos de frontend — é um projeto de várias semanas
para uma equipe pequena, não um refactor pontual. Vale planejar o cronograma com essa escala
em mente antes de começar a fase 1.
