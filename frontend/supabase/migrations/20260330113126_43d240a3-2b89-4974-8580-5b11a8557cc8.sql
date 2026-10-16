
CREATE TABLE public.ajustes_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES public.planos_aula(id) ON DELETE CASCADE NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ajustes_plano ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all ajustes_plano" ON public.ajustes_plano
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
