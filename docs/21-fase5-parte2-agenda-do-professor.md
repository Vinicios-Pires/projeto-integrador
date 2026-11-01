# Execução 21 — Fase 5, Parte 2: agenda do professor

**Data:** 31/10/2026
**Fase:** 5 — Demais módulos
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (o teste com o Supabase real fica para depois) |
| 4 | Notas/Provas e Planos de Aula | ✅ concluída |
| **5** | **Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade)** | 🔄 **em andamento** |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 5

1. ✅ Diário de classe ([execução 20](20-fase5-parte1-diario-de-classe.md))
2. ✅ **Agenda do professor**: a rotina da semana e as exceções ← esta execução
3. ⏳ **Eventos da escola, apoio presencial e lembretes**
4. ⏳ **Ocorrências** (do notebook e escolares), com fotos
5. ⏳ **PDI**: evidências, com fotos e documentos
6. ⏳ **Tutoria**: tutorados, encontros, registros, combinados e documentos
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

---

## O que foi feito

É o backend da tela **"Agenda"**. Ela tem duas camadas:

- **a rotina da semana:** o que o professor tem em cada dia e horário da grade (turma, matéria ou outra atividade).
  Ele define uma vez, e a rotina vale para o ano todo;
- **as exceções de um dia:** quando, numa data específica, a aula muda, é cancelada ou é uma reposição.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver a rotina e as exceções** | o próprio professor; a gestão, de qualquer professor | As exceções também por período. |
| **Gravar a rotina** | cada um, na própria agenda | Uma célula, ou várias de uma vez (o botão "replicar a segunda para a semana"). |
| **Limpar uma célula da rotina** | dono e admin | |
| **Gravar exceções** | cada um, na própria agenda | Mudar ou **cancelar** a aula de um dia, ou repetir em várias datas ("até o fim do ano"). |
| **Desfazer uma exceção** | dono e admin | O dia volta a seguir a rotina. |

### Proteções

- **Cada um grava só a própria agenda.** Nem a gestão grava na agenda do professor: o que ela grava vai para
  a agenda dela.
- **Um professor não vê a agenda de outro.**
- **Um item por dia e horário** (na rotina) e **um por data e horário** (nas exceções). Gravar de novo corrige.
- O horário precisa existir na grade da escola, e a turma e a matéria precisam ser do professor.
- **Tudo ou nada:** se um item da lista estiver errado, nenhum entra.

## Decisões tomadas nesta parte

- **Gravar em lista**, com "grava ou corrige": a tela faz hoje um pedido por célula (e por semana, no "até o fim
  do ano"); agora vai tudo numa ida só, e nunca fica pela metade.
- **A gestão só vê**, e grava apenas na própria agenda. A agenda é pessoal; editar a de um professor ficaria
  confuso. O admin pode limpar itens, para resolver problemas.
- **Excluir um horário da grade em uso continua bloqueado** (decisão da Fase 2): a agenda nunca perde aulas
  sem aviso.

## Como foi conferido

Foi criada a conferência `npm run test:agenda`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), **horários de grade próprios do teste** (a grade real da escola não é tocada), turmas e matérias,
testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Rotina (gravar, replicar a semana, corrigir sem duplicar, dados errados, horário e turma inválidos, tudo ou nada, quem vê, gestão grava na própria, limpar, quem pode) | 18 de 18 ✅ |
| Exceções (mudar um dia, cancelar, várias datas, período, dados errados, quem vê, desfazer, sem login) | 12 de 12 ✅ |
| **Total da nova conferência** | **30 de 30 ✅** |

Também foram repetidas (valem para as Partes 1 e 2):

- **Agenda do professor** (`npm run test:agenda`): 30 de 30 ✅
- **Diário de classe** (`npm run test:diario`): 44 de 44 ✅
- **Aprovação e anexos** (`npm run test:aprovacao`): 37 de 37 ✅
- **Planos de aula** (`npm run test:planos`): 59 de 59 ✅
- **Planejamento bimestral** (`npm run test:planejamentos`): 45 de 45 ✅
- **Correção de provas** (`npm run test:correcao`): 37 de 37 ✅
- **Provas e gabaritos** (`npm run test:provas`): 50 de 50 ✅
- **Médias arredondadas** (`npm run test:medias`): 39 de 39 ✅
- **Avaliações e notas** (`npm run test:notas`): 58 de 58 ✅
- **Ligação com o Supabase Storage** (`npm run test:supabase-storage`): 27 de 27 ✅
- **Correio de arquivos** (`npm run test:arquivos`): 51 de 51 ✅
- **Grade e ano letivo** (`npm run test:calendario`): 47 de 47 ✅
- **Eletivas** (`npm run test:membros`): 32 de 32 ✅
- **Matérias** (`npm run test:disciplinas`): 61 de 61 ✅
- **Alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Login** (`npm run test:login`): 31 de 31 ✅
- **Banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅

- **Collection do Bruno:** a pasta nova *Agenda* rodou inteira contra a API, com um professor temporário e um
  horário de grade criado e excluído pelo admin temporário: 5 de 5 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Nova pasta **Agenda**:

| Pedido | O que faz |
|---|---|
| **Ver rotina** | A rotina da semana |
| **Salvar rotina** | Grava a segunda-feira no horário de `horarioId`; guarda o id em `rotinaId` |
| **Salvar excecoes** | Cancela a aula de 09/11/2026 naquele horário; guarda o id em `excecaoId` |
| **Desfazer excecao** | O dia volta à rotina |
| **Limpar rotina** | Limpa a célula da rotina |

> **Dica:** rode antes *Calendario > Criar horario* (com o admin), *Turmas > Criar turma* e
> *Materias > Criar materia*.

## O que ainda NÃO existe

- Eventos da escola, apoio presencial, lembretes, ocorrências, PDI, tutoria e replicabilidade (Partes 3 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 3)

**Eventos da escola, apoio presencial e lembretes**: o calendário de eventos da escola (reuniões, formações,
conselhos…), as marcações de apoio presencial e os lembretes de cada um.
