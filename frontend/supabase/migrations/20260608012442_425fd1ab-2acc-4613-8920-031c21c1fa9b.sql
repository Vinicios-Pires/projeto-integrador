ALTER TABLE public.tipos_avaliacao
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_tipos_avaliacao_categoria
  ON public.tipos_avaliacao (categoria);
