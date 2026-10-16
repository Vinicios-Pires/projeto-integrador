# Resumo da Fase 0 — Preparar o banco de dados novo

**Período:** 15/10/2026
**Situação:** ✅ concluída
**Execuções que fizeram parte desta fase:**
[01 — estrutura do banco](../01-fase0-parte1-estrutura-do-banco.md) ·
[02 — banco no ar](../02-fase0-parte2-banco-no-ar.md)

---

## Em uma frase

O backend novo ganhou sua fundação: o projeto foi criado, o banco de dados foi desenhado e está no ar no
Neon, com as tabelas, as regras e os dados iniciais prontos para receber o login na Fase 1.

---

## Ponto de partida

- Nesta pasta já existiam os documentos de planejamento (PRDs e roteiro de fases) e o frontend atual
  (`aplicativoescola2026-main`), que hoje fala direto com o Supabase.
- Existia também um backend antigo em `C:\projetos\painelescolar-backend`. **Ele não está sendo usado.** A
  decisão foi começar do zero, dentro desta pasta, em `backend/`.

## Decisões importantes tomadas na Fase 0

| Decisão | Por quê |
|---|---|
| **Backend do zero**, em `projeto-integrador/backend` | Escolha da equipe: construir com calma, fase por fase |
| **Projeto novo, sem continuidade do sistema em produção** | Não há dados nem senhas antigas para trazer, o que simplifica muito o plano |
| **Mesmos nomes de tabelas e campos do sistema anterior** | As telas existentes já esperam esses nomes, então adaptá-las depois dá menos trabalho |
| **Uma tabela nova, `usuarios`**, para o login próprio | Substitui o login do Supabase. Guarda e-mail, senha criptografada e o aviso de "precisa trocar a senha" |
| **Todas as ligações entre tabelas verificadas pelo banco** | Sem dados antigos para importar, não há motivo para aceitar dados inconsistentes |
| **Banco no Neon** (nuvem, plano gratuito) | É o banco definitivo previsto no PRD, e esta máquina não tem Docker para um banco local |
| **E-mail do primeiro admin numa configuração**, fora do código | Pedido do PRD: no sistema antigo esse e-mail ficava escrito direto no banco |

## Impacto no plano geral

- **A parte de "ensaio de cópia dos dados" foi cancelada**, porque não há dados para copiar.
- **A Fase 6 ficou mais simples.** Antes ela era "travar o sistema, copiar os dados e mandar todos
  trocarem de senha". Agora é só **colocar o backend no ar e ligar as telas a ele**.

## O que existe agora

### Projeto do backend (`backend/`)
- Criado com a tecnologia definida no PRD: Node.js, Express, TypeScript e Prisma.
- O servidor liga e tem um endereço de verificação (`/health`) que confirma que ele está no ar **e** que
  consegue falar com o banco.

### Banco de dados (Neon)
- **41 tabelas**: as 40 do modelo de dados do sistema anterior, mais `usuarios`.
- **89 ligações verificadas entre tabelas.** O banco recusa, por exemplo, uma nota de um aluno que não
  existe.
- **7 regras de valores permitidos**: bimestre de 1 a 4, prioridade baixa/média/alta, dia da semana de 0 a
  6, situação do usuário, situação do planejamento, tipo de anexo, e um mesmo aluno não pode ser tutorado
  duas vezes pelo mesmo professor.

### Dados iniciais
- **Grade de horários da escola:** 12 faixas, de 07:00 às 16:30, com intervalo, almoço e ATPC.
- **Ano letivo 2026:** de 02/02 a 18/12.
- **Primeiro administrador:** `admin@prof.educacao.sp.gov.br`, ativo, com papel de admin e senha
  temporária. A troca de senha vai ser exigida no primeiro acesso.
  > A senha temporária foi mostrada uma única vez na conversa e **não está registrada em nenhum
  > documento**, de propósito.

### Ferramentas de apoio
- **Conferência automática do banco** (`npm run db:check`): checa tabelas, ligações, regras, dados
  iniciais e o administrador. Não altera nada e pode ser repetida a qualquer momento.
- **Dados iniciais repetíveis** (`npm run seed`): rodar de novo não duplica nada.

## Como sabemos que funciona

Na última conferência, feita direto no banco real, as **13 checagens passaram**:

- 41 tabelas, 89 ligações e 6 regras de valores no banco;
- grade de horários e ano letivo cadastrados;
- administrador existe, está ativo, é admin e precisa trocar a senha;
- senha errada é rejeitada;
- o banco recusa situação inválida, ligação com algo inexistente e e-mail repetido.

Além disso, a checagem de tipos do código não acusa nenhum erro e o servidor respondeu "ok" confirmando
a conexão com o banco.

## Problema encontrado e resolvido

O Neon gratuito **"dorme" depois de alguns minutos sem uso** e leva alguns segundos para acordar, o que
fez uma conexão falhar. Isso foi resolvido aumentando o tempo de espera da conexão para 15 segundos. Na
prática, **o primeiro acesso depois de um tempo parado pode demorar uns segundos a mais.**

## Pendências que dependem da equipe

1. **Região do banco:** o Neon foi criado nos **EUA**, não em São Paulo. Funciona, mas cada resposta
   demora um pouco mais. Se for para trocar, o momento é **antes da Fase 1**, enquanto o banco está vazio.
2. **Dono de cada conta:** ainda falta definir quem da equipe é responsável por cada serviço (Neon,
   Render e Supabase).

## Próxima fase

**Fase 1 — Login novo.** Entrar com e-mail e senha, receber o token, consultar "quem sou eu", fazer o
cadastro de novos usuários, a aprovação pelo admin, os papéis (professor, coordenação, direção,
vice-direção, admin) e a troca de senha obrigatória no primeiro acesso.
