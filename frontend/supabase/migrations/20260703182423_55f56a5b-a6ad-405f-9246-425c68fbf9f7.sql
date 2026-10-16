
-- Atividades (colunas da planilha)
CREATE TABLE public.diario_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre INT NOT NULL DEFAULT 1,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nota', -- 'nota' | 'conceito'
  data DATE,
  peso NUMERIC DEFAULT 1,
  observacao TEXT,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_atividades TO authenticated;
GRANT ALL ON public.diario_atividades TO service_role;
ALTER TABLE public.diario_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof gerencia proprias atividades" ON public.diario_atividades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gestao visualiza atividades" ON public.diario_atividades
  FOR SELECT USING (public.is_gestao(auth.uid()));
CREATE POLICY "admin acesso total atividades" ON public.diario_atividades
  FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_diario_atividades_updated BEFORE UPDATE ON public.diario_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lançamentos (células da planilha)
CREATE TABLE public.diario_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atividade_id UUID NOT NULL REFERENCES public.diario_atividades(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  valor TEXT,
  fez BOOLEAN,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(atividade_id, aluno_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_lancamentos TO authenticated;
GRANT ALL ON public.diario_lancamentos TO service_role;
ALTER TABLE public.diario_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof gerencia proprios lancamentos" ON public.diario_lancamentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gestao visualiza lancamentos" ON public.diario_lancamentos
  FOR SELECT USING (public.is_gestao(auth.uid()));
CREATE POLICY "admin acesso total lancamentos" ON public.diario_lancamentos
  FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_diario_lancamentos_updated BEFORE UPDATE ON public.diario_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Observações gerais por aluno
CREATE TABLE public.diario_observacoes_aluno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre INT NOT NULL DEFAULT 1,
  observacao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_observacoes_aluno TO authenticated;
GRANT ALL ON public.diario_observacoes_aluno TO service_role;
ALTER TABLE public.diario_observacoes_aluno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof gerencia proprias obs" ON public.diario_observacoes_aluno
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gestao visualiza obs" ON public.diario_observacoes_aluno
  FOR SELECT USING (public.is_gestao(auth.uid()));
CREATE POLICY "admin acesso total obs" ON public.diario_observacoes_aluno
  FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_diario_obs_updated BEFORE UPDATE ON public.diario_observacoes_aluno
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_diario_ativ_turma ON public.diario_atividades(turma_id, disciplina_id, bimestre);
CREATE INDEX idx_diario_lanc_ativ ON public.diario_lancamentos(atividade_id);
CREATE INDEX idx_diario_lanc_aluno ON public.diario_lancamentos(aluno_id);
