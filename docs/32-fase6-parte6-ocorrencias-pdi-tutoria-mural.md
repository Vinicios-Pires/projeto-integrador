# Execução 32 — Fase 6, Parte 6: ocorrências, PDI, tutoria e replicabilidade ligadas ao backend

**Data:** 01/11/2026
**Fase:** 6 — Colocar no ar e ligar o frontend
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
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ✅ concluída |
| **6** | **Colocar no ar e ligar o frontend** | 🔄 **em andamento** |

### Partes da Fase 6

1. ✅ O "fio" entre as telas e o backend, e as telas de login ([execução 27](27-fase6-parte1-login-no-frontend.md))
2. ✅ Turmas, alunos, matérias e eletivas ([execução 28](28-fase6-parte2-turmas-alunos-materias.md))
3. ✅ Notas, provas e correção ([execução 29](29-fase6-parte3-notas-e-provas.md))
4. ✅ Planejamento e planos de aula ([execução 30](30-fase6-parte4-plano-de-aula.md))
5. ✅ Diário, agenda e painéis ([execução 31](31-fase6-parte5-diario-agenda-paineis.md))
6. ✅ **Ocorrências, PDI, tutoria e replicabilidade** ← esta execução
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

**Com esta parte, todas as telas do sistema falam com o backend.** O cliente antigo do Supabase continua no
projeto, mas nenhuma tela o usa mais.

---

## O que foi feito

As últimas cinco telas passaram a usar o backend, todas com **fotos ou documentos pelo correio de arquivos**.
Por fora, continuam iguais.

| Tela | O que mudou para quem usa |
|---|---|
| **Ocorrências de notebook** | Registrar, editar e excluir pelo backend; as fotos vão pelo backend, que guarda na pasta de quem registrou. Os links das fotos saem **numa ida só** para a lista inteira. Excluir a ocorrência leva as fotos. |
| **Ocorrências escolares** | Enviar, marcar como vista e remover pelo backend; a **resposta da gestão** grava quem respondeu e quando, e avisa o professor. Os nomes (de quem registrou e de quem respondeu) vêm junto. |
| **Evidências do PDI** | Registrar com fotos e documentos; remover arquivos; excluir leva tudo. As miniaturas dos cartões saem numa ida só. |
| **Tutoria** | Vincular alunos (os que já eram tutorados ficam de fora, com aviso), cadastrar aluno novo, o prontuário completo numa ida só, check-ins, registros, combinados, foto (trocar apaga a anterior) e documentos. |
| **Replicabilidade (mural)** | Publicar com fotos, editar, remover fotos e excluir pelo backend; o nome de quem publicou vem junto. |

### Atualização automática das ocorrências escolares

Com o Supabase, a lista de ocorrências escolares se atualizava **ao vivo** quando alguém mudava algo. O backend
não tem esse recurso; a tela agora **relê a lista a cada 30 segundos** e sempre que a janela volta a ficar em
primeiro plano. Para quem usa, o efeito é quase o mesmo.

## Decisões tomadas nesta parte

- **A lista de ocorrências escolares traz os nomes** (`professor_nome` e `gestao_nome`), pelo mesmo motivo do
  apoio presencial: o professor não pode ler a lista de usuários da escola. É a única mudança no backend nesta
  parte; a conferência das ocorrências ganhou uma checagem (41 de 41).
- **Envio de arquivos sempre pelo backend**: a tela manda o arquivo para a rota do módulo (ex.: "foto desta
  ocorrência"), e o backend guarda, registra e, se algo falhar, não deixa arquivo solto. A tela não monta mais o
  caminho do arquivo.
- **Um novo atalho no cliente da API** (`linksDosArquivos`), para pedir os links de várias fotos de uma vez.

## Como foi conferido

Foi criada a conferência `npm run test:tela-ocorrencias-pdi`, num navegador de verdade, com fotos e documentos
de verdade (numa pasta temporária). Ela cria um professor e uma coordenadora de teste, uma turma com uma aluna e
uma matéria, usa as cinco telas e confere no banco **e no armazenamento**. No final, apaga tudo.

| Conferência | Resultado |
|---|---|
| Notebook (registrar com foto, foto na pasta do professor, foto aparece pelo link temporário) | 3 de 3 ✅ |
| Escolares (enviar, gravada como "nova" com turma e matéria) | 2 de 2 ✅ |
| PDI (evidência com foto e documento, os dois arquivos guardados) | 2 de 2 ✅ |
| Tutoria (vincular a aluna, dados do cadastro, documento no prontuário) | 3 de 3 ✅ |
| Replicabilidade (publicar com foto) | 1 de 1 ✅ |
| Gestão (vê a ocorrência escolar; o mural mostra o nome de quem publicou) | 2 de 2 ✅ |
| **Total da nova conferência** | **13 de 13 ✅** |

Também foram repetidas:

- **Telas de ocorrências, PDI, tutoria e replicabilidade no navegador** (`npm run test:tela-ocorrencias-pdi`): 13 de 13 ✅
- **Telas de diário, agenda e painéis no navegador** (`npm run test:tela-diario-agenda`): 15 de 15 ✅
- **Tela de plano de aula no navegador** (`npm run test:tela-planos`): 20 de 20 ✅
- **Telas de notas e provas no navegador** (`npm run test:tela-notas`): 24 de 24 ✅
- **Telas de turmas, alunos e matérias no navegador** (`npm run test:tela-cadastros`): 37 de 37 ✅
- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅
- **Replicabilidade** (`npm run test:replicabilidade`): 20 de 20 ✅
- **Tutoria** (`npm run test:tutoria`): 35 de 35 ✅
- **PDI** (`npm run test:pdi`): 27 de 27 ✅
- **Ocorrências** (`npm run test:ocorrencias`): 41 de 41 ✅
- **Eventos, apoio presencial e lembretes** (`npm run test:escola`): 44 de 44 ✅
- **Agenda do professor** (`npm run test:agenda`): 30 de 30 ✅
- **Diário de classe** (`npm run test:diario`): 44 de 44 ✅
- **Aprovação e anexos** (`npm run test:aprovacao`): 37 de 37 ✅
- **Planos de aula** (`npm run test:planos`): 59 de 59 ✅
- **Planejamento bimestral** (`npm run test:planejamentos`): 46 de 46 ✅
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

Na rodada completa, a conferência de **diário, agenda e painéis** parou no meio (7 checagens) porque, ao mesmo
tempo, os arquivos do cliente antigo do Supabase estavam sendo apagados (início da Parte 7), e o frontend em teste
recarregou a página. Rodada de novo, sozinha, passou inteira (15 de 15), que é o resultado acima.

- **Checagem de tipos e build do frontend:** sem erros ✅
- **Lint do frontend nas telas alteradas:** bem menos avisos (Ocorrências de 6 para 4, Ocorrências Escolares de 5
  para 0, PDI de 14 para 0, Tutoria de 12 para 5, Replicabilidade de 10 para 0); nenhum novo.
- **Collection do Bruno:** nenhuma rota nova (a lista de ocorrências escolares só ganhou dois campos).

## O que ainda NÃO existe

- O frontend ainda tem o `@supabase/supabase-js` e as variáveis do Supabase no `.env` (saem na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção (o backend usa o Supabase Storage).
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).

## Próximo passo (Parte 7)

**Tirar o Supabase do frontend**: remover o cliente, os tipos gerados e as variáveis antigas, conferir que nada
mais depende deles, e deixar o frontend e o backend prontos para ir ao ar (configuração do Render).
