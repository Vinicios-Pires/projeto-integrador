import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlanejamentos, type Planejamento, STATUS_LABEL } from '@/hooks/use-planejamento';
import { PlanilhaPlanejamento } from '@/components/plano/PlanilhaPlanejamento';
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, CheckCircle, Clock, Filter, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getDisciplinaDot } from '@/pages/Materias';

type Disciplina = { id: string; nome: string; cor?: string };
type Turma = { id: string; nome: string };
type Perfil = { id: string; nome: string; email: string };

const ANO_ATUAL = new Date().getFullYear();

export default function PlanoAula() {
  const { user } = useAuth();
  const { isGestao, isProfessor, isAdmin } = usePermissions();
  const { toast } = useToast();

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [perfis, setPerfis] = useState<Record<string, Perfil>>({});
  const [contagens, setContagens] = useState<Record<string, number>>({});

  const [fBimestre, setFBimestre] = useState<string>('todos');
  const [fDisciplina, setFDisciplina] = useState<string>('todas');
  const [fTurma, setFTurma] = useState<string>('todas');
  const [fProfessor, setFProfessor] = useState<string>('todos');
  const [fStatus, setFStatus] = useState<string>('todos');

  const filtros = useMemo(() => ({
    bimestre: fBimestre === 'todos' ? undefined : Number(fBimestre),
    turma_id: fTurma === 'todas' ? undefined : fTurma,
    disciplina_id: fDisciplina === 'todas' ? undefined : fDisciplina,
    user_id: !isGestao ? user?.id : (fProfessor === 'todos' ? undefined : fProfessor),
  }), [fBimestre, fTurma, fDisciplina, fProfessor, isGestao, user?.id]);

  const { data: planejamentos, loading, refetch } = usePlanejamentos(filtros);

  const [aberto, setAberto] = useState<Planejamento | null>(null);
  const [criarOpen, setCriarOpen] = useState(false);

  useEffect(() => {
    supabase.from('disciplinas').select('id,nome,cor').then(({ data }) => setDisciplinas((data as Disciplina[]) || []));
    supabase.from('turmas').select('id,nome').order('nome').then(({ data }) => setTurmas((data as Turma[]) || []));
    supabase.from('profiles').select('id,nome,email').then(({ data }) => {
      const map: Record<string, Perfil> = {};
      (data || []).forEach((p: any) => map[p.id] = p);
      setPerfis(map);
    });
  }, []);

  // Contagem de aulas por planejamento
  useEffect(() => {
    if (planejamentos.length === 0) { setContagens({}); return; }
    const ids = planejamentos.map(p => p.id);
    supabase.from('planos_aula').select('planejamento_id').in('planejamento_id', ids).then(({ data }) => {
      const c: Record<string, number> = {};
      (data || []).forEach((r: any) => { if (r.planejamento_id) c[r.planejamento_id] = (c[r.planejamento_id] || 0) + 1; });
      setContagens(c);
    });
  }, [planejamentos]);

  // Recarregar quando reaberto
  useEffect(() => {
    if (aberto) {
      const atual = planejamentos.find(p => p.id === aberto.id);
      if (atual && atual !== aberto) setAberto(atual);
    }
  }, [planejamentos]);

  const disciplinaNome = (id?: string | null) => disciplinas.find(d => d.id === id)?.nome || '—';
  const disciplinaCor = (id?: string | null) => disciplinas.find(d => d.id === id)?.cor;
  const turmaNome = (id?: string | null) => turmas.find(t => t.id === id)?.nome || '—';
  const professorNome = (id?: string | null) => perfis[id || '']?.nome || perfis[id || '']?.email || '—';

  const filtrados = useMemo(() => {
    return fStatus === 'todos' ? planejamentos : planejamentos.filter(p => p.status === fStatus);
  }, [planejamentos, fStatus]);

  const agrupados = useMemo(() => {
    const map = new Map<string, Planejamento[]>();
    filtrados.forEach(p => {
      const k = `${p.ano}-${p.bimestre}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtrados]);

  if (aberto) {
    return (
      <PlanilhaPlanejamento
        planejamento={aberto}
        professorNome={professorNome(aberto.user_id)}
        disciplinaNome={disciplinaNome(aberto.disciplina_id)}
        turmaNome={turmaNome(aberto.turma_id)}
        onBack={() => { setAberto(null); refetch(); }}
        onChange={refetch}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Plano de Aula" subtitle="Planejamento bimestral em formato de planilha">
        {(isProfessor || isAdmin) && (
          <Button onClick={() => setCriarOpen(true)}><Plus className="w-4 h-4 mr-1" /> Novo Planejamento Bimestral</Button>
        )}
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="w-4 h-4" /></div>
        <SelectMini label="Bimestre" value={fBimestre} onChange={setFBimestre}
          options={[['todos', 'Todos'], ['1', '1º'], ['2', '2º'], ['3', '3º'], ['4', '4º']]} />
        <SelectMini label="Disciplina" value={fDisciplina} onChange={setFDisciplina}
          options={[['todas', 'Todas'], ...disciplinas.map(d => [d.id, d.nome] as [string, string])]} />
        <SelectMini label="Turma" value={fTurma} onChange={setFTurma}
          options={[['todas', 'Todas'], ...turmas.map(t => [t.id, t.nome] as [string, string])]} />
        {isGestao && (
          <SelectMini label="Professor" value={fProfessor} onChange={setFProfessor}
            options={[['todos', 'Todos'], ...Object.values(perfis).map(p => [p.id, p.nome || p.email] as [string, string])]} />
        )}
        <SelectMini label="Status" value={fStatus} onChange={setFStatus}
          options={[['todos', 'Todos'], ['rascunho', 'Rascunho'], ['aguardando_validacao', 'Aguardando validação'], ['validado', 'Validado']]} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtrados.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-12 h-12" />} message="Nenhum planejamento encontrado. Crie um novo planejamento bimestral." />
      ) : (
        <div className="space-y-6">
          {agrupados.map(([ano_bim, lista]) => {
            const [ano, bim] = ano_bim.split('-');
            return (
              <div key={ano_bim}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">{bim}º Bimestre · {ano}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lista.map(p => (
                    <Card key={p.id} onClick={() => setAberto(p)} className="p-4 cursor-pointer hover:shadow-md transition border-l-4" style={{ borderLeftColor: disciplinaCor(p.disciplina_id) || '#3b82f6' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${getDisciplinaDot(disciplinaCor(p.disciplina_id))}`} />
                            <h3 className="font-semibold text-sm truncate">{disciplinaNome(p.disciplina_id)}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">Turma: {turmaNome(p.turma_id)}</p>
                          {isGestao && <p className="text-xs text-muted-foreground truncate">Prof.: {professorNome(p.user_id)}</p>}
                        </div>
                        <StatusBadgeMini status={p.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {contagens[p.id] || 0} aulas</span>
                        {p.validado_em && <span>Validado em {new Date(p.validado_em).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DialogCriar
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        disciplinas={disciplinas}
        turmas={turmas}
        onCreated={(p) => { setCriarOpen(false); refetch(); setAberto(p); }}
      />
    </div>
  );
}

function SelectMini({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function StatusBadgeMini({ status }: { status: 'rascunho' | 'aguardando_validacao' | 'validado' }) {
  const map = {
    rascunho: { c: 'bg-muted text-muted-foreground', i: null },
    aguardando_validacao: { c: 'bg-amber-100 text-amber-800', i: <Clock className="w-3 h-3 mr-1" /> },
    validado: { c: 'bg-green-100 text-green-800', i: <CheckCircle className="w-3 h-3 mr-1" /> },
  } as const;
  return <Badge className={`${map[status].c} text-[10px] whitespace-nowrap`}>{map[status].i}{STATUS_LABEL[status]}</Badge>;
}

function DialogCriar({ open, onClose, disciplinas, turmas, onCreated }: {
  open: boolean; onClose: () => void; disciplinas: Disciplina[]; turmas: Turma[]; onCreated: (p: Planejamento) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disciplina, setDisciplina] = useState('');
  const [turma, setTurma] = useState('');
  const [bimestre, setBimestre] = useState('1');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (!open) { setDisciplina(''); setTurma(''); setBimestre('1'); } }, [open]);

  const criar = async () => {
    if (!user || !turma || !bimestre) return;
    setSalvando(true);
    // tenta achar existente
    let qEx = supabase.from('planejamentos_bimestrais').select('*')
      .eq('user_id', user.id).eq('turma_id', turma).eq('bimestre', Number(bimestre)).eq('ano', ANO_ATUAL);
    qEx = disciplina ? qEx.eq('disciplina_id', disciplina) : qEx.is('disciplina_id', null);
    const { data: ex } = await qEx.maybeSingle();
    if (ex) { onCreated(ex as Planejamento); setSalvando(false); return; }
    const { data, error } = await supabase.from('planejamentos_bimestrais').insert({
      user_id: user.id, turma_id: turma, disciplina_id: disciplina || null, bimestre: Number(bimestre), ano: ANO_ATUAL, status: 'rascunho',
    }).select('*').single();
    setSalvando(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    onCreated(data as Planejamento);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Planejamento Bimestral</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Disciplina</Label>
            <Select value={disciplina} onValueChange={setDisciplina}>
              <SelectTrigger><SelectValue placeholder="Selecione a disciplina" /></SelectTrigger>
              <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Turma</Label>
            <Select value={turma} onValueChange={setTurma}>
              <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
              <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bimestre</Label>
            <Select value={bimestre} onValueChange={setBimestre}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map(b => <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={criar} disabled={!turma || !disciplina || salvando}>{salvando ? 'Criando…' : 'Criar e abrir planilha'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}