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

## Schema

`prisma/schema.prisma`: 40 tabelas do modelo de dados original (mesmos nomes, snake_case) + `usuarios`
(login próprio). Regras que o Prisma não expressa (CHECKs e um índice único parcial) estão no final de
`prisma/migrations/*_init/migration.sql`.

## Primeiro administrador

Criado pelo seed com o e-mail de `ADMIN_BOOTSTRAP_EMAIL`. Se `ADMIN_BOOTSTRAP_PASSWORD` estiver vazio,
uma senha temporária é gerada e exibida uma única vez; a troca é exigida no primeiro acesso.
