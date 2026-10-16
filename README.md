# Painel Escolar Inteligente

Sistema de gestão escolar da **EE Prof. Edson Vianei Alves**, desenvolvido como Projeto Integrador (PI-II).
Reúne em um só lugar turmas, alunos, notas, provas, planos de aula, diário do professor, agenda,
ocorrências, PDI, tutoria e relatórios, com perfis de acesso para professor, coordenação, direção,
secretaria e administração.

O projeto está sendo reconstruído **do zero** com backend próprio: o Supabase deixa de ser o
backend da aplicação e passa a servir apenas como armazenamento de arquivos.

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| [`backend/`](backend/) | API própria — Node.js + Express + TypeScript + Prisma + PostgreSQL (Neon) |
| [`frontend/`](frontend/) | Interface web — React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| [`docs/`](docs/) | Registro de progresso, uma entrada por etapa executada, e resumos por fase |
| [`PI-II_Docs/`](PI-II_Docs/) | PRDs, levantamento e análise técnica, roteiros da equipe e guias de teste |

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query |
| Backend | Node.js, Express 5, TypeScript |
| ORM / Banco | Prisma 6 + PostgreSQL gerenciado no Neon |
| Autenticação | JWT emitido pelo próprio backend (tabela `usuarios`) |
| Arquivos | Supabase Storage (somente buckets) |
| Hospedagem do backend | Render |

## Roteiro

| Fase | Escopo | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ⏭️ próxima |
| 2 | Turmas, alunos, disciplinas | ⏳ a fazer |
| 3 | Envio e armazenamento de arquivos | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend ao backend | ⏳ a fazer |

O detalhe de cada etapa está em [`docs/`](docs/).

## Como rodar

Pré-requisitos: Node.js 20+ e um banco PostgreSQL (o projeto usa Neon; um Postgres local também serve).

### Backend

```bash
cd backend
npm install
cp .env.example .env     # preencher DATABASE_URL, DIRECT_URL e ADMIN_BOOTSTRAP_EMAIL
npm run prisma:deploy    # aplica as migrations
npm run seed             # dados iniciais e 1º administrador
npm run dev              # http://localhost:3333/health
```

Scripts e detalhes do schema: [`backend/README.md`](backend/README.md).

### Frontend

```bash
cd frontend
npm install
npm run dev              # servidor do Vite
```

Variáveis em `frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e
`VITE_SUPABASE_PROJECT_ID`. Até a Fase 6 o frontend ainda fala direto com o Supabase.

Outros comandos: `npm run build`, `npm run lint`, `npm test` (Vitest).

## Documentação

- [`PI-II_Docs/prd-migracao-backend-painelescolar.md`](PI-II_Docs/prd-migracao-backend-painelescolar.md) — planejamento da migração para backend próprio
- [`PI-II_Docs/levantamento-analise-projeto.md`](PI-II_Docs/levantamento-analise-projeto.md) — levantamento do sistema original
- [`PI-II_Docs/docs_testes/como-testar-fase0-fase1.md`](PI-II_Docs/docs_testes/como-testar-fase0-fase1.md) — como testar as fases 0 e 1
- [`docs/resumos/resumo-fase-0.md`](docs/resumos/resumo-fase-0.md) — resumo da Fase 0
