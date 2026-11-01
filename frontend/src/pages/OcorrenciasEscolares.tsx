import React, { useEffect, useMemo, useState } from 'react';
import { api, mensagemDeErro } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Plus, FileDown, Loader2, Bell, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Status = 'nova' | 'em_andamento' | 'resolvida';
type Ocorrencia = {
  id: string; user_id: string; data: string; turma: string | null; alunos: string | null;
  tipo: string; descricao: string; status: Status; providencias: string | null;
  gestao_user_id: string | null; respondido_em: string | null;
  visto_pelo_professor: boolean; created_at: string; disciplina: string | null;
};

const TIPOS = [
  'comportamento', 'falta de atividade', 'uso inadequado de equipamento',
  'conflito', 'atraso', 'sem material', 'conversa excessiva', 'outro',
];

const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  nova: { label: 'Nova', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', dot: '🔴' },
  em_andamento: { label: 'Em andamento', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', dot: '🟡' },
  resolvida: { label: 'Resolvida', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dot: '🟢' },
};

type TDRow = { turma_nome: string; disciplina_nome: string };

export default function OcorrenciasEscolares() {
  const { user } = useAuth();
  const { isGestao, isAdmin, canEdit } = usePermissions();
  const { toast } = useToast();

  const [items, setItems] = useState<Ocorrencia[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { nome: string | null; email: string | null }>>({});
  const [minhasTD, setMinhasTD] = useState<TDRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [aberta, setAberta] = useState<Ocorrencia | null>(null);

  const [novo, setNovo] = useState({
    data: new Date().toISOString().slice(0, 10),
    turma: '', disciplina: '', alunos: '', tipo: 'comportamento', descricao: '',
  });

  const [fStatus, setFStatus] = useState<string>('todos');
  const [fTipo, setFTipo] = useState<string>('todos');
  const [fProf, setFProf] = useState<string>('todos');
  const [fDisc, setFDisc] = useState<string>('todos');
  const [fTurma, setFTurma] = useState('');
  const [fAluno, setFAluno] = useState('');
  const [fDe, setFDe] = useState(''); const [fAte, setFAte] = useState('');

  const nomeProf = (id?: string | null) =>
    (id && (profilesById[id]?.nome || profilesById[id]?.email)) || '—';

  const load = async () => {
    setLoading(true);
    let data: (Ocorrencia & { professor_nome: string | null; gestao_nome: string | null })[];
    try {
      // As mais recentes primeiro, já com os nomes de quem registrou e de quem respondeu.
      data = await api.get('/ocorrencias-escolares');
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
      setLoading(false);
      return;
    }
    setItems(data);
    const map: Record<string, { nome: string; email: string }> = {};
    data.forEach(o => {
      map[o.user_id] = { nome: o.professor_nome ?? '', email: '' };
      if (o.gestao_user_id) map[o.gestao_user_id] = { nome: o.gestao_nome ?? '', email: '' };
    });
    setProfilesById(map);
    setLoading(false);
  };

  const loadMinhasTD = async () => {
    if (!user) return;
    const data = await api.get<{ turmas: { nome: string } | null; disciplinas: { nome: string } | null }[]>(
      '/turma-disciplinas', { user_id: user.id },
    ).catch(() => []);
    const rows: TDRow[] = data
      .map(r => ({ turma_nome: r.turmas?.nome || '', disciplina_nome: r.disciplinas?.nome || '' }))
      .filter((r: TDRow) => r.turma_nome && r.disciplina_nome);
    setMinhasTD(rows);
  };

  useEffect(() => { load(); loadMinhasTD(); }, [user?.id]);

  // Sem atualização "ao vivo" no backend: relê a cada 30 s e quando a janela volta ao foco.
  useEffect(() => {
    const t = window.setInterval(load, 30_000);
    window.addEventListener('focus', load);
    return () => { window.clearInterval(t); window.removeEventListener('focus', load); };
  }, []);

  const turmasDisponiveis = useMemo(
    () => Array.from(new Set(minhasTD.map(r => r.turma_nome))).sort(),
    [minhasTD]
  );
  const disciplinasDaTurma = useMemo(
    () => Array.from(new Set(minhasTD.filter(r => r.turma_nome === novo.turma).map(r => r.disciplina_nome))).sort(),
    [minhasTD, novo.turma]
  );

  const professoresList = useMemo(() => {
    const ids = Array.from(new Set(items.map(o => o.user_id)));
    return ids.map(id => ({ id, nome: nomeProf(id) })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [items, profilesById]);
  const disciplinasList = useMemo(
    () => Array.from(new Set(items.map(o => o.disciplina).filter(Boolean) as string[])).sort(),
    [items]
  );

  const novasGestao = items.filter(o => o.status === 'nova').length;
  const naoVistas = items.filter(o => o.user_id === user?.id && !o.visto_pelo_professor).length;

  const filtrados = useMemo(() => items.filter(o => {
    if (fStatus !== 'todos' && o.status !== fStatus) return false;
    if (fTipo !== 'todos' && o.tipo !== fTipo) return false;
    if (fProf !== 'todos' && o.user_id !== fProf) return false;
    if (fDisc !== 'todos' && (o.disciplina || '') !== fDisc) return false;
    if (fTurma && !(o.turma || '').toLowerCase().includes(fTurma.toLowerCase())) return false;
    if (fAluno && !(o.alunos || '').toLowerCase().includes(fAluno.toLowerCase())) return false;
    if (fDe && o.data < fDe) return false;
    if (fAte && o.data > fAte) return false;
    return true;
  }), [items, fStatus, fTipo, fProf, fDisc, fTurma, fAluno, fDe, fAte]);

  const criar = async () => {
    if (!user || !novo.descricao.trim()) { toast({ title: 'Descreva o ocorrido', variant: 'destructive' }); return; }
    if (!novo.turma) { toast({ title: 'Selecione a turma', variant: 'destructive' }); return; }
    if (!novo.disciplina) { toast({ title: 'Selecione a disciplina', variant: 'destructive' }); return; }
    try {
      await api.post('/ocorrencias-escolares', {
        data: novo.data, turma: novo.turma, disciplina: novo.disciplina,
        alunos: novo.alunos || null, tipo: novo.tipo, descricao: novo.descricao,
      });
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    toast({ title: 'Ocorrência enviada para a gestão' });
    setOpenNew(false);
    setNovo({ data: new Date().toISOString().slice(0, 10), turma: '', disciplina: '', alunos: '', tipo: 'comportamento', descricao: '' });
    load();
  };

  const marcarVisto = async (o: Ocorrencia) => {
    if (o.user_id === user?.id && !o.visto_pelo_professor) {
      await api.post(`/ocorrencias-escolares/${o.id}/visto`).catch(() => {});
    }
  };

  const remover = async (o: Ocorrencia) => {
    if (!confirm('Remover ocorrência?')) return;
    try {
      await api.delete(`/ocorrencias-escolares/${o.id}`);
      toast({ title: 'Removido' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    }
  };

  const discOu = (d: string | null) => d && d.trim() ? d : 'Disciplina não informada';

  const exportarPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Relatório de Ocorrências Escolares', 14, 18);
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${filtrados.length} registros`, 14, 25);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 30,
      head: [['Data', 'Professor', 'Disciplina', 'Turma', 'Aluno(s)', 'Tipo', 'Descrição', 'Providências', 'Status', 'Responsável']],
      body: filtrados.map(o => [
        new Date(o.data).toLocaleDateString('pt-BR'),
        nomeProf(o.user_id),
        discOu(o.disciplina),
        o.turma || '—', o.alunos || '—', o.tipo,
        o.descricao, o.providencias || '—',
        STATUS_META[o.status].label,
        nomeProf(o.gestao_user_id),
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 6: { cellWidth: 34 }, 7: { cellWidth: 28 } },
    });
    doc.save('ocorrencias_escolares.pdf');
  };

  const exportarPdfRegistro = (o: Ocorrencia) => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(37, 99, 235);
    doc.text('Ocorrência Escolar', 14, 18);
    doc.setTextColor(0);
    const fields: [string, string][] = [
      ['Data', new Date(o.data).toLocaleDateString('pt-BR')],
      ['Professor(a)', nomeProf(o.user_id)],
      ['Disciplina / Matéria', discOu(o.disciplina)],
      ['Turma', o.turma || '—'],
      ['Aluno(s) envolvidos', o.alunos || '—'],
      ['Tipo de ocorrência', o.tipo],
      ['Descrição', o.descricao],
      ['Providências da gestão', o.providencias || 'Aguardando análise da gestão.'],
      ['Status', STATUS_META[o.status].label],
      ['Data da resposta', o.respondido_em ? new Date(o.respondido_em).toLocaleString('pt-BR') : '—'],
      ['Responsável pelo encaminhamento', nomeProf(o.gestao_user_id)],
    ];
    let y = 28;
    for (const [label, value] of fields) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80);
      doc.text(label.toUpperCase(), 14, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(20);
      const lines = doc.splitTextToSize(value, 182);
      for (const l of lines) { if (y > 280) { doc.addPage(); y = 18; } doc.text(l, 14, y); y += 6; }
      y += 3;
    }
    doc.save(`ocorrencia_${new Date(o.data).toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary grid place-items-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ocorrências Escolares</h1>
            <p className="text-sm text-muted-foreground">Registro digital substituindo o caderno físico de ocorrências.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportarPdf} className="rounded-full"><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          {canEdit && (
            <Button onClick={() => setOpenNew(true)} className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Nova Ocorrência</Button>
          )}
        </div>
      </div>

      {isGestao && novasGestao > 0 && (
        <Card className="border-rose-300 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-5 h-5 text-rose-600" />
            <div className="flex-1">
              <p className="font-semibold">{novasGestao} ocorrência{novasGestao > 1 ? 's' : ''} nova{novasGestao > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">Aguardando verificação da gestão.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setFStatus('nova')}>Ver</Button>
          </CardContent>
        </Card>
      )}
      {!isGestao && naoVistas > 0 && (
        <Card className="border-primary/30 bg-primary-light/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <p className="flex-1 font-medium">Suas ocorrências foram atualizadas pela gestão ({naoVistas}).</p>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4 grid md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div><Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="nova">🔴 Nova</SelectItem>
              <SelectItem value="em_andamento">🟡 Em andamento</SelectItem>
              <SelectItem value="resolvida">🟢 Resolvida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Tipo</Label>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isGestao && (
          <>
            <div><Label className="text-xs">Professor</Label>
              <Select value={fProf} onValueChange={setFProf}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {professoresList.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Disciplina</Label>
              <Select value={fDisc} onValueChange={setFDisc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {disciplinasList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div><Label className="text-xs">Turma</Label><Input value={fTurma} onChange={e => setFTurma(e.target.value)} /></div>
        <div><Label className="text-xs">Aluno</Label><Input value={fAluno} onChange={e => setFAluno(e.target.value)} /></div>
        <div><Label className="text-xs">De</Label><Input type="date" value={fDe} onChange={e => setFDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={fAte} onChange={e => setFAte(e.target.value)} /></div>
      </CardContent></Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhuma ocorrência encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(o => {
            const meta = STATUS_META[o.status];
            const isMinha = o.user_id === user?.id;
            const naoVista = isMinha && !o.visto_pelo_professor;
            return (
              <Card key={o.id} className={`hover:shadow-elevated transition cursor-pointer rounded-2xl ${naoVista ? 'ring-2 ring-primary/40' : ''}`}
                onClick={() => { setAberta(o); marcarVisto(o); }}>
                <CardContent className="p-4 flex gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1 w-14 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">{new Date(o.data).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                    <p className="text-xl font-bold leading-none">{new Date(o.data).getUTCDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={meta.color}>{meta.dot} {meta.label}</Badge>
                      <Badge variant="outline" className="capitalize">{o.tipo}</Badge>
                      <Badge variant="secondary">{discOu(o.disciplina)}</Badge>
                      {naoVista && <Badge className="bg-primary text-primary-foreground">Atualizada</Badge>}
                    </div>
                    <p className="text-sm line-clamp-2">{o.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Professor:</span> {nomeProf(o.user_id)} · Turma {o.turma || '—'}{o.alunos ? ` · ${o.alunos}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" title="Gerar PDF" onClick={(e) => { e.stopPropagation(); exportarPdfRegistro(o); }}><FileDown className="w-4 h-4" /></Button>
                    {(isMinha || isAdmin) && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); remover(o); }}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Professor: </span>
              <span className="font-medium">{nomeProf(user?.id)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data</Label><Input type="date" value={novo.data} onChange={e => setNovo({ ...novo, data: e.target.value })} /></div>
              <div><Label>Turma *</Label>
                <Select value={novo.turma} onValueChange={(v) => setNovo({ ...novo, turma: v, disciplina: '' })}>
                  <SelectTrigger><SelectValue placeholder={turmasDisponiveis.length ? 'Selecione' : 'Sem turmas vinculadas'} /></SelectTrigger>
                  <SelectContent>
                    {turmasDisponiveis.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Disciplina / Matéria *</Label>
              <Select value={novo.disciplina} onValueChange={(v) => setNovo({ ...novo, disciplina: v })} disabled={!novo.turma}>
                <SelectTrigger>
                  <SelectValue placeholder={!novo.turma ? 'Selecione a turma primeiro' : (disciplinasDaTurma.length ? 'Selecione' : 'Sem disciplinas nesta turma')} />
                </SelectTrigger>
                <SelectContent>
                  {disciplinasDaTurma.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Aluno(s) envolvidos</Label><Input value={novo.alunos} onChange={e => setNovo({ ...novo, alunos: e.target.value })} placeholder="Nomes separados por vírgula" /></div>
            <div><Label>Tipo</Label>
              <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea rows={5} value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} placeholder="Relate o ocorrido..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={criar}>Enviar ocorrência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aberta && <DetalheDialog o={aberta} profNome={nomeProf(aberta.user_id)} onClose={() => { setAberta(null); load(); }} />}
    </div>
  );
}

function DetalheDialog({ o, profNome, onClose }: { o: Ocorrencia; profNome: string; onClose: () => void }) {
  const { isGestao, isAdmin } = usePermissions();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>(o.status);
  const [providencias, setProvidencias] = useState(o.providencias || '');
  const [saving, setSaving] = useState(false);

  const podeResponder = isGestao || isAdmin;
  const meta = STATUS_META[status];
  const disc = o.disciplina && o.disciplina.trim() ? o.disciplina : 'Disciplina não informada';

  const salvar = async () => {
    setSaving(true);
    try {
      // A resposta da gestão: grava quem respondeu e quando, e avisa o professor ("não vista").
      await api.post(`/ocorrencias-escolares/${o.id}/resposta`, { status, providencias });
      toast({ title: 'Ocorrência atualizada' });
      onClose();
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={meta.color}>{meta.dot} {meta.label}</Badge>
            <span className="capitalize">{o.tipo}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-1 text-sm rounded-lg border p-3 bg-muted/30">
            <div><span className="text-muted-foreground">Professor:</span> <span className="font-medium">{profNome}</span></div>
            <div><span className="text-muted-foreground">Disciplina:</span> <span className="font-medium">{disc}</span></div>
            <div><span className="text-muted-foreground">Turma:</span> {o.turma || '—'}</div>
            <div><span className="text-muted-foreground">Aluno(s):</span> {o.alunos || '—'}</div>
            <div><span className="text-muted-foreground">Data:</span> {new Date(o.data).toLocaleDateString('pt-BR')}</div>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <div className="p-3 rounded-lg bg-muted/50 whitespace-pre-wrap">{o.descricao}</div>
          </div>

          {podeResponder ? (
            <>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">🔴 Nova</SelectItem>
                    <SelectItem value="em_andamento">🟡 Em andamento</SelectItem>
                    <SelectItem value="resolvida">🟢 Resolvida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Providências tomadas</Label>
                <Textarea rows={5} value={providencias} onChange={e => setProvidencias(e.target.value)}
                  placeholder="Ex: conversa realizada com aluno, responsável acionado..." />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs">Providências da gestão</Label>
              <div className="p-3 rounded-lg bg-muted/50 whitespace-pre-wrap min-h-[60px]">
                {o.providencias || <span className="text-muted-foreground italic">Aguardando análise da gestão.</span>}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {podeResponder && <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar resposta'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
