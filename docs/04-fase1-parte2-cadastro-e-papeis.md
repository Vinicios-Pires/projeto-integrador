# Execução 04 — Fase 1, Parte 2: cadastro, papéis e limite de tentativas

**Data:** 29/10/2026
**Fase:** 1 — Login novo (cadastro, entrar, aprovação, papéis)
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| **1** | **Login novo (cadastro, entrar, aprovação, papéis)** | 🟡 **em andamento (parte 2 de 3 feita)** |
| 2 | Turmas, alunos, disciplinas | ⏳ a fazer |
| 3 | "Correio de arquivos" (fotos e documentos) | ⏳ a fazer |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 1

1. ✅ Entrar, "quem sou eu" e troca de senha ([execução 03](03-fase1-parte1-entrar-e-trocar-senha.md))
2. ✅ **Cadastro, papéis nas rotas e limite de tentativas** ← esta execução
3. ⏳ Gerenciar usuários pelo admin: listar, aprovar/inativar, trocar papel e resetar senha

---

## O que foi feito

### 1. Cadastro de novos usuários (`POST /auth/signup`)

A pessoa informa **nome, e-mail e senha**, os mesmos campos da tela de cadastro atual.

- **Só e-mails `@prof.educacao.sp.gov.br`.** Também são recusados os "parecidos", como
  `@educacao.sp.gov.br`, `@x.prof.educacao.sp.gov.br` e `@prof.educacao.sp.gov.br.outro.com`.
- A conta **nasce pendente, como professor**, e **não recebe crachá (token)**: só consegue entrar depois que
  o admin aprovar (Parte 3). Quem tentar entrar antes vê "Seu cadastro ainda está aguardando aprovação".
- **Não dá para "se promover" no cadastro.** Mesmo que alguém mande `"status": "ativo"` ou `"role": "admin"`
  junto, o sistema ignora: a conta continua pendente e professor.
- **Senha de 8 a 72 caracteres.** O mínimo de 8 vale também para a troca de senha (Parte 1). O máximo de 72 é
  o limite da criptografia usada: acima disso, o final da senha seria ignorado sem ninguém perceber.
- **E-mail repetido** recebe "Este e-mail já está cadastrado. Tente entrar."
- O nome é limpo (espaços sobrando são tirados) e o e-mail é salvo em minúsculas.

### 2. Porteiro de papéis

Agora dá para dizer, em cada rota das próximas fases, **quem pode usá-la**:

| Grupo | Quem faz parte |
|---|---|
| **Gestão** | coordenação, direção, vice-direção **e admin** (a mesma regra que as telas atuais já usam) |
| **Admin** | só o admin, que **sempre passa** em qualquer rota, porque tem acesso total |

Quem não tem o papel certo recebe "Você não tem permissão para fazer isso". Quem nem fez login recebe
"Faça login para continuar". Essas duas respostas são diferentes de propósito, para a tela saber se deve
mandar a pessoa para o login ou só avisar.

### 3. Limite de tentativas

| Onde | Regra | Por quê |
|---|---|---|
| **Entrar** | 10 senhas **erradas** em 15 minutos, do mesmo lugar (IP) | Impede alguém de ficar chutando senhas. **Quem acerta nunca é bloqueado.** |
| **Cadastrar** | 5 cadastros por hora, do mesmo lugar | Impede a criação de contas em massa |

Depois de bloqueado, nem a senha certa entra até o tempo passar. Assim quem está chutando não descobre se
acertou. Os números ficam na configuração (`.env`) e podem ser ajustados.

## Decisões tomadas nesta parte

- **Senha mínima de 8, não 6.** A tela atual de cadastro pede 6. Ficou 8 para combinar com a troca de senha.
  **A tela vai precisar ser ajustada na Fase 6.**
- **O cadastro avisa quando o e-mail já existe.** No login, a resposta é sempre a mesma para não revelar quem
  tem conta. No cadastro isso não dá, porque a pessoa precisa saber que já tem conta. O limite de 5 cadastros
  por hora deixa caro usar isso para "varrer" e-mails.
- **Admin passa em tudo.** Segue o PRD ("admin: acesso total") e evita ter que lembrar de incluir o admin em
  cada rota.
- **Domínio na configuração** (`ALLOWED_EMAIL_DOMAIN`), não escrito no código.
- **Contagem do limite fica na memória do servidor.** Basta para um servidor só, como o plano gratuito do
  Render. Se um dia houver vários servidores, essa contagem precisa ir para um lugar compartilhado.
- **No Render, ligar `TRUST_PROXY=1`.** Lá os pedidos chegam por um intermediário. Sem essa configuração, o
  sistema acharia que todos vêm do mesmo lugar e bloquearia todo mundo junto. Isso fica anotado para a Fase 6.

## Problema encontrado e resolvido

A conferência automática pegou um erro: um e-mail **sem `@`** recebia a mensagem "domínio não permitido", em
vez de "e-mail inválido". Foi corrigido antes de terminar a parte.

## Como foi conferido

Foi criada uma nova conferência automática, `npm run test:cadastro`, no mesmo estilo da `test:login`. Ela
cria usuários de teste de todos os papéis, testa pela API ligada ao banco real e apaga tudo no final, sem
tocar no admin. Para testar os limites sem esperar 15 minutos, ela usa limites baixos e simula pedidos de
lugares diferentes.

| Conferência | Resultado |
|---|---|
| Cadastro (aceito, pendente, sem token, dados limpos, repetido, tentativa de se promover) | 12 de 12 ✅ |
| E-mails recusados (outros domínios, domínios disfarçados, e-mails malformados) | 8 de 8 ✅ |
| Regras de senha e nome, e nada gravado quando o cadastro é recusado | 7 de 7 ✅ |
| Papéis: cada papel entra só onde pode, admin passa em tudo, senha temporária barrada | 14 de 14 ✅ |
| Limite de tentativas (login e cadastro) | 6 de 6 ✅ |
| **Total da nova conferência** | **47 de 47 ✅** |

Também foram repetidas:

- **Conferência do login** (`npm run test:login`), para garantir que nada da Parte 1 quebrou: 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** o novo pedido *Cadastrar* foi rodado no servidor real. A conta foi criada como
  pendente e o login dela foi barrado com "aguardando aprovação" ✅. O teste foi apagado em seguida.

## Collection do Bruno

Ganhou o pedido **Auth > Cadastrar**, que agora é o primeiro da pasta Auth. Para usar, preencha no ambiente
**Local** as variáveis `cadastroNome` e `cadastroEmail` e a variável secreta `cadastroSenha`. O pedido
**Entrar** também passou a explicar o bloqueio por excesso de tentativas.

> Lembrete: a conta criada pelo Bruno fica **pendente** e não entra até a Parte 3, quando o admin vai poder
> aprovar.

## O que ainda NÃO existe

- **O admin ainda não consegue aprovar ninguém pelo sistema.** Isso vem na Parte 3.
- Nenhuma rota de verdade usa o porteiro de papéis ainda. Ele foi testado com rotas de exemplo e começa a ser
  usado na Parte 3 (rotas do admin) e na Fase 2.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Execução 05 — Fase 1, Parte 3)

**Gerenciar usuários pelo admin**, a parte do backend da tela "Gerenciar Usuários":

- listar usuários (com filtro de pendentes), o que a gestão pode **ver**;
- aprovar, inativar e reativar (só admin);
- trocar o papel (só admin);
- **resetar a senha** de alguém: gera uma senha temporária para o admin repassar, como o PRD decidiu (sem
  e-mail automático).

Com isso, a Fase 1 fica completa.
