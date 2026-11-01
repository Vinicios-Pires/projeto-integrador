# Execução 08 — Fase 2, Parte 3: matérias e em quais turmas elas aparecem

**Data:** 31/10/2026
**Fase:** 2 — Turmas, alunos e disciplinas
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| **2** | **Turmas, alunos, disciplinas** | 🔄 **em andamento** |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 2

1. ✅ Turmas: cadastrar, listar, ver, editar e excluir ([execução 06](06-fase2-parte1-turmas.md))
2. ✅ Alunos: cadastro compartilhado da escola e importação da planilha ([execução 07](07-fase2-parte2-alunos.md))
3. ✅ **Matérias (disciplinas)** de cada professor e em quais turmas cada uma aparece ← esta execução
4. ⏳ **Turmas personalizadas (eletivas)**: escolher os alunos que participam e exportar a lista
5. ⏳ **Ano letivo e grade de horários** (todos leem, só o admin altera) e resumo da fase

---

## O que foi feito

É a parte do backend da tela **"Matérias"**. Cada professor cria as **próprias matérias** (nome e cor, usada em
planos, notas, painel e relatórios) e escolhe **em quais das suas turmas cada matéria aparece**. Esses
vínculos são usados por várias outras telas: Notas (quais matérias uma turma tem), Ocorrências, Prova Paulista…

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Listar matérias** | todo usuário logado | O **professor vê só as dele**. A **gestão e o admin veem as de todos**. Em ordem de nome. |
| **Ver uma matéria** | dono e gestão | |
| **Criar matéria** | todo usuário logado | Só o nome é obrigatório. Sem cor escolhida, fica azul. |
| **Editar matéria** | dono e admin | Muda só o que foi enviado, inclusive **inativar** (a tela marca isso com uma "cor" especial, e o backend aceita do mesmo jeito). |
| **Excluir matéria** | dono e admin | Os vínculos com turmas saem junto (ver abaixo o que acontece com planos e notas). |
| **Escolher as turmas da matéria** | dono e admin | A pessoa marca as turmas, e a lista nova **substitui a anterior de uma vez**. Desmarcar tudo tira a matéria de todas as turmas. |
| **Listar os vínculos** | todo usuário logado | Cada vínculo vem com o nome da turma e o nome e a cor da matéria. Dá para filtrar por turma, por matéria ou por professor. O professor vê os dele; a gestão, os de todos. |

É a mesma regra das turmas (o *padrão A*): **cada professor mexe só no que é seu, a gestão vê tudo e o admin
pode tudo**. Desta vez ela já estava pronta num lugar central (criado na execução 06) e só foi reaproveitada,
inclusive a conferência "não pode nem ver → não encontrada; pode ver mas não alterar → sem permissão", que
agora as turmas também usam.

### Proteções

- **Um professor não enxerga nem mexe nas matérias e vínculos de outro.** Matéria de colega responde "Matéria
  não encontrada".
- **A gestão vê, mas não altera** matérias e vínculos de professor.
- **Só dá para ligar a matéria a turmas que a pessoa enxerga.** O professor só consegue escolher as próprias
  turmas; não dá para "pendurar" uma matéria na turma de um colega.
- **Escolher as turmas é uma operação só.** Hoje a tela faz duas etapas (incluir as novas, tirar as
  desmarcadas); se a segunda falhasse, ficava pela metade. Agora ou tudo muda, ou nada.
- Turma marcada duas vezes, ou salvar a mesma lista de novo, não cria vínculos repetidos.
- Cor fora da paleta da tela, nome vazio ou número inválido voltam com mensagem clara, e nada é gravado.

## Decisões tomadas nesta parte

- **Excluir matéria continua livre para o dono.** Diferente da turma (que apagaria alunos e notas), excluir uma
  matéria **não apaga planos de aula, notas, provas, diário nem agenda**: eles continuam existindo, só ficam sem
  matéria (é a regra do banco desde o sistema atual). Saem junto apenas os vínculos com turmas e as médias
  arredondadas da matéria, que são um resultado calculado. Para "aposentar" uma matéria sem perder nada, a tela
  já tem o **inativar**.
- **Quando o admin escolhe as turmas da matéria de um professor, os vínculos ficam no nome do professor**, dono
  da matéria. Assim o professor continua enxergando a matéria nas turmas, como se ele mesmo tivesse marcado.
- **O admin também altera matérias e vínculos de qualquer professor.** No Supabase, a regra final dessas duas
  tabelas não dava esse poder ao admin, mas o planejamento (PRD) define que o admin pode tudo, e é assim que o
  backend já faz nas turmas.
- **Os nomes vêm prontos com os vínculos.** Hoje cada tela pede os vínculos com nomes de formatos diferentes;
  agora todos vêm do mesmo jeito (`turmas` e `disciplinas`). As telas se ajustam na Fase 6.

## Como foi conferido

Foi criada a conferência `npm run test:disciplinas`, no mesmo estilo das anteriores. Ela cria 4 usuários de
teste (admin, coordenação e dois professores), turmas e matérias, testa pela API ligada ao banco real e apaga
tudo no final, sem tocar no admin.

| Conferência | Resultado |
|---|---|
| Criar (dono, cor padrão, dados errados, sem login) | 12 de 12 ✅ |
| Listar e ver (cada professor só as suas, gestão vê todas) | 9 de 9 ✅ |
| Editar (só o enviado, inativar, dono não muda, gestão não altera, admin altera) | 10 de 10 ✅ |
| Vínculos com turmas (substituir a lista, sem repetir, turmas de outro professor recusadas, gestão só vê, admin no nome do dono, excluir turma leva o vínculo) | 22 de 22 ✅ |
| Excluir (quem pode, vínculos saem, turma fica) | 8 de 8 ✅ |
| **Total da nova conferência** | **61 de 61 ✅** |

Também foram repetidas:

- **Conferência dos alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Conferência das turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Materias* rodou inteira contra a API, com um professor temporário (depois de *Turmas > Criar turma*): 8 de 8 ✅. O professor, a turma e a matéria foram apagados em seguida.

## Collection do Bruno

Ganhou a pasta **Materias**:

| Pedido | O que faz |
|---|---|
| **Criar matéria** | Cria uma matéria e guarda o id dela em `disciplinaId` |
| **Listar matérias** | Lista as matérias que o usuário logado pode ver |
| **Ver matéria** | Mostra a matéria de `disciplinaId` |
| **Editar matéria** | Troca a cor da matéria de `disciplinaId` |
| **Escolher turmas** | Coloca a matéria de `disciplinaId` na turma de `turmaId` |
| **Listar vínculos** | Lista em quais turmas a matéria de `disciplinaId` aparece |
| **Excluir matéria** | Exclui a matéria de `disciplinaId` |

> **Dica:** rode *Turmas > Criar turma* antes, para ter uma `turmaId` para o *Escolher turmas*.

## O que ainda NÃO existe

- **Vincular alunos às eletivas** (Parte 4).
- **Ano letivo e grade de horários** (Parte 5).
- Planos, notas e provas, que usam as matérias (Fase 4).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 4)

**Turmas personalizadas (eletivas).** A eletiva já pode ser cadastrada (Parte 1); falta **escolher os alunos que
participam** dela (que vêm de várias turmas normais) e **exportar a lista**. É o *padrão A* de novo: cada
professor monta as próprias eletivas, e a gestão vê.
