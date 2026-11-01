# Execução 28 — Fase 6, Parte 2: turmas, alunos e matérias ligadas ao backend

**Data:** 31/10/2026
**Fase:** 6 — Colocar no ar e ligar o frontend
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
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ✅ concluída |
| **6** | **Colocar no ar e ligar o frontend** | 🔄 **em andamento** |

### Partes da Fase 6

1. ✅ O "fio" entre as telas e o backend, e as telas de login ([execução 27](27-fase6-parte1-login-no-frontend.md))
2. ✅ **Turmas, alunos, matérias e eletivas** ← esta execução
3. ⏳ **Notas, provas e correção** (Notas, Correção de Provas, Prova Paulista)
4. ⏳ **Planejamento e planos de aula** (com aprovação e anexos)
5. ⏳ **Diário, agenda e painéis** (Diário, Agenda, painel do professor e da gestão, lembretes, relatórios)
6. ⏳ **Ocorrências, PDI, tutoria e replicabilidade**
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

As três telas de cadastro básico deixaram de falar com o Supabase e passaram a usar o backend. Por fora,
elas continuam iguais: mesmos botões, mesmos formulários. O que muda é **por onde os dados passam**, e algumas
regras que agora são garantidas pelo backend.

| Tela | O que mudou para quem usa |
|---|---|
| **Turmas** | Lista, cria, edita e exclui pelo backend. **Turma com alunos não pode ser excluída**: aparece o aviso "Não foi possível excluir" (antes, a tela avisava que os alunos seriam apagados junto). |
| **Eletivas** (turmas personalizadas) | Formar a eletiva e escolher os alunos agora é **um pedido só** ao backend (antes eram vários). A contagem de alunos já vem pronta. |
| **Alunos** | Lista, cria e edita pelo backend. **Só a gestão exclui aluno**; o professor recebe um aviso e pode marcar o aluno como inativo. |
| **Importar planilha de alunos** | O arquivo é lido na tela e **enviado de uma vez** ao backend, que confere as turmas, cria as que faltam e evita repetidos. Ou entra tudo, ou nada (antes, uma falha no meio deixava a importação pela metade). |
| **Matérias** | Cria, edita e exclui pelo backend; **vincular a matéria às turmas** é um pedido só. |

Toda falha agora aparece com a **mensagem do backend** (antes, várias telas não avisavam nada quando algo dava
errado).

### Um defeito antigo corrigido

Ao abrir **"Gerenciar"** numa eletiva do **Ensino Fundamental**, a tela voltava para "Ensino Médio" e os alunos
já escolhidos **sumiam da lista** (continuavam gravados, mas não dava para vê-los nem desmarcá-los). A causa era
pequena: a eletiva guarda o nível como série, e a tela não reconhecia esse valor ao reabrir. Foi corrigido.
Esse defeito não tinha relação com o Supabase; a conferência nova o encontrou.

## Decisões tomadas nesta parte

- **Excluir turma com alunos agora é recusado**, como combinado na Fase 2: os alunos precisam ser movidos ou
  excluídos antes. A mensagem de confirmação da tela foi ajustada para dizer isso.
- **A importação usa a regra do backend**: o formato da turma é o da planilha modelo (`7°A`, `7A`, `7º A`).
- **A lista de professores** (que a gestão usa em algumas telas) não precisou de nada novo: a gestão já tem a
  lista de usuários do backend. Cada tela vai usá-la quando for trocada.
- **Nada mudou no backend** nesta parte: todas as rotas já existiam desde a Fase 2.

## Como foi conferido

Foi criada a conferência `npm run test:tela-cadastros`, num navegador de verdade, como a da Parte 1. Ela cria um
professor e uma coordenadora de teste, uma turma com uma aluna, e então usa as telas como uma pessoa usaria,
conferindo cada passo também no banco. No final, apaga tudo (inclusive a turma criada pela importação).

| Conferência | Resultado |
|---|---|
| Turmas (lista com contagem, criar, editar, turma com alunos não sai, turma vazia sai) | 10 de 10 ✅ |
| Eletivas (formar com um aluno, gravada, contagem no cartão, aluno já marcado ao gerenciar, desmarcar) | 6 de 6 ✅ |
| Alunos (lista, criar com a série da turma, professor não exclui, importar planilha: linha boa, turma criada, linha ruim de fora) | 9 de 9 ✅ |
| Alunos pela gestão (a coordenação exclui) | 2 de 2 ✅ |
| Matérias (criar, vincular a turma, aparece ao recarregar, editar, excluir com os vínculos) | 9 de 9 ✅ |
| A gestão vê as matérias em modo somente leitura | 1 de 1 ✅ |
| **Total da nova conferência** | **37 de 37 ✅** |

Nas primeiras rodadas, as falhas foram **da própria conferência**, não das telas: a lista de alunos da eletiva
filtra pelo nível (e a aluna de teste é do 7º ano), a planilha usava um formato de turma que o modelo não usa, e
uma checagem olhava a tela antes de ela terminar de carregar. Uma delas revelou o defeito antigo da eletiva,
corrigido acima.

Também foram repetidas:

- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅ (com a base comum das conferências de
  tela, criada nesta parte)
- **Conferências do backend:** o código do backend não mudou nesta parte; a rodada completa feita ao fim da
  Parte 1 (todas as conferências, banco e tipos) vale para o mesmo código. Ver a [execução 27](27-fase6-parte1-login-no-frontend.md).
- **Checagem de tipos e build do frontend:** sem erros ✅
- **Lint do frontend nas telas alteradas:** menos avisos do que antes (Turmas de 17 para 5, Matérias de 7 para 6,
  Alunos de 1 para 0); nenhum novo.
- **Collection do Bruno:** nenhuma rota nova nesta parte.

## O que ainda NÃO existe

- As telas das Partes 3 a 6 ainda falam com o Supabase.
- O frontend ainda tem o `@supabase/supabase-js` (sai na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção.
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).
- **Avisar a equipe** que turma com alunos não pode mais ser excluída direto, e que só a gestão exclui alunos.

## Próximo passo (Parte 3)

**Notas, provas e correção**: as telas de Notas (com as médias arredondadas), Correção de Provas e Prova Paulista.
