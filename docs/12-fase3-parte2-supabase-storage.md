# Execução 12 — Fase 3, Parte 2: ligação com o Supabase Storage

**Data:** 31/10/2026
**Fase:** 3 — "Correio de arquivos" (fotos e documentos)
**Status da parte:** ✅ concluída (o teste com o Supabase **real** depende da chave, ver pendências).
**Com isso, a Fase 3 está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ **concluída** (falta só o teste com a chave real) |
| **4** | **Notas/Provas e Planos de Aula** | ⏭️ **próxima** |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 3

1. ✅ O correio em si: enviar, link temporário e excluir, com as regras ([execução 11](11-fase3-parte1-correio-de-arquivos.md))
2. ✅ **Ligação com o Supabase Storage** ← esta execução

Resumo da fase inteira: [resumo-fase-3.md](resumos/resumo-fase-3.md).

---

## O que foi feito

O correio de arquivos da Parte 1 agora pode guardar e entregar os arquivos **no Supabase Storage**, onde os
arquivos da escola já estão hoje. Basta uma configuração no servidor (`STORAGE_DRIVER=supabase`, com o endereço
do projeto e a chave de serviço). **As rotas e as respostas não mudam**: para as telas, tanto faz se os arquivos
estão numa pasta do computador (desenvolvimento) ou no Supabase (produção).

| O quê | Como funciona com o Supabase |
|---|---|
| **Enviar** | O backend confere quem é a pessoa, o tipo e o tamanho, e só então repassa o arquivo ao Supabase. Nunca sobrescreve um arquivo que já existe. |
| **Link temporário** | O backend pede ao Supabase um link assinado. O arquivo vai **direto do Supabase para o navegador**, sem passar pelo servidor (mais rápido e mais barato). |
| **Vários links** | Uma única conversa com o Supabase para todos os arquivos, em vez de uma por arquivo. |
| **Excluir** | O backend confere quem pode e manda o Supabase apagar. |

### A chave do Supabase

Para falar com o Supabase "por cima" das regras dele, o backend usa uma **chave de serviço**, que é poderosa
(abre todos os arquivos). Por isso:

- ela fica **só na configuração do servidor**, nunca no git nem no navegador;
- **nenhuma resposta da API** a contém, nem os links entregues às telas;
- se o Supabase devolver um erro, a pessoa recebe só "Erro interno. Tente novamente." e, no log do servidor, a
  chave aparece **mascarada** (`***`), por garantia;
- o servidor **nem liga** se estiver configurado para o Supabase e faltar o endereço ou a chave.

### Arquivos antigos continuam funcionando

Os arquivos já enviados pelas telas atuais estão guardados com o mesmo formato de endereço
(`<dono>/<registro>/<arquivo>`), às vezes com espaços e acentos no nome. O backend lê esses endereços do jeito
certo, então **nada precisa ser copiado nem renomeado**.

## Decisões tomadas nesta parte

- **Falar com o Supabase direto pela API dele**, sem instalar a biblioteca oficial: são só quatro operações
  simples, e assim o backend continua leve.
- **Os links apontam para o Supabase**, como hoje, e não para o backend: o servidor gratuito do Render não precisa
  carregar fotos e documentos.
- **Conferir sem a chave real.** Como a chave ainda não foi entregue, foi feito um **"Supabase de mentira"**: um
  pequeno servidor que responde exatamente como a API de arquivos do Supabase e anota tudo o que recebe. Assim
  deu para conferir o que o backend manda (chave, tipo, endereço, validade dos links) e como ele reage a falhas.
  O que **não** dá para garantir sem o Supabase real: detalhes que só ele tem (por exemplo, um limite de tamanho
  configurado no painel dele). Por isso o teste real fica como pendência.

## Como foi conferido

Foi criada a conferência `npm run test:supabase-storage`, que sobe o Supabase de mentira, liga o backend nele,
cria 3 usuários de teste e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Enviar (chega no lugar certo, com a chave, sem sobrescrever; nada é enviado sem login ou com tipo errado; falha do Supabase vira erro genérico; chave mascarada no log) | 9 de 9 ✅ |
| Links (apontam para o Supabase, validade certa, baixar com nome, **arquivos antigos com acento**, vários numa ida só, quem não pode nem chega ao Supabase) | 12 de 12 ✅ |
| Excluir (dono, admin, vários de uma vez) | 4 de 4 ✅ |
| A chave nunca vaza (em nenhuma resposta nem link) | 2 de 2 ✅ |
| **Total da nova conferência** | **27 de 27 ✅** |

A conferência da Parte 1 (`npm run test:arquivos`) foi repetida porque a forma de pedir links mudou por dentro
(agora sempre "em lote"): 51 de 51 ✅.

Também foram repetidas:

- **Conferência da grade e do ano letivo** (`npm run test:calendario`): 47 de 47 ✅
- **Conferência das eletivas** (`npm run test:membros`): 32 de 32 ✅
- **Conferência das matérias** (`npm run test:disciplinas`): 61 de 61 ✅
- **Conferência dos alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Conferência das turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅

## Collection do Bruno

Nenhum pedido novo: as rotas são as mesmas da Parte 1 (pasta **Arquivos**). Com o servidor configurado para o
Supabase, os mesmos pedidos passam a usar o Supabase.

## O que ainda NÃO existe

- O **teste contra o Supabase real** (falta a chave).
- Os módulos que usam arquivos (Fases 4 e 5).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Chave de serviço e endereço do Supabase** (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, em
  *Project Settings > API*). Com eles no `.env`, basta trocar `STORAGE_DRIVER` para `supabase` e rodar a pasta
  *Arquivos* do Bruno para o teste real. Falta decidir também **qual projeto** guarda os arquivos (o atual, que
  já tem os 7 buckets e os arquivos de hoje, é o caminho natural) e **quem tem acesso** a ele.
- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Fase 4)

**Notas, provas e planos de aula.** É a primeira fase com regras de negócio de verdade: tipos de avaliação, notas
por bimestre, médias, provas com gabarito e correção, e o **fluxo de aprovação de planos de aula pela gestão** (o
padrão E do planejamento). Antes de começar, a fase será dividida em partes.
