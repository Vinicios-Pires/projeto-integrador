# Execução 07 — Fase 2, Parte 2: alunos

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
2. ✅ **Alunos**: cadastro compartilhado da escola e importação da planilha ← esta execução
3. ⏳ **Matérias (disciplinas)** de cada professor e em quais turmas cada uma aparece
4. ⏳ **Turmas personalizadas (eletivas)**: escolher os alunos que participam e exportar a lista
5. ⏳ **Ano letivo e grade de horários** (todos leem, só o admin altera) e resumo da fase

---

## Decisão da equipe aplicada: turma com alunos não pode ser excluída

Na execução 06 ficou a dúvida: excluir uma turma apagava junto os alunos dela (e as notas deles). **A decisão
foi impedir.** Agora:

- Turma **com alunos não pode ser excluída**, nem pelo admin. A pessoa recebe a mensagem "A turma tem N
  aluno(s). Mova ou exclua os alunos antes de excluir a turma."
- **Alunos inativos também contam.** Eles continuam ligados à turma, com o histórico deles.
- **Eletivas podem ser excluídas** mesmo com alunos vinculados: os alunos de uma eletiva pertencem à turma
  normal deles, então só o vínculo com a eletiva sai. Os alunos continuam existindo.
- Mesmo que alguém cadastre um aluno no exato momento da exclusão, a turma não é apagada: a conferência
  "está vazia?" e a exclusão acontecem juntas.

Para o professor esvaziar uma turma, ele pode **mover os alunos para outra turma** (editando o aluno). Excluir
aluno é só com a gestão (ver abaixo).

## O que foi feito

É a parte do backend da tela **"Alunos"** e das listas de alunos que aparecem em várias outras telas (notas,
diário, correção de provas, tutoria, Prova Paulista…).

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Listar alunos** | todo usuário logado | Dá para filtrar por **uma ou várias turmas** e por **ativos/inativos**, e escolher a ordem: por turma (padrão), por número da chamada ou por nome. Cada aluno vem com o nome e a série da turma, como as telas já usam. |
| **Ver um aluno** | todo usuário logado | Mesmas informações da lista. |
| **Cadastrar aluno** | todo usuário logado | Nome e turma são obrigatórios. Sem série, o aluno fica com a série da turma (como a tela já faz). Também aceita número da chamada, data de nascimento, e-mail, telefone, responsável e observações. |
| **Editar aluno** | todo usuário logado | Muda só o que foi enviado. Dá para **trocar de turma** e **inativar**. |
| **Excluir aluno** | **só gestão e admin** | O professor, em vez de excluir, inativa. Excluir apaga junto as notas e registros do aluno. |
| **Importar planilha** | todo usuário logado | Recebe as linhas da planilha (número, nome, turma). Cria as turmas que faltam e cadastra os alunos de uma vez. |

### Por que aqui "todo mundo mexe" e nas turmas não

É a regra do sistema atual (o *padrão C* do planejamento): **alunos são um cadastro da escola**, não de um
professor. Qualquer professor pode cadastrar ou corrigir um aluno, porque o mesmo aluno aparece para vários
professores. Só **excluir** fica com a gestão, porque apaga o histórico. As turmas, ao contrário, são de cada
professor (execução 06).

### A importação da planilha

Hoje a tela faz tudo sozinha, uma linha por vez, conversando direto com o banco. Agora o backend recebe a lista
inteira e faz o trabalho:

- **Aceita a turma escrita de vários jeitos:** `7°A`, `7A`, `7º A`, `7 a` viram todos `7°A`. E encontra a turma
  mesmo se ela foi cadastrada como `7º A`.
- **Cria as turmas que faltam** no nome de quem está importando (turno manhã, série deduzida: `7º Ano`,
  `1º Ano EM`…) e avisa quais foram criadas.
- **Pula as linhas com problema** e diz quais foram e por quê: nome vazio, turma em formato inválido, aluno
  repetido na planilha ou que já estava cadastrado na turma. As outras linhas entram normalmente.
- **Ou entra tudo, ou nada.** Se der algum problema no meio da gravação, nenhuma turma nem aluno fica pela
  metade. Hoje, se a gravação dos alunos falha, as turmas novas ficam criadas e vazias.
- **Importar a mesma planilha duas vezes não duplica** ninguém.
- Até **2000 linhas** por vez.

### Proteções

- **Não pode haver dois alunos com o mesmo nome na mesma turma** (sem diferenciar maiúsculas). Hoje essa trava
  só existe na tela; agora o backend também confere, inclusive ao trocar alguém de turma ou corrigir o nome.
- **Dados conferidos antes de gravar:** turma que não existe, data de nascimento impossível (ex.: 30/02) ou em
  outro formato, número da chamada negativo… voltam com uma mensagem clara e nada é gravado.
- Envios grandes demais (acima de 1 MB) são recusados com uma mensagem clara, não com um erro interno.
- Aluno inexistente ou endereço malformado recebe "Aluno não encontrado".

