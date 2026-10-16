import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, Users, GraduationCap, BookOpen, ClipboardList,
  CheckCircle, Clock, Laptop, Filter, RefreshCw, BarChart3,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/ui-escola';
import {
  GraficoPizza, GraficoBarraTurma, GraficoTipoAvaliacao,
  type SituacaoData, type MediaTurmaData, type TipoAvalData,
} from '@/components/dashboard/DashboardCharts';
import { cn } from '@/lib/utils';

interface Professor { id: string; nome: string; email: string }
interface Turma { id: string; nome: string }
interface Disciplina { id: string; nome: string; user_id: string }

function ChartCard({ title, icon, children, className }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-xl shadow-card overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function GestaoDashboard() {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);

  const [fProfessor, setFProfessor] = useState('');
  const [fTurma, setFTurma] = useState('');
  const [fDisciplina, setFDisciplina] = useState('');
  const [fBimestre, setFBimestre] = useState('');

  const [kpi, setKpi] = useState({
    professores: 0, turmas: 0, alunos: 0,
    aprovados: 0, recuperacao: 0, abaixoMedia: 0,
    planosAprovados: 0, planosPendentes: 0, ocorrencias: 0,
  });
  const [pizza, setPizza] = useState<SituacaoData[]>([]);
  const [porTurma, setPorTurma] = useState<MediaTurmaData[]>([]);
  const [porProfessor, setPorProfessor] = useState<TipoAvalData[]>([]);
  const [porDisciplina, setPorDisciplina] = useState<TipoAvalData[]>([]);
  const [loading, setLoading] = useState(true);

  const disciplinasFiltradas = useMemo(
    () => fProfessor ? disciplinas.filter(d => d.user_id === fProfessor) : disciplinas,
    [disciplinas, fProfessor]
  );

  useEffect(() => {
    (async () => {
      const [profRes, rolesRes, turmasRes, discRes] = await Promise.all([
        supabase.from('profiles').select('id, nome, email'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('turmas').select('id, nome').order('nome'),
        supabase.from('disciplinas').select('id, nome, user_id'),
      ]);
      const profsIds = new Set(
        (rolesRes.data || []).filter(r => r.role === 'professor').map(r => r.user_id)
      );
      setProfessores((profRes.data || []).filter(p => profsIds.has(p.id)));
      setTurmas(turmasRes.data || []);
      setDisciplinas(discRes.data || []);
    })();
  }, []);

  const carregar = React.useCallback(async () => {
    setLoading(true);
    try {
      // Notas com filtros
      let qNotas = supabase.from('notas').select('nota, aluno_id, user_id, bimestre, tipo_avaliacao_id');
      if (fProfessor) qNotas = qNotas.eq('user_id', fProfessor);
      if (fBimestre) qNotas = qNotas.eq('bimestre', Number(fBimestre));
      const { data: notas = [] } = await qNotas;

      // Tipos de avaliação para filtrar por disciplina/turma
      const { data: tipos = [] } = await supabase
        .from('tipos_avaliacao')
        .select('id, disciplina_id, turma_id, peso');
      const tipoMap = new Map(tipos.map(t => [t.id, t]));

      // Filtra notas por turma/disciplina via tipo_avaliacao
      const notasFiltradas = (notas || []).filter(n => {
        if (!fTurma && !fDisciplina) return true;
        const t = n.tipo_avaliacao_id ? tipoMap.get(n.tipo_avaliacao_id) : null;
        if (fTurma && t?.turma_id !== fTurma) return false;
        if (fDisciplina && t?.disciplina_id !== fDisciplina) return false;
        return true;
      });

      // Alunos
      let qAlunos = supabase.from('alunos').select('id, turma_id', { count: 'exact' }).eq('ativo', true);
      if (fTurma) qAlunos = qAlunos.eq('turma_id', fTurma);
      const { data: alunos = [], count: alunosCount } = await qAlunos;

      // Médias por aluno (média ponderada pelo peso do tipo)
      const porAluno = new Map<string, { soma: number; pesos: number }>();
      notasFiltradas.forEach(n => {
        if (!n.aluno_id || n.nota == null) return;
        const peso = (n.tipo_avaliacao_id ? tipoMap.get(n.tipo_avaliacao_id)?.peso : null) ?? 1;
        const cur = porAluno.get(n.aluno_id) || { soma: 0, pesos: 0 };
        cur.soma += Number(n.nota) * Number(peso);
        cur.pesos += Number(peso);
        porAluno.set(n.aluno_id, cur);
      });
      let aprovados = 0, recuperacao = 0, abaixo = 0;
      const mediasAluno: { id: string; media: number; turma_id: string | null }[] = [];
      (alunos || []).forEach(a => {
        const reg = porAluno.get(a.id);
        if (!reg || reg.pesos === 0) return;
        const m = reg.soma / reg.pesos;
        mediasAluno.push({ id: a.id, media: m, turma_id: a.turma_id });
        if (m >= 7) aprovados++;
        else if (m >= 5) recuperacao++;
        else abaixo++;
      });

      // Médias por turma
      const turmaMap = new Map(turmas.map(t => [t.id, t.nome]));
      const acumTurma = new Map<string, { soma: number; n: number }>();
      mediasAluno.forEach(m => {
        if (!m.turma_id) return;
        const cur = acumTurma.get(m.turma_id) || { soma: 0, n: 0 };
        cur.soma += m.media; cur.n += 1;
        acumTurma.set(m.turma_id, cur);
      });
      const mediasTurma: MediaTurmaData[] = Array.from(acumTurma.entries())
        .map(([id, v]) => ({ turma: turmaMap.get(id) || '—', media: +(v.soma / v.n).toFixed(2) }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 12);

      // Médias por professor
      const profMap = new Map(professores.map(p => [p.id, p.nome || p.email]));
      const acumProf = new Map<string, { soma: number; n: number }>();
      notasFiltradas.forEach(n => {
        if (!n.user_id || n.nota == null) return;
        const cur = acumProf.get(n.user_id) || { soma: 0, n: 0 };
        cur.soma += Number(n.nota); cur.n += 1;
        acumProf.set(n.user_id, cur);
      });
      const mediasProf: TipoAvalData[] = Array.from(acumProf.entries())
        .map(([id, v]) => ({ nome: profMap.get(id) || '—', media: +(v.soma / v.n).toFixed(2) }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 10);

      // Médias por disciplina
      const discNome = new Map(disciplinas.map(d => [d.id, d.nome]));
      const acumDisc = new Map<string, { soma: number; n: number }>();
      notasFiltradas.forEach(n => {
        const did = n.tipo_avaliacao_id ? tipoMap.get(n.tipo_avaliacao_id)?.disciplina_id : null;
        if (!did || n.nota == null) return;
        const cur = acumDisc.get(did) || { soma: 0, n: 0 };
        cur.soma += Number(n.nota); cur.n += 1;
        acumDisc.set(did, cur);
      });
      const mediasDisc: TipoAvalData[] = Array.from(acumDisc.entries())
        .map(([id, v]) => ({ nome: discNome.get(id) || '—', media: +(v.soma / v.n).toFixed(2) }))
        .sort((a, b) => b.media - a.media)
        .slice(0, 10);

      // Planos
      let qPlanos = supabase.from('planos_aula').select('status, user_id, turma_id, disciplina_id, bimestre');
      if (fProfessor) qPlanos = qPlanos.eq('user_id', fProfessor);
      if (fTurma) qPlanos = qPlanos.eq('turma_id', fTurma);
      if (fDisciplina) qPlanos = qPlanos.eq('disciplina_id', fDisciplina);
      if (fBimestre) qPlanos = qPlanos.eq('bimestre', Number(fBimestre));
      const { data: planos = [] } = await qPlanos;
      const planosAprovados = (planos || []).filter(p => p.status === 'aprovado').length;
      const planosPendentes = (planos || []).filter(p => p.status !== 'aprovado').length;

      // Ocorrências
      let qOcc = supabase.from('ocorrencias_notebook').select('id', { count: 'exact', head: true });
      if (fProfessor) qOcc = qOcc.eq('user_id', fProfessor);
      if (fTurma) qOcc = qOcc.eq('turma_id', fTurma);
      const { count: occCount } = await qOcc;

      setKpi({
        professores: professores.length,
        turmas: turmas.length,
        alunos: alunosCount || 0,
        aprovados, recuperacao, abaixoMedia: abaixo,
        planosAprovados, planosPendentes,
        ocorrencias: occCount || 0,
      });
      setPizza([
        { name: 'Aprovados', value: aprovados },
        { name: 'Recuperação', value: recuperacao },
        { name: 'Abaixo da média', value: abaixo },
      ]);
      setPorTurma(mediasTurma);
      setPorProfessor(mediasProf);
      setPorDisciplina(mediasDisc);
    } finally {
      setLoading(false);
    }
  }, [fProfessor, fTurma, fDisciplina, fBimestre, professores, turmas, disciplinas]);

  useEffect(() => { carregar(); }, [carregar]);

  const limpar = () => {
    setFProfessor(''); setFTurma(''); setFDisciplina(''); setFBimestre('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel da Gestão"
        subtitle="Visão consolidada de toda a escola — somente leitura"
        
      />

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Filtros</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={fProfessor}
            onChange={e => { setFProfessor(e.target.value); setFDisciplina(''); }}
          >
            <option value="">Todos os professores</option>
            {professores.map(p => (
              <option key={p.id} value={p.id}>{p.nome || p.email}</option>
            ))}
          </select>
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={fTurma}
            onChange={e => setFTurma(e.target.value)}
          >
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={fDisciplina}
            onChange={e => setFDisciplina(e.target.value)}
          >
            <option value="">Todas as matérias</option>
            {disciplinasFiltradas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={fBimestre}
            onChange={e => setFBimestre(e.target.value)}
          >
            <option value="">Todos os bimestres</option>
            <option value="1">1º bimestre</option>
            <option value="2">2º bimestre</option>
            <option value="3">3º bimestre</option>
            <option value="4">4º bimestre</option>
          </select>
          <button
            onClick={limpar}
            className="flex items-center justify-center gap-2 border border-border rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Limpar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Professores" value={kpi.professores} icon={<Users className="w-5 h-5" />} />
        <StatCard title="Turmas" value={kpi.turmas} icon={<GraduationCap className="w-5 h-5" />} />
        <StatCard title="Alunos" value={kpi.alunos} icon={<GraduationCap className="w-5 h-5" />} />
        <StatCard title="Aprovados" value={kpi.aprovados} icon={<CheckCircle className="w-5 h-5" />} color="green" />
        <StatCard title="Recuperação" value={kpi.recuperacao} icon={<Clock className="w-5 h-5" />} color="yellow" />
        <StatCard title="Abaixo da média" value={kpi.abaixoMedia} icon={<ClipboardList className="w-5 h-5" />} color="red" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard title="Planos aprovados" value={kpi.planosAprovados} icon={<CheckCircle className="w-5 h-5" />} color="green" />
        <StatCard title="Planos pendentes" value={kpi.planosPendentes} icon={<BookOpen className="w-5 h-5" />} color="yellow" />
        <StatCard title="Ocorrências" value={kpi.ocorrencias} icon={<Laptop className="w-5 h-5" />} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Situação geral dos alunos" icon={<BarChart3 className="w-4 h-4" />}>
          {pizza.some(p => p.value > 0)
            ? <GraficoPizza data={pizza} />
            : <p className="text-sm text-muted-foreground p-6 text-center">Sem dados de notas para o filtro atual.</p>}
        </ChartCard>
        <ChartCard title="Média por turma" icon={<BarChart3 className="w-4 h-4" />} className="lg:col-span-2">
          {porTurma.length
            ? <GraficoBarraTurma data={porTurma} />
            : <p className="text-sm text-muted-foreground p-6 text-center">Sem dados.</p>}
        </ChartCard>
        <ChartCard title="Média por professor" icon={<BarChart3 className="w-4 h-4" />}>
          {porProfessor.length
            ? <GraficoTipoAvaliacao data={porProfessor} />
            : <p className="text-sm text-muted-foreground p-6 text-center">Sem dados.</p>}
        </ChartCard>
        <ChartCard title="Média por matéria" icon={<BarChart3 className="w-4 h-4" />} className="lg:col-span-2">
          {porDisciplina.length
            ? <GraficoTipoAvaliacao data={porDisciplina} />
            : <p className="text-sm text-muted-foreground p-6 text-center">Sem dados.</p>}
        </ChartCard>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando dados consolidados…</p>}
    </div>
  );
}