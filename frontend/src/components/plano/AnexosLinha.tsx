import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Paperclip, Download, X, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Anexo = { id: string; nome_arquivo: string; storage_path: string };

type Props = {
  planoId: string;
  userId: string;
  tipo: 'documento' | 'adaptada';
  readOnly?: boolean;
  label: string;
};

export function AnexosLinha({ planoId, userId, tipo, readOnly, label }: Props) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from('plano_anexos')
      .select('id,nome_arquivo,storage_path')
      .eq('plano_id', planoId)
      .eq('tipo', tipo);
    setAnexos((data as Anexo[]) || []);
  };

  useEffect(() => { load(); }, [planoId, tipo]);

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${userId}/${planoId}/${tipo}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('plano-anexos').upload(path, file);
    if (upErr) { toast({ title: 'Falha no upload', description: upErr.message, variant: 'destructive' }); setUploading(false); return; }
    const { error } = await supabase.from('plano_anexos').insert({
      plano_id: planoId, user_id: userId, nome_arquivo: file.name,
      storage_path: path, mime_type: file.type, tamanho_bytes: file.size, tipo,
    });
    if (error) toast({ title: 'Erro ao salvar anexo', description: error.message, variant: 'destructive' });
    await load();
    setUploading(false);
  };

  const baixar = async (a: Anexo) => {
    const { data } = await supabase.storage.from('plano-anexos').createSignedUrl(a.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const remover = async (a: Anexo) => {
    await supabase.storage.from('plano-anexos').remove([a.storage_path]);
    await supabase.from('plano_anexos').delete().eq('id', a.id);
    load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted">
          <Paperclip className="w-3 h-3" />
          <span className="truncate">{label}</span>
          {anexos.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px]">
              {anexos.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 pointer-events-auto" align="start">
        <p className="text-xs font-semibold mb-2">{label}</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {anexos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
          {anexos.map(a => (
            <div key={a.id} className="flex items-center gap-1 text-xs bg-muted/40 rounded px-2 py-1">
              <span className="flex-1 truncate" title={a.nome_arquivo}>{a.nome_arquivo}</span>
              <button onClick={() => baixar(a)} title="Baixar" className="p-1 hover:text-primary"><Download className="w-3 h-3" /></button>
              {!readOnly && (
                <button onClick={() => remover(a)} title="Remover" className="p-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
            <Button size="sm" className="w-full mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enviando…</> : 'Anexar arquivo'}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}