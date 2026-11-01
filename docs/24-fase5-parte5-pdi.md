# Execução 24 — Fase 5, Parte 5: PDI (evidências)

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
4. ✅ Ocorrências ([execução 23](23-fase5-parte4-ocorrencias.md))
5. ✅ **PDI**: evidências, com fotos e documentos ← esta execução
6. ⏳ **Tutoria**: tutorados, encontros, registros, combinados e documentos
7. ⏳ **Replicabilidade** (o mural de boas práticas, com fotos), e o resumo da fase

---

## O que foi feito

É o backend da tela **"Evidências do PDI"**: o professor registra as atividades que comprovam o seu plano de
desenvolvimento (projetos, aulas práticas, jogos, experimentos…), com **fotos** e **documentos**.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver** | dono e gestão | As mais recentes primeiro, cada uma com as fotos e os documentos. Filtros: turma, matéria, bimestre, ano, tipo e professor. |
| **Registrar, editar** | dono e admin | Só o título é obrigatório. Padrões: ano letivo atual, 1º bimestre, tipo "Outro". |
| **Anexar fotos** | dono e admin | Só imagens, até 10 MB. |
| **Anexar documentos** | dono e admin | Só documentos, até 20 MB. |
| **Remover um arquivo** | dono e admin | Some do banco e do armazenamento. |
| **Excluir** | dono e admin | As fotos e os documentos saem junto, do banco **e** do armazenamento. |

### Proteções

- **Um professor não vê as evidências de outro.** A gestão vê todas, mas não altera.
- **Foto é foto e documento é documento:** um PDF não entra como foto, nem uma imagem como documento.
- Os arquivos ficam **na pasta do professor dono**, mesmo quando o admin anexa, e o documento fica no nome dele.
- Se o banco falhar depois de guardar o arquivo, o arquivo é apagado: não fica arquivo "órfão".

## Decisões tomadas nesta parte

- **As fotos e os documentos vêm junto com a evidência**, como a tela já pede hoje.
- **A foto guarda o caminho também no campo `url`**, exatamente como a tela faz hoje, para os registros novos e os
  antigos ficarem iguais.
- **Um só jeito de receber arquivos.** O "leitor" do arquivo enviado, que estava repetido nos anexos dos planos e
  nas fotos das ocorrências, virou um só, usado também aqui. As conferências daquelas partes foram repetidas por
  causa disso.

## Como foi conferido

Foi criada a conferência `npm run test:pdi`. Ela usa uma pasta temporária como armazenamento, cria 4 usuários de
teste (admin, coordenação e dois professores), turmas e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Evidências (registrar, padrões, dados errados, turma de outro, ordem, filtros, quem vê, quem altera) | 14 de 14 ✅ |
| Fotos e documentos (pasta do dono, pelo admin, guardados, vêm junto, tipo trocado recusado, quem anexa, remover, excluir leva tudo) | 13 de 13 ✅ |
| **Total da nova conferência** | **27 de 27 ✅** |

Na primeira rodada, uma checagem **da própria conferência** estava errada: a evidência sem data fica com a data de
hoje (31/10) e, por isso, aparece antes da de maio. O backend estava certo; a checagem foi corrigida.

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

- **Collection do Bruno:** a pasta nova *PDI* rodou inteira contra a API, com um professor temporário: 4 de 4 ✅.
  Tudo foi apagado em seguida, inclusive o documento.

## Collection do Bruno

Nova pasta **PDI**:

| Pedido | O que faz |
|---|---|
| **Registrar evidencia** | Na turma de `turmaId`; guarda o id em `evidenciaId` |
| **Anexar documento** | Anexa um texto como documento |
| **Listar evidencias** | As evidências, com os arquivos |
| **Excluir evidencia** | Exclui (e apaga os arquivos) |

## O que ainda NÃO existe

- Tutoria e replicabilidade (Partes 6 e 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Confirmar o significado de "ajustado"** nas aulas (Fase 4).
- **Fuso das datas dos eventos** (Parte 3).
- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 6)

**Tutoria**: os alunos tutorados de cada professor, os encontros, os registros, os combinados e os documentos.
