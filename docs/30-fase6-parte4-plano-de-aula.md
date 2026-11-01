# Execução 30 — Fase 6, Parte 4: plano de aula ligado ao backend

**Data:** 31/10/2026
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
4. ✅ **Planejamento e planos de aula** (com validação e anexos) ← esta execução
5. ⏳ **Diário, agenda e painéis** (Diário, Agenda, painel do professor e da gestão, lembretes, relatórios)
6. ⏳ **Ocorrências, PDI, tutoria e replicabilidade**
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

A tela **Plano de Aula** (o planejamento bimestral em forma de planilha) passou a usar o backend. Por fora,
continua igual.

| Ação na tela | O que mudou para quem usa |
|---|---|
| **Lista de planejamentos** | Vem do backend, já com **quantas aulas** cada um tem (antes, a tela buscava todas as aulas só para contar). A gestão vê o nome do professor de cada um. |
| **Novo planejamento** | Se já existe um para a mesma turma, matéria, bimestre e ano, **abre o que existe** (o backend garante isso). |
| **Adicionar aula / datas em sequência** | As aulas herdam turma, matéria e bimestre do planejamento pelo backend. "Datas em sequência" vai **num pedido só**. |
| **Escrever nas células, copiar para baixo, duplicar, excluir** | Pelo backend. "Copiar para baixo" é um pedido só; duplicar cria a cópia uma semana depois. |
| **Ajustes (PDCA)** | Registrar e ver o histórico pelo backend. |
| **Anexos** (documento e atividade adaptada) | **Primeira tela a usar o correio de arquivos.** O arquivo vai pelo backend, que guarda na pasta do professor dono e registra o anexo; "Baixar" abre por um **link temporário**; "Remover" apaga o registro **e o arquivo**. |
| **Enviar para validação, validar, solicitar ajustes, reabrir** | O backend confere **quem pode** fazer cada passagem e grava **quem validou e quando** (antes, a tela gravava isso direto). |

Toda falha agora aparece com a mensagem do backend; por exemplo, tentar mexer numa planilha já validada.

## Decisões tomadas nesta parte

- **O backend passou a informar quantas aulas cada planejamento tem** (`aulas_count` em `GET /planejamentos`).
  É a única mudança no backend nesta parte; a conferência do planejamento ganhou uma checagem para isso.
- **Os nomes dos professores**: a gestão lê a lista de usuários do backend; o professor só vê os próprios
  planejamentos, então a tela usa o nome dele mesmo.
- **Contagem de anexos no PDF**: ao gerar o PDF da planilha, a tela pergunta os anexos de cada aula ao
  backend (antes, uma busca só no Supabase). Para uma planilha de um bimestre, são poucas dezenas de pedidos
  pequenos, feitos ao mesmo tempo.

## Como foi conferido

Foi criada a conferência `npm run test:tela-planos`, num navegador de verdade. Ela cria um professor e uma
coordenadora de teste, uma turma e uma matéria, e faz o caminho completo: criar o planejamento, montar as aulas,
escrever, copiar, duplicar, ajustar, anexar e baixar um arquivo, enviar para validação, a coordenação validar e
a planilha ficar só para leitura. Os arquivos vão para uma pasta temporária, apagada no final com todo o resto.

| Conferência | Resultado |
|---|---|
| Planejamento (criar abre a planilha; rascunho no nome do professor) | 2 de 2 ✅ |
| Aulas (datas em sequência: 4 aulas, com matéria e dia da semana; adicionar; escrever; copiar para baixo; duplicar; ajuste PDCA mostrado e gravado) | 8 de 8 ✅ |
| Anexos (anexar na pasta do professor, arquivo guardado, baixar pelo link temporário, remover do banco e do armazenamento) e excluir aula | 6 de 6 ✅ |
| Validação (enviar, lista mostra "5 aulas", a coordenação valida com o nome dela, planilha validada só para leitura) | 4 de 4 ✅ |
| **Total da nova conferência** | **20 de 20 ✅** |

Na primeira rodada, o "copiar para baixo" falhou **por causa da velocidade da própria conferência**: logo depois
de "Adicionar aula", a tela recarrega a lista; a conferência escreveu na célula antes de a recarga chegar, e a
recarga (com os dados de antes) apagou o texto da memória da tela. Uma pessoa não consegue clicar tão rápido; a
conferência passou a esperar a linha nova aparecer, como uma pessoa faria.

A base das conferências de tela passou a usar uma **pasta temporária para os arquivos**, como as conferências
de arquivos do backend.

Também foram repetidas:

- **Telas de diário, agenda e painéis no navegador** (`npm run test:tela-diario-agenda`): 15 de 15 ✅
- **Tela de plano de aula no navegador** (`npm run test:tela-planos`): 20 de 20 ✅
- **Telas de notas e provas no navegador** (`npm run test:tela-notas`): 24 de 24 ✅
- **Telas de turmas, alunos e matérias no navegador** (`npm run test:tela-cadastros`): 37 de 37 ✅
- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅
- **Replicabilidade** (`npm run test:replicabilidade`): 20 de 20 ✅
- **Tutoria** (`npm run test:tutoria`): 35 de 35 ✅
- **PDI** (`npm run test:pdi`): 27 de 27 ✅
- **Ocorrências** (`npm run test:ocorrencias`): 40 de 40 ✅
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

- **Checagem de tipos e build do frontend:** sem erros ✅
- **Lint do frontend nas telas alteradas:** menos avisos do que antes (Plano de Aula de 2 para 0, planilha de 8
  para 3); nenhum novo.
- **Collection do Bruno:** nenhuma rota nova (o `GET /planejamentos` só ganhou um campo na resposta).

## O que ainda NÃO existe

- As telas das Partes 5 e 6 ainda falam com o Supabase.
- O frontend ainda tem o `@supabase/supabase-js` (sai na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção. Até lá, os anexos ficam no
  armazenamento local do backend.
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).

## Próximo passo (Parte 5)

**Diário, agenda e painéis**: o diário de classe, a agenda do professor, o painel do professor (com os
lembretes) e o da gestão, e os relatórios.
