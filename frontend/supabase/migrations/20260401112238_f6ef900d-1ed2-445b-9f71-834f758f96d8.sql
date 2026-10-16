
-- Create storage bucket for ocorrencia photos
INSERT INTO storage.buckets (id, name, public) VALUES ('ocorrencias-fotos', 'ocorrencias-fotos', true);

-- Allow public read access
CREATE POLICY "Public read ocorrencias-fotos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'ocorrencias-fotos');

-- Allow public insert
CREATE POLICY "Public insert ocorrencias-fotos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'ocorrencias-fotos');

-- Allow public delete
CREATE POLICY "Public delete ocorrencias-fotos" ON storage.objects FOR DELETE TO public USING (bucket_id = 'ocorrencias-fotos');

-- Create table to link photos to ocorrencias
CREATE TABLE public.ocorrencia_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid REFERENCES public.ocorrencias_notebook(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ocorrencia_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all ocorrencia_fotos" ON public.ocorrencia_fotos FOR ALL TO public USING (true) WITH CHECK (true);
