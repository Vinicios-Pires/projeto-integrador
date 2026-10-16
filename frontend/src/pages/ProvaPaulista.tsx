import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, StatCard } from '@/components/ui-escola';
import { usePermissions } from '@/hooks/use-permissions';
import {
  ClipboardList, TrendingUp, TrendingDown, AlertTriangle, Users, Filter, RefreshCw,
  Award, ArrowUpRight, ArrowDownRight, Minus, GraduationCap, Download,
} from 'lucide-react';
import { exportTablePdf } from '@/lib/pdfHelpers';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TipoRow {
  id: string;
  nome: string;
  bimestre: number;
  turma_id: string;
  disciplina_id: string;
  user_id: string;
  categoria: string;
}
interface NotaRow { aluno_id: string; tipo_avaliacao_id: string; nota: number | null; bimestre: number; user_id: string }
interface Aluno { id: string; nome: string; turma_id: string; numero_chamada: number | null; serie: string | null }
interface Turma { id: string; nome: string; serie: string | null }
interface Disciplina { id: string; nome: string; cor: string | null }
interface Profile { id: string; nome: string | null; email: string | null }

const BIMESTRES = [1, 2, 3, 4];
const MEDIA_MINIMA = 6;

function Card({ title, icon, children, className, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-xl shadow-card overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-sm flex-1">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ProvaPaulista() {
  const { isGestao } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState<TipoRow[]>([]);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [professores, setProfessores] = useState<Profile[]>([]);

  // Filtros
  const [fProfessor, setFProfessor] = useState<string>('all');
  const [fSerie, setFSerie] = useState<string>('all');
  const [fTurma, setFTurma] = useState<string>('all');
  const [fDisciplina, setFDisciplina] = useState<string>('all');
  const [fBimestre, setFBimestre] = useState<string>('all');
  const [fAluno, setFAluno] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tiposData } = await (supabase as any).from('tipos_avaliacao')
      .select('id, nome, bimestre, turma_id, disciplina_id, user_id, categoria')
      .eq('categoria', 'prova_paulista');
    const tiposArr: TipoRow[] = (tiposData || []) as TipoRow[];
    setTipos(tiposArr);

    if (tiposArr.length === 0) {
      setNotas([]); setAlunos([]); setTurmas([]); setDisciplinas([]); setProfessores([]);
      setLoading(false); return;
    }
    const tipoIds = tiposArr.map(t => t.id);
    const turmaIds = Array.from(new Set(tiposArr.map(t => t.turma_id).filter(Boolean)));
    const discIds = Array.from(new Set(tiposArr.map(t => t.disciplina_id).filter(Boolean)));
    const userIds = Array.from(new Set(tiposArr.map(t => t.user_id).filter(Boolean)));

    const [
      { data: notasData },
      { data: alunosData },
      { data: turmasData },
      { data: discData },
      { data: profData },
    ] = await Promise.all([
      supabase.from('notas').select('aluno_id, tipo_avaliacao_id, nota, bimestre, user_id').in('tipo_avaliacao_id', tipoIds),
      supabase.from('alunos').select('id, nome, turma_id, numero_chamada, serie').in('turma_id', turmaIds.length ? turmaIds : ['00000000-0000-0000-0000-000000000000']).eq('ativo', true).order('numero_chamada'),
      supabase.from('turmas').select('id, nome, serie').in('id', turmaIds.length ? turmaIds : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('disciplinas').select('id, nome, cor').in('id', discIds.length ? discIds : ['00000000-0000-0000-0000-000000000000']),
      isGestao && userIds.length
        ? supabase.from('profiles').select('id, nome, email').in('id', userIds)
        : Promise.resolve({ data: [] as Profile[] }),
    ]);
    setNotas((notasData || []) as NotaRow[]);
    setAlunos((alunosData || []) as Aluno[]);
    setTurmas((turmasData || []) as Turma[]);
    setDisciplinas((discData || []) as Disciplina[]);
    setProfessores((profData || []) as Profile[]);
    setLoading(false);
  }, [isGestao]);

  useEffect(() => { load(); }, [load]);

  // ── Aplica filtros aos tipos
  const tiposFiltrados = useMemo(() => tipos.filter(t => {
    if (fProfessor !== 'all' && t.user_id !== fProfessor) return false;
    if (fTurma !== 'all' && t.turma_id !== fTurma) return false;
    if (fDisciplina !== 'all' && t.disciplina_id !== fDisciplina) return false;
    if (fBimestre !== 'all' && t.bimestre !== parseInt(fBimestre)) return false;
    if (fSerie !== 'all') {
      const tur = turmas.find(x => x.id === t.turma_id);
      if (!tur || tur.serie !== fSerie) return false;
    }
    return true;
  }), [tipos, fProfessor, fTurma, fDisciplina, fBimestre, fSerie, turmas]);

  const tipoIdsFiltrados = useMemo(() => new Set(tiposFiltrados.map(t => t.id)), [tiposFiltrados]);
  const turmasComPP = useMemo(() => new Set(tipos.map(t => t.turma_id)), [tipos]);
  const discsComPP = useMemo(() => new Set(tipos.map(t => t.disciplina_id)), [tipos]);

  // Alunos elegíveis (turmas que têm Prova Paulista)
  const alunosFiltrados = useMemo(() => {
    const turmaIdsValidos = new Set(tiposFiltrados.map(t => t.turma_id));
    return alunos.filter(a => turmaIdsValidos.has(a.turma_id) &&
      (!fAluno.trim() || a.nome.toLowerCase().includes(fAluno.toLowerCase())));
  }, [alunos, tiposFiltrados, fAluno]);

  // notas filtradas
  const notasFiltradas = useMemo(() =>
    notas.filter(n => tipoIdsFiltrados.has(n.tipo_avaliacao_id)), [notas, tipoIdsFiltrados]);

  // ── Por bimestre: média geral
  const mediaPorBimestre = useMemo(() => {
    return BIMESTRES.map(b => {
      const tiposB = tiposFiltrados.filter(t => t.bimestre === b).map(t => t.id);
      const ns = notas.filter(n => tiposB.includes(n.tipo_avaliacao_id) && n.nota != null);
      const media = ns.length ? ns.reduce((s, n) => s + Number(n.nota), 0) / ns.length : null;
      return { bimestre: `${b}º Bim`, media: media != null ? Number(media.toFixed(2)) : null, alunos: new Set(ns.map(n => n.aluno_id)).size };
    });
  }, [tiposFiltrados, notas]);

  // ── Por aluno: bimestres
  const evolucaoAlunos = useMemo(() => {
    return alunosFiltrados.map(a => {
      const linha: Record<string, any> = { id: a.id, nome: a.nome, turma_id: a.turma_id };
      BIMESTRES.forEach(b => {
        const tiposB = tiposFiltrados.filter(t => t.bimestre === b && t.turma_id === a.turma_id).map(t => t.id);
        const ns = notas.filter(n => n.aluno_id === a.id && tiposB.includes(n.tipo_avaliacao_id) && n.nota != null);
        linha[`b${b}`] = ns.length ? Number((ns.reduce((s, n) => s + Number(n.nota), 0) / ns.length).toFixed(2)) : null;
      });
      const bims = BIMESTRES.map(b => linha[`b${b}`]).filter((v): v is number => v != null);
      linha.media = bims.length ? Number((bims.reduce((s, v) => s + v, 0) / bims.length).toFixed(2)) : null;
      const first = bims[0], last = bims[bims.length - 1];
      linha.diff = (first != null && last != null) ? Number((last - first).toFixed(2)) : null;
      linha.faltaNota = bims.length === 0;
      return linha;
    });
  }, [alunosFiltrados, tiposFiltrados, notas]);

  // ── KPIs
  const kpis = useMemo(() => {
    const mediaGeral = (() => {
      const valid = notasFiltradas.filter(n => n.nota != null);
      return valid.length ? (valid.reduce((s, n) => s + Number(n.nota), 0) / valid.length) : 0;
    })();
    const totalAlunos = alunosFiltrados.length;
    const abaixo = evolucaoAlunos.filter(a => a.media != null && a.media < MEDIA_MINIMA).length;
    const semNota = evolucaoAlunos.filter(a => a.faltaNota).length;
    return { mediaGeral, totalAlunos, abaixo, semNota };
  }, [notasFiltradas, alunosFiltrados, evolucaoAlunos]);

  // ── Alunos que precisam de atenção (gera alertas)
  type Alerta = { alunoId: string; nome: string; turma: string; tipo: string; detalhe: string; severity: 'high' | 'mid' | 'low' };
  const alertas: Alerta[] = useMemo(() => {
    const arr: Alerta[] = [];
    evolucaoAlunos.forEach(a => {
      const turmaNome = turmas.find(t => t.id === a.turma_id)?.nome || '—';
      if (a.faltaNota) {
        arr.push({ alunoId: a.id, nome: a.nome, turma: turmaNome, tipo: 'Sem nota cadastrada', detalhe: 'Nenhuma nota de Prova Paulista lançada', severity: 'mid' });
        return;
      }
      if (a.media != null && a.media < MEDIA_MINIMA) {
        arr.push({ alunoId: a.id, nome: a.nome, turma: turmaNome, tipo: 'Abaixo da média', detalhe: `Média ${a.media.toFixed(1)} (< ${MEDIA_MINIMA})`, severity: a.media < 4 ? 'high' : 'mid' });
      }
      if (a.diff != null && a.diff < -0.5) {
        arr.push({ alunoId: a.id, nome: a.nome, turma: turmaNome, tipo: 'Queda de desempenho', detalhe: `Variação ${a.diff.toFixed(1)} entre bimestres`, severity: 'high' });
      } else if (a.diff != null && Math.abs(a.diff) <= 0.3 && a.media != null && a.media < 7) {
        arr.push({ alunoId: a.id, nome: a.nome, turma: turmaNome, tipo: 'Sem evolução', detalhe: `Variação ${a.diff.toFixed(1)} entre bimestres`, severity: 'low' });
      }
    });
    return arr.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));
  }, [evolucaoAlunos, turmas]);

  // ── Ranking
  const rankingEvolucao = useMemo(() => {
    return evolucaoAlunos
      .filter(a => a.diff != null)
      .sort((a, b) => b.diff - a.diff);
  }, [evolucaoAlunos]);

  // ── Aluno individual selecionado (primeiro filtrado se busca exata)
  const alunoSelecionado = useMemo(() => {
    if (!fAluno.trim()) return null;
    return evolucaoAlunos[0] || null;
  }, [fAluno, evolucaoAlunos]);

  const evolucaoIndividualData = useMemo(() => {
    if (!alunoSelecionado) return [];
    return BIMESTRES.map(b => ({ bimestre: `${b}º Bim`, nota: alunoSelecionado[`b${b}`] }));
  }, [alunoSelecionado]);

  // ── Séries únicas
  const series = useMemo(() => {
    const s = new Set<string>();
    turmas.forEach(t => { if (t.serie) s.add(t.serie); });
    return Array.from(s).sort();
  }, [turmas]);

  const turmasOpcoes = useMemo(() => turmas.filter(t => turmasComPP.has(t.id)), [turmas, turmasComPP]);
  const discsOpcoes = useMemo(() => disciplinas.filter(d => discsComPP.has(d.id)), [disciplinas, discsComPP]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Prova Paulista" subtitle="Acompanhamento da evolução dos alunos por bimestre">
        <Button variant="outline" size="sm" onClick={() => exportTablePdf({
          title: 'Prova Paulista — Alertas',
          subtitle: `Média geral: ${kpis.mediaGeral.toFixed(2)} · Avaliados: ${kpis.totalAlunos} · Abaixo da média: ${kpis.abaixo}`,
          columns: ['Aluno', 'Turma', 'Alerta', 'Detalhe'],
          rows: alertas.map(a => [a.nome, a.turma, a.tipo, a.detalhe]),
          filename: 'prova_paulista_alertas.pdf',
          orientation: 'landscape',
        })}><Download className="w-4 h-4 mr-1.5" />Gerar PDF</Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {isGestao && (
          <Select value={fProfessor} onValueChange={setFProfessor}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Professor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os professores</SelectItem>
              {professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={fSerie} onValueChange={setFSerie}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Série" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas séries</SelectItem>
            {series.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fTurma} onValueChange={setFTurma}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {turmasOpcoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fDisciplina} onValueChange={setFDisciplina}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {discsOpcoes.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fBimestre} onValueChange={setFBimestre}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Bimestre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os bimestres</SelectItem>
            {BIMESTRES.map(b => <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Buscar aluno..." value={fAluno} onChange={e => setFAluno(e.target.value)} className="w-48 h-9" />
      </div>

      {/* Estado vazio */}
      {!loading && tipos.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Nenhuma Prova Paulista cadastrada</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Para alimentar este painel, crie uma avaliação no módulo de <strong>Notas</strong> e marque a opção <em>"Marcar como Prova Paulista"</em>.
          </p>
        </div>
      )}

      {tipos.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Média geral" value={kpis.mediaGeral.toFixed(2)} icon={<Award className="w-5 h-5" />} color="blue" subtitle="Todas Prova Paulista" />
            <StatCard title="Alunos avaliados" value={kpis.totalAlunos} icon={<Users className="w-5 h-5" />} color="green" />
            <StatCard title="Abaixo da média" value={kpis.abaixo} icon={<TrendingDown className="w-5 h-5" />} color="red" subtitle={`< ${MEDIA_MINIMA}`} />
            <StatCard title="Sem nota" value={kpis.semNota} icon={<AlertTriangle className="w-5 h-5" />} color="yellow" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Comparativo turma por bimestre */}
            <Card title="Média por bimestre" icon={<TrendingUp className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mediaPorBimestre}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="bimestre" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => v == null ? '—' : v} />
                  <Bar dataKey="media" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Evolução individual */}
            <Card title={alunoSelecionado ? `Evolução: ${alunoSelecionado.nome}` : 'Evolução individual'}
              icon={<GraduationCap className="w-4 h-4" />}>
              {alunoSelecionado ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={evolucaoIndividualData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bimestre" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => v == null ? 'Sem nota' : v} />
                    <Line type="monotone" dataKey="nota" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-12">
                  Digite o nome de um aluno no filtro acima para ver sua evolução individual.
                </div>
              )}
            </Card>
          </div>

          {/* Alunos que precisam de atenção */}
          <Card title={`Alunos que precisam de atenção (${alertas.length})`} icon={<AlertTriangle className="w-4 h-4" />}>
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum alerta no momento. Todos os alunos estão acompanhando bem.</p>
            ) : (
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Aluno</th>
                      <th className="text-left px-2 py-2 font-medium">Turma</th>
                      <th className="text-left px-2 py-2 font-medium">Alerta</th>
                      <th className="text-left px-2 py-2 font-medium">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.slice(0, 30).map((a, i) => (
                      <tr key={i} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-4 py-2 font-medium">{a.nome}</td>
                        <td className="px-2 py-2 text-muted-foreground">{a.turma}</td>
                        <td className="px-2 py-2">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold',
                            a.severity === 'high' && 'bg-destructive/15 text-destructive',
                            a.severity === 'mid' && 'bg-warning/15 text-warning',
                            a.severity === 'low' && 'bg-muted text-muted-foreground',
                          )}>{a.tipo}</span>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{a.detalhe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Top evolução" icon={<ArrowUpRight className="w-4 h-4" />}>
              <RankingList items={rankingEvolucao.slice(0, 8)} direction="up" />
            </Card>
            <Card title="Maiores quedas" icon={<ArrowDownRight className="w-4 h-4" />}>
              <RankingList items={[...rankingEvolucao].reverse().slice(0, 8)} direction="down" />
            </Card>
          </div>

          {/* Tabela completa por aluno */}
          <Card title="Evolução por aluno" icon={<ClipboardList className="w-4 h-4" />}>
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-2 font-medium">Aluno</th>
                    {BIMESTRES.map(b => <th key={b} className="px-2 py-2 font-medium text-center">{b}º Bim</th>)}
                    <th className="px-2 py-2 font-medium text-center">Média</th>
                    <th className="px-2 py-2 font-medium text-center">Variação</th>
                    <th className="px-4 py-2 font-medium text-center">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {evolucaoAlunos.map(a => (
                    <tr key={a.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">{a.nome}</td>
                      {BIMESTRES.map(b => (
                        <td key={b} className="px-2 py-2 text-center tabular-nums">
                          {a[`b${b}`] != null ? (
                            <span className={cn(
                              'inline-block px-1.5 rounded',
                              a[`b${b}`] >= 7 && 'text-success font-semibold',
                              a[`b${b}`] < MEDIA_MINIMA && 'text-destructive font-semibold',
                            )}>{a[`b${b}`].toFixed(1)}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold tabular-nums">
                        {a.media != null ? a.media.toFixed(2) : '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {a.diff == null ? <Minus className="w-3 h-3 inline text-muted-foreground" /> :
                          a.diff > 0 ? <span className="text-success font-semibold inline-flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />+{a.diff.toFixed(1)}</span> :
                          a.diff < 0 ? <span className="text-destructive font-semibold inline-flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />{a.diff.toFixed(1)}</span> :
                          <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {a.faltaNota ? <span className="text-[11px] text-warning font-semibold">SEM NOTA</span> :
                          a.media == null ? '—' :
                          a.media >= 7 ? <span className="text-[11px] text-success font-semibold">OK</span> :
                          a.media >= MEDIA_MINIMA ? <span className="text-[11px] text-warning font-semibold">ATENÇÃO</span> :
                          <span className="text-[11px] text-destructive font-semibold">CRÍTICO</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function RankingList({ items, direction }: { items: any[]; direction: 'up' | 'down' }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Sem dados suficientes.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((a, i) => (
        <li key={a.id} className="flex items-center gap-2 text-sm py-1 border-b border-border/60 last:border-0">
          <span className="w-5 text-muted-foreground tabular-nums text-xs">{i + 1}º</span>
          <span className="flex-1 truncate">{a.nome}</span>
          <span className={cn('font-semibold tabular-nums text-xs',
            direction === 'up' ? 'text-success' : 'text-destructive')}>
            {a.diff > 0 ? '+' : ''}{a.diff.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}