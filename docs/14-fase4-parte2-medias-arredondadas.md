# Execução 14 — Fase 4, Parte 2: médias arredondadas

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
2. ✅ **Médias arredondadas** (a nota final que o professor ajusta à mão) ← esta execução
3. ⏳ **Provas e gabaritos** (a prova, as questões e as respostas certas)
4. ⏳ **Correção de provas** (as respostas de cada aluno, acertos e nota)
5. ⏳ **Planejamento bimestral**, com a validação pela gestão
6. ⏳ **Planos de aula**: cadastrar, duplicar, ajustes
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

---

## O que foi feito

Na planilha de **Notas**, a tela calcula a média de cada aluno e mostra a **nota arredondada** (por exemplo, 6,8
vira 7). O professor pode **mudar essa nota à mão**. Agora o backend guarda esses ajustes.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver os ajustes** de uma planilha (turma, matéria e bimestre) | dono e gestão | Só dos alunos pedidos, se a tela quiser. |
| **Ajustar a média** de um ou vários alunos | dono e admin | De 0 a 10. Corrigir de novo atualiza o mesmo ajuste. |
| **Apagar um ajuste** (a célula volta ao automático) | dono e admin | É só mandar o aluno com a média vazia. |
| **"Descartar todas"** | dono e admin | Todos os alunos da planilha voltam ao cálculo automático, de uma vez. Também dá para descartar só alguns. |

**As notas não mudam** em nenhum desses casos: o ajuste é só da nota final mostrada.

### Proteções

- **Um professor não vê nem mexe nos ajustes de outro.** A gestão vê, mas não altera.
- **Só nas próprias turmas e matérias.**
- **O aluno precisa ser da turma** (ou participante, se for eletiva).
- **Cada aluno tem um ajuste por matéria e bimestre:** o do 1º bimestre não interfere no do 2º.
- **Tudo ou nada:** se um aluno da lista estiver errado, nenhum ajuste entra, e a mensagem diz qual foi.
- "Descartar todas" mexe **só na planilha aberta**; os ajustes de outros bimestres e turmas ficam.

## Decisões tomadas nesta parte

- **O ajuste fica no nome do professor dono da matéria**, mesmo quando o admin altera, igual às notas. Hoje a
  tela grava no nome de quem está logado; com isso, um ajuste feito pelo admin continua aparecendo para o professor.
- **A planilha (turma, matéria e bimestre) vai uma vez só no pedido**, e não em cada aluno: a tela sempre ajusta
  alunos da planilha aberta, e assim não dá para misturar planilhas sem querer.
- **"Descartar todas" ficou uma rota própria**, para o botão da tela não precisar mandar a lista de alunos.
- A média sai **como número** (7.5), igual ao Supabase.

## Como foi conferido

Foi criada a conferência `npm run test:medias`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas (inclusive uma eletiva), alunos e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Ajustar (vários de uma vez, como número, no nome do professor, corrigir sem duplicar, apagar, bimestres separados, dados errados, aluno de outra turma, eletiva, tudo ou nada, quem pode) | 24 de 24 ✅ |
| Ver (da planilha, de alguns alunos, de um aluno, quem vê, filtros errados) | 8 de 8 ✅ |
| Descartar (quem pode, um aluno, a planilha inteira, os outros ficam, descartar de novo) | 7 de 7 ✅ |
| **Total da nova conferência** | **39 de 39 ✅** |

Também foram repetidas:

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
- **Collection do Bruno:** os 3 pedidos novos rodaram contra a API, com um professor temporário (depois de criar
  turma, matéria e aluno): 6 de 6 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

A pasta **Notas** ganhou:

| Pedido | O que faz |
|---|---|
| **Ajustar medias** | Ajusta para 7 a média do aluno de `alunoId` na planilha de `turmaId` e `disciplinaId`, 1º bimestre |
| **Listar medias** | Lista os ajustes dessa planilha |
| **Descartar medias** | "Descartar todas": a planilha volta ao cálculo automático |

> **Dica:** rode antes *Turmas > Criar turma*, *Materias > Criar materia* e *Alunos > Cadastrar aluno*.

## O que ainda NÃO existe

- Provas, correção, planejamento e planos de aula (Partes 3 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Região do banco: resolvida.** O Neon fica em **N. Virginia (EUA)**. Isso explica a lentidão das conferências
  daqui do Brasil; no ar, o servidor do Render deve ficar na mesma região, para ficar rápido (ver Fase 6).
- **Supabase (chave e endereço): deixado para depois**, como combinado. O backend continua guardando os arquivos
  numa pasta local até lá.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 3)

**Provas e gabaritos**: cadastrar uma prova (turma, matéria, bimestre, quantas questões), com as questões e a
resposta certa de cada uma.
