# Execução 11 — Fase 3, Parte 1: o correio de arquivos

**Data:** 31/10/2026
**Fase:** 3 — "Correio de arquivos" (fotos e documentos)
**Status da parte:** ✅ concluída

---

## Onde estamos no roteiro

| Fase | O que é | Situação |
|---|---|---|
| 0 | Preparar o banco de dados novo | ✅ concluída |
| 1 | Login novo (cadastro, entrar, aprovação, papéis) | ✅ concluída |
| 2 | Turmas, alunos, disciplinas | ✅ concluída |
| **3** | **"Correio de arquivos" (fotos e documentos)** | 🔄 **em andamento** |
| 4 | Notas/Provas e Planos de Aula | ⏳ a fazer |
| 5 | Demais módulos (Diário, Agenda, Ocorrências, PDI, Tutoria, Replicabilidade) | ⏳ a fazer |
| 6 | Colocar no ar e ligar o frontend | ⏳ a fazer |

### Partes da Fase 3

1. ✅ **O correio em si:** enviar, gerar link temporário e excluir, com as regras de quem pode, guardando os
   arquivos numa pasta do computador (para desenvolvimento e testes) ← esta execução
2. ⏳ **Ligação com o Supabase Storage**, onde os arquivos ficam de verdade, e o resumo da fase

---

## Por que esta fase existe

Hoje, quando alguém anexa uma foto numa ocorrência ou um documento num PDI, **o navegador manda o arquivo direto
para o Supabase**, usando o login do Supabase. Na Fase 6, esse login deixa de existir, e esses envios parariam de
funcionar. Por isso, todo arquivo passa a ir **pelo backend**: ele confere quem é a pessoa e se ela pode, e só
então guarda, entrega ou apaga o arquivo. O navegador nunca mais fala direto com o lugar onde os arquivos ficam.

## O que foi feito

Um "correio" único, que serve os 7 tipos de arquivo do sistema (fotos de ocorrências, anexos de planos de aula,
fotos e documentos do PDI, fotos da replicabilidade, fotos e documentos da tutoria).

| O quê | Quem pode | Como funciona |
|---|---|---|
| **Enviar um arquivo** | todo usuário logado | O arquivo vai sempre para a **pasta da própria pessoa**, dentro da pasta do registro (a ocorrência, o plano…). O backend devolve o "endereço" do arquivo, que a tela grava no banco, como já faz hoje. |
| **Gerar um link temporário** | o dono e a gestão (no mural de replicabilidade, todos) | Um link que abre o arquivo **sem precisar de login, até vencer** (padrão: 1 hora). É o mesmo esquema que o Supabase usa hoje. Dá para pedir o link "para baixar", com o nome original. |
| **Vários links de uma vez** | idem | Para telas que mostram várias fotos (ocorrências, tutoria, mural). Até 200 por vez. |
| **Excluir** | o dono e o admin | Um ou vários de uma vez. |

### Proteções

- **Ninguém guarda arquivo na pasta de outra pessoa.** Hoje é a tela que monta o endereço; agora é o backend,
  sempre começando pelo id de quem está enviando.
- **Quem não pode abrir um arquivo nem fica sabendo que ele existe** ("Arquivo não encontrado").
- **Só os tipos que cada tela aceita:** fotos só como imagem (jpeg, png, webp, gif, heic); documentos só como
  pdf, Word, Excel, PowerPoint, OpenDocument, texto ou csv. Isso impede, por exemplo, alguém enviar uma página
  da web disfarçada de foto.
- **Limite de tamanho:** 10 MB para fotos e 20 MB para documentos. O login é conferido **antes** de receber o
  arquivo, então ninguém sem login consegue ocupar o servidor mandando arquivos grandes.
- **Nomes de arquivo "perigosos" são limpos** (ex.: `../../segredo.png`), e endereços com truques para sair da
  pasta são recusados. Acentos e espaços viram letras simples no endereço; o nome original volta na resposta.
- **Links não podem ser falsificados nem reaproveitados depois de vencer**, e o link de um arquivo apagado para de
  funcionar na hora.
- **Excluir vários é tudo ou nada:** se um dos arquivos não for de quem pediu, nenhum é apagado.

## Decisões tomadas nesta parte

- **O arquivo vai "puro" no envio**, sem formulário em volta: a tela manda o arquivo do jeito que ele é, com o
  tipo dele. É o jeito mais simples de enviar pelo navegador e não exigiu nenhuma ferramenta nova no backend.
  (O planejamento falava em formulário com anexo; o efeito é o mesmo.)
- **O backend monta o endereço do arquivo**, e não mais a tela. O formato continua o mesmo de hoje
  (`<dono>/<registro>/<arquivo>`), então as regras e os arquivos que já existem no Supabase continuam valendo.
