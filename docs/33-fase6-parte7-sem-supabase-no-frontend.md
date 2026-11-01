# Execução 33 — Fase 6, Parte 7: o frontend sem o Supabase, pronto para ir ao ar

**Data:** 01/11/2026
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
| **6** | **Colocar no ar e ligar o frontend** | 🔄 **em andamento** (falta só a Parte 8) |

### Partes da Fase 6

1. ✅ O "fio" entre as telas e o backend, e as telas de login ([execução 27](27-fase6-parte1-login-no-frontend.md))
2. ✅ Turmas, alunos, matérias e eletivas ([execução 28](28-fase6-parte2-turmas-alunos-materias.md))
3. ✅ Notas, provas e correção ([execução 29](29-fase6-parte3-notas-e-provas.md))
4. ✅ Planejamento e planos de aula ([execução 30](30-fase6-parte4-plano-de-aula.md))
5. ✅ Diário, agenda e painéis ([execução 31](31-fase6-parte5-diario-agenda-paineis.md))
6. ✅ Ocorrências, PDI, tutoria e replicabilidade ([execução 32](32-fase6-parte6-ocorrencias-pdi-tutoria-mural.md))
7. ✅ **Tirar o Supabase do frontend** e deixar tudo pronto para colocar no ar ← esta execução
8. ⏳ **Colocar no ar** (Render e Neon), o que depende das contas da equipe

---

## O que foi feito

### 1. O Supabase saiu do frontend

Como o PRD pedia, o frontend **não fala mais com o Supabase de jeito nenhum**:

| O que saiu | Detalhe |
|---|---|
| A biblioteca `@supabase/supabase-js` | Removida do `package.json` e do `bun.lock` (só as linhas dela e das partes dela; o resto do arquivo ficou igual) |
| O cliente e os tipos gerados | `src/integrations/supabase/` e `src/lib/supabase.ts` |
| As variáveis `VITE_SUPABASE_*` | Tiradas do `.env` do frontend; ficou só `VITE_API_URL` |

O site gerado (`dist/`) não tem mais nenhuma menção ao Supabase. O Supabase continua existindo **só para guardar
os arquivos**, e quem fala com ele é o backend, com a chave secreta que nunca vai para o navegador.

### 2. Pronto para ir ao ar: o `render.yaml`

Foi criado o arquivo `render.yaml` na raiz do repositório. Com ele, o Render cria os dois serviços de uma vez
("Blueprint"):

| Serviço | O que é |
|---|---|
| `painelescolar-api` | O backend. Ao subir, aplica as atualizações do banco e confere a própria saúde em `/health` |
| `painelescolar-web` | As telas (site estático). Qualquer endereço abre o sistema, como o React Router espera |

**Nenhuma senha ou chave está no arquivo.** Os valores secretos (banco do Neon, chave do Supabase, endereços) são
pedidos pelo Render na criação, e o segredo do login (`JWT_SECRET`) é gerado pelo próprio Render. Os dois
serviços ficam na região de **Virgínia**, a mesma do banco no Neon.

O build de produção do backend (`npm run build`) e do frontend (`vite build`) foram conferidos nesta máquina.

## Decisões tomadas nesta parte

- **O `bun.lock` foi atualizado pelo próprio `bun`** (rodado só para isso, sem instalar nada na máquina), para não
  editar o arquivo à mão. Ele mudou só nas linhas do Supabase. O `bun` não gravou o campo `"configVersion": 1`,
  que o Lovable usa; ele foi devolvido.
- **A pasta `frontend/supabase/` (configuração e migrações do projeto antigo) ficou.** Ela é do Lovable e guarda o
  histórico do banco antigo; o sistema não usa mais, mas apagá-la pode afetar a ligação do projeto com o Lovable.
  A equipe decide se apaga.
- **Plano gratuito do Render**: como ele não tem a etapa de "antes de subir", as atualizações do banco rodam ao
  iniciar a API (é rápido quando não há nada novo).

## Como foi conferido

- **Checagem de tipos e build do frontend, sem o Supabase:** sem erros ✅
- **Busca por "supabase" no código e no site gerado:** só sobra um comentário no cliente da API ✅
- **Build de produção do backend:** gera `dist/server.js` ✅
- **Todas as conferências de tela, de novo, já sem o Supabase** (as telas inteiras funcionando só com o backend):

- **Telas de login no navegador** (`npm run test:tela-login`): 35 de 35 ✅
- **Telas de turmas, alunos e matérias no navegador** (`npm run test:tela-cadastros`): 37 de 37 ✅
- **Telas de notas e provas no navegador** (`npm run test:tela-notas`): 24 de 24 ✅
- **Tela de plano de aula no navegador** (`npm run test:tela-planos`): 20 de 20 ✅
- **Telas de diário, agenda e painéis no navegador** (`npm run test:tela-diario-agenda`): 15 de 15 ✅
- **Telas de ocorrências, PDI, tutoria e replicabilidade no navegador** (`npm run test:tela-ocorrencias-pdi`): 13 de 13 ✅

- **Regressão completa do backend** (feita ao fim da Parte 6, com o mesmo código):

- **Replicabilidade** (`npm run test:replicabilidade`): 20 de 20 ✅
- **Tutoria** (`npm run test:tutoria`): 35 de 35 ✅
- **PDI** (`npm run test:pdi`): 27 de 27 ✅
- **Ocorrências** (`npm run test:ocorrencias`): 41 de 41 ✅
- **Eventos, apoio presencial e lembretes** (`npm run test:escola`): 44 de 44 ✅
- **Agenda do professor** (`npm run test:agenda`): 30 de 30 ✅
- **Diário de classe** (`npm run test:diario`): 44 de 44 ✅
- **Aprovação e anexos** (`npm run test:aprovacao`): 37 de 37 ✅
- **Planos de aula** (`npm run test:planos`): 59 de 59 ✅
- **Planejamento bimestral** (`npm run test:planejamentos`): 46 de 46 ✅
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

- **Collection do Bruno:** nenhuma rota nova nesta parte.

## O que ainda NÃO existe

- **Nada foi colocado no ar.** Isso é a Parte 8.

## Pendências que dependem da equipe (para a Parte 8)

- **Quem é dono de cada conta** (Render, Neon, Supabase) e acesso ao Render para criar o Blueprint.
- **Supabase (endereço e chave de serviço)**, para os arquivos em produção. Antes de ir ao ar, rodar uma vez o
  `npm run test:supabase-storage` contra o Supabase real.
- **Decidir sobre a pasta `frontend/supabase/`** (manter como histórico ou apagar).
- **Avisar a equipe** das mudanças de uso: "esqueci minha senha" agora é com o administrador; turma com alunos não
  é excluída direto; só a gestão exclui alunos.
- Continuam em aberto: o significado de **"ajustado"** nas aulas e o **fuso das datas dos eventos**.

## Próximo passo (Parte 8)

**Colocar no ar**: criar os serviços no Render com o `render.yaml`, preencher as variáveis, ligar o site à API
(`CORS_ORIGINS` e `VITE_API_URL`) e conferir o sistema no endereço real.