## Decisões tomadas nesta parte

- **A turma é obrigatória** para cadastrar aluno. O banco até permitiria um aluno sem turma, mas todas as telas
  exigem, e um aluno solto não apareceria em lugar nenhum.
- **O nome da turma vem sempre junto com o aluno**, para qualquer usuário. No Supabase, quando um professor
  listava alunos de turmas de outro professor, o nome da turma vinha em branco (porque ele não podia ver a
  turma). Nome e série de turma ("7°A", "7º Ano") não são informação sensível, e a tela fica completa.
- **Na importação, cada professor usa as próprias turmas.** Se o professor B importar alunos para "7°A" e só o
  professor A tiver uma turma "7°A", o B ganha a própria "7°A" (é o que acontece hoje no Supabase). Para a
  gestão, que enxerga todas as turmas, vale a turma mais antiga com aquele nome.
- **Série das turmas criadas na importação no padrão da tela "Turmas":** `1º Ano EM` em vez do `1ª Série EM`
  que a tela "Alunos" usa hoje. Assim o filtro por nível de ensino da tela "Turmas" reconhece essas turmas.
- **As linhas com erro são indicadas pela posição na lista** (1ª, 2ª…). A tela soma 1 para mostrar a linha da
  planilha, por causa do cabeçalho.
- **Datas de nascimento** saem no formato `AAAA-MM-DD`, igual ao que o Supabase devolve hoje.

## Como foi conferido

Foi criada a conferência `npm run test:alunos`, no mesmo estilo das anteriores. Ela cria 4 usuários de teste
(admin, coordenação e dois professores), turmas e alunos, testa pela API ligada ao banco real e apaga tudo no
final, sem tocar no admin.

| Conferência | Resultado |
|---|---|
| Cadastrar (série herdada, todos os campos, duplicados, dados errados, sem login) | 16 de 16 ✅ |
| Listar e ver (filtros por turma e situação, as três ordens, todos veem os mesmos alunos) | 15 de 15 ✅ |
| Editar (outro professor edita, inativar, trocar de turma, duplicados, dados errados) | 13 de 13 ✅ |
| Excluir (professor não pode, gestão e admin podem) | 7 de 7 ✅ |
| Importar planilha (turmas criadas, jeitos de escrever a turma, linhas puladas, sem duplicar, limites) | 14 de 14 ✅ |
| **Total da nova conferência** | **65 de 65 ✅** |

A conferência das turmas (`npm run test:turmas`) ganhou as checagens da nova regra de exclusão (turma com
alunos, inclusive inativos, não sai; eletiva sai sem levar os alunos; depois de mover os alunos, sai):
agora com **55 de 55 ✅** (eram 52).

Também foram repetidas:

- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta *Turmas* inteira e todos os pedidos da pasta nova *Alunos* rodaram contra a API, com um professor e uma coordenadora temporários (*Excluir aluno* com a coordenadora): 13 de 13 ✅. A importação reconheceu a turma `7º A` criada antes, em vez de criar outra `7°A`. Os usuários e as turmas foram apagados em seguida.

> **Correção na execução 06:** o documento dela dizia que a conferência das turmas tinha 50 checagens; eram 52
> (todas passaram). O número foi corrigido lá.

## Collection do Bruno

Ganhou a pasta **Alunos**:

| Pedido | O que faz |
|---|---|
| **Cadastrar aluno** | Cadastra um aluno na turma de `turmaId` e guarda o id dele em `alunoId` |
| **Listar alunos** | Lista os alunos ativos da turma de `turmaId` por número da chamada (filtros na aba *Params*) |
| **Ver aluno** | Mostra o aluno de `alunoId` |
| **Editar aluno** | Muda número da chamada e responsável do aluno de `alunoId` |
| **Importar planilha** | Importa 3 alunos de exemplo (cria as turmas `7°A` e `8°B` no seu nome) |
| **Excluir aluno** | Exclui o aluno de `alunoId` (precisa de token da gestão ou do admin) |

O pedido *Turmas > Excluir turma* foi atualizado com a nova regra (`TURMA_COM_ALUNOS`).

> **Dica:** rode *Turmas > Criar turma* antes, para ter uma `turmaId`. Para *Excluir aluno*, entre como admin.

## O que ainda NÃO existe

- **Matérias** e o vínculo matéria ↔ turma (Parte 3).
- **Vincular alunos às eletivas** (Parte 4).
- **Notas** dos alunos (Fase 4). A tela "Relatórios" busca alunos já com as notas; essa combinação vem junto
  com as notas.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- ~~Excluir turma apaga os alunos dela~~ → **resolvida**: turma com alunos não pode mais ser excluída (ver
  acima).
- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 3)

**Matérias (disciplinas).** Cada professor tem as próprias matérias (com nome e cor) e escolhe em quais turmas
cada uma aparece. É o *padrão A* de novo (cada um mexe no que é seu, a gestão vê tudo), agora em duas tabelas
ligadas: as matérias e os vínculos matéria ↔ turma.
