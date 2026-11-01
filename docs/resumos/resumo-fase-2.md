# Resumo da Fase 2 — Turmas, alunos e disciplinas

**Período:** 31/10/2026
**Situação:** ✅ concluída
**Execuções que fizeram parte desta fase:**
[06 — turmas](../06-fase2-parte1-turmas.md) ·
[07 — alunos](../07-fase2-parte2-alunos.md) ·
[08 — matérias](../08-fase2-parte3-materias.md) ·
[09 — eletivas](../09-fase2-parte4-eletivas.md) ·
[10 — ano letivo e grade](../10-fase2-parte5-ano-letivo-e-grade.md)

---

## Em uma frase

O backend agora guarda o cadastro escolar básico (turmas, alunos, matérias, eletivas, grade de horários e ano
letivo), e aplica de verdade as regras de quem pode ver e mexer em cada coisa, que no sistema atual ficavam
no Supabase.

---

## Ponto de partida

No fim da Fase 1, as pessoas já conseguiam se cadastrar, ser aprovadas e entrar, mas ainda não havia nada da
escola para ver ou cadastrar.

## O que existe agora

| Cadastro | Quem vê | Quem altera | Destaques |
|---|---|---|---|
| **Turmas** (normais e eletivas) | o dono e a gestão | o dono e o admin | Vêm com quantos alunos e quantos participantes têm. Turma com alunos não pode ser excluída. |
| **Alunos** | todos | todos (excluir: só gestão) | Filtros por turma e situação, três ordens, **importação da planilha** que cria as turmas que faltam. Não aceita dois alunos com o mesmo nome na mesma turma. |
| **Matérias** | o dono e a gestão | o dono e o admin | Cor da paleta da tela; "inativar" sem perder nada. |
| **Matéria ↔ turma** | o dono e a gestão | o dono e o admin | O professor escolhe em quais das suas turmas a matéria aparece, de uma vez. |
| **Participantes das eletivas** | o dono e a gestão | o dono e o admin | Alunos de várias turmas; eles continuam na turma de origem. |
| **Grade de horários** | todos | só admin | Faixa usada na agenda de alguém não pode ser excluída. |
| **Ano letivo** | todos | só admin | Sem anos repetidos. |

### As três regras de acesso usadas (do planejamento)

- **"Cada um no seu" (padrão A):** turmas, matérias, vínculos e eletivas. O professor só vê e mexe no que é
  dele; a gestão vê tudo, mas só lê; o admin pode tudo. Para o professor, o que é de um colega **não existe**
  (responde "não encontrado"), então nem dá para descobrir o que os outros têm.
- **"Cadastro da escola" (padrão C):** alunos (todos leem e escrevem, só a gestão exclui), grade e ano letivo
  (todos leem, só o admin altera).
- Essas regras ficaram escritas **num lugar só** no código, para as próximas fases (notas, planos, diário…)
  usarem exatamente as mesmas.

## Decisões importantes tomadas na Fase 2

| Decisão | Por quê |
|---|---|
| **Turma com alunos não pode ser excluída** (decisão da equipe) | No banco, excluir a turma apagaria junto os alunos e as notas deles |
| **Faixa de horário em uso não pode ser excluída** | Pelo mesmo motivo: apagaria a agenda de todos os professores naquele horário |
| Excluir matéria continua livre | Planos, notas e provas não são apagados, só ficam sem matéria; e a tela tem "inativar" |
| O dono de turma e matéria é sempre quem está logado | No sistema atual, a tela não informava o dono e só o admin conseguia criar turma |
| Quando o admin altera algo de um professor, o registro continua no nome do professor | O professor continua enxergando tudo como se ele mesmo tivesse feito |
| "Escolher várias" (turmas da matéria, participantes da eletiva, importação) é sempre **uma operação só** | Hoje as telas fazem em etapas e podem ficar pela metade se uma falhar |
| Mesmo formato de dados que as telas já recebem (nomes das colunas, `turmas: {nome, serie}`, datas `AAAA-MM-DD`, horários `HH:MM:SS`) | Facilita ligar o frontend na Fase 6 |
| Nome e série da turma aparecem junto com o aluno para todos | No Supabase vinham em branco para turmas de outro professor; não é informação sensível |
| Turmas criadas pela importação seguem o padrão da tela Turmas (`1º Ano EM`) | Para o filtro por nível de ensino reconhecê-las |

