import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, Download, Users, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { PageHeader, FilterBar, TableContainer, BadgeSituacao, LoadingSpinner } from '@/components/ui-escola';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportTablePdf } from '@/lib/pdfHelpers';

export default function Relatorios() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [filterTurma, setFilterTurma] = useState('all');
  const [filterDisciplina, setFilterDisciplina] = useState('all');
  const [filterBimestre, setFilterBimestre] = useState('all');
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ aprovados: 0, recuperacao: 0, reprovados: 0, mediaGeral: 0 });

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { loadRelatorio(); }, [filterTurma, filterDisciplina, filterBimestre]);

  async function loadFilters() {
    const [{ data: t }, { data: d }] = await Promise.all([
      supabase.from('turmas').select('id, nome').order('nome'),
      supabase.from('disciplinas').select('id, nome').order('nome'),
    ]);
    setTurmas(t || []);
    setDisciplinas(d || []);
  }

  async function loadRelatorio() {
    setLoading(true);
    let query = supabase.from('alunos').select('id, nome, numero_chamada, turmas(nome), notas(nota, bimestre, tipos_avaliacao(nome, peso, bimestre, disciplina_id))').eq('ativo', true);
    if (filterTurma !== 'all') query = query.eq('turma_id', filterTurma);
    const { data: alunosData } = await query.order('numero_chamada');

    const result = (alunosData || []).map((aluno: any) => {
      let notasFiltradas = (aluno.notas || []);
      if (filterBimestre !== 'all') notasFiltradas = notasFiltradas.filter((n: any) => n.bimestre === parseInt(filterBimestre));
      if (filterDisciplina !== 'all') notasFiltradas = notasFiltradas.filter((n: any) => n.tipos_avaliacao?.disciplina_id === filterDisciplina);
      const validas = notasFiltradas.filter((n: any) => n.nota !== null);
      const totalPeso = validas.reduce((s: number, n: any) => s + (n.tipos_avaliacao?.peso || 1), 0);
      const media = totalPeso > 0 ? validas.reduce((s: number, n: any) => s + (n.nota * (n.tipos_avaliacao?.peso || 1)), 0) / totalPeso : null;
      const situacao = media === null ? '—' : media >= 7 ? 'Aprovado' : media >= 5 ? 'Recuperação' : 'Reprovado';
      return { ...aluno, media, situacao, notas_count: validas.length };
    });
    setDados(result);

    const comMedia = result.filter(r => r.media !== null);
    const aprovados = comMedia.filter(r => r.situacao === 'Aprovado').length;
    const recuperacao = comMedia.filter(r => r.situacao === 'Recuperação').length;
    const reprovados = comMedia.filter(r => r.situacao === 'Reprovado').length;
    const mediaGeral = comMedia.length > 0 ? comMedia.reduce((s, r) => s + r.media, 0) / comMedia.length : 0;
    setStats({ aprovados, recuperacao, reprovados, mediaGeral });
    setLoading(false);
  }

  function exportar() {
    const header = 'Número,Nome,Turma,Média,Situação\n';
    const rows = dados.map(a => `${a.numero_chamada},"${a.nome}","${(a.turmas as any)?.nome || ''}",${a.media?.toFixed(2) || ''},${a.situacao}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'relatorio_notas.csv'; link.click();
  }

  function exportarPDF() {
    exportTablePdf({
      title: 'Relatório de Desempenho',
      subtitle: `Aprovados: ${stats.aprovados} · Recuperação: ${stats.recuperacao} · Reprovados: ${stats.reprovados} · Média geral: ${stats.mediaGeral.toFixed(2)}`,
      columns: ['Nº', 'Nome', 'Turma', 'Avaliações', 'Média', 'Situação'],
      rows: dados.map(a => [a.numero_chamada, a.nome, (a.turmas as any)?.nome || '', a.notas_count, a.media != null ? a.media.toFixed(2) : '—', a.situacao]),
      filename: 'relatorio_desempenho.pdf',
      orientation: 'landscape',
    });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Relatórios" subtitle="Análise de desempenho e exportações">
        <Button variant="outline" size="sm" onClick={exportar}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
        <Button variant="outline" size="sm" onClick={exportarPDF}><Download className="w-4 h-4 mr-1.5" />Gerar PDF</Button>
      </PageHeader>

      <FilterBar>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas turmas</SelectItem>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
          <SelectTrigger className="w-44 h-8 text-sm bg-background"><SelectValue placeholder="Disciplina" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas disciplinas</SelectItem>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterBimestre} onValueChange={setFilterBimestre}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Bimestre" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos bimestres</SelectItem>{[1,2,3,4].map(b => <SelectItem key={b} value={String(b)}>{b}º Bimestre</SelectItem>)}</SelectContent>
        </Select>
      </FilterBar>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Aprovados', value: stats.aprovados, color: 'text-success', bg: 'bg-success-light' },
          { label: 'Recuperação', value: stats.recuperacao, color: 'text-warning', bg: 'bg-warning-light' },
          { label: 'Reprovados', value: stats.reprovados, color: 'text-destructive', bg: 'bg-danger-light' },
          { label: 'Média Geral', value: stats.mediaGeral.toFixed(2), color: 'text-primary', bg: 'bg-primary-light' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-4 text-center', s.bg)}>
            <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <TableContainer>
          <table className="table-sheet">
            <thead>
              <tr>
                <th className="w-10">Nº</th>
                <th>Nome</th>
                <th>Turma</th>
                <th className="text-center">Avaliações</th>
                <th className="text-center">Média</th>
                <th className="text-center">Situação</th>
              </tr>
            </thead>
            <tbody>
              {dados.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum dado encontrado</td></tr>
              ) : dados.map((a, i) => (
                <tr key={a.id} className={cn(i % 2 ? 'bg-muted/10' : '')}>
                  <td className="font-mono text-xs text-muted-foreground text-center">{a.numero_chamada}</td>
                  <td className="font-medium">{a.nome}</td>
                  <td className="text-sm text-muted-foreground">{(a.turmas as any)?.nome}</td>
                  <td className="text-center text-sm">{a.notas_count}</td>
                  <td className={cn('text-center font-bold', a.media === null ? 'text-muted-foreground' : a.media >= 7 ? 'text-success' : a.media >= 5 ? 'text-warning' : 'text-destructive')}>
                    {a.media !== null ? a.media.toFixed(2) : '—'}
                  </td>
                  <td className="text-center">{a.media !== null ? <BadgeSituacao situacao={a.situacao} /> : <span className="text-xs text-muted-foreground">Sem notas</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </div>
  );
}
