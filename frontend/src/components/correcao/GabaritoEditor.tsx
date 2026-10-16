import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Save, X } from 'lucide-react';

const ALTS = ['A', 'B', 'C', 'D', 'E'];

interface GabaritoEditorProps {
  questoes: number[];
  gabForm: Record<number, string>;
  anuladas: number[];
  onSelectAlt: (q: number, alt: string) => void;
  onToggleAnulada: (q: number) => void;
  onSave: () => void;
  valorTotal: number;
}

export function GabaritoEditor({ questoes, gabForm, anuladas, onSelectAlt, onToggleAnulada, onSave, valorTotal }: GabaritoEditorProps) {
  const nRespondidas = questoes.filter(q => gabForm[q]).length;
  const pesoQ = questoes.length > 0 ? (valorTotal / questoes.length).toFixed(2) : '0';

  return (
    <div className="bg-card border border-border rounded-xl shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="font-semibold text-sm">Gabarito Oficial</h2>
          <p className="text-xs text-muted-foreground">{nRespondidas}/{questoes.length} respondidas · Peso por questão: {pesoQ} pt</p>
        </div>
        <Button size="sm" onClick={onSave} className="gap-1.5">
          <Save className="w-3.5 h-3.5" />Salvar Gabarito
        </Button>
      </div>
      <div className="p-4 flex flex-wrap gap-3">
        {questoes.map(q => {
          const isAnulada = anuladas.includes(q);
          return (
            <div key={q} className={cn('flex flex-col items-center gap-1 p-2 rounded-lg border transition-all', isAnulada ? 'border-warning/50 bg-warning/5' : 'border-transparent')}>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{q}</span>
                <button
                  onClick={() => onToggleAnulada(q)}
                  title={isAnulada ? 'Reativar questão' : 'Anular questão'}
                  className={cn('w-4 h-4 rounded-full border flex items-center justify-center transition-all', isAnulada ? 'bg-warning text-warning-foreground border-warning' : 'border-border/50 text-muted-foreground/30 hover:border-warning/50')}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
              {isAnulada ? (
                <span className="text-xs text-warning font-semibold px-2">Anulada</span>
              ) : (
                <div className="flex gap-0.5">
                  {ALTS.map(alt => (
                    <button key={alt}
                      onClick={() => onSelectAlt(q, alt)}
                      className={cn('w-7 h-7 text-xs font-bold rounded-full border-2 transition-all',
                        gabForm[q] === alt
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary')}>
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
