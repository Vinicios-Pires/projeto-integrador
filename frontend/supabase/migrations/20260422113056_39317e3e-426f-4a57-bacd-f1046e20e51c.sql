-- Bucket privado para PDFs de atividades adaptadas
INSERT INTO storage.buckets (id, name, public)
VALUES ('plano-anexos', 'plano-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela de anexos vinculados ao plano de aula
CREATE TABLE public.plano_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos_aula(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_plano_anexos_plano ON public.plano_anexos (plano_id);

ALTER TABLE public.plano_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê anexos do próprio plano ou gestão"
  ON public.plano_anexos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planos_aula p
      WHERE p.id = plano_anexos.plano_id
        AND (p.user_id = auth.uid() OR public.is_gestao(auth.uid()))
    )
  );

CREATE POLICY "Professor cria anexos nos próprios planos"
  ON public.plano_anexos FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_anexos.plano_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Professor apaga anexos dos próprios planos"
  ON public.plano_anexos FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_anexos.plano_id AND p.user_id = auth.uid())
  );

-- Storage policies (objects são organizados como {user_id}/{plano_id}/{filename})
CREATE POLICY "Professor envia próprios PDFs de plano"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plano-anexos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Professor apaga próprios PDFs de plano"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'plano-anexos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vê próprios PDFs de plano ou gestão"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'plano-anexos'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_gestao(auth.uid()))
  );