# Execução 10 — Fase 2, Parte 5: ano letivo e grade de horários

**Data:** 31/10/2026
**Fase:** 2 — Turmas, alunos e disciplinas
**Status da parte:** ✅ concluída. **Com isso, a Fase 2 inteira está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ **concluída** |
| **3** | **"Correio de arquivos" (fotos e documentos)** | ⏭️ **próxima** |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 2

1. ✅ Turmas ([execução 06](06-fase2-parte1-turmas.md))
2. ✅ Alunos e importação da planilha ([execução 07](07-fase2-parte2-alunos.md))
3. ✅ Matérias e em quais turmas aparecem ([execução 08](08-fase2-parte3-materias.md))
4. ✅ Eletivas: escolher os participantes ([execução 09](09-fase2-parte4-eletivas.md))
5. ✅ **Ano letivo e grade de horários** ← esta execução

Resumo da fase inteira: [resumo-fase-2.md](resumos/resumo-fase-2.md).

---

## O que foi feito

Dois cadastros que valem para **a escola inteira** e que o seed da Fase 0 já tinha preenchido (a grade de 12
faixas e o ano letivo 2026). Agora eles podem ser lidos e mantidos pela API.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver a grade de horários** | todo usuário logado | As faixas do dia (aulas, intervalos, almoço, planejamento) em ordem, com início e fim. É o que a agenda usa para montar a semana. |
| **Criar, editar e excluir faixas** | só admin | Cada faixa tem ordem, nome (ex.: "1ª aula"), início, fim e tipo. |
| **Ver os anos letivos** | todo usuário logado | Do mais recente para o mais antigo, com início, fim e se está ativo. |
| **Criar, editar e excluir anos letivos** | só admin | Um ano não pode ser cadastrado duas vezes. |

É o *padrão C* do planejamento: **todos leem, só o admin altera**, igual ao sistema atual.

### Proteções

- **Faixa de horário em uso não pode ser excluída.** No banco, excluir uma faixa apagaria junto a rotina
  semanal e as exceções da agenda de **todos os professores** naquele horário. Agora o admin recebe o aviso
  "Este horário está na agenda de algum professor. Altere-o em vez de excluir." (Mudar o horário de uma faixa,
  por exemplo de 7h00 para 7h10, continua livre e vale para todos.)
- **O fim precisa ser depois do início**, tanto na faixa de horário quanto no ano letivo.
- Horário impossível (ex.: 25h), data em outro formato, tipo de faixa inventado ou ano fora de 2000 a 2100 voltam
  com mensagem clara, e nada é gravado.
- Gestão e professores **leem**, mas recebem "sem permissão" se tentarem alterar.

## Decisões tomadas nesta parte

- **Bloquear a exclusão de faixa em uso** segue a decisão da equipe sobre as turmas (execução 07): quando
  excluir apagaria em cascata o trabalho de outras pessoas, o backend impede. Não foi preciso perguntar de novo,
  porque é o mesmo caso.
- **Horários saem como `HH:MM:SS` e datas como `AAAA-MM-DD`**, exatamente como o Supabase devolve hoje, para as
  telas não precisarem mudar nada.
- **Pode haver mais de um ano letivo ativo.** O sistema atual não impede, e nenhuma tela usa essa marcação hoje.
  Se um dia precisar de "só um ativo", é um ajuste pequeno.
- **A conferência não toca nos dados reais:** ela confere, no começo e no fim, que a grade e o ano letivo de
  verdade ficaram idênticos, e usa uma faixa e anos de teste (2097 e 2098) que apaga no final.

## Como foi conferido

Foi criada a conferência `npm run test:calendario`, no mesmo estilo das anteriores.

| Conferência | Resultado |
|---|---|
| Grade de horários (ler, formato, criar, editar, dados errados, quem pode, faixa em uso protegida) | 25 de 25 ✅ |
| Ano letivo (ler, formato, criar, ano repetido, editar, dados errados, quem pode, excluir) | 20 de 20 ✅ |
| Dados reais preservados (grade e ano letivo idênticos no fim) | 2 de 2 ✅ |
| **Total da nova conferência** | **47 de 47 ✅** |

Também foram repetidas:

- **Conferência das eletivas** (`npm run test:membros`): 32 de 32 ✅
- **Conferência das matérias** (`npm run test:disciplinas`): 61 de 61 ✅
- **Conferência dos alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Conferência das turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Calendario* rodou inteira contra a API, com um admin temporário: 8 de 8 ✅. A faixa e o ano de teste criados pela pasta foram apagados por ela mesma, e o admin temporário em seguida.

## Collection do Bruno

Ganhou a pasta **Calendario**:

| Pedido | O que faz |
|---|---|
| **Listar grade** | Lista as faixas de horário |
| **Criar horario** | Cria uma faixa de teste e guarda o id em `horarioId` (só admin) |
| **Editar horario** | Muda o fim da faixa de `horarioId` |
| **Excluir horario** | Exclui a faixa de `horarioId` |
| **Listar anos letivos** | Lista os anos letivos |
| **Criar ano letivo** | Cria o ano 2099 e guarda o id em `anoLetivoId` (só admin) |
| **Editar ano letivo** | Desativa o ano de `anoLetivoId` |
| **Excluir ano letivo** | Exclui o ano de `anoLetivoId` |

> **Atenção:** os pedidos de criar mexem nos dados reais da escola. Rodando a pasta inteira, na ordem, o que é
> criado é apagado no fim. Precisa do token de um **admin**.

## O que ainda NÃO existe

- A **agenda** dos professores, que usa a grade (Fase 5).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Fase 3)

**"Correio de arquivos"**: fotos e documentos (de ocorrências, PDI, tutoria, replicabilidade, planos de aula)
passam a ser enviados e baixados **pelo backend**, que guarda tudo no Supabase Storage e confere quem pode ver
cada arquivo. Antes de começar, a fase será dividida em partes.
