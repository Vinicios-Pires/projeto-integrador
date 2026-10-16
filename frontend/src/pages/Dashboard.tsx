import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  School, GraduationCap, BookOpen, Laptop,
  TrendingUp, Users, CheckCircle, XCircle, Clock,
  Filter, RefreshCw, BarChart3, Award, ArrowRight,
} from 'lucide-react';
import { PageHeader, StatCard, BadgeSituacao } from '@/components/ui-escola';
import { cn } from '@/lib/utils';
import {
  GraficoPizza, GraficoBarraTurma, GraficoEvolucao,
  GraficoTipoAvaliacao, GraficoDistribuicao, GraficoAlunos,
  type SituacaoData, type MediaTurmaData, type EvolucaoData,
  type TipoAvalData, type DistribuicaoData, type AlunoDesempenhoData,
} from '@/components/dashboard/DashboardCharts';
import { PostItBoard } from '@/components/dashboard/PostItBoard';

interface Turma { id: string; nome: string }
interface Disciplina { id: string; nome: string }

function calcSituacao(media: number) {
  if (media >= 7) return 'Aprovado';
  if (media >= 5) return 'Recuperação';
  return 'Abaixo da média';
}

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

function ProvaPaulistaCard() {
  const [data, setData] = useState<{ media: number; alunos: number; abaixo: number; bimestres: { bimestre: string; media: number | null }[] } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: tipos } = await (supabase as any).from('tipos_avaliacao')
        .select('id, bimestre').eq('categoria', 'prova_paulista');
      if (!tipos || tipos.length === 0) { setData({ media: 0, alunos: 0, abaixo: 0, bimestres: [] }); return; }
      const ids = tipos.map((t: any) => t.id);
      const { data: ns } = await supabase.from('notas').select('aluno_id, nota, tipo_avaliacao_id, bimestre').in('tipo_avaliacao_id', ids);
      const valid = (ns || []).filter((n: any) => n.nota != null);
      const media = valid.length ? valid.reduce((s: number, n: any) => s + Number(n.nota), 0) / valid.length : 0;
      // por aluno
      const porAluno = new Map<string, number[]>();
      valid.forEach((n: any) => {
        if (!porAluno.has(n.aluno_id)) porAluno.set(n.aluno_id, []);
        porAluno.get(n.aluno_id)!.push(Number(n.nota));
      });
      let abaixo = 0;
      porAluno.forEach(arr => { const m = arr.reduce((s, v) => s + v, 0) / arr.length; if (m < 6) abaixo++; });
      const bims = [1, 2, 3, 4].map(b => {
        const tids = tipos.filter((t: any) => t.bimestre === b).map((t: any) => t.id);
        const sub = valid.filter((n: any) => tids.includes(n.tipo_avaliacao_id));
        return { bimestre: `${b}º`, media: sub.length ? Number((sub.reduce((s: number, n: any) => s + Number(n.nota), 0) / sub.length).toFixed(2)) : null };
      });
      setData({ media, alunos: porAluno.size, abaixo, bimestres: bims });
    })();
  }, []);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Prova Paulista</h2>
            <p className="text-xs text-muted-foreground">Acompanhamento de evolução por bimestre</p>
          </div>
        </div>
        <Link to="/prova-paulista" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline">
          Ver detalhes <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-card/70 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Média</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{data ? data.media.toFixed(2) : '—'}</p>
        </div>
        <div className="bg-card/70 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Alunos</p>
          <p className="text-xl font-bold">{data?.alunos ?? '—'}</p>
        </div>
        <div className="bg-card/70 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atenção</p>
          <p className="text-xl font-bold text-destructive">{data?.abaixo ?? '—'}</p>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-12">
        {(data?.bimestres ?? [1, 2, 3, 4].map(b => ({ bimestre: `${b}º`, media: null }))).map(b => (
          <div key={b.bimestre} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full bg-amber-400/70 rounded-t" style={{ height: `${((b.media ?? 0) / 10) * 100}%`, minHeight: b.media != null ? 4 : 0 }} />
            <span className="text-[10px] text-muted-foreground">{b.bimestre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [fTurma, setFTurma] = useState('');
  const [fDisciplina, setFDisciplina] = useState('');
  const [fBimestre, setFBimestre] = useState('');
  const [kpi, setKpi] = useState({
    turmas: 0, alunos: 0, planos: 0, ocorrencias: 0,
    aprovados: 0, recuperacao: 0, abaixoMedia: 0,
  });
  const [dadosPizza, setDadosPizza] = useState<SituacaoData[]>([]);
  const [dadosBarraTurma, setDadosBarraTurma] = useState<MediaTurmaData[]>([]);
  const [dadosEvolucao, setDadosEvolucao] = useState<EvolucaoData[]>([]);
  const [evolucaoKeys, setEvolucaoKeys] = useState<string[]>([]);
  const [dadosTipoAval, setDadosTipoAval] = useState<TipoAvalData[]>([]);
  const [dadosDistrib, setDadosDistrib] = useState<DistribuicaoData[]>([]);
  const [dadosAlunos, setDadosAlunos] = useState<AlunoDesempenhoData[]>([]);
  const [proximosPlanos, setProximosPlanos] = useState<any[]>([]);
  const [alunosBaixo, setAlunosBaixo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { count: cTurmas }, { count: cAlunos }, { count: cPlanos }, { count: cOcorrencias },
      { data: turmasData }, { data: disciplinasData },
    ] = await Promise.all([
      supabase.from('turmas').select('*', { count: 'exact', head: true }),
      supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('planos_aula').select('*', { count: 'exact', head: true }),
      supabase.from('ocorrencias_notebook').select('*', { count: 'exact', head: true }),
      supabase.from('turmas').select('id, nome').order('nome'),
      supabase.from('disciplinas').select('id, nome').order('nome'),
    ]);
    setTurmas(turmasData || []);
    setDisciplinas(disciplinasData || []);

    let notasQ = supabase
      .from('notas')
      .select('nota, bimestre, aluno_id, tipo_avaliacao_id, alunos!inner(nome, turma_id, turmas(nome)), tipos_avaliacao(nome, turma_id, disciplina_id)');
    if (fBimestre) notasQ = notasQ.eq('bimestre', Number(fBimestre));
    if (fTurma) notasQ = notasQ.eq('alunos.turma_id', fTurma);
    const { data: notasData } = await notasQ;
    const notas = (notasData || []) as any[];

    const notasFilt = fDisciplina
      ? notas.filter(n => n.tipos_avaliacao?.disciplina_id === fDisciplina)
      : notas;

    const mediaAluno: Record<string, { soma: number; cnt: number; nome: string; turma: string }> = {};
    notasFilt.forEach(n => {
      if (!n.aluno_id || n.nota == null) return;
      const nome = n.alunos?.nome || '?';
      const turma = n.alunos?.turmas?.nome || '?';
      if (!mediaAluno[n.aluno_id]) mediaAluno[n.aluno_id] = { soma: 0, cnt: 0, nome, turma };
      mediaAluno[n.aluno_id].soma += Number(n.nota);
      mediaAluno[n.aluno_id].cnt++;
    });

    let aprovados = 0, recuperacao = 0, abaixoMedia = 0;
    const alunosList = Object.values(mediaAluno).map(a => {
      const media = a.cnt > 0 ? a.soma / a.cnt : 0;
      const sit = calcSituacao(media);
      if (sit === 'Aprovado') aprovados++;
      else if (sit === 'Recuperação') recuperacao++;
      else abaixoMedia++;
      return { nome: a.nome, media: parseFloat(media.toFixed(2)), turma: a.turma };
    });

    setKpi({ turmas: cTurmas || 0, alunos: cAlunos || 0, planos: cPlanos || 0, ocorrencias: cOcorrencias || 0, aprovados, recuperacao, abaixoMedia });

    setDadosPizza([
      { name: 'Aprovados', value: aprovados },
      { name: 'Recuperação', value: recuperacao },
      { name: 'Abaixo da média', value: abaixoMedia },
    ]);

    const mediaPorTurma: Record<string, { soma: number; cnt: number }> = {};
    notasFilt.forEach(n => {
      const t = n.alunos?.turmas?.nome;
      if (!t || n.nota == null) return;
      if (!mediaPorTurma[t]) mediaPorTurma[t] = { soma: 0, cnt: 0 };
      mediaPorTurma[t].soma += Number(n.nota);
      mediaPorTurma[t].cnt++;
    });
    setDadosBarraTurma(
      Object.entries(mediaPorTurma).map(([turma, v]) => ({ turma, media: parseFloat((v.soma / v.cnt).toFixed(2)) }))
    );

    const evBim: Record<number, { soma: number; cnt: number }> = {};
    notas.forEach(n => {
      const b = n.bimestre || 1;
      if (n.nota == null) return;
      if (!evBim[b]) evBim[b] = { soma: 0, cnt: 0 };
      evBim[b].soma += Number(n.nota);
      evBim[b].cnt++;
    });
    const evolData: EvolucaoData[] = Object.entries(evBim)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([bim, v]) => ({ label: `${bim}º Bim`, Média: parseFloat((v.soma / v.cnt).toFixed(2)) }));
    setDadosEvolucao(evolData);
    setEvolucaoKeys(evolData.length > 0 ? ['Média'] : []);

    const tipoMap: Record<string, { soma: number; cnt: number }> = {};
    notasFilt.forEach(n => {
      const t = n.tipos_avaliacao?.nome;
      if (!t || n.nota == null) return;
      if (!tipoMap[t]) tipoMap[t] = { soma: 0, cnt: 0 };
      tipoMap[t].soma += Number(n.nota);
      tipoMap[t].cnt++;
    });
    setDadosTipoAval(Object.entries(tipoMap).map(([nome, v]) => ({ nome, media: parseFloat((v.soma / v.cnt).toFixed(2)) })));

    const faixas: DistribuicaoData[] = [
      { faixa: '0–2', quantidade: 0 }, { faixa: '2–4', quantidade: 0 },
      { faixa: '4–6', quantidade: 0 }, { faixa: '6–8', quantidade: 0 }, { faixa: '8–10', quantidade: 0 },
    ];
    notasFilt.forEach(n => {
      const v = Number(n.nota);
      if (v < 2) faixas[0].quantidade++;
      else if (v < 4) faixas[1].quantidade++;
      else if (v < 6) faixas[2].quantidade++;
      else if (v < 8) faixas[3].quantidade++;
      else faixas[4].quantidade++;
    });
    setDadosDistrib(faixas);

    const sorted = alunosList.sort((a, b) => a.media - b.media).slice(0, 12);
    setDadosAlunos(sorted);
    setAlunosBaixo(alunosList.filter(a => a.media < 5).slice(0, 6));

    let planosQ = supabase
      .from('planos_aula')
      .select('*, turmas(nome), disciplinas(nome)')
      .gte('data_aula', new Date().toISOString().split('T')[0])
      .order('data_aula', { ascending: true })
      .limit(5);
    if (fTurma) planosQ = planosQ.eq('turma_id', fTurma);
    const { data: planosData } = await planosQ;
    setProximosPlanos(planosData || []);

    setLoading(false);
  }, [fTurma, fDisciplina, fBimestre]);

  useEffect(() => { load(); }, [load]);

  const totalComNota = kpi.aprovados + kpi.recuperacao + kpi.abaixoMedia;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle={`Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      >
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:bg-border transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Atualizar
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center bg-card border border-border rounded-xl px-4 py-2.5">
        <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <select value={fTurma} onChange={e => setFTurma(e.target.value)}
          className="bg-secondary border-0 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Todas as turmas</option>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={fDisciplina} onChange={e => setFDisciplina(e.target.value)}
          className="bg-secondary border-0 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Todas as disciplinas</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select value={fBimestre} onChange={e => setFBimestre(e.target.value)}
          className="bg-secondary border-0 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Todos os bimestres</option>
          {[1, 2, 3, 4].map(b => <option key={b} value={b}>{b}º Bimestre</option>)}
        </select>
        {(fTurma || fDisciplina || fBimestre) && (
          <button onClick={() => { setFTurma(''); setFDisciplina(''); setFBimestre(''); }}
            className="text-xs text-destructive hover:underline">Limpar filtros</button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard title="Turmas" value={kpi.turmas} icon={<School className="w-5 h-5" />} color="blue" subtitle="ativas" />
        <StatCard title="Alunos" value={kpi.alunos} icon={<GraduationCap className="w-5 h-5" />} color="green" subtitle="matriculados" />
        <StatCard title="Planos" value={kpi.planos} icon={<BookOpen className="w-5 h-5" />} color="yellow" subtitle="de aula" />
        <StatCard title="Ocorrências" value={kpi.ocorrencias} icon={<Laptop className="w-5 h-5" />} color="red" subtitle="notebook" />
        <StatCard title="Aprovados" value={kpi.aprovados} icon={<CheckCircle className="w-5 h-5" />} color="green" subtitle={totalComNota > 0 ? `${Math.round(kpi.aprovados / totalComNota * 100)}%` : '—'} />
        <StatCard title="Recuperação" value={kpi.recuperacao} icon={<Clock className="w-5 h-5" />} color="yellow" subtitle={totalComNota > 0 ? `${Math.round(kpi.recuperacao / totalComNota * 100)}%` : '—'} />
        <StatCard title="Abaixo da média" value={kpi.abaixoMedia} icon={<XCircle className="w-5 h-5" />} color="red" subtitle={totalComNota > 0 ? `${Math.round(kpi.abaixoMedia / totalComNota * 100)}%` : '—'} />
      </div>

      {/* Post-its */}
      <div className="bg-card border border-border rounded-xl shadow-card p-4">
        <PostItBoard />
      </div>

      {/* Card Prova Paulista */}
      <ProvaPaulistaCard />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Situação dos Alunos" icon={<Users className="w-4 h-4" />}>
          {totalComNota === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Sem notas lançadas</p>
          ) : (
            <>
              <GraficoPizza data={dadosPizza} />
              <div className="flex justify-center gap-4 mt-1">
                <span className="text-xs text-success font-semibold">{kpi.aprovados} aprovados</span>
                <span className="text-xs text-warning font-semibold">{kpi.recuperacao} recuperação</span>
                <span className="text-xs text-destructive font-semibold">{kpi.abaixoMedia} abaixo da média</span>
              </div>
            </>
          )}
        </ChartCard>
        <ChartCard title="Média por Turma" icon={<BarChart3 className="w-4 h-4" />}>
          {dadosBarraTurma.length === 0 ? <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p> : <GraficoBarraTurma data={dadosBarraTurma} />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Evolução por Bimestre" icon={<TrendingUp className="w-4 h-4" />}>
          {dadosEvolucao.length === 0 ? <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p> : <GraficoEvolucao data={dadosEvolucao} keys={evolucaoKeys} />}
        </ChartCard>
        <ChartCard title="Média por Tipo de Avaliação" icon={<BarChart3 className="w-4 h-4" />}>
          {dadosTipoAval.length === 0 ? <p className="text-center text-muted-foreground text-sm py-10">Sem dados</p> : <GraficoTipoAvaliacao data={dadosTipoAval} />}
        </ChartCard>
      </div>

      <ChartCard title="Distribuição das Notas" icon={<BarChart3 className="w-4 h-4" />}>
        <GraficoDistribuicao data={dadosDistrib} />
      </ChartCard>

      {dadosAlunos.length > 0 && (
        <ChartCard title="Desempenho por Aluno (ordenado por nota)" icon={<Users className="w-4 h-4" />}>
          <GraficoAlunos data={dadosAlunos} />
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl shadow-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Próximas Aulas Planejadas</h2>
          </div>
          <div className="divide-y divide-border/50">
            {proximosPlanos.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Nenhum plano futuro</p>
            ) : proximosPlanos.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-light flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary leading-tight">{formatDate(p.data_aula).split('/')[0]}</span>
                  <span className="text-xs text-primary/70 leading-tight">{formatDate(p.data_aula).split('/')[1]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.disciplinas?.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.turmas?.nome} · {p.conteudo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <XCircle className="w-4 h-4 text-warning" />
            <h2 className="font-semibold text-sm">Alunos Abaixo da Média</h2>
          </div>
          <div className="divide-y divide-border/50">
            {alunosBaixo.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-success mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Todos com notas boas!</p>
              </div>
            ) : alunosBaixo.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-danger-light flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-destructive">{a.media.toFixed(1)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{a.turma}</p>
                </div>
                <BadgeSituacao situacao={calcSituacao(a.media)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-glow rounded-xl p-4 text-primary-foreground">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5" />
          <h2 className="font-semibold">Resumo Geral {new Date().getFullYear()}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Aulas Planejadas', value: kpi.planos, icon: <BookOpen className="w-4 h-4" /> },
            { label: 'Total de Alunos', value: kpi.alunos, icon: <Users className="w-4 h-4" /> },
            { label: 'Ocorrências', value: kpi.ocorrencias, icon: <Laptop className="w-4 h-4" /> },
            { label: 'Turmas', value: kpi.turmas, icon: <School className="w-4 h-4" /> },
          ].map(item => (
            <div key={item.label} className="bg-white/10 rounded-lg p-3 text-center">
              <div className="flex justify-center mb-1 opacity-80">{item.icon}</div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs opacity-75">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
