
-- =========================================================
-- 1) LIMPEZA DOS DADOS OPERACIONAIS
-- =========================================================
TRUNCATE TABLE
  public.ajustes_plano,
  public.resultados_prova,
  public.gabaritos,
  public.provas,
  public.notas,
  public.tipos_avaliacao,
  public.ocorrencia_fotos,
  public.ocorrencias_notebook,
  public.lembretes,
  public.planos_aula,
  public.alunos,
  public.turmas,
  public.disciplinas
RESTART IDENTITY CASCADE;

-- =========================================================
-- 2) ADICIONAR user_id NAS TABELAS POR PROFESSOR
-- =========================================================
ALTER TABLE public.disciplinas           ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.planos_aula           ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ocorrencias_notebook  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lembretes             ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.provas                ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tipos_avaliacao       ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notas                 ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.resultados_prova      ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_disciplinas_user           ON public.disciplinas(user_id);
CREATE INDEX idx_planos_aula_user           ON public.planos_aula(user_id);
CREATE INDEX idx_ocorrencias_user           ON public.ocorrencias_notebook(user_id);
CREATE INDEX idx_lembretes_user             ON public.lembretes(user_id);
CREATE INDEX idx_provas_user                ON public.provas(user_id);
CREATE INDEX idx_tipos_avaliacao_user       ON public.tipos_avaliacao(user_id);
CREATE INDEX idx_notas_user                 ON public.notas(user_id);
CREATE INDEX idx_resultados_user            ON public.resultados_prova(user_id);

-- =========================================================
-- 3) DROPAR TODAS AS POLÍTICAS "ALLOW ALL" EXISTENTES
-- =========================================================
DROP POLICY IF EXISTS "Allow all disciplinas"       ON public.disciplinas;
DROP POLICY IF EXISTS "Allow all planos_aula"       ON public.planos_aula;
DROP POLICY IF EXISTS "Allow all ocorrencias"       ON public.ocorrencias_notebook;
DROP POLICY IF EXISTS "Allow all ocorrencia_fotos"  ON public.ocorrencia_fotos;
DROP POLICY IF EXISTS "Allow all lembretes"         ON public.lembretes;
DROP POLICY IF EXISTS "Allow all provas"            ON public.provas;
DROP POLICY IF EXISTS "Allow all gabaritos"         ON public.gabaritos;
DROP POLICY IF EXISTS "Allow all resultados"        ON public.resultados_prova;
DROP POLICY IF EXISTS "Allow all tipos_avaliacao"   ON public.tipos_avaliacao;
DROP POLICY IF EXISTS "Allow all notas"             ON public.notas;
DROP POLICY IF EXISTS "Allow all alunos"            ON public.alunos;
DROP POLICY IF EXISTS "Allow all turmas"            ON public.turmas;
DROP POLICY IF EXISTS "Allow all ajustes_plano"     ON public.ajustes_plano;

-- =========================================================
-- 4) TURMAS E ALUNOS — COMPARTILHADOS ENTRE PROFESSORES
-- =========================================================
CREATE POLICY "Auth pode ver turmas"   ON public.turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth pode criar turmas" ON public.turmas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth pode editar turmas" ON public.turmas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth pode apagar turmas" ON public.turmas FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth pode ver alunos"   ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth pode criar alunos" ON public.alunos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth pode editar alunos" ON public.alunos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth pode apagar alunos" ON public.alunos FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 5) DISCIPLINAS — POR PROFESSOR (gestão vê todas)
-- =========================================================
CREATE POLICY "Professor vê próprias disciplinas"
  ON public.disciplinas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Professor cria próprias disciplinas"
  ON public.disciplinas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprias disciplinas"
  ON public.disciplinas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprias disciplinas"
  ON public.disciplinas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 6) PLANOS DE AULA — POR PROFESSOR + APROVAÇÃO PELA GESTÃO
-- =========================================================
CREATE POLICY "Vê planos próprios ou todos se gestão"
  ON public.planos_aula FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Professor cria próprios planos"
  ON public.planos_aula FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprios planos OU gestão aprova"
  ON public.planos_aula FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Professor apaga próprios planos"
  ON public.planos_aula FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Ajustes do plano: vinculados ao plano dono
CREATE POLICY "Vê ajustes do próprio plano ou gestão"
  ON public.ajustes_plano FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planos_aula p
      WHERE p.id = plano_id
        AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'coordenador'))
    )
  );