- **Para desenvolvimento e testes, os arquivos ficam numa pasta do computador** (`.storage`, fora do git), com
  links temporários gerados pelo próprio backend. Em produção, a Parte 2 liga o mesmo correio ao Supabase
  Storage. **As telas não vão perceber a diferença:** as rotas são as mesmas.
- **Gestão vê todos os arquivos, mas não apaga**, e o admin apaga, igual às regras atuais do Supabase.
- **Mural de replicabilidade:** as fotos abrem para qualquer usuário logado, porque o mural é público dentro da
  escola (padrão D do planejamento).
- **Apagar o arquivo junto com o registro** (ex.: excluir uma ocorrência leva as fotos) vai ser feito pelo
  backend em cada módulo, nas Fases 4 e 5. Hoje é a tela que faz isso, e às vezes esquece.

## Como foi conferido

Foi criada a conferência `npm run test:arquivos`. Ela usa uma **pasta temporária** para os arquivos, cria 4
usuários de teste (admin, coordenação e dois professores), testa pela API e apaga tudo no final.

| Conferência | Resultado |
|---|---|
| Enviar (pasta do dono, nome seguro, tipos recusados, tamanho por tipo de arquivo, pasta inválida, sem login) | 18 de 18 ✅ |
| Links temporários (abre sem login, tipo certo, baixar com nome, quem pode, caminhos com truque, link falsificado, link vencido) | 18 de 18 ✅ |
| Vários links de uma vez | 5 de 5 ✅ |
| Excluir (quem pode, arquivo sai, link antigo para, vários de uma vez, tudo ou nada) | 10 de 10 ✅ |
| **Total da nova conferência** | **51 de 51 ✅** |

Na primeira rodada, **1 checagem falhou**: o nome `../../../segredo.png` virava `_.._.._segredo.png`. Ele não saía
da pasta, mas ficava com `..` no meio do nome. A limpeza de nomes foi ajustada para juntar pontos repetidos, e a
checagem passou.

Também foram repetidas:

- **Conferência da grade e do ano letivo** (`npm run test:calendario`): 47 de 47 ✅
- **Conferência das eletivas** (`npm run test:membros`): 32 de 32 ✅
- **Conferência das matérias** (`npm run test:disciplinas`): 61 de 61 ✅
- **Conferência dos alunos** (`npm run test:alunos`): 65 de 65 ✅
- **Conferência das turmas** (`npm run test:turmas`): 55 de 55 ✅
- **Conferência da gestão de usuários** (`npm run test:usuarios`): 51 de 51 ✅
- **Conferência do cadastro e papéis** (`npm run test:cadastro`): 47 de 47 ✅
- **Conferência do login** (`npm run test:login`): 31 de 31 ✅
- **Conferência do banco** (`npm run db:check`): 13 de 13 ✅
- **Checagem de tipos do código:** sem erros ✅
- **Collection do Bruno:** a pasta nova *Arquivos* rodou inteira contra a API (com o armazenamento local), com um professor temporário: 4 de 4 ✅. O arquivo de teste foi apagado pela própria pasta, e o professor em seguida.

## Collection do Bruno

Ganhou a pasta **Arquivos**:

| Pedido | O que faz |
|---|---|
| **Enviar arquivo** | Envia um arquivo de texto de exemplo para os documentos do PDI e guarda o endereço em `arquivoPath` |
| **Link do arquivo** | Gera um link de 5 minutos para o arquivo de `arquivoPath` (copie e abra no navegador) |
| **Varios links** | Gera links para uma lista de arquivos |
| **Excluir arquivo** | Exclui o arquivo de `arquivoPath` |

## O que ainda NÃO existe

- **Guardar no Supabase Storage** (Parte 2). Por enquanto, os arquivos ficam numa pasta do computador onde a API
  roda.
- Os módulos que usam arquivos (planos, ocorrências, PDI, tutoria, replicabilidade) chegam nas Fases 4 e 5.
- Nenhuma tela foi alterada.

## Pendências que dependem da equipe

- **Nova:** para a Parte 2 funcionar de verdade, o backend precisa da **chave de serviço do Supabase**
  (`service_role`) e do endereço do projeto. É uma chave secreta: vai só no `.env` do servidor, nunca no git nem
  no navegador. Falta decidir **qual projeto do Supabase** guarda os arquivos (o atual, que já tem os 7 buckets,
  ou um novo) e **quem tem acesso** a ele.
- Continuam em aberto: a **região do banco** (EUA ou São Paulo) e **quem é dono de cada conta** (Neon, Render,
  Supabase).

## Próximo passo (Parte 2)

**Ligação com o Supabase Storage.** O mesmo correio passa a guardar e entregar os arquivos no Supabase,
escolhido por uma configuração. Como ainda não há a chave, a ligação será conferida contra um "Supabase de
mentira" que imita as respostas do verdadeiro. O teste real fica para quando a equipe entregar a chave.
