ALTER TABLE public.tutorados
  ADD COLUMN IF NOT EXISTS foto_path text,
  ADD COLUMN IF NOT EXISTS data_inicio date NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS tutorados_user_aluno_uidx
  ON public.tutorados (user_id, aluno_id) WHERE aluno_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tutoria_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id uuid NOT NULL REFERENCES public.tutorados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoria_documentos TO authenticated;
GRANT ALL ON public.tutoria_documentos TO service_role;

ALTER TABLE public.tutoria_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "td_select" ON public.tutoria_documentos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "td_insert" ON public.tutoria_documentos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "td_delete" ON public.tutoria_documentos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));