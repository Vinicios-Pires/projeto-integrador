# Resumo da Fase 1 — Login novo

**Período:** 29/10/2026
**Situação:** ✅ concluída
**Execuções que fizeram parte desta fase:**
[03 — entrar e trocar senha](../03-fase1-parte1-entrar-e-trocar-senha.md) ·
[04 — cadastro e papéis](../04-fase1-parte2-cadastro-e-papeis.md) ·
[05 — gestão de usuários](../05-fase1-parte3-gestao-de-usuarios.md)

---

## Em uma frase

O backend agora tem um login próprio completo: as pessoas se cadastram, o admin aprova, cada um entra com
o seu papel, e todas as próximas rotas já têm um porteiro pronto que diz quem pode fazer o quê.

---

## Ponto de partida

No fim da Fase 0, o banco estava no ar com as tabelas e o primeiro admin (com senha temporária), mas o
servidor só respondia "estou vivo". Ninguém conseguia entrar.

## O que existe agora

### Para qualquer pessoa
| Ação | Como funciona |
|---|---|
| **Cadastrar-se** | Só com e-mail `@prof.educacao.sp.gov.br`. A conta nasce **pendente**, como professor. |
| **Entrar** | E-mail e senha dão um "crachá digital" (token) que vale 8 horas. |
| **Quem sou eu** | Com o crachá, o sistema informa nome, papel e situação. É o que o app vai chamar ao abrir. |
| **Trocar a senha** | Obrigatório para quem está com senha temporária. Até trocar, o resto do sistema fica bloqueado. |

### Para o admin (e a gestão, só para ver)
| Ação | Quem |
|---|---|
| Listar usuários, filtrar pendentes, buscar | gestão e admin |
| Aprovar, inativar e reativar | só admin |
| Trocar o papel | só admin |
| Resetar a senha (gera uma temporária para repassar) | só admin |

### O porteiro (base para as próximas fases)
- **Sem login, ninguém passa.** Com login, cada rota diz qual papel pode usá-la: todos, gestão ou só admin.
- **"Gestão"** é coordenação, direção, vice-direção e admin, a mesma regra que as telas atuais já usam.
- **O admin passa em tudo.**
- **Mudanças valem na hora:** inativar alguém ou trocar o papel tem efeito no pedido seguinte, sem esperar o
  crachá vencer.

## Decisões importantes tomadas na Fase 1

| Decisão | Por quê |
|---|---|
| Crachá (token) só diz **quem** é a pessoa; o papel e a situação são conferidos no banco a cada pedido | Inativar ou trocar papel vale na hora |
| Crachá vale **8 horas** | Um dia de trabalho; ajustável na configuração |
| Mesmo formato de dados que as telas já usam (`user`, `role`, `profile`) | Facilita ligar o frontend na Fase 6 |
| **Um papel por pessoa** | É como as telas trabalham. Se houver mais de um, vale o maior |
| Senha de **8 a 72 caracteres** | 8 por segurança; 72 é o limite da criptografia (acima disso, o final seria ignorado) |
| Login **não revela** se o e-mail existe | Ninguém consegue descobrir quem tem conta na escola |
| Cadastro **avisa** e-mail repetido | A pessoa precisa saber que já tem conta; o limite de cadastros por hora evita abuso |
| **Limite de tentativas:** 10 senhas erradas em 15 min; 5 cadastros por hora (por lugar) | Contra quem chuta senhas e contra cadastros em massa. Quem acerta a senha nunca é bloqueado |
| Admin **não pode** inativar, rebaixar nem resetar a si mesmo | Sempre sobra pelo menos um admin ativo |
| Resetar senha **sem e-mail automático** | Decisão do PRD: o admin repassa a senha temporária por um canal que a escola já usa |
| Segredo do crachá, domínio permitido e limites **na configuração** | Nada disso fica escrito no código |

## Como sabemos que funciona

Três conferências automáticas, todas contra o banco real. Cada uma cria os próprios usuários de teste e os
apaga no final, sem tocar no admin.

| Conferência | Comando | Resultado |
|---|---|---|
| Login, crachá e troca de senha | `npm run test:login` | 31 de 31 ✅ |
| Cadastro, papéis e limite de tentativas | `npm run test:cadastro` | 47 de 47 ✅ |
| Gestão de usuários | `npm run test:usuarios` | 51 de 51 ✅ |
| Banco (da Fase 0, repetida) | `npm run db:check` | 13 de 13 ✅ |
| **Total** | | **142 de 142 ✅** |

Além disso, a **collection do Bruno** (`backend/bruno/`) tem todos os pedidos da fase, cada um com a sua
conferência, e cada pasta foi rodada contra a API real.

## Problemas encontrados e resolvidos

- **E-mail sem `@`** recebia a mensagem errada no cadastro ("domínio não permitido" em vez de "e-mail
  inválido"). A conferência automática pegou e foi corrigido.
- **Correção de segurança** aplicada numa biblioteca que lê os dados recebidos pelo servidor (falha conhecida),
  sem mudar nada no funcionamento.

## Coisas para lembrar na Fase 6 (colocar no ar e ligar as telas)

- **No Render, configurar `TRUST_PROXY=1`.** Sem isso, o limite de tentativas acha que todo mundo vem do mesmo
  lugar e bloqueia todos juntos.
- **Gerar um `JWT_SECRET` novo** para produção (não reaproveitar o de desenvolvimento).
- **Ajustar a tela de cadastro:** ela pede senha de 6 caracteres; o backend exige 8.
- As telas vão receber **códigos de erro fixos** (ex.: `CONTA_PENDENTE`, `SENHA_TEMPORARIA`) para decidir o que
  mostrar, e precisam de uma tela de **"trocar minha senha"**.
- "Sair" (logout) é só a tela apagar o crachá; não precisa de rota no backend.

## Limitações conhecidas (aceitas por enquanto)

- Trocar a própria senha **não desconecta** outros aparelhos onde a pessoa estava logada; eles saem quando o
  crachá vence (até 8h). Inativar ou resetar a senha pelo admin, esses sim, cortam na hora.
- A contagem do limite de tentativas fica na memória do servidor. Basta para um servidor só (plano gratuito do
  Render); com vários, precisaria de um lugar compartilhado.
- Não dá para editar nome nem excluir usuários (só inativar), porque nenhuma tela pede isso hoje.

## Pendências que dependem da equipe

1. **Região do banco:** EUA ou São Paulo. Ainda dá para trocar sem perda, porque só há o admin cadastrado.
2. **Dono de cada conta:** Neon, Render e Supabase.

## Próxima fase

**Fase 2 — Turmas, alunos e disciplinas.** É o cadastro escolar básico, e a primeira fase a usar de verdade
as regras de "cada professor mexe só no que é seu, a gestão vê tudo".
