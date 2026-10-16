
-- ============ alunos: replace USING(true) predicates ============
DROP POLICY IF EXISTS "Ver alunos auth" ON public.alunos;
DROP POLICY IF EXISTS "Criar alunos auth" ON public.alunos;
DROP POLICY IF EXISTS "Editar alunos auth" ON public.alunos;
DROP POLICY IF EXISTS "Apagar alunos auth" ON public.alunos;

CREATE POLICY "alunos_select_auth" ON public.alunos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "alunos_insert_auth" ON public.alunos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "alunos_update_auth" ON public.alunos
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Delete restricted to gestao (coordenador/direcao/vice_direcao/admin)
CREATE POLICY "alunos_delete_gestao" ON public.alunos
  FOR DELETE TO authenticated
  USING (public.is_gestao(auth.uid()));

-- ============ agenda_escola_eventos: remove literal true SELECT ============
DROP POLICY IF EXISTS "evt select all" ON public.agenda_escola_eventos;
CREATE POLICY "evt_select_auth" ON public.agenda_escola_eventos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============ ano_letivo: remove literal true SELECT ============
DROP POLICY IF EXISTS "Ano letivo visivel" ON public.ano_letivo;
CREATE POLICY "ano_letivo_select_auth" ON public.ano_letivo
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============ horario_grade: remove literal true SELECT ============
DROP POLICY IF EXISTS "Grade visivel" ON public.horario_grade;
CREATE POLICY "horario_grade_select_auth" ON public.horario_grade
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============ Revoke EXECUTE from anon/public on SECURITY DEFINER functions ============
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_gestao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep authenticated EXECUTE on has_role/is_admin/is_gestao because RLS policies invoke them.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestao(uuid) TO authenticated;

-- ============ Enforce institutional email domain server-side on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Reject signups from disallowed email domains (institutional only, plus initial admin bootstrap)
  IF NEW.email IS NULL
     OR (lower(NEW.email) NOT LIKE '%@prof.educacao.sp.gov.br'
         AND lower(NEW.email) <> 'sverzutivendas@gmail.com') THEN
    RAISE EXCEPTION 'Cadastro permitido apenas para e-mails institucionais (@prof.educacao.sp.gov.br).';
  END IF;

  INSERT INTO public.profiles (id, nome, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    CASE WHEN NEW.email = 'sverzutivendas@gmail.com' THEN 'ativo' ELSE 'pendente' END
  );
  IF NEW.email = 'sverzutivendas@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
