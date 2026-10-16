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

-- Alunos
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

-- Disciplinas
CREATE TABLE public.disciplinas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  professor TEXT,
  carga_horaria INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de avaliação
CREATE TABLE public.tipos_avaliacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  peso NUMERIC(5,2) DEFAULT 1.0,
  bimestre INTEGER DEFAULT 1,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notas
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

-- Planos de aula
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ocorrências de Notebook
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

-- Provas
CREATE TABLE public.provas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  bimestre INTEGER DEFAULT 1,
  titulo TEXT NOT NULL,
  numero_questoes INTEGER NOT NULL DEFAULT 10,
  data_aplicacao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gabaritos
CREATE TABLE public.gabaritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prova_id UUID REFERENCES public.provas(id) ON DELETE CASCADE,
  numero_questao INTEGER NOT NULL,
  resposta_correta TEXT NOT NULL,
  peso NUMERIC(5,2) DEFAULT 1.0,
  anulada BOOLEAN DEFAULT FALSE,
  UNIQUE(prova_id, numero_questao)
);

-- Resultados de provas
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

-- Enable RLS
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

CREATE POLICY "Allow all turmas" ON public.turmas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all alunos" ON public.alunos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all disciplinas" ON public.disciplinas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all tipos_avaliacao" ON public.tipos_avaliacao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all notas" ON public.notas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all planos_aula" ON public.planos_aula FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ocorrencias" ON public.ocorrencias_notebook FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all provas" ON public.provas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all gabaritos" ON public.gabaritos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all resultados" ON public.resultados_prova FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notas_updated_at BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos_aula FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ocorrencias_updated_at BEFORE UPDATE ON public.ocorrencias_notebook FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();