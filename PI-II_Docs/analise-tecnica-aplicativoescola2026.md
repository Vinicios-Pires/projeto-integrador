# Análise Técnica — Painel Escolar Inteligente (`aplicativoescola2026-main`)

**Data da análise:** 2026-09-14
**Caminho analisado:** `C:\projetos\aplicativoescola2026-main`
**Versionamento:** ⚠️ a pasta **não é um repositório Git** (sem `.git/`) — ver §9.1
**Instituição-alvo:** EE Prof. Edson Vianei Alves

> **Nota de escopo:** este documento analisa um projeto **diferente** do descrito em
> `levantamento-analise-projeto.md` e `prd-escolaagenda.md` (que tratam do repositório
> `projetoIntegrador` / produto *EscolaAgenda*). São bases de código distintas, com stacks
> e escopos diferentes. Uma comparação entre os dois está na §10.

---

## 1. Sumário executivo

`aplicativoescola2026-main` é uma **aplicação web SPA de gestão pedagógica escolar**, construída
na plataforma [Lovable](https://lovable.dev) e conectada a um projeto **Supabase** real e ativo.

Diferente de um protótipo, o projeto está **funcionalmente maduro**: 24 páginas roteadas,
40 tabelas no banco, 327 políticas de RLS e 33 migrações versionadas cobrindo ~5 meses de
evolução (março a julho de 2026).

**Estado de saúde ao iniciar (verificado nesta sessão):**

| Verificação | Resultado |
|---|---|
| `npm install` | ✅ sucesso (349 pacotes, exit 0) |
| `npm run dev` | ✅ Vite 5.4.21 no ar em `http://localhost:8080` (pronto em 746 ms) |
| Resposta HTTP da app | ✅ `HTTP 200` |
| `tsc --noEmit` (typecheck) | ✅ **zero erros** |
| `npm run build` | ✅ build em 10,26 s |
| `npm test` (vitest) | ✅ 1/1 passou — mas a suíte é **trivial** (ver §7) |
| `npm run lint` | ❌ **241 problemas** (212 erros, 29 warnings) |
| Conectividade Supabase | ✅ `auth/v1/health` → 200, `rest/v1/turmas` → 200 |

**Veredito:** o projeto **compila, roda e conecta ao banco sem nenhum ajuste**. Os riscos
não estão na execução, e sim em **qualidade de tipos, ausência de testes reais, e higiene de
segredos/versionamento** (§9).

---

## 2. Como iniciar o projeto

Pré-requisitos já satisfeitos nesta máquina: **Node v24.18.0**, **npm 11.16.0**.

```bash
cd C:\projetos\aplicativoescola2026-main
npm install          # ~349 pacotes
npm run dev          # → http://localhost:8080
```

O arquivo `.env` **já está presente e preenchido** com credenciais válidas de um projeto
Supabase ativo (`yptddvvlxuttggvvrnit`), então não há passo de configuração manual.

### 2.1 Observação sobre o gerenciador de pacotes

O projeto traz um **`bun.lock`** (200 KB), indicando que o fluxo original usa **Bun**.
O Bun **não está instalado** nesta máquina, então a instalação foi feita com **npm**, que
funcionou sem conflitos — mas isso gera um `package-lock.json` novo, divergente do `bun.lock`.

**Recomendação:** padronizar um único gerenciador. Se a equipe usa Lovable (que usa Bun),
instale o Bun e use `bun install`; caso contrário, remova o `bun.lock` e assuma npm.

### 2.2 Scripts disponíveis

| Script | Comando | Função |
|---|---|---|
| `dev` | `vite` | Servidor de desenvolvimento (porta 8080, HMR) |
| `build` | `vite build` | Build de produção → `dist/` |
| `build:dev` | `vite build --mode development` | Build sem minificação |
| `preview` | `vite preview` | Serve o `dist/` localmente |
| `lint` | `eslint .` | Análise estática |
| `test` | `vitest run` | Testes unitários (execução única) |
| `test:watch` | `vitest` | Testes em modo watch |

> Não existe script de **e2e** apesar de o Playwright estar configurado — ver §7.2.

---

## 3. Stack tecnológica

### 3.1 Núcleo

| Camada | Tecnologia | Versão |
|---|---|---|
| Build / dev server | **Vite** | 5.4.19 |
| Compilador React | **@vitejs/plugin-react-swc** (SWC, não Babel) | 3.11.0 |
| Linguagem | **TypeScript** | 5.8.3 |
| UI | **React** | 18.3.1 |
| Roteamento | **react-router-dom** | 6.30.1 |
| Estilização | **Tailwind CSS** | 3.4.17 |
| Backend (BaaS) | **Supabase** (`@supabase/supabase-js`) | 2.108.2 |
| Plataforma de origem | **Lovable** (`lovable-tagger`) | 1.1.13 |

Arquitetura: **SPA pura + Backend-as-a-Service**. Não existe servidor de aplicação próprio —
o navegador fala direto com o Supabase, e toda a autorização é delegada às políticas **RLS**
do PostgreSQL (§6).

### 3.2 Design system — shadcn/ui sobre Radix

O projeto usa **shadcn/ui** (`components.json`, style `default`, baseColor `slate`,
CSS variables ativado) com **48 componentes** copiados para `src/components/ui/`.

Primitivos **Radix UI** instalados (26 pacotes): accordion, alert-dialog, aspect-ratio, avatar,
checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar,
navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot,
switch, tabs, toast, toggle, toggle-group, tooltip.

Complementos de UI: `lucide-react` (ícones), `class-variance-authority` + `clsx` +
`tailwind-merge` (composição de classes), `cmdk` (command palette), `vaul` (drawer),
`sonner` (toasts), `embla-carousel-react`, `react-resizable-panels`, `input-otp`,
`next-themes`, `tailwindcss-animate`, `@tailwindcss/typography`.

### 3.3 Bibliotecas de domínio

| Lib | Versão | Uso no projeto |
|---|---|---|
| `recharts` | 2.15.4 | Gráficos do Dashboard e Painel da Gestão |
| `jspdf` + `jspdf-autotable` | 4.2.1 / 5.0.7 | Geração de PDFs (planos, planejamentos, tutoria) |
| `jsqr` | 1.4.0 | **Leitura de QR Code via câmera** para correção de provas |
| `react-hook-form` + `@hookform/resolvers` | 7.61.1 | Formulários |
| `zod` | 3.25.76 | Validação de schemas |
| `date-fns` | 3.6.0 | Manipulação de datas |
| `react-day-picker` | 8.10.1 | Seletor de datas |
| `qrcode.react` | 3.2.0 | **Geração** de QR nas folhas de resposta |
| `@tanstack/react-query` | 5.83.0 | ⚠️ instalado e montado, **porém nunca usado** (§9.3) |

### 3.4 Identidade visual

Tema definido por **CSS custom properties** em `src/index.css`, mapeadas no
`tailwind.config.ts` via `hsl(var(--token))`. Paleta institucional:

- **Primária:** `#0B5ED7` (azul) — com variantes `--primary-light` (`#EAF4FF`), `--primary-dark` (`#153E8C`), `--primary-glow`
- **Accent / Warning:** `#FFC107` (amarelo)
- **Destructive:** `#E91E63` (rosa)
- **Success:** `#22C55E` (verde)
- **Background:** `#F5F7FA` | **Card:** `#FFFFFF`
- **Tipografia:** *Plus Jakarta Sans* (texto) + *Fraunces* (display), via Google Fonts

Dark mode está **habilitado por classe** (`darkMode: ["class"]`) com `next-themes` instalado,
mas não há um alternador de tema exposto na interface — capacidade presente, não ativada.

---

## 4. Arquitetura da aplicação

```
src/
├── main.tsx                     # entrypoint
├── App.tsx                      # providers + roteamento completo
├── index.css                    # design tokens (CSS vars)
├── assets/                      # logo-escola.png, banner-escola.png
├── contexts/
│   └── AuthContext.tsx          # sessão, perfil e papel do usuário
├── hooks/
│   ├── use-permissions.ts       # regras de autorização no cliente
│   ├── use-agenda.ts            # rotina, exceções e eventos da agenda
│   ├── use-planejamento.ts      # planejamento bimestral
│   ├── use-mobile.tsx / use-toast.ts
├── integrations/supabase/
│   ├── client.ts                # cliente Supabase (GERADO — não editar)
│   └── types.ts                 # tipos do banco (GERADO, 2.049 linhas)
├── lib/
│   ├── supabase.ts              # reexport de integrations/supabase/client
│   ├── pdfHelpers.ts, planoPdf.ts, planejamentoPdf.ts
│   └── utils.ts                 # cn()
├── components/
│   ├── Sidebar.tsx              # navegação (varia por papel)
│   ├── NavLink.tsx
│   ├── ui/                      # 48 componentes shadcn
│   ├── ui-escola/               # componentes próprios da escola
│   ├── correcao/                # EscaneamentoDialog, GabaritoEditor,
│   │                            # FolhaRespostasTemplate, ResultadosTable, ProvaFormDialog
│   ├── dashboard/               # DashboardCharts, PostItBoard
│   └── plano/                   # PlanilhaPlanejamento, CelulaEditavel, AnexosLinha
├── pages/                       # 24 páginas
└── test/                        # setup.ts + example.test.ts
```

**Total:** 110 arquivos em `src/`, ~16.900 linhas (TS/TSX de páginas, componentes, hooks e libs).

### 4.1 Composição de providers (`App.tsx`)

```
QueryClientProvider          (react-query — cliente criado, nunca consumido)
└── BrowserRouter
    ├── Toaster
    └── AuthProvider
        └── Routes
            ├── /login, /cadastro, /recuperar-senha   → PublicRoute (redireciona se logado)
            ├── /redefinir-senha                       → aberta (fluxo de e-mail)
            └── /*                                     → ProtectedRoutes
```

### 4.2 Guarda de rotas (`ProtectedRoutes`)

Três portões, em ordem:

1. `loading` → spinner
2. `!session` → `Navigate` para `/login`
3. `profile.status === 'pendente' | 'inativo'` **ou** sem papel → renderiza `<AguardandoAprovacao />`

Ou seja, **todo usuário novo entra como `pendente`** e fica bloqueado até aprovação — há um
fluxo de moderação de acesso deliberado (confirmado pelo trigger `handle_new_user`, §6.3).

Após os portões, o `Layout` (sidebar fixa em desktop + `MobileSidebar`) envolve as rotas internas.

---

## 5. Módulos funcionais (24 páginas)

### 5.1 Autenticação e acesso
| Página | Rota | Função |
|---|---|---|
| `Login.tsx` | `/login` | Entrada |
| `Cadastro.tsx` | `/cadastro` | Auto-registro (cria perfil `pendente`) |
| `RecuperarSenha.tsx` | `/recuperar-senha` | Envio de e-mail de recuperação |
| `RedefinirSenha.tsx` | `/redefinir-senha` | Redefinição via link |
| `AguardandoAprovacao.tsx` | — | Tela de bloqueio para conta pendente |
| `GerenciarUsuarios.tsx` | `/usuarios` | **Somente admin** — aprovar, alterar papel, ativar/inativar |

### 5.2 Núcleo pedagógico
| Página | Rota | Linhas | Função |
|---|---|---|---|
| `Dashboard.tsx` | `/` | 433 | Painel do professor (gráficos + mural de post-its) |
| `GestaoDashboard.tsx` | `/gestao` | 314 | Painel da equipe gestora |
| `Turmas.tsx` | `/turmas` | 534 | Turmas, membros e disciplinas |
| `Alunos.tsx` | `/alunos` | 376 | Cadastro de alunos |
| `Materias.tsx` | `/materias` | 344 | Disciplinas |
| `Notas.tsx` | `/notas` | **1.231** | Lançamento de notas, médias e arredondamento — **maior arquivo do projeto** |
| `DiarioProfessor.tsx` | `/diario` | 589 | Diário de classe (atividades, lançamentos, observações) |
| `PlanoAula.tsx` | `/plano-aula` | 270 | Planos de aula + planejamento bimestral (com fluxo de validação pela gestão) |
| `Agenda.tsx` | `/agenda` | 760 | Grade de horários, rotina semanal, exceções e eventos da escola |

### 5.3 Módulos especializados
| Página | Rota | Linhas | Função |
|---|---|---|---|
| `CorrecaoProvas.tsx` | `/correcao-provas` | 327 | **Correção automatizada por leitura de QR Code** (§5.4) |
| `Ocorrencias.tsx` | `/ocorrencias` | 491 | Ocorrências de **notebook** (patrimônio/Chromebooks) |
| `OcorrenciasEscolares.tsx` | `/ocorrencias-escolares` | 482 | Ocorrências **disciplinares**, com anexo de fotos |
| `PdiEvidencias.tsx` | `/pdi-evidencias` | 807 | Evidências do **PDI** (fotos + documentos) |
| `ProvaPaulista.tsx` | `/prova-paulista` | 464 | Avaliação externa da rede estadual de SP |
| `Replicabilidade.tsx` | `/replicabilidade` | 650 | Registro de boas práticas replicáveis (com fotos) |
| `Tutoria.tsx` | `/tutoria` | 893 | **Tutoria de alunos**: check-ins de humor, registros, combinados, documentos |
| `Relatorios.tsx` | `/relatorios` | 148 | Relatórios consolidados |
| `Configuracoes.tsx` | `/configuracoes` | — | Preferências |

### 5.4 Destaque: correção de provas por QR Code

O módulo mais tecnicamente interessante do projeto. Fluxo completo:

1. **`GabaritoEditor`** — professor define o gabarito (alternativas A–E) e marca questões anuladas.
2. **`FolhaRespostasTemplate`** (194 linhas) — gera a folha de respostas imprimível, com um
   **QR Code embutido** (`qrcode.react`) codificando `provaId` + número de chamada do aluno.
3. **`EscaneamentoDialog`** (381 linhas) — abre a **câmera do dispositivo** (`getUserMedia`),
   captura frames num `<canvas>` e usa **`jsQR`** para identificar a prova e o aluno
   automaticamente; permite revisão/correção manual antes de salvar.
4. **`ResultadosTable`** — consolida acertos, nota e resultados por turma.

Tabelas envolvidas: `provas`, `gabaritos`, `resultados_prova`.

### 5.5 Navegação por papel (`Sidebar.tsx`)

Existem **dois menus distintos**, escolhidos em runtime:

- **`navProfessor`** (17 itens): Dashboard, Turmas, Alunos, Matérias, Notas, Diário, Plano de Aula, Agenda, Ocorrências de Notebook, Ocorrências Escolares, Correção de Provas, PDI, Prova Paulista, Replicabilidade, Tutoria, Relatórios, Configurações.
- **`navGestao`** (15 itens): substitui o Dashboard por **Painel da Gestão**, rotula "Notas (todos)" e **remove Matérias e Correção de Provas**.
- Para **admin**, um item **Gerenciar Usuários** é injetado logo após o primeiro item.

---

## 6. Banco de dados (Supabase / PostgreSQL)

**Projeto:** `yptddvvlxuttggvvrnit` (ativo e acessível — verificado)
**Migrações:** 33 arquivos, **2.773 linhas de SQL**, de `20260325` a `20260729`
**Tabelas:** 40 | **Políticas RLS:** 327 | **Triggers:** 20+

### 6.1 Tabelas por domínio

**Identidade e acesso (2)**
`profiles` (nome, email, status) · `user_roles` (user_id, role)

**Estrutura escolar (7)**
`turmas` · `turma_membros` · `turma_disciplinas` · `alunos` · `disciplinas` · `ano_letivo` · `horario_grade`

**Avaliação (5)**
`notas` · `tipos_avaliacao` · `medias_arredondadas` · `provas` · `gabaritos` · `resultados_prova`

**Planejamento e aula (5)**
`planos_aula` · `plano_anexos` · `ajustes_plano` · `planejamentos_bimestrais` · `lembretes`

**Diário de classe (3)**
`diario_atividades` · `diario_lancamentos` · `diario_observacoes_aluno`

**Agenda (3)**
`agenda_professor` (rotina semanal) · `agenda_excecoes` (alterações pontuais) · `agenda_escola_eventos`

**Ocorrências (3)**
`ocorrencias_notebook` · `ocorrencias_escolares` · `ocorrencia_fotos`

**PDI (3)**
`pdi_evidencias` · `pdi_evidencia_fotos` · `pdi_evidencia_documentos`

**Tutoria (5)**
`tutorados` · `tutoria_checkins` · `tutoria_registros` · `tutoria_combinados` · `tutoria_documentos`

**Outros (3)**
`replicabilidades` · `replicabilidade_fotos` · `apoio_presencial`

### 6.2 Enums

```sql
app_role            → 'professor' | 'coordenador' | 'direcao' | 'vice_direcao' | 'admin'
tipo_bloco_horario  → 'aula' | 'intervalo' | 'almoco' | 'planejamento' | 'atpc' | 'reuniao' | 'outro'
tipo_evento_escola  → 'reuniao' | 'formacao' | 'evento' | 'avaliacao_externa' | 'conselho'
```

O enum `tipo_bloco_horario` merece nota: modela a realidade da rede estadual paulista,
incluindo **ATPC** (Aula de Trabalho Pedagógico Coletivo) como tipo de bloco de horário.

### 6.3 Funções e triggers

Funções auxiliares de autorização, todas `SECURITY DEFINER` com `SET search_path = public`
(padrão correto — evita escalada por *search_path hijacking*):

```sql
has_role(_user_id uuid, _role app_role) → boolean
is_admin(_user_id uuid)                 → boolean
is_gestao(_user_id uuid)                → boolean
```

Trigger `on_auth_user_created` → `handle_new_user()`: ao criar usuário no `auth.users`,
insere automaticamente em `public.profiles` com **`status = 'pendente'`**.

> **Evolução observada:** a versão inicial do `handle_new_user` também inseria em `user_roles`
> com papel padrão `'professor'`. Uma migração posterior **removeu essa atribuição automática**
> e passou a criar o perfil como `pendente`. Essa mudança é o que sustenta o fluxo de aprovação
> manual da §4.2 — é um endurecimento deliberado de segurança, não um bug.

Além disso, ~20 triggers `trg_*_updated` mantêm colunas `updated_at`, e `trg_oe_unseen`
controla o marcador de "não visualizado" em ocorrências escolares.

### 6.4 Storage

Bucket público `ocorrencias-fotos` criado via `INSERT INTO storage.buckets`. Outros módulos
com anexos (PDI, replicabilidade, tutoria, planos) possuem tabelas de arquivos correspondentes.

### 6.5 Modelo de autorização — dupla camada

**Camada 1 — banco (autoritativa):** 327 políticas RLS. Padrão geral:
- **Professor:** CRUD apenas onde `user_id = auth.uid()`
- **Gestão** (coordenador/direção/vice-direção): `SELECT` amplo, sem escrita
- **Admin:** `ALL`

**Camada 2 — cliente (`use-permissions.ts`):** espelha as regras para controlar a UI:

```ts
isGestao  = coordenador || direcao || vice_direcao || admin
canEdit   = isProfessor || isAdmin          // dados operacionais
canApprove= isGestao                        // aprovar planos de aula
readOnly  = isGestao && !isAdmin
```

A camada do cliente é **apenas cosmética** — a segurança real está na RLS. Essa separação
está corretamente entendida no código (o comentário do próprio hook diz "RLS garante").

---

## 7. Qualidade, testes e tooling

### 7.1 Testes unitários — presentes, porém vazios

`vitest` 3.2.4 + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`,
com `src/test/setup.ts` fazendo polyfill de `window.matchMedia`.

**Porém a suíte inteira é:**

```ts
describe("example", () => {
  it("should pass", () => { expect(true).toBe(true); });
});
```

**Cobertura real de lógica de negócio: 0%.** A infraestrutura está montada e funcionando —
falta escrever os testes. Alvos de maior retorno: cálculo de médias e arredondamento
(`Notas.tsx`, `medias_arredondadas`), `usePermissions`, e o parsing de QR do `EscaneamentoDialog`.

### 7.2 Testes E2E — configuração quebrada

`playwright.config.ts` e `playwright-fixture.ts` importam o pacote
**`lovable-agent-playwright-config`**, que **não consta no `package.json`**.
Some-se a isso a ausência de qualquer script `e2e`/`test:e2e`. Na prática, **os testes E2E
não são executáveis** no estado atual.

**Correção:** adicionar a dependência e um script, ou remover os dois arquivos se o E2E
não for usado.

### 7.3 Lint — 241 problemas

| Regra | Ocorrências |
|---|---|
| `@typescript-eslint/no-explicit-any` | **206** |
| `react-hooks/exhaustive-deps` | 18 |
| `react-refresh/only-export-components` | 11 |
| `@typescript-eslint/no-empty-object-type` | 2 |
| `prefer-const` · `no-useless-escape` · `no-unused-expressions` · `no-require-imports` | 1 cada |

Concentração de `any` por arquivo: `Agenda.tsx` (26), `Notas.tsx` (24), `Turmas.tsx` (16),
`PdiEvidencias.tsx` (14), `Replicabilidade.tsx` (10), `Relatorios.tsx` (9), `Dashboard.tsx` (9).

**O ponto crítico:** o projeto **já possui tipos completos e gerados do banco**
(`integrations/supabase/types.ts`, 2.049 linhas, cobrindo as 40 tabelas). Os 206 `any`
descartam essa tipagem exatamente onde ela teria mais valor. É dívida técnica de baixo risco
para corrigir e alto retorno.

Nota adicional: o `eslint.config.js` **desliga** `@typescript-eslint/no-unused-vars`, então
variáveis não usadas passam silenciosamente.

### 7.4 Formatação

`.prettierrc` presente. Prettier **não está** nas dependências nem há script `format` —
a formatação depende da configuração do editor de cada desenvolvedor.

### 7.5 TypeScript — configuração permissiva

Apesar do `tsc --noEmit` passar limpo, isso reflete uma configuração frouxa
(`tsconfig.app.json`), não ausência de problemas de tipo. Com `strict` ativado, os 206 `any`
e os acessos a dados do Supabase provavelmente revelariam erros reais.

---

## 8. Build e performance

```
dist/assets/index-DVOCJQBl.js     2.006,68 kB │ gzip: 586,12 kB  ⚠️
dist/assets/html2canvas.esm.js      201,42 kB │ gzip:  48,03 kB
dist/assets/index.es.js             150,81 kB │ gzip:  51,59 kB
dist/assets/purify.es.js             29,05 kB │ gzip:  11,18 kB
dist/assets/index.css                 95,78 kB │ gzip:  16,49 kB
dist/assets/logo-escola.png       1.956,82 kB  ⚠️  (não otimizada)
dist/assets/banner-escola.png     1.273,02 kB  ⚠️  (não otimizada)
```

Três problemas de performance, todos de correção simples:

1. **Bundle monolítico de 2 MB** (586 KB gzip) — o Vite emite o aviso explicitamente.
   Nenhuma rota usa `React.lazy`/`import()`: as 24 páginas, o `jspdf`, o `jsqr`, o `recharts`
   e o `html2canvas` entram todos no *carregamento inicial*, mesmo para quem só quer ver o Dashboard.
2. **Imagens não otimizadas:** `logo-escola.png` tem **1,96 MB** — para uma logo exibida em
   40×40 px na sidebar. `banner-escola.png` tem 1,27 MB. Juntas somam **3,2 MB** de assets.
   Converter para WebP/AVIF redimensionado reduziria isso em >95%.
3. **Sem cache de dados:** cada navegação refaz as consultas do zero (§9.3).

Em uma escola pública, onde o acesso costuma vir de conexões móveis ou de rede institucional
limitada, esses 3+ MB de carga inicial são o gargalo de experiência mais palpável do projeto.

---

## 9. Achados e recomendações

### 9.1 🔴 Crítico — Projeto sem controle de versão local

A pasta **não contém `.git/`**. Com ~17 mil linhas de código e 33 migrações de banco, não há
histórico local, branches, nem possibilidade de reverter alterações. O `AGENTS.md` referencia
explicitamente um fluxo Git sincronizado com o Lovable, o que sugere que esta cópia é um
**download/export desconectado do repositório real**.

**Ação:** confirmar onde está o repositório canônico (provavelmente GitHub, conectado ao Lovable)
e trabalhar a partir de um `clone`. Se esta cópia contiver alterações locais, versioná-las antes
de qualquer modificação.

> ⚠️ O `AGENTS.md` alerta: **não reescrever histórico publicado** (force push, rebase/amend/squash
> de commits já enviados), pois isso corrompe o histórico do lado do Lovable.

### 9.2 🟠 Alto — `.env` versionável com credenciais

O `.env` existe com credenciais reais e **`.gitignore` não contém nenhuma entrada `.env`**.

A chave atual é uma `sb_publishable_...` — **pública por design** e protegida pela RLS,
então a exposição atual **não é uma brecha**. O risco é o *padrão*: no momento em que alguém
adicionar uma `service_role` ou outro segredo a esse arquivo, ele será commitado automaticamente.

**Ação:** adicionar `.env` ao `.gitignore` e criar um `.env.example` com as chaves sem valores.
(Nota: como o `VITE_` embute o valor no bundle, qualquer segredo real jamais deve ir para o `.env` de um app Vite.)

### 9.3 🟠 Alto — React Query instalado, montado e nunca usado

`QueryClientProvider` envolve toda a aplicação em `App.tsx`, mas a busca por
`useQuery`/`useMutation` retorna **0 arquivos**. Em vez disso, **25 arquivos** chamam
`supabase.from(...)` diretamente, com **20 páginas** orquestrando estado manualmente via
`useEffect` + `useState`.

Consequências: sem cache entre navegações, sem deduplicação de requisições, sem revalidação
em foco, e estados de `loading`/`error` reimplementados à mão em cada página — o que também
explica boa parte dos 18 avisos de `exhaustive-deps`.

**Ação:** ou adotar o React Query de fato (começando pelas páginas mais pesadas: `Notas`,
`Agenda`, `Tutoria`), ou removê-lo. Manter um provider inerte só confunde quem chega ao projeto.

### 9.4 🟡 Médio — 206 usos de `any` sobre um banco totalmente tipado

Ver §7.3. A correção é mecanicamente simples (usar `Database['public']['Tables'][...]['Row']`)
e elimina de uma vez a maior categoria de erro de lint do projeto.

### 9.5 🟡 Médio — Ausência total de testes de lógica

Ver §7.1. O cálculo de notas e médias (`Notas.tsx`, 1.231 linhas) manipula dados que afetam a
vida escolar de alunos reais e não tem **nenhuma** cobertura de teste.

### 9.6 🟡 Médio — Performance de carga inicial

Ver §8. Três ações de alto impacto e baixo esforço: `React.lazy` nas rotas, `manualChunks`
para as libs pesadas, e compressão das duas imagens.

### 9.7 🔵 Baixo — Limpeza e inconsistências

- **`src/pages/Index.tsx`** é órfão: contém apenas `export { default } from './Dashboard';` e
  não é importado em lugar nenhum.
- **`src/pages/NotFound.tsx`** existe mas **não está roteado** — o `App.tsx` usa
  `<Route path="*" element={<Navigate to="/" replace />} />`, então rotas inválidas redirecionam
  em silêncio em vez de mostrar o 404 já pronto.
- **Migração vazia:** `20260706130924_c2345e95-...sql` tem 77 bytes e nenhuma linha efetiva.
- **`README.md`** contém literalmente `TODO: Document your project here` — nenhuma documentação
  para quem chega ao projeto.
- **`tailwind.config.ts:110`** usa `require()`, violando `no-require-imports`.
- **Dois locks divergentes** após esta sessão (`bun.lock` + `package-lock.json`) — ver §2.1.

### 9.8 ✅ Pontos fortes

- **Segurança de banco levada a sério:** 327 políticas RLS, funções `SECURITY DEFINER` com
  `search_path` fixado, e um fluxo de aprovação de usuários deliberadamente endurecido ao
  longo das migrações.
- **Modelagem de domínio madura:** 40 tabelas que refletem a operação real de uma escola
  estadual paulista (ATPC, Prova Paulista, PDI, tutoria, replicabilidade).
- **Migrações versionadas e incrementais** — o histórico do schema está preservado, mesmo sem Git local.
- **Tipos do banco gerados** e disponíveis (só subutilizados).
- **Build e typecheck limpos**, tempo de dev server excelente (746 ms).
- **Separação de papéis coerente** entre banco e UI.
- **Funcionalidade não-trivial e bem executada:** a correção de provas por QR Code é um
  diferencial real, não um CRUD.

### 9.9 Ordem sugerida de ataque

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | Localizar/restaurar o repositório Git canônico | Baixo | 🔴 Crítico |
| 2 | `.env` no `.gitignore` + `.env.example` | Trivial | 🟠 Alto |
| 3 | Comprimir `logo-escola.png` e `banner-escola.png` | Trivial | 🟡 Visível |
| 4 | `React.lazy` nas 24 rotas + `manualChunks` | Baixo | 🟡 Alto |
| 5 | Testes para cálculo de notas/médias e `usePermissions` | Médio | 🟡 Alto |
| 6 | Decidir React Query: adotar ou remover | Médio | 🟠 Alto |
| 7 | Substituir `any` pelos tipos gerados (por página) | Médio | 🟡 Médio |
| 8 | Rotear `NotFound`, remover `Index.tsx`, escrever `README` | Trivial | 🔵 Baixo |
| 9 | Corrigir ou remover a configuração do Playwright | Baixo | 🔵 Baixo |

---

## 10. Relação com os demais documentos desta pasta

`PI-II_Docs` já continha análises do repositório **`projetoIntegrador` (EscolaAgenda)**.
São projetos **distintos**:

| | **EscolaAgenda** (`projetoIntegrador`) | **Painel Escolar Inteligente** (este) |
|---|---|---|
| Escopo | SaaS de **agenda** escolar | Suíte completa de **gestão pedagógica** |
| Stack | React 18 + Vite + **Tailwind v4** + Motion + **React Router 7** + Radix + MUI | React 18 + Vite + **Tailwind v3** + **React Router 6** + shadcn/Radix |
| Origem | Desenvolvimento manual (`prototipo/`) | Plataforma **Lovable** |
| Dados | Supabase, parte ainda em **mock** | Supabase **real**, 40 tabelas, sem mock |
| Backend | Ausente (direto do cliente) | Ausente (direto do cliente) — **mesma arquitetura** |
| Maturidade | ~10 páginas, protótipo avançado | 24 páginas, 33 migrações, produção-ready |

**Convergência relevante:** ambos adotam a mesma arquitetura SPA → Supabase direto, sem API
própria. O documento anterior registra que o pedido do usuário incluía **introduzir um backend
separado com PostgreSQL**. Vale notar que, neste projeto, esse papel já é cumprido de forma
robusta pela RLS do Supabase — uma API intermediária traria ganhos (lógica de negócio
centralizada, segredos fora do cliente, agregações server-side), mas **substituiria 327
políticas de segurança já escritas e testadas**. É uma decisão de arquitetura que merece ser
tomada com esse custo explícito na mesa.

---

## 11. Referência rápida

```
Projeto ......... Painel Escolar Inteligente — EE Prof. Edson Vianei Alves
Local ........... C:\projetos\aplicativoescola2026-main
Plataforma ...... Lovable  |  Supabase: yptddvvlxuttggvvrnit
Dev server ...... npm run dev → http://localhost:8080
Stack ........... Vite 5 · React 18 · TypeScript 5.8 · Tailwind 3 · shadcn/ui · Supabase
Código .......... 110 arquivos, ~16.900 linhas (src/)
Páginas ......... 24  |  Componentes UI: 48 shadcn + próprios
Banco ........... 40 tabelas · 327 políticas RLS · 33 migrações · 2.773 linhas SQL
Papéis .......... professor · coordenador · direcao · vice_direcao · admin
Status .......... ✅ instala, compila, roda e conecta sem ajustes
Riscos .......... sem Git local · .env não ignorado · 0% de testes reais · 206 `any` · bundle 2 MB
```

---

*Análise gerada em 2026-09-14 por inspeção estática do código-fonte, das migrações SQL e por
execução real de `install`, `dev`, `build`, `test`, `lint`, `tsc` e verificação de
conectividade com o Supabase.*
