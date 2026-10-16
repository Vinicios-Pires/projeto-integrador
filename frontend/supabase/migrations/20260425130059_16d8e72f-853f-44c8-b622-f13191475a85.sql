-- Tabela para armazenar a nota arredondada manualmente sobrescrita pelo professor
-- (a média original/calculada NÃO é armazenada - sempre recalculada a partir das notas)
CREATE TABLE public.medias_arredondadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  aluno_id UUID NOT NULL,
  turma_id UUID NOT NULL,
  disciplina_id UUID NOT NULL,
  bimestre INTEGER NOT NULL,
  nota_arredondada NUMERIC NOT NULL,
  manual BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, aluno_id, disciplina_id, bimestre)
);

CREATE INDEX idx_medias_arredondadas_lookup
  ON public.medias_arredondadas (user_id, turma_id, disciplina_id, bimestre);

ALTER TABLE public.medias_arredondadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor vê próprias médias arredondadas ou gestão"
  ON public.medias_arredondadas FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_id) OR is_gestao(auth.uid()));

CREATE POLICY "Professor cria próprias médias arredondadas"
  ON public.medias_arredondadas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprias médias arredondadas"
  ON public.medias_arredondadas FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprias médias arredondadas"
  ON public.medias_arredondadas FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_medias_arredondadas_updated_at
  BEFORE UPDATE ON public.medias_arredondadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();