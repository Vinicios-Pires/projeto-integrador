# Execução 16 — Fase 4, Parte 4: correção de provas

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
3. ✅ Provas e gabaritos ([execução 15](15-fase4-parte3-provas-e-gabaritos.md))
4. ✅ **Correção de provas** (as respostas de cada aluno, acertos e nota) ← esta execução
5. ⏳ **Planejamento bimestral**, com a validação pela gestão
6. ⏳ **Planos de aula**: cadastrar, duplicar, ajustes
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

---

## O que foi feito

É a segunda metade da tela **"Correção de Provas"**. O professor lança as respostas da folha de cada aluno,
digitando ou escaneando, e **o backend confere com o gabarito e calcula os acertos e a nota**.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver as folhas corrigidas** | dono e gestão | Em ordem de chamada, com o nome do aluno, as respostas, os acertos e a nota. |
| **Lançar as respostas** | dono e admin | De um aluno (escaneamento) ou de vários de uma vez. Lançar de novo corrige a mesma folha. |
| **Dar a nota à mão** | dono e admin | Por exemplo, depois de uma recuperação. A nota fica marcada como ajuste manual. Mandar a nota vazia volta ao cálculo automático. |
| **Apagar a folha de um aluno** | dono e admin | Por exemplo, se a folha foi lançada no aluno errado. |

### A conta da nota

É **a mesma conta que a tela faz hoje**:

- cada resposta igual ao gabarito é um acerto;
- **questão anulada conta como acerto para todos**;
- nota = acertos ÷ número de questões × valor da prova. Por exemplo, numa prova de 4 questões valendo 10,
  3 acertos dão 7,5.

### As notas acompanham a prova

Se o professor **corrige o gabarito, anula uma questão, muda o valor da prova ou o número de questões**
depois de corrigir, **o backend recalcula as notas** de todas as folhas na hora. A exceção são as notas
dadas à mão: essas o backend não toca.

Hoje, na tela, a nota guardada no banco ficava desatualizada nesses casos; agora ela sempre bate com o
gabarito.

### Proteções

- **Um professor não vê nem lança nas provas de outro.** A gestão vê, mas não lança.
- **O aluno precisa ser da turma da prova** (ou participante, se for eletiva).
- **Só as questões que a prova tem** e só as alternativas A a E. Questão em branco fica sem resposta.
- **A nota à mão vai de 0 até o valor da prova.**
- A prova precisa ter **turma** e **gabarito** antes de receber respostas; a mensagem diz o que falta.
- **Tudo ou nada:** se um aluno da lista estiver errado, nenhuma folha muda.

## Decisões tomadas nesta parte

- **O backend calcula a nota, e não a tela.** Assim a nota guardada é sempre a do gabarito atual, e não dá
  para gravar por engano (ou de propósito) uma nota que não bate com as respostas. A tela continua podendo
  mostrar a conta antes de salvar.
- **A nota dada à mão é um ajuste separado**: os acertos continuam calculados, e o ajuste não muda quando o
  gabarito muda. Para desfazer, basta mandar a nota vazia.
- **O peso de cada questão não entra na conta**, porque a tela não o usa. Se a escola quiser questões com peso
  diferente, a mudança é pequena.

## Como foi conferido

Foi criada a conferência `npm run test:correcao`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas (inclusive uma eletiva), alunos e provas, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Lançar respostas (correção automática, nota como número, em branco, corrigir sem duplicar, nota à mão, dados errados, aluno de outra turma, eletiva, prova sem turma ou sem gabarito, tudo ou nada, quem pode) | 24 de 24 ✅ |
| Ver as folhas (ordem de chamada, quem vê) | 3 de 3 ✅ |
| Recalcular (anular questão, nota à mão não muda, mudar o valor, corrigir o gabarito, voltar ao automático) | 5 de 5 ✅ |
| Apagar uma folha (quem pode, as outras ficam) | 5 de 5 ✅ |
| **Total da nova conferência** | **37 de 37 ✅** |

As conferências anteriores foram repetidas junto com as da Parte 5 (ver a
[execução 17](17-fase4-parte5-planejamento-bimestral.md)): todas passaram.

**Collection do Bruno:** a pasta *Provas* rodou inteira contra a API, já com os pedidos novos, com um professor
temporário (depois de criar turma, matéria e aluno): 9 de 9 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

A pasta **Provas** ganhou:

| Pedido | O que faz |
|---|---|
| **Lancar respostas** | Lança as 5 respostas do aluno de `alunoId`; o backend devolve acertos e nota |
| **Listar resultados** | Mostra as folhas corrigidas da prova |
| **Apagar resultado** | Apaga a folha do aluno de `alunoId` |

*Excluir prova* passou para o fim da pasta, para a pasta rodar inteira em ordem.

> **Dica:** rode antes *Turmas > Criar turma*, *Materias > Criar materia* e *Alunos > Cadastrar aluno*.

## O que ainda NÃO existe

- Planejamento e planos de aula (Partes 5 a 7).
- Nenhuma tela foi alterada. **Quando a tela de correção for ligada ao backend (Fase 6)**, ela passa a mandar só
  as respostas; os acertos e a nota vêm na resposta.

## Pendências que dependem da equipe

- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 5)

**Planejamento bimestral**: a planilha de aulas do bimestre, com o envio para validação e a validação pela
gestão.
