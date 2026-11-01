# Execução 06 — Fase 2, Parte 1: turmas

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

1. ✅ **Turmas**: cadastrar, listar, ver, editar e excluir ← esta execução
2. ⏳ **Alunos**: cadastro compartilhado da escola (todos leem e escrevem, só a gestão exclui) e importação
   da planilha de alunos
3. ⏳ **Matérias (disciplinas)** de cada professor e em quais turmas cada uma aparece
4. ⏳ **Turmas personalizadas (eletivas)**: escolher os alunos que participam e exportar a lista
5. ⏳ **Ano letivo e grade de horários** (todos leem, só o admin altera) e resumo da fase

A ordem segue a dependência: quase tudo precisa de turma; alunos vivem dentro de turmas; matérias e eletivas
ligam as duas coisas.

---

## O que foi feito

É a parte do backend da tela **"Turmas"**. Ela devolve as mesmas informações que a tela já usa hoje,
inclusive **quantos alunos** cada turma tem e, nas eletivas, **quantos alunos foram vinculados**.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Listar turmas** | todo usuário logado | O **professor vê só as turmas dele**. A **gestão e o admin veem as de todos**. Em ordem de nome. |
| **Ver uma turma** | dono e gestão | Mesmas informações da lista. |
| **Cadastrar turma** | todo usuário logado | Nome e série são obrigatórios. Turno, ano letivo, vagas e observações são opcionais (padrão: manhã, ano atual, 35 vagas). Serve para turmas normais e para eletivas. |
| **Editar turma** | dono e admin | Muda só o que foi enviado. |
| **Excluir turma** | dono e admin | **Os alunos da turma são apagados junto** (ver "Atenção" abaixo). |

É a primeira vez que o backend aplica a regra **"cada professor mexe só no que é seu, a gestão vê tudo e o
admin pode tudo"** (o *padrão A* do planejamento). Ela ficou escrita uma vez só, num lugar central, para as
próximas partes (matérias, notas, planos de aula…) usarem a mesma regra sem reescrever.

### Proteções

- **Um professor não enxerga as turmas de outro.** Se tentar abrir, editar ou excluir, recebe "Turma não
  encontrada", como se ela não existisse. Assim nem dá para descobrir quais turmas os colegas têm.
- **A gestão vê, mas não altera** turma de professor: recebe "sem permissão".
- **O dono é sempre quem cadastrou.** Mesmo que alguém mande outro dono junto com os dados, o backend ignora.
  E não dá para "passar" a turma para outra pessoa editando.
- **Dados conferidos antes de gravar:** nome e série não podem ficar vazios, o turno tem que ser um dos quatro
  da tela (Manhã, Tarde, Noturno, Integral), vagas e ano têm que ser números inteiros. Dado errado volta com uma
  mensagem clara e nada é gravado.
- Turma inexistente ou endereço malformado recebe "Turma não encontrada", nunca um erro interno.

### Atenção: excluir turma apaga os alunos dela

> **Atualização (execução 07):** a equipe decidiu **impedir a exclusão de turma que ainda tem alunos**. Ver
> [execução 07](07-fase2-parte2-alunos.md). O texto abaixo descreve como ficou nesta execução.

Essa é a regra do banco desde o sistema atual (o Supabase já faz assim). Foi mantida para não mudar o
comportamento, mas vale a equipe saber: **excluir uma turma por engano apaga os alunos dela, com as notas e
registros ligados a eles**. Ver "Pendências que dependem da equipe".

## Decisões tomadas nesta parte

- **Quem vê cada turma segue a regra mais recente do sistema atual:** dono e gestão. Numa versão antiga, o
  professor também via as turmas onde dava aula (pelas matérias vinculadas), mas essa regra foi retirada depois
  no Supabase, e o backend segue a versão final.
- **O dono é preenchido pelo backend.** Hoje as telas cadastram turma sem informar o dono, e no Supabase isso
  só funcionava para o admin (para os outros, o banco recusava, e a tela "Turmas" nem mostrava o erro). No backend, o dono é sempre quem
  está logado, então a tela vai passar a funcionar para todos.
