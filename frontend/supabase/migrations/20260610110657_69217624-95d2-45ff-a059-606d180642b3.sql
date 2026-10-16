-- 1) Função auxiliar: o usuário tem acesso ao aluno?
CREATE OR REPLACE FUNCTION public.can_access_aluno(_user_id uuid, _aluno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_gestao(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.alunos a
      JOIN public.turma_disciplinas td ON td.turma_id = a.turma_id
      WHERE a.id = _aluno_id
        AND td.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.turma_membros tm
      WHERE tm.aluno_id = _aluno_id
        AND tm.user_id = _user_id
    );
$$;

-- 2) Função auxiliar: o usuário tem acesso à turma (para inserir alunos)?
CREATE OR REPLACE FUNCTION public.can_access_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_gestao(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.turma_disciplinas td
      WHERE td.turma_id = _turma_id AND td.user_id = _user_id
    );
$$;

-- 3) Substituir políticas excessivamente permissivas em public.alunos
DROP POLICY IF EXISTS "Auth pode ver alunos" ON public.alunos;
DROP POLICY IF EXISTS "Auth pode criar alunos" ON public.alunos;
DROP POLICY IF EXISTS "Auth pode editar alunos" ON public.alunos;
DROP POLICY IF EXISTS "Auth pode apagar alunos" ON public.alunos;

CREATE POLICY "Ver alunos das próprias turmas ou gestão"
  ON public.alunos FOR SELECT
  TO authenticated
  USING (public.can_access_aluno(auth.uid(), id));

CREATE POLICY "Criar alunos em turmas próprias"
  ON public.alunos FOR INSERT
  TO authenticated
  WITH CHECK (
    turma_id IS NOT NULL
    AND public.can_access_turma(auth.uid(), turma_id)
    AND NOT public.is_gestao(auth.uid())
  );

CREATE POLICY "Editar alunos das próprias turmas"
  ON public.alunos FOR UPDATE
  TO authenticated
  USING (
    public.can_access_aluno(auth.uid(), id)
    AND NOT public.is_gestao(auth.uid())
  )
  WITH CHECK (
    public.can_access_aluno(auth.uid(), id)
    AND NOT public.is_gestao(auth.uid())
  );

CREATE POLICY "Apagar alunos das próprias turmas"
  ON public.alunos FOR DELETE
  TO authenticated
  USING (
    public.can_access_aluno(auth.uid(), id)
    AND NOT public.is_gestao(auth.uid())
  );

-- 4) Remover políticas públicas (anônimas) do bucket ocorrencias-fotos.
--    Mantemos apenas as políticas de usuários autenticados/gestão já existentes.
DROP POLICY IF EXISTS "Public read ocorrencias-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public insert ocorrencias-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete ocorrencias-fotos" ON storage.objects;
