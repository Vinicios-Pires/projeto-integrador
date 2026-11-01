import React, { useState, useEffect, useRef } from 'react';
import { api, linksDosArquivos, mensagemDeErro } from '@/lib/api';
import { Plus, Edit2, Trash2, Search, Camera, Image as ImageIcon, X, ZoomIn, FileText, Download, Eye } from 'lucide-react';
import { PageHeader, FilterBar, TableContainer, LoadingSpinner } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePermissions } from '@/hooks/use-permissions';

interface OcorrenciaFoto {
  id: string;
  ocorrencia_id: string;
  url: string;
  path: string;
}

const defaultForm = () => ({
  turma_id: '',
  data_ocorrencia: new Date().toISOString().split('T')[0],
  quantidade_notebooks: 0,
  alunos_envolvidos: '',
  problema_encontrado: '',
  descricao: '',
  equipamento_danificado: false,
  internet_funcionou: true,
  solucao_adotada: '',
  observacoes: '',
});

export default function Ocorrencias() {
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [fotos, setFotos] = useState<Record<string, OcorrenciaFoto[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('all');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { userId, canEdit, readOnly } = usePermissions();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    // As mais recentes primeiro, cada uma com a turma e as fotos.
    const [oc, t] = await Promise.all([
      api.get<(typeof ocorrencias[number] & { fotos?: OcorrenciaFoto[] })[]>('/ocorrencias-notebook').catch(() => []),
      api.get<typeof turmas>('/turmas').catch(() => []),
    ]);
    setOcorrencias(oc);
    setTurmas(t);
    const fotoMap: Record<string, OcorrenciaFoto[]> = {};
    // O bucket é privado: os links temporários saem do correio de arquivos, numa ida só.
    const fotosArr = oc.flatMap(o => o.fotos ?? []);
    const paths = fotosArr.map(x => x.path).filter(Boolean);
    const signedMap = paths.length > 0 ? await linksDosArquivos('ocorrencias-fotos', paths).catch(() => new Map<string, string>()) : new Map<string, string>();
    fotosArr.forEach((foto) => {
      if (foto.path && signedMap.has(foto.path)) foto.url = signedMap.get(foto.path)!;
      if (!fotoMap[foto.ocorrencia_id]) fotoMap[foto.ocorrencia_id] = [];
      fotoMap[foto.ocorrencia_id].push(foto);
    });
    setFotos(fotoMap);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(defaultForm());
    setPendingFiles([]);
    setPendingPreviews([]);
    setDialogOpen(true);
  }

  function openEdit(o: any) {
    setEditing(o);
    setForm({
      turma_id: o.turma_id || '',
      data_ocorrencia: o.data_ocorrencia,
      quantidade_notebooks: o.quantidade_notebooks,
      alunos_envolvidos: o.alunos_envolvidos || '',
      problema_encontrado: o.problema_encontrado || '',
      descricao: o.descricao || '',
      equipamento_danificado: o.equipamento_danificado,
      internet_funcionou: o.internet_funcionou,
      solucao_adotada: o.solucao_adotada || '',
      observacoes: o.observacoes || '',
    });
    setPendingFiles([]);
    setPendingPreviews([]);
    setDialogOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setPendingPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePendingFile(idx: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    setPendingPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadPhotos(ocorrenciaId: string) {
    if (!userId) return;
    for (const file of pendingFiles) {
      try {
        // O backend guarda na pasta de quem registrou e anota a foto na ocorrência.
        await api.post(`/ocorrencias-notebook/${ocorrenciaId}/fotos`, file, { nome: file.name });
      } catch (err) {
        toast({ title: `Foto não enviada: ${file.name}`, description: mensagemDeErro(err), variant: 'destructive' });
      }
    }
  }

  async function save() {
    if (!canEdit || !userId) return;
    setSaving(true);
    const payload = { ...form, turma_id: form.turma_id || null };
    let ocId = editing?.id;
    try {
      if (editing) {
        await api.patch(`/ocorrencias-notebook/${editing.id}`, payload);
        toast({ title: 'Ocorrência atualizada!' });
      } else {
        ocId = (await api.post<{ id: string }>('/ocorrencias-notebook', payload)).id;
        toast({ title: 'Ocorrência registrada!' });
      }
    } catch (err) {
      setSaving(false);
      toast({ title: 'Erro ao salvar', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    if (ocId && pendingFiles.length > 0) {
      await uploadPhotos(ocId);
    }
    setSaving(false);
    setDialogOpen(false);
    loadData();
  }

  async function removePhoto(foto: OcorrenciaFoto) {
    try {
      // Apaga o registro e o arquivo.
      await api.delete(`/ocorrencias-notebook/${foto.ocorrencia_id}/fotos/${foto.id}`);
    } catch (err) {
      toast({ title: 'Erro ao remover a foto', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    loadData();
    toast({ title: 'Foto removida' });
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta ocorrência?')) return;
    try {
      // As fotos saem junto (banco e armazenamento).
      await api.delete(`/ocorrencias-notebook/${id}`);
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: mensagemDeErro(err), variant: 'destructive' });
    }
    loadData();
  }

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  const filtered = ocorrencias.filter(o => {
    const ms = (o.problema_encontrado || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.descricao || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.alunos_envolvidos || '').toLowerCase().includes(search.toLowerCase());
    const mt = filterTurma === 'all' || o.turma_id === filterTurma;
    const md1 = !filterDataInicio || o.data_ocorrencia >= filterDataInicio;
    const md2 = !filterDataFim || o.data_ocorrencia <= filterDataFim;
    return ms && mt && md1 && md2;
  });

  async function generatePdf() {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Ocorrências de Notebook', pageWidth / 2, 20, { align: 'center' });

      // Period / filters info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      let infoText = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
      if (filterDataInicio || filterDataFim) {
        infoText += ` | Período: ${filterDataInicio ? formatDate(filterDataInicio) : '—'} a ${filterDataFim ? formatDate(filterDataFim) : '—'}`;
      }
      if (filterTurma !== 'all') {
        const turma = turmas.find(t => t.id === filterTurma);
        if (turma) infoText += ` | Turma: ${turma.nome}`;
      }
      doc.text(infoText, pageWidth / 2, 28, { align: 'center' });

      doc.setDrawColor(200);
      doc.line(14, 32, pageWidth - 14, 32);

      let yPos = 38;

      for (const o of filtered) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatDate(o.data_ocorrencia)} — ${o.turmas?.nome || 'Sem turma'}`, 14, yPos);
        yPos += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const fields = [
          ['Problema', o.problema_encontrado],
          ['Descrição', o.descricao],
          ['Notebooks', String(o.quantidade_notebooks || 0)],
          ['Alunos', o.alunos_envolvidos],
          ['Equip. danificado', o.equipamento_danificado ? 'Sim' : 'Não'],
          ['Internet funcionou', o.internet_funcionou ? 'Sim' : 'Não'],
          ['Solução', o.solucao_adotada],
          ['Observações', o.observacoes],
        ];

        for (const [label, value] of fields) {
          if (!value) continue;
          if (yPos > 270) { doc.addPage(); yPos = 20; }
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}: `, 16, yPos);
          const labelWidth = doc.getTextWidth(`${label}: `);
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(String(value), pageWidth - 30 - labelWidth);
          doc.text(lines, 16 + labelWidth, yPos);
          yPos += lines.length * 4.5;
        }

        // Photos
        const ocFotos = fotos[o.id] || [];
        if (ocFotos.length > 0) {
          if (yPos > 220) { doc.addPage(); yPos = 20; }
          doc.setFont('helvetica', 'bold');
          doc.text('Fotos:', 16, yPos);
          yPos += 5;

          for (const foto of ocFotos) {
            try {
              const response = await fetch(foto.url);
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              if (yPos > 220) { doc.addPage(); yPos = 20; }
              doc.addImage(dataUrl, 'JPEG', 16, yPos, 50, 37);
              yPos += 42;
            } catch {
              // skip image if can't fetch
            }
          }
        }

        // Separator
        yPos += 4;
        doc.setDrawColor(220);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 6;
      }

      doc.save('relatorio-ocorrencias.pdf');
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
    setGeneratingPdf(false);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Ocorrências de Notebook" subtitle={readOnly ? `${ocorrencias.length} ocorrências (modo gestão)` : `${ocorrencias.length} ocorrências registradas`}>
        {readOnly && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"><Eye className="w-3 h-3" /> Somente leitura</span>}
        <Button size="sm" variant="outline" onClick={generatePdf} disabled={generatingPdf || filtered.length === 0}>
          <FileText className="w-4 h-4 mr-1.5" />{generatingPdf ? 'Gerando...' : 'Exportar PDF'}
        </Button>
        {canEdit && <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Nova Ocorrência</Button>}
      </PageHeader>

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar problema, descrição, aluno..." className="pl-8 h-8 text-sm bg-background" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas turmas</SelectItem>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
          <Input type="date" className="h-8 text-sm bg-background w-36" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
          <Input type="date" className="h-8 text-sm bg-background w-36" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} />
        </div>
      </FilterBar>

      {loading ? <LoadingSpinner /> : (
        <TableContainer>
          <table className="table-sheet">
            <thead>
              <tr>
                <th>Data</th><th>Turma</th><th>Notebooks</th><th>Problema</th><th>Danificado</th><th>Internet</th><th>Fotos</th><th>Solução</th><th className="w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">Nenhuma ocorrência encontrada</td></tr>
              ) : filtered.map((o, i) => {
                const ocFotos = fotos[o.id] || [];
                return (
                  <tr key={o.id} className={cn(i % 2 ? 'bg-muted/10' : '')}>
                    <td className="font-mono text-xs">{formatDate(o.data_ocorrencia)}</td>
                    <td className="font-medium">{o.turmas?.nome || '—'}</td>
                    <td className="text-center">{o.quantidade_notebooks}</td>
                    <td className="max-w-xs">
                      <div className="font-medium truncate">{o.problema_encontrado}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.alunos_envolvidos}</div>
                    </td>
                    <td className="text-center">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', o.equipamento_danificado ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                        {o.equipamento_danificado ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', o.internet_funcionou ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive')}>
                        {o.internet_funcionou ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="text-center">
                      {ocFotos.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          {ocFotos.slice(0, 3).map(f => (
                            <button key={f.id} onClick={() => setLightboxUrl(f.url)} className="w-8 h-8 rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                              <img src={f.url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                          {ocFotos.length > 3 && <span className="text-xs text-muted-foreground">+{ocFotos.length - 3}</span>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="text-xs text-muted-foreground max-w-[150px] truncate">{o.solucao_adotada || '—'}</td>
                    <td>
                      {canEdit && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(o)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(o.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableContainer>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Ocorrência' : 'Nova Ocorrência'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.data_ocorrencia} onChange={e => setForm({ ...form, data_ocorrencia: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Turma</Label>
                <Select value={form.turma_id} onValueChange={v => setForm({ ...form, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Qtd. Notebooks</Label><Input type="number" min={0} value={form.quantidade_notebooks} onChange={e => setForm({ ...form, quantidade_notebooks: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-1.5"><Label>Problema</Label><Input placeholder="Sem internet, travando..." value={form.problema_encontrado} onChange={e => setForm({ ...form, problema_encontrado: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Alunos Envolvidos</Label><Input placeholder="Nomes dos alunos" value={form.alunos_envolvidos} onChange={e => setForm({ ...form, alunos_envolvidos: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Solução Adotada</Label><Textarea rows={2} value={form.solucao_adotada} onChange={e => setForm({ ...form, solucao_adotada: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.equipamento_danificado} onChange={e => setForm({ ...form, equipamento_danificado: e.target.checked })} className="rounded" />
                Equipamento Danificado
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.internet_funcionou} onChange={e => setForm({ ...form, internet_funcionou: e.target.checked })} className="rounded" />
                Internet Funcionou
              </label>
            </div>

            {/* Photos section */}
            <div className="space-y-2 border-t border-border pt-3">
              <Label className="flex items-center gap-1.5"><Camera className="w-4 h-4" /> Fotos da Ocorrência</Label>

              {/* Existing photos (edit mode) */}
              {editing && (fotos[editing.id] || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(fotos[editing.id] || []).map(f => (
                    <div key={f.id} className="relative group">
                      <button onClick={() => setLightboxUrl(f.url)} className="w-16 h-16 rounded-lg border border-border overflow-hidden">
                        <img src={f.url} alt="" className="w-full h-full object-cover" />
                      </button>
                      <button onClick={() => removePhoto(f)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending uploads */}
              {pendingPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingPreviews.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-primary/40 overflow-hidden">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </div>
                      <button onClick={() => removePendingFile(idx)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4 mr-1" />Escolher Imagem
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  if (fileInputRef.current) { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click(); fileInputRef.current.removeAttribute('capture'); }
                }}>
                  <Camera className="w-4 h-4 mr-1" />Tirar Foto
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-white/80" onClick={() => setLightboxUrl(null)}>
            <X className="w-8 h-8" />
          </button>
          <img src={lightboxUrl} alt="Foto da ocorrência" className="max-w-full max-h-[90vh] rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
