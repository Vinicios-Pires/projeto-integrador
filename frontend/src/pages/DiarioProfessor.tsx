import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Plus, MessageSquare, User, Download, Printer, BarChart3, Trash2 } from 'lucide-react';
import { exportTablePdf } from '@/lib/pdfHelpers';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const sb = supabase as any;

type Turma = { id: string; nome: string; serie: string | null };
type Disciplina = { id: string; nome: string; cor: string | null };
type Aluno = { id: string; nome: string; numero_chamada: number | null; turma_id: string; ativo: boolean };
type Atividade = {
  id: string; nome: string; tipo: 'nota' | 'conceito'; data: string | null;
  peso: number | null; observacao: string | null; ordem: number | null; bimestre: number;
  categoria?: string | null;
};

const CATEGORIAS = [
  'Atividade de sala',
  'Tarefa',
  'Caderno',
  'Participação',
  'Laboratório',
  'Trabalho',
  'Seminário',
  'Projeto',
  'Outro',
];
type Lancamento = { id: string; atividade_id: string; aluno_id: string; valor: string | null; fez: boolean | null; observacao: string | null };

export default function DiarioProfessor() {
  const { user } = useAuth();
  const { canEdit } = usePermissions();

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [obsAluno, setObsAluno] = useState<Record<string, string>>({});

  const [turmaId, setTurmaId] = useState<string>('');
  const [disciplinaId, setDisciplinaId] = useState<string>('');
  const [bimestre, setBimestre] = useState<number>(1);
  const [filtroAluno, setFiltroAluno] = useState('');

  const [dlgAtividade, setDlgAtividade] = useState(false);
  const [editandoAtiv, setEditandoAtiv] = useState<Atividade | null>(null);
  const [novaAtiv, setNovaAtiv] = useState<Partial<Atividade>>({ nome: '', tipo: 'nota', peso: 1, categoria: 'Atividade de sala' });

  const [dlgObs, setDlgObs] = useState<{ aluno_id: string; atividade_id?: string } | null>(null);
  const [obsTexto, setObsTexto] = useState('');

  const [dlgPainel, setDlgPainel] = useState<Aluno | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: d }] = await Promise.all([
        sb.from('turmas').select('id,nome,serie').order('nome'),
        sb.from('disciplinas').select('id,nome,cor').order('nome'),
      ]);
      setTurmas(t || []);
      setDisciplinas(d || []);
    })();
  }, []);

  useEffect(() => {
    if (!turmaId) { setAlunos([]); return; }
    (async () => {
      const { data } = await sb.from('alunos')
        .select('id,nome,numero_chamada,turma_id,ativo')
        .eq('turma_id', turmaId).eq('ativo', true)
        .order('numero_chamada', { ascending: true, nullsFirst: false });
      setAlunos(data || []);
    })();
  }, [turmaId]);

  const carregarAtividades = async () => {
    if (!turmaId) return;
    let q = sb.from('diario_atividades').select('*')
      .eq('turma_id', turmaId).eq('bimestre', bimestre)
      .order('ordem', { ascending: true }).order('created_at', { ascending: true });
    if (disciplinaId) q = q.eq('disciplina_id', disciplinaId);
    const { data } = await q;
    setAtividades((data as Atividade[]) || []);
  };

  useEffect(() => { carregarAtividades(); }, [turmaId, disciplinaId, bimestre]);

  useEffect(() => {
    if (!atividades.length) { setLancamentos([]); return; }
    (async () => {
      const ids = atividades.map(a => a.id);
      const { data } = await sb.from('diario_lancamentos').select('*').in('atividade_id', ids);
      setLancamentos((data as Lancamento[]) || []);
    })();
  }, [atividades]);

  useEffect(() => {
    if (!turmaId) return;
    (async () => {
      let q = sb.from('diario_observacoes_aluno').select('aluno_id,observacao')
        .eq('turma_id', turmaId).eq('bimestre', bimestre);
      if (disciplinaId) q = q.eq('disciplina_id', disciplinaId);
      const { data } = await q;
      const map: Record<string, string> = {};
      (data || []).forEach((o: any) => { map[o.aluno_id] = o.observacao; });
      setObsAluno(map);
    })();
  }, [turmaId, disciplinaId, bimestre]);

  const lancMap = useMemo(() => {
    const m: Record<string, Lancamento> = {};
    lancamentos.forEach(l => { m[`${l.atividade_id}:${l.aluno_id}`] = l; });
    return m;
  }, [lancamentos]);

  const alunosFiltrados = useMemo(() => alunos.filter(a =>
    !filtroAluno || a.nome.toLowerCase().includes(filtroAluno.toLowerCase())
  ), [alunos, filtroAluno]);

  async function salvarAtividade() {
    if (!novaAtiv.nome || !turmaId) return;
    if (editandoAtiv) {
      const { error } = await sb.from('diario_atividades').update({
        nome: novaAtiv.nome,
        tipo: novaAtiv.tipo || 'nota',
        data: novaAtiv.data || null,
        peso: novaAtiv.peso ?? 1,
        observacao: novaAtiv.observacao || null,
        categoria: novaAtiv.categoria || null,
      }).eq('id', editandoAtiv.id);
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const payload = {
        user_id: user?.id,
        turma_id: turmaId,
        disciplina_id: disciplinaId || null,
        bimestre,
        nome: novaAtiv.nome,
        tipo: novaAtiv.tipo || 'nota',
        data: novaAtiv.data || null,
        peso: novaAtiv.peso ?? 1,
        observacao: novaAtiv.observacao || null,
        categoria: novaAtiv.categoria || null,
        ordem: atividades.length,
      };
      const { error } = await sb.from('diario_atividades').insert(payload);
      if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setDlgAtividade(false);
    setEditandoAtiv(null);
    setNovaAtiv({ nome: '', tipo: 'nota', peso: 1, categoria: 'Atividade de sala' });
    carregarAtividades();
  }

  function abrirEditarAtividade(a: Atividade) {
    setEditandoAtiv(a);
    setNovaAtiv({
      nome: a.nome, tipo: a.tipo, data: a.data ?? '', peso: a.peso ?? 1,
      observacao: a.observacao ?? '', categoria: a.categoria ?? 'Atividade de sala',
    });
    setDlgAtividade(true);
  }

  async function removerAtividade(id: string, nome: string) {
    if (!confirm(`Excluir a atividade "${nome}" e todos os lançamentos vinculados?\n\nEsta ação não pode ser desfeita.`)) return;
    await sb.from('diario_atividades').delete().eq('id', id);
    carregarAtividades();
  }

  async function salvarCelula(atividade_id: string, aluno_id: string, valor: string) {
    const key = `${atividade_id}:${aluno_id}`;
    const existente = lancMap[key];
    if (existente) {
      if ((existente.valor ?? '') === valor) return;
      const { data } = await sb.from('diario_lancamentos')
        .update({ valor }).eq('id', existente.id).select().single();
      if (data) setLancamentos(prev => prev.map(l => l.id === data.id ? data : l));
    } else {
      const { data } = await sb.from('diario_lancamentos')
        .insert({ user_id: user?.id, atividade_id, aluno_id, valor })
        .select().single();
      if (data) setLancamentos(prev => [...prev, data]);
    }
  }

  async function salvarObsAluno(aluno_id: string, texto: string) {
    const existente = obsAluno[aluno_id];
    if (existente) {
      const { data: rows } = await sb.from('diario_observacoes_aluno').select('id')
        .eq('aluno_id', aluno_id).eq('turma_id', turmaId).eq('bimestre', bimestre)
        .eq('user_id', user?.id).maybeSingle();
      if (rows?.id) {
        await sb.from('diario_observacoes_aluno').update({ observacao: texto }).eq('id', rows.id);
      }
    } else {
      await sb.from('diario_observacoes_aluno').insert({
        user_id: user?.id, aluno_id, turma_id: turmaId,
        disciplina_id: disciplinaId || null, bimestre, observacao: texto,
      });
    }
    setObsAluno(prev => ({ ...prev, [aluno_id]: texto }));
  }

  // Colar do Excel
  function onPasteCelula(e: React.ClipboardEvent, startAtivIdx: number, startAlunoIdx: number) {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const linhas = text.replace(/\r/g, '').split('\n').filter(l => l.length);
    linhas.forEach((linha, i) => {
      const cols = linha.split('\t');
      cols.forEach((val, j) => {
        const ativ = atividades[startAtivIdx + j];
        const aluno = alunosFiltrados[startAlunoIdx + i];
        if (ativ && aluno) salvarCelula(ativ.id, aluno.id, val.trim());
      });
    });
  }

  function statsAluno(alunoId: string) {
    const notas = atividades.map(a => {
      const l = lancMap[`${a.id}:${alunoId}`];
      const num = l?.valor ? parseFloat(l.valor.replace(',', '.')) : NaN;
      return { nome: a.nome, tipo: a.tipo, valor: l?.valor, num: isNaN(num) ? null : num, peso: a.peso ?? 1 };
    });
    const numericas = notas.filter(n => n.num !== null) as { nome: string; num: number; peso: number }[];
    const somaPesos = numericas.reduce((s, n) => s + n.peso, 0);
    const media = somaPesos > 0
      ? numericas.reduce((s, n) => s + n.num * n.peso, 0) / somaPesos
      : 0;
    const feitas = notas.filter(n => n.valor && n.valor.trim() !== '').length;
    const maior = numericas.length ? Math.max(...numericas.map(n => n.num)) : 0;
    const menor = numericas.length ? Math.min(...numericas.map(n => n.num)) : 0;
    return { notas, media, feitas, maior, menor, total: atividades.length };
  }

  function exportarPdf() {
    const turma = turmas.find(t => t.id === turmaId);
    const disc = disciplinas.find(d => d.id === disciplinaId);
    const header = ['Nº', 'Aluno', ...atividades.map(a => a.nome), 'Média'];
    const rows = alunosFiltrados.map(a => {
      const s = statsAluno(a.id);
      return [
        a.numero_chamada ?? '',
        a.nome,
        ...atividades.map(at => lancMap[`${at.id}:${a.id}`]?.valor ?? ''),
        s.media ? s.media.toFixed(2) : '-',
      ];
    });
    exportTablePdf({
      title: 'Diário do Professor',
      subtitle: `${turma?.nome ?? ''} · ${disc?.nome ?? 'Todas disciplinas'} · Bimestre ${bimestre}`,
      columns: header,
      rows: rows as any,
      filename: `diario-${turma?.nome ?? 'turma'}.pdf`,
      orientation: 'landscape',
    });
  }

  function exportarExcel() {
    const header = ['Numero', 'Aluno', ...atividades.map(a => a.nome), 'Media'];
    const rows = alunosFiltrados.map(a => {
      const s = statsAluno(a.id);
      return [
        a.numero_chamada ?? '',
        a.nome,
        ...atividades.map(at => lancMap[`${at.id}:${a.id}`]?.valor ?? ''),
        s.media ? s.media.toFixed(2) : '',
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diario.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Diário do Professor</h1>
          <p className="text-sm text-muted-foreground">
            Caderno digital para acompanhar atividades e desempenho diário dos alunos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarPdf} disabled={!atividades.length}>
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={!atividades.length}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-card">
        <div>
          <Label>Turma</Label>
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
            <SelectContent>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Disciplina</Label>
          <Select value={disciplinaId || 'all'} onValueChange={v => setDisciplinaId(v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bimestre</Label>
          <Select value={String(bimestre)} onValueChange={v => setBimestre(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map(b => <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Filtrar aluno</Label>
          <Input placeholder="Nome..." value={filtroAluno} onChange={e => setFiltroAluno(e.target.value)} />
        </div>
      </div>

      {!turmaId ? (
        <div className="text-center text-muted-foreground p-8 border rounded-lg">
          Selecione uma turma para começar.
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {alunosFiltrados.length} aluno(s) · {atividades.length} atividade(s)
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setDlgAtividade(true)}>
                <Plus className="w-4 h-4 mr-1" /> Nova Atividade
              </Button>
            )}
          </div>

          {/* Planilha */}
          <div className="border rounded-lg overflow-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left w-12">Nº</th>
                  <th className="p-2 text-left min-w-[200px]">Aluno</th>
                  {atividades.map((a, idx) => (
                    <th key={a.id} className="p-2 text-center min-w-[90px] border-l group">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{a.nome}</span>
                        {a.categoria && (
                          <span className="text-[10px] px-1.5 rounded bg-primary/10 text-primary">{a.categoria}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {a.tipo} · peso {a.peso}
                        </span>
                        {a.data && <span className="text-[10px] text-muted-foreground">{new Date(a.data).toLocaleDateString('pt-BR')}</span>}
                        {canEdit && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 mt-0.5">
                            <button onClick={() => abrirEditarAtividade(a)} className="text-primary text-[10px] underline">editar</button>
                            <button onClick={() => removerAtividade(a.id, a.nome)} className="text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-center border-l bg-primary/5">Média</th>
                  <th className="p-2 text-center border-l w-12">Obs</th>
                </tr>
              </thead>
              <tbody>
                {alunosFiltrados.map((aluno, alunoIdx) => {
                  const s = statsAluno(aluno.id);
                  return (
                    <tr key={aluno.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 text-center text-muted-foreground">{aluno.numero_chamada ?? ''}</td>
                      <td className="p-2">
                        <button onClick={() => setDlgPainel(aluno)}
                          className="text-left hover:text-primary hover:underline flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {aluno.nome}
                        </button>
                      </td>
                      {atividades.map((ativ, ativIdx) => {
                        const l = lancMap[`${ativ.id}:${aluno.id}`];
                        return (
                          <td key={ativ.id} className="border-l p-0">
                            <input
                              type="text"
                              defaultValue={l?.valor ?? ''}
                              disabled={!canEdit}
                              onBlur={e => salvarCelula(ativ.id, aluno.id, e.target.value)}
                              onPaste={e => onPasteCelula(e, ativIdx, alunoIdx)}
                              className="w-full text-center bg-transparent px-2 py-1.5 focus:outline-none focus:bg-primary/10"
                            />
                          </td>
                        );
                      })}
                      <td className="border-l text-center bg-primary/5 font-semibold">
                        {s.media > 0 ? s.media.toFixed(2) : '-'}
                      </td>
                      <td className="border-l text-center">
                        <button onClick={() => {
                          setDlgObs({ aluno_id: aluno.id });
                          setObsTexto(obsAluno[aluno.id] || '');
                        }} className="p-1 hover:text-primary">
                          <MessageSquare className={`w-4 h-4 ${obsAluno[aluno.id] ? 'text-primary' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!alunosFiltrados.length && (
                  <tr><td colSpan={atividades.length + 4} className="p-8 text-center text-muted-foreground">
                    Nenhum aluno na turma.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Dica: use TAB para navegar, cole valores do Excel diretamente na planilha.
          </p>
        </>
      )}

      {/* Dialog nova/editar atividade */}
      <Dialog open={dlgAtividade} onOpenChange={(v) => {
        setDlgAtividade(v);
        if (!v) { setEditandoAtiv(null); setNovaAtiv({ nome: '', tipo: 'nota', peso: 1, categoria: 'Atividade de sala' }); }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editandoAtiv ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={novaAtiv.nome || ''} onChange={e => setNovaAtiv({ ...novaAtiv, nome: e.target.value })}
                placeholder="Ex: A1, Experimento sobre células..." />
            </div>
            <div>
              <Label>Tipo de registro</Label>
              <Select value={novaAtiv.categoria || 'Atividade de sala'}
                onValueChange={v => setNovaAtiv({ ...novaAtiv, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Formato</Label>
                <Select value={novaAtiv.tipo || 'nota'}
                  onValueChange={v => setNovaAtiv({ ...novaAtiv, tipo: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota">Nota (0-10)</SelectItem>
                    <SelectItem value="conceito">Conceito (Fez/Não fez)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Peso / valor</Label>
                <Input type="number" step="0.1" value={novaAtiv.peso ?? 1}
                  onChange={e => setNovaAtiv({ ...novaAtiv, peso: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={novaAtiv.data || ''}
                onChange={e => setNovaAtiv({ ...novaAtiv, data: e.target.value })} />
            </div>
            <div>
              <Label>Observações gerais</Label>
              <Textarea value={novaAtiv.observacao || ''}
                onChange={e => setNovaAtiv({ ...novaAtiv, observacao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgAtividade(false)}>Cancelar</Button>
            <Button onClick={salvarAtividade}>{editandoAtiv ? 'Salvar alterações' : 'Criar atividade'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog observação */}
      <Dialog open={!!dlgObs} onOpenChange={v => !v && setDlgObs(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Observação do aluno</DialogTitle></DialogHeader>
          <Textarea rows={5} value={obsTexto} onChange={e => setObsTexto(e.target.value)}
            placeholder="Ex: Não trouxe material. / Excelente participação. / Necessita reforço." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgObs(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (dlgObs) await salvarObsAluno(dlgObs.aluno_id, obsTexto);
              setDlgObs(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Painel do aluno */}
      <Dialog open={!!dlgPainel} onOpenChange={v => !v && setDlgPainel(null)}>
        <DialogContent className="max-w-2xl">
          {dlgPainel && (() => {
            const s = statsAluno(dlgPainel.id);
            const dataChart = s.notas.filter(n => n.num !== null).map(n => ({ nome: n.nome, nota: n.num }));
            const mediaTurma = alunosFiltrados.reduce((sum, a) => sum + statsAluno(a.id).media, 0) / (alunosFiltrados.length || 1);
            const ranking = [...alunosFiltrados].sort((a, b) => statsAluno(b.id).media - statsAluno(a.id).media);
            const pos = ranking.findIndex(a => a.id === dlgPainel.id) + 1;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" /> {dlgPainel.nome}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                    <div className="p-3 bg-muted rounded"><div className="text-2xl font-bold">{s.media.toFixed(2)}</div><div className="text-xs">Média</div></div>
                    <div className="p-3 bg-muted rounded"><div className="text-2xl font-bold">{s.feitas}/{s.total}</div><div className="text-xs">Atividades</div></div>
                    <div className="p-3 bg-muted rounded"><div className="text-2xl font-bold">{s.maior.toFixed(1)}</div><div className="text-xs">Maior</div></div>
                    <div className="p-3 bg-muted rounded"><div className="text-2xl font-bold">{pos}º</div><div className="text-xs">Posição</div></div>
                  </div>
                  {dataChart.length > 0 && (
                    <div className="h-56">
                      <ResponsiveContainer>
                        <LineChart data={dataChart}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="nome" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="nota" stroke="hsl(var(--primary))" name="Notas" />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-center text-muted-foreground">
                        Média da turma: {mediaTurma.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {obsAluno[dlgPainel.id] && (
                    <div className="p-3 border-l-4 border-primary bg-muted/30 text-sm">
                      <strong>Observação:</strong> {obsAluno[dlgPainel.id]}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
