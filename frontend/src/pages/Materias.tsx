import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Palette, Plus, Edit2, Trash2, BookOpen, BarChart3, ClipboardList, FileText, Eye, Users, Check } from 'lucide-react';
import { PageHeader, TableContainer } from '@/components/ui-escola';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const CORES_DISCIPLINA: { value: string; label: string; dot: string }[] = [
  { value: 'azul', label: 'Azul', dot: 'bg-blue-500' },
  { value: 'roxo', label: 'Roxo', dot: 'bg-purple-500' },
  { value: 'verde', label: 'Verde', dot: 'bg-green-500' },
  { value: 'vermelho', label: 'Vermelho', dot: 'bg-red-500' },
  { value: 'laranja', label: 'Laranja', dot: 'bg-orange-500' },
  { value: 'rosa', label: 'Rosa', dot: 'bg-pink-500' },
  { value: 'amarelo', label: 'Amarelo', dot: 'bg-yellow-500' },
  { value: 'ciano', label: 'Ciano', dot: 'bg-cyan-500' },
  { value: 'indigo', label: 'Índigo', dot: 'bg-indigo-500' },
  { value: 'cinza', label: 'Cinza', dot: 'bg-gray-500' },
];

export function getDisciplinaDot(cor?: string) {
  return CORES_DISCIPLINA.find(c => c.value === cor)?.dot || 'bg-blue-500';
}

export function getDisciplinaBg(cor?: string) {
  const map: Record<string, string> = {
    azul: 'bg-blue-50 border-blue-200', roxo: 'bg-purple-50 border-purple-200',
    verde: 'bg-green-50 border-green-200', vermelho: 'bg-red-50 border-red-200',
    laranja: 'bg-orange-50 border-orange-200', rosa: 'bg-pink-50 border-pink-200',
    amarelo: 'bg-yellow-50 border-yellow-200', ciano: 'bg-cyan-50 border-cyan-200',
    indigo: 'bg-indigo-50 border-indigo-200', cinza: 'bg-gray-50 border-gray-200',
  };
  return map[cor || ''] || 'bg-blue-50 border-blue-200';
}

