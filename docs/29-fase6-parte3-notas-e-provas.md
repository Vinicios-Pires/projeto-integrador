# Execução 29 — Fase 6, Parte 3: notas, provas e correção ligadas ao backend

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
3. ✅ **Notas, provas e correção** ← esta execução
4. ⏳ **Planejamento e planos de aula** (com aprovação e anexos)
5. ⏳ **Diário, agenda e painéis** (Diário, Agenda, painel do professor e da gestão, lembretes, relatórios)
6. ⏳ **Ocorrências, PDI, tutoria e replicabilidade**
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

Três telas passaram a usar o backend. Por fora, continuam iguais.

| Tela | O que mudou para quem usa |
|---|---|
| **Notas** (a planilha) | Turmas, matérias, avaliações, alunos e notas vêm do backend. Cada nota digitada é gravada na hora, como antes. |
| **Colar notas do Excel** | Uma coluna (ou bloco) colada vai **num pedido só**: ou grava tudo, ou nada (antes, cada célula era um pedido, e uma falha no meio deixava a colagem pela metade). |
| **Médias arredondadas** | Ajustar a média final à mão, voltar ao automático e "descartar todas" usam o backend. |
| **Correção de Provas** | Criar a prova, salvar o gabarito e lançar a folha do aluno usam o backend. **A nota da folha é calculada pelo backend**, com a mesma conta da tela; e **mudar o gabarito recorrige as folhas já lançadas** (antes, as notas antigas ficavam como estavam). |
| **Prova Paulista** | O painel lê as avaliações marcadas como Prova Paulista, as notas e os alunos pelo backend. A gestão continua vendo o filtro por professor. |

Toda falha agora aparece com a mensagem do backend (antes, a planilha de notas não avisava quando uma nota
deixava de ser gravada).

### Dois defeitos antigos corrigidos

- **Correção de Provas, ao criar a prova:** os campos **Valor Total, Escola e Professor** do formulário eram
  ignorados (a prova ficava sempre valendo 10). Agora são gravados.
- **Correção de Provas, depois de lançar a folha:** a mensagem "Resultado salvo" mostrava uma **nota errada**
  (contava só as questões anuladas), porque calculava depois de a tela limpar as respostas. Agora mostra a nota
  lançada.

Os dois não tinham relação com o Supabase; a conferência nova os encontrou.

## Decisões tomadas nesta parte

- **A nota da prova vem do backend.** A tela continua mostrando a conta na hora (para o professor conferir
  antes de salvar), mas o que fica gravado é o que o backend calcula com o gabarito salvo.
- **Listas grandes vão em lotes.** O painel da Prova Paulista pode pedir as notas de muitas avaliações de uma
  vez; o cliente da API agora divide esses pedidos em partes (`buscarEmLotes`), para não passar do limite do
  endereço.
- **Nada mudou no backend** nesta parte: todas as rotas já existiam desde a Fase 4.

## Como foi conferido

Foi criada a conferência `npm run test:tela-notas`, num navegador de verdade. Ela cria um professor e uma
coordenadora de teste, uma turma com dois alunos e uma matéria, usa as telas como uma pessoa usaria e confere
cada passo no banco. No final, apaga tudo.

| Conferência | Resultado |
|---|---|
| Notas (abre a planilha, nova avaliação com peso e Prova Paulista, ordem, digitar nota, colar coluna, média ponderada 7,33, apagar nota) | 9 de 9 ✅ |
| Médias arredondadas (ajuste manual gravado, continua ao recarregar, apagar volta ao automático) | 3 de 3 ✅ |
| Correção de provas (criar prova, gabarito com anulada, lançar folha à mão: nota 5 calculada pelo backend, mensagem certa, mudar o gabarito recorrige para 4) | 8 de 8 ✅ |
| Prova Paulista (a aluna aparece no painel) | 1 de 1 ✅ |
| Gestão (a coordenação abre a planilha e vê as notas; vê a prova do professor) | 3 de 3 ✅ |
| **Total da nova conferência** | **24 de 24 ✅** |

Também foram repetidas:

- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅
- **Telas de turmas, alunos e matérias no navegador** (`npm run test:tela-cadastros`): 37 de 37 ✅
- **Conferências do backend:** o código do backend não mudou nesta parte; vale a rodada completa da
  [execução 27](27-fase6-parte1-login-no-frontend.md).
- **Checagem de tipos e build do frontend:** sem erros ✅
- **Lint do frontend nas telas alteradas:** menos avisos do que antes (Notas de 29 para 22, Correção de Provas
  de 12 para 9, Prova Paulista de 5 para 4); nenhum novo.
- **Collection do Bruno:** nenhuma rota nova nesta parte.

## O que ainda NÃO existe

- As telas das Partes 4 a 6 ainda falam com o Supabase.
- O frontend ainda tem o `@supabase/supabase-js` (sai na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção.
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).

## Próximo passo (Parte 4)

**Planejamento e planos de aula**: a planilha do planejamento bimestral, os planos de aula, a aprovação pela
gestão e os anexos (o primeiro uso do correio de arquivos pelas telas).
