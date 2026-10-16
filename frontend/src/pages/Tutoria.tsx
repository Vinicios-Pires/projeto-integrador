import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  HeartHandshake, Plus, Search, FileDown, Smile, Meh, Frown, AlertTriangle, Loader2, Trash2,
  CheckCircle2, UserPlus, Users, Camera, Upload, X, FileText, Download, ClipboardList,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Tutorado = {
  id: string; user_id: string; aluno_id: string | null; nome: string; turma: string | null;
  numero_chamada: number | null; status: string; observacoes: string | null;
  foto_path: string | null; data_inicio: string; created_at: string;
};
type Checkin = { id: string; tutorado_id: string; humor: string; observacao: string | null; created_at: string };
type Registro = { id: string; tutorado_id: string; user_id: string; data: string; como_esta: string | null; observacao: string | null; combinado: string | null; proxima_acao: string | null };
type Combinado = { id: string; tutorado_id: string; user_id: string; descricao: string; data: string; status: string };
type Documento = { id: string; tutorado_id: string; user_id: string; storage_path: string; nome_arquivo: string; mime_type: string | null; tamanho_bytes: number | null; created_at: string };
type Aluno = { id: string; nome: string; turma_id: string | null; numero_chamada: number | null; serie: string | null; ativo: boolean | null };
type Turma = { id: string; nome: string; serie: string; turno: string; ano_letivo: number };

