import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type LinhaPdf = {
  data_aula: string;
  dia_semana?: string;
  numero_aulas?: number | null;
  aprendizagem_essencial?: string | null;
  conteudo?: string | null;
  desenvolvimento?: string | null;
  recursos?: string | null;
  avaliacao_aprendizagem?: string | null;
  qtd_anexos_doc?: number;
  qtd_anexos_adapt?: number;
};

export type CabecalhoPdf = {
  professor: string;
  disciplina: string;
  turma: string;
  bimestre: number;
  ano: number;
  status: string;
  validado_por?: string;
  validado_em?: string;
};

function fmt(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export function exportPlanejamentoBimestralPdf(cab: CabecalhoPdf, linhas: LinhaPdf[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(`Planejamento Bimestral — ${cab.bimestre}º Bimestre / ${cab.ano}`, 14, 14);
  doc.setFontSize(10);
  doc.text(`Professor: ${cab.professor}    Disciplina: ${cab.disciplina}    Turma: ${cab.turma}`, 14, 21);
  doc.text(`Status: ${cab.status}${cab.validado_por ? `    Validado por: ${cab.validado_por}` : ''}${cab.validado_em ? `    em ${fmt(cab.validado_em)}` : ''}`, 14, 27);

  autoTable(doc, {
    startY: 32,
    head: [['Data', 'Dia', 'Aulas', 'Aprendizagem essencial', 'Conteúdo/Objetivo', 'Desenvolvimento', 'Recursos', 'Avaliação', 'Anexos']],
    body: linhas.map(l => [
      fmt(l.data_aula),
      l.dia_semana ?? '',
      l.numero_aulas ?? '',
      l.aprendizagem_essencial ?? '',
      l.conteudo ?? '',
      l.desenvolvimento ?? '',
      l.recursos ?? '',
      l.avaliacao_aprendizagem ?? '',
      [l.qtd_anexos_doc ? `📎${l.qtd_anexos_doc} doc` : '', l.qtd_anexos_adapt ? `📎${l.qtd_anexos_adapt} adapt` : ''].filter(Boolean).join(' '),
    ]),
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [37, 99, 235], halign: 'left' },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: 22 }, 2: { cellWidth: 12 },
      3: { cellWidth: 38 }, 4: { cellWidth: 42 }, 5: { cellWidth: 42 },
      6: { cellWidth: 32 }, 7: { cellWidth: 30 }, 8: { cellWidth: 22 },
    },
  });

  doc.save(`planejamento_${cab.bimestre}bim_${cab.disciplina}_${cab.turma}.pdf`.replace(/\s+/g, '_'));
}