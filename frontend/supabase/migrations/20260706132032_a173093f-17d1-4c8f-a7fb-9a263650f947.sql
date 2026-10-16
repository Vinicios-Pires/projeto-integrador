
-- Replicabilidade: mural coletivo (todos autenticados leem, dono/admin edita)
DROP POLICY IF EXISTS "rep gestao select" ON public.replicabilidades;
DROP POLICY IF EXISTS "repf gestao select" ON public.replicabilidade_fotos;

CREATE POLICY "rep mural select"
  ON public.replicabilidades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "repf mural select"
  ON public.replicabilidade_fotos FOR SELECT
  TO authenticated
  USING (true);
