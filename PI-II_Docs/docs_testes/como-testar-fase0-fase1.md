# Como testar o que já foi construído (Fase 0 + Fase 1)

**Data:** 2026-10-13
**Escopo testável agora:** schema do banco (Fase 0) + login/cadastro/gestão de
usuários (Fase 1), do projeto `C:\projetos\painelescolar-backend`.
**Fora de escopo ainda:** turmas/alunos/notas/arquivos etc. (Fases 2 a 5 —
ainda não foram construídas, não há o que testar nelas).

> ⚠️ **O que eu não consegui fazer sozinho:** esta máquina (ambiente onde o
> código foi gerado) não tem Docker nem Postgres instalado, então não
> consegui rodar o backend contra um banco de verdade e testar ponta a
> ponta eu mesmo. Tudo abaixo foi verificado até onde dava (schema válido,
> TypeScript compila, servidor sobe, validações respondem certo) — o que
> falta é exatamente os passos deste guia, feitos por você.

---

## 1. Visão geral: dois jeitos de testar

| | **Opção A — Postgres local (Docker)** | **Opção B — Neon** |
|---|---|---|
| Precisa de conta em algum site? | Não | Sim (gratuita) |
| Precisa instalar algo? | Docker Desktop | Nada |
| Dados somem se eu desligar o PC? | Não (ficam salvos no Docker) | Não (fica na nuvem) |
| É o banco que o projeto vai usar de verdade? | Não — é só para testar agora | Sim — é o banco definitivo |
| Recomendado para | Testar rápido, sem burocracia | Quando já estiver confiante e quiser validar no banco real |

**Sugestão:** comece pela Opção A. É mais rápida para um primeiro teste. Dá
para repetir tudo depois na Opção B sem perder nada.

---

## 2. Pré-requisitos

- **Node.js** já está instalado nesta família de projetos (confirmado:
  v24.18.0) — nenhuma ação necessária.
- **Para a Opção A:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  instalado e aberto (ele precisa estar rodando em segundo plano).
- **Para a Opção B:** uma conta em [neon.tech](https://neon.tech) (login com
  GitHub/Google, gratuito).
