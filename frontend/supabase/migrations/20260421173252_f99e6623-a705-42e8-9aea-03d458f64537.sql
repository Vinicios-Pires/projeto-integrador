-- Tabela de vínculo entre turma, disciplina e professor
CREATE TABLE public.turma_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (turma_id, disciplina_id, user_id)
);

CREATE INDEX idx_turma_disciplinas_user ON public.turma_disciplinas (user_id);
CREATE INDEX idx_turma_disciplinas_turma ON public.turma_disciplinas (turma_id);
CREATE INDEX idx_turma_disciplinas_disciplina ON public.turma_disciplinas (disciplina_id);

ALTER TABLE public.turma_disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor cria próprios vínculos turma-disciplina"
  ON public.turma_disciplinas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprios vínculos turma-disciplina"
  ON public.turma_disciplinas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprios vínculos turma-disciplina"
  ON public.turma_disciplinas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Vê vínculos próprios ou gestão"
  ON public.turma_disciplinas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));