CREATE POLICY "tut_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('tutoria-fotos','tutoria-documentos')
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_gestao(auth.uid()))
);

CREATE POLICY "tut_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('tutoria-fotos','tutoria-documentos')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "tut_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('tutoria-fotos','tutoria-documentos')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "tut_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('tutoria-fotos','tutoria-documentos')
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);