# Execução 26 — Fase 5, Parte 7: replicabilidade (o mural de boas práticas)

**Data:** 31/10/2026
**Fase:** 5 — Demais módulos
**Status da parte:** ✅ concluída
**Com isso, a Fase 5 está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| 3 | "Correio de arquivos" (fotos e documentos) | ✅ concluída (o teste com o Supabase real fica para depois) |
| 4 | Notas/Provas e Planos de Aula | ✅ concluída |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ✅ **concluída** |
| **6** | **Colocar no ar e ligar o frontend** | ⏭️ **próxima** |

### Partes da Fase 5

1. ✅ Diário de classe ([execução 20](20-fase5-parte1-diario-de-classe.md))
2. ✅ Agenda do professor ([execução 21](21-fase5-parte2-agenda-do-professor.md))
3. ✅ Eventos da escola, apoio presencial e lembretes ([execução 22](22-fase5-parte3-eventos-apoio-e-lembretes.md))
4. ✅ Ocorrências ([execução 23](23-fase5-parte4-ocorrencias.md))
5. ✅ PDI ([execução 24](24-fase5-parte5-pdi.md))
6. ✅ Tutoria ([execução 25](25-fase5-parte6-tutoria.md))
7. ✅ **Replicabilidade**, e o resumo da fase ← esta execução

Resumo da fase inteira: [resumo-fase-5.md](resumos/resumo-fase-5.md).

---

## O que foi feito

É o backend da tela **"Replicabilidade"**: um mural em que os professores compartilham boas práticas com fotos,
para os colegas repetirem. É o único módulo **aberto a todos** (o "padrão D").

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver o mural** | todo usuário logado | As publicações mais novas primeiro, com as fotos em ordem e o nome de quem publicou. |
| **Publicar** | professores e admin | Título e descrição. A gestão só vê, como na tela. |
| **Editar, excluir** | quem publicou e o admin | Excluir leva as fotos, do banco e do armazenamento. |
| **Fotos** | quem publicou e o admin anexam e removem; todos abrem | Até 10 MB, só imagens; entram no fim da ordem. |

### Proteções

- **Todos veem, mas só quem publicou mexe.** Por isso, quem tenta alterar a publicação de outra pessoa recebe
  "sem permissão" (e não "não encontrado", como nos módulos privados).
- As fotos ficam na pasta de quem publicou, e o correio de arquivos deixa **qualquer usuário logado** abri-las
  (a regra do mural, já preparada na Fase 3).

## Decisões tomadas nesta parte

- **O nome de quem publicou vem junto** (`autor`), em vez de a tela buscar os perfis à parte.
- **A gestão não publica**, mantendo o que a tela já faz (para ela, o mural é só leitura). O admin publica.

## Como foi conferido

Foi criada a conferência `npm run test:replicabilidade`. Ela usa uma pasta temporária como armazenamento, cria
4 usuários de teste (admin, coordenação e dois professores), testa pela API e apaga tudo no final. Como o mural
mostra tudo, as checagens olham só para as publicações do teste.

| Conferência | Resultado |
|---|---|
| Publicações (publicar com o autor, sem título, gestão não publica, admin publica, todos veem, abrir, quem altera) | 12 de 12 ✅ |
| Fotos (em ordem, na pasta de quem publicou, outro professor abre, tipo recusado, quem anexa, remover, excluir leva as fotos) | 8 de 8 ✅ |
| **Total da nova conferência** | **20 de 20 ✅** |

Também foram repetidas:

- **Replicabilidade** (`npm run test:replicabilidade`): 20 de 20 ✅
- **Tutoria** (`npm run test:tutoria`): 35 de 35 ✅
- **PDI** (`npm run test:pdi`): 27 de 27 ✅
- **Ocorrências** (`npm run test:ocorrencias`): 40 de 40 ✅
- **Eventos, apoio presencial e lembretes** (`npm run test:escola`): 43 de 43 ✅
- **Agenda do professor** (`npm run test:agenda`): 30 de 30 ✅
- **Diário de classe** (`npm run test:diario`): 44 de 44 ✅
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

- **Collection do Bruno:** a pasta nova *Replicabilidade* rodou inteira contra a API, com um professor temporário:
  4 de 4 ✅. Tudo foi apagado em seguida, inclusive a foto.

## Collection do Bruno

Nova pasta **Replicabilidade**:

| Pedido | O que faz |
|---|---|
| **Publicar** | Publica no mural; guarda o id em `replicabilidadeId` |
| **Anexar foto** | Anexa uma imagem |
| **Ver mural** | O mural inteiro |
| **Excluir publicacao** | Exclui (e apaga as fotos) |

## O que ainda NÃO existe

- **A Fase 6**: colocar o backend no ar e ligar as telas a ele.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Fuso das datas dos eventos** (Fase 5, Parte 3).
- **Supabase (chave e endereço):** necessário na Fase 6 para os arquivos em produção.
- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Fase 6, para colocar no ar.

## Próximo passo (Fase 6)

**Colocar no ar e ligar o frontend**. Antes de começar, a fase será dividida em partes.
