# Execução 01 — Fase 0, Parte 1: projeto criado e estrutura do banco desenhada

**Data:** 15/10/2026
**Fase:** 0 — Preparar o banco de dados novo
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| **0** | **Preparar o banco de dados novo** | 🟡 **em andamento (parte 1 de 3 feita)** |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ⏳ a fazer |
| 2 | Turmas, alunos, disciplinas | ⏳ a fazer |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Corte final (a virada de verdade) | ⏳ a fazer |

### A Fase 0 foi dividida em 3 partes

1. ✅ **Criar o projeto e desenhar a estrutura do banco** ← esta execução
2. ⏳ Ligar a um banco de verdade e criar as tabelas nele (+ dados iniciais: grade de horários e ano letivo)
3. ⏳ Ensaio de cópia dos dados atuais do Supabase para o banco novo

---

## O que foi feito

- **Decisão inicial:** começar o backend do zero, dentro desta pasta, em `backend/`.
  (Existe um backend antigo em `C:\projetos\painelescolar-backend`, que **não** está sendo usado.)
- **Criado o projeto do backend** com a tecnologia combinada nos PRDs (Node.js, Express, TypeScript, Prisma).
- **Desenhada a "planta" do banco de dados** — o arquivo que descreve todas as tabelas
  (`backend/prisma/schema.prisma`). Ela foi montada lendo as 33 alterações de banco que o
  sistema atual acumulou ao longo do tempo e conferida contra o retrato final do banco em produção.
- **O servidor liga e responde** — por enquanto só um endereço de "estou vivo" (`/health`), sem
  nenhuma funcionalidade real ainda.

## Decisões tomadas nesta parte

- **Nomes iguais ao sistema atual.** Todas as tabelas e campos têm exatamente os mesmos nomes de hoje.
  Isso facilita duas coisas lá na frente: copiar os dados (vira uma cópia direta) e adaptar as telas
  (elas vão receber as informações no mesmo formato que já recebem).
- **Uma única tabela nova: `usuarios`.** Ela substitui o "cadastro de login" que hoje fica escondido
  dentro do Supabase. Guarda o e-mail, a senha (criptografada) e uma marcação de "precisa trocar a senha" —
  que vai ser usada no dia da virada, quando todo mundo receber senha temporária.
- **Fidelidade acima de "arrumar".** Onde o banco atual tem alguma imperfeição (por exemplo, ligações
  entre tabelas que não são verificadas), ela foi mantida igual por enquanto, para que a cópia dos dados
  não falhe. Melhorias ficam para depois da virada.

## Como foi conferido

| Conferência | Resultado |
|---|---|
| Quantidade de tabelas | 41 = as 40 de hoje + `usuarios` ✅ |
| Listas fixas de opções (papéis, tipos de horário, tipos de evento) | 3 de 3 ✅ |
| Ligações entre tabelas | 67 — mesmo número do banco atual ✅ |
| A "planta" é válida? | Sim ✅ |
| O servidor liga? | Sim, respondeu "ok" ✅ |

## O que ainda NÃO existe

- Nenhum banco de dados de verdade ligado ainda (isso é a parte 2).
- Nenhuma tela foi alterada — o sistema que a escola usa hoje **não foi afetado em nada**.
- Algumas regras de validação do banco atual (ex.: "bimestre só pode ser de 1 a 4", "prioridade só
  baixa/média/alta") não cabem na "planta" e vão ser adicionadas à mão na parte 2. Já estão anotadas.

## Próximo passo (Execução 02 — Fase 0, Parte 2)

Ligar o projeto a um banco de dados real e criar as tabelas nele. Para isso vai ser preciso escolher:

- **Banco local** (precisa do Docker instalado no computador) — rápido para testar, ou
- **Neon** (o banco definitivo, na nuvem) — precisa de alguém da equipe criar a conta gratuita em
  neon.tech e me passar o endereço de conexão.

Lembrete do PRD: ainda falta definir **quem da equipe é dono de cada conta** (Neon, Render, Supabase).
