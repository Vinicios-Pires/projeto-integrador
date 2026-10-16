# Levantamento e Análise — Projeto Integrador (EscolaAgenda)

Data do levantamento: 2026-09-08
Repositório analisado: `C:\projetos\projetoIntegrador` (branch `PI-II_Main`)

---

## 1. Visão geral

O repositório está organizado como um "Projeto Integrador" acadêmico, mas na prática já existe um produto com nome e escopo definidos: **EscolaAgenda**, um SaaS de gestão de agenda escolar (professores, diretores e coordenadores). O `README.md` da raiz ainda descreve o projeto como "fase inicial de planejamento", o que está desatualizado frente ao que já foi construído.

## 2. Estrutura atual do repositório

```
projetoIntegrador/
├── README.md                  # texto genérico, desatualizado
├── backend/                   # vazio (só .gitkeep) — placeholder nunca usado
├── frontend/                  # vazio (só .gitkeep) — placeholder nunca usado
├── banco-de-dados/            # modelagem de dados (DBML + SQL)
├── prototipo/                 # onde o trabalho real está: frontend funcional
└── arquivos/                  # dados brutos de referência (CSV/ODT de agendas reais)
```

**Achado principal:** os diretórios `backend/` e `frontend/` descritos no README nunca foram usados. Todo o desenvolvimento aconteceu dentro de `prototipo/`, que hoje é o único código-fonte funcional do projeto. Ou seja, a estrutura de pastas do README não reflete a realidade do repositório.

## 3. O que já existe (`prototipo/`)

Frontend React já avançado, com ~10 páginas funcionais e design system próprio:

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + Motion (Framer Motion) + React Router 7 + Radix UI + MUI (parcial) + `@supabase/supabase-js`.
- **Páginas:** Landing page, Login, Recuperação de senha, Seleção de perfil, Dashboard, **Agenda Escolar** (visões mensal/semanal/diária), Agenda do Professor, Painel da Direção, Central de Notificações, Design System interativo, Home.
- **Perfis de usuário:** Professor, Diretor, Coordenador.
- **Design system:** componentes reutilizáveis (Button, Card, Badge, Input, Skeleton, EmptyState), dark mode com 3 modos (light/dark/system) persistido em localStorage.
- **Dados:** parte das páginas ainda usa dados mock; a Home e a Agenda (`src/app/lib/home.ts`, `src/app/lib/agenda.ts`, e demais arquivos em `src/app/lib/`) já foram conectadas ao Supabase (commit "Add HomePage, connect all pages to Supabase").

### Ponto crítico de arquitetura

O frontend **fala diretamente com o Supabase pelo navegador** (`src/app/lib/supabase.ts` instancia `createClient` com a anon key, e módulos como `agenda.ts` fazem `supabase.from('eventos').select(...)` direto do client). **Não existe hoje nenhum backend/API própria** — o Supabase está atuando como backend-as-a-service completo (banco + acesso via anon key), sem camada intermediária.

Isso é relevante porque o pedido do usuário (item 3) é justamente introduzir um backend separado com PostgreSQL — hoje esse papel é ocupado inteiramente pelo Supabase, acessado diretamente do cliente.

## 4. Modelagem de dados (`banco-de-dados/`)

Existem **dois modelos DBML distintos**, em estágios diferentes:

| Arquivo | Escopo | PKs | Observação |
|---|---|---|---|
| `dbml_planilhas_agenda_escolar.dbml` (177 linhas) | Modelo "enxuto", derivado diretamente das planilhas/ODT brutos em `arquivos/` | `integer` (serial) | Parece ser um rascunho inicial de modelagem a partir dos dados reais coletados, anterior ao modelo completo |
| `dbml_prototipo_completo_escolaagenda.dbml` (364 linhas) | Modelo completo, cobrindo todo o domínio | `uuid` | **É o schema que bate com o que o frontend já usa** (mesmos nomes de tabela/coluna: `eventos`, `evento_participantes`, `salas`, `turmas.nome_exibicao`, `usuarios.nome`, etc.) |

Os arquivos `bancoPrototipo.sql` e `derivadoExcel.sql` são os DDLs (`CREATE TYPE`/`CREATE TABLE`) gerados a partir desses dois DBMLs, respectivamente.

**Conclusão:** `dbml_prototipo_completo_escolaagenda.dbml` é a fonte de verdade para qualquer backend novo, pois o frontend já foi escrito assumindo esse schema.

### Cobertura do modelo completo

O schema já é bastante maduro e cobre bem mais que só "agenda":

- **Estrutura institucional:** `escolas`, `usuarios` (com papéis: professor/diretor/coordenador/vice-diretor/secretário/administrador), `perfis_profissionais`, `disciplinas`, `turmas`, `salas`, `professor_turma_disciplina`.
- **Núcleo de agenda (foco do produto, item 2 do pedido):** `calendarios`, `faixas_horario`, `eventos` (com categoria, status, recorrência, exceções), `evento_participantes`, `eventos_excecao`, `calendario_excecoes`.
- **Planos de aula:** `planos_aula`, `anexos`, `plano_aula_anexos`, `validacoes_plano_aula` (fluxo de envio → validação pela direção).
- **Notificações:** `notificacoes`, `notificacao_destinatarios`, `configuracoes_notificacao`.
- **Observabilidade:** `metricas_dashboard`, `auditoria`.