export default function Materias() {
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [vinculos, setVinculos] = useState<{ disciplina_id: string; turma_id: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', cor: 'azul' });
  const [vincDialogOpen, setVincDialogOpen] = useState(false);
  const [vincDisciplina, setVincDisciplina] = useState<any>(null);
  const [vincSelecionadas, setVincSelecionadas] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { userId, canEdit, readOnly } = usePermissions();

  useEffect(() => { load(); }, [userId]);

  async function load() {
    const [{ data: disc }, { data: t }, vincRes] = await Promise.all([
      supabase.from('disciplinas').select('*').order('nome'),
      supabase.from('turmas').select('id, nome, serie').order('nome'),
      userId
        ? supabase.from('turma_disciplinas').select('disciplina_id, turma_id').eq('user_id', userId)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setDisciplinas(disc || []);
    setTurmas(t || []);
    setVinculos(vincRes.data || []);
  }

  function abrirVinculos(d: any) {
    setVincDisciplina(d);
    const atuais = vinculos.filter(v => v.disciplina_id === d.id).map(v => v.turma_id);
    setVincSelecionadas(new Set(atuais));
    setVincDialogOpen(true);
  }

  function toggleVinc(turmaId: string) {
    setVincSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(turmaId)) next.delete(turmaId);
      else next.add(turmaId);
      return next;
    });
  }

  async function salvarVinculos() {
    if (!vincDisciplina || !userId) return;
    const atuais = new Set(vinculos.filter(v => v.disciplina_id === vincDisciplina.id).map(v => v.turma_id));
    const novas = vincSelecionadas;
    const adicionar = Array.from(novas).filter(id => !atuais.has(id));
    const remover = Array.from(atuais).filter(id => !novas.has(id));

    if (adicionar.length) {
      await supabase.from('turma_disciplinas').insert(
        adicionar.map(turma_id => ({ turma_id, disciplina_id: vincDisciplina.id, user_id: userId }))
      );
    }
    if (remover.length) {
      await supabase.from('turma_disciplinas').delete()
        .eq('disciplina_id', vincDisciplina.id)
        .eq('user_id', userId)
        .in('turma_id', remover);
    }
    toast({ title: 'Vínculos atualizados!', description: `${vincDisciplina.nome} agora aparece apenas nas turmas selecionadas.` });
    setVincDialogOpen(false);
    load();
  }

  async function save() {
    if (!form.nome.trim() || !canEdit || !userId) return;
    if (editing) {
      await supabase.from('disciplinas').update({ nome: form.nome, cor: form.cor }).eq('id', editing.id);
      toast({ title: 'Matéria atualizada!' });
    } else {
      await supabase.from('disciplinas').insert({ nome: form.nome, cor: form.cor, user_id: userId });
      toast({ title: 'Matéria criada!' });
    }
    setDialogOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!canEdit) return;
    if (!confirm('Excluir esta matéria? Isso pode afetar planos e notas vinculados.')) return;
    await supabase.from('disciplinas').delete().eq('id', id);
    toast({ title: 'Matéria excluída' });
    load();
  }

  const ativas = disciplinas.filter(d => d.cor !== '__inativa');
  const totalMaterias = disciplinas.length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Matérias" subtitle={readOnly ? 'Modo gestão — visualizando matérias de todos os professores' : 'Crie e gerencie suas matérias. As cores são usadas em todo o sistema.'}>
        {readOnly && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"><Eye className="w-3 h-3" /> Somente leitura</span>}
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setForm({ nome: '', cor: 'azul' }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />Nova Matéria
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalMaterias}</p>
            <p className="text-xs text-muted-foreground">Matérias cadastradas</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Integrado com</p>
            <p className="text-sm font-semibold text-foreground">Plano de Aula</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Integrado com</p>
            <p className="text-sm font-semibold text-foreground">Notas</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mt-1">Integrado com</p>
            <p className="text-sm font-semibold text-foreground">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {disciplinas.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Palette className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma matéria cadastrada</p>
          <p className="text-sm text-muted-foreground/60 mb-4">Crie sua primeira matéria para começar a organizar o sistema.</p>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ nome: '', cor: 'azul' }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />Criar Matéria
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {disciplinas.map((d) => {
            const turmasVinc = vinculos.filter(v => v.disciplina_id === d.id).map(v => turmas.find(t => t.id === v.turma_id)).filter(Boolean);
            return (
            <div key={d.id} className={cn('rounded-xl border-2 p-4 transition-all hover:shadow-md', getDisciplinaBg(d.cor))}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn('w-5 h-5 rounded-full shadow-sm', getDisciplinaDot(d.cor))} />
                  <h3 className="font-semibold text-foreground">{d.nome}</h3>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => abrirVinculos(d)}
                      className="p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-primary transition-colors"
                      title="Vincular turmas"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setEditing(d); setForm({ nome: d.nome, cor: d.cor || 'azul' }); setDialogOpen(true); }}
                      className="p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="p-1.5 rounded-lg hover:bg-background/60 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1 font-semibold">Turmas vinculadas</p>
                {turmasVinc.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma turma — clique em <Users className="inline w-3 h-3 mx-0.5" /> para vincular</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {turmasVinc.map((t: any) => (
                      <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t.nome}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground">Plano de Aula</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground">Notas</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground">Dashboard</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground">Relatórios</span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da Matéria *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Química, Robótica, Programação" />
            </div>
            <div className="space-y-2">
              <Label>Cor da Matéria</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_DISCIPLINA.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setForm({ ...form, cor: c.value })}
                    className={cn(
                      'w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center',
                      c.dot,
                      form.cor === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'
                    )}
                  >
                    {form.cor === c.value && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Esta cor será usada em planos, notas, dashboard e relatórios.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: vincular turmas à matéria */}
      <Dialog open={vincDialogOpen} onOpenChange={setVincDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {vincDisciplina && <span className={cn('w-3 h-3 rounded-full', getDisciplinaDot(vincDisciplina.cor))} />}
              Vincular {vincDisciplina?.nome} às turmas
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-muted-foreground mb-3">
              Selecione apenas as turmas em que <strong>você</strong> leciona esta matéria. Isso garante que ela apareça apenas onde for válida (notas, planos, etc).
            </p>
            {turmas.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">Nenhuma turma cadastrada.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {turmas.map(t => {
                  const checked = vincSelecionadas.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleVinc(t.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left',
                        checked ? 'bg-primary/10 border-primary' : 'bg-background border-border hover:bg-muted'
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                        checked ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      )}>
                        {checked && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{t.nome}</p>
                        <p className="text-xs text-muted-foreground">{t.serie}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVincDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarVinculos}>Salvar vínculos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
