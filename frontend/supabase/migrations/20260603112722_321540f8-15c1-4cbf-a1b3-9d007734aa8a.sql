
CREATE POLICY "PDI fotos: owner upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'pdi-fotos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "PDI fotos: owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'pdi-fotos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "PDI fotos: owner or gestao read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'pdi-fotos' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_gestao(auth.uid()))
  );

CREATE POLICY "PDI docs: owner upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'pdi-documentos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "PDI docs: owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'pdi-documentos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "PDI docs: owner or gestao read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'pdi-documentos' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_gestao(auth.uid()))
  );
