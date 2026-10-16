
-- 1) Nova tabela
CREATE TABLE public.planejamentos_bimestrais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre integer NOT NULL CHECK (bimestre BETWEEN 1 AND 4),
  ano integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando_validacao','validado')),
  validado_por uuid REFERENCES auth.users(id),
  validado_em timestamptz,
  observacao_validacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turma_id, disciplina_id, bimestre, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamentos_bimestrais TO authenticated;
GRANT ALL ON public.planejamentos_bimestrais TO service_role;

ALTER TABLE public.planejamentos_bimestrais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor cria próprios planejamentos"
  ON public.planejamentos_bimestrais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ver próprios ou gestão vê todos"
  ON public.planejamentos_bimestrais FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

CREATE POLICY "Professor edita próprios OU gestão valida"
  ON public.planejamentos_bimestrais FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_gestao(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_gestao(auth.uid()));

CREATE POLICY "Professor apaga próprios planejamentos"
  ON public.planejamentos_bimestrais FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_planejamentos_bimestrais_updated_at
  BEFORE UPDATE ON public.planejamentos_bimestrais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Coluna em planos_aula
ALTER TABLE public.planos_aula
  ADD COLUMN planejamento_id uuid REFERENCES public.planejamentos_bimestrais(id) ON DELETE SET NULL;

CREATE INDEX idx_planos_aula_planejamento ON public.planos_aula(planejamento_id);

-- 3) Coluna em plano_anexos
ALTER TABLE public.plano_anexos
  ADD COLUMN tipo text NOT NULL DEFAULT 'documento' CHECK (tipo IN ('documento','adaptada'));

-- 4) Backfill: cria planejamento por (user_id, turma_id, disciplina_id, bimestre, ano)
DO $$
DECLARE
  r record;
  pid uuid;
  novo_status text;
BEGIN
  FOR r IN
    SELECT user_id, turma_id, disciplina_id, bimestre,
           COALESCE(EXTRACT(YEAR FROM MIN(data_aula))::int, EXTRACT(YEAR FROM now())::int) AS ano,
           bool_or(status = 'aprovado') AS algum_aprovado
    FROM public.planos_aula
    WHERE user_id IS NOT NULL AND turma_id IS NOT NULL
    GROUP BY user_id, turma_id, disciplina_id, bimestre
  LOOP
    novo_status := CASE WHEN r.algum_aprovado THEN 'validado' ELSE 'rascunho' END;
    INSERT INTO public.planejamentos_bimestrais (user_id, turma_id, disciplina_id, bimestre, ano, status, validado_em)
    VALUES (r.user_id, r.turma_id, r.disciplina_id, r.bimestre, r.ano, novo_status,
            CASE WHEN r.algum_aprovado THEN now() ELSE NULL END)
    ON CONFLICT (user_id, turma_id, disciplina_id, bimestre, ano) DO NOTHING
    RETURNING id INTO pid;

    IF pid IS NULL THEN
      SELECT id INTO pid FROM public.planejamentos_bimestrais
      WHERE user_id = r.user_id AND turma_id = r.turma_id
        AND disciplina_id IS NOT DISTINCT FROM r.disciplina_id
        AND bimestre = r.bimestre AND ano = r.ano;
    END IF;

    UPDATE public.planos_aula
      SET planejamento_id = pid
      WHERE user_id = r.user_id AND turma_id = r.turma_id
        AND disciplina_id IS NOT DISTINCT FROM r.disciplina_id
        AND bimestre = r.bimestre
        AND planejamento_id IS NULL;
  END LOOP;
END $$;
