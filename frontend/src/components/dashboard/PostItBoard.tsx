import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, Pin, PinOff, Check, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

// ── tipos ──────────────────────────────────────────────────────────
interface Lembrete {
  id: string;
  titulo: string;
  descricao?: string | null;
  data?: string | null;
  prioridade: 'baixa' | 'media' | 'alta';
  cor: string;
  turma_id?: string | null;
  disciplina_id?: string | null;
  concluido: boolean;
  fixado: boolean;
  created_at: string;
}

interface Turma { id: string; nome: string }
interface Disciplina { id: string; nome: string }

// ── paleta de cores dos post-its ───────────────────────────────────
const COR_STYLE: Record<string, { card: string; header: string; dot: string }> = {
  amarelo: { card: 'bg-yellow-50  border-yellow-300', header: 'bg-yellow-200',  dot: 'bg-yellow-400'  },
  verde:   { card: 'bg-green-50   border-green-300',  header: 'bg-green-200',   dot: 'bg-green-400'   },
  azul:    { card: 'bg-blue-50    border-blue-300',   header: 'bg-blue-200',    dot: 'bg-blue-400'    },
  rosa:    { card: 'bg-pink-50    border-pink-300',   header: 'bg-pink-200',    dot: 'bg-pink-400'    },
  laranja: { card: 'bg-orange-50  border-orange-300', header: 'bg-orange-200',  dot: 'bg-orange-400'  },
  roxo:    { card: 'bg-purple-50  border-purple-300', header: 'bg-purple-200',  dot: 'bg-purple-400'  },
};

const PRIORIDADE_CORES: Record<string, string> = { baixa: 'verde', media: 'amarelo', alta: 'rosa' };
const PRIORIDADE_LABEL: Record<string, string>  = { baixa: '🟢 Baixa', media: '🟡 Média', alta: '🔴 Alta' };

function isToday(d?: string | null) {
  if (!d) return false;
  return new Date(d + 'T12:00:00').toDateString() === new Date().toDateString();
}
function isPast(d?: string | null) {
  if (!d) return false;
  const dt = new Date(d + 'T23:59:59');
  return dt < new Date() && !isToday(d);
}
function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// usar `any` para contornar tipos desatualizados
const db = supabase as any;

