
CREATE TABLE public.ocorrencias_escolares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  turma TEXT,
  alunos TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nova',
  providencias TEXT,
  gestao_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em TIMESTAMPTZ,
  visto_pelo_professor BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias_escolares TO authenticated;
GRANT ALL ON public.ocorrencias_escolares TO service_role;
ALTER TABLE public.ocorrencias_escolares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oe_select" ON public.ocorrencias_escolares FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "oe_insert" ON public.ocorrencias_escolares FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "oe_update_prof" ON public.ocorrencias_escolares FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'nova')
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "oe_update_gestao" ON public.ocorrencias_escolares FOR UPDATE TO authenticated
  USING (public.is_gestao(auth.uid()));
CREATE POLICY "oe_delete" ON public.ocorrencias_escolares FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_oe_updated BEFORE UPDATE ON public.ocorrencias_escolares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marca como não-visto pelo professor quando a gestão atualiza
CREATE OR REPLACE FUNCTION public.oe_mark_unseen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id <> auth.uid() AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.providencias IS DISTINCT FROM OLD.providencias
  ) THEN
    NEW.visto_pelo_professor := false;
    NEW.gestao_user_id := auth.uid();
    NEW.respondido_em := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_oe_unseen BEFORE UPDATE ON public.ocorrencias_escolares
  FOR EACH ROW EXECUTE FUNCTION public.oe_mark_unseen();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias_escolares;
ALTER TABLE public.ocorrencias_escolares REPLICA IDENTITY FULL;
