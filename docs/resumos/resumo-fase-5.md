# Resumo da Fase 5 — Demais módulos

**Período:** 31/10/2026
**Situação:** ✅ concluída
**Execuções que fizeram parte desta fase:**
[20 — diário de classe](../20-fase5-parte1-diario-de-classe.md) ·
[21 — agenda do professor](../21-fase5-parte2-agenda-do-professor.md) ·
[22 — eventos, apoio presencial e lembretes](../22-fase5-parte3-eventos-apoio-e-lembretes.md) ·
[23 — ocorrências](../23-fase5-parte4-ocorrencias.md) ·
[24 — PDI](../24-fase5-parte5-pdi.md) ·
[25 — tutoria](../25-fase5-parte6-tutoria.md) ·
[26 — replicabilidade](../26-fase5-parte7-replicabilidade.md)

---

## Em uma frase

Todas as telas que faltavam já têm backend. Com isso, **as 41 tabelas do banco são usadas pela API** e nenhuma
tela precisa mais falar direto com o Supabase.

---

## O que existe agora

| Tela | O que o backend faz | Quem vê / quem mexe |
|---|---|---|
| **Diário do Professor** | Atividades (colunas), lançamentos (inclusive colando do Excel) e observação por aluno | dono e gestão veem; dono e admin mexem |
| **Agenda** | Rotina da semana e exceções de um dia (mudar, cancelar, repetir até o fim do ano) | cada um na própria; a gestão vê |
| **Agenda da escola** | Eventos da escola e apoio presencial | todos veem os eventos; a gestão mantém |
| **Painel (post-its)** | Lembretes pessoais | só o dono, nem a gestão |
| **Ocorrências do notebook** | Registro com fotos | dono e gestão veem; dono e admin mexem |
| **Ocorrências escolares** | O professor envia, a gestão responde, o professor é avisado | professor vê as suas; gestão vê todas e responde |
| **Evidências do PDI** | Evidências com fotos e documentos | dono e gestão veem; dono e admin mexem |
| **Tutoria** | Tutorados, check-ins, encontros, combinados, foto e documentos | tutor e gestão veem; tutor e admin mexem |
| **Replicabilidade** | Mural de boas práticas com fotos | **todos veem**; quem publicou e o admin mexem |

## Decisões importantes tomadas na Fase 5

| Decisão | Por quê |
|---|---|
| Listas com "grava ou corrige", tudo ou nada (agenda, diário, vincular tutorados) | A tela faz hoje um pedido por célula; agora vai numa ida só, sem ficar pela metade |
| A gestão só **vê** a agenda e o diário dos professores | São do professor; a gestão age onde a tela já deixa (eventos, apoio, respostas às ocorrências) |
| Lembretes privados, até para o admin | São anotações pessoais |
| Responder uma ocorrência marca "não vista" para o professor | É o aviso que a tela mostra; antes dependia da tela lembrar |
| Datas e horas sem fuso valem como UTC | É como o Supabase gravava; os eventos antigos e novos ficam iguais |
| Arquivos sempre na pasta do dono do registro, e apagados junto com ele | O dono sempre vê; não sobram arquivos perdidos no armazenamento |
| Um só "leitor" de arquivos enviados para todos os módulos | Antes estava repetido; agora a regra de tamanho é igual em todos |

## Como sabemos que funciona

| Conferência | Comando | Resultado |
|---|---|---|
| Diário de classe | `npm run test:diario` | 44 de 44 ✅ |
| Agenda do professor | `npm run test:agenda` | 30 de 30 ✅ |
| Eventos, apoio presencial e lembretes | `npm run test:escola` | 43 de 43 ✅ |
| Ocorrências | `npm run test:ocorrencias` | 40 de 40 ✅ |
| PDI | `npm run test:pdi` | 27 de 27 ✅ |
| Tutoria | `npm run test:tutoria` | 35 de 35 ✅ |
| Replicabilidade | `npm run test:replicabilidade` | 20 de 20 ✅ |
| **Total da Fase 5** | | **239 de 239 ✅** |
| Fases anteriores, repetidas | | 805 de 805 ✅ |

A **collection do Bruno** ganhou as pastas *Diario*, *Agenda*, *Escola*, *Ocorrencias*, *PDI*, *Tutoria* e
*Replicabilidade*, todas rodadas contra a API com usuários temporários, inclusive as ações da gestão.

## Problemas encontrados e resolvidos

- **Duas checagens das próprias conferências estavam erradas** (ocorrências e PDI): as duas esqueciam que um
  registro sem data fica com a data de **hoje**. O backend estava certo; as checagens foram corrigidas.
- O pedido do Bruno de apoio presencial usaria, sem querer, **o primeiro usuário da lista** (que pode ser o admin
  real). Passou a usar variáveis próprias (`professorId`, `responsavelId`).

## Coisas para lembrar na Fase 6 (ligar as telas)

- **Agenda:** "replicar a segunda" e "até o fim do ano" viram **um** `PUT` com a lista de itens.
- **Diário:** colar do Excel vira **um** `PUT /diario/lancamentos` com todas as células.
- **Ocorrências, PDI, tutoria e replicabilidade:** os arquivos passam pelas rotas de cada módulo
  (`.../fotos`, `.../documentos`); os links continuam saindo de `/files/<bucket>/url`.
- **Tutoria:** o detalhe do tutorado vem completo em `GET /tutorados/:id`; as ocorrências do aluno, em
  `GET /ocorrencias-escolares?aluno=`.
- **Replicabilidade:** o nome de quem publicou já vem em `autor`.

## Limitações conhecidas (aceitas por enquanto)

- O tipo do arquivo é o que o navegador informa (como na Fase 3).
- Ao apagar uma **turma** ou um **usuário** inteiro, os arquivos dos registros dele ficam no armazenamento (as
  linhas somem). É raro e pode ser limpo depois.

## Pendências que dependem da equipe

1. **Confirmar o que "ajustado" significa** nas aulas (Fase 4).
2. **Fuso das datas dos eventos**: manter UTC ou mandar o de São Paulo (Fase 6).
3. **Supabase (chave e endereço)**, para os arquivos em produção.
4. **Dono de cada conta** (Neon, Render, Supabase), para colocar no ar.

## Próxima fase

**Fase 6 — Colocar no ar e ligar o frontend.**
