
-- ========================
-- AGENDA ESCOLAR PEI
-- ========================

-- Enum: tipo de bloco da grade
DO $$ BEGIN
  CREATE TYPE public.tipo_bloco_horario AS ENUM ('aula','intervalo','almoco','planejamento','atpc','reuniao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum: tipo de evento da escola
DO $$ BEGIN
  CREATE TYPE public.tipo_evento_escola AS ENUM (
    'reuniao','formacao','evento','avaliacao_externa','conselho',
    'apoio_presencial','acompanhamento','observacao','visita','aviso'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================
-- 1) HORARIO_GRADE (compartilhado/leitura)
-- =========================================
CREATE TABLE IF NOT EXISTS public.horario_grade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem int NOT NULL,
  rotulo text NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  tipo public.tipo_bloco_horario NOT NULL DEFAULT 'aula',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.horario_grade TO authenticated;
GRANT ALL ON public.horario_grade TO service_role;
ALTER TABLE public.horario_grade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Grade visivel para autenticados" ON public.horario_grade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia grade" ON public.horario_grade FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed da grade PEI (apenas se vazia)
INSERT INTO public.horario_grade (ordem, rotulo, hora_inicio, hora_fim, tipo)
SELECT * FROM (VALUES
  (1, 'Entrada/Acolhimento', '07:00'::time, '07:30'::time, 'outro'::public.tipo_bloco_horario),
  (2, '1ª aula',             '07:30'::time, '08:20'::time, 'aula'::public.tipo_bloco_horario),
  (3, '2ª aula',             '08:20'::time, '09:10'::time, 'aula'::public.tipo_bloco_horario),
  (4, '3ª aula',             '09:10'::time, '10:00'::time, 'aula'::public.tipo_bloco_horario),
  (5, 'Intervalo',           '10:00'::time, '10:20'::time, 'intervalo'::public.tipo_bloco_horario),
  (6, '4ª aula',             '10:20'::time, '11:10'::time, 'aula'::public.tipo_bloco_horario),
  (7, '5ª aula',             '11:10'::time, '12:00'::time, 'aula'::public.tipo_bloco_horario),
  (8, 'Almoço',              '12:00'::time, '13:00'::time, 'almoco'::public.tipo_bloco_horario),
  (9, '6ª aula',             '13:00'::time, '13:50'::time, 'aula'::public.tipo_bloco_horario),
  (10,'7ª aula',             '13:50'::time, '14:40'::time, 'aula'::public.tipo_bloco_horario),
  (11,'8ª aula',             '14:40'::time, '15:30'::time, 'aula'::public.tipo_bloco_horario),
  (12,'9ª aula / ATPC',      '15:30'::time, '16:30'::time, 'atpc'::public.tipo_bloco_horario)
) AS v(ordem, rotulo, hora_inicio, hora_fim, tipo)
WHERE NOT EXISTS (SELECT 1 FROM public.horario_grade);

-- =========================================
-- 2) ANO_LETIVO
-- =========================================
CREATE TABLE IF NOT EXISTS public.ano_letivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL UNIQUE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ano_letivo TO authenticated;
GRANT ALL ON public.ano_letivo TO service_role;
ALTER TABLE public.ano_letivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ano letivo visivel" ON public.ano_letivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia ano letivo" ON public.ano_letivo FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.ano_letivo (ano, data_inicio, data_fim, ativo)
VALUES (2026, '2026-02-02', '2026-12-18', true)
ON CONFLICT (ano) DO NOTHING;

-- =========================================
-- 3) AGENDA_PROFESSOR (rotina semanal fixa)
-- =========================================
CREATE TABLE IF NOT EXISTS public.agenda_professor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_grade_id uuid NOT NULL REFERENCES public.horario_grade(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  atividade text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia_semana, horario_grade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_professor TO authenticated;
GRANT ALL ON public.agenda_professor TO service_role;
ALTER TABLE public.agenda_professor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professor ve sua rotina" ON public.agenda_professor FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "Professor edita sua rotina" ON public.agenda_professor FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Professor altera sua rotina" ON public.agenda_professor FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Professor apaga sua rotina" ON public.agenda_professor FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER trg_agenda_professor_updated
  BEFORE UPDATE ON public.agenda_professor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4) AGENDA_EXCECOES (alterações pontuais)
-- =========================================
CREATE TABLE IF NOT EXISTS public.agenda_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  horario_grade_id uuid NOT NULL REFERENCES public.horario_grade(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  atividade text,
  cancelado boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data, horario_grade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_excecoes TO authenticated;
GRANT ALL ON public.agenda_excecoes TO service_role;
ALTER TABLE public.agenda_excecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professor ve suas excecoes" ON public.agenda_excecoes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "Professor cria excecoes" ON public.agenda_excecoes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Professor altera excecoes" ON public.agenda_excecoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Professor apaga excecoes" ON public.agenda_excecoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER trg_agenda_excecoes_updated
  BEFORE UPDATE ON public.agenda_excecoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5) AGENDA_ESCOLA_EVENTOS (agenda da escola)
-- =========================================
CREATE TABLE IF NOT EXISTS public.agenda_escola_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  tipo public.tipo_evento_escola NOT NULL DEFAULT 'aviso',
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz,
  dia_todo boolean NOT NULL DEFAULT false,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_escola_eventos TO authenticated;
GRANT ALL ON public.agenda_escola_eventos TO service_role;
ALTER TABLE public.agenda_escola_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos veem agenda da escola" ON public.agenda_escola_eventos FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Gestao cria eventos" ON public.agenda_escola_eventos FOR INSERT TO authenticated
  WITH CHECK (public.is_gestao(auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "Gestao altera eventos" ON public.agenda_escola_eventos FOR UPDATE TO authenticated
  USING (public.is_gestao(auth.uid())) WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "Gestao apaga eventos" ON public.agenda_escola_eventos FOR DELETE TO authenticated
  USING (public.is_gestao(auth.uid()));
CREATE TRIGGER trg_eventos_escola_updated
  BEFORE UPDATE ON public.agenda_escola_eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 6) APOIO_PRESENCIAL
-- =========================================
CREATE TABLE IF NOT EXISTS public.apoio_presencial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL,
  data date NOT NULL,
  horario_grade_id uuid REFERENCES public.horario_grade(id) ON DELETE SET NULL,
  professor_id uuid NOT NULL,
  responsavel_id uuid NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apoio_presencial TO authenticated;
GRANT ALL ON public.apoio_presencial TO service_role;
ALTER TABLE public.apoio_presencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professor envolvido e gestao veem apoio" ON public.apoio_presencial FOR SELECT TO authenticated
  USING (professor_id = auth.uid() OR responsavel_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "Gestao cria apoio" ON public.apoio_presencial FOR INSERT TO authenticated
  WITH CHECK (public.is_gestao(auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "Gestao altera apoio" ON public.apoio_presencial FOR UPDATE TO authenticated
  USING (public.is_gestao(auth.uid())) WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "Gestao apaga apoio" ON public.apoio_presencial FOR DELETE TO authenticated
  USING (public.is_gestao(auth.uid()));
CREATE TRIGGER trg_apoio_presencial_updated
  BEFORE UPDATE ON public.apoio_presencial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
