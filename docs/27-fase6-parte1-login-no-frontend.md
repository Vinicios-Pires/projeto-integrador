# Execução 27 — Fase 6, Parte 1: as telas de login ligadas ao backend

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

Até a Fase 5, o trabalho foi todo no backend. Agora as **telas** (o frontend) deixam de falar com o
Supabase e passam a falar com o backend novo. São cerca de 28 arquivos; cada parte troca um grupo de telas.

1. ✅ **O "fio" entre as telas e o backend, e as telas de login** ← esta execução
2. ⏳ **Turmas, alunos, matérias e eletivas**
3. ⏳ **Notas, provas e correção** (Notas, Correção de Provas, Prova Paulista)
4. ⏳ **Planejamento e planos de aula** (com aprovação e anexos)
5. ⏳ **Diário, agenda e painéis** (Diário, Agenda, painel do professor e da gestão, lembretes, relatórios)
6. ⏳ **Ocorrências, PDI, tutoria e replicabilidade**
7. ⏳ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

### 1. O "fio" entre as telas e o backend

Foi criado no frontend um **cliente da API** (`src/lib/api.ts`): o único lugar por onde as telas falam com o
backend. Ele:

- manda o **login** junto em cada pedido;
- mostra as **mensagens de erro do backend**, que já vêm em português ("E-mail ou senha incorretos.");
- quando o login **vence** ou a conta é **inativada**, apaga o login guardado e volta para a tela de entrar;
- sem internet, avisa: "Não foi possível falar com o servidor".

O endereço do backend fica numa configuração (`VITE_API_URL`), para trocar facilmente quando ele for para o ar.

### 2. A "liberação" no backend (CORS)

Por segurança, o navegador só deixa uma página falar com um servidor em outro endereço se o servidor
autorizar. O backend agora **autoriza só o endereço do frontend** (configurável em `CORS_ORIGINS`).
Qualquer outro site é barrado pelo próprio navegador.

### 3. As telas de login

| Tela | Como era (Supabase) | Como ficou (backend) |
|---|---|---|
| **Entrar** | Login do Supabase | Login do backend. Mensagens claras: senha errada, cadastro aguardando aprovação, conta desativada. |
| **Criar conta** | Mandava e-mail de confirmação | Cria a conta direto, **aguardando aprovação** do administrador. Senha com no mínimo 8 caracteres (era 6). |
| **Esqueci minha senha** | Mandava um link por e-mail | O sistema não envia e-mails: a tela explica como **pedir uma senha temporária ao administrador**. |
| **Senha temporária** | (não existia) | Quem entra com a senha temporária **é obrigado a criar uma senha nova** antes de ver o sistema. |
| **Trocar senha** | Só pelo link do e-mail | Novo botão em **Configurações > Minha conta**, pedindo a senha atual. |
| **Gerenciar Usuários** (admin) | Lia e alterava as tabelas direto | Usa as rotas do backend. Novo botão **"Resetar senha"**, que mostra a senha temporária **uma única vez**, com botão de copiar. |

O resto do sistema continua igual por enquanto: as outras telas ainda usam o Supabase até as próximas partes.
Os menus, permissões e o visual não mudaram.

## Decisões tomadas nesta parte

- **"Esqueci minha senha" sem e-mail**: o backend não manda e-mails (não há serviço de e-mail contratado).
  O caminho é o admin gerar uma senha temporária, o que já existia no backend desde a Fase 1 e agora tem botão.
- **Senha com no mínimo 8 caracteres**, igual à regra do backend (a tela antiga aceitava 6).
- **O login fica guardado no navegador** (como era com o Supabase): recarregar a página não desloga. Vale por
  8 horas (configuração `JWT_EXPIRES_IN` do backend).
- **Sem lockfile novo no frontend**: o frontend usa o `bun.lock` (ligado ao Lovable); as dependências foram
  instaladas sem criar outro arquivo de travamento.

## Como foi conferido

Foi criada a conferência `npm run test:tela-login`, a primeira que usa um **navegador de verdade**. Ela cria
usuários de teste (admin, professor e um pendente), liga o backend e o frontend em portas livres, abre o
Chromium, clica nas telas como uma pessoa faria e confere também no banco. No final, apaga tudo.

| Conferência | Resultado |
|---|---|
| Liberação do navegador (o frontend é aceito; outro site não, nem na consulta prévia) | 3 de 3 ✅ |
| Entrar (sem login vai para a tela de entrar, senha errada, conta pendente, login certo, nome no menu, recarregar mantém, sair, login vencido) | 12 de 12 ✅ |
| Criar conta (domínio errado, senha curta, cadastro certo, conta pendente no banco) | 4 de 4 ✅ |
| Gerenciar usuários (vê o cadastro novo, pendente, ativar, ativo no banco, resetar senha, senha temporária na tela) | 6 de 6 ✅ |
| Senha temporária (troca obrigatória, painel escondido, senha errada, confirmação diferente, troca certa, liberada no banco) | 6 de 6 ✅ |
| Trocar senha por Configurações e "esqueci minha senha" | 4 de 4 ✅ |
| **Total da nova conferência** | **35 de 35 ✅** |

Na primeira rodada, duas checagens **da própria conferência** estavam erradas: ela procurava a linha do usuário
num pedaço grande demais da tela, e o botão "Ativar" se confundia com "Inativar". As telas estavam certas; a
conferência foi corrigida.

Também foram repetidas (a liberação do navegador vale para todas as rotas):

- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅
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

- **Checagem de tipos e build do frontend:** sem erros ✅
- **Collection do Bruno:** nenhuma rota nova nesta parte (a liberação do navegador não é uma rota), então não há
  pedido novo.

## O que ainda NÃO existe

- As outras telas (Partes 2 a 6) ainda falam com o Supabase. Enquanto isso, ao entrar pelo backend, essas
  telas aparecem **vazias**: os dados delas só voltam quando cada uma for trocada.
- O frontend ainda tem o `@supabase/supabase-js` (sai na Parte 7).
- Nada foi colocado no ar.

## Pendências que dependem da equipe

- **Quem é dono de cada conta** (Neon, Render, Supabase): necessário na Parte 8.
- **Supabase (chave e endereço):** necessário para os arquivos em produção.
- **Confirmar o significado de "ajustado"** nas aulas (Fase 4) e o **fuso das datas dos eventos** (Fase 5).
- **Avisar a equipe** que "esqueci minha senha" agora é com o administrador (sem e-mail).

## Próximo passo (Parte 2)

**Turmas, alunos, matérias e eletivas**: as telas de cadastro básico, que quase todas as outras usam.
