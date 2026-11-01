# Execução 13 — Fase 4, Parte 1: avaliações e notas

**Data:** 31/10/2026
**Fase:** 4 — Notas/Provas e Planos de Aula
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (falta o teste com a chave real) |
| **4** | **Notas/Provas e Planos de Aula** | 🔄 **em andamento** |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 4

1. ✅ **Avaliações e notas**: as colunas da planilha de notas e o lançamento das notas ← esta execução
2. ⏳ **Médias arredondadas** (a nota final que o professor ajusta à mão)
3. ⏳ **Provas e gabaritos** (a prova, as questões e as respostas certas)
4. ⏳ **Correção de provas** (as respostas de cada aluno, acertos e nota)
5. ⏳ **Planejamento bimestral**, com a validação pela gestão
6. ⏳ **Planos de aula**: cadastrar, duplicar, ajustes
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

A ordem segue a tela de Notas primeiro (a mais usada), depois as provas (que geram notas) e por fim o
planejamento e os planos de aula, que têm o fluxo de aprovação pela gestão.

---

## O que foi feito

É a parte do backend da tela **"Notas"**: a planilha em que cada coluna é uma avaliação (prova, trabalho, Prova
Paulista…) e cada linha é um aluno.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver as avaliações** de uma turma, matéria e bimestre | dono e gestão | Na ordem das colunas. |
| **Criar avaliação** | todo usuário logado, nas próprias turmas e matérias | Nome, peso (ex.: 2, 0,5) e se é da Prova Paulista. Vai para o fim da planilha. |
| **Editar avaliação** | dono e admin | Nome, peso, categoria, bimestre… Mudar o bimestre leva junto o bimestre das notas. |
| **Reordenar as colunas** | dono e admin | Numa operação só. Hoje a tela salva coluna por coluna. |
| **Excluir avaliação** | dono e admin | As notas dela saem junto (a tela já avisa isso). |
| **Lançar notas** | dono e admin | Uma ou várias de uma vez (até 2000), de 0 a 10. Apagar a célula apaga a nota. |
| **Ver as notas** | dono e gestão | Por aluno, por avaliação, por turma, matéria e bimestre. Cada nota vem com a avaliação (nome e peso), que é o que os relatórios usam. |

A **média final** continua sendo calculada pela própria tela, como hoje: o backend guarda as notas e os pesos.

### Proteções

- **Um professor não vê nem lança notas nas avaliações de outro.** A gestão vê tudo, mas não lança.
- **Só dá para criar avaliação nas próprias turmas e matérias.**
- **O aluno precisa ser da turma da avaliação** (ou participante, se for eletiva). Isso evita, por exemplo,
  lançar por engano a nota de um aluno de outra turma.
- **Nota só de 0 a 10.** Peso maior que zero.
- **Lançar várias notas é tudo ou nada:** se uma estiver errada, nenhuma entra, e a mensagem diz qual foi.
- Corrigir uma célula **atualiza** a nota; nunca cria uma segunda nota para o mesmo aluno na mesma avaliação.
- **A turma e a matéria de uma avaliação não mudam** depois de criada. As notas lançadas são de alunos daquela
  turma, e trocar deixaria as notas soltas. Para outra turma, cria-se outra avaliação.

## Decisões tomadas nesta parte

- **Notas e pesos saem como número** (8.5), e não como texto ("8.5"), igual ao que o Supabase devolve hoje.
  Sem isso, as contas da tela quebrariam.
- **O bimestre e o dono da nota vêm da avaliação**, e não da tela. Assim uma nota nunca fica num bimestre
  diferente da sua avaliação, e, quando o admin lança, a nota continua no nome do professor.
- **Uma única rota para lançar notas**, que recebe uma lista: serve tanto para uma célula quanto para colar uma
  coluna inteira.

## Como foi conferido

Foi criada a conferência `npm run test:notas`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas (inclusive uma eletiva), alunos e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Avaliações (criar, peso como número, dados errados, turma/matéria de outro recusadas, listar, editar, quem pode, reordenar) | 25 de 25 ✅ |
| Lançar notas (várias de uma vez, corrigir sem duplicar, apagar, limites, aluno de outra turma, eletiva, tudo ou nada, quem pode) | 19 de 19 ✅ |
| Ver notas (por avaliação, aluno, turma/matéria/bimestre, quem vê; bimestre acompanha a avaliação) | 9 de 9 ✅ |
| Excluir avaliação (quem pode, notas saem junto, as outras ficam) | 5 de 5 ✅ |
| **Total da nova conferência** | **58 de 58 ✅** |

Também foram repetidas:

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
- **Collection do Bruno:** a pasta nova *Notas* rodou inteira contra a API, com um professor temporário (depois de criar turma, matéria e aluno): 10 de 10 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Ganhou a pasta **Notas**:

| Pedido | O que faz |
|---|---|
| **Criar avaliacao** | Cria uma avaliação na turma de `turmaId` e matéria de `disciplinaId`; guarda o id em `tipoAvaliacaoId` |
| **Listar avaliacoes** | Lista as avaliações daquela turma, matéria e bimestre |
| **Editar avaliacao** | Muda nome e peso |
| **Reordenar avaliacoes** | Salva a ordem das colunas |
| **Lancar notas** | Lança a nota do aluno de `alunoId` |
| **Listar notas** | Lista as notas da avaliação |
| **Excluir avaliacao** | Exclui a avaliação (e as notas dela) |

> **Dica:** rode antes *Turmas > Criar turma*, *Materias > Criar materia* e *Alunos > Cadastrar aluno*.

## O que ainda NÃO existe

- **Médias arredondadas** (Parte 2): por enquanto, a nota final ajustada à mão ainda não é guardada pelo backend.
- Provas, correção, planejamento e planos de aula (Partes 3 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Chave de serviço e endereço do Supabase**, para o teste real dos arquivos (Fase 3).
- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 2)

**Médias arredondadas**: quando o professor ajusta à mão a nota final de um aluno (por exemplo, 6,8 vira 7), o
backend guarda esse ajuste, e dá para desfazer um ou todos de uma vez, voltando ao cálculo automático.
