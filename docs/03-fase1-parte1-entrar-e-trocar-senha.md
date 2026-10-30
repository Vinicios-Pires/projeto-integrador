# Execução 03 — Fase 1, Parte 1: entrar, "quem sou eu" e troca de senha

**Data:** 29/10/2026
**Fase:** 1 — Login novo (cadastro, entrar, aprovação, papéis)
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| **1** | **Login novo (cadastro, entrar, aprovação, papéis)** | 🟡 **em andamento (parte 1 de 3 feita)** |
| 2 | Turmas, alunos, disciplinas | ⏳ a fazer |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### A Fase 1 foi dividida em 3 partes

1. ✅ **Entrar, "quem sou eu" e troca de senha** ← esta execução
2. ⏳ Cadastro de novos usuários (só e-mail institucional, entra como "pendente") e checagem de papéis
   (professor, gestão, admin) nas rotas
3. ⏳ Tela do admin por trás: listar usuários, aprovar/inativar, trocar papel e resetar senha

> **Por que a troca de senha entrou já na Parte 1?** O administrador foi criado com uma senha temporária.
> Sem a troca, ele conseguiria entrar mas não poderia fazer mais nada, e o login não teria utilidade.

---

## O que foi feito

O backend agora tem três "portas":

| Porta | Para que serve |
|---|---|
| **Entrar** (`POST /auth/login`) | A pessoa manda e-mail e senha e recebe um **"crachá digital" (token)**, que vale por 8 horas. |
| **Quem sou eu** (`GET /me`) | Com o crachá, o sistema diz quem é a pessoa, qual o papel dela e se precisa trocar a senha. É o que o app vai chamar toda vez que abrir. |
| **Trocar minha senha** (`POST /auth/change-password`) | A pessoa informa a senha atual e a nova. |

E um **"porteiro"** que vai proteger todas as rotas das próximas fases: sem crachá válido, ninguém passa.

### Como o login se comporta

- **E-mail ou senha errados:** "E-mail ou senha incorretos." A mensagem é **a mesma** quando o e-mail não
  existe, para que ninguém consiga descobrir quem tem conta na escola.
- **Cadastro ainda não aprovado:** "Seu cadastro ainda está aguardando aprovação."
- **Conta inativa:** "Sua conta está inativa. Procure a administração."
- **Senha temporária:** a pessoa entra, mas **só consegue trocar a senha**. Todo o resto fica bloqueado até a troca.
- **Nova senha:** precisa ter pelo menos 8 caracteres e ser diferente da atual.
- Maiúsculas e espaços sobrando no e-mail não atrapalham.

Cada erro tem também um **código fixo** (ex.: `CONTA_PENDENTE`), que as telas vão usar na Fase 6 para
decidir o que mostrar, por exemplo a tela de "aguardando aprovação".

## Decisões tomadas nesta parte

- **O crachá só diz "quem é", não "o que pode".** A cada pedido o sistema confere no banco se a pessoa
  continua ativa e qual o papel dela. Assim, **inativar alguém corta o acesso na hora**, sem esperar o crachá
  vencer.
- **Crachá vale 8 horas** (um dia de trabalho). Dá para mudar na configuração (`JWT_EXPIRES_IN`).
- **Um papel por pessoa nas telas.** As telas atuais trabalham com um só papel. Se alguém tiver mais de um no
  banco, vale o de maior permissão (admin > direção > vice-direção > coordenação > professor).
- **Mesmo formato que as telas já usam.** A resposta de "quem sou eu" traz `user`, `role` e `profile` com os
  mesmos nomes do sistema anterior, o que facilita ligar o frontend depois.
- **Segredo do crachá na configuração** (`JWT_SECRET` no `.env`), gerado aleatoriamente e fora do código.
  Trocar esse segredo desconecta todo mundo, o que pode ser útil numa emergência.
- **Correção de segurança numa biblioteca.** Foi aplicada uma atualização no componente que lê os dados
  recebidos pelo servidor (havia uma falha conhecida). Não mudou nada no funcionamento.

## Como foi conferido

