# Resumo da Fase 4 — Notas, provas e planos de aula

**Período:** 31/10/2026
**Situação:** ✅ concluída
**Execuções que fizeram parte desta fase:**
[13 — avaliações e notas](../13-fase4-parte1-avaliacoes-e-notas.md) ·
[14 — médias arredondadas](../14-fase4-parte2-medias-arredondadas.md) ·
[15 — provas e gabaritos](../15-fase4-parte3-provas-e-gabaritos.md) ·
[16 — correção de provas](../16-fase4-parte4-correcao-de-provas.md) ·
[17 — planejamento bimestral](../17-fase4-parte5-planejamento-bimestral.md) ·
[18 — planos de aula](../18-fase4-parte6-planos-de-aula.md) ·
[19 — aprovação e anexos](../19-fase4-parte7-aprovacao-e-anexos.md)

---

## Em uma frase

As três telas de trabalho pedagógico (**Notas**, **Correção de Provas** e **Plano de Aula**) já têm o backend
completo, com as regras de quem vê e quem altera, e com o fluxo de validação e aprovação pela gestão.

---

## Ponto de partida

Estas telas falavam direto com o banco do Supabase. As regras ("o professor só mexe no que é seu", "planilha
validada não muda", "a nota bate com o gabarito") existiam só na tela, ou nem isso. Faltava o backend.

## O que existe agora

| Tela | O que o backend faz |
|---|---|
| **Notas** | Colunas de avaliação (com peso e Prova Paulista), lançamento de notas em lote, médias ajustadas à mão e o "descartar todas" |
| **Correção de Provas** | Provas, gabarito (com questões anuladas), lançamento das respostas e **correção feita pelo backend**, que recalcula quando o gabarito muda |
| **Plano de Aula** | Planejamento bimestral com **validação pela gestão**; as aulas da planilha (sequência de datas, copiar para baixo, duplicar, ajustes PDCA); **aprovação de cada aula**; anexos pelo correio de arquivos |

### Quem pode o quê

Em toda a fase vale o **padrão A**:

- **professor:** vê e altera só o que é seu;
- **gestão:** vê tudo, mas não altera;
- **admin:** pode tudo.

Os fluxos de aprovação seguem o **padrão E**, em que a gestão age sobre o que é do professor:

| Fluxo | O professor | A gestão |
|---|---|---|
| Planejamento bimestral | Envia para validação | Valida, pede ajustes, reabre |
| Cada aula | Edita (e a aula volta a pendente) | Aprova, devolve para ajuste, volta a pendente |

Com o **planejamento validado, a planilha fica travada**, nem o admin altera. É preciso reabrir.

## Decisões importantes tomadas na Fase 4

| Decisão | Por quê |
|---|---|
| Notas, pesos e médias saem como número | É o que as telas esperam do Supabase; texto quebraria as contas |
| O dono de notas, médias e correções é o professor da avaliação, matéria ou prova | Quando o admin lança, o registro continua aparecendo para o professor |
| Avaliação e prova com respostas não mudam de turma | As notas e respostas são de alunos daquela turma |
| **O backend corrige as provas**, com a mesma conta da tela | A nota guardada sempre bate com o gabarito atual |
| Lançamentos em lote são tudo ou nada | Nunca fica metade de uma planilha salva |
| Uma rota de situação com uma tabela fixa de quem pode o quê | Cada regra de validação fica num lugar só |
| Aula editada depois de aprovada volta a pendente | A gestão nunca vê "aprovado" num conteúdo que não leu |
| Os anexos ficam na pasta do professor dono e saem junto com a aula | O professor sempre vê; não sobram arquivos perdidos |

## Como sabemos que funciona

| Conferência | Comando | Resultado |
|---|---|---|
| Avaliações e notas | `npm run test:notas` | 58 de 58 ✅ |
| Médias arredondadas | `npm run test:medias` | 39 de 39 ✅ |
| Provas e gabaritos | `npm run test:provas` | 50 de 50 ✅ |
| Correção de provas | `npm run test:correcao` | 37 de 37 ✅ |
| Planejamento bimestral | `npm run test:planejamentos` | 45 de 45 ✅ |
| Planos de aula | `npm run test:planos` | 59 de 59 ✅ |
| Aprovação e anexos | `npm run test:aprovacao` | 37 de 37 ✅ |
| **Total da Fase 4** | | **325 de 325 ✅** |
| Fases anteriores, repetidas | | 480 de 480 ✅ |

A **collection do Bruno** ganhou a parte de médias na pasta *Notas* e as pastas *Provas*, *Planejamento* e
*Planos de aula*. Todas foram rodadas contra a API, inclusive a validação e a aprovação feitas por um usuário
da gestão.

## Problemas encontrados e resolvidos

- **Contagem errada no doc 15:** eu tinha anotado 51 checagens na conferência das provas; são 50 (a seção de
  excluir tem 5, e não 6). O doc foi corrigido.
- **Planejamento sem matéria podia duplicar:** no banco, duas linhas sem matéria não "batem" na regra de não
  repetir. O backend procura antes de criar.
- **Filtrar por outro professor** poderia, num descuido, desligar o filtro de quem pode ver. Os dois filtros agora
  valem juntos, e a conferência testa isso.

## Coisas para lembrar na Fase 6 (ligar as telas)

- **Notas:** as médias ajustadas passam a ir para `PUT /medias-arredondadas` com a planilha (turma, matéria,
  bimestre) uma vez só; o "descartar todas" é `POST /medias-arredondadas/descartar`.
- **Correção de Provas:** a tela manda só as **respostas**; os acertos e a nota vêm na resposta. Excluir e
  editar provas passam a existir no backend (a tela ainda não tem esses botões).
- **Planejamento:** "Novo planejamento" vira `POST /planejamentos` (devolve o que já existe); os botões de
  situação viram `POST /planejamentos/:id/status`.
- **Planilha de aulas:** "datas em sequência" vira `POST /planejamentos/:id/aulas` com as datas; "copiar para
  baixo" vira `PATCH /planos-aula/lote`; os anexos viram `POST /planos-aula/:id/anexos`.
- O **dia da semana** passa a vir pronto do backend.

## Limitações conhecidas (aceitas por enquanto)

- O **peso das questões** é guardado, mas não entra na nota (a tela não o usa).
- Ao apagar uma **turma inteira**, os arquivos dos anexos das aulas dela ficam no armazenamento (as linhas
  somem). É raro e pode ser limpo depois.
- A tela ainda não tem botões para aprovar cada aula; a rota já está pronta para quando tiver.

## Pendências que dependem da equipe

1. **Confirmar o que "ajustado" significa** nas aulas (assumido: devolvida pela gestão para ajuste).
2. **Supabase (chave e endereço):** deixado para depois.
3. **Dono de cada conta:** Neon, Render e Supabase.
4. A **região do banco** já está definida: N. Virginia (EUA).

## Próxima fase

**Fase 5 — Demais módulos**: Diário de classe, Agenda, Ocorrências, PDI, Tutoria e Replicabilidade.
