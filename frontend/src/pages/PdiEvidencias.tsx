import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  FolderHeart, Plus, Search, FileText, Image as ImageIcon, Download,
  Trash2, Pencil, X, Camera, Upload, FileDown, Calendar, Eye,
} from 'lucide-react';
import jsPDF from 'jspdf';

type Turma = { id: string; nome: string; serie?: string | null };
type Disciplina = { id: string; nome: string; cor?: string | null };
type Profile = { id: string; nome: string };

type Foto = { id: string; storage_path: string; url: string; nome: string | null };
type Documento = { id: string; storage_path: string; nome_arquivo: string; mime_type: string | null; tamanho_bytes: number | null };

type Evidencia = {
  id: string;
  user_id: string;
  titulo: string;
  data_realizacao: string;
  ano_letivo: number;
  bimestre: number;
  turma_id: string | null;
  disciplina_id: string | null;
  tipo_atividade: string;
  objetivo: string | null;
  descricao: string | null;
  resultados: string | null;
  created_at: string;
  fotos?: Foto[];
  documentos?: Documento[];
};

const TIPOS = [
  'Aula prática',
  'Jogo educativo',
  'Projeto',
  'Experimento',
  'Tecnologia/Robótica',
  'Atividade avaliativa',
  'Outro',
];

const BIMESTRES = [1, 2, 3, 4];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 2, ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const emptyForm = (): Partial<Evidencia> => ({
  titulo: '',
  data_realizacao: new Date().toISOString().slice(0, 10),
  ano_letivo: ANO_ATUAL,
  bimestre: 1,
  turma_id: null,
  disciplina_id: null,
  tipo_atividade: 'Outro',
  objetivo: '',
  descricao: '',
  resultados: '',
});

async function signUrl(path: string, bucket: string): Promise<string> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || '';
}

