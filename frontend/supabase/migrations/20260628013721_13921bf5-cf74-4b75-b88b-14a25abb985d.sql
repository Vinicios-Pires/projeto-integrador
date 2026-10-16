-- =============================================================
-- RESTAURAÇÃO COMPLETA DO SISTEMA ESCOLAR (23 migrations históricas consolidadas)
-- =============================================================

-- Turmas
CREATE TABLE public.turmas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  serie TEXT NOT NULL,
  turno TEXT NOT NULL DEFAULT 'Manhã',
  ano_letivo INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  capacidade INTEGER DEFAULT 35,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  numero_chamada INTEGER,
  serie TEXT,
  data_nascimento DATE,
  email TEXT,
  telefone TEXT,
  responsavel TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.disciplinas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  professor TEXT,
  carga_horaria INTEGER,
  cor text DEFAULT 'azul',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tipos_avaliacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  peso NUMERIC(5,2) DEFAULT 1.0,
  bimestre INTEGER DEFAULT 1,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  categoria text NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo_avaliacao_id UUID REFERENCES public.tipos_avaliacao(id) ON DELETE CASCADE,
  nota NUMERIC(5,2),
  bimestre INTEGER DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aluno_id, tipo_avaliacao_id)
);

CREATE TABLE public.planos_aula (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre INTEGER NOT NULL DEFAULT 1,
  data_aula DATE NOT NULL,
  dia_semana TEXT,
  numero_aulas INTEGER DEFAULT 1,
  aprendizagem_essencial TEXT,
  conteudo TEXT,
  objetivos TEXT,
  recursos TEXT,
  desenvolvimento TEXT,
  material_digital TEXT,
  avaliacao_aprendizagem TEXT,
  aulas_previstas INTEGER,
  professor TEXT,
  duplicado_de UUID REFERENCES public.planos_aula(id),
  tipo text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pendente',
  aprovado_por text,
  data_aprovacao timestamp with time zone,
  comentario_aprovacao text,
  habilidades text,
  objetivo_geral text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ocorrencias_notebook (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  data_ocorrencia DATE NOT NULL DEFAULT CURRENT_DATE,
  quantidade_notebooks INTEGER DEFAULT 0,
  alunos_envolvidos TEXT,
  problema_encontrado TEXT,
  descricao TEXT,
  equipamento_danificado BOOLEAN DEFAULT FALSE,
  internet_funcionou BOOLEAN DEFAULT TRUE,
  solucao_adotada TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.provas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre INTEGER DEFAULT 1,
  titulo TEXT NOT NULL,
  numero_questoes INTEGER NOT NULL DEFAULT 10,
  data_aplicacao DATE,
  observacoes TEXT,
  valor_total numeric DEFAULT 10,
  escola text,
  professor text,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.gabaritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prova_id UUID REFERENCES public.provas(id) ON DELETE CASCADE,
  numero_questao INTEGER NOT NULL,
  resposta_correta TEXT NOT NULL,
  peso NUMERIC(5,2) DEFAULT 1.0,
  anulada BOOLEAN DEFAULT FALSE,
  UNIQUE(prova_id, numero_questao)
);

CREATE TABLE public.resultados_prova (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prova_id UUID REFERENCES public.provas(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  respostas JSONB,
  acertos INTEGER,
  nota NUMERIC(5,2),
  ajuste_manual BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prova_id, aluno_id)
);

CREATE TABLE public.lembretes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  cor TEXT NOT NULL DEFAULT 'amarelo',
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  fixado BOOLEAN NOT NULL DEFAULT false,
  posicao INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ajustes_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES public.planos_aula(id) ON DELETE CASCADE NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ocorrencia_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid REFERENCES public.ocorrencias_notebook(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('pendente','ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.app_role AS ENUM ('professor', 'coordenador', 'direcao', 'vice_direcao', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'professor',
  UNIQUE (user_id, role)
);

-- user_id por professor
ALTER TABLE public.disciplinas           ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.planos_aula           ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ocorrencias_notebook  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lembretes             ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.provas                ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tipos_avaliacao       ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notas                 ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.resultados_prova      ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.turmas                ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_disciplinas_user     ON public.disciplinas(user_id);
CREATE INDEX idx_planos_aula_user     ON public.planos_aula(user_id);
CREATE INDEX idx_ocorrencias_user     ON public.ocorrencias_notebook(user_id);
CREATE INDEX idx_lembretes_user       ON public.lembretes(user_id);
CREATE INDEX idx_provas_user          ON public.provas(user_id);
CREATE INDEX idx_tipos_avaliacao_user ON public.tipos_avaliacao(user_id);
CREATE INDEX idx_notas_user           ON public.notas(user_id);
CREATE INDEX idx_resultados_user      ON public.resultados_prova(user_id);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas, public.alunos, public.disciplinas, public.tipos_avaliacao, public.notas, public.planos_aula, public.ocorrencias_notebook, public.provas, public.gabaritos, public.resultados_prova, public.lembretes, public.ajustes_plano, public.ocorrencia_fotos, public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.turmas, public.alunos, public.disciplinas, public.tipos_avaliacao, public.notas, public.planos_aula, public.ocorrencias_notebook, public.provas, public.gabaritos, public.resultados_prova, public.lembretes, public.ajustes_plano, public.ocorrencia_fotos, public.profiles, public.user_roles TO service_role;

-- RLS ENABLE
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_avaliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias_notebook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gabaritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_prova ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_plano ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencia_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

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

-- Trigger on auth.users: cria profile e promove admin se for o email-mestre
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers updated_at
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notas_updated_at BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos_aula FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ocorrencias_updated_at BEFORE UPDATE ON public.ocorrencias_notebook FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lembretes_updated_at BEFORE UPDATE ON public.lembretes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- POLICIES
-- =========================
-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Gestao ve todos perfis" ON public.profiles FOR SELECT TO authenticated USING (public.is_gestao(auth.uid()));
CREATE POLICY "Admin atualiza perfis" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Gestao ve papeis" ON public.user_roles FOR SELECT TO authenticated USING (public.is_gestao(auth.uid()));
CREATE POLICY "Admin gerencia papeis" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- turmas
CREATE POLICY "Ver turmas dono/atribuida/gestao" ON public.turmas FOR SELECT TO authenticated USING (
  public.is_gestao(auth.uid()) OR user_id = auth.uid()
);
CREATE POLICY "Criar turmas dono" ON public.turmas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Editar turmas dono" ON public.turmas FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Apagar turmas dono" ON public.turmas FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- alunos
CREATE POLICY "Ver alunos auth" ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criar alunos auth" ON public.alunos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Editar alunos auth" ON public.alunos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Apagar alunos auth" ON public.alunos FOR DELETE TO authenticated USING (true);

-- disciplinas
CREATE POLICY "Ver disciplinas dono/gestao" ON public.disciplinas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar disciplinas dono" ON public.disciplinas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar disciplinas dono" ON public.disciplinas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar disciplinas dono" ON public.disciplinas FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- planos_aula
CREATE POLICY "Ver planos dono/gestao" ON public.planos_aula FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar planos dono" ON public.planos_aula FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar planos dono/gestao" ON public.planos_aula FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Apagar planos dono" ON public.planos_aula FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ajustes_plano
CREATE POLICY "Ver ajustes dono/gestao" ON public.ajustes_plano FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND (p.user_id = auth.uid() OR public.is_gestao(auth.uid())))
);
CREATE POLICY "Criar ajustes dono" ON public.ajustes_plano FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
);
CREATE POLICY "Apagar ajustes dono" ON public.ajustes_plano FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
);

