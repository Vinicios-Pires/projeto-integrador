import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onSave: (v: string) => Promise<void> | void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
};

/** Célula tipo planilha: edita inline, salva sozinho ao sair ou após 800ms de inatividade. */
export function CelulaEditavel({ value, onSave, readOnly, placeholder, className, multiline = true }: Props) {
  const [local, setLocal] = useState(value ?? '');
  const [estado, setEstado] = useState<'idle' | 'editando' | 'salvando' | 'salvo'>('idle');
  const timer = useRef<number | null>(null);
  const salvoRef = useRef(value ?? '');

  useEffect(() => {
    if (estado === 'idle') {
      setLocal(value ?? '');
      salvoRef.current = value ?? '';
    }
  }, [value]);

  const agendarSalvar = (next: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      if (next === salvoRef.current) { setEstado('idle'); return; }
      setEstado('salvando');
      await onSave(next);
      salvoRef.current = next;
      setEstado('salvo');
      window.setTimeout(() => setEstado('idle'), 800);
    }, 800);
  };

  if (readOnly) {
    return (
      <div className={cn('px-2 py-1.5 text-xs whitespace-pre-wrap min-h-[2rem]', className)}>
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    );
  }

  const Tag: any = multiline ? 'textarea' : 'input';
  return (
    <div className={cn('relative', className)}>
      <Tag
        value={local}
        placeholder={placeholder}
        onChange={(e: any) => {
          const v = e.target.value;
          setLocal(v);
          setEstado('editando');
          agendarSalvar(v);
        }}
        onBlur={async () => {
          if (timer.current) window.clearTimeout(timer.current);
          if (local !== salvoRef.current) {
            setEstado('salvando');
            await onSave(local);
            salvoRef.current = local;
            setEstado('salvo');
            window.setTimeout(() => setEstado('idle'), 800);
          }
        }}
        rows={multiline ? 2 : undefined}
        className="w-full bg-transparent text-xs px-2 py-1.5 resize-none focus:outline-none focus:bg-primary/5 rounded min-h-[2rem]"
      />
      {estado === 'salvando' && (
        <span className="absolute top-0 right-1 text-[9px] text-muted-foreground">salvando…</span>
      )}
      {estado === 'salvo' && (
        <span className="absolute top-0 right-1 text-[9px] text-green-600">salvo ✓</span>
      )}
    </div>
  );
}