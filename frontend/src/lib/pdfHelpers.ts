import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoEscola from '@/assets/logo-escola.png';

const ESCOLA_NOME = 'EE Prof. Edson Vianei Alves';
const ESCOLA_LEMA = 'jovens autônomos, solidários e competentes';

export type PdfColumn = string;

export interface SimplePdfOpts {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: (string | number | null | undefined)[][];
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

/** Cabeçalho institucional (logo + nome) */
function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Logo
  try { doc.addImage(logoEscola, 'PNG', 14, 10, 16, 16); } catch { /* ignore */ }
  // Nome da escola
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(11, 94, 215);
  doc.text(ESCOLA_NOME, 34, 16);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(21, 62, 140);
  doc.text(ESCOLA_LEMA, 34, 21);
  // Linha
  doc.setDrawColor(11, 94, 215); doc.setLineWidth(0.5);
  doc.line(14, 28, pageW - 14, 28);
  // Título do documento
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(21, 62, 140);
  doc.text(title, 14, 36);
  if (subtitle) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
    doc.text(subtitle, 14, 42);
  }
  doc.setTextColor(0);
  return subtitle ? 46 : 40;
}

/** Rodapé com número de página */
function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`${ESCOLA_NOME} · Painel Escolar Inteligente`, 14, pageH - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
  }
}

/** Tabela simples para impressão (layout limpo e padronizado). */
export function exportTablePdf({ title, subtitle, columns, rows, filename, orientation = 'portrait' }: SimplePdfOpts) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const startY = drawHeader(doc, title, `${subtitle ? subtitle + ' · ' : ''}Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${rows.length} registro(s)`);
  autoTable(doc, {
    startY: startY + 2,
    head: [columns],
    body: rows.map(r => r.map(c => (c == null ? '—' : String(c)))),
    styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [11, 94, 215], halign: 'left', textColor: 255 },
    alternateRowStyles: { fillColor: [234, 244, 255] },
    margin: { bottom: 15 },
  });
  drawFooter(doc);
  doc.save(filename);
}

export interface DetailField { label: string; value?: string | number | null }

/** PDF de detalhe único (ficha de um registro). */
export function exportDetailPdf({ title, subtitle, fields, filename }: {
  title: string; subtitle?: string; fields: DetailField[]; filename: string;
}) {
  const doc = new jsPDF();
  let y = drawHeader(doc, title, subtitle) + 2;
  for (const f of fields) {
    if (f.value == null || String(f.value).trim() === '') continue;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(21, 62, 140);
    doc.text(f.label.toUpperCase(), 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(20);
    const lines = doc.splitTextToSize(String(f.value), 182);
    for (const l of lines) {
      if (y > 275) { doc.addPage(); y = drawHeader(doc, title, subtitle) + 2; }
      doc.text(l, 14, y); y += 6;
    }
    y += 3;
  }
  drawFooter(doc);
  doc.save(filename);
}
