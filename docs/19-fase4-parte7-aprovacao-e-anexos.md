# Execução 19 — Fase 4, Parte 7: aprovação dos planos e anexos

**Data:** 31/10/2026
**Fase:** 4 — Notas/Provas e Planos de Aula
**Status da parte:** ✅ concluída
**Com isso, a Fase 4 está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (o teste com o Supabase real fica para depois) |
| 4 | Notas/Provas e Planos de Aula | ✅ **concluída** |
| **5** | **Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade)** | ⏭️ **próxima** |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 4

1. ✅ Avaliações e notas ([execução 13](13-fase4-parte1-avaliacoes-e-notas.md))
2. ✅ Médias arredondadas ([execução 14](14-fase4-parte2-medias-arredondadas.md))
3. ✅ Provas e gabaritos ([execução 15](15-fase4-parte3-provas-e-gabaritos.md))
4. ✅ Correção de provas ([execução 16](16-fase4-parte4-correcao-de-provas.md))
5. ✅ Planejamento bimestral ([execução 17](17-fase4-parte5-planejamento-bimestral.md))
6. ✅ Planos de aula ([execução 18](18-fase4-parte6-planos-de-aula.md))
7. ✅ **Aprovação dos planos pela gestão e anexos dos planos** ← esta execução

Resumo da fase inteira: [resumo-fase-4.md](resumos/resumo-fase-4.md).

---

## O que foi feito

### Aprovação de cada aula pela gestão

Além da validação do planejamento inteiro (Parte 5), cada aula tem a sua própria situação, que aparece na Agenda
e no painel da gestão: **pendente**, **aprovado** ou **ajustado** (devolvida com pedido de ajuste).

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Aprovar** | gestão | Uma ou várias aulas de uma vez, com um comentário. Grava quem aprovou e quando. |
| **Devolver para ajuste** (`ajustado`) | gestão | Com o comentário do que precisa mudar. |
| **Voltar a pendente** | gestão | Limpa quem aprovou e quando. |

- **Quando o professor edita uma aula aprovada ou devolvida, ela volta a pendente sozinha**: a aprovação era do
  conteúdo anterior. O comentário da gestão fica, para o professor ler.
- O professor **não aprova nem a própria aula**.
- Aprovar **não depende da planilha estar aberta**: aprovar não muda o conteúdo da aula.

### Anexos das aulas

Cada aula tem duas colunas de anexos na planilha: **documento** (material da aula) e **adaptada** (atividade
adaptada). Os arquivos passam pelo **correio de arquivos** da Fase 3.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver os anexos** | dono e gestão | Por aula, e por tipo. Para abrir, o link temporário do correio de arquivos. |
| **Anexar** | dono e admin | Documentos e imagens, até 20 MB. |
| **Apagar** | dono e admin | Some do banco **e** do armazenamento. |

- O arquivo fica **na pasta do professor dono da aula**, mesmo quando o admin anexa: assim o professor continua
  vendo.
- **Excluir a aula apaga também os arquivos dos anexos** (antes, ficariam perdidos no armazenamento).
- **Planilha validada não recebe nem perde anexos**, igual às aulas.
- Se o banco falhar depois de guardar o arquivo, o arquivo é apagado: não fica arquivo "órfão".

## Decisões tomadas nesta parte

- **"Ajustado" = devolvida para ajuste pela gestão.** A tela atual só mostra essa situação, sem dizer quem a
  coloca. Faz sentido como o par de "aprovado" (o mesmo que "solicitar ajustes" no planejamento). **Vale a equipe
  confirmar.**
- **Uma só rota de aprovação, que recebe uma lista**: serve para uma aula ou para aprovar a semana inteira.
- **Editar volta a pendente**, para a gestão nunca ver "aprovado" num conteúdo que não leu.
- **Anexar é uma rota do plano**, e não do correio direto: assim o backend confere a aula, a trava e o dono, e
  grava a linha e o arquivo juntos.

## Como foi conferido

Foi criada a conferência `npm run test:aprovacao`. Ela usa uma pasta temporária como armazenamento e cria
5 usuários de teste (admin, coordenação, vice-direção e dois professores), turma, planejamento e aulas. Testa
pela API e apaga tudo no final, inclusive a pasta.

| Conferência | Resultado |
|---|---|
| Aprovação (aprovar várias, quem e quando, devolver, professor não aprova, dados errados, tudo ou nada, filtro do painel, editar volta a pendente, copiar para baixo também, voltar a pendente, planilha validada) | 14 de 14 ✅ |
| Anexos (anexar, tamanho, pasta do dono, pelo admin, listar por tipo, quem vê, abrir pelo link, tipo e tamanho recusados, quem anexa, trava da planilha, apagar com o arquivo, excluir a aula leva os arquivos) | 23 de 23 ✅ |
| **Total da nova conferência** | **37 de 37 ✅** |

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

- **Collection do Bruno:** a pasta *Planos de aula* rodou inteira contra a API, já com os pedidos novos, com um
  professor e uma coordenadora temporários (adicionar, listar, editar, duplicar, ajuste, **aprovar pela
  coordenação**, anexar, listar anexos, excluir anexo, excluir aula): 10 de 10 ✅. Tudo foi apagado em seguida.

## Collection do Bruno

A pasta **Planos de aula** ganhou:

| Pedido | O que faz |
|---|---|
| **Aprovar aulas** | A gestão aprova a aula de `planoId` (entre com um usuário da gestão) |
| **Anexar arquivo** | Anexa um texto como documento; guarda o id em `anexoId` |
| **Listar anexos** | Os anexos da aula |
| **Excluir anexo** | Apaga o anexo de `anexoId` |

*Excluir aula* passou para o fim da pasta.

## O que ainda NÃO existe

- A Fase 5: Diário, Agenda, Ocorrências, PDI, Tutoria e Replicabilidade.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (decisão acima).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Fase 5)

**Demais módulos**: Diário de classe, Agenda, Ocorrências, PDI, Tutoria e Replicabilidade. Antes de começar, a
fase será dividida em partes.
