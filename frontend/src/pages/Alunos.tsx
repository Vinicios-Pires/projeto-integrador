import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, Upload, Download, X } from 'lucide-react';
import { PageHeader, FilterBar, TableContainer, EmptyState, LoadingSpinner } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Aluno {
  id: string;
  turma_id: string;
  nome: string;
  numero_chamada: number;
  serie?: string;
  ativo: boolean;
  turmas?: { nome: string; serie: string };
}

export default function Alunos() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string; serie: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('all');
  const [filterAtivo, setFilterAtivo] = useState('ativo');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const [form, setForm] = useState({ turma_id: '', nome: '', numero_chamada: 1, serie: '', ativo: true });
  const [novaTurmaNome, setNovaTurmaNome] = useState('');
  const [criandoTurma, setCriandoTurma] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: alunosData }, { data: turmasData }] = await Promise.all([
      supabase.from('alunos').select('*, turmas(nome, serie)').order('turmas(nome)', { ascending: true }),
      supabase.from('turmas').select('id, nome, serie').order('nome'),
    ]);
    setAlunos(alunosData as Aluno[] || []);
    setTurmas(turmasData || []);
    setLoading(false);
  }

  function openNew() {
    setEditingAluno(null);
    setForm({ turma_id: '', nome: '', numero_chamada: 1, serie: '', ativo: true });
    setCriandoTurma(false);
    setNovaTurmaNome('');
    setDialogOpen(true);
  }

  function openEdit(a: Aluno) {
    setEditingAluno(a);
    setForm({ turma_id: a.turma_id, nome: a.nome, numero_chamada: a.numero_chamada || 1, serie: a.serie || '', ativo: a.ativo });
    setCriandoTurma(false);
    setNovaTurmaNome('');
    setDialogOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) return toast({ title: 'Informe o nome do aluno', variant: 'destructive' });
    if (!form.numero_chamada || form.numero_chamada < 1) return toast({ title: 'Informe o número da chamada', variant: 'destructive' });
    setSaving(true);

    let turmaId = form.turma_id;
    let turmaSerie = turmas.find(t => t.id === turmaId)?.serie || '';

    // Criar turma se necessário
    if (criandoTurma) {
      const nomeTurma = normalizarSerieTurma(novaTurmaNome) || novaTurmaNome.trim().toUpperCase();
      if (!nomeTurma) { setSaving(false); return toast({ title: 'Informe o nome da nova turma', variant: 'destructive' }); }
      const existente = turmas.find(t => t.nome.toUpperCase().replace(/\s+/g, '') === nomeTurma.toUpperCase().replace(/\s+/g, ''));
      if (existente) {
        turmaId = existente.id; turmaSerie = existente.serie;
      } else {
        const novaSerie = inferirSerie(nomeTurma);
        const { data: novaTurma, error: errTurma } = await supabase
          .from('turmas').insert({ nome: nomeTurma, serie: novaSerie, turno: 'Manhã' })
          .select('id, nome, serie').single();
        if (errTurma || !novaTurma) { setSaving(false); return toast({ title: 'Erro ao criar turma', description: errTurma?.message, variant: 'destructive' }); }
        turmaId = novaTurma.id; turmaSerie = novaTurma.serie;
        setTurmas(prev => [...prev, novaTurma]);
      }
    }

    if (!turmaId) { setSaving(false); return toast({ title: 'Selecione ou crie uma turma', variant: 'destructive' }); }

    // Anti-duplicação (mesmo nome na mesma turma) — apenas em criação
    if (!editingAluno) {
      const duplicado = alunos.some(a => a.turma_id === turmaId && a.nome.trim().toLowerCase() === form.nome.trim().toLowerCase());
      if (duplicado) { setSaving(false); return toast({ title: 'Aluno já cadastrado nesta turma', variant: 'destructive' }); }
    }

    const payload = {
      nome: form.nome.trim(),
      numero_chamada: form.numero_chamada,
      turma_id: turmaId,
      serie: form.serie || turmaSerie || '',
      ativo: form.ativo,
    };

    const { error } = editingAluno
      ? await supabase.from('alunos').update(payload).eq('id', editingAluno.id)
      : await supabase.from('alunos').insert(payload);

    setSaving(false);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: editingAluno ? 'Aluno atualizado!' : 'Aluno cadastrado e ativo na turma!' });
    setDialogOpen(false);
    loadData();
  }

  async function remove(id: string) {
    if (!confirm('Excluir este aluno?')) return;
    await supabase.from('alunos').delete().eq('id', id);
    toast({ title: 'Aluno excluído' });
    loadData();
  }

  function downloadModelo() {
    const csv = 'Numero Chamada,Nome do Aluno,Serie/Turma\n1,Ana Silva,7°A\n2,Bruno Souza,7°A\n3,Carla Lima,8°B';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo_importacao_alunos.csv'; a.click();
  }

  // Normaliza formato de série/turma: aceita "7A", "7º A", "7°A", "7 A" → "7°A"
  function normalizarSerieTurma(raw: string): string | null {
    if (!raw) return null;
    const limpo = raw.trim().toUpperCase().replace(/[ºO]/g, '°').replace(/\s+/g, '');
    const match = limpo.match(/^(\d{1,2})°?([A-Z])$/);
    if (!match) return null;
    return `${match[1]}°${match[2]}`;
  }

  function inferirSerie(serieTurma: string): string {
    const num = parseInt(serieTurma);
    if (num >= 6 && num <= 9) return `${num}º Ano`;
    if (num >= 1 && num <= 3) return `${num}ª Série EM`;
    return serieTurma;
  }

  function exportarAlunos() {
    const header = 'Número,Nome,Turma,Série,Status\n';
    const rows = filtered.map(a =>
      `${a.numero_chamada},"${a.nome}","${a.turmas?.nome || ''}","${a.serie || ''}","${a.ativo ? 'Ativo' : 'Inativo'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lista_alunos.csv'; a.click();
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n').slice(1);

    // Carrega snapshot atual de turmas e alunos para evitar duplicação
    const { data: turmasAtuais } = await supabase.from('turmas').select('id, nome, serie');
    const { data: alunosAtuais } = await supabase.from('alunos').select('nome, turma_id');
    const mapaTurmas = new Map<string, { id: string; serie: string }>();
    (turmasAtuais || []).forEach(t => mapaTurmas.set(t.nome.toUpperCase().replace(/\s+/g, ''), { id: t.id, serie: t.serie }));

    const erros: string[] = [];
    const turmasCriadas: string[] = [];
    const inserts: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
      if (!cols[0] && !cols[1]) continue;

      const numero = parseInt(cols[0]) || 0;
      const nome = cols[1];
      const serieTurmaRaw = cols[2];

      if (!nome) { erros.push(`Linha ${i + 2}: nome vazio`); continue; }
      const serieTurma = normalizarSerieTurma(serieTurmaRaw);
      if (!serieTurma) { erros.push(`Linha ${i + 2}: formato de turma inválido "${serieTurmaRaw}" (use ex: 7°A)`); continue; }

      // Verifica/cria turma
      let turmaInfo = mapaTurmas.get(serieTurma.toUpperCase().replace(/\s+/g, ''));
      if (!turmaInfo) {
        const novaSerie = inferirSerie(serieTurma);
        const { data: novaTurma, error: errTurma } = await supabase
          .from('turmas')
          .insert({ nome: serieTurma, serie: novaSerie, turno: 'Manhã' })
          .select('id, nome, serie')
          .single();
        if (errTurma || !novaTurma) { erros.push(`Linha ${i + 2}: falha ao criar turma ${serieTurma}`); continue; }
        turmaInfo = { id: novaTurma.id, serie: novaTurma.serie };
        mapaTurmas.set(serieTurma.toUpperCase().replace(/\s+/g, ''), turmaInfo);
        turmasCriadas.push(serieTurma);
      }

      // Evita duplicação (mesmo nome na mesma turma)
      const duplicado = (alunosAtuais || []).some(
        a => a.turma_id === turmaInfo!.id && a.nome.trim().toLowerCase() === nome.toLowerCase()
      ) || inserts.some(x => x.turma_id === turmaInfo!.id && x.nome.toLowerCase() === nome.toLowerCase());
      if (duplicado) { erros.push(`Linha ${i + 2}: aluno "${nome}" já existe em ${serieTurma}`); continue; }

      inserts.push({
        nome,
        numero_chamada: numero,
        serie: turmaInfo.serie,
        turma_id: turmaInfo.id,
        ativo: true,
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('alunos').insert(inserts);
      if (error) {
        toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
      } else {
        const turmasMsg = turmasCriadas.length ? ` | Turmas criadas: ${turmasCriadas.join(', ')}` : '';
        const errosMsg = erros.length ? ` | ${erros.length} linha(s) ignorada(s)` : '';
        toast({ title: `${inserts.length} alunos importados!`, description: turmasMsg + errosMsg });
      }
      loadData();
    } else {
      toast({ title: 'Nenhum aluno importado', description: erros.slice(0, 3).join(' • '), variant: 'destructive' });
    }
    if (erros.length > 0) console.warn('Erros na importação:', erros);
    if (fileRef.current) fileRef.current.value = '';
  }

  const filtered = alunos.filter(a => {
    const matchSearch = a.nome.toLowerCase().includes(search.toLowerCase()) || String(a.numero_chamada).includes(search);
    const matchTurma = filterTurma === 'all' || a.turma_id === filterTurma;
    const matchAtivo = filterAtivo === 'all' || (filterAtivo === 'ativo' ? a.ativo : !a.ativo);
    return matchSearch && matchTurma && matchAtivo;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Alunos" subtitle={`${filtered.length} de ${alunos.length} alunos`}>
        <Button variant="outline" size="sm" onClick={downloadModelo}><Download className="w-4 h-4 mr-1.5" />Modelo CSV</Button>
        <Button variant="outline" size="sm" onClick={exportarAlunos}><Download className="w-4 h-4 mr-1.5" />Exportar</Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1.5" />Importar CSV</Button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={importarCSV} />
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Novo Aluno</Button>
      </PageHeader>

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou número..." className="pl-8 h-8 text-sm bg-background" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas turmas</SelectItem>
            {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAtivo} onValueChange={setFilterAtivo}>
          <SelectTrigger className="w-28 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {loading ? <LoadingSpinner /> : (
        <TableContainer>
          <table className="table-sheet">
            <thead>
              <tr>
                <th className="w-12 text-center">Nº</th>
                <th>Nome Completo</th>
                <th>Turma</th>
                <th>Série</th>
                <th>Status</th>
                <th className="w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Nenhum aluno encontrado</td></tr>
              ) : filtered.map((aluno, i) => (
                <tr key={aluno.id} className={cn(i % 2 === 0 ? '' : 'bg-muted/20')}>
                  <td className="text-center font-mono text-sm font-semibold text-muted-foreground">{aluno.numero_chamada}</td>
                  <td className="font-medium">{aluno.nome}</td>
                  <td><Badge variant="outline" className="text-xs">{aluno.turmas?.nome}</Badge></td>
                  <td className="text-sm text-muted-foreground">{aluno.serie || aluno.turmas?.serie}</td>
                  <td>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', aluno.ativo ? 'bg-success-light text-success' : 'bg-secondary text-muted-foreground')}>
                      {aluno.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(aluno)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(aluno.id)} className="p-1 rounded hover:bg-danger-light text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingAluno ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome do Aluno *</Label>
              <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Série / Turma *</Label>
                {!criandoTurma ? (
                  <Select
                    value={form.turma_id}
                    onValueChange={v => {
                      if (v === '__new__') { setCriandoTurma(true); setForm({ ...form, turma_id: '' }); }
                      else setForm({ ...form, turma_id: v });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                      <SelectItem value="__new__">+ Criar nova turma</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-1">
                    <Input placeholder="Ex: 7°A" value={novaTurmaNome} onChange={e => setNovaTurmaNome(e.target.value)} />
                    <button type="button" onClick={() => { setCriandoTurma(false); setNovaTurmaNome(''); }} className="px-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Nº Chamada *</Label>
                <Input type="number" min={1} value={form.numero_chamada} onChange={e => setForm({ ...form, numero_chamada: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={form.ativo ? 'ativo' : 'inativo'} onValueChange={v => setForm({ ...form, ativo: v === 'ativo' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo (aparece em notas, planos, tutoria, ocorrências)</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