-- ocorrencias
CREATE POLICY "Ver ocorrencias dono/gestao" ON public.ocorrencias_notebook FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar ocorrencias dono" ON public.ocorrencias_notebook FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar ocorrencias dono" ON public.ocorrencias_notebook FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar ocorrencias dono" ON public.ocorrencias_notebook FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Ver fotos ocorr dono/gestao" ON public.ocorrencia_fotos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ocorrencias_notebook o WHERE o.id = ocorrencia_id AND (o.user_id = auth.uid() OR public.is_gestao(auth.uid())))
);
CREATE POLICY "Criar fotos ocorr dono" ON public.ocorrencia_fotos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.ocorrencias_notebook o WHERE o.id = ocorrencia_id AND o.user_id = auth.uid())
);
CREATE POLICY "Apagar fotos ocorr dono" ON public.ocorrencia_fotos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ocorrencias_notebook o WHERE o.id = ocorrencia_id AND o.user_id = auth.uid())
);

-- lembretes
CREATE POLICY "Ver lembretes dono/gestao" ON public.lembretes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar lembretes dono" ON public.lembretes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar lembretes dono" ON public.lembretes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar lembretes dono" ON public.lembretes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- provas / gabaritos / resultados
CREATE POLICY "Ver provas dono/gestao" ON public.provas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar provas dono" ON public.provas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar provas dono" ON public.provas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar provas dono" ON public.provas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Ver gabaritos dono/gestao" ON public.gabaritos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND (pr.user_id = auth.uid() OR public.is_gestao(auth.uid())))
);
CREATE POLICY "Criar gabaritos dono" ON public.gabaritos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid())
);
CREATE POLICY "Editar gabaritos dono" ON public.gabaritos FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid())
);
CREATE POLICY "Apagar gabaritos dono" ON public.gabaritos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.provas pr WHERE pr.id = prova_id AND pr.user_id = auth.uid())
);

