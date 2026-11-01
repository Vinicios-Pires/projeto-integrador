# Execução 15 — Fase 4, Parte 3: provas e gabaritos

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
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (o teste com o Supabase real fica para depois) |
| **4** | **Notas/Provas e Planos de Aula** | 🔄 **em andamento** |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 4

1. ✅ Avaliações e notas ([execução 13](13-fase4-parte1-avaliacoes-e-notas.md))
2. ✅ Médias arredondadas ([execução 14](14-fase4-parte2-medias-arredondadas.md))
3. ✅ **Provas e gabaritos** (a prova, as questões e as respostas certas) ← esta execução
4. ⏳ **Correção de provas** (as respostas de cada aluno, acertos e nota)
5. ⏳ **Planejamento bimestral**, com a validação pela gestão
6. ⏳ **Planos de aula**: cadastrar, duplicar, ajustes
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

---

## O que foi feito

É a primeira metade da tela **"Correção de Provas"**: as provas de múltipla escolha, com a folha de respostas
que o aluno preenche e o **gabarito** (a resposta certa de cada questão).

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver as provas** | dono e gestão | As mais novas primeiro, com o nome da turma e da matéria. Dá para filtrar por turma, matéria e bimestre. |
| **Criar prova** | todo usuário logado | Só o título é obrigatório. Turma e matéria são opcionais (como na tela) e precisam ser suas. Padrões: 10 questões, valor 10, 1º bimestre. |
| **Editar prova** | dono e admin | Muda só o que for enviado. |
| **Excluir prova** | dono e admin | O gabarito e as respostas dos alunos saem junto. |
| **Ver o gabarito** | dono e gestão | Em ordem de questão. |
| **Salvar o gabarito** | dono e admin | Todas as questões de uma vez, cada uma com a alternativa certa (A a E). Dá para **anular** uma questão: ela conta como acerto para todos. |

### Proteções

- **Um professor não vê nem mexe nas provas de outro.** A gestão vê, mas não altera.
- **O gabarito só aceita as questões que a prova tem** (de 1 até o número de questões) e as alternativas A a E.
- **Salvar o gabarito de novo corrige**; nunca fica uma questão repetida. A questão que não vier na lista sai.
- **Com menos questões**, o gabarito das questões que sobraram sai junto.
- **Se a prova já tem respostas de alunos, a turma dela não muda**: as respostas são de alunos daquela turma.
  Antes disso, dá para escolher a turma depois de criar.
- Gabarito com erro não muda nada: ou entra inteiro, ou fica o anterior.

## Decisões tomadas nesta parte

- **Até 100 questões.** A tela permite 60; o backend deixa uma folga para não travar se a tela mudar.
- **O gabarito vai inteiro**, como a tela já faz (ela salva todas as questões juntas). Assim o backend nunca
  fica com metade de um gabarito antigo.
- **O peso de cada questão é guardado** (o padrão é 1), mas a tela hoje não o usa no cálculo da nota. A conta
  continua sendo a da tela (Parte 4).
- `valor_total` e `peso` saem **como número**; a data de aplicação, como `AAAA-MM-DD`, igual ao Supabase.

## Como foi conferido

Foi criada a conferência `npm run test:provas`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Provas (criar, padrões, número e data no formato certo, dados errados, turma/matéria de outro, listar, filtrar, abrir, editar, quem pode) | 27 de 27 ✅ |
| Gabarito (salvar, anular, peso, corrigir sem duplicar, questão que não veio sai, dados errados, tudo ou nada, quem vê e quem altera, menos questões, turma travada com respostas) | 18 de 18 ✅ |
| Excluir prova (quem pode, gabarito e respostas saem junto) | 5 de 5 ✅ |
| **Total da nova conferência** | **50 de 50 ✅** |

Também foram repetidas:

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
- **Collection do Bruno:** a pasta nova *Provas* rodou inteira contra a API, com um professor temporário (depois
  de criar turma e matéria): 6 de 6 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Nova pasta **Provas**:

| Pedido | O que faz |
|---|---|
| **Criar prova** | Cria uma prova de 5 questões na turma de `turmaId` e matéria de `disciplinaId`; guarda o id em `provaId` |
| **Listar provas** | Lista as provas |
| **Editar prova** | Muda título e valor |
| **Salvar gabarito** | Salva as 5 respostas certas (a 3ª anulada) |
| **Ver gabarito** | Mostra o gabarito |
| **Excluir prova** | Exclui a prova (e o gabarito) |

> **Dica:** rode antes *Turmas > Criar turma* e *Materias > Criar materia*.

## O que ainda NÃO existe

- **A correção** (Parte 4): lançar as respostas de cada aluno e calcular acertos e nota.
- Planejamento e planos de aula (Partes 5 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 4)

**Correção de provas**: o professor lança (ou escaneia) as respostas de cada aluno, e o backend confere com o
gabarito e calcula os acertos e a nota.
