# Execução 22 — Fase 5, Parte 3: eventos da escola, apoio presencial e lembretes

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
2. ✅ Agenda do professor ([execução 21](21-fase5-parte2-agenda-do-professor.md))
3. ✅ **Eventos da escola, apoio presencial e lembretes** ← esta execução
4. ⏳ **Ocorrências** (do notebook e escolares), com fotos
5. ⏳ **PDI**: evidências, com fotos e documentos
6. ⏳ **Tutoria**: tutorados, encontros, registros, combinados e documentos
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

---

## O que foi feito

Três partes pequenas que aparecem na **Agenda** e no **painel**:

| O quê | Quem vê | Quem mexe |
|---|---|---|
| **Eventos da escola** (reuniões, formações, conselhos, avisos…) | todo usuário logado | a gestão. Qualquer pessoa da gestão altera qualquer evento, porque o calendário é da escola |
| **Apoio presencial** (um responsável acompanha a aula de um professor num dia) | a gestão vê todos; o professor vê só os seus (acompanhado ou responsável) | a gestão |
| **Lembretes** (os post-its do painel) | **só quem criou**, nem a gestão | só quem criou, nem o admin |

### Proteções

- **Professor não cria, altera nem exclui** eventos ou apoios: a tela já esconde os botões, e agora o backend
  também recusa.
- **O fim de um evento não pode ser antes do início**, nem quando só um dos dois é alterado.
- Datas sempre válidas (o backend recusa, por exemplo, 30/02 ou "10/03/2099").
- O professor e o responsável do apoio precisam existir; o horário da grade, se informado, também.
- **Lembretes são privados:** quem não é o dono recebe "não encontrado", como se o lembrete não existisse.

## Decisões tomadas nesta parte

- **Data e hora sem fuso valem como UTC**, que é o que o Supabase fazia com o mesmo texto vindo da tela. Assim
  os eventos já cadastrados e os novos ficam iguais. Quando a tela for ligada (Fase 6), dá para mandar o fuso de
  São Paulo junto, se a equipe preferir.
- **"Até" inclui o dia inteiro** no filtro de período: pedir de 10/03 até 10/03 traz os eventos daquele dia.
- **Os lembretes são do dono e de mais ninguém.** São anotações pessoais; a gestão não tem por que vê-las.

## Como foi conferido

Foi criada a conferência `npm run test:escola`. Ela cria 5 usuários de teste (admin, coordenação, direção e dois
professores) e um horário de grade próprio do teste, testa pela API e apaga tudo no final. Os eventos do teste
ficam em **2099**, para não se misturarem com o calendário real.

| Conferência | Resultado |
|---|---|
| Eventos (criar, hora como veio, dia inteiro, dados e datas errados, fim antes do início, professor não mexe, período, filtro, outra pessoa da gestão altera, excluir, sem login) | 19 de 19 ✅ |
| Apoio presencial (marcar, dados errados, usuário e horário inválidos, quem vê o quê, filtro, alterar, excluir) | 13 de 13 ✅ |
| Lembretes (criar, padrões, dados errados, fixados primeiro, concluir, privados até para a gestão e o admin, apagar) | 11 de 11 ✅ |
| **Total da nova conferência** | **43 de 43 ✅** |

Também foram repetidas:

- **Eventos, apoio presencial e lembretes** (`npm run test:escola`): 43 de 43 ✅
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

- **Collection do Bruno:** a pasta nova *Escola* rodou inteira contra a API, com uma coordenadora e um professor
  temporários (eventos e apoio pela coordenação; lembretes pelo professor): 8 de 8 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Nova pasta **Escola**:

| Pedido | O que faz |
|---|---|
| **Criar evento** | A gestão cria um conselho de classe; guarda o id em `eventoId` |
| **Listar eventos** | Os eventos de dezembro de 2026 |
| **Excluir evento** | A gestão exclui o evento |
| **Marcar apoio presencial** | A gestão marca o apoio (usa `professorId` e `responsavelId`); guarda o id em `apoioId` |
| **Excluir apoio presencial** | A gestão exclui o apoio |
| **Criar lembrete** / **Concluir lembrete** / **Excluir lembrete** | Os post-its de quem está logado |

O ambiente ganhou as variáveis `professorId` e `responsavelId` (ids de *Usuarios > Listar usuarios*).

## O que ainda NÃO existe

- Ocorrências, PDI, tutoria e replicabilidade (Partes 4 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Fuso das datas dos eventos:** manter como hoje (UTC) ou passar a mandar o de São Paulo na Fase 6.
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 4)

**Ocorrências**: as ocorrências do notebook (com fotos) e as ocorrências escolares.