// ── Formulário ─────────────────────────────────────────────────────
function NovoForm({ turmas, disciplinas, onSave, onClose }: {
  turmas: Turma[]; disciplinas: Disciplina[]; onSave: () => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const { userId } = usePermissions();
  const [titulo, setTitulo]         = useState('');
  const [descricao, setDescricao]   = useState('');
  const [data, setData]             = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [cor, setCor]               = useState('amarelo');
  const [turmaId, setTurmaId]       = useState('');
  const [discId, setDiscId]         = useState('');
  const [saving, setSaving]         = useState(false);

  const handlePrioridade = (p: string) => { setPrioridade(p); setCor(PRIORIDADE_CORES[p] || 'amarelo'); };
  const style = COR_STYLE[cor] || COR_STYLE['amarelo'];

  const save = async () => {
    if (!titulo.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    if (!userId) { toast({ title: 'Você precisa estar logado', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await db.from('lembretes').insert({
      titulo: titulo.trim(), descricao: descricao || null, data: data || null,
      prioridade, cor, turma_id: turmaId || null, disciplina_id: discId || null,
      user_id: userId,
    });
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '📌 Lembrete criado!' });
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className={cn('rounded-2xl border-2 shadow-elevated p-5 w-full max-w-sm', style.card, style.card.split(' ')[1])}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground text-base">📌 Novo Lembrete</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
        </div>

        <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
          placeholder="Título do lembrete..." onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-white/70 border border-black/10 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary" />
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)..." rows={2}
          className="w-full bg-white/70 border border-black/10 rounded-lg px-3 py-2 text-sm mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary" />

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-xs text-foreground/60 font-medium">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full bg-white/70 border border-black/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-foreground/60 font-medium">Prioridade</label>
            <select value={prioridade} onChange={e => handlePrioridade(e.target.value)}
              className="w-full bg-white/70 border border-black/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="baixa">🟢 Baixa</option>
              <option value="media">🟡 Média</option>
              <option value="alta">🔴 Alta</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-foreground/60 font-medium">Turma</label>
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
              className="w-full bg-white/70 border border-black/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Todas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/60 font-medium">Disciplina</label>
            <select value={discId} onChange={e => setDiscId(e.target.value)}
              className="w-full bg-white/70 border border-black/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Todas</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Seletor de cor */}
        <div className="mb-4">
          <label className="text-xs text-foreground/60 font-medium block mb-1.5">Cor do post-it</label>
          <div className="flex gap-2">
            {Object.entries(COR_STYLE).map(([key, val]) => (
              <button key={key} title={key} onClick={() => setCor(key)}
                className={cn('w-7 h-7 rounded-full border-2 transition-all', val.dot,
                  cor === key ? 'border-foreground scale-110 shadow-md' : 'border-transparent')} />
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : 'Criar Lembrete'}
        </button>
      </div>
    </div>
  );
}

// ── Card individual ────────────────────────────────────────────────
function LembreteCard({ item, turmas, disciplinas, onRefresh }: {
  item: Lembrete; turmas: Turma[]; disciplinas: Disciplina[]; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const style = COR_STYLE[item.cor] || COR_STYLE['amarelo'];
  const turma = turmas.find(t => t.id === item.turma_id);
  const disc  = disciplinas.find(d => d.id === item.disciplina_id);
  const hoje  = isToday(item.data);
  const atrasado = isPast(item.data) && !item.concluido;

  const update = async (patch: Partial<Lembrete>) => {
    await db.from('lembretes').update(patch).eq('id', item.id);
    onRefresh();
  };
  const remove = async () => {
    await db.from('lembretes').delete().eq('id', item.id);
    toast({ title: 'Lembrete removido' });
    onRefresh();
  };

  return (
    <div className={cn(
      'rounded-xl border-2 shadow-sm overflow-hidden transition-all hover:shadow-md group',
      style.card, item.concluido && 'opacity-55',
    )}>
      {/* topo colorido */}
      <div className={cn('px-3 py-1.5 flex items-center justify-between', style.header)}>
        <div className="flex items-center gap-1 min-w-0">
          {item.fixado && <Pin className="w-3 h-3 text-foreground/70 flex-shrink-0" />}
          {hoje && !item.concluido && <AlertTriangle className="w-3 h-3 text-orange-600 flex-shrink-0" />}
          <span className="text-xs font-bold text-foreground/80 truncate">{PRIORIDADE_LABEL[item.prioridade]}</span>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => update({ fixado: !item.fixado })} title={item.fixado ? 'Desafixar' : 'Fixar'}
            className="p-1 hover:bg-black/10 rounded transition-colors">
            {item.fixado ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => update({ concluido: !item.concluido })} title={item.concluido ? 'Reabrir' : 'Concluir'}
            className="p-1 hover:bg-black/10 rounded transition-colors">
            <Check className={cn('w-3.5 h-3.5', item.concluido && 'text-green-700')} />
          </button>
          <button onClick={remove} title="Excluir"
            className="p-1 hover:bg-black/10 rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* corpo */}
      <div className="px-3 py-2.5">
        <p className={cn('text-sm font-semibold text-foreground leading-snug mb-1', item.concluido && 'line-through text-foreground/50')}>
          {item.titulo}
        </p>
        {item.descricao && (
          <p className="text-xs text-foreground/65 leading-snug mb-2">{item.descricao}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {item.data && (
            <span className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium',
              hoje ? 'bg-orange-200 text-orange-800' : atrasado ? 'bg-red-200 text-red-700' : 'bg-black/10 text-foreground/70',
            )}>
              <Clock className="w-2.5 h-2.5" />
              {hoje ? '🔔 Hoje' : atrasado ? `⚠ ${fmtDate(item.data)}` : fmtDate(item.data)}
            </span>
          )}
          {turma && <span className="text-xs px-1.5 py-0.5 rounded-full bg-black/10 text-foreground/70">{turma.nome}</span>}
          {disc  && <span className="text-xs px-1.5 py-0.5 rounded-full bg-black/10 text-foreground/70">{disc.nome}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Board principal (exportado) ────────────────────────────────────
export function PostItBoard() {
  const [items, setItems]           = useState<Lembrete[]>([]);
  const [turmas, setTurmas]         = useState<Turma[]>([]);
  const [disciplinas, setDiscs]     = useState<Disciplina[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [showDone, setShowDone]     = useState(false);
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    const [{ data: l }, { data: t }, { data: d }] = await Promise.all([
      db.from('lembretes').select('*').order('fixado', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('turmas').select('id, nome'),
      supabase.from('disciplinas').select('id, nome'),
    ]);
    setItems(l || []);
    setTurmas(t || []);
    setDiscs(d || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendentes  = items.filter(i => !i.concluido);
  const concluidos = items.filter(i => i.concluido);
  const hoje   = pendentes.filter(i => isToday(i.data)).length;
  const atrasados = pendentes.filter(i => isPast(i.data)).length;

  return (
    <section>
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            📌 Lembretes
            {pendentes.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">{pendentes.length}</span>
            )}
          </h2>
          {hoje > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full animate-pulse">
              🔔 {hoje} hoje
            </span>
          )}
          {atrasados > 0 && (
            <span className="text-xs bg-red-100 text-destructive font-semibold px-2 py-0.5 rounded-full">
              ⚠ {atrasados} atrasado{atrasados > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-3.5 h-3.5" /> Novo lembrete
        </button>
      </div>

      {/* grid de post-its */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : pendentes.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
          <p className="text-3xl mb-2">📌</p>
          <p className="text-sm text-muted-foreground mb-3">Nenhum lembrete ativo</p>
          <button onClick={() => setShowForm(true)}
            className="text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
            + Criar primeiro lembrete
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {pendentes.map(i => (
            <LembreteCard key={i.id} item={i} turmas={turmas} disciplinas={disciplinas} onRefresh={load} />
          ))}
        </div>
      )}

      {/* concluídos */}
      {concluidos.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 select-none">
            {showDone ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {concluidos.length} concluído{concluidos.length !== 1 ? 's' : ''}
          </button>
          {showDone && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {concluidos.map(i => (
                <LembreteCard key={i.id} item={i} turmas={turmas} disciplinas={disciplinas} onRefresh={load} />
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <NovoForm turmas={turmas} disciplinas={disciplinas} onSave={load} onClose={() => setShowForm(false)} />
      )}
    </section>
  );
}
