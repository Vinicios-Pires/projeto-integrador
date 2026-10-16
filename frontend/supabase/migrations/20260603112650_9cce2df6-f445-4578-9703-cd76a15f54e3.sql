
CREATE TABLE public.pdi_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  data_realizacao date NOT NULL DEFAULT CURRENT_DATE,
  ano_letivo integer NOT NULL DEFAULT EXTRACT(year FROM now()),
  bimestre integer NOT NULL DEFAULT 1,
  turma_id uuid,
  disciplina_id uuid,
  tipo_atividade text NOT NULL DEFAULT 'Outro',
  objetivo text,
  descricao text,
  resultados text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_evidencias TO authenticated;
GRANT ALL ON public.pdi_evidencias TO service_role;

ALTER TABLE public.pdi_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor cria próprias evidências" ON public.pdi_evidencias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Professor edita próprias evidências" ON public.pdi_evidencias
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Professor apaga próprias evidências" ON public.pdi_evidencias
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Vê evidências próprias ou gestão" ON public.pdi_evidencias
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_gestao(auth.uid()));

CREATE TRIGGER update_pdi_evidencias_updated_at
  BEFORE UPDATE ON public.pdi_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pdi_evidencias_user ON public.pdi_evidencias(user_id);
CREATE INDEX idx_pdi_evidencias_turma ON public.pdi_evidencias(turma_id);
CREATE INDEX idx_pdi_evidencias_disciplina ON public.pdi_evidencias(disciplina_id);

CREATE TABLE public.pdi_evidencia_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_id uuid NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_evidencia_fotos TO authenticated;
GRANT ALL ON public.pdi_evidencia_fotos TO service_role;

ALTER TABLE public.pdi_evidencia_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê fotos da própria evidência ou gestão" ON public.pdi_evidencia_fotos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND (e.user_id = auth.uid() OR is_gestao(auth.uid())))
  );
CREATE POLICY "Professor cria fotos nas próprias evidências" ON public.pdi_evidencia_fotos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Professor apaga fotos das próprias evidências" ON public.pdi_evidencia_fotos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
  );

CREATE INDEX idx_pdi_fotos_evidencia ON public.pdi_evidencia_fotos(evidencia_id);

CREATE TABLE public.pdi_evidencia_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_id uuid NOT NULL,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_evidencia_documentos TO authenticated;
GRANT ALL ON public.pdi_evidencia_documentos TO service_role;

ALTER TABLE public.pdi_evidencia_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vê documentos da própria evidência ou gestão" ON public.pdi_evidencia_documentos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND (e.user_id = auth.uid() OR is_gestao(auth.uid())))
  );
CREATE POLICY "Professor cria documentos nas próprias evidências" ON public.pdi_evidencia_documentos
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
  );
CREATE POLICY "Professor apaga documentos das próprias evidências" ON public.pdi_evidencia_documentos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
  );

CREATE INDEX idx_pdi_docs_evidencia ON public.pdi_evidencia_documentos(evidencia_id);
