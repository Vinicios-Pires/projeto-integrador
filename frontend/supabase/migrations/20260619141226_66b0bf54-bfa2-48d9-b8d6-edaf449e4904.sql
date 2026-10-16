
-- Tabela de Replicabilidades (registro simples + galeria de fotos)
CREATE TABLE public.replicabilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replicabilidades TO authenticated;
GRANT ALL ON public.replicabilidades TO service_role;
ALTER TABLE public.replicabilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor gerencia suas replicabilidades"
  ON public.replicabilidades FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gestao visualiza todas as replicabilidades"
  ON public.replicabilidades FOR SELECT TO authenticated
  USING (public.is_gestao(auth.uid()));
CREATE POLICY "Admin gerencia todas"
  ON public.replicabilidades FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_replic_updated BEFORE UPDATE ON public.replicabilidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fotos
CREATE TABLE public.replicabilidade_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  replicabilidade_id uuid NOT NULL REFERENCES public.replicabilidades(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replicabilidade_fotos TO authenticated;
GRANT ALL ON public.replicabilidade_fotos TO service_role;
ALTER TABLE public.replicabilidade_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono gerencia fotos"
  ON public.replicabilidade_fotos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.replicabilidades r WHERE r.id = replicabilidade_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.replicabilidades r WHERE r.id = replicabilidade_id AND r.user_id = auth.uid()));
CREATE POLICY "Gestao visualiza fotos"
  ON public.replicabilidade_fotos FOR SELECT TO authenticated
  USING (public.is_gestao(auth.uid()));
CREATE POLICY "Admin gerencia todas as fotos"
  ON public.replicabilidade_fotos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS para o bucket de storage (criado separadamente via tool)
CREATE POLICY "Replic fotos: dono gerencia"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'replicabilidade-fotos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'replicabilidade-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Replic fotos: gestao le"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'replicabilidade-fotos' AND public.is_gestao(auth.uid()));
