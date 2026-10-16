
CREATE TABLE public.lembretes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  cor TEXT NOT NULL DEFAULT 'amarelo',
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  fixado BOOLEAN NOT NULL DEFAULT false,
  posicao INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all lembretes"
  ON public.lembretes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_lembretes_updated_at
  BEFORE UPDATE ON public.lembretes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