- **Insomnia** (ou [Postman](https://www.postman.com/downloads/), se
  preferir): [insomnia.rest/download](https://insomnia.rest/download) —
  gratuito, é um programa para testar APIs sem precisar escrever código.

---

## 3. Opção A — Testar com Postgres local (Docker)

### 3.1 Subir o banco

Abra um terminal (PowerShell) na pasta do backend:

```powershell
cd C:\projetos\painelescolar-backend
npm install
npm run db:local:up
```

Isso baixa e liga um Postgres dentro do Docker (só na primeira vez demora
um pouco, para baixar a imagem). Para conferir se subiu:

```powershell
docker ps
```

Deve aparecer um container chamado `painelescolar-postgres` com status `Up`.

### 3.2 Configurar o projeto para usar esse banco

```powershell
copy .env.example.local .env
```

Esse arquivo já vem com tudo pronto para o banco local — não precisa editar
nada para este primeiro teste.

### 3.3 Criar as tabelas no banco

```powershell
npm run prisma:migrate -- --name init
```

Isso lê o `prisma/schema.prisma` (as 40 tabelas) e cria todas elas no banco
que acabou de subir. Deve terminar com uma mensagem do tipo
`Your database is now in sync with your schema`.

### 3.4 Popular os dados de fábrica

```powershell
npm run seed
```

Cria a grade de horários padrão (12 blocos) e o ano letivo de 2026 — os
mesmos dados que existiam via `INSERT` direto nas migrações do sistema
antigo.

### 3.5 Ligar o servidor

```powershell
npm run dev
```

Deve aparecer: `Painel Escolar — backend ouvindo em http://localhost:3333`.
**Deixe este terminal aberto** — é o servidor rodando. Para os próximos
passos, abra um terminal novo (ou o Insomnia).

---

## 4. Opção B — Testar com Neon (banco definitivo)

1. Crie uma conta em [neon.tech](https://neon.tech) e um projeto novo (pode
   chamar de `painelescolar`).
2. No painel do Neon, na tela de **"Connection string"**, copie **as duas**
   variantes — Neon mostra um alternador/dois botões "Pooled connection" e
   "Direct connection":
   - **Pooled** (hostname com `-pooler` no meio) → vai em `DATABASE_URL`
   - **Direct** (hostname sem `-pooler`) → vai em `DIRECT_URL`

   > ⚠️ **Por que as duas?** O Prisma usa `DATABASE_URL` (com pooling) para
   > o servidor rodar normalmente, mas `prisma migrate` precisa da conexão
   > **direta** — o pooler do Neon não permite a trava de sessão que uma
   > migração usa. Usar só a pooled nas duas variáveis causa exatamente o
   > erro `P1001 Can't reach database server` ao rodar o passo 3.3/4.
3. No terminal:
   ```powershell
   cd C:\projetos\painelescolar-backend
   npm install
   copy .env.example .env
   ```
4. Abra o `.env` recém-criado num editor de texto e troque:
   - `DATABASE_URL` → cole a connection string **pooled** (com `-pooler`)
   - `DIRECT_URL` → cole a connection string **direct** (sem `-pooler`)
   - `JWT_SECRET` → gere um valor aleatório rodando:
     ```powershell
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
     e cole o resultado
   - `ADMIN_BOOTSTRAP_EMAIL` → o e-mail que você vai usar para testar o login como admin
5. Siga os passos 3.3 a 3.5 acima (migrate, seed, dev) — são os mesmos,
   só que agora apontando para o Neon em vez do Docker.

---

## 5. Testando pelo Insomnia (recomendado)

### 5.1 Importar a coleção pronta

1. Abra o Insomnia.
2. `Application` → `Preferences` → `Data` → `Import Data` → `From File`
   (ou arraste o arquivo direto para a janela do Insomnia).
3. Selecione:
   ```
   C:\projetos\painelescolar-backend\insomnia\painelescolar-backend.insomnia.json
   ```
4. Vai aparecer um workspace chamado **"Painel Escolar — Backend"**, já com
   todas as requisições organizadas em pastas: `0. Saúde do servidor`,
   `1. Auth`, `2. Usuários (admin)`.
5. No canto superior, confirme que o ambiente selecionado é **"Local"** — é
   ele que já vem com `baseUrl = http://localhost:3333` preenchido.

> ⚠️ O ambiente do Insomnia vem com `adminEmail = admin@teste.local`, que é
> exatamente o `ADMIN_BOOTSTRAP_EMAIL` do `.env.example.local` (Opção A) —
> por isso a conta do passo 2 abaixo já nasce admin automaticamente. **Se
> você foi pela Opção B (Neon)** e usou outro e-mail no `ADMIN_BOOTSTRAP_EMAIL`
> do seu `.env`, edite o `adminEmail` do ambiente do Insomnia para o mesmo
> valor antes de começar (ícone de engrenagem no canto superior, ou `Ctrl+E`).

### 5.2 Roteiro de teste (siga nesta ordem)

Cada item diz o que esperar. Se o resultado for diferente do esperado, veja
a seção 7 (Problemas comuns).

| # | Requisição | O que fazer | Resultado esperado |
|---|---|---|---|
| 1 | `GET /health` | Clique em **Send** | `200 OK`, corpo `{"ok": true}` — confirma que o servidor está no ar |
| 2 | `POST /auth/signup — cadastrar admin (bootstrap)` | **Send** | `201 Created` — conta criada. Se usou `.env.example.local`, essa conta já nasce **ativa** e **admin** (porque o e-mail bate com `ADMIN_BOOTSTRAP_EMAIL`) |
| 3 | `POST /auth/signup — domínio inválido` | **Send** | `400` com mensagem sobre domínio institucional — confirma que a validação de e-mail está funcionando |
| 4 | `POST /auth/signup — professor institucional` | **Send** | `201 Created`, mas a mensagem diz que a conta está **aguardando aprovação** (nasce com status `pendente`) |
| 5 | `POST /auth/login` (com o e-mail do admin) | **Send** | `200 OK`, vem um `token` na resposta. **Copie esse token.** |
| 6 | Ambiente "Local" | Cole o token copiado no campo `token` do ambiente (ícone de engrenagem, ou `Ctrl+E`) | — |
| 7 | `GET /auth/me` | **Send** | `200 OK`, mostra os dados do admin, com `"role": "admin"` |
| 8 | `GET /auth/me — sem token` | **Send** | `401` — confirma que a rota exige login |
| 9 | `POST /auth/login — senha errada` | **Send** | `401` com "E-mail ou senha incorretos" |
| 10 | `GET /usuarios — listar todos` | **Send** | `200 OK`, lista o admin **e** a professora pendente do passo 4 |
| 11 | Copie o `id` da professora (da resposta do passo 10) | — | — |
| 12 | `PATCH /usuarios/:id/status — aprovar` | Cole o `id` da professora na URL (substitua `SUBSTITUA_PELO_ID`), **Send** | `200 OK`, `"status": "ativo"` |
| 13 | `PATCH /usuarios/:id/role — definir papel` | Mesmo `id`, **Send** | `200 OK`, `"role": "professor"` |
| 14 | `POST /usuarios/:id/resetar-senha` | Mesmo `id`, **Send** | `200 OK`, retorna uma `senhaTemporaria` — é o fluxo manual de reset (decisão do PRD: sem e-mail automático) |
| 15 | `POST /auth/trocar-senha` | **Send** (usa a senha do admin) | `200 OK` — a partir daqui, se for testar login de novo, use `novaSenha123456` |
| 16 | `GET /usuarios — sem permissão` | **Send** (token falso de propósito) | `401` (token inválido) — para testar o `403` de verdade, faça login como a professora (agora ativa) e use o token dela aqui |

Se todos os 16 passos baterem com o "resultado esperado", **a Fase 0 e a
Fase 1 estão funcionando corretamente de ponta a ponta.**

---

## 6. Inspecionar o banco visualmente (Prisma Studio)

Para ver as tabelas e os dados como uma planilha, sem escrever SQL:

```powershell
npm run prisma:studio
```

Abre automaticamente uma aba no navegador (`http://localhost:5555`) com
todas as 40 tabelas. Clique em `usuarios` para ver as contas criadas nos
testes acima (a senha aparece como hash — isso é esperado e correto, é o
objetivo do hash).

---

## 7. Testando sem Insomnia (alternativa via terminal)

Se preferir não instalar o Insomnia agora, os mesmos testes dá para fazer
direto no PowerShell com `Invoke-RestMethod` (mais simples que `curl` no
Windows, porque lida melhor com o corpo em JSON):

```powershell
# 1. Saúde
Invoke-RestMethod http://localhost:3333/health

# 2. Cadastrar o admin
$body = @{ nome = "Admin"; email = "admin@teste.local"; senha = "senha123456" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3333/auth/signup `
  -ContentType "application/json" -Body $body

# 3. Login — guarda o token direto numa variável, sem copiar/colar na mão
$loginBody = @{ email = "admin@teste.local"; senha = "senha123456" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3333/auth/login `
  -ContentType "application/json" -Body $loginBody
$token = $login.token

# 4. Usar o token
Invoke-RestMethod http://localhost:3333/auth/me -Headers @{ Authorization = "Bearer $token" }

# 5. Listar usuários (precisa do admin aprovado/bootstrap, ver passo 2 do roteiro)
Invoke-RestMethod http://localhost:3333/usuarios -Headers @{ Authorization = "Bearer $token" }
```

Cada `Invoke-RestMethod` já devolve o JSON como objeto PowerShell — dá para
inspecionar campo a campo, por exemplo `$login.usuario.role`. É mais rápido
para testes pontuais; para repetir o roteiro completo da seção 5 várias
vezes, o Insomnia continua mais confortável.

---

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Can't reach database server` (no `npm run dev`, chamando uma rota) | Banco não está rodando, ou `.env` aponta para o lugar errado | Opção A: `docker ps` confirma se o container está `Up`. Opção B: confira se colou a connection string certa no `.env` |
| `Error: P1001` especificamente no `npm run prisma:migrate` (Opção B/Neon), com o host da mensagem de erro terminando em algo como `-pooler.....neon.tech` | `DIRECT_URL` está com a connection string **pooled** (ou está igual à `DATABASE_URL`) — migração não funciona através do pooler | No painel do Neon, copie a connection string **sem** `-pooler` no host e cole em `DIRECT_URL` no `.env`. Ver seção 4, passo 2 |
| `npm run db:local:up` trava ou dá erro | Docker Desktop não está aberto | Abra o Docker Desktop e espere o ícone ficar "verde"/pronto antes de rodar de novo |
| `Environment variable not found: DATABASE_URL` | Esqueceu de copiar o `.env` | Rode `copy .env.example.local .env` (Opção A) ou `copy .env.example .env` (Opção B) |
| `401` em tudo, mesmo com token colado | Token expirou, ou foi copiado com aspas/espaço sobrando | Faça login de novo e cole só o valor puro do token no ambiente do Insomnia |
| `403` ao listar usuários mesmo logado como admin | O cadastro não usou o e-mail de `ADMIN_BOOTSTRAP_EMAIL` | Confira se o e-mail do passo 2 é **exatamente igual** ao `ADMIN_BOOTSTRAP_EMAIL` do `.env` |
| Porta 3333 ou 5432 "já em uso" | Outro programa (ou uma instância anterior do próprio projeto) já está usando essa porta | Feche o processo anterior, ou troque a porta no `.env` (`PORT=`) |

---

## 9. O que este guia **não** testa (ainda)

Upload de arquivo, turmas, alunos, notas, planos de aula e os demais
módulos **ainda não foram construídos** no backend novo — são as Fases 2 a
5 do roteiro (`PI-II_Docs/roteiro-fases-migracao-equipe.pdf`). Este guia
cobre exatamente o que já existe hoje: o banco (Fase 0) e o login completo
(Fase 1). Um novo guia de testes será escrito conforme cada fase seguinte
for implementada.