CREATE POLICY "Ver resultados dono/gestao" ON public.resultados_prova FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar resultados dono" ON public.resultados_prova FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar resultados dono" ON public.resultados_prova FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar resultados dono" ON public.resultados_prova FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tipos_avaliacao
CREATE POLICY "Ver tipos dono/gestao" ON public.tipos_avaliacao FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar tipos dono" ON public.tipos_avaliacao FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar tipos dono" ON public.tipos_avaliacao FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar tipos dono" ON public.tipos_avaliacao FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notas
CREATE POLICY "Ver notas dono/gestao" ON public.notas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "Criar notas dono" ON public.notas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Editar notas dono" ON public.notas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Apagar notas dono" ON public.notas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_tipos_avaliacao_categoria ON public.tipos_avaliacao (categoria);

-- =========================
-- TURMA_DISCIPLINAS
-- =========================
CREATE TABLE public.turma_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turma_id, disciplina_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turma_disciplinas TO authenticated;
GRANT ALL ON public.turma_disciplinas TO service_role;
CREATE INDEX idx_td_user ON public.turma_disciplinas (user_id);
CREATE INDEX idx_td_turma ON public.turma_disciplinas (turma_id);
ALTER TABLE public.turma_disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "td insert dono" ON public.turma_disciplinas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "td update dono" ON public.turma_disciplinas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "td delete dono" ON public.turma_disciplinas FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "td select dono/gestao" ON public.turma_disciplinas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));

-- =========================
-- PLANO_ANEXOS
-- =========================
CREATE TABLE public.plano_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos_aula(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  tipo text NOT NULL DEFAULT 'documento' CHECK (tipo IN ('documento','adaptada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_anexos TO authenticated;
GRANT ALL ON public.plano_anexos TO service_role;
ALTER TABLE public.plano_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa select dono/gestao" ON public.plano_anexos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND (p.user_id = auth.uid() OR public.is_gestao(auth.uid())))
);
CREATE POLICY "pa insert dono" ON public.plano_anexos FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
);
CREATE POLICY "pa delete dono" ON public.plano_anexos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.planos_aula p WHERE p.id = plano_id AND p.user_id = auth.uid())
);

-- =========================
-- MEDIAS ARREDONDADAS
-- =========================
CREATE TABLE public.medias_arredondadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  aluno_id UUID NOT NULL,
  turma_id UUID NOT NULL,
  disciplina_id UUID NOT NULL,
  bimestre INTEGER NOT NULL,
  nota_arredondada NUMERIC NOT NULL,
  manual BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, aluno_id, disciplina_id, bimestre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medias_arredondadas TO authenticated;
GRANT ALL ON public.medias_arredondadas TO service_role;
CREATE INDEX idx_ma_lookup ON public.medias_arredondadas (user_id, turma_id, disciplina_id, bimestre);
ALTER TABLE public.medias_arredondadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma select dono/gestao" ON public.medias_arredondadas FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_gestao(auth.uid()));
CREATE POLICY "ma insert dono" ON public.medias_arredondadas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ma update dono" ON public.medias_arredondadas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ma delete dono" ON public.medias_arredondadas FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_ma_updated_at BEFORE UPDATE ON public.medias_arredondadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TURMAS: tipo + turma_membros
-- =========================
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'regular';