const HUMORES = [
  { key: 'bem', label: 'Bem', icon: Smile, color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { key: 'mais_ou_menos', label: 'Mais ou menos', icon: Meh, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { key: 'dificil', label: 'Difícil', icon: Frown, color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { key: 'observar', label: 'Observar', icon: AlertTriangle, color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
];

const FOTOS_BUCKET = 'tutoria-fotos';
const DOCS_BUCKET = 'tutoria-documentos';

const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

function Avatar({ url, nome, size = 56 }: { url?: string | null; nome: string; size?: number }) {
  return url ? (
    <img src={url} alt={`Foto de ${nome}`} loading="lazy"
      className="rounded-2xl object-cover border shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-2xl bg-primary/10 text-primary grid place-items-center font-semibold border shrink-0"
      style={{ width: size, height: size, fontSize: size / 3 }}>{iniciais(nome) || '?'}</div>
  );
}

export default function Tutoria() {
  const { user } = useAuth();
  const { canEdit, isAdmin, isGestao } = usePermissions();
  const { toast } = useToast();
  const sb = supabase as any;

  const [loading, setLoading] = useState(true);
  const [tutorados, setTutorados] = useState<Tutorado[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { nome: string; email: string }>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);

  const [filter, setFilter] = useState('');
  const [filtroProfessor, setFiltroProfessor] = useState('todos');
  const [filtroTurma, setFiltroTurma] = useState('todas');
  const [openAdd, setOpenAdd] = useState(false);
  const [aberto, setAberto] = useState<Tutorado | null>(null);

  const assinarFotos = useCallback(async (lista: Tutorado[]) => {
    const paths = lista.map(t => t.foto_path).filter(Boolean) as string[];
    if (!paths.length) { setFotoUrls({}); return; }
    const { data } = await sb.storage.from(FOTOS_BUCKET).createSignedUrls(paths, 3600);
    const map: Record<string, string> = {};
    (data || []).forEach((d: any) => { if (d?.path && d?.signedUrl) map[d.path] = d.signedUrl; });
    setFotoUrls(map);
  }, [sb]);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, rRes, pRes, tuRes, aRes] = await Promise.all([
      sb.from('tutorados').select('*').order('nome'),
      sb.from('tutoria_registros').select('*').order('data', { ascending: false }),
      sb.from('profiles').select('id,nome,email'),
      sb.from('turmas').select('id,nome,serie,turno,ano_letivo').order('nome'),
      sb.from('alunos').select('id,nome,turma_id,numero_chamada,serie,ativo').order('nome'),
    ]);
    const lista: Tutorado[] = tRes.data || [];
    setTutorados(lista);
    setRegistros(rRes.data || []);
    setTurmas(tuRes.data || []);
    setAlunos(aRes.data || []);
    const pm: Record<string, { nome: string; email: string }> = {};
    (pRes.data || []).forEach((p: any) => { pm[p.id] = { nome: p.nome, email: p.email }; });
    setProfiles(pm);
    await assinarFotos(lista);
    setLoading(false);
  }, [sb, assinarFotos]);

  useEffect(() => { load(); }, [load]);

  const ultimoRegistroPor = useMemo(() => {
    const m = new Map<string, Registro>();
    for (const r of registros) if (!m.has(r.tutorado_id)) m.set(r.tutorado_id, r);
    return m;
  }, [registros]);

  const professoresComTutorados = useMemo(() => {
    const ids = Array.from(new Set(tutorados.map(t => t.user_id)));
    return ids.map(id => ({ id, nome: profiles[id]?.nome || profiles[id]?.email || 'Professor(a)' }));
  }, [tutorados, profiles]);

  const visiveis = tutorados.filter(t => {
    const q = filter.trim().toLowerCase();
    if (q && !t.nome.toLowerCase().includes(q) && !(t.turma || '').toLowerCase().includes(q)) return false;
    if (filtroProfessor !== 'todos' && t.user_id !== filtroProfessor) return false;
    if (filtroTurma !== 'todas' && (t.turma || '—') !== filtroTurma) return false;
    return true;
  });

  const turmasDosTutorados = Array.from(new Set(tutorados.map(t => t.turma).filter(Boolean))) as string[];

  const podeEditarTutorado = (t: Tutorado) => isAdmin || t.user_id === user?.id;

  const remover = async (t: Tutorado) => {
    if (!confirm(`Remover ${t.nome} da sua lista de tutorados? O aluno continua cadastrado no sistema.`)) return;
    const { error } = await sb.from('tutorados').delete().eq('id', t.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Tutorado removido' }); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary grid place-items-center">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tutoria</h1>
            <p className="text-sm text-muted-foreground">Prontuário de acompanhamento dos seus tutorados.</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => setOpenAdd(true)} className="rounded-full">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Tutorado
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tutorados</p><p className="text-2xl font-bold">{tutorados.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Registros de acompanhamento</p><p className="text-2xl font-bold">{registros.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem registro recente</p><p className="text-2xl font-bold">{tutorados.filter(t => !ultimoRegistroPor.get(t.id)).length}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 rounded-full" placeholder="Buscar tutorado ou turma" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <Select value={filtroTurma} onValueChange={setFiltroTurma}>
          <SelectTrigger className="w-[170px] rounded-full"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as turmas</SelectItem>
            {turmasDosTutorados.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {isGestao && (
          <Select value={filtroProfessor} onValueChange={setFiltroProfessor}>
            <SelectTrigger className="w-[200px] rounded-full"><SelectValue placeholder="Professor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os professores</SelectItem>
              {professoresComTutorados.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : visiveis.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhum tutorado encontrado.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map(t => {
            const last = ultimoRegistroPor.get(t.id);
            return (
              <Card key={t.id} className="rounded-2xl hover:shadow-elevated transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar url={t.foto_path ? fotoUrls[t.foto_path] : null} nome={t.nome} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">{t.turma || 'Turma não informada'}{t.numero_chamada ? ` · nº ${t.numero_chamada}` : ''}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        <Badge variant="outline" className={t.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : ''}>
                          {t.status === 'ativo' ? 'Acompanhamento ativo' : t.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {isGestao && <p className="text-[11px] text-muted-foreground">Tutor: {profiles[t.user_id]?.nome || profiles[t.user_id]?.email || '—'}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {last ? `Último registro: ${new Date(last.data).toLocaleDateString('pt-BR')}` : 'Sem registros ainda'}
                  </p>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" className="rounded-full flex-1" onClick={() => setAberto(t)}>
                      <ClipboardList className="w-4 h-4 mr-1" /> Abrir prontuário
                    </Button>
                    {podeEditarTutorado(t) && (
                      <Button size="sm" variant="ghost" onClick={() => remover(t)}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {openAdd && (
        <AdicionarTutoradoDialog
          onClose={(recarregar) => { setOpenAdd(false); if (recarregar) load(); }}
          turmas={turmas} alunos={alunos} tutorados={tutorados}
        />
      )}

      {aberto && (
        <Prontuario
          tutorado={aberto}
          fotoUrl={aberto.foto_path ? fotoUrls[aberto.foto_path] : null}
          tutorNome={profiles[aberto.user_id]?.nome || profiles[aberto.user_id]?.email || '—'}
          readOnly={!podeEditarTutorado(aberto)}
          onClose={(recarregar) => { setAberto(null); if (recarregar) load(); }}
        />
      )}
    </div>
  );
}

/* ---------------- Adicionar tutorado ---------------- */

function AdicionarTutoradoDialog({ onClose, turmas, alunos, tutorados }: {
  onClose: (recarregar?: boolean) => void; turmas: Turma[]; alunos: Aluno[]; tutorados: Tutorado[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const sb = supabase as any;
  const [salvando, setSalvando] = useState(false);

  const turmaById = useMemo(() => Object.fromEntries(turmas.map(t => [t.id, t])), [turmas]);
  const jaTutorados = useMemo(
    () => new Set(tutorados.filter(t => t.user_id === user?.id && t.aluno_id).map(t => t.aluno_id as string)),
    [tutorados, user],
  );

  // seleção
  const [busca, setBusca] = useState('');
  const [fTurma, setFTurma] = useState('todas');
  const [fSerie, setFSerie] = useState('todas');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // novo aluno
  const [novo, setNovo] = useState({ nome: '', turma_id: '', numero_chamada: '', ativo: 'true' });
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const series = Array.from(new Set(turmas.map(t => t.serie).filter(Boolean)));

  const listaFiltrada = alunos.filter(a => {
    if (a.ativo === false) return false;
    const turma = a.turma_id ? turmaById[a.turma_id] : null;
    if (fTurma !== 'todas' && a.turma_id !== fTurma) return false;
    if (fSerie !== 'todas' && (turma?.serie || a.serie) !== fSerie) return false;
    const q = busca.trim().toLowerCase();
    if (q && !a.nome.toLowerCase().includes(q)) return false;
    return true;
  });

  const agrupados = useMemo(() => {
    const map = new Map<string, Aluno[]>();
    for (const a of listaFiltrada) {
      const turma = a.turma_id ? turmaById[a.turma_id] : null;
      const chave = turma ? `${turma.serie || 'Sem série'} · ${turma.nome}` : 'Sem turma';
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [listaFiltrada, turmaById]);

  const toggle = (id: string) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const salvarSelecionados = async () => {
    if (!user || selecionados.size === 0) { toast({ title: 'Selecione ao menos um aluno', variant: 'destructive' }); return; }
    setSalvando(true);
    const rows = Array.from(selecionados).map(id => {
      const a = alunos.find(x => x.id === id)!;
      const turma = a.turma_id ? turmaById[a.turma_id] : null;
      return {
        user_id: user.id, aluno_id: a.id, nome: a.nome,
        turma: turma?.nome || a.serie || null,
        numero_chamada: a.numero_chamada, status: 'ativo',
      };
    });
    const { error } = await sb.from('tutorados').insert(rows);
    setSalvando(false);
    if (error) { toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${rows.length} tutorado(s) vinculado(s)` });
    onClose(true);
  };

  const escolherFoto = (f: File | null) => {
    setFotoFile(f);
    setFotoPreview(f ? URL.createObjectURL(f) : null);
  };

  const salvarNovoAluno = async () => {
    if (!user || !novo.nome.trim()) { toast({ title: 'Informe o nome do aluno', variant: 'destructive' }); return; }
    if (!novo.turma_id) { toast({ title: 'Selecione a turma', variant: 'destructive' }); return; }
    const turma = turmaById[novo.turma_id];
    const duplicado = alunos.find(a => a.turma_id === novo.turma_id && a.nome.trim().toLowerCase() === novo.nome.trim().toLowerCase());
    setSalvando(true);
    let alunoId = duplicado?.id ?? null;
    if (!alunoId) {
      const { data, error } = await sb.from('alunos').insert({
        nome: novo.nome.trim(), turma_id: novo.turma_id,
        numero_chamada: novo.numero_chamada ? parseInt(novo.numero_chamada) : null,
        serie: turma?.serie || null, ativo: novo.ativo === 'true',
      }).select('id').single();
      if (error) { setSalvando(false); toast({ title: 'Erro ao cadastrar aluno', description: error.message, variant: 'destructive' }); return; }
      alunoId = data.id;
    } else {
      toast({ title: 'Aluno já existia', description: 'Vinculado sem duplicar o cadastro.' });
    }

    const { data: tut, error: tErr } = await sb.from('tutorados').insert({
      user_id: user.id, aluno_id: alunoId, nome: novo.nome.trim(),
      turma: turma?.nome || null,
      numero_chamada: novo.numero_chamada ? parseInt(novo.numero_chamada) : null,
      status: novo.ativo === 'true' ? 'ativo' : 'inativo',
    }).select('id').single();
    if (tErr) { setSalvando(false); toast({ title: 'Erro ao vincular tutorado', description: tErr.message, variant: 'destructive' }); return; }

    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${tut.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from(FOTOS_BUCKET).upload(path, fotoFile, { upsert: true });
      if (!upErr) await sb.from('tutorados').update({ foto_path: path }).eq('id', tut.id);
    }
    setSalvando(false);
    toast({ title: 'Tutorado adicionado' });
    onClose(true);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Adicionar tutorado</DialogTitle></DialogHeader>
        <Tabs defaultValue="existente">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="existente"><Users className="w-4 h-4 mr-1" /> Aluno já cadastrado</TabsTrigger>
            <TabsTrigger value="novo"><UserPlus className="w-4 h-4 mr-1" /> Cadastrar novo aluno</TabsTrigger>
          </TabsList>

          <TabsContent value="existente" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <Input className="flex-1 min-w-[180px] rounded-full" placeholder="Buscar por nome" value={busca} onChange={e => setBusca(e.target.value)} />
              <Select value={fSerie} onValueChange={setFSerie}>
                <SelectTrigger className="w-[150px] rounded-full"><SelectValue placeholder="Série" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as séries</SelectItem>
                  {series.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fTurma} onValueChange={setFTurma}>
                <SelectTrigger className="w-[160px] rounded-full"><SelectValue placeholder="Turma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as turmas</SelectItem>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-4 pr-1">
              {agrupados.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno encontrado. Cadastre alunos em “Alunos” ou use a aba ao lado.</p>}
              {agrupados.map(([grupo, lista]) => (
                <div key={grupo} className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{grupo}</p>
                  {lista.map(a => {
                    const ja = jaTutorados.has(a.id);
                    return (
                      <label key={a.id} className={`flex items-center gap-3 p-2 rounded-lg border ${ja ? 'opacity-50' : 'hover:bg-accent cursor-pointer'}`}>
                        <Checkbox checked={selecionados.has(a.id)} disabled={ja} onCheckedChange={() => toggle(a.id)} />
                        <span className="text-sm flex-1">{a.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.turma_id ? turmaById[a.turma_id]?.nome : '—'}{a.numero_chamada ? ` · nº ${a.numero_chamada}` : ''}
                        </span>
                        {ja && <Badge variant="outline" className="text-[10px]">já é tutorado</Badge>}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
              <Button onClick={salvarSelecionados} disabled={salvando}>
                {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="novo" className="space-y-3 pt-4">
            <div className="flex items-center gap-4">
              <Avatar url={fotoPreview} nome={novo.nome || '?'} size={72} />
              <div className="flex gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1 text-sm border rounded-full px-3 py-2 cursor-pointer hover:bg-accent">
                  <Upload className="w-4 h-4" /> Enviar foto
                  <input type="file" accept="image/*" className="hidden" onChange={e => escolherFoto(e.target.files?.[0] ?? null)} />
                </label>
                <label className="inline-flex items-center gap-1 text-sm border rounded-full px-3 py-2 cursor-pointer hover:bg-accent">
                  <Camera className="w-4 h-4" /> Tirar foto
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => escolherFoto(e.target.files?.[0] ?? null)} />
                </label>
                {fotoPreview && <Button variant="ghost" size="sm" onClick={() => escolherFoto(null)}><X className="w-4 h-4 mr-1" /> Remover</Button>}
              </div>
            </div>
            <div><Label>Nome completo *</Label><Input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <Label>Turma *</Label>
                <Select value={novo.turma_id} onValueChange={v => setNovo({ ...novo, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº chamada</Label><Input type="number" value={novo.numero_chamada} onChange={e => setNovo({ ...novo, numero_chamada: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={novo.ativo} onValueChange={v => setNovo({ ...novo, ativo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
              <Button onClick={salvarNovoAluno} disabled={salvando}>
                {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Cadastrar e vincular
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Prontuário ---------------- */

function Prontuario({ tutorado, fotoUrl, tutorNome, readOnly, onClose }: {
  tutorado: Tutorado; fotoUrl: string | null; tutorNome: string; readOnly: boolean; onClose: (recarregar?: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const sb = supabase as any;
  const mudou = useRef(false);

  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [combinados, setCombinados] = useState<Combinado[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [notas, setNotas] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [fotoLocal, setFotoLocal] = useState<string | null>(fotoUrl);
  const [fotoPath, setFotoPath] = useState<string | null>(tutorado.foto_path);
  const [enviando, setEnviando] = useState(false);

  const [novoHumor, setNovoHumor] = useState('bem');
  const [obsCheckin, setObsCheckin] = useState('');
  const [novoReg, setNovoReg] = useState({ como_esta: '', observacao: '', combinado: '', proxima_acao: '' });
  const [novoComb, setNovoComb] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r, b, d] = await Promise.all([
      sb.from('tutoria_checkins').select('*').eq('tutorado_id', tutorado.id).order('created_at', { ascending: false }),
      sb.from('tutoria_registros').select('*').eq('tutorado_id', tutorado.id).order('data', { ascending: false }),
      sb.from('tutoria_combinados').select('*').eq('tutorado_id', tutorado.id).order('data', { ascending: false }),
      sb.from('tutoria_documentos').select('*').eq('tutorado_id', tutorado.id).order('created_at', { ascending: false }),
    ]);
    setCheckins(c.data || []); setRegistros(r.data || []); setCombinados(b.data || []); setDocumentos(d.data || []);

    if (tutorado.aluno_id) {
      const { data: nData } = await sb.from('notas')
        .select('id,nota,bimestre,observacoes,tipos_avaliacao(nome,categoria)')
        .eq('aluno_id', tutorado.aluno_id).order('bimestre');
      setNotas(nData || []);
    } else setNotas([]);

    const { data: oData } = await sb.from('ocorrencias_escolares')
      .select('id,data,tipo,descricao,status,providencias,disciplina,alunos')
      .ilike('alunos', `%${tutorado.nome.split(' ')[0]}%`).order('data', { ascending: false });
    setOcorrencias((oData || []).filter((o: any) => (o.alunos || '').toLowerCase().includes(tutorado.nome.toLowerCase().split(' ')[0])));
    setLoading(false);
  }, [sb, tutorado.id, tutorado.aluno_id, tutorado.nome]);

  useEffect(() => { load(); }, [load]);

  /* foto */
  const trocarFoto = async (file: File | null) => {
    if (!file || !user) return;
    setEnviando(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${tutorado.id}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(FOTOS_BUCKET).upload(path, file, { upsert: true });
    if (error) { setEnviando(false); toast({ title: 'Erro ao enviar foto', description: error.message, variant: 'destructive' }); return; }
    const antiga = fotoPath;
    await sb.from('tutorados').update({ foto_path: path }).eq('id', tutorado.id);
    if (antiga) await sb.storage.from(FOTOS_BUCKET).remove([antiga]);
    const { data: signed } = await sb.storage.from(FOTOS_BUCKET).createSignedUrl(path, 3600);
    setFotoPath(path); setFotoLocal(signed?.signedUrl || null);
    mudou.current = true; setEnviando(false);
    toast({ title: 'Foto atualizada' });
  };
  const removerFoto = async () => {
    if (!fotoPath) return;
    await sb.from('tutorados').update({ foto_path: null }).eq('id', tutorado.id);
    await sb.storage.from(FOTOS_BUCKET).remove([fotoPath]);
    setFotoPath(null); setFotoLocal(null); mudou.current = true;
  };

  /* registros e combinados */
  const addCheckin = async () => {
    if (!user) return;
    const { error } = await sb.from('tutoria_checkins').insert({ tutorado_id: tutorado.id, user_id: user.id, humor: novoHumor, observacao: obsCheckin || null });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setObsCheckin(''); toast({ title: 'Check-in registrado' }); mudou.current = true; load(); }
  };
  const addRegistro = async () => {
    if (!user || !novoReg.como_esta.trim()) { toast({ title: 'Preencha "Como o aluno está"', variant: 'destructive' }); return; }
    const { error } = await sb.from('tutoria_registros').insert({ tutorado_id: tutorado.id, user_id: user.id, ...novoReg });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setNovoReg({ como_esta: '', observacao: '', combinado: '', proxima_acao: '' }); toast({ title: 'Registro salvo' }); mudou.current = true; load(); }
  };
  const removerRegistro = async (r: Registro) => {
    if (!confirm('Excluir este registro?')) return;
    const { error } = await sb.from('tutoria_registros').delete().eq('id', r.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { mudou.current = true; load(); }
  };
  const addCombinado = async () => {
    if (!user || !novoComb.trim()) return;
    const { error } = await sb.from('tutoria_combinados').insert({ tutorado_id: tutorado.id, user_id: user.id, descricao: novoComb });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setNovoComb(''); load(); }
  };
  const togglarComb = async (c: Combinado) => {
    const status = c.status === 'concluido' ? 'pendente' : 'concluido';
    const { error } = await sb.from('tutoria_combinados').update({ status }).eq('id', c.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  /* documentos */
  const enviarDocumento = async (file: File | null) => {
    if (!file || !user) return;
    setEnviando(true);
    const path = `${user.id}/${tutorado.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await sb.storage.from(DOCS_BUCKET).upload(path, file);
    if (error) { setEnviando(false); toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); return; }
    const { error: dbErr } = await sb.from('tutoria_documentos').insert({
      tutorado_id: tutorado.id, user_id: user.id, storage_path: path,
      nome_arquivo: file.name, mime_type: file.type, tamanho_bytes: file.size,
    });
    setEnviando(false);
    if (dbErr) { await sb.storage.from(DOCS_BUCKET).remove([path]); toast({ title: 'Erro', description: dbErr.message, variant: 'destructive' }); return; }
    toast({ title: 'Documento anexado' }); load();
  };
  const abrirDocumento = async (d: Documento, baixar = false) => {
    const { data, error } = await sb.storage.from(DOCS_BUCKET).createSignedUrl(d.storage_path, 300, baixar ? { download: d.nome_arquivo } : undefined);
    if (error || !data?.signedUrl) { toast({ title: 'Erro ao abrir', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const removerDocumento = async (d: Documento) => {
    if (!confirm(`Remover "${d.nome_arquivo}"?`)) return;
    const { error } = await sb.from('tutoria_documentos').delete().eq('id', d.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await sb.storage.from(DOCS_BUCKET).remove([d.storage_path]);
    load();
  };

  const mediasPorBimestre = useMemo(() => {
    const acc: Record<number, number[]> = {};
    for (const n of notas) {
      if (n.nota == null || !n.bimestre) continue;
      (acc[n.bimestre] ||= []).push(Number(n.nota));
    }
    return Object.entries(acc).map(([b, arr]) => ({ bimestre: Number(b), media: arr.reduce((s, v) => s + v, 0) / arr.length, qtd: arr.length }))
      .sort((a, b) => a.bimestre - b.bimestre);
  }, [notas]);

  const exportarPdf = async () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(11, 94, 215);
    doc.text('Relatório de Tutoria', 14, 18);
    doc.setTextColor(0); doc.setFontSize(12);
    doc.text(tutorado.nome, 14, 27);
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Turma: ${tutorado.turma || '—'}   Nº: ${tutorado.numero_chamada ?? '—'}   Status: ${tutorado.status}`, 14, 33);
    doc.text(`Professor tutor: ${tutorNome}   Início da tutoria: ${new Date(tutorado.data_inicio).toLocaleDateString('pt-BR')}`, 14, 38);
    doc.setTextColor(0);

    if (fotoLocal) {
      try {
        const blob = await (await fetch(fotoLocal)).blob();
        const b64: string = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
        doc.addImage(b64, 'JPEG', 165, 14, 30, 30);
      } catch { /* segue sem foto */ }
    }

    let y = 50;
    const secao = (titulo: string, head: string[], body: any[][]) => {
      if (!body.length) return;
      doc.setFontSize(11); doc.text(titulo, 14, y);
      autoTable(doc, { startY: y + 2, head: [head], body, styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [11, 94, 215] } });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 260) { doc.addPage(); y = 18; }
    };

    secao('Registros de acompanhamento', ['Data', 'Como está', 'Relato', 'Combinado', 'Próxima ação'],
      registros.map(r => [new Date(r.data).toLocaleDateString('pt-BR'), r.como_esta || '', r.observacao || '', r.combinado || '', r.proxima_acao || '']));
    secao('Check-ins', ['Data', 'Humor', 'Observação'],
      checkins.map(c => [new Date(c.created_at).toLocaleDateString('pt-BR'), HUMORES.find(h => h.key === c.humor)?.label || c.humor, c.observacao || '']));
    secao('Combinados', ['Data', 'Descrição', 'Status'],
      combinados.map(c => [new Date(c.data).toLocaleDateString('pt-BR'), c.descricao, c.status]));
    secao('Evolução das notas', ['Bimestre', 'Média', 'Avaliações'],
      mediasPorBimestre.map(m => [`${m.bimestre}º`, m.media.toFixed(1), String(m.qtd)]));
    secao('Ocorrências escolares', ['Data', 'Tipo', 'Descrição', 'Status'],
      ocorrencias.map(o => [new Date(o.data).toLocaleDateString('pt-BR'), o.tipo, o.descricao, o.status]));
    secao('Documentos anexados', ['Arquivo', 'Enviado em'],
      documentos.map(d => [d.nome_arquivo, new Date(d.created_at).toLocaleDateString('pt-BR')]));

    doc.save(`tutoria_${tutorado.nome.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(mudou.current)}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="sr-only">Prontuário de {tutorado.nome}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <Avatar url={fotoLocal} nome={tutorado.nome} size={96} />
            {!readOnly && (
              <div className="flex flex-wrap gap-1">
                <label className="inline-flex items-center gap-1 text-[11px] border rounded-full px-2 py-1 cursor-pointer hover:bg-accent">
                  <Upload className="w-3 h-3" /> Enviar
                  <input type="file" accept="image/*" className="hidden" onChange={e => trocarFoto(e.target.files?.[0] ?? null)} />
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] border rounded-full px-2 py-1 cursor-pointer hover:bg-accent">
                  <Camera className="w-3 h-3" /> Câmera
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => trocarFoto(e.target.files?.[0] ?? null)} />
                </label>
                {fotoPath && <button onClick={removerFoto} className="inline-flex items-center gap-1 text-[11px] border rounded-full px-2 py-1 hover:bg-accent"><X className="w-3 h-3" /> Remover</button>}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-xl font-bold">{tutorado.nome}</h2>
            <p className="text-sm text-muted-foreground">{tutorado.turma || 'Turma não informada'}{tutorado.numero_chamada ? ` · nº ${tutorado.numero_chamada}` : ''}</p>
            <p className="text-xs text-muted-foreground mt-1">Professor tutor: <b>{tutorNome}</b></p>
            <p className="text-xs text-muted-foreground">Início da tutoria: {new Date(tutorado.data_inicio).toLocaleDateString('pt-BR')}</p>
            <Badge variant="outline" className="mt-2">{tutorado.status === 'ativo' ? 'Acompanhamento ativo' : tutorado.status}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={exportarPdf} className="rounded-full">
            <FileDown className="w-4 h-4 mr-1" /> Gerar relatório de tutoria
          </Button>
        </div>

        {enviando && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enviando arquivo…</p>}

        {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <Tabs defaultValue="resumo" className="mt-2">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="registros">Registros</TabsTrigger>
              <TabsTrigger value="combinados">Combinados</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            {/* RESUMO */}
            <TabsContent value="resumo" className="space-y-4 pt-4">
              <div className="grid sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Registros</p><p className="text-xl font-bold">{registros.length}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Combinados pendentes</p><p className="text-xl font-bold">{combinados.filter(c => c.status !== 'concluido').length}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Ocorrências</p><p className="text-xl font-bold">{ocorrencias.length}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Documentos</p><p className="text-xl font-bold">{documentos.length}</p></CardContent></Card>
              </div>

              {!readOnly && (
                <Card><CardContent className="p-4 space-y-3">
                  <Label className="text-sm">Check-in rápido — como o aluno está hoje?</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {HUMORES.map(h => {
                      const Icon = h.icon;
                      return (
                        <button key={h.key} onClick={() => setNovoHumor(h.key)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${novoHumor === h.key ? h.color + ' border-current' : 'border-border hover:bg-accent'}`}>
                          <Icon className="w-5 h-5" /><span className="text-xs font-medium">{h.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Textarea placeholder="Observação rápida (opcional)" value={obsCheckin} onChange={e => setObsCheckin(e.target.value)} rows={2} />
                  <Button onClick={addCheckin} className="w-full rounded-full">Registrar check-in</Button>
                </CardContent></Card>
              )}

              <div className="space-y-2">
                {checkins.slice(0, 8).map(c => {
                  const h = HUMORES.find(x => x.key === c.humor);
                  return (
                    <div key={c.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant="outline" className={h?.color}>{h?.label || c.humor}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString('pt-BR')}</p>
                        {c.observacao && <p className="text-sm mt-1">{c.observacao}</p>}
                      </div>
                    </div>
                  );
                })}
                {checkins.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Sem check-ins ainda.</p>}
              </div>
            </TabsContent>

            {/* REGISTROS */}
            <TabsContent value="registros" className="space-y-4 pt-4">
              {!readOnly && (
                <Card><CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium">Novo registro <span className="text-xs text-muted-foreground">— {new Date().toLocaleDateString('pt-BR')}</span></p>
                  <div><Label>Como o aluno está</Label><Input value={novoReg.como_esta} onChange={e => setNovoReg({ ...novoReg, como_esta: e.target.value })} placeholder="Ex: motivado, ansioso..." /></div>
                  <div><Label>Breve relato</Label><Textarea rows={2} value={novoReg.observacao} onChange={e => setNovoReg({ ...novoReg, observacao: e.target.value })} /></div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div><Label>Combinado</Label><Input value={novoReg.combinado} onChange={e => setNovoReg({ ...novoReg, combinado: e.target.value })} /></div>
                    <div><Label>Próxima ação</Label><Input value={novoReg.proxima_acao} onChange={e => setNovoReg({ ...novoReg, proxima_acao: e.target.value })} /></div>
                  </div>
                  <Button onClick={addRegistro} className="w-full rounded-full"><Plus className="w-4 h-4 mr-1" /> Novo Registro</Button>
                </CardContent></Card>
              )}
              <div className="space-y-2">
                {registros.map(r => (
                  <div key={r.id} className="p-3 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{new Date(r.data).toLocaleDateString('pt-BR')}</p>
                      {r.user_id === user?.id && !readOnly && (
                        <Button size="sm" variant="ghost" onClick={() => removerRegistro(r)}><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                    {r.como_esta && <p className="text-sm"><b>Como está:</b> {r.como_esta}</p>}
                    {r.observacao && <p className="text-sm">{r.observacao}</p>}
                    {r.combinado && <p className="text-sm text-primary"><b>Combinado:</b> {r.combinado}</p>}
                    {r.proxima_acao && <p className="text-sm"><b>Próxima ação:</b> {r.proxima_acao}</p>}
                  </div>
                ))}
                {registros.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhum registro.</p>}
              </div>
            </TabsContent>

            {/* COMBINADOS */}
            <TabsContent value="combinados" className="space-y-4 pt-4">
              {!readOnly && (
                <div className="flex gap-2">
                  <Input placeholder="Novo combinado..." value={novoComb} onChange={e => setNovoComb(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCombinado()} />
                  <Button onClick={addCombinado} className="rounded-full"><Plus className="w-4 h-4" /></Button>
                </div>
              )}
              <div className="space-y-2">
                {combinados.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {!readOnly ? (
                      <button onClick={() => togglarComb(c)} className="shrink-0" aria-label="Alternar status">
                        <CheckCircle2 className={`w-5 h-5 ${c.status === 'concluido' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      </button>
                    ) : <CheckCircle2 className={`w-5 h-5 ${c.status === 'concluido' ? 'text-emerald-500' : 'text-muted-foreground'}`} />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${c.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>{c.descricao}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
                {combinados.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Sem combinados.</p>}
              </div>
            </TabsContent>

            {/* NOTAS */}
            <TabsContent value="notas" className="space-y-4 pt-4">
              {!tutorado.aluno_id && <p className="text-sm text-muted-foreground">Este tutorado não está vinculado a um aluno do cadastro geral, por isso não há notas para exibir.</p>}
              {mediasPorBimestre.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {mediasPorBimestre.map(m => (
                    <Card key={m.bimestre}><CardContent className="p-3">
                      <p className="text-[11px] text-muted-foreground">{m.bimestre}º bimestre</p>
                      <p className="text-xl font-bold">{m.media.toFixed(1)}</p>
                      <p className="text-[11px] text-muted-foreground">{m.qtd} avaliação(ões)</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {notas.map(n => (
                  <div key={n.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                    <span>{n.tipos_avaliacao?.nome || 'Avaliação'} <span className="text-xs text-muted-foreground">· {n.bimestre}º bim</span></span>
                    <b>{n.nota ?? '—'}</b>
                  </div>
                ))}
                {notas.length === 0 && tutorado.aluno_id && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma nota disponível para visualização.</p>}
              </div>
            </TabsContent>

            {/* OCORRÊNCIAS */}
            <TabsContent value="ocorrencias" className="space-y-2 pt-4">
              {ocorrencias.map(o => (
                <div key={o.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(o.data).toLocaleDateString('pt-BR')} · {o.disciplina || 'Disciplina não informada'}</span>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  <p className="text-sm font-medium">{o.tipo}</p>
                  <p className="text-sm">{o.descricao}</p>
                  {o.providencias && <p className="text-sm text-primary"><b>Encaminhamento:</b> {o.providencias}</p>}
                </div>
              ))}
              {ocorrencias.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhuma ocorrência vinculada.</p>}
            </TabsContent>

            {/* DOCUMENTOS */}
            <TabsContent value="documentos" className="space-y-3 pt-4">
              {!readOnly && (
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent text-sm">
                  <Upload className="w-4 h-4" /> Anexar documento (PDF, Word, imagem…)
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={e => enviarDocumento(e.target.files?.[0] ?? null)} />
                </label>
              )}
              <div className="space-y-2">
                {documentos.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{d.nome_arquivo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString('pt-BR')}
                        {d.tamanho_bytes ? ` · ${(d.tamanho_bytes / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => abrirDocumento(d)} aria-label="Visualizar"><Search className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => abrirDocumento(d, true)} aria-label="Baixar"><Download className="w-4 h-4" /></Button>
                    {(d.user_id === user?.id) && !readOnly && (
                      <Button size="sm" variant="ghost" onClick={() => removerDocumento(d)} aria-label="Remover"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
                {documentos.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">Nenhum documento anexado.</p>}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