Ou seja: a modelagem de dados já reflete a intenção do item 2 do pedido ("agenda como ponto principal") — o núcleo de eventos/calendários é a parte mais desenvolvida e mais diretamente ligada ao que o frontend já consome.

## 5. Dados de referência (`arquivos/`)

Contém uma agenda real de escola em CSV/ODT (ex.: `AGENDA_DIRETOR_2026 (1)(MARÇO).csv`, `agenda caroline sverzuti(início).csv`). Aparenta ter sido a fonte usada para desenhar o modelo "enxuto" (`dbml_planilhas_agenda_escolar.dbml`) e para validar o domínio antes de generalizar para o modelo completo.

## 6. Diagnóstico frente aos pedidos do usuário

**Item 2 — "agenda como ponto principal":** já é, de fato, o que está mais desenvolvido tanto no frontend (3 modos de visualização, categorias, participantes) quanto no schema (`eventos`, `calendarios`, `faixas_horario`, recorrência e exceções já modeladas).

**Item 3 — reorganizar estrutura de pastas + backend próprio com PostgreSQL:** hoje não existe backend algum; o Supabase faz esse papel direto do navegador. Introduzir um backend implica:
- Decidir se o Postgres continua sendo o do Supabase ou um Postgres independente (Neon/Railway/Render/RDS etc.) — **decisão já tomada em conversa: Postgres independente.**
- Escolher a stack do backend — **decisão já tomada em conversa: Node.js + Express/Fastify + TypeScript.**
- Mover `prototipo/` para dentro de uma pasta `frontend/` de fato usada (os placeholders atuais de `backend/`/`frontend/` na raiz estão vazios e podem ser reaproveitados).
- Reescrever os módulos que hoje chamam `supabase.from(...)` direto (`src/app/lib/*.ts`) para consumir a API do novo backend em vez do Supabase — é um trabalho à parte, não trivial, pois toda a lógica de mapeamento de dados hoje mora no frontend.

**Item 3.1 — hospedagem gratuita para o backend:** discussão explicitamente adiada pelo usuário; não avaliada neste levantamento. Quando chegar a hora, opções típicas de free tier para API Node + Postgres separado incluem Render, Railway, Fly.io (backend) e Neon/Supabase/Railway (Postgres gerenciado).

## 7. Riscos / pontos de atenção identificados

1. **Ambiente sem Docker/Postgres instalado localmente** (verificado neste levantamento) — qualquer setup de backend vai precisar ou de instalação local de Postgres, ou de um Postgres gerenciado free (ex.: Neon) já para o ambiente de desenvolvimento.
2. **Divergência entre os dois DBMLs** pode gerar confusão se não for documentado qual é o vigente — vale marcar claramente `dbml_planilhas_agenda_escolar.dbml` como rascunho histórico ou arquivá-lo.
3. **README da raiz desatualizado** — descreve uma estrutura (`backend/`, `frontend/`, `docs/`) que não corresponde ao estado real do projeto (`prototipo/`, sem `docs/`).
4. **Acoplamento direto frontend→Supabase**: migrar para um backend próprio exige reescrever a camada de dados do frontend, não é apenas "subir uma API do lado".
5. Diretório `prototipo/node_modules` está no `.gitignore` corretamente (não versionado).

## 8. Decisões já registradas na conversa

- Postgres: **independente** (não o do Supabase).
- Stack backend: **Node.js + Express/Fastify + TypeScript**.
- Hospedagem do backend: **em aberto**, a discutir depois (item 3.1).

## 9. Possíveis próximos passos (não executados — apenas para discussão)

1. Definir hospedagem do Postgres para desenvolvimento (Neon é o caminho mais rápido sem precisar instalar nada localmente).
2. Reorganizar a estrutura de pastas (mover `prototipo/` → `frontend/`, criar `backend/` de fato).
3. Traduzir `dbml_prototipo_completo_escolaagenda.dbml` em schema do ORM escolhido (ex.: Prisma) e gerar as migrations.
4. Subir uma API mínima cobrindo o núcleo de agenda (`eventos`, `evento_participantes`, `calendarios`, mais os cadastros de apoio: `turmas`, `salas`, `disciplinas`, `usuarios`) — espelhando o que `src/app/lib/agenda.ts` já faz hoje contra o Supabase.
5. Só depois disso, revisar item a item os módulos do frontend para trocarem de "Supabase direto" para "chamadas à API nova".
6. Atualizar o `README.md` da raiz para refletir a estrutura e o status reais do projeto.
7. Decidir hospedagem gratuita do backend (item 3.1).

---

*Nenhuma alteração foi feita no código do repositório `projetoIntegrador` durante este levantamento — este documento é só análise.*