- **A gestão também pode cadastrar turmas próprias**, como no sistema atual. Só não altera as dos outros.
- **As contagens vêm prontas.** Hoje a tela faz duas buscas para contar alunos e membros das eletivas; agora
  vem tudo numa resposta só.
- **Pequeno reforço reaproveitável:** a leitura de campos opcionais (textos e números) virou uma ferramenta
  comum, para as próximas telas validarem do mesmo jeito.

## Como foi conferido

Foi criada a conferência `npm run test:turmas`, no mesmo estilo das anteriores. Ela cria 4 usuários de teste
(admin, coordenação e dois professores), cadastra turmas, alunos e uma eletiva, testa pela API ligada ao banco
real e apaga tudo no final, sem tocar no admin.

| Conferência | Resultado |
|---|---|
| Cadastrar (dono, valores padrão, eletiva, quem pode) | 8 de 8 ✅ |
| Dados errados recusados (nome, série, turno, tipo, vagas, ano, observações, sem login) | 11 de 11 ✅ |
| Listar e ver (cada professor só as suas, gestão vê todas, contagens) | 12 de 12 ✅ |
| Editar (só o enviado, dono não muda, gestão não altera, admin altera) | 12 de 12 ✅ |
| Excluir (quem pode, alunos apagados junto) | 9 de 9 ✅ |
| **Total da nova conferência** | **52 de 52 ✅** |

> **Correção (31/10, execução 07):** a primeira versão deste documento dizia "50 de 50". A conta estava
> errada: a conferência tinha 52 checagens, e todas passaram.

Também foram repetidas:

- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅ (com um ajuste, ver abaixo)
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Turmas* rodou inteira contra a API, com um professor temporário: 5 de 5 ✅. Ele e a turma foram apagados em seguida.

> **Ajuste na conferência do banco:** uma das 13 checagens exigia que o admin ainda estivesse com a senha
> temporária do primeiro acesso. Como o admin já trocou a senha (em 29/10), ela passou a falhar, sem nenhum
> problema real. Agora ela aceita as duas situações e só mostra qual é ("já trocou a senha do 1º acesso").
> O admin não foi alterado.

## Collection do Bruno

Ganhou a pasta **Turmas**:

| Pedido | O que faz |
|---|---|
| **Criar turma** | Cadastra uma turma e guarda o id dela na variável `turmaId` |
| **Listar turmas** | Lista as turmas que o usuário logado pode ver |
| **Ver turma** | Mostra a turma de `turmaId` |
| **Editar turma** | Muda turno e vagas da turma de `turmaId` (edite o corpo à vontade) |
| **Excluir turma** | Exclui a turma de `turmaId` (e os alunos dela) |

> **Dica:** rode *Auth > Entrar Professor Comum* e depois os pedidos na ordem. Para ver a regra da gestão em
> ação, entre como admin ou coordenação e rode *Listar turmas*: aparecem as turmas de todos.

## O que ainda NÃO existe

- **Cadastro de alunos** pela API (Parte 2). Por enquanto, as contagens de alunos já funcionam, mas os alunos
  só entram direto no banco.
- **Vincular alunos às eletivas** (Parte 4). A eletiva já pode ser cadastrada e a contagem de membros já vem
  na lista.
- **Matérias** e o vínculo matéria ↔ turma (Parte 3).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- ~~**Nova:** excluir turma apaga os alunos dela (regra herdada do sistema atual). Vale decidir se fica assim ou se
  é melhor **impedir a exclusão de turma com alunos** (a pessoa teria que mover ou excluir os alunos antes). Não
  bloqueia: hoje está igual ao sistema atual, e mudar é simples.~~ **Resolvida:** decidido impedir a exclusão
  (feito na [execução 07](07-fase2-parte2-alunos.md)).
- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 2)

**Alunos.** Diferente das turmas, o cadastro de alunos é **compartilhado pela escola**: qualquer usuário logado
lê e cadastra, mas **só a gestão exclui** (o *padrão C* do planejamento). Também entra a **importação da
planilha de alunos**, que hoje cria as turmas que faltam automaticamente.
