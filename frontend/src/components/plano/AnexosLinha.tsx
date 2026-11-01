import React, { useEffect, useRef, useState } from 'react';
import { api, linkDoArquivo, mensagemDeErro } from '@/lib/api';
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
    setAnexos(await api.get<Anexo[]>(`/planos-aula/${planoId}/anexos`, { tipo }).catch(() => []));
  };

  useEffect(() => { load(); }, [planoId, tipo]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      // O arquivo vai pelo backend, que guarda na pasta do professor dono e registra o anexo.
      await api.post(`/planos-aula/${planoId}/anexos`, file, { tipo, nome: file.name });
    } catch (err) {
      toast({ title: 'Falha no upload', description: mensagemDeErro(err), variant: 'destructive' });
    }
    await load();
    setUploading(false);
  };

  const baixar = async (a: Anexo) => {
    try {
      window.open(await linkDoArquivo('plano-anexos', a.storage_path, 60), '_blank');
    } catch (err) {
      toast({ title: 'Não foi possível abrir', description: mensagemDeErro(err), variant: 'destructive' });
    }
  };

  const remover = async (a: Anexo) => {
    try {
      // Apaga o registro e o arquivo.
      await api.delete(`/planos-aula/${planoId}/anexos/${a.id}`);
    } catch (err) {
      toast({ title: 'Erro ao remover', description: mensagemDeErro(err), variant: 'destructive' });
    }
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