CREATE TABLE public.turma_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL,
  aluno_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (turma_id, aluno_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turma_membros TO authenticated;
GRANT ALL ON public.turma_membros TO service_role;
ALTER TABLE public.turma_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm select dono/gestao" ON public.turma_membros FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "tm insert dono" ON public.turma_membros FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tm delete dono" ON public.turma_membros FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- PDI Evidencias + Fotos + Docs
-- =========================
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
CREATE POLICY "pdi insert dono" ON public.pdi_evidencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pdi update dono" ON public.pdi_evidencias FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pdi delete dono" ON public.pdi_evidencias FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pdi select dono/gestao" ON public.pdi_evidencias FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_gestao(auth.uid()));
CREATE TRIGGER update_pdi_updated_at BEFORE UPDATE ON public.pdi_evidencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_pdi_user ON public.pdi_evidencias(user_id);

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
CREATE POLICY "pdif select dono/gestao" ON public.pdi_evidencia_fotos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND (e.user_id = auth.uid() OR is_gestao(auth.uid())))
);
CREATE POLICY "pdif insert dono" ON public.pdi_evidencia_fotos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
);
CREATE POLICY "pdif delete dono" ON public.pdi_evidencia_fotos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
);

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
CREATE POLICY "pdid select dono/gestao" ON public.pdi_evidencia_documentos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND (e.user_id = auth.uid() OR is_gestao(auth.uid())))
);
CREATE POLICY "pdid insert dono" ON public.pdi_evidencia_documentos FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
);
CREATE POLICY "pdid delete dono" ON public.pdi_evidencia_documentos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.pdi_evidencias e WHERE e.id = evidencia_id AND e.user_id = auth.uid())
);

-- =========================
-- AGENDA ESCOLAR PEI
-- =========================
CREATE TYPE public.tipo_bloco_horario AS ENUM ('aula','intervalo','almoco','planejamento','atpc','reuniao','outro');
CREATE TYPE public.tipo_evento_escola AS ENUM ('reuniao','formacao','evento','avaliacao_externa','conselho','apoio_presencial','acompanhamento','observacao','visita','aviso');

CREATE TABLE public.horario_grade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem int NOT NULL,
  rotulo text NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  tipo public.tipo_bloco_horario NOT NULL DEFAULT 'aula',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.horario_grade TO authenticated;
GRANT ALL ON public.horario_grade TO service_role;
ALTER TABLE public.horario_grade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Grade visivel" ON public.horario_grade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia grade" ON public.horario_grade FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.horario_grade (ordem, rotulo, hora_inicio, hora_fim, tipo)
VALUES
  (1, 'Entrada/Acolhimento', '07:00', '07:30', 'outro'),
  (2, '1ª aula', '07:30', '08:20', 'aula'),
  (3, '2ª aula', '08:20', '09:10', 'aula'),
  (4, '3ª aula', '09:10', '10:00', 'aula'),
  (5, 'Intervalo', '10:00', '10:20', 'intervalo'),
  (6, '4ª aula', '10:20', '11:10', 'aula'),
  (7, '5ª aula', '11:10', '12:00', 'aula'),
  (8, 'Almoço', '12:00', '13:00', 'almoco'),
  (9, '6ª aula', '13:00', '13:50', 'aula'),
  (10,'7ª aula', '13:50', '14:40', 'aula'),
  (11,'8ª aula', '14:40', '15:30', 'aula'),
  (12,'9ª aula / ATPC', '15:30', '16:30', 'atpc');

CREATE TABLE public.ano_letivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano int NOT NULL UNIQUE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ano_letivo TO authenticated;
GRANT ALL ON public.ano_letivo TO service_role;
ALTER TABLE public.ano_letivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ano letivo visivel" ON public.ano_letivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia ano letivo" ON public.ano_letivo FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.ano_letivo (ano, data_inicio, data_fim, ativo) VALUES (2026, '2026-02-02', '2026-12-18', true);

