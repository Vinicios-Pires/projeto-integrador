# Execução 25 — Fase 5, Parte 6: tutoria

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

1. ✅ Diário de classe ([execução 20](20-fase5-parte1-diario-de-classe.md))
2. ✅ Agenda do professor ([execução 21](21-fase5-parte2-agenda-do-professor.md))
3. ✅ Eventos da escola, apoio presencial e lembretes ([execução 22](22-fase5-parte3-eventos-apoio-e-lembretes.md))
4. ✅ Ocorrências ([execução 23](23-fase5-parte4-ocorrencias.md))
5. ✅ PDI ([execução 24](24-fase5-parte5-pdi.md))
6. ✅ **Tutoria**: tutorados, encontros, registros, combinados e documentos ← esta execução
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

---

## O que foi feito

É o backend da tela **"Tutoria"**: cada professor tutor acompanha alguns alunos (os **tutorados**). Para cada um,
registra como ele está, os encontros, os combinados e guarda documentos e uma foto.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver os tutorados** | o tutor; a gestão, de todos | Em ordem de nome; por situação (ativo/inativo) e por tutor. |
| **Vincular alunos** | todo usuário logado | Um ou vários de uma vez, a partir do cadastro de alunos (nome, turma e número vêm de lá). Quem já é seu tutorado fica de fora, sem erro. Também dá para cadastrar um tutorado sem cadastro de aluno. |
| **Abrir um tutorado** | o tutor e a gestão | Com todo o acompanhamento junto: check-ins, registros, combinados e documentos. |
| **Check-in de humor** | tutor e admin | Bem, mais ou menos, difícil, observar. |
| **Registrar um encontro** | tutor e admin | Como o aluno está, observação, combinado, próxima ação. |
| **Combinados** | tutor e admin | Nascem pendentes; marcar como cumprido (ou voltar). |
| **Foto e documentos** | tutor e admin | A foto é uma só (trocar apaga a anterior); documentos até 20 MB. |
| **Apagar um item / excluir o tutorado** | tutor e admin | Excluir o tutorado leva todo o acompanhamento, a foto e os documentos. O cadastro do aluno não muda. |

### Proteções

- **Um professor não vê os tutorados de outro.** A gestão vê, mas não altera.
- **O mesmo aluno não entra duas vezes** para o mesmo tutor. Dois professores podem ser tutores do mesmo aluno.
- O acompanhamento fica **no nome do tutor**, mesmo quando o admin registra; os arquivos ficam na pasta dele.
- Foto só de imagem; nada fica gravado quando o envio é recusado; arquivos apagados saem também do armazenamento.

## Decisões tomadas nesta parte

- **"Vincular" vários alunos sem erro para os repetidos**: a tela já deixa marcar vários de uma vez; quem já era
  tutorado só é contado à parte (`ja_existiam`).
- **O detalhe do tutorado vem completo numa ida só**, em vez das quatro buscas que a tela faz hoje.
- **Uma rota para apagar qualquer item** do acompanhamento (`/tutorados/:id/<tipo>/:itemId`), com as mesmas
  regras para todos.
- A busca das **ocorrências escolares de um tutorado** (que a tela de tutoria mostra) já foi feita na Parte 4,
  com o filtro `aluno`.

## Como foi conferido

Foi criada a conferência `npm run test:tutoria`. Ela usa uma pasta temporária como armazenamento, cria 4 usuários
de teste (admin, coordenação e dois professores), turma e alunos, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Tutorados (vincular vários, dados do aluno, sem duplicar, aluno inválido, sem cadastro, situação, dois tutores, listar, quem vê e quem altera) | 13 de 13 ✅ |
| Acompanhamento (check-in, humor inválido, registro, combinado pelo admin, cumprido, item inexistente, quem registra, registros de vários) | 10 de 10 ✅ |
| Foto e documentos (colocar e trocar a foto, tipo recusado, documento, detalhe completo, apagar itens, quem apaga, excluir leva tudo) | 12 de 12 ✅ |
| **Total da nova conferência** | **35 de 35 ✅** |

Também foram repetidas (valem para as Partes 4, 5 e 6):

- **Tutoria** (`npm run test:tutoria`): 35 de 35 ✅
- **PDI** (`npm run test:pdi`): 27 de 27 ✅
- **Ocorrências** (`npm run test:ocorrencias`): 40 de 40 ✅
- **Eventos, apoio presencial e lembretes** (`npm run test:escola`): 43 de 43 ✅
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

- **Collection do Bruno:** a pasta nova *Tutoria* rodou inteira contra a API, com um professor temporário (depois de
  criar turma e aluno): 5 de 5 ✅. Tudo foi apagado em seguida, inclusive o documento.

## Collection do Bruno

Nova pasta **Tutoria**:

| Pedido | O que faz |
|---|---|
| **Vincular alunos** | Vincula o aluno de `alunoId`; guarda o tutorado em `tutoradoId` |
| **Registrar encontro** | Registra um encontro |
| **Anexar documento** | Anexa um texto como documento |
| **Ver tutorado** | O tutorado com todo o acompanhamento |
| **Excluir tutorado** | Exclui (e apaga os arquivos) |

## O que ainda NÃO existe

- A replicabilidade (Parte 7) e o resumo da Fase 5.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Fuso das datas dos eventos** (Parte 3).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 7)

**Replicabilidade**: o mural de boas práticas, que todos podem ver, com fotos; e o resumo da Fase 5.
