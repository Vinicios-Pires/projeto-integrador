# Execução 18 — Fase 4, Parte 6: planos de aula

**Data:** 31/10/2026
**Fase:** 4 — Notas/Provas e Planos de Aula
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (o teste com o Supabase real fica para depois) |
| **4** | **Notas/Provas e Planos de Aula** | 🔄 **em andamento** |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 4

1. ✅ Avaliações e notas ([execução 13](13-fase4-parte1-avaliacoes-e-notas.md))
2. ✅ Médias arredondadas ([execução 14](14-fase4-parte2-medias-arredondadas.md))
3. ✅ Provas e gabaritos ([execução 15](15-fase4-parte3-provas-e-gabaritos.md))
4. ✅ Correção de provas ([execução 16](16-fase4-parte4-correcao-de-provas.md))
5. ✅ Planejamento bimestral ([execução 17](17-fase4-parte5-planejamento-bimestral.md))
6. ✅ **Planos de aula**: cadastrar, duplicar, ajustes ← esta execução
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

---

## O que foi feito

São **as aulas** da planilha do planejamento bimestral, ou seja, cada linha com a data, o número de aulas e os
textos (aprendizagem essencial, conteúdo, desenvolvimento, recursos, avaliação…). Uma aula também pode existir
**solta**, fora de um planejamento.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver as aulas** | dono e gestão | Em ordem de data. Filtros: planejamento, turma, matéria, bimestre, professor, situação, um dia ou um período, e um limite (as "próximas aulas" do painel). |
| **Adicionar uma aula** | dono e admin | No planejamento, a turma, a matéria e o bimestre vêm dele. |
| **"Datas em sequência"** | dono e admin | Várias aulas de uma vez (até 200), uma por data. |
| **Editar a aula** | dono e admin | Célula por célula. Mudar a data muda o dia da semana. Texto vazio apaga. |
| **"Copiar para baixo"** | dono e admin | O mesmo valor em várias aulas, numa operação só. |
| **Duplicar** | dono e admin | Para uma semana depois (ou outra data), como pendente. A cópia guarda de onde veio. |
| **Ajustes (PDCA)** | dono e admin registram; gestão vê | O histórico do que foi ajustado em cada aula, o mais novo primeiro. |
| **Excluir** | dono e admin | Os ajustes e anexos saem junto. As cópias continuam, só sem a ligação. |

### A planilha validada fica travada

Quando a gestão **valida** o planejamento (Parte 5), as aulas dele **não podem mais ser adicionadas, editadas,
copiadas, duplicadas, ajustadas nem excluídas**, nem pelo admin. Para mudar, a gestão reabre o planejamento. As
aulas soltas continuam editáveis.

Hoje essa trava existe só na tela; agora o backend também a garante.

### Proteções

- **Um professor não vê nem mexe nas aulas de outro.** A gestão vê tudo, mas não altera.
- **Só nos próprios planejamentos, turmas e matérias.**
- Uma aula do planejamento **não muda de turma, matéria nem bimestre**: isso vem do planejamento.
- Datas sempre no formato `AAAA-MM-DD` e reais: o backend recusa, por exemplo, 30/02.
- "Copiar para baixo" é **tudo ou nada**: se uma das aulas não puder ser alterada, nenhuma muda.
- A **situação de aprovação** (pendente, aprovado…) não muda por aqui: isso é da Parte 7.

## Decisões tomadas nesta parte

- **O dia da semana é calculado pelo backend** a partir da data, e não digitado.
- **"Datas em sequência" recebe a lista de datas** que a tela já monta (escolhendo o período e os dias da
  semana). Assim a regra de quais dias entram fica com a tela, e o backend só garante que cada data é válida.
- **Duplicar copia os textos, mas não os anexos nem os ajustes**: a cópia é uma aula nova.
- **A cópia continua do professor dono**, mesmo quando o admin duplica.

## Como foi conferido

Foi criada a conferência `npm run test:planos`. Ela cria 4 usuários de teste (admin, coordenação e dois
professores), turmas, matérias e planejamentos, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Aulas no planejamento (vêm do planejamento, data e dia da semana, sequência em ordem, datas erradas, de outro, gestão não adiciona) | 11 de 11 ✅ |
| Aula solta (cria, turma de outro, número de aulas) | 3 de 3 ✅ |
| Editar (textos, data muda o dia, apagar célula, vínculo travado, quem pode, copiar para baixo, tudo ou nada) | 14 de 14 ✅ |
| Ver (do planejamento, de um dia, de um período, com limite, quem vê, filtros errados) | 9 de 9 ✅ |
| Duplicar (uma semana depois, outra data, de onde veio, pelo admin, gestão não) | 4 de 4 ✅ |
| Ajustes (registrar, histórico, vazio, quem pode) | 5 de 5 ✅ |
| Planilha validada travada (editar, admin, adicionar, copiar, duplicar, ajustar, excluir; aula solta livre; reabrir destrava) | 9 de 9 ✅ |
| Excluir (quem pode, ajustes saem, cópias ficam) | 4 de 4 ✅ |
| **Total da nova conferência** | **59 de 59 ✅** |

Também foram repetidas:

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

- **Collection do Bruno:** a pasta nova *Planos de aula* rodou inteira contra a API, com um professor temporário
  (depois de criar turma, matéria e planejamento): 6 de 6 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

Nova pasta **Planos de aula**:

| Pedido | O que faz |
|---|---|
| **Adicionar aulas** | Três aulas em sequência no planejamento de `planejamentoId`; guarda a primeira em `planoId` |
| **Listar aulas** | As aulas do planejamento |
| **Editar aula** | Muda conteúdo e recursos |
| **Duplicar aula** | Copia para uma semana depois |
| **Registrar ajuste** | Registra um ajuste (PDCA) |
| **Excluir aula** | Exclui a aula |

> **Dica:** rode antes *Turmas > Criar turma*, *Materias > Criar materia* e *Planejamento > Abrir planejamento*.

## O que ainda NÃO existe

- **Aprovação de cada plano pela gestão e anexos dos planos** (Parte 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 7)

**Aprovação dos planos pela gestão e anexos dos planos** (documentos e atividades adaptadas, pelo correio de
arquivos), e o resumo da Fase 4.
