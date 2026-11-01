# Execução 17 — Fase 4, Parte 5: planejamento bimestral

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
5. ✅ **Planejamento bimestral**, com a validação pela gestão ← esta execução
6. ⏳ **Planos de aula**: cadastrar, duplicar, ajustes
7. ⏳ **Aprovação dos planos pela gestão e anexos dos planos**, e o resumo da fase

---

## O que foi feito

O **planejamento bimestral** é a "capa" da planilha de aulas que o professor monta para uma turma, matéria e
bimestre. Ele passa por três situações:

```
rascunho  →  aguardando validação  →  validado
```

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Ver os planejamentos** | dono e gestão | Do ano mais recente para o mais antigo. Filtros: bimestre, ano, turma, matéria e professor. |
| **Abrir um planejamento** | todo usuário logado, nas próprias turmas e matérias | Se já existe um para a mesma turma, matéria, bimestre e ano, **abre o mesmo**; senão cria um rascunho. |
| **Enviar para validação** | dono (ou admin) | Só do rascunho. |
| **Validar** | gestão | Do rascunho ou de "aguardando". Grava **quem validou e quando**, e a observação. |
| **Solicitar ajustes** | gestão | De "aguardando" volta para rascunho, com a observação para o professor. |
| **Reabrir** | gestão | De validado volta para rascunho. Limpa quem validou e quando. |
| **Excluir** | dono e admin | Só se não estiver validado. As aulas continuam existindo, fora do planejamento. |

### Proteções

- **O professor não valida o próprio planejamento**, e a gestão não envia no lugar dele.
- **As mudanças seguem a ordem certa:** não dá, por exemplo, para enviar de novo o que já foi enviado, nem para
  voltar um validado para "aguardando". A mensagem diz de onde para onde não dá.
- **Validado não pode ser excluído:** a gestão precisa reabrir antes.
- **Não existe planejamento repetido**, nem quando ele não tem matéria. No banco, linhas sem matéria não
  "batem" umas com as outras, e por isso o backend procura antes de criar.
- Um professor **não vê os planejamentos de outro**, nem filtrando pelo nome dele.

## Decisões tomadas nesta parte

- **Uma só rota para mudar a situação** (`status`), com uma tabela fixa de quem pode o quê, que é a mesma lógica
  dos botões da tela. Assim cada regra fica num lugar só.
- **"Abrir" em vez de "criar":** a tela já procurava um planejamento existente antes de criar; agora o backend
  faz isso numa ida só.
- **Quem validou é sempre quem está logado** (não vem da tela), e a hora é a do servidor.
- **A planilha travada depois de validada** (as aulas não podem mudar) fica para a Parte 6, junto com as aulas.

## Como foi conferido

Foi criada a conferência `npm run test:planejamentos`. Ela cria 5 usuários de teste (admin, coordenação,
direção e dois professores), turmas e matérias, testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Abrir (rascunho no ano atual, nome da turma e matéria, não duplica, nem sem matéria, dados errados, turma/matéria de outro) | 12 de 12 ✅ |
| Ver (os próprios, filtros, outro professor, gestão vê todos, ordem, abrir um) | 11 de 11 ✅ |
| Validação (quem pode cada mudança, ordem certa, pedir ajustes, validar com quem e quando, reabrir, validar direto, admin) | 17 de 17 ✅ |
| Excluir (quem pode, validado não sai, as aulas continuam) | 5 de 5 ✅ |
| **Total da nova conferência** | **45 de 45 ✅** |

Também foram repetidas (valem para esta parte e para a [Parte 4](16-fase4-parte4-correcao-de-provas.md)):

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
- **Collection do Bruno:** a pasta nova *Planejamento* rodou contra a API com um professor e uma coordenadora
  temporários (abrir, listar, excluir, abrir de novo, enviar e validar pela coordenação): 6 de 6 ✅. Tudo foi
  apagado em seguida.

## Collection do Bruno

Nova pasta **Planejamento**:

| Pedido | O que faz |
|---|---|
| **Abrir planejamento** | Abre (ou cria) o planejamento da turma de `turmaId` e matéria de `disciplinaId`, 1º bimestre; guarda o id em `planejamentoId` |
| **Listar planejamentos** | Lista os planejamentos |
| **Enviar para validacao** | O professor envia para a gestão |
| **Validar planejamento** | A gestão valida (entre com um usuário da gestão) |
| **Excluir planejamento** | Exclui (só se não estiver validado) |

> **Dica:** rode antes *Turmas > Criar turma* e *Materias > Criar materia*.

## O que ainda NÃO existe

- **As aulas da planilha** (Parte 6): cadastrar, editar, duplicar, os ajustes, e a trava depois de validado.
- Aprovação dos planos de aula e anexos (Parte 7).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Supabase (chave e endereço):** deixado para depois.
- Continua em aberto: **quem é dono de cada conta** (Neon, Render, Supabase).

## Próximo passo (Parte 6)

**Planos de aula**: cadastrar, editar, duplicar e excluir aulas (soltas ou dentro do planejamento), os ajustes
de cada plano, e a trava da planilha depois de validada.
