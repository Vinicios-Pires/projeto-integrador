# Execução 05 — Fase 1, Parte 3: gestão de usuários pelo admin

**Data:** 29/10/2026
**Fase:** 1 — Login novo (cadastro, entrar, aprovação, papéis)
**Status da parte:** ✅ concluída. **Com isso, a Fase 1 inteira está concluída.**

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ **concluída** |
| **2** | **Turmas, alunos, disciplinas** | ⏭️ **próxima** |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 1

1. ✅ Entrar, "quem sou eu" e troca de senha ([execução 03](03-fase1-parte1-entrar-e-trocar-senha.md))
2. ✅ Cadastro, papéis nas rotas e limite de tentativas ([execução 04](04-fase1-parte2-cadastro-e-papeis.md))
3. ✅ **Gestão de usuários pelo admin** ← esta execução

Resumo da fase inteira: [resumo-fase-1.md](resumos/resumo-fase-1.md).

---

## O que foi feito

É a parte do backend da tela **"Gerenciar Usuários"**. Ela devolve as mesmas informações que a tela já usa hoje.

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Listar usuários** | gestão e admin | Do mais novo para o mais antigo, com nome, e-mail, situação e papel. Dá para filtrar só os **pendentes** e buscar por nome ou e-mail. |
| **Aprovar / reativar** | só admin | A conta passa a **ativa** e a pessoa já consegue entrar. |
| **Inativar** | só admin | A pessoa perde o acesso **na hora**, mesmo se estiver com o sistema aberto. |
| **Trocar o papel** | só admin | A pessoa fica com exatamente um papel. **Vale na hora**, sem precisar sair e entrar de novo. |
| **Resetar a senha** | só admin | O sistema gera uma **senha temporária** e mostra ao admin **uma única vez**, para ele repassar. No próximo acesso, a pessoa é obrigada a trocá-la. |

### Proteções

- **O admin não pode inativar, rebaixar nem resetar a si mesmo.** Assim ninguém tranca a escola para fora sem
  querer: **sempre sobra pelo menos um admin ativo**, que é quem está fazendo a ação. Para trocar a própria
  senha, o admin usa o "Trocar minha senha" normal.
- **Um admin pode rebaixar outro admin.** O rebaixado perde o acesso de admin na hora.
- **Ninguém volta a ficar "pendente".** Depois de aprovada, a conta só alterna entre ativa e inativa.
- **Resetar a senha tranca as sessões abertas.** Se a pessoa estava logada em outro aparelho, aquela sessão
  fica presa na tela de troca de senha, porque a senha antiga não vale mais. Isso é útil quando alguém
  suspeita que a senha vazou.
- Usuário inexistente ou endereço malformado recebe "Usuário não encontrado", nunca um erro interno.

## Decisões tomadas nesta parte

- **Gestão vê a lista, mas só o admin altera.** É o que o PRD define para perfis e papéis.
- **Resetar a senha sem e-mail automático.** A senha temporária aparece na tela do admin, que repassa por um canal
  que a escola já usa (grupo, e-mail direto). Foi a decisão do PRD para não contratar um serviço de e-mail agora.
- **Trocar papel é uma operação só.** Hoje a tela apaga o papel antigo e insere o novo em dois passos. Se o
  segundo falhasse, a pessoa ficaria sem papel nenhum. No backend os dois passos acontecem juntos: ou tudo dá
  certo, ou nada muda.
- **Ajuste interno no porteiro de papéis.** Ele passou a ser uma etapa só, que confere o login e o papel ao
  mesmo tempo. Isso não muda nada no comportamento (todas as conferências anteriores continuam passando), mas
  deixa as próximas rotas mais simples de escrever.

## Como foi conferido

Foi criada a conferência `npm run test:usuarios`, no mesmo estilo das anteriores. Ela cria 6 usuários de
teste (admins, coordenação, professor, pendente e um com vários papéis), testa pela API ligada ao banco
real e apaga tudo no final, sem tocar no admin.

| Conferência | Resultado |
|---|---|
| Listar (ordem, campos, filtro de pendentes, busca, quem pode ver) | 11 de 11 ✅ |
| Aprovar, inativar e reativar (efeito imediato, regras, proteções) | 15 de 15 ✅ |
| Trocar papel (efeito imediato, um papel só, quem pode) | 12 de 12 ✅ |
| Resetar senha (senha temporária, sessões presas, troca obrigatória) | 10 de 10 ✅ |
| Vários admins (um rebaixa o outro, sempre sobra um) | 3 de 3 ✅ |
| **Total da nova conferência** | **51 de 51 ✅** |

Também foram repetidas, porque o porteiro foi ajustado:

- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Usuários* rodou inteira contra a API, com um admin e uma conta
  pendente temporários: 5 de 5 ✅. Os dois foram apagados em seguida.

## Collection do Bruno

Ganhou a pasta **Usuários**:

| Pedido | O que faz |
|---|---|
| **Listar usuários** | Lista e guarda o **primeiro da lista** na variável `usuarioId`. Dá para filtrar por `status` e `busca` (aba *Params*). |
| **Aprovar ou reativar** | Ativa o usuário de `usuarioId` |
| **Inativar** | Inativa o usuário de `usuarioId` |
| **Trocar papel** | Edite o corpo para escolher o papel |
| **Resetar senha** | Mostra a senha temporária gerada |

> **Dica para testar a aprovação:** rode *Listar usuários* com `status=pendente`. A conta pendente vai para
> `usuarioId`, e aí é só rodar *Aprovar ou reativar*. Os pedidos desta pasta precisam do token de um **admin**
> (rode *Auth > Entrar* com o e-mail do admin antes).

## O que ainda NÃO existe

- **Editar o nome** de alguém (ou o próprio nome). A tela atual não faz isso e o PRD não pede agora. Fica para
  quando alguma tela precisar.
- **Excluir usuários.** Só dá para inativar, o que preserva o histórico (notas, planos etc. que a pessoa lançou).
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Fase 2)

**Turmas, alunos e disciplinas**, o cadastro escolar básico de que quase todo o resto depende. É a primeira fase
que vai usar de verdade as regras de "cada professor mexe só no que é seu, a gestão vê tudo". Antes de começar,
vale dividir a fase em partes, como foi feito com a Fase 1.