## Como sabemos que funciona

Cinco conferências novas, todas contra o banco real, cada uma com os próprios usuários e dados de teste,
apagados no final. Muitas delas tentam **de propósito** quebrar as regras (ex.: "o professor B tenta ver a turma
do professor A").

| Conferência | Comando | Resultado |
|---|---|---|
| Turmas | `npm run test:turmas` | 55 de 55 ✅ |
| Alunos e importação | `npm run test:alunos` | 65 de 65 ✅ |
| Matérias e vínculos | `npm run test:disciplinas` | 61 de 61 ✅ |
| Eletivas | `npm run test:membros` | 32 de 32 ✅ |
| Grade e ano letivo | `npm run test:calendario` | 47 de 47 ✅ |
| **Total da Fase 2** | | **260 de 260 ✅** |
| Fases anteriores (login, cadastro, usuários, banco), repetidas | | 142 de 142 ✅ |

A **collection do Bruno** ganhou as pastas *Turmas*, *Alunos*, *Materias*, *Eletivas* e *Calendario*, e cada uma
rodou contra a API com usuários temporários.

## Problemas encontrados e resolvidos

- **Contagem errada num documento:** a execução 06 dizia que a conferência das turmas tinha 50 checagens; eram
  52. Corrigido.
- **Conferência do banco desatualizada:** ela exigia que o admin ainda estivesse com a senha temporária, mas ele
  já tinha trocado. Agora ela aceita as duas situações.
- **Importação grande demais:** o servidor aceitava no máximo 100 KB por pedido, e uma planilha de 2000 alunos
  passaria disso com um erro interno. O limite subiu para 1 MB, e acima disso a mensagem é clara.
- **Validação do Bruno travada:** um script de apoio travou a API de teste. Foi corrigido. Sobraram 5 processos
  parados no computador de desenvolvimento, que não afetam o sistema e podem ser encerrados à mão.

## Coisas para lembrar na Fase 6 (ligar as telas)

- A tela **Turmas** deixa de mandar o dono e passa a usar a contagem de alunos e participantes que já vem pronta.
- A tela **Alunos** passa a enviar a planilha inteira para `POST /alunos/importar` e mostra os erros devolvidos
  (somando 1 à posição da linha, por causa do cabeçalho).
- As telas de **Matérias** e **Turmas** (eletivas) passam a salvar as escolhas de uma vez (`PUT`), em vez de
  incluir e excluir em etapas.
- Os vínculos matéria ↔ turma vêm sempre com os nomes `turmas` e `disciplinas`; a tela **Ocorrências** usa
  outros nomes hoje e precisa de um ajuste.
- A tela **Notas** descobre as eletivas do professor pela lista de turmas (campo `tipo`).
- Mensagens novas que as telas precisam tratar: `TURMA_COM_ALUNOS`, `ALUNO_DUPLICADO`, `HORARIO_EM_USO`.

## Limitações conhecidas (aceitas por enquanto)

- Para esvaziar uma turma com alunos, o professor precisa **mover** os alunos (excluir é só com a gestão).
- Pode haver mais de um ano letivo ativo ao mesmo tempo.
- Na importação feita pela gestão, se duas turmas tiverem o mesmo nome, vale a mais antiga.

## Pendências que dependem da equipe

1. **Região do banco:** EUA ou São Paulo.
2. **Dono de cada conta:** Neon, Render e Supabase.

## Próxima fase

**Fase 3 — "Correio de arquivos".** Fotos e documentos passam a ser enviados e baixados pelo backend, que guarda
tudo no Supabase Storage e confere quem pode ver cada arquivo.
