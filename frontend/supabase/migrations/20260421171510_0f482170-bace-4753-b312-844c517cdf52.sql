-- Função auxiliar: identifica qualquer membro da gestão
CREATE OR REPLACE FUNCTION public.is_gestao(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('coordenador'::app_role, 'direcao'::app_role, 'vice_direcao'::app_role)
  )
$$;

-- disciplinas
DROP POLICY IF EXISTS "Professor vê próprias disciplinas" ON public.disciplinas;
CREATE POLICY "Professor vê próprias disciplinas"
  ON public.disciplinas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- notas
DROP POLICY IF EXISTS "Vê notas próprias ou gestão" ON public.notas;
CREATE POLICY "Vê notas próprias ou gestão"
  ON public.notas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- planos_aula SELECT
DROP POLICY IF EXISTS "Vê planos próprios ou todos se gestão" ON public.planos_aula;
CREATE POLICY "Vê planos próprios ou todos se gestão"
  ON public.planos_aula FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- planos_aula UPDATE (gestão pode aprovar)
DROP POLICY IF EXISTS "Professor edita próprios planos OU gestão aprova" ON public.planos_aula;
CREATE POLICY "Professor edita próprios planos OU gestão aprova"
  ON public.planos_aula FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- ocorrencias_notebook
DROP POLICY IF EXISTS "Vê ocorrências próprias ou gestão" ON public.ocorrencias_notebook;
CREATE POLICY "Vê ocorrências próprias ou gestão"
  ON public.ocorrencias_notebook FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- ocorrencia_fotos
DROP POLICY IF EXISTS "Vê fotos da própria ocorrência ou gestão" ON public.ocorrencia_fotos;
CREATE POLICY "Vê fotos da própria ocorrência ou gestão"
  ON public.ocorrencia_fotos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ocorrencias_notebook o
    WHERE o.id = ocorrencia_fotos.ocorrencia_id
      AND (o.user_id = auth.uid() OR public.is_gestao(auth.uid()))
  ));

-- lembretes
DROP POLICY IF EXISTS "Vê lembretes próprios ou gestão" ON public.lembretes;
CREATE POLICY "Vê lembretes próprios ou gestão"
  ON public.lembretes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- provas
DROP POLICY IF EXISTS "Vê provas próprias ou gestão" ON public.provas;
CREATE POLICY "Vê provas próprias ou gestão"
  ON public.provas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- gabaritos
DROP POLICY IF EXISTS "Vê gabaritos próprios ou gestão" ON public.gabaritos;
CREATE POLICY "Vê gabaritos próprios ou gestão"
  ON public.gabaritos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas pr
    WHERE pr.id = gabaritos.prova_id
      AND (pr.user_id = auth.uid() OR public.is_gestao(auth.uid()))
  ));

-- resultados_prova
DROP POLICY IF EXISTS "Vê resultados próprios ou gestão" ON public.resultados_prova;
CREATE POLICY "Vê resultados próprios ou gestão"
  ON public.resultados_prova FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- tipos_avaliacao
DROP POLICY IF EXISTS "Vê tipos avaliação próprios ou gestão" ON public.tipos_avaliacao;
CREATE POLICY "Vê tipos avaliação próprios ou gestão"
  ON public.tipos_avaliacao FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- ajustes_plano
DROP POLICY IF EXISTS "Vê ajustes do próprio plano ou gestão" ON public.ajustes_plano;
CREATE POLICY "Vê ajustes do próprio plano ou gestão"
  ON public.ajustes_plano FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.planos_aula p
    WHERE p.id = ajustes_plano.plano_id
      AND (p.user_id = auth.uid() OR public.is_gestao(auth.uid()))
  ));

-- profiles
DROP POLICY IF EXISTS "Coordenação vê todos os perfis" ON public.profiles;
CREATE POLICY "Gestão vê todos os perfis"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_gestao(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Coordenação vê todos os papéis" ON public.user_roles;
CREATE POLICY "Gestão vê todos os papéis"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_gestao(auth.uid()));