
-- =========================================================
-- TUTORIA MODULE
-- =========================================================
CREATE TABLE public.tutorados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  turma TEXT,
  numero_chamada INT,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorados TO authenticated;
GRANT ALL ON public.tutorados TO service_role;
ALTER TABLE public.tutorados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tut_select" ON public.tutorados FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "tut_insert" ON public.tutorados FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tut_update" ON public.tutorados FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tut_delete" ON public.tutorados FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_tutorados_updated BEFORE UPDATE ON public.tutorados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tutoria_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id UUID NOT NULL REFERENCES public.tutorados(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  humor TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoria_checkins TO authenticated;
GRANT ALL ON public.tutoria_checkins TO service_role;
ALTER TABLE public.tutoria_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_select" ON public.tutoria_checkins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "tc_insert" ON public.tutoria_checkins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tc_update" ON public.tutoria_checkins FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tc_delete" ON public.tutoria_checkins FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.tutoria_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id UUID NOT NULL REFERENCES public.tutorados(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  como_esta TEXT,
  observacao TEXT,
  combinado TEXT,
  proxima_acao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoria_registros TO authenticated;
GRANT ALL ON public.tutoria_registros TO service_role;
ALTER TABLE public.tutoria_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_select" ON public.tutoria_registros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "tr_insert" ON public.tutoria_registros FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tr_update" ON public.tutoria_registros FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tr_delete" ON public.tutoria_registros FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_tut_registros_updated BEFORE UPDATE ON public.tutoria_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tutoria_combinados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id UUID NOT NULL REFERENCES public.tutorados(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoria_combinados TO authenticated;
GRANT ALL ON public.tutoria_combinados TO service_role;
ALTER TABLE public.tutoria_combinados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcb_select" ON public.tutoria_combinados FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "tcb_insert" ON public.tutoria_combinados FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tcb_update" ON public.tutoria_combinados FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tcb_delete" ON public.tutoria_combinados FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_tut_combinados_updated BEFORE UPDATE ON public.tutoria_combinados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- STORAGE POLICIES
-- Pattern: bucket "<name>" with object path "<user_id>/..."
-- =========================================================
DO $$
DECLARE b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['ocorrencias-fotos','plano-anexos','pdi-fotos','pdi-documentos','replicabilidade-fotos']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = %L AND (owner = auth.uid() OR public.is_gestao(auth.uid())));
    $f$, b||'_sel', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND owner = auth.uid());
    $f$, b||'_ins', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = %L AND (owner = auth.uid() OR public.is_admin(auth.uid())));
    $f$, b||'_upd', b);
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = %L AND (owner = auth.uid() OR public.is_admin(auth.uid())));
    $f$, b||'_del', b);
  END LOOP;
END $$;
