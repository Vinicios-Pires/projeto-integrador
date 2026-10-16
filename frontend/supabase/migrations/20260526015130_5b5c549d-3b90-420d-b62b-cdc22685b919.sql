
-- 1) Add tipo column to turmas
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'regular';

-- 2) Create turma_membros table (many-to-many for personalizadas)
CREATE TABLE IF NOT EXISTS public.turma_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL,
  aluno_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (turma_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_turma_membros_turma ON public.turma_membros(turma_id);
CREATE INDEX IF NOT EXISTS idx_turma_membros_aluno ON public.turma_membros(aluno_id);

ALTER TABLE public.turma_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê membros próprios ou gestão"
  ON public.turma_membros FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

CREATE POLICY "Professor cria próprios membros"
  ON public.turma_membros FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprios membros"
  ON public.turma_membros FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
