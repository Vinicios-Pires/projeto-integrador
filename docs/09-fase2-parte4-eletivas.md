# Execução 09 — Fase 2, Parte 4: turmas personalizadas (eletivas)

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
3. ✅ Matérias e em quais turmas cada uma aparece ([execução 08](08-fase2-parte3-materias.md))
4. ✅ **Turmas personalizadas (eletivas)**: escolher os alunos que participam ← esta execução
5. ⏳ **Ano letivo e grade de horários** (todos leem, só o admin altera) e resumo da fase

---

## O que foi feito

Uma **eletiva** (turma personalizada) junta alunos de **várias turmas normais**: por exemplo, a "Eletiva de
Robótica" pode ter alunos do 1º A, do 2º B e do 3º C. O aluno **continua na turma dele**; a eletiva só guarda
quem participa. A eletiva em si já podia ser cadastrada desde a Parte 1. Agora dá para **escolher os
participantes**.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Escolher os participantes** | dono da eletiva e admin | A pessoa marca os alunos (de qualquer turma), e a lista nova **substitui a anterior de uma vez**. Desmarcar todos esvazia a eletiva. |
| **Ver os participantes** | dono e gestão | Em ordem de nome, cada um com a **turma de origem** (nome e série). Dá para ver só os ativos, que é o que a tela de notas usa. |

A tela "Turmas" usa essa mesma lista para **exportar a planilha da eletiva** (número, nome, turma de origem,
série). O arquivo continua sendo montado pela tela, com os dados que agora vêm prontos do backend.

### Proteções

- **Um professor não vê nem mexe na eletiva de outro** ("Turma não encontrada").
- **A gestão vê os participantes, mas não altera.**
- **Só eletivas têm participantes escolhidos.** Tentar fazer isso numa turma normal volta com um aviso claro.
- **Escolher os participantes é uma operação só.** Hoje a tela faz duas etapas (tirar os desmarcados, incluir os
  novos); se a segunda falhasse, a eletiva ficava pela metade. Agora ou tudo muda, ou nada.
- Aluno inexistente na lista volta com aviso e nada muda. Aluno marcado duas vezes não é duplicado.
- **Se um aluno for excluído (pela gestão), ele sai da eletiva sozinho.** E excluir a eletiva **não apaga
  ninguém**: os alunos continuam nas turmas deles.

## Decisões tomadas nesta parte

- **Os participantes ficam registrados no nome do dono da eletiva**, mesmo quando o admin é quem altera. Assim o
  professor continua enxergando a eletiva completa (igual ao que foi feito com as matérias).
- **Qualquer aluno da escola pode entrar numa eletiva**, inclusive alunos de turmas de outros professores. É o
  sentido da eletiva, e os alunos já são um cadastro compartilhado (Parte 2).
- **Não foi criada uma rota separada de "exportar"**: a tela já monta o arquivo a partir da lista de
  participantes, que traz tudo o que a planilha precisa.
- **Não foi criada uma lista geral de "todos os participantes de todas as eletivas"**. A tela de notas usa isso
  hoje só para descobrir as eletivas do professor, e essa informação já vem na lista de turmas (Parte 1), com o
  tipo de cada uma.

## Como foi conferido

Foi criada a conferência `npm run test:membros`, no mesmo estilo das anteriores. Ela cria 4 usuários de teste
(admin, coordenação e dois professores), turmas normais com alunos e duas eletivas, testa pela API ligada ao
banco real e apaga tudo no final, sem tocar no admin.

| Conferência | Resultado |
|---|---|
| Montar a eletiva (alunos de várias turmas, substituir a lista, sem repetir, dados errados, turma normal recusada, quem pode) | 19 de 19 ✅ |
| Ver os participantes (ativos/inativos, quem pode ver) | 9 de 9 ✅ |
| O que acontece em volta (aluno excluído sai, excluir a eletiva não apaga alunos) | 4 de 4 ✅ |
| **Total da nova conferência** | **32 de 32 ✅** |

Também foram repetidas:

- **Conferência das matérias** (`npm run test:disciplinas`): 61 de 61 ✅
- **Conferência dos alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Conferência das turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Eletivas* rodou inteira contra a API, com um professor temporário (depois de *Criar turma* e *Cadastrar aluno*): 5 de 5 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Ganhou a pasta **Eletivas**:

| Pedido | O que faz |
|---|---|
| **Criar eletiva** | Cria uma turma personalizada e guarda o id em `turmaId` |
| **Escolher membros** | Coloca o aluno de `alunoId` na eletiva de `turmaId` |
| **Listar membros** | Lista os participantes ativos da eletiva de `turmaId` |

> **Dica:** rode antes *Turmas > Criar turma* e *Alunos > Cadastrar aluno* (para ter um `alunoId` numa turma
> normal), e só então a pasta *Eletivas*.

## O que ainda NÃO existe

- **Ano letivo e grade de horários** (Parte 5).
- Notas dos alunos das eletivas (Fase 4).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 5)

**Ano letivo e grade de horários**, os últimos cadastros de apoio da fase. São informações da escola inteira:
**todos leem, só o admin altera** (o *padrão C*). Depois disso, o **resumo da Fase 2**.
