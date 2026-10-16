import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ALTS = ['A', 'B', 'C', 'D', 'E'];

interface ResultadosTableProps {
  alunos: any[];
  gabarito: Record<number, string>;
  anuladas: number[];
  respostas: Record<string, Record<number, string>>;
  questoes: number[];
  valorTotal: number;
  onSalvarAluno: (alunoId: string) => void;
  onExportar: () => void;
}

export function ResultadosTable({ alunos, gabarito, anuladas, respostas, questoes, valorTotal, onSalvarAluno, onExportar }: ResultadosTableProps) {
  function calcNota(alunoId: string) {
    const resAl = respostas[alunoId] || {};
    let acertos = 0;
    questoes.forEach(q => {
      if (anuladas.includes(q)) { acertos++; return; }
      if (resAl[q] && resAl[q] === gabarito[q]) acertos++;
    });
    return questoes.length > 0 ? (acertos / questoes.length) * (valorTotal || 10) : null;
  }

  // Stats por questão
  const statsQuestao = questoes.map(q => {
    if (anuladas.includes(q)) return { q, taxa: null, anulada: true };
    const total = alunos.length;
    const acertos = alunos.filter(a => (respostas[a.id] || {})[q] === gabarito[q]).length;
    return { q, taxa: total > 0 ? (acertos / total) * 100 : 0, anulada: false };
  });

  const mediaGeral = alunos.reduce((acc, a) => acc + (calcNota(a.id) || 0), 0) / (alunos.length || 1);

  return (
    <div className="space-y-4">
      {/* Estatísticas da turma */}
      {alunos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Média da Turma</p>
            <p className={cn('text-2xl font-bold', mediaGeral >= (valorTotal * 0.7) ? 'text-success' : mediaGeral >= (valorTotal * 0.5) ? 'text-warning' : 'text-destructive')}>{mediaGeral.toFixed(1)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Aprovados (≥70%)</p>
            <p className="text-2xl font-bold text-success">{alunos.filter(a => { const n = calcNota(a.id); return n !== null && n >= (valorTotal * 0.7); }).length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Em Recuperação</p>
            <p className="text-2xl font-bold text-warning">{alunos.filter(a => { const n = calcNota(a.id); return n !== null && n >= (valorTotal * 0.5) && n < (valorTotal * 0.7); }).length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Abaixo da Média</p>
            <p className="text-2xl font-bold text-destructive">{alunos.filter(a => { const n = calcNota(a.id); return n !== null && n < (valorTotal * 0.5); }).length}</p>
          </div>
        </div>
      )}

      {/* Desempenho por questão */}
      {questoes.length > 0 && alunos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Desempenho por Questão</h3>
          <div className="flex flex-wrap gap-2">
            {statsQuestao.map(({ q, taxa, anulada }) => (
              <div key={q} className="flex flex-col items-center gap-1 min-w-[44px]">
                <span className="text-xs font-bold text-muted-foreground">{q}</span>
                {anulada ? (
                  <div className="w-8 h-8 rounded-full bg-warning/10 border border-warning/40 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-warning" />
                  </div>
                ) : (
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border',
                    taxa! >= 70 ? 'bg-success/10 border-success/40 text-success' :
                    taxa! >= 40 ? 'bg-warning/10 border-warning/40 text-warning' :
                    'bg-destructive/10 border-destructive/40 text-destructive')}>
                    {Math.round(taxa!)}%
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">% de acertos por questão · Verde ≥70% · Amarelo 40-69% · Vermelho &lt;40%</p>
        </div>
      )}

      {/* Tabela de alunos */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Resultados dos Alunos</h2>
          <Button size="sm" variant="outline" onClick={onExportar} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border sticky left-0 bg-secondary z-10 min-w-[48px]">Nº</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border sticky left-10 bg-secondary z-10 min-w-[140px]">Aluno</th>
                {questoes.map(q => (
                  <th key={q} className={cn('px-1.5 py-2 text-center font-semibold border-b border-border min-w-[30px]', anuladas.includes(q) ? 'text-warning' : 'text-muted-foreground')}>{q}</th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border">Acertos</th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border">Nota</th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border">Situação</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((aluno, i) => {
                const resAl = respostas[aluno.id] || {};
                let acertos = 0;
                questoes.forEach(q => {
                  if (anuladas.includes(q)) { acertos++; return; }
                  if (resAl[q] && resAl[q] === gabarito[q]) acertos++;
                });
                const nota = calcNota(aluno.id);
                const temRespostas = questoes.some(q => resAl[q]);
                const situacao = nota === null || !temRespostas ? null : nota >= (valorTotal * 0.7) ? 'Aprovado' : nota >= (valorTotal * 0.5) ? 'Recuperação' : 'Abaixo da média';
                return (
                  <tr key={aluno.id} className={cn('hover:bg-secondary/30 transition-colors', i % 2 ? 'bg-muted/10' : '')}>
                    <td className="px-3 py-2 font-mono sticky left-0 bg-inherit border-b border-border/40 z-10 text-muted-foreground">{aluno.numero_chamada}</td>
                    <td className="px-3 py-2 sticky left-10 bg-inherit font-medium border-b border-border/40 z-10">{aluno.nome}</td>
                    {questoes.map(q => {
                      const resp = resAl[q];
                      const gab = gabarito[q];
                      const isAnulada = anuladas.includes(q);
                      const isCorrect = !isAnulada && resp && resp === gab;
                      const isWrong = !isAnulada && resp && gab && resp !== gab;
                      return (
                        <td key={q} className="px-1 py-2 text-center border-b border-border/40">
                          {isAnulada ? <span className="text-warning font-bold">—</span> :
                           resp ? (
                            <span className={cn('w-5 h-5 text-[10px] font-bold rounded-full inline-flex items-center justify-center',
                              isCorrect ? 'bg-success/15 text-success' : isWrong ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}>
                              {resp}
                            </span>
                           ) : <span className="text-muted-foreground/30">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold border-b border-border/40 text-foreground">{temRespostas ? `${acertos}/${questoes.length}` : '—'}</td>
                    <td className={cn('px-3 py-2 text-center font-bold border-b border-border/40', nota !== null && temRespostas ? (nota >= (valorTotal * 0.7) ? 'text-success' : nota >= (valorTotal * 0.5) ? 'text-warning' : 'text-destructive') : 'text-muted-foreground')}>
                      {nota !== null && temRespostas ? nota.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center border-b border-border/40">
                      {situacao ? (
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                          situacao === 'Aprovado' ? 'bg-success/10 text-success' :
                          situacao === 'Recuperação' ? 'bg-warning/10 text-warning' :
                          'bg-destructive/10 text-destructive')}>
                          {situacao}
                        </span>
                      ) : <span className="text-muted-foreground/30 text-[10px]">Pendente</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
