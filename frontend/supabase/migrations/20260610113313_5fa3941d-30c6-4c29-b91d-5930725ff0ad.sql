
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
  CHECK (status IN ('pendente','ativo','inativo'));

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.is_gestao(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('coordenador'::app_role,'direcao'::app_role,'vice_direcao'::app_role,'admin'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email, 'pendente');
  RETURN NEW;
END;
$$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = 'carolinesverzuti@prof.educacao.sp.gov.br';
  IF v_id IS NOT NULL THEN
    UPDATE public.profiles SET status = 'ativo' WHERE id = v_id;
    DELETE FROM public.user_roles WHERE user_id = v_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin'::app_role);
  END IF;
END $$;

UPDATE public.profiles SET status = 'ativo' WHERE status IS NULL;

DROP POLICY IF EXISTS "Admin pode ver todos os perfis" ON public.profiles;
CREATE POLICY "Admin pode ver todos os perfis" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON public.profiles;
CREATE POLICY "Admin pode atualizar perfis" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia papéis" ON public.user_roles;
CREATE POLICY "Admin gerencia papéis" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.turmas t
SET user_id = sub.uid
FROM (
  SELECT turma_id, (array_agg(user_id))[1] AS uid
  FROM public.turma_disciplinas
  GROUP BY turma_id
) sub
WHERE t.user_id IS NULL AND sub.turma_id = t.id;

UPDATE public.turmas
SET user_id = (SELECT id FROM public.profiles WHERE email = 'carolinesverzuti@prof.educacao.sp.gov.br')
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "Auth pode ver turmas" ON public.turmas;
DROP POLICY IF EXISTS "Auth pode criar turmas" ON public.turmas;
DROP POLICY IF EXISTS "Auth pode editar turmas" ON public.turmas;
DROP POLICY IF EXISTS "Auth pode apagar turmas" ON public.turmas;

CREATE POLICY "Ver turmas (dono, atribuída, gestão ou admin)" ON public.turmas
  FOR SELECT TO authenticated USING (
    public.is_gestao(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.turma_disciplinas td WHERE td.turma_id = turmas.id AND td.user_id = auth.uid())
  );

CREATE POLICY "Criar turmas (dono = self)" ON public.turmas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Editar turmas (dono ou admin)" ON public.turmas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Apagar turmas (dono ou admin)" ON public.turmas
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