export default function PdiEvidencias() {
  const { user } = useAuth();
  const { isGestao, canEdit } = usePermissions();
  const { toast } = useToast();

  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  // filtros
  const [search, setSearch] = useState('');
  const [fAno, setFAno] = useState<string>('todos');
  const [fBim, setFBim] = useState<string>('todos');
  const [fTurma, setFTurma] = useState<string>('todos');
  const [fDisc, setFDisc] = useState<string>('todos');
  const [fTipo, setFTipo] = useState<string>('todos');
  const [fProf, setFProf] = useState<string>('todos');

  // form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Evidencia | null>(null);
  const [form, setForm] = useState<Partial<Evidencia>>(emptyForm());
  const [newFotos, setNewFotos] = useState<File[]>([]);
  const [newDocs, setNewDocs] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // view
  const [viewing, setViewing] = useState<Evidencia | null>(null);
  const [viewFotosUrls, setViewFotosUrls] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [cardThumbs, setCardThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    const [evRes, turmasRes, discRes] = await Promise.all([
      supabase
        .from('pdi_evidencias' as any)
        .select('*, fotos:pdi_evidencia_fotos(*), documentos:pdi_evidencia_documentos(*)')
        .order('data_realizacao', { ascending: false }),
      supabase.from('turmas').select('id, nome, serie').order('nome'),
      supabase.from('disciplinas').select('id, nome, cor').order('nome'),
    ]);
    const evs = (evRes.data as any[]) || [];
    setEvidencias(evs as Evidencia[]);
    setTurmas((turmasRes.data as Turma[]) || []);
    setDisciplinas((discRes.data as Disciplina[]) || []);

    if (isGestao && evs.length) {
      const ids = Array.from(new Set(evs.map((e) => e.user_id)));
      const { data: pf } = await supabase.from('profiles').select('id, nome').in('id', ids);
      const map: Record<string, Profile> = {};
      (pf || []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }

    // pre-load card thumbnails (first foto)
    const thumbs: Record<string, string> = {};
    await Promise.all(
      evs.map(async (e: any) => {
        const f = e.fotos?.[0];
        if (f?.storage_path) {
          thumbs[e.id] = await signUrl(f.storage_path, 'pdi-fotos');
        }
      }),
    );
    setCardThumbs(thumbs);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return evidencias.filter((e) => {
      if (q && !e.titulo.toLowerCase().includes(q) && !(e.descricao || '').toLowerCase().includes(q)) return false;
      if (fAno !== 'todos' && String(e.ano_letivo) !== fAno) return false;
      if (fBim !== 'todos' && String(e.bimestre) !== fBim) return false;
      if (fTurma !== 'todos' && e.turma_id !== fTurma) return false;
      if (fDisc !== 'todos' && e.disciplina_id !== fDisc) return false;
      if (fTipo !== 'todos' && e.tipo_atividade !== fTipo) return false;
      if (fProf !== 'todos' && e.user_id !== fProf) return false;
      return true;
    });
  }, [evidencias, search, fAno, fBim, fTurma, fDisc, fTipo, fProf]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setNewFotos([]);
    setNewDocs([]);
    setFormOpen(true);
  }

  function openEdit(e: Evidencia) {
    setEditing(e);
    setForm({ ...e });
    setNewFotos([]);
    setNewDocs([]);
    setFormOpen(true);
  }

  async function uploadFiles(evId: string, files: File[], bucket: string) {
    if (!user || !files.length) return [];
    const uploaded: { path: string; nome: string; mime: string; size: number }[] = [];
    for (const f of files) {
      const path = `${user.id}/${evId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${f.name}`;
      const { error } = await supabase.storage.from(bucket).upload(path, f, { upsert: false, contentType: f.type });
      if (error) {
        toast({ title: 'Erro no upload', description: `${f.name}: ${error.message}`, variant: 'destructive' });
        continue;
      }
      uploaded.push({ path, nome: f.name, mime: f.type, size: f.size });
    }
    return uploaded;
  }

  async function save() {
    if (!user) return;
    if (!form.titulo?.trim()) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        titulo: form.titulo,
        data_realizacao: form.data_realizacao,
        ano_letivo: Number(form.ano_letivo) || ANO_ATUAL,
        bimestre: Number(form.bimestre) || 1,
        turma_id: form.turma_id || null,
        disciplina_id: form.disciplina_id || null,
        tipo_atividade: form.tipo_atividade || 'Outro',
        objetivo: form.objetivo || null,
        descricao: form.descricao || null,
        resultados: form.resultados || null,
      };
      let evId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('pdi_evidencias' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('pdi_evidencias' as any).insert(payload).select('id').single();
        if (error) throw error;
        evId = (data as any).id;
      }

      if (evId) {
        const fotos = await uploadFiles(evId, newFotos, 'pdi-fotos');
        if (fotos.length) {
          await supabase.from('pdi_evidencia_fotos' as any).insert(
            fotos.map((f) => ({ evidencia_id: evId, storage_path: f.path, url: f.path, nome: f.nome })),
          );
        }
        const docs = await uploadFiles(evId, newDocs, 'pdi-documentos');
        if (docs.length) {
          await supabase.from('pdi_evidencia_documentos' as any).insert(
            docs.map((d) => ({
              evidencia_id: evId,
              user_id: user.id,
              storage_path: d.path,
              nome_arquivo: d.nome,
              mime_type: d.mime,
              tamanho_bytes: d.size,
            })),
          );
        }
      }
      toast({ title: editing ? 'Evidência atualizada' : 'Evidência criada' });
      setFormOpen(false);
      await loadAll();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Evidencia) {
    if (!confirm(`Apagar a evidência "${e.titulo}"? Esta ação não pode ser desfeita.`)) return;
    // remove storage files
    if (e.fotos?.length) {
      await supabase.storage.from('pdi-fotos').remove(e.fotos.map((f) => f.storage_path));
    }
    if (e.documentos?.length) {
      await supabase.storage.from('pdi-documentos').remove(e.documentos.map((d) => d.storage_path));
    }
    const { error } = await supabase.from('pdi_evidencias' as any).delete().eq('id', e.id);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Evidência apagada' });
    await loadAll();
  }

  async function removeFoto(foto: Foto) {
    if (!editing) return;
    if (!confirm('Remover esta foto?')) return;
    await supabase.storage.from('pdi-fotos').remove([foto.storage_path]);
    await supabase.from('pdi_evidencia_fotos' as any).delete().eq('id', foto.id);
    setEditing({ ...editing, fotos: editing.fotos?.filter((f) => f.id !== foto.id) });
  }

  async function removeDoc(doc: Documento) {
    if (!editing) return;
    if (!confirm('Remover este documento?')) return;
    await supabase.storage.from('pdi-documentos').remove([doc.storage_path]);
    await supabase.from('pdi_evidencia_documentos' as any).delete().eq('id', doc.id);
    setEditing({ ...editing, documentos: editing.documentos?.filter((d) => d.id !== doc.id) });
  }

  async function openView(e: Evidencia) {
    setViewing(e);
    const urls = await Promise.all((e.fotos || []).map((f) => signUrl(f.storage_path, 'pdi-fotos')));
    setViewFotosUrls(urls);
  }

  async function downloadDoc(doc: Documento) {
    const url = await signUrl(doc.storage_path, 'pdi-documentos');
    if (url) window.open(url, '_blank');
  }

  function turmaNome(id?: string | null) {
    return turmas.find((t) => t.id === id)?.nome || '—';
  }
  function discNome(id?: string | null) {
    return disciplinas.find((d) => d.id === id)?.nome || '—';
  }

  async function imgToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = data;
      });
      return { data, w: img.naturalWidth, h: img.naturalHeight };
    } catch {
      return null;
    }
  }

  async function exportPdf() {
    if (!filtered.length) {
      toast({ title: 'Nada para exportar', description: 'Ajuste os filtros.' });
      return;
    }
    toast({ title: 'Gerando relatório PDI...', description: 'Aguarde, pode levar alguns segundos.' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Capa
    pdf.setFillColor(79, 70, 229);
    pdf.rect(0, 0, pageW, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text('Relatório PDI – Evidências', margin, 25);
    pdf.setFontSize(11);
    pdf.text('Portfólio de Atividades Pedagógicas', margin, 33);
    pdf.setTextColor(40, 40, 40);
    y = 55;
    pdf.setFontSize(11);
    pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, y); y += 6;
    pdf.text(`Total de evidências: ${filtered.length}`, margin, y); y += 6;
    if (fAno !== 'todos') { pdf.text(`Ano letivo: ${fAno}`, margin, y); y += 6; }
    if (fBim !== 'todos') { pdf.text(`Bimestre: ${fBim}º`, margin, y); y += 6; }
    if (fDisc !== 'todos') { pdf.text(`Disciplina: ${discNome(fDisc)}`, margin, y); y += 6; }
    if (fTurma !== 'todos') { pdf.text(`Turma: ${turmaNome(fTurma)}`, margin, y); y += 6; }
    if (fTipo !== 'todos') { pdf.text(`Tipo: ${fTipo}`, margin, y); y += 6; }

    for (const e of filtered) {
      pdf.addPage();
      y = margin;
      pdf.setFillColor(238, 242, 255);
      pdf.rect(0, 0, pageW, 22, 'F');
      pdf.setTextColor(40, 40, 40);
      pdf.setFontSize(15);
      pdf.text(e.titulo, margin, 14);
      y = 30;
      pdf.setFontSize(10);
      const info = [
        `Data: ${new Date(e.data_realizacao + 'T12:00:00').toLocaleDateString('pt-BR')}`,
        `Bimestre: ${e.bimestre}º  |  Ano: ${e.ano_letivo}`,
        `Turma: ${turmaNome(e.turma_id)}  |  Disciplina: ${discNome(e.disciplina_id)}`,
        `Tipo: ${e.tipo_atividade}`,
        isGestao ? `Professor(a): ${profiles[e.user_id]?.nome || '—'}` : '',
      ].filter(Boolean);
      info.forEach((line) => { pdf.text(line, margin, y); y += 5; });
      y += 3;

      const section = (label: string, value?: string | null) => {
        if (!value) return;
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text(label, margin, y); y += 5;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(value, pageW - margin * 2);
        lines.forEach((ln: string) => {
          if (y > pageH - margin) { pdf.addPage(); y = margin; }
          pdf.text(ln, margin, y); y += 5;
        });
        y += 3;
      };
      section('Objetivo:', e.objetivo);
      section('Descrição da atividade:', e.descricao);
      section('Resultados / Observações:', e.resultados);

      if (e.documentos?.length) {
        if (y > pageH - 30) { pdf.addPage(); y = margin; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        pdf.text('Documentos anexados:', margin, y); y += 5;
        pdf.setFont(undefined, 'normal'); pdf.setFontSize(10);
        e.documentos.forEach((d) => {
          if (y > pageH - margin) { pdf.addPage(); y = margin; }
          pdf.text(`• ${d.nome_arquivo}`, margin, y); y += 5;
        });
        y += 3;
      }

      if (e.fotos?.length) {
        if (y > pageH - 60) { pdf.addPage(); y = margin; }
        pdf.setFont(undefined, 'bold'); pdf.setFontSize(11);
        pdf.text('Evidências fotográficas:', margin, y); y += 5;
        pdf.setFont(undefined, 'normal');
        const colW = (pageW - margin * 2 - 5) / 2;
        const cellH = 55;
        let col = 0;
        for (const f of e.fotos) {
          const url = await signUrl(f.storage_path, 'pdi-fotos');
          const img = url ? await imgToDataUrl(url) : null;
          if (!img) continue;
          if (y + cellH > pageH - margin) { pdf.addPage(); y = margin; col = 0; }
          const x = margin + col * (colW + 5);
          const ratio = img.w / img.h;
          let w = colW, h = colW / ratio;
          if (h > cellH) { h = cellH; w = cellH * ratio; }
          try {
            pdf.addImage(img.data, 'JPEG', x, y, w, h);
          } catch {
            try { pdf.addImage(img.data, 'PNG', x, y, w, h); } catch { /* ignore */ }
          }
          col++;
          if (col >= 2) { col = 0; y += cellH + 5; }
        }
        if (col > 0) y += cellH + 5;
      }
    }

    pdf.save(`relatorio-pdi-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: 'Relatório gerado!' });
  }

  const profissionaisGestao = useMemo(() => {
    if (!isGestao) return [];
    return Object.values(profiles);
  }, [isGestao, profiles]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderHeart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PDI – Evidências</h1>
            <p className="text-sm text-muted-foreground">Portfólio anual de atividades, projetos e materiais.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}>
            <FileDown className="w-4 h-4" /> Gerar relatório PDI
          </Button>
          {canEdit && (
            <Button onClick={openNew}>
              <Plus className="w-4 h-4" /> Nova evidência
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="col-span-2 md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Buscar por título ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={fAno} onValueChange={setFAno}>
            <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fBim} onValueChange={setFBim}>
            <SelectTrigger><SelectValue placeholder="Bimestre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os bimestres</SelectItem>
              {BIMESTRES.map((b) => <SelectItem key={b} value={String(b)}>{b}º bimestre</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fDisc} onValueChange={setFDisc}>
            <SelectTrigger><SelectValue placeholder="Disciplina" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as disciplinas</SelectItem>
              {disciplinas.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTurma} onValueChange={setFTurma}>
            <SelectTrigger><SelectValue placeholder="Turma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as turmas</SelectItem>
              {turmas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {isGestao && profissionaisGestao.length > 0 && (
            <Select value={fProf} onValueChange={setFProf}>
              <SelectTrigger><SelectValue placeholder="Professor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os professores</SelectItem>
                {profissionaisGestao.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Carregando evidências...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <FolderHeart className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhuma evidência encontrada.</p>
            {canEdit && (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4" /> Criar primeira evidência
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => (
            <Card key={e.id} className="overflow-hidden hover:shadow-elevated transition-shadow cursor-pointer group" onClick={() => openView(e)}>
              <div className="aspect-video bg-muted relative overflow-hidden">
                {cardThumbs[e.id] ? (
                  <img src={cardThumbs[e.id]} alt={e.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <Badge className="absolute top-2 left-2 bg-background/90 text-foreground hover:bg-background">{e.tipo_atividade}</Badge>
                {(e.fotos?.length || 0) > 1 && (
                  <Badge className="absolute top-2 right-2 bg-black/60 text-white hover:bg-black/60">
                    <ImageIcon className="w-3 h-3" /> {e.fotos!.length}
                  </Badge>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold leading-tight line-clamp-2">{e.titulo}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {new Date(e.data_realizacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                  <span>•</span>
                  <span>{e.bimestre}º bim</span>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Badge variant="secondary">{discNome(e.disciplina_id)}</Badge>
                  <Badge variant="outline">{turmaNome(e.turma_id)}</Badge>
                </div>
                {isGestao && profiles[e.user_id] && (
                  <p className="text-xs text-muted-foreground italic">por {profiles[e.user_id].nome}</p>
                )}
                {(e.documentos?.length || 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" /> {e.documentos!.length} documento(s)
                  </div>
                )}
                {canEdit && e.user_id === user?.id && (
                  <div className="flex gap-1 pt-1" onClick={(ev) => ev.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => openEdit(e)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(e)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar evidência' : 'Nova evidência'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Título da atividade *</Label>
              <Input value={form.titulo || ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Jogo de Tabuleiro – Pilhas e Baterias" />
            </div>
            <div>
              <Label>Data da realização</Label>
              <Input type="date" value={form.data_realizacao || ''} onChange={(e) => setForm({ ...form, data_realizacao: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de atividade</Label>
              <Select value={form.tipo_atividade || 'Outro'} onValueChange={(v) => setForm({ ...form, tipo_atividade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma</Label>
              <Select value={form.turma_id || ''} onValueChange={(v) => setForm({ ...form, turma_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{turmas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disciplina</Label>
              <Select value={form.disciplina_id || ''} onValueChange={(v) => setForm({ ...form, disciplina_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{disciplinas.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bimestre</Label>
              <Select value={String(form.bimestre || 1)} onValueChange={(v) => setForm({ ...form, bimestre: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BIMESTRES.map((b) => <SelectItem key={b} value={String(b)}>{b}º bimestre</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano letivo</Label>
              <Select value={String(form.ano_letivo || ANO_ATUAL)} onValueChange={(v) => setForm({ ...form, ano_letivo: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Objetivo da atividade</Label>
              <Textarea rows={2} value={form.objetivo || ''} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição da atividade desenvolvida</Label>
              <Textarea rows={4} value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Resultados / observações</Label>
              <Textarea rows={3} value={form.resultados || ''} onChange={(e) => setForm({ ...form, resultados: e.target.value })} />
            </div>

            {/* Fotos */}
            <div className="md:col-span-2 space-y-2 border-t pt-4">
              <Label className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Fotos da atividade</Label>
              {editing?.fotos && editing.fotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {editing.fotos.map((f) => (
                    <FotoThumb key={f.id} foto={f} onRemove={() => removeFoto(f)} />
                  ))}
                </div>
              )}
              {newFotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {newFotos.map((f, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setNewFotos(newFotos.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setNewFotos([...newFotos, ...Array.from(e.target.files || [])])} />
                  <span className="inline-flex items-center gap-2 px-3 h-9 rounded-md border bg-background text-sm hover:bg-accent"><Upload className="w-4 h-4" /> Adicionar fotos</span>
                </label>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setNewFotos([...newFotos, ...Array.from(e.target.files || [])])} />
                  <span className="inline-flex items-center gap-2 px-3 h-9 rounded-md border bg-background text-sm hover:bg-accent"><Camera className="w-4 h-4" /> Tirar foto</span>
                </label>
              </div>
            </div>

            {/* Documentos */}
            <div className="md:col-span-2 space-y-2 border-t pt-4">
              <Label className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Materiais utilizados (PDF, Word, PowerPoint...)</Label>
              {editing?.documentos && editing.documentos.length > 0 && (
                <div className="space-y-1">
                  {editing.documentos.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{d.nome_arquivo}</span>
                      <Button size="sm" variant="ghost" onClick={() => downloadDoc(d)}><Download className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeDoc(d)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
              {newDocs.length > 0 && (
                <div className="space-y-1">
                  {newDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-md text-sm">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="flex-1 truncate">{d.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => setNewDocs(newDocs.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="cursor-pointer inline-block">
                <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt,.odp,.ods" onChange={(e) => setNewDocs([...newDocs, ...Array.from(e.target.files || [])])} />
                <span className="inline-flex items-center gap-2 px-3 h-9 rounded-md border bg-background text-sm hover:bg-accent"><Upload className="w-4 h-4" /> Adicionar documentos</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar evidência'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && (setViewing(null), setViewFotosUrls([]))}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{viewing.titulo}</DialogTitle>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge>{viewing.tipo_atividade}</Badge>
                  <Badge variant="secondary">{discNome(viewing.disciplina_id)}</Badge>
                  <Badge variant="outline">{turmaNome(viewing.turma_id)}</Badge>
                  <Badge variant="outline">{viewing.bimestre}º bimestre / {viewing.ano_letivo}</Badge>
                  <Badge variant="outline"><Calendar className="w-3 h-3" /> {new Date(viewing.data_realizacao + 'T12:00:00').toLocaleDateString('pt-BR')}</Badge>
                  {isGestao && profiles[viewing.user_id] && <Badge variant="outline">por {profiles[viewing.user_id].nome}</Badge>}
                </div>
              </DialogHeader>
              <div className="space-y-4">
                {viewFotosUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {viewFotosUrls.map((u, i) => (
                      <button key={i} onClick={() => setLightbox(u)} className="aspect-square rounded-md overflow-hidden border bg-muted hover:opacity-90">
                        <img src={u} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {viewing.objetivo && (<div><h4 className="font-semibold text-sm mb-1">Objetivo</h4><p className="text-sm whitespace-pre-wrap text-muted-foreground">{viewing.objetivo}</p></div>)}
                {viewing.descricao && (<div><h4 className="font-semibold text-sm mb-1">Descrição</h4><p className="text-sm whitespace-pre-wrap text-muted-foreground">{viewing.descricao}</p></div>)}
                {viewing.resultados && (<div><h4 className="font-semibold text-sm mb-1">Resultados / observações</h4><p className="text-sm whitespace-pre-wrap text-muted-foreground">{viewing.resultados}</p></div>)}
                {viewing.documentos && viewing.documentos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Documentos anexados</h4>
                    <div className="space-y-1">
                      {viewing.documentos.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{d.nome_arquivo}</span>
                          <Button size="sm" variant="outline" onClick={() => downloadDoc(d)}><Eye className="w-3 h-3" /> Abrir</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2"><X className="w-5 h-5" /></button>
          <img src={lightbox} alt="Foto ampliada" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}

function FotoThumb({ foto, onRemove }: { foto: Foto; onRemove: () => void }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    void signUrl(foto.storage_path, 'pdi-fotos').then(setUrl);
  }, [foto.storage_path]);
  return (
    <div className="relative aspect-square rounded-md overflow-hidden border bg-muted">
      {url && <img src={url} alt={foto.nome || ''} className="w-full h-full object-cover" />}
      <button type="button" onClick={onRemove} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}