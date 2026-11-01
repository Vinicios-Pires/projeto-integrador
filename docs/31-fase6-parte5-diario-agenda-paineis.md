# Execução 31 — Fase 6, Parte 5: diário, agenda e painéis ligados ao backend

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
5. ✅ **Diário, agenda e painéis** ← esta execução
6. ⏳ **Ocorrências, PDI, tutoria e replicabilidade**
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

Seis telas passaram a usar o backend. Por fora, continuam iguais.

| Tela | O que mudou para quem usa |
|---|---|
| **Diário do Professor** | Atividades, células e observações pelo backend. **Colar uma coluna do Excel vai num pedido só** (tudo ou nada). |
| **Agenda: minha agenda e rotina** | A rotina da semana e as mudanças de um dia ("só nesta data", "daqui para frente", "cancelar nesta data") pelo backend. **"Replicar segunda para a semana" é um pedido só** (antes, um por célula). |
| **Agenda da escola** | Os eventos vêm do backend; só a gestão cria e remove. |
| **Apoio presencial** | O professor vê os apoios dele **com os nomes** do professor e do responsável. A gestão marca e remove. |
| **Painel do professor (com os lembretes)** | Os números, o gráfico de notas, os próximos planos e o cartão da Prova Paulista vêm do backend. Os **post-its** (lembretes) são criados, fixados, concluídos e removidos pelo backend, e cada pessoa vê só os seus. |
| **Painel da gestão** | Professores, turmas, alunos, médias, planos e ocorrências da escola toda, pelo backend. |
| **Relatórios** | A média e a situação de cada aluno, calculadas com as notas que vêm do backend. |

### Um defeito antigo corrigido (importante)

No **Diário**, as células da planilha às vezes apareciam **vazias** ao abrir a turma, porque as atividades
chegavam antes das notas e a célula não se atualizava depois. Antes era só visual; mas, se o professor clicasse
numa dessas células e saísse dela, **o lançamento era apagado** (célula vazia = apagar). Agora a célula se
atualiza quando o valor salvo chega. A conferência nova encontrou o problema.

## Decisões tomadas nesta parte

- **O apoio presencial passou a trazer os nomes** (`professor_nome` e `responsavel_nome` em
  `GET /apoio-presencial`). O professor não pode ler a lista de usuários da escola, e sem isso a tela mostraria
  "—" no lugar dos nomes. É a única mudança no backend nesta parte; a conferência de eventos e apoio ganhou uma
  checagem.
- **"Cancelar nesta data" guarda o que já estava** na mudança daquele dia (turma, matéria, atividade), só
  marcando como cancelada, como antes.
- **Os painéis juntam os dados na tela**, como já faziam: por exemplo, as notas com o nome e a turma de cada
  aluno. Os números (turmas, alunos, aulas, ocorrências) são contados a partir das listas do backend.
- **Um só "tipo solto" no cliente da API** (`LinhaSolta`): as telas antigas tratavam os dados sem tipo; em vez de
  repetir isso em cada chamada nova, ficou num lugar só.
- **A aprovação de aulas pela gestão** (rota pronta desde a Fase 4) ainda não tem botão em nenhuma tela; nada a
  trocar aqui.

## Como foi conferido

Foi criada a conferência `npm run test:tela-diario-agenda`, num navegador de verdade. Ela cria um professor e uma
coordenadora de teste, uma turma com dois alunos, uma matéria, uma nota, um evento da escola e um apoio
presencial, usa as telas como uma pessoa usaria e confere no banco. No final, apaga tudo.

| Conferência | Resultado |
|---|---|
| Diário (nova atividade, escrever, colar coluna, valores aparecem ao voltar, apagar célula) | 5 de 5 ✅ |
| Agenda (rotina de segunda, replicar para a semana, limpar, agenda da escola, apoio com o nome do responsável) | 5 de 5 ✅ |
| Lembretes (criar, concluir) | 2 de 2 ✅ |
| Relatórios (média 8,00 e situação da aluna) | 1 de 1 ✅ |
| Painel da gestão (abre, com os números da escola) | 2 de 2 ✅ |
| **Total da nova conferência** | **15 de 15 ✅** (duas rodadas seguidas) |

Nas primeiras rodadas, as falhas foram de **tempo da própria conferência** (clicar antes de a tela terminar de
recarregar, como na Parte 4) e de um texto procurado num elemento escondido. Uma delas revelou o defeito do
Diário corrigido acima.

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
- **Lint do frontend nas telas alteradas:** nenhum aviso novo; vários a menos (Diário de 4 para 2, Agenda de 40
  para 38, painel do professor de 12 para 10, lembretes de 1 para 0; Relatórios igual, 12).
- **Collection do Bruno:** nenhuma rota nova (o `GET /apoio-presencial` só ganhou dois campos na resposta).

## O que ainda NÃO existe

- As telas da Parte 6 (Ocorrências, Ocorrências Escolares, PDI, Tutoria e Replicabilidade) ainda falam com o
  Supabase.
- O frontend ainda tem o `@supabase/supabase-js` (sai na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção.
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).

## Próximo passo (Parte 6)

**Ocorrências, PDI, tutoria e replicabilidade**: as últimas telas, quase todas com fotos e documentos pelo correio
de arquivos.
