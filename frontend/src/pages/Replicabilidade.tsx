import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, Eye, ImageIcon, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { exportTablePdf } from '@/lib/pdfHelpers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type ReplicabilidadeFoto = {
  id: string;
  replicabilidade_id: string;
  storage_path: string;
  nome: string | null;
  ordem: number;
  created_at?: string;
};

type ReplicabilidadeRegistro = {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
  updated_at?: string;
  fotos: ReplicabilidadeFoto[];
};

type Profile = { id: string; nome: string | null };
type DraftPhoto = { file: File; url: string };

const BUCKET = 'replicabilidade-fotos';
const SIGNED_URL_TTL = 60 * 60;

async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return '';
  return data?.signedUrl ?? '';
}

function sortFotos(fotos: ReplicabilidadeFoto[] = []) {
  return fotos.slice().sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

export default function Replicabilidade() {
  const { user, loading: authLoading } = useAuth();
  const { isGestao, isAdmin, readOnly } = usePermissions();
  const { toast } = useToast();
  const [items, setItems] = useState<ReplicabilidadeRegistro[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [professorFilter, setProfessorFilter] = useState('todos');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReplicabilidadeRegistro | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [savedPhotoUrls, setSavedPhotoUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [viewing, setViewing] = useState<ReplicabilidadeRegistro | null>(null);
  const [viewUrls, setViewUrls] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const lastLoadRef = useRef(0);
  const draftPhotosRef = useRef<DraftPhoto[]>([]);

  const canCreate = !!user && (!readOnly || isAdmin);

  const loadAll = useCallback(async () => {
    if (!user) {
      setItems([]);
      setThumbs({});
      setProfiles({});
      setLoading(false);
      return;
    }

    const loadId = Date.now();
    lastLoadRef.current = loadId;
    setLoading(true);

    const { data, error } = await supabase
      .from('replicabilidades' as any)
      .select('*, fotos:replicabilidade_fotos(*)')
      .order('created_at', { ascending: false });

    if (lastLoadRef.current !== loadId) return;

    if (error) {
      toast({ title: 'Erro ao carregar replicabilidades', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const list = ((data as any[]) || []).map((item) => ({
      ...item,
      fotos: sortFotos(item.fotos || []),
    })) as ReplicabilidadeRegistro[];

    setItems(list);

    const nextProfiles: Record<string, Profile> = {};
    if (list.length > 0) {
      const ids = Array.from(new Set(list.map((item) => item.user_id)));
      const { data: profileData } = await supabase.from('profiles').select('id, nome').in('id', ids);
      (profileData || []).forEach((profile: any) => {
        nextProfiles[profile.id] = profile;
      });
    }
    if (lastLoadRef.current !== loadId) return;
    setProfiles(nextProfiles);

    const nextThumbs: Record<string, string> = {};
    await Promise.all(
      list.map(async (item) => {
        const firstPhoto = item.fotos[0];
        if (firstPhoto?.storage_path) nextThumbs[item.id] = await getSignedUrl(firstPhoto.storage_path);
      }),
    );
    if (lastLoadRef.current !== loadId) return;
    setThumbs(nextThumbs);
    setLoading(false);
  }, [isAdmin, isGestao, toast, user]);

  useEffect(() => {
    if (!authLoading) void loadAll();
  }, [authLoading, loadAll]);

  useEffect(() => {
    draftPhotosRef.current = draftPhotos;
  }, [draftPhotos]);

  useEffect(() => () => {
    draftPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (professorFilter !== 'todos' && item.user_id !== professorFilter) return false;
      if (!query) return true;
      return item.titulo.toLowerCase().includes(query) || (item.descricao || '').toLowerCase().includes(query);
    });
  }, [items, professorFilter, search]);

  const resetForm = () => {
    setEditing(null);
    setTitulo('');
    setDescricao('');
    setSavedPhotoUrls({});
    setDraftPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
    setDragging(false);
  };

  const openNew = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = async (item: ReplicabilidadeRegistro) => {
    resetForm();
    setEditing(item);
    setTitulo(item.titulo);
    setDescricao(item.descricao || '');
    setFormOpen(true);

    const urls = await Promise.all(item.fotos.map(async (foto) => [foto.id, await getSignedUrl(foto.storage_path)] as const));
    setSavedPhotoUrls(Object.fromEntries(urls));
  };

  const closeForm = (open: boolean) => {
    if (saving) return;
    setFormOpen(open);
    if (!open) resetForm();
  };

  const pickFiles = (files: FileList | null) => {
    if (!files) return;
    const photos = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (photos.length === 0) return;
    setDraftPhotos((current) => [...current, ...photos]);
  };

  const removeDraftPhoto = (index: number) => {
    setDraftPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const canEditItem = (item: ReplicabilidadeRegistro) => isAdmin || item.user_id === user?.id;

  const removeSavedPhoto = async (foto: ReplicabilidadeFoto) => {
    if (!editing || !canEditItem(editing)) return;
    const confirmed = window.confirm('Remover esta foto?');
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from('replicabilidade_fotos' as any).delete().eq('id', foto.id);
    if (deleteError) {
      toast({ title: 'Erro ao remover foto', description: deleteError.message, variant: 'destructive' });
      return;
    }
    await supabase.storage.from(BUCKET).remove([foto.storage_path]);

    const nextEditing = { ...editing, fotos: editing.fotos.filter((item) => item.id !== foto.id) };
    setEditing(nextEditing);
    setItems((current) => current.map((item) => (item.id === nextEditing.id ? nextEditing : item)));
    setSavedPhotoUrls((current) => {
      const next = { ...current };
      delete next[foto.id];
      return next;
    });
  };

  const uploadPhotos = async (replicabilidadeId: string, startOrder: number) => {
    if (!user || draftPhotos.length === 0) return;

    for (let index = 0; index < draftPhotos.length; index += 1) {
      const { file } = draftPhotos[index];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${user.id}/${replicabilidadeId}/${Date.now()}-${index}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { error: photoError } = await supabase.from('replicabilidade_fotos' as any).insert({
        replicabilidade_id: replicabilidadeId,
        storage_path: path,
        nome: file.name,
        ordem: startOrder + index,
      });

      if (photoError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw photoError;
      }
    }
  };

  const save = async () => {
    if (!user || saving) return;
    const trimmedTitle = titulo.trim();
    const trimmedDescription = descricao.trim();

    if (!trimmedTitle) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let itemId = editing?.id;
      if (editing) {
        if (!canEditItem(editing)) throw new Error('Você não tem permissão para editar este registro.');
        const { error } = await supabase
          .from('replicabilidades' as any)
          .update({ titulo: trimmedTitle, descricao: trimmedDescription || null })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('replicabilidades' as any)
          .insert({ user_id: user.id, titulo: trimmedTitle, descricao: trimmedDescription || null })
          .select('id')
          .single();
        if (error) throw error;
        itemId = (data as any).id;
      }

      if (itemId) await uploadPhotos(itemId, editing?.fotos.length || 0);

      toast({ title: editing ? 'Replicabilidade atualizada' : 'Replicabilidade criada' });
      setFormOpen(false);
      resetForm();
      await loadAll();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: ReplicabilidadeRegistro) => {
    if (!canEditItem(item)) return;
    const confirmed = window.confirm(`Apagar "${item.titulo}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    const { error } = await supabase.from('replicabilidades' as any).delete().eq('id', item.id);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }

    if (item.fotos.length > 0) await supabase.storage.from(BUCKET).remove(item.fotos.map((foto) => foto.storage_path));
    toast({ title: 'Replicabilidade apagada' });
    await loadAll();
  };

  const openView = async (item: ReplicabilidadeRegistro) => {
    setViewing(item);
    setViewUrls([]);
    const urls = await Promise.all(item.fotos.map((foto) => getSignedUrl(foto.storage_path)));
    setViewUrls(urls.filter(Boolean));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando permissões...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-card to-secondary/40 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-foreground md:text-3xl">Replicabilidade</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Registros visuais de práticas pedagógicas com título, breve descrição e fotos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 rounded-full px-5"
              onClick={() => exportTablePdf({
                title: 'Replicabilidade — Práticas Pedagógicas',
                columns: ['Data', 'Professor(a)', 'Título', 'Descrição', 'Fotos'],
                rows: filteredItems.map(it => [
                  new Date(it.created_at).toLocaleDateString('pt-BR'),
                  profiles[it.user_id]?.nome || '—',
                  it.titulo,
                  it.descricao || '—',
                  it.fotos.length,
                ]),
                filename: 'replicabilidade.pdf',
                orientation: 'landscape',
              })}
            >
              <Download className="h-4 w-4" /> Gerar PDF
            </Button>
            {canCreate && (
              <Button onClick={openNew} size="lg" className="gap-2 rounded-full px-5">
                <Plus className="h-4 w-4" /> Nova Replicabilidade
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título ou descrição"
            className="rounded-full pl-9"
          />
        </div>
        {Object.keys(profiles).length > 1 && (
          <Select value={professorFilter} onValueChange={setProfessorFilter}>
            <SelectTrigger className="rounded-full md:w-72">
              <SelectValue placeholder="Filtrar professor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os professores</SelectItem>
              {Object.values(profiles).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>{profile.nome || 'Professor(a)'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed bg-card/70 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando registros...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/70 px-6 py-16 text-center text-muted-foreground">
          <Sparkles className="mx-auto mb-4 h-12 w-12 text-primary/40" />
          <p className="font-medium text-foreground">Nenhuma replicabilidade encontrada.</p>
          {canCreate && <p className="mt-1 text-sm">Clique em “Nova Replicabilidade” para criar o primeiro registro.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const editable = canEditItem(item);
            return (
              <Card key={item.id} className="group overflow-hidden rounded-3xl border-primary/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <button type="button" onClick={() => openView(item)} className="block w-full text-left">
                  <div className="relative aspect-[4/3] overflow-hidden bg-primary/5">
                    {thumbs[item.id] ? (
                      <img
                        src={thumbs[item.id]}
                        alt={item.titulo}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-primary/40">
                        <ImageIcon className="h-14 w-14" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-foreground/60 to-transparent" />
                    {item.fotos.length > 1 && (
                      <span className="absolute right-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                        +{item.fotos.length - 1} fotos
                      </span>
                    )}
                  </div>
                </button>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1">
                    <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-normal">{item.titulo}</h2>
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
                      {item.descricao || 'Sem descrição.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      Publicado por: <span className="font-medium text-foreground">{profiles[item.user_id]?.nome || (item.user_id === user?.id ? 'Você' : 'Professor(a)')}</span>
                      <span className="mx-1">·</span>{new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openView(item)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {editable && (
                        <>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => removeItem(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={closeForm}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Replicabilidade' : 'Nova Replicabilidade'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="replicabilidade-titulo">Título</Label>
              <Input
                id="replicabilidade-titulo"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Ex.: Leitura compartilhada com estações"
                disabled={saving}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replicabilidade-descricao">Breve descrição</Label>
              <Textarea
                id="replicabilidade-descricao"
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Resumo curto do que foi realizado."
                disabled={saving}
                rows={4}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-3">
              <Label>Fotos</Label>
              <div
                className={`rounded-3xl border border-dashed p-4 transition ${dragging ? 'border-primary bg-primary/10' : 'border-primary/20 bg-primary/5'}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  pickFiles(event.dataTransfer.files);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-2xl bg-background p-4 text-center shadow-sm transition hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={saving}
                      onChange={(event) => {
                        pickFiles(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <Upload className="mx-auto mb-2 h-6 w-6 text-primary" />
                    <span className="text-sm font-semibold">Inserir fotos</span>
                  </label>
                  <label className="cursor-pointer rounded-2xl bg-background p-4 text-center shadow-sm transition hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={saving}
                      onChange={(event) => {
                        pickFiles(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <Camera className="mx-auto mb-2 h-6 w-6 text-primary" />
                    <span className="text-sm font-semibold">Tirar foto</span>
                  </label>
                </div>
              </div>

              {(editing?.fotos.length || 0) > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {editing?.fotos.map((foto) => (
                    <div key={foto.id} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                      {savedPhotoUrls[foto.id] && <img src={savedPhotoUrls[foto.id]} alt={foto.nome || ''} className="h-full w-full object-cover" />}
                      <button
                        type="button"
                        onClick={() => removeSavedPhoto(foto)}
                        className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1 text-background transition hover:bg-foreground"
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {draftPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {draftPhotos.map((photo, index) => (
                    <div key={photo.url} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                      <img src={photo.url} alt="Prévia da foto" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeDraftPhoto(index)}
                        className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1 text-background transition hover:bg-foreground"
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => closeForm(false)} disabled={saving} className="rounded-full">
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={saving} className="rounded-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Replicabilidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(open) => {
        if (!open) {
          setViewing(null);
          setViewUrls([]);
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl tracking-normal">{viewing.titulo}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Publicado por <span className="font-medium text-foreground">{profiles[viewing.user_id]?.nome || (viewing.user_id === user?.id ? 'Você' : 'Professor(a)')}</span> · {new Date(viewing.created_at).toLocaleDateString('pt-BR')}
                </p>
              </DialogHeader>
              {viewing.descricao && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{viewing.descricao}</p>}
              {viewUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {viewUrls.map((url) => (
                    <button key={url} type="button" onClick={() => setLightbox(url)} className="aspect-square overflow-hidden rounded-2xl bg-muted">
                      <img src={url} alt="Foto da replicabilidade" className="h-full w-full object-cover transition hover:scale-105" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed py-12 text-center text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  Sem fotos neste registro.
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-foreground/90 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Foto ampliada" className="max-h-full max-w-full object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-background/20 p-2 text-background" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}