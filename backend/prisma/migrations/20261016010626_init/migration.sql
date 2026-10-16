-- CreateEnum
CREATE TYPE "app_role" AS ENUM ('professor', 'coordenador', 'direcao', 'vice_direcao', 'admin');

-- CreateEnum
CREATE TYPE "tipo_bloco_horario" AS ENUM ('aula', 'intervalo', 'almoco', 'planejamento', 'atpc', 'reuniao', 'outro');

-- CreateEnum
CREATE TYPE "tipo_evento_escola" AS ENUM ('reuniao', 'formacao', 'evento', 'avaliacao_externa', 'conselho', 'apoio_presencial', 'acompanhamento', 'observacao', 'visita', 'aviso');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "app_role" NOT NULL DEFAULT 'professor',

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT 'Manhã',
    "ano_letivo" INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
    "capacidade" INTEGER DEFAULT 35,
    "observacoes" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'regular',
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID,
    "nome" TEXT NOT NULL,
    "numero_chamada" INTEGER,
    "serie" TEXT,
    "data_nascimento" DATE,
    "email" TEXT,
    "telefone" TEXT,
    "responsavel" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "professor" TEXT,
    "carga_horaria" INTEGER,
    "cor" TEXT DEFAULT 'azul',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma_disciplinas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turma_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turma_membros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turma_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ano_letivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ano" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ano_letivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_grade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ordem" INTEGER NOT NULL,
    "rotulo" TEXT NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "tipo" "tipo_bloco_horario" NOT NULL DEFAULT 'aula',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horario_grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_avaliacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "peso" DECIMAL(5,2) DEFAULT 1.0,
    "bimestre" INTEGER DEFAULT 1,
    "disciplina_id" UUID,
    "turma_id" UUID,
    "ordem" INTEGER DEFAULT 0,
    "categoria" TEXT NOT NULL DEFAULT 'normal',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aluno_id" UUID,
    "tipo_avaliacao_id" UUID,
    "nota" DECIMAL(5,2),
    "bimestre" INTEGER DEFAULT 1,
    "observacoes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medias_arredondadas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID NOT NULL,
    "bimestre" INTEGER NOT NULL,
    "nota_arredondada" DECIMAL NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medias_arredondadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID,
    "disciplina_id" UUID,
    "bimestre" INTEGER DEFAULT 1,
    "titulo" TEXT NOT NULL,
    "numero_questoes" INTEGER NOT NULL DEFAULT 10,
    "data_aplicacao" DATE,
    "observacoes" TEXT,
    "valor_total" DECIMAL DEFAULT 10,
    "escola" TEXT,
    "professor" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gabaritos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prova_id" UUID,
    "numero_questao" INTEGER NOT NULL,
    "resposta_correta" TEXT NOT NULL,
    "peso" DECIMAL(5,2) DEFAULT 1.0,
    "anulada" BOOLEAN DEFAULT false,

    CONSTRAINT "gabaritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_prova" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prova_id" UUID,
    "aluno_id" UUID,
    "respostas" JSONB,
    "acertos" INTEGER,
    "nota" DECIMAL(5,2),
    "ajuste_manual" BOOLEAN DEFAULT false,
    "observacoes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_prova_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planejamentos_bimestrais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "bimestre" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "validado_por" UUID,
    "validado_em" TIMESTAMPTZ(6),
    "observacao_validacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planejamentos_bimestrais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_aula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID,
    "disciplina_id" UUID,
    "bimestre" INTEGER NOT NULL DEFAULT 1,
    "data_aula" DATE NOT NULL,
    "dia_semana" TEXT,
    "numero_aulas" INTEGER DEFAULT 1,
    "aprendizagem_essencial" TEXT,
    "conteudo" TEXT,
    "objetivos" TEXT,
    "recursos" TEXT,
    "desenvolvimento" TEXT,
    "material_digital" TEXT,
    "avaliacao_aprendizagem" TEXT,
    "aulas_previstas" INTEGER,
    "professor" TEXT,
    "duplicado_de" UUID,
    "tipo" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "aprovado_por" TEXT,
    "data_aprovacao" TIMESTAMPTZ(6),
    "comentario_aprovacao" TEXT,
    "habilidades" TEXT,
    "objetivo_geral" TEXT,
    "user_id" UUID NOT NULL,
    "planejamento_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_plano" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plano_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_anexos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plano_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" BIGINT,
    "tipo" TEXT NOT NULL DEFAULT 'documento',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_atividades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "bimestre" INTEGER NOT NULL DEFAULT 1,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'nota',
    "data" DATE,
    "peso" DECIMAL DEFAULT 1,
    "observacao" TEXT,
    "ordem" INTEGER DEFAULT 0,
    "categoria" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_lancamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "atividade_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "valor" TEXT,
    "fez" BOOLEAN,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_observacoes_aluno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "bimestre" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_observacoes_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_professor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "horario_grade_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "turma_id" UUID,
    "atividade" TEXT,
    "cor" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_excecoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "horario_grade_id" UUID NOT NULL,
    "disciplina_id" UUID,
    "turma_id" UUID,
    "atividade" TEXT,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_excecoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_escola_eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "criado_por" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "tipo_evento_escola" NOT NULL DEFAULT 'aviso',
    "data_inicio" TIMESTAMPTZ(6) NOT NULL,
    "data_fim" TIMESTAMPTZ(6),
    "dia_todo" BOOLEAN NOT NULL DEFAULT false,
    "cor" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_escola_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apoio_presencial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "criado_por" UUID NOT NULL,
    "data" DATE NOT NULL,
    "horario_grade_id" UUID,
    "professor_id" UUID NOT NULL,
    "responsavel_id" UUID NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apoio_presencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lembretes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" DATE,
    "prioridade" TEXT NOT NULL DEFAULT 'media',
    "cor" TEXT NOT NULL DEFAULT 'amarelo',
    "turma_id" UUID,
    "disciplina_id" UUID,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "fixado" BOOLEAN NOT NULL DEFAULT false,
    "posicao" INTEGER DEFAULT 0,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lembretes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencias_notebook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turma_id" UUID,
    "data_ocorrencia" DATE NOT NULL DEFAULT CURRENT_DATE,
    "quantidade_notebooks" INTEGER DEFAULT 0,
    "alunos_envolvidos" TEXT,
    "problema_encontrado" TEXT,
    "descricao" TEXT,
    "equipamento_danificado" BOOLEAN DEFAULT false,
    "internet_funcionou" BOOLEAN DEFAULT true,
    "solucao_adotada" TEXT,
    "observacoes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencias_notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia_fotos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ocorrencia_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencia_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencias_escolares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "data" DATE NOT NULL DEFAULT CURRENT_DATE,
    "turma" TEXT,
    "alunos" TEXT,
    "disciplina" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'nova',
    "providencias" TEXT,
    "gestao_user_id" UUID,
    "respondido_em" TIMESTAMPTZ(6),
    "visto_pelo_professor" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencias_escolares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_evidencias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "data_realizacao" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ano_letivo" INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
    "bimestre" INTEGER NOT NULL DEFAULT 1,
    "turma_id" UUID,
    "disciplina_id" UUID,
    "tipo_atividade" TEXT NOT NULL DEFAULT 'Outro',
    "objetivo" TEXT,
    "descricao" TEXT,
    "resultados" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdi_evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_evidencia_fotos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evidencia_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nome" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdi_evidencia_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdi_evidencia_documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evidencia_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdi_evidencia_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutorados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "aluno_id" UUID,
    "nome" TEXT NOT NULL,
    "turma" TEXT,
    "numero_chamada" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "observacoes" TEXT,
    "foto_path" TEXT,
    "data_inicio" DATE NOT NULL DEFAULT CURRENT_DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutorados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoria_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutorado_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "humor" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoria_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoria_registros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutorado_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "data" DATE NOT NULL DEFAULT CURRENT_DATE,
    "como_esta" TEXT,
    "observacao" TEXT,
    "combinado" TEXT,
    "proxima_acao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoria_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoria_combinados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutorado_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoria_combinados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoria_documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutorado_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "mime_type" TEXT,
    "tamanho_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoria_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replicabilidades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replicabilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replicabilidade_fotos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "replicabilidade_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "nome" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replicabilidade_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE INDEX "idx_disciplinas_user" ON "disciplinas"("user_id");

-- CreateIndex
CREATE INDEX "idx_td_user" ON "turma_disciplinas"("user_id");

-- CreateIndex
CREATE INDEX "idx_td_turma" ON "turma_disciplinas"("turma_id");

-- CreateIndex
CREATE INDEX "idx_td_disciplina" ON "turma_disciplinas"("disciplina_id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_disciplinas_turma_id_disciplina_id_user_id_key" ON "turma_disciplinas"("turma_id", "disciplina_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_turma_membros_turma" ON "turma_membros"("turma_id");

-- CreateIndex
CREATE INDEX "idx_turma_membros_aluno" ON "turma_membros"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_membros_turma_id_aluno_id_key" ON "turma_membros"("turma_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "ano_letivo_ano_key" ON "ano_letivo"("ano");

-- CreateIndex
CREATE INDEX "idx_tipos_avaliacao_user" ON "tipos_avaliacao"("user_id");

-- CreateIndex
CREATE INDEX "idx_tipos_avaliacao_categoria" ON "tipos_avaliacao"("categoria");

-- CreateIndex
CREATE INDEX "idx_notas_user" ON "notas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notas_aluno_id_tipo_avaliacao_id_key" ON "notas"("aluno_id", "tipo_avaliacao_id");

-- CreateIndex
CREATE INDEX "idx_ma_lookup" ON "medias_arredondadas"("user_id", "turma_id", "disciplina_id", "bimestre");

-- CreateIndex
CREATE UNIQUE INDEX "medias_arredondadas_user_id_aluno_id_disciplina_id_bimestre_key" ON "medias_arredondadas"("user_id", "aluno_id", "disciplina_id", "bimestre");

-- CreateIndex
CREATE INDEX "idx_provas_user" ON "provas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gabaritos_prova_id_numero_questao_key" ON "gabaritos"("prova_id", "numero_questao");

-- CreateIndex
CREATE INDEX "idx_resultados_user" ON "resultados_prova"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_prova_prova_id_aluno_id_key" ON "resultados_prova"("prova_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "planejamentos_bimestrais_user_id_turma_id_disciplina_id_bim_key" ON "planejamentos_bimestrais"("user_id", "turma_id", "disciplina_id", "bimestre", "ano");

-- CreateIndex
CREATE INDEX "idx_planos_aula_user" ON "planos_aula"("user_id");

-- CreateIndex
CREATE INDEX "idx_planos_aula_planejamento" ON "planos_aula"("planejamento_id");

-- CreateIndex
CREATE INDEX "idx_plano_anexos_plano" ON "plano_anexos"("plano_id");

-- CreateIndex
CREATE INDEX "idx_diario_ativ_turma" ON "diario_atividades"("turma_id", "disciplina_id", "bimestre");

-- CreateIndex
CREATE INDEX "idx_diario_lanc_ativ" ON "diario_lancamentos"("atividade_id");

-- CreateIndex
CREATE INDEX "idx_diario_lanc_aluno" ON "diario_lancamentos"("aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "diario_lancamentos_atividade_id_aluno_id_key" ON "diario_lancamentos"("atividade_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_professor_user_id_dia_semana_horario_grade_id_key" ON "agenda_professor"("user_id", "dia_semana", "horario_grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_excecoes_user_id_data_horario_grade_id_key" ON "agenda_excecoes"("user_id", "data", "horario_grade_id");

-- CreateIndex
CREATE INDEX "idx_lembretes_user" ON "lembretes"("user_id");

-- CreateIndex
CREATE INDEX "idx_ocorrencias_user" ON "ocorrencias_notebook"("user_id");

-- CreateIndex
CREATE INDEX "idx_pdi_evidencias_user" ON "pdi_evidencias"("user_id");

-- CreateIndex
CREATE INDEX "idx_pdi_evidencias_turma" ON "pdi_evidencias"("turma_id");

-- CreateIndex
CREATE INDEX "idx_pdi_evidencias_disciplina" ON "pdi_evidencias"("disciplina_id");

-- CreateIndex
CREATE INDEX "idx_pdi_fotos_evidencia" ON "pdi_evidencia_fotos"("evidencia_id");

-- CreateIndex
CREATE INDEX "idx_pdi_docs_evidencia" ON "pdi_evidencia_documentos"("evidencia_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinas" ADD CONSTRAINT "disciplinas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_disciplinas" ADD CONSTRAINT "turma_disciplinas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_disciplinas" ADD CONSTRAINT "turma_disciplinas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_disciplinas" ADD CONSTRAINT "turma_disciplinas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_membros" ADD CONSTRAINT "turma_membros_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_membros" ADD CONSTRAINT "turma_membros_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma_membros" ADD CONSTRAINT "turma_membros_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_avaliacao" ADD CONSTRAINT "tipos_avaliacao_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_avaliacao" ADD CONSTRAINT "tipos_avaliacao_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_avaliacao" ADD CONSTRAINT "tipos_avaliacao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_tipo_avaliacao_id_fkey" FOREIGN KEY ("tipo_avaliacao_id") REFERENCES "tipos_avaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medias_arredondadas" ADD CONSTRAINT "medias_arredondadas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medias_arredondadas" ADD CONSTRAINT "medias_arredondadas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medias_arredondadas" ADD CONSTRAINT "medias_arredondadas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medias_arredondadas" ADD CONSTRAINT "medias_arredondadas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gabaritos" ADD CONSTRAINT "gabaritos_prova_id_fkey" FOREIGN KEY ("prova_id") REFERENCES "provas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_prova" ADD CONSTRAINT "resultados_prova_prova_id_fkey" FOREIGN KEY ("prova_id") REFERENCES "provas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_prova" ADD CONSTRAINT "resultados_prova_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_prova" ADD CONSTRAINT "resultados_prova_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planejamentos_bimestrais" ADD CONSTRAINT "planejamentos_bimestrais_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planejamentos_bimestrais" ADD CONSTRAINT "planejamentos_bimestrais_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planejamentos_bimestrais" ADD CONSTRAINT "planejamentos_bimestrais_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planejamentos_bimestrais" ADD CONSTRAINT "planejamentos_bimestrais_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_aula" ADD CONSTRAINT "planos_aula_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_aula" ADD CONSTRAINT "planos_aula_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_aula" ADD CONSTRAINT "planos_aula_duplicado_de_fkey" FOREIGN KEY ("duplicado_de") REFERENCES "planos_aula"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_aula" ADD CONSTRAINT "planos_aula_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_aula" ADD CONSTRAINT "planos_aula_planejamento_id_fkey" FOREIGN KEY ("planejamento_id") REFERENCES "planejamentos_bimestrais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_plano" ADD CONSTRAINT "ajustes_plano_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_anexos" ADD CONSTRAINT "plano_anexos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos_aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_anexos" ADD CONSTRAINT "plano_anexos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_atividades" ADD CONSTRAINT "diario_atividades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_atividades" ADD CONSTRAINT "diario_atividades_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_atividades" ADD CONSTRAINT "diario_atividades_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_lancamentos" ADD CONSTRAINT "diario_lancamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_lancamentos" ADD CONSTRAINT "diario_lancamentos_atividade_id_fkey" FOREIGN KEY ("atividade_id") REFERENCES "diario_atividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_lancamentos" ADD CONSTRAINT "diario_lancamentos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_observacoes_aluno" ADD CONSTRAINT "diario_observacoes_aluno_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_observacoes_aluno" ADD CONSTRAINT "diario_observacoes_aluno_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_observacoes_aluno" ADD CONSTRAINT "diario_observacoes_aluno_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_observacoes_aluno" ADD CONSTRAINT "diario_observacoes_aluno_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_professor" ADD CONSTRAINT "agenda_professor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_professor" ADD CONSTRAINT "agenda_professor_horario_grade_id_fkey" FOREIGN KEY ("horario_grade_id") REFERENCES "horario_grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_professor" ADD CONSTRAINT "agenda_professor_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_professor" ADD CONSTRAINT "agenda_professor_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_excecoes" ADD CONSTRAINT "agenda_excecoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_excecoes" ADD CONSTRAINT "agenda_excecoes_horario_grade_id_fkey" FOREIGN KEY ("horario_grade_id") REFERENCES "horario_grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_excecoes" ADD CONSTRAINT "agenda_excecoes_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_excecoes" ADD CONSTRAINT "agenda_excecoes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_escola_eventos" ADD CONSTRAINT "agenda_escola_eventos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoio_presencial" ADD CONSTRAINT "apoio_presencial_horario_grade_id_fkey" FOREIGN KEY ("horario_grade_id") REFERENCES "horario_grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoio_presencial" ADD CONSTRAINT "apoio_presencial_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoio_presencial" ADD CONSTRAINT "apoio_presencial_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoio_presencial" ADD CONSTRAINT "apoio_presencial_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias_notebook" ADD CONSTRAINT "ocorrencias_notebook_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias_notebook" ADD CONSTRAINT "ocorrencias_notebook_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia_fotos" ADD CONSTRAINT "ocorrencia_fotos_ocorrencia_id_fkey" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencias_notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias_escolares" ADD CONSTRAINT "ocorrencias_escolares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias_escolares" ADD CONSTRAINT "ocorrencias_escolares_gestao_user_id_fkey" FOREIGN KEY ("gestao_user_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencias" ADD CONSTRAINT "pdi_evidencias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencias" ADD CONSTRAINT "pdi_evidencias_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencias" ADD CONSTRAINT "pdi_evidencias_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencia_fotos" ADD CONSTRAINT "pdi_evidencia_fotos_evidencia_id_fkey" FOREIGN KEY ("evidencia_id") REFERENCES "pdi_evidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencia_documentos" ADD CONSTRAINT "pdi_evidencia_documentos_evidencia_id_fkey" FOREIGN KEY ("evidencia_id") REFERENCES "pdi_evidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdi_evidencia_documentos" ADD CONSTRAINT "pdi_evidencia_documentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorados" ADD CONSTRAINT "tutorados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutorados" ADD CONSTRAINT "tutorados_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_checkins" ADD CONSTRAINT "tutoria_checkins_tutorado_id_fkey" FOREIGN KEY ("tutorado_id") REFERENCES "tutorados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_checkins" ADD CONSTRAINT "tutoria_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_registros" ADD CONSTRAINT "tutoria_registros_tutorado_id_fkey" FOREIGN KEY ("tutorado_id") REFERENCES "tutorados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_registros" ADD CONSTRAINT "tutoria_registros_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_combinados" ADD CONSTRAINT "tutoria_combinados_tutorado_id_fkey" FOREIGN KEY ("tutorado_id") REFERENCES "tutorados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_combinados" ADD CONSTRAINT "tutoria_combinados_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_documentos" ADD CONSTRAINT "tutoria_documentos_tutorado_id_fkey" FOREIGN KEY ("tutorado_id") REFERENCES "tutorados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria_documentos" ADD CONSTRAINT "tutoria_documentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replicabilidades" ADD CONSTRAINT "replicabilidades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replicabilidade_fotos" ADD CONSTRAINT "replicabilidade_fotos_replicabilidade_id_fkey" FOREIGN KEY ("replicabilidade_id") REFERENCES "replicabilidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Regras que o Prisma não expressa no schema (adicionadas manualmente)
-- =============================================================================

-- CHECKs de valores permitidos
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_status_check" CHECK ("status" IN ('pendente', 'ativo', 'inativo'));

ALTER TABLE "lembretes"
  ADD CONSTRAINT "lembretes_prioridade_check" CHECK ("prioridade" IN ('baixa', 'media', 'alta'));

ALTER TABLE "planejamentos_bimestrais"
  ADD CONSTRAINT "planejamentos_bimestrais_bimestre_check" CHECK ("bimestre" BETWEEN 1 AND 4),
  ADD CONSTRAINT "planejamentos_bimestrais_status_check" CHECK ("status" IN ('rascunho', 'aguardando_validacao', 'validado'));

ALTER TABLE "plano_anexos"
  ADD CONSTRAINT "plano_anexos_tipo_check" CHECK ("tipo" IN ('documento', 'adaptada'));

ALTER TABLE "agenda_professor"
  ADD CONSTRAINT "agenda_professor_dia_semana_check" CHECK ("dia_semana" BETWEEN 0 AND 6);

-- Um professor não pode ter o mesmo aluno cadastrado duas vezes como tutorado
-- (tutorados avulsos, sem aluno_id, não entram na regra).
CREATE UNIQUE INDEX "tutorados_user_aluno_uidx"
  ON "tutorados" ("user_id", "aluno_id") WHERE "aluno_id" IS NOT NULL;
