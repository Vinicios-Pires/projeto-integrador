import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, Users, BookOpen, X, Sparkles, UserPlus, Download } from 'lucide-react';
import { PageHeader, FilterBar, EmptyState, LoadingSpinner } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const NIVEIS = {
  'Ensino Fundamental II': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
  'Ensino Médio': ['1º Ano EM', '2º Ano EM', '3º Ano EM'],
};

const TODAS_SERIES = Object.values(NIVEIS).flat();
const TURNOS = ['Manhã', 'Tarde', 'Noturno', 'Integral'];

function getNivel(serie: string): string {
  if (NIVEIS['Ensino Fundamental II'].includes(serie)) return 'Ensino Fundamental II';
  if (NIVEIS['Ensino Médio'].includes(serie)) return 'Ensino Médio';
  return 'Outro';
}

interface Turma {
  id: string;
  nome: string;
  serie: string;
  turno: string;
  ano_letivo: number;
  capacidade: number;
  observacoes?: string;
  alunos_count?: number;
  tipo?: string;
  membros_count?: number;
}

interface AlunoListItem {
  id: string;
  nome: string;
  numero_chamada: number;
  serie?: string;
  turma_id: string;
  turmas?: { nome: string; serie: string };
}

export default function Turmas() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTurno, setFilterTurno] = useState('all');
  const [filterNivel, setFilterNivel] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [form, setForm] = useState({ nome: '', serie: '', turno: 'Manhã', ano_letivo: 2025, capacidade: 35, observacoes: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // ===== Turma personalizada (Eletiva) =====
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [personEditing, setPersonEditing] = useState<Turma | null>(null);
  const [personForm, setPersonForm] = useState({ nome: '', nivel: 'Ensino Médio' as keyof typeof NIVEIS, turno: 'Manhã', observacoes: '' });
  const [todosAlunos, setTodosAlunos] = useState<AlunoListItem[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroSerieAluno, setFiltroSerieAluno] = useState('all');
  const [filtroTurmaAluno, setFiltroTurmaAluno] = useState('all');
  const [savingPerson, setSavingPerson] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  useEffect(() => { loadTurmas(); }, []);

  async function loadTurmas() {
    const { data } = await supabase.from('turmas').select('*, alunos(count)').order('nome');
    if (data) {
      const lista: Turma[] = data.map((t: any) => ({ ...t, alunos_count: t.alunos?.[0]?.count || 0 }));
      // Conta membros das personalizadas
      const personIds = lista.filter(t => t.tipo === 'personalizada').map(t => t.id);
      if (personIds.length) {
        const { data: ms } = await (supabase as any).from('turma_membros')
          .select('turma_id').in('turma_id', personIds);
        const counts: Record<string, number> = {};
        (ms || []).forEach((m: any) => { counts[m.turma_id] = (counts[m.turma_id] || 0) + 1; });
        lista.forEach(t => { if (t.tipo === 'personalizada') t.membros_count = counts[t.id] || 0; });
      }
      setTurmas(lista);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingTurma(null);
    setForm({ nome: '', serie: '', turno: 'Manhã', ano_letivo: 2025, capacidade: 35, observacoes: '' });
    setDialogOpen(true);
  }

  function openEdit(t: Turma) {
    setEditingTurma(t);
    setForm({ nome: t.nome, serie: t.serie, turno: t.turno, ano_letivo: t.ano_letivo, capacidade: t.capacidade, observacoes: t.observacoes || '' });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.nome || !form.serie) return toast({ title: 'Preencha nome e série', variant: 'destructive' });
    setSaving(true);
    if (editingTurma) {
      await supabase.from('turmas').update(form).eq('id', editingTurma.id);
      toast({ title: 'Turma atualizada!' });
    } else {
      await supabase.from('turmas').insert(form);
      toast({ title: 'Turma cadastrada!' });
    }
    setSaving(false);
    setDialogOpen(false);
    loadTurmas();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta turma? Todos os alunos vinculados serão removidos.')) return;
    await supabase.from('turmas').delete().eq('id', id);
    toast({ title: 'Turma excluída' });
    loadTurmas();
  }

  // ===== Formar turma personalizada =====
  async function openFormarTurma(t?: Turma) {
    setPersonEditing(t || null);
    setPersonForm({
      nome: t?.nome || '',
      nivel: (t && getNivel(t.serie) in NIVEIS ? getNivel(t.serie) : 'Ensino Médio') as keyof typeof NIVEIS,
      turno: t?.turno || 'Manhã',
      observacoes: t?.observacoes || '',
    });
    setBuscaAluno('');
    setFiltroSerieAluno('all');
    setFiltroTurmaAluno('all');
    const { data } = await supabase
      .from('alunos')
      .select('id, nome, numero_chamada, serie, turma_id, turmas(nome, serie)')
      .eq('ativo', true)
      .order('nome');
    setTodosAlunos((data as any) || []);
    if (t) {
      const { data: ms } = await (supabase as any).from('turma_membros')
        .select('aluno_id').eq('turma_id', t.id);
      setSelecionados(new Set((ms || []).map((m: any) => m.aluno_id)));
    } else {
      setSelecionados(new Set());
    }
    setPersonDialogOpen(true);
  }

  function toggleAluno(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function savePersonalizada() {
    if (!personForm.nome.trim()) return toast({ title: 'Informe o nome da turma', variant: 'destructive' });
    if (!userId) return toast({ title: 'Sessão expirada', variant: 'destructive' });
    setSavingPerson(true);
    let turmaId = personEditing?.id;
    const payload = {
      nome: personForm.nome.trim(),
      serie: personForm.nivel,
      turno: personForm.turno,
      ano_letivo: new Date().getFullYear(),
      capacidade: Math.max(35, selecionados.size),
      observacoes: personForm.observacoes,
      tipo: 'personalizada',
    };
    if (turmaId) {
      await supabase.from('turmas').update(payload).eq('id', turmaId);
    } else {
      const { data, error } = await supabase.from('turmas').insert(payload).select('id').single();
      if (error || !data) {
        setSavingPerson(false);
        return toast({ title: 'Erro ao criar turma', description: error?.message, variant: 'destructive' });
      }
      turmaId = data.id;
    }
    // Sincroniza membros
    const { data: atuais } = await (supabase as any).from('turma_membros')
      .select('aluno_id').eq('turma_id', turmaId);
    const atuaisSet = new Set<string>((atuais || []).map((m: any) => m.aluno_id as string));
    const aRemover = Array.from(atuaisSet).filter(id => !selecionados.has(id));
    const aAdicionar = Array.from(selecionados).filter(id => !atuaisSet.has(id));
    if (aRemover.length) {
      await (supabase as any).from('turma_membros').delete()
        .eq('turma_id', turmaId).in('aluno_id', aRemover);
    }
    if (aAdicionar.length) {
      await (supabase as any).from('turma_membros').insert(
        aAdicionar.map(aluno_id => ({ turma_id: turmaId, aluno_id, user_id: userId }))
      );
    }
    setSavingPerson(false);
    setPersonDialogOpen(false);
    toast({ title: personEditing ? 'Turma atualizada!' : 'Turma personalizada criada!', description: `${selecionados.size} aluno(s) vinculado(s)` });
    loadTurmas();
  }

  function exportarMembros(t: Turma) {
    (supabase as any).from('turma_membros')
      .select('alunos:aluno_id(nome, numero_chamada, turmas(nome, serie))')
      .eq('turma_id', t.id)
      .then((res: any) => {
        const rows = (res.data || []).map((m: any) => m.alunos).filter(Boolean);
        const csv = 'Nº,Nome,Turma Original,Série\n' + rows
          .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
          .map((a: any) => `${a.numero_chamada || ''},"${a.nome}","${a.turmas?.nome || ''}","${a.turmas?.serie || ''}"`)
          .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${t.nome}_membros.csv`; link.click();
      });
  }

  const alunosFiltrados = todosAlunos.filter(a => {
    if (buscaAluno) {
      const q = buscaAluno.toLowerCase();
      if (!a.nome.toLowerCase().includes(q) && !String(a.numero_chamada).includes(q)) return false;
    }
    if (filtroTurmaAluno !== 'all' && a.turma_id !== filtroTurmaAluno) return false;
    if (filtroSerieAluno !== 'all' && a.turmas?.serie !== filtroSerieAluno) return false;
    if (personForm.nivel) {
      const seriesNivel = NIVEIS[personForm.nivel] || [];
      if (a.turmas?.serie && !seriesNivel.includes(a.turmas.serie)) {
        // só filtra se não bater com o nível escolhido E o usuário não pediu "all"
        if (filtroSerieAluno === 'all' && filtroTurmaAluno === 'all') return false;
      }
    }
    return true;
  });

  const filtered = turmas.filter(t => {
    const matchSearch = t.nome.toLowerCase().includes(search.toLowerCase()) || t.serie.toLowerCase().includes(search.toLowerCase());
    const matchTurno = filterTurno === 'all' || t.turno === filterTurno;
    const matchNivel = filterNivel === 'all' || getNivel(t.serie) === filterNivel;
    return matchSearch && matchTurno && matchNivel;
  });

  // Agrupar por nível
  const grouped: Record<string, Turma[]> = {};
  filtered.forEach(t => {
    const nivel = getNivel(t.serie);
    if (!grouped[nivel]) grouped[nivel] = [];
    grouped[nivel].push(t);
  });

  const nivelColors: Record<string, string> = {
    'Ensino Fundamental II': 'text-primary border-primary/30 bg-primary/5',
    'Ensino Médio': 'text-success border-success/30 bg-success/5',
    'Outro': 'text-muted-foreground border-border bg-muted/5',
  };

  const turnoColors: Record<string, string> = {
    'Manhã': 'bg-primary-light text-primary',
    'Tarde': 'bg-warning-light text-warning',
    'Noturno': 'bg-sidebar/10 text-sidebar',
    'Integral': 'bg-success-light text-success',
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Turmas" subtitle={`${turmas.length} turmas cadastradas`}>
        <Button onClick={() => openFormarTurma()} size="sm" variant="outline">
          <Sparkles className="w-4 h-4 mr-1.5" /> Formar Turma (Eletiva)
        </Button>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Turma
        </Button>
      </PageHeader>

      <FilterBar>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar turma..." className="pl-8 h-8 text-sm bg-background" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterNivel} onValueChange={setFilterNivel}>
          <SelectTrigger className="w-48 h-8 text-sm bg-background"><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="Ensino Fundamental II">Fundamental II</SelectItem>
            <SelectItem value="Ensino Médio">Ensino Médio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTurno} onValueChange={setFilterTurno}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Turno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os turnos</SelectItem>
            {TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([nivel, turmasNivel]) => (
            <div key={nivel}>
              <div className="flex items-center gap-3 mb-3">
                <span className={cn('text-sm font-bold px-3 py-1 rounded-lg border', nivelColors[nivel] || nivelColors['Outro'])}>
                  {nivel}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{turmasNivel.length} turma{turmasNivel.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {turmasNivel.map(turma => (
                  <div key={turma.id} className="bg-card border border-border rounded-xl shadow-card hover:shadow-elevated transition-all group animate-fade-in">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            {turma.nome}
                            {turma.tipo === 'personalizada' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 uppercase tracking-wide">Eletiva</span>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">{turma.serie} · {turma.ano_letivo}</p>
                        </div>
                        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', turnoColors[turma.turno] || 'bg-secondary text-secondary-foreground')}>
                          {turma.turno}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          <span>
                            <strong className="text-foreground">
                              {turma.tipo === 'personalizada' ? (turma.membros_count || 0) : turma.alunos_count}
                            </strong>
                            {turma.tipo === 'personalizada' ? ' alunos selecionados' : `/${turma.capacidade} alunos`}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full mb-4">
                        <div className={cn('h-1.5 rounded-full transition-all', turma.tipo === 'personalizada' ? 'bg-purple-500' : 'bg-primary')}
                          style={{ width: `${Math.min((((turma.tipo === 'personalizada' ? turma.membros_count : turma.alunos_count) || 0) / turma.capacidade) * 100, 100)}%` }} />
                      </div>
                      {turma.observacoes && <p className="text-xs text-muted-foreground mb-3 truncate">{turma.observacoes}</p>}
                      <div className="flex gap-2">
                        {turma.tipo === 'personalizada' ? (
                          <>
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openFormarTurma(turma)}>
                              <UserPlus className="w-3.5 h-3.5 mr-1" /> Gerenciar
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportarMembros(turma)} title="Exportar lista">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEdit(turma)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => remove(turma.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <EmptyState message="Nenhuma turma encontrada" icon={<BookOpen className="w-12 h-12" />} />
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTurma ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome da turma *</Label>
                <Input placeholder="Ex: 7º A" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Série/Ano *</Label>
                <Select value={form.serie} onValueChange={v => setForm({ ...form, serie: v })}>
                  <SelectTrigger><SelectValue placeholder="Série" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NIVEIS).map(([nivel, series]) => (
                      <React.Fragment key={nivel}>
                        <SelectItem value={`__header_${nivel}`} disabled className="font-bold text-xs text-primary">{nivel}</SelectItem>
                        {series.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Turno</Label>
                <Select value={form.turno} onValueChange={v => setForm({ ...form, turno: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ano letivo</Label>
                <Input type="number" value={form.ano_letivo} onChange={e => setForm({ ...form, ano_letivo: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Capacidade</Label>
                <Input type="number" value={form.capacidade} onChange={e => setForm({ ...form, capacidade: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Observações sobre a turma..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de turma personalizada (Eletiva) */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              {personEditing ? `Gerenciar ${personEditing.nome}` : 'Formar Turma Personalizada'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b">
            <div className="space-y-1.5">
              <Label>Nome da turma *</Label>
              <Input placeholder="Ex: Eletiva - Química no Esporte" value={personForm.nome}
                onChange={e => setPersonForm({ ...personForm, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select value={personForm.nivel} onValueChange={v => setPersonForm({ ...personForm, nivel: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ensino Médio">Ensino Médio</SelectItem>
                  <SelectItem value="Ensino Fundamental II">Ensino Fundamental II</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Turno</Label>
              <Select value={personForm.turno} onValueChange={v => setPersonForm({ ...personForm, turno: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center py-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar aluno por nome ou nº..." className="pl-8 h-9 text-sm"
                value={buscaAluno} onChange={e => setBuscaAluno(e.target.value)} />
            </div>
            <Select value={filtroTurmaAluno} onValueChange={setFiltroTurmaAluno}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Turma origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas turmas</SelectItem>
                {turmas.filter(t => t.tipo !== 'personalizada').map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroSerieAluno} onValueChange={setFiltroSerieAluno}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Série" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas séries</SelectItem>
                {(NIVEIS[personForm.nivel] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/40">
              {selecionados.size} selecionado(s)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md">
            {alunosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado com esses filtros</div>
            ) : (
              <ul className="divide-y">
                {alunosFiltrados.map(a => (
                  <li key={a.id} className={cn(
                    'flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer',
                    selecionados.has(a.id) && 'bg-purple-50/60 dark:bg-purple-950/20'
                  )} onClick={() => toggleAluno(a.id)}>
                    <Checkbox checked={selecionados.has(a.id)} onCheckedChange={() => toggleAluno(a.id)} />
                    <span className="text-xs font-mono text-muted-foreground w-8">{a.numero_chamada || '-'}</span>
                    <span className="flex-1 text-sm font-medium">{a.nome}</span>
                    <span className="text-xs text-muted-foreground">{a.turmas?.nome} · {a.turmas?.serie}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePersonalizada} disabled={savingPerson} className="bg-purple-600 hover:bg-purple-700 text-white">
              {savingPerson ? 'Salvando...' : personEditing ? 'Salvar alterações' : 'Criar turma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