CREATE POLICY "Professor cria ajustes nos próprios planos"
  ON public.ajustes_plano FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Professor apaga ajustes nos próprios planos"
  ON public.ajustes_plano FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
  );

-- =========================================================
-- 7) OCORRÊNCIAS DE NOTEBOOK
-- =========================================================
CREATE POLICY "Vê ocorrências próprias ou gestão"
  ON public.ocorrencias_notebook FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Professor cria próprias ocorrências"
  ON public.ocorrencias_notebook FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprias ocorrências"
  ON public.ocorrencias_notebook FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprias ocorrências"
  ON public.ocorrencias_notebook FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Vê fotos da própria ocorrência ou gestão"
  ON public.ocorrencia_fotos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ocorrencias_notebook o
      WHERE o.id = ocorrencia_id
        AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'coordenador'))
    )
  );

CREATE POLICY "Professor cria fotos nas próprias ocorrências"
  ON public.ocorrencia_fotos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.ocorrencias_notebook o WHERE o.id = ocorrencia_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Professor apaga fotos das próprias ocorrências"
  ON public.ocorrencia_fotos FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ocorrencias_notebook o WHERE o.id = ocorrencia_id AND o.user_id = auth.uid())
  );

-- =========================================================
-- 8) LEMBRETES
-- =========================================================
CREATE POLICY "Vê lembretes próprios ou gestão"
  ON public.lembretes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Professor cria próprios lembretes"
  ON public.lembretes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professor edita próprios lembretes"
  ON public.lembretes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Professor apaga próprios lembretes"
  ON public.lembretes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 9) PROVAS, GABARITOS, RESULTADOS
-- =========================================================
CREATE POLICY "Vê provas próprias ou gestão"
  ON public.provas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));
CREATE POLICY "Professor cria próprias provas"
  ON public.provas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Professor edita próprias provas"
  ON public.provas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Professor apaga próprias provas"
  ON public.provas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Vê gabaritos próprios ou gestão"
  ON public.gabaritos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.provas pr
      WHERE pr.id = prova_id
        AND (pr.user_id = auth.uid() OR public.has_role(auth.uid(), 'coordenador'))
    )
  );
CREATE POLICY "Professor cria gabaritos nas próprias provas"
  ON public.gabaritos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid()));
CREATE POLICY "Professor edita gabaritos nas próprias provas"
  ON public.gabaritos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid()));
CREATE POLICY "Professor apaga gabaritos nas próprias provas"
  ON public.gabaritos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid()));

CREATE POLICY "Vê resultados próprios ou gestão"
  ON public.resultados_prova FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));
CREATE POLICY "Professor cria próprios resultados"
  ON public.resultados_prova FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Professor edita próprios resultados"
  ON public.resultados_prova FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Professor apaga próprios resultados"
  ON public.resultados_prova FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 10) TIPOS DE AVALIAÇÃO E NOTAS
-- =========================================================
CREATE POLICY "Vê tipos avaliação próprios ou gestão"
  ON public.tipos_avaliacao FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));
CREATE POLICY "Professor cria próprios tipos avaliação"
  ON public.tipos_avaliacao FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Professor edita próprios tipos avaliação"
  ON public.tipos_avaliacao FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Professor apaga próprios tipos avaliação"
  ON public.tipos_avaliacao FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Vê notas próprias ou gestão"
  ON public.notas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'coordenador'));
CREATE POLICY "Professor cria próprias notas"
  ON public.notas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Professor edita próprias notas"
  ON public.notas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Professor apaga próprias notas"
  ON public.notas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 11) PROFILES — gestão pode ver todos
-- =========================================================
CREATE POLICY "Coordenação vê todos os perfis"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador'));

-- =========================================================
-- 12) USER_ROLES — gestão pode ver todos
-- =========================================================
CREATE POLICY "Coordenação vê todos os papéis"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador'));

-- =========================================================
-- 13) STORAGE — fotos de ocorrência por professor
-- =========================================================
DROP POLICY IF EXISTS "Public Access ocorrencias-fotos"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload ocorrencias-fotos"     ON storage.objects;
DROP POLICY IF EXISTS "Auth delete ocorrencias-fotos"     ON storage.objects;

CREATE POLICY "Vê próprias fotos ou gestão"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ocorrencias-fotos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'coordenador')
    )
  );

CREATE POLICY "Professor envia próprias fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ocorrencias-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Professor apaga próprias fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ocorrencias-fotos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
