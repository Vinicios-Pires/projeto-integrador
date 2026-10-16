# Execução 02 — Fase 0, Parte 2: banco de dados no ar

**Data:** 15/10/2026
**Fase:** 0 — Preparar o banco de dados novo
**Status da parte:** ✅ concluída. **Com isso, a Fase 0 inteira está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ **concluída** |
| **1** | **Login novo (cadastro, entrar, aprovação, papéis)** | ⏭️ **próxima** |
| 2 | Turmas, alunos, disciplinas | ⏳ a fazer |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

---

## Mudança de rumo combinada nesta etapa

**O projeto é do zero. Não vamos dar continuidade ao sistema que está em produção.**

O que isso mudou no plano:

- **A Parte 3 da Fase 0 (ensaio de cópia dos dados do Supabase) foi cancelada.** Não há dados para copiar.
- **A Fase 6 ficou mais simples.** Antes era "travar o sistema, copiar os dados e mandar todo mundo trocar
  de senha". Agora é só **colocar o backend no ar e ligar as telas a ele**.
- **A estrutura do banco foi "arrumada".** Algumas imperfeições do banco antigo tinham sido mantidas só para
  a cópia não falhar. Sem cópia, foram corrigidas (detalhes abaixo).

## O que foi feito

1. **Ajustes na estrutura do banco:**
   - **Todas as ligações entre tabelas agora são verificadas.** Antes, 22 ligações eram "soltas": dava
     para gravar, por exemplo, uma média de um aluno que não existe. Agora o banco recusa.
   - **Senha obrigatória** para todo usuário.
2. **Banco criado no Neon** (o banco definitivo, na nuvem). Todas as tabelas foram criadas nele.
3. **Regras extras adicionadas à mão**, porque a ferramenta não as cria sozinha:
   - bimestre só de 1 a 4;
   - prioridade de lembrete só baixa/média/alta;
   - dia da semana só de 0 (domingo) a 6 (sábado);
   - situação do usuário só pendente/ativo/inativo;
   - situação do planejamento só rascunho/aguardando validação/validado;
   - tipo de anexo só documento/adaptada;
   - um professor não pode cadastrar o mesmo aluno duas vezes como tutorado.
4. **Dados iniciais carregados:**
   - grade de horários da escola (12 faixas, de 07:00 às 16:30, com intervalo e almoço);
   - ano letivo 2026 (02/02 a 18/12);
   - **primeiro administrador**: `admin@prof.educacao.sp.gov.br`, já ativo e com papel de admin.
5. **Conferência automática criada.** Um comando (`npm run db:check`) confere tudo isso de uma vez e pode
   ser repetido sempre que quiser.

## Sobre a senha do administrador

- Foi gerada uma **senha temporária** e mostrada **uma única vez** na conversa com o Claude.
- No primeiro login (quando a Fase 1 estiver pronta), o sistema vai **exigir a troca** dessa senha.
- O e-mail do admin fica numa configuração, não escrito no código, como o PRD pedia.

## Como foi conferido (no banco real)

| Conferência | Resultado |
|---|---|
| Tabelas criadas | 41 ✅ |
| Ligações entre tabelas verificadas | 89 (67 de antes + 22 novas) ✅ |
| Regras de valores permitidos | 6 ✅ (+ a regra do tutorado) |
| Grade de horários e ano letivo | ✅ |
| Administrador existe, está ativo, é admin e precisa trocar a senha | ✅ |
| Banco recusa dado inválido, ligação com algo inexistente e e-mail repetido | ✅ |
| Rodar os dados iniciais duas vezes não duplica nada | ✅ |
| Servidor liga e confirma que fala com o banco | ✅ |

## Uma observação prática

O Neon gratuito **"dorme" depois de alguns minutos sem uso** e leva alguns segundos para acordar. Na
primeira conferência isso fez a conexão falhar. Foi resolvido aumentando o tempo de espera da conexão.
Não precisa de nenhuma ação, mas é bom saber: **o primeiro acesso depois de um tempo parado pode
demorar uns segundos a mais**.

## Pendências que dependem da equipe

- O banco foi criado na região **EUA (us-east-1)**, não em São Paulo. Funciona normalmente, só com um pouco
  mais de demora em cada resposta. Se quiserem trocar, o melhor momento é **agora**, enquanto o banco está
  vazio: basta criar um projeto novo no Neon em São Paulo e trocar as strings no `.env`.
- Continua em aberto: **quem da equipe é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Execução 03 — Fase 1, Parte 1)

Começar o **login novo**: entrar com e-mail e senha, receber o "crachá digital" (token) e consultar
"quem sou eu". É a base de que todo o resto depende. O cadastro, a aprovação pelo admin e os papéis vêm
nas partes seguintes da Fase 1.
