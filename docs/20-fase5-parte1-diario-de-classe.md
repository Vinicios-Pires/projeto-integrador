# Execução 20 — Fase 5, Parte 1: diário de classe

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

Cada parte é uma tela (ou um grupo de telas pequenas):

1. ✅ **Diário de classe**: atividades, lançamentos e observação por aluno ← esta execução
2. ⏳ **Agenda do professor**: as aulas fixas da semana e as exceções (troca, falta, reposição)
3. ⏳ **Eventos da escola, apoio presencial e lembretes**
4. ⏳ **Ocorrências** (do notebook e escolares), com fotos
5. ⏳ **PDI**: evidências, com fotos e documentos
6. ⏳ **Tutoria**: tutorados, encontros, registros, combinados e documentos
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

A ordem vai das telas de uso diário do professor para as da gestão e dos projetos.

---

## O que foi feito

É o backend da tela **"Diário do Professor"**: uma planilha por turma, matéria e bimestre, em que cada coluna é
uma **atividade** (caderno, tarefa, participação…) e cada célula é o **lançamento** de um aluno. Cada aluno
também pode ter uma **observação** no bimestre.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver as atividades** | dono e gestão | Na ordem das colunas. |
| **Criar atividade** | todo usuário logado, nas próprias turmas e matérias | Nome, tipo (nota ou conceito), data, peso e categoria. Vai para o fim. |
| **Editar, reordenar, excluir** | dono e admin | Excluir leva junto os lançamentos (a tela já avisa). |
| **Lançar** | dono e admin | Uma ou várias células de uma vez, **inclusive colando do Excel**. Célula vazia apaga. |
| **Observação do aluno** | dono e admin escrevem; gestão vê | Uma por aluno, turma, matéria e bimestre. Vazia apaga. |

### Proteções

- **Um professor não vê nem mexe no diário de outro.** A gestão vê, mas não altera.
- **O aluno precisa ser da turma da atividade** (ou participante, se for eletiva).
- **Colar do Excel é tudo ou nada:** se uma célula estiver errada, nenhuma entra.
- Corrigir uma célula ou uma observação **atualiza**; nunca cria uma segunda.
- A atividade **não muda de turma nem de matéria** depois de criada (os lançamentos são daquela turma).

## Decisões tomadas nesta parte

- **A célula guarda o texto como foi digitado** ("8,5", "MB", "F"), até 30 caracteres, só sem os espaços das
  pontas. O diário aceita notas e conceitos, e quem cola do Excel não pode ter o lote recusado por causa de um
  formato. A tela continua calculando as médias a partir do que é número.
- **A observação fica no nome do professor dono da matéria** (ou da turma, sem matéria), mesmo quando o admin
  escreve. No banco não existe regra de "uma por aluno", e por isso o backend procura antes de gravar.
- Mesmo padrão de rotas da planilha de **Notas** (Fase 4), para a tela e para quem mantém o código.

## Como foi conferido

Foi criada a conferência `npm run test:diario`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas, alunos e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Atividades (criar, padrões, conceito com peso, dados errados, turma/matéria de outro, listar, quem vê, editar, quem pode, reordenar) | 17 de 17 ✅ |
| Lançamentos (várias de uma vez, texto como digitado, corrigir sem duplicar, vazio apaga, "fez", dados errados, aluno de outra turma, tudo ou nada, quem pode, listar) | 16 de 16 ✅ |
| Observação do aluno (escrever, corrigir sem duplicar, quem vê e quem escreve, aluno de outra turma, vazia apaga) | 8 de 8 ✅ |
| Excluir atividade (quem pode, lançamentos saem junto) | 3 de 3 ✅ |
| **Total da nova conferência** | **44 de 44 ✅** |

Também foram repetidas:

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

- **Collection do Bruno:** a pasta nova *Diario* rodou inteira contra a API, com um professor temporário (depois de
  criar turma, matéria e aluno): 5 de 5 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Nova pasta **Diario**:

| Pedido | O que faz |
|---|---|
| **Criar atividade** | Cria a coluna "Caderno" na turma de `turmaId`; guarda o id em `atividadeId` |
| **Listar atividades** | As colunas da turma no 1º bimestre |
| **Lancar no diario** | Lança "8,5" para o aluno de `alunoId` |
| **Salvar observacao** | Escreve a observação do aluno |
| **Excluir atividade** | Exclui a coluna (e os lançamentos) |

> **Dica:** rode antes *Turmas > Criar turma*, *Materias > Criar materia* e *Alunos > Cadastrar aluno*.

## O que ainda NÃO existe

- Agenda, eventos, ocorrências, PDI, tutoria e replicabilidade (Partes 2 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 2)

**Agenda do professor**: as aulas fixas de cada semana (dia, horário da grade, turma e matéria) e as exceções de
um dia (troca, falta, reposição).
