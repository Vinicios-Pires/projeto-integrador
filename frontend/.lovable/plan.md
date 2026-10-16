
Vou entregar em 4 frentes, sem apagar funcionalidades nem dados existentes.

## 1) Design (visual only)
- Atualizar tokens em `src/index.css` com a paleta solicitada:
  - primary `#2563EB`, primary-light `#DBEAFE`, primary-dark `#1E3A8A`
  - success `#22C55E`, warning `#FACC15`, destructive `#EF4444`
  - background `#F8FAFC`, card `#FFFFFF`
- Refinar componentes shadcn já existentes (Button, Card, Input, Table, Sidebar) usando apenas tokens semânticos.
- Polir Dashboard, Login e Sidebar (cabeçalhos, espaçamentos, sombras suaves, cantos arredondados consistentes).
- Sem mudar lógica.

## 2) Replicabilidade
- Já existe a página, tabelas (`replicabilidades`, `replicabilidade_fotos`) e bucket. Vou:
  - Garantir formulário enxuto: título, descrição, fotos.
  - Cards visuais com foto principal + título + resumo.
  - Permissões: professor edita só os próprios; gestão visualiza tudo; admin total.
- Estabilizar criação (sem “sumir”) — já refatorado em turnos anteriores; faço uma revisão final.

## 3) Acessos / Administrador
- Atualizar a tela **Gerenciar Usuários**:
  - busca por e-mail
  - alterar perfil (professor, coordenacao, vice_direcao, direcao, administrador)
  - ativar/inativar
- Promover o e-mail pessoal do usuário a `administrador` via tool de dados (`insert`) — preciso que você me informe **qual é o e-mail** que deve ser administrador.
- Garantir que o login de professora fique apenas como `professor`.
- RLS: professor não vê dados de outros professores; gestão vê tudo sem editar; admin total. Ajusto policies onde estiver faltando.

## 4) Tutoria (novo módulo)
Nova aba no menu lateral → `/tutoria`.

### Banco (migration nova)
- `tutorados` (id, user_id [tutor], aluno_id nullable, nome, turma, numero_chamada, status, observacoes, created_at)
- `tutoria_checkins` (id, tutorado_id, user_id, humor: bem|mais_ou_menos|dificil|observar, observacao, created_at)
- `tutoria_registros` (id, tutorado_id, user_id, data, como_esta, observacao, combinado, proxima_acao, created_at)
- `tutoria_combinados` (id, tutorado_id, user_id, descricao, data, status: pendente|em_andamento|concluido)
- GRANTs + RLS em todas:
  - professor: CRUD apenas em `user_id = auth.uid()`
  - gestão (coordenacao/vice_direcao/direcao): SELECT em tudo
  - admin (`has_role(uid,'administrador')`): ALL

### Telas
- `src/pages/Tutoria.tsx` — dashboard (cards de resumo) + grid de tutorados em cards (nome, turma, status, último check-in, botão "Abrir tutoria"). Botão "+ Novo tutorado" e "Importar CSV/Excel".
- `src/pages/TutoriaAluno.tsx` — perfil do tutorado:
  - Check-in rápido (4 botões com emoji/cor) + observação
  - "+ Registrar tutoria" (data auto, como está, observação, combinado, próxima ação, com sugestões pré-definidas)
  - Lista de combinados com status + imprimir/baixar
  - Notas/desempenho do aluno (consulta tabelas existentes se houver; caso contrário placeholder elegante até confirmar fonte de dados)
  - Botão "Gerar relatório de tutoria" → PDF (jsPDF) com nome, turma, registros, check-ins, combinados, evolução
- Importação CSV/Excel via SheetJS (já comum) ou parser CSV simples.

### Permissões UI
- Reaproveitar `usePermissions`. Professor só vê seus tutorados; gestão tem filtro por professor/turma somente leitura; admin total.

## Perguntas antes de começar
1. **Qual e-mail** deve virar administrador? (preciso para promover via SQL)
2. Para "notas/desempenho do tutorado" e "Prova Paulista": uso as tabelas que já existem no projeto (vou inspecionar) ou começo só com a estrutura visual até você confirmar a origem dos dados?

Posso seguir com o restante em paralelo (design + replicabilidade + tela de usuários + estrutura Tutoria) enquanto você responde essas duas. Confirma?
