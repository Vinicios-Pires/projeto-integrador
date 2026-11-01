# Execução 23 — Fase 5, Parte 4: ocorrências

**Data:** 31/10/2026
**Fase:** 5 — Demais módulos
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
| **5** | **Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade)** | 🔄 **em andamento** |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 5

1. ✅ Diário de classe ([execução 20](20-fase5-parte1-diario-de-classe.md))
2. ✅ Agenda do professor ([execução 21](21-fase5-parte2-agenda-do-professor.md))
3. ✅ Eventos da escola, apoio presencial e lembretes ([execução 22](22-fase5-parte3-eventos-apoio-e-lembretes.md))
4. ✅ **Ocorrências** (do notebook e escolares), com fotos ← esta execução
5. ⏳ **PDI**: evidências, com fotos e documentos
6. ⏳ **Tutoria**: tutorados, encontros, registros, combinados e documentos
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

---

## O que foi feito

São duas telas.

### Ocorrências do notebook

É o registro do uso dos notebooks em sala: quantos foram usados, se a internet funcionou, se algum equipamento
quebrou, o que foi feito, **com fotos**.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver** | dono e gestão | As mais recentes primeiro, com a turma e as fotos junto. Filtros: turma e período. |
| **Registrar, editar** | dono e admin | Sem data, vale a de hoje. |
| **Anexar e remover fotos** | dono e admin | Pelo correio de arquivos, até 10 MB, só imagens. Ficam na pasta de quem registrou. |
| **Excluir** | dono e admin | As fotos saem junto, do banco **e** do armazenamento. |

### Ocorrências escolares

O professor relata um problema com alunos (comportamento, atraso, conflito…) e **a gestão responde**.

```
o professor envia (nova)  →  a gestão responde (em andamento / resolvida)  →  o professor vê a resposta
```

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver** | o professor, as suas; a gestão, todas | Filtros: situação, tipo, professor, período e **aluno** (parte do nome, usado pela Tutoria). |
| **Enviar** | todo usuário logado | Nasce como "nova". |
| **Corrigir** | quem registrou (ou o admin) | Só enquanto a gestão ainda não começou a tratar. |
| **Responder** | gestão | Situação e providências. Grava quem respondeu e quando. |
| **Marcar como vista** | quem registrou | A resposta da gestão aparece como "não vista" até o professor abrir. |
| **Remover** | quem registrou (ou o admin) | Como na tela. |

### Proteções

- **Um professor não vê as ocorrências de outro.** A gestão vê todas, mas só **responde**; não edita o relato.
- **Depois que a gestão começa a tratar, o relato não muda**: a resposta é sobre aquele texto.
- Fotos: só imagens, até 10 MB; nada fica gravado quando o envio é recusado.

## Decisões tomadas nesta parte

- **Responder marca como "não vista"** para o professor, que é o aviso que a tela mostra ("você tem respostas
  novas"). Hoje a tela não fazia isso ao responder; agora o backend garante.
- **Corrigir o relato só enquanto "nova"**: a tela ainda não tem esse botão, mas é útil para erros de digitação
  antes da gestão ler.
- **As fotos vêm junto com a ocorrência**, em vez de uma busca separada de todas as fotos do sistema, como a
  tela faz hoje. O link de cada foto continua saindo do correio de arquivos.
- `url` da foto continua vazio, como hoje: o bucket é privado e o link é assinado na hora de mostrar.

## Como foi conferido

Foi criada a conferência `npm run test:ocorrencias`. Ela usa uma pasta temporária como armazenamento, cria
4 usuários de teste (admin, coordenação e dois professores) e turmas, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Notebook (registrar, data de hoje, dados errados, período, quem vê e quem altera, fotos: pasta do dono, pelo admin, tipo e tamanho recusados, remover, excluir leva as fotos) | 22 de 22 ✅ |
| Escolares (enviar, dados errados, quem vê, busca por aluno, corrigir enquanto nova, responder, "não vista", travada em atendimento, marcar vista, remover, sem login) | 18 de 18 ✅ |
| **Total da nova conferência** | **40 de 40 ✅** |

A conferência pegou um erro **dela mesma** na primeira rodada: o filtro de período incluía, sem querer, a
ocorrência registrada "hoje" (31/10). O período do teste foi ajustado e a conferência passou inteira.

Também foram repetidas:

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

- **Collection do Bruno:** a pasta nova *Ocorrencias* rodou inteira contra a API, com um professor e uma
  coordenadora temporários (registrar, anexar foto, excluir; enviar, **responder pela coordenação**, marcar vista,
  remover): 7 de 7 ✅. Tudo foi apagado em seguida, inclusive a foto.

## Collection do Bruno

Nova pasta **Ocorrencias**:

| Pedido | O que faz |
|---|---|
| **Registrar ocorrencia notebook** | Na turma de `turmaId`; guarda o id em `ocorrenciaId` |
| **Anexar foto** | Anexa uma imagem; guarda o id em `fotoId` |
| **Excluir ocorrencia notebook** | Exclui (e apaga as fotos) |
| **Registrar ocorrencia escolar** | O professor envia; guarda o id em `ocorrenciaEscolarId` |
| **Responder ocorrencia** | A gestão responde (entre com um usuário da gestão) |
| **Marcar como vista** | O professor viu a resposta |
| **Remover ocorrencia escolar** | Remove |

## O que ainda NÃO existe

- PDI, tutoria e replicabilidade (Partes 5 a 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Fuso das datas dos eventos** (Parte 3).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 5)

**PDI**: as evidências do plano de desenvolvimento, com fotos e documentos.