Foi criada uma **conferência automática do login** (`npm run test:login`). Ela cria 5 usuários de teste
temporários (ativo, pendente, inativo, com senha temporária e com vários papéis), testa tudo pela API de
verdade, ligada ao banco real, e **apaga os usuários de teste no final**. O administrador não é tocado.

| Conferência | Resultado |
|---|---|
| Entrar (certo, errado, e-mail inexistente, pendente, inativo, dados faltando ou malformados) | 12 de 12 ✅ |
| "Quem sou eu" (com crachá, sem crachá, crachá inventado, falsificado, vencido) | 6 de 6 ✅ |
| Senha temporária bloqueia o sistema e a troca de senha libera (com as regras da senha nova) | 11 de 11 ✅ |
| Inativar a conta corta o acesso na hora | ✅ |
| Rota inexistente responde "não encontrado" | ✅ |
| **Total** | **31 de 31 ✅** |

Também foram conferidos:

- **Banco** (`npm run db:check`): 13 de 13 ✅. Nada mudou na estrutura, e o admin continua com a troca de
  senha pendente.
- **Checagem de tipos do código:** sem erros ✅.
- **Servidor real ligado:** respondeu "ok" no `/health`, recusou a senha errada do admin e recusou o
  "quem sou eu" sem crachá ✅.

## O que ainda NÃO existe

- **Cadastro de novos usuários** e **checagem de papel nas rotas** (Parte 2).
- **Gerenciar usuários pelo admin** (aprovar, inativar, trocar papel, resetar senha). Isso é a Parte 3.
  Por enquanto, a única conta que entra é a do admin.
- **"Sair" (logout)** não precisa de rota no backend: basta a tela apagar o crachá. Isso entra na Fase 6.
- **Limite de tentativas de login** (proteção contra quem fica chutando senhas): anotado para a Parte 2.
- Trocar a senha **não desconecta** outros aparelhos onde a pessoa já estava logada; eles continuam até o
  crachá vencer (no máximo 8h). Inativar a conta, essa sim, corta na hora. Pode ser melhorado depois, se a
  equipe achar necessário.
- Nenhuma tela foi alterada.

## Para a equipe testar o primeiro acesso do admin

1. `npm run dev` dentro de `backend/`.
2. Entrar com `admin@prof.educacao.sp.gov.br` e a senha temporária (a que foi mostrada uma única vez na
   Fase 0). A resposta vai trazer `"deve_trocar_senha": true`.
3. Trocar a senha em `POST /auth/change-password`, usando o crachá recebido.

> Se a senha temporária do admin foi perdida, dá para gerar uma nova: apagar o usuário admin no banco e rodar
> `npm run seed` de novo, que cria outro e mostra a senha nova uma vez.

## Collection do Bruno (para testar à mão)

Foi criada uma **collection do Bruno** (programa parecido com o Insomnia) em `backend/bruno/`, com as
requisições desta parte: **Health**, **Entrar**, **Quem sou eu** e **Trocar senha**.

- Abra no Bruno com *Open Collection*, apontando para a pasta `backend/bruno`.
- Escolha o ambiente **Local** e preencha a variável secreta `senha`.
- Rode **Entrar**: o token é guardado sozinho, e as outras requisições já usam ele.
- Ao **Trocar senha** com sucesso, a variável `senha` passa a ser a nova automaticamente.
- Senhas e token ficam **só no seu Bruno**, nunca no git.

Cada requisição tem uma conferência própria e uma explicação dos erros possíveis (aba *Docs*). Ela foi
testada inteira pelo terminal com um usuário temporário: **4 de 4 ✅**. A collection vai ganhando
requisições a cada parte.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase). Detalhes no [resumo da Fase 0](resumos/resumo-fase-0.md).

## Próximo passo (Execução 04 — Fase 1, Parte 2)

**Cadastro de novos usuários:** só e-mails `@prof.educacao.sp.gov.br`, a conta nasce como **pendente** e com
papel de professor, aguardando o admin aprovar. Junto vem o **porteiro de papéis**, que permite dizer em cada
rota "só gestão" ou "só admin", e o **limite de tentativas** no login e no cadastro.