CREATE TABLE public.agenda_professor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_grade_id uuid NOT NULL REFERENCES public.horario_grade(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  atividade text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia_semana, horario_grade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_professor TO authenticated;
GRANT ALL ON public.agenda_professor TO service_role;
ALTER TABLE public.agenda_professor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap select" ON public.agenda_professor FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "ap insert" ON public.agenda_professor FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ap update" ON public.agenda_professor FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ap delete" ON public.agenda_professor FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_ap_upd BEFORE UPDATE ON public.agenda_professor FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agenda_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  horario_grade_id uuid NOT NULL REFERENCES public.horario_grade(id) ON DELETE CASCADE,
  disciplina_id uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  atividade text,
  cancelado boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data, horario_grade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_excecoes TO authenticated;
GRANT ALL ON public.agenda_excecoes TO service_role;
ALTER TABLE public.agenda_excecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae select" ON public.agenda_excecoes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "ae insert" ON public.agenda_excecoes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ae update" ON public.agenda_excecoes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ae delete" ON public.agenda_excecoes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_ae_upd BEFORE UPDATE ON public.agenda_excecoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agenda_escola_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  tipo public.tipo_evento_escola NOT NULL DEFAULT 'aviso',
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz,
  dia_todo boolean NOT NULL DEFAULT false,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_escola_eventos TO authenticated;
GRANT ALL ON public.agenda_escola_eventos TO service_role;
ALTER TABLE public.agenda_escola_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evt select all" ON public.agenda_escola_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "evt insert gestao" ON public.agenda_escola_eventos FOR INSERT TO authenticated WITH CHECK (public.is_gestao(auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "evt update gestao" ON public.agenda_escola_eventos FOR UPDATE TO authenticated USING (public.is_gestao(auth.uid())) WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "evt delete gestao" ON public.agenda_escola_eventos FOR DELETE TO authenticated USING (public.is_gestao(auth.uid()));
CREATE TRIGGER trg_evt_upd BEFORE UPDATE ON public.agenda_escola_eventos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.apoio_presencial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por uuid NOT NULL,
  data date NOT NULL,
  horario_grade_id uuid REFERENCES public.horario_grade(id) ON DELETE SET NULL,
  professor_id uuid NOT NULL,
  responsavel_id uuid NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apoio_presencial TO authenticated;
GRANT ALL ON public.apoio_presencial TO service_role;
ALTER TABLE public.apoio_presencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apoio select" ON public.apoio_presencial FOR SELECT TO authenticated USING (professor_id = auth.uid() OR responsavel_id = auth.uid() OR public.is_gestao(auth.uid()));
CREATE POLICY "apoio insert gestao" ON public.apoio_presencial FOR INSERT TO authenticated WITH CHECK (public.is_gestao(auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "apoio update gestao" ON public.apoio_presencial FOR UPDATE TO authenticated USING (public.is_gestao(auth.uid())) WITH CHECK (public.is_gestao(auth.uid()));
CREATE POLICY "apoio delete gestao" ON public.apoio_presencial FOR DELETE TO authenticated USING (public.is_gestao(auth.uid()));
CREATE TRIGGER trg_apoio_upd BEFORE UPDATE ON public.apoio_presencial FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PLANEJAMENTOS BIMESTRAIS
-- =========================
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
CREATE POLICY "pb insert dono" ON public.planejamentos_bimestrais FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pb select dono/gestao" ON public.planejamentos_bimestrais FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "pb update dono/gestao" ON public.planejamentos_bimestrais FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_gestao(auth.uid())) WITH CHECK (auth.uid() = user_id OR public.is_gestao(auth.uid()));
CREATE POLICY "pb delete dono" ON public.planejamentos_bimestrais FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_pb_upd BEFORE UPDATE ON public.planejamentos_bimestrais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.planos_aula ADD COLUMN planejamento_id uuid REFERENCES public.planejamentos_bimestrais(id) ON DELETE SET NULL;
CREATE INDEX idx_planos_planejamento ON public.planos_aula(planejamento_id);

-- =========================
-- REPLICABILIDADES
-- =========================
CREATE TABLE public.replicabilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replicabilidades TO authenticated;
GRANT ALL ON public.replicabilidades TO service_role;
ALTER TABLE public.replicabilidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep dono all" ON public.replicabilidades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rep gestao select" ON public.replicabilidades FOR SELECT TO authenticated USING (public.is_gestao(auth.uid()));
CREATE POLICY "rep admin all" ON public.replicabilidades FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_rep_upd BEFORE UPDATE ON public.replicabilidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.replicabilidade_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  replicabilidade_id uuid NOT NULL REFERENCES public.replicabilidades(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replicabilidade_fotos TO authenticated;
GRANT ALL ON public.replicabilidade_fotos TO service_role;
ALTER TABLE public.replicabilidade_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repf dono all" ON public.replicabilidade_fotos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.replicabilidades r WHERE r.id = replicabilidade_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.replicabilidades r WHERE r.id = replicabilidade_id AND r.user_id = auth.uid()));
CREATE POLICY "repf gestao select" ON public.replicabilidade_fotos FOR SELECT TO authenticated USING (public.is_gestao(auth.uid()));
CREATE POLICY "repf admin all" ON public.replicabilidade_fotos FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- BACKFILL ADMIN se já existe profile
-- =========================
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = 'sverzutivendas@gmail.com';
  IF v_id IS NOT NULL THEN
    UPDATE public.profiles SET status = 'ativo' WHERE id = v_id;
    DELETE FROM public.user_roles WHERE user_id = v_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin'::app_role);
  END IF;
END $$;