import jsPDF from 'jspdf';

export interface PlanoPdfData {
  data_aula: string;
  dia_semana?: string;
  turma_nome?: string;
  serie?: string;
  disciplina_nome?: string;
  professor?: string;
  bimestre?: number;
  numero_aulas?: number;
  aulas_previstas?: number;
  aprendizagem_essencial?: string;
  conteudo?: string;
  objetivos?: string;
  recursos?: string;
  desenvolvimento?: string;
  material_digital?: string;
  avaliacao_aprendizagem?: string;
  habilidades?: string;
  objetivo_geral?: string;
  status?: string;
  aprovado_por?: string;
  data_aprovacao?: string;
  comentario_aprovacao?: string;
  ajustes?: { descricao: string; created_at: string }[];
  anexos?: { nome_arquivo: string }[];
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function diaDaSemana(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return DIAS[d.getDay()];
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

const MARGIN = 15;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function ensureSpace(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 285) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 12);
  doc.setFillColor(139, 94, 60); // primary terracota
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), MARGIN + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  return y + 9;
}

function drawField(doc: jsPDF, label: string, value: string | undefined, y: number): number {
  if (!value || !value.trim()) return y;
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(label.toUpperCase(), MARGIN, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(value, CONTENT_W);
  for (const line of lines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, MARGIN, y);
    y += 5;
  }
  return y + 2;
}

function drawHeader(doc: jsPDF, plano: PlanoPdfData, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(139, 94, 60);
  doc.text('PLANO DE AULA', PAGE_W / 2, y, { align: 'center' });
  y += 7;

  doc.setDrawColor(214, 204, 194);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  const dia = plano.dia_semana || diaDaSemana(plano.data_aula);
  const dataLinha = `${fmtDate(plano.data_aula)}${dia ? ' — ' + dia : ''}`;
  const linhas: [string, string][] = [
    ['Data', dataLinha],
    ['Turma', `${plano.turma_nome || '-'}${plano.serie ? '  (' + plano.serie + ')' : ''}`],
    ['Disciplina', plano.disciplina_nome || '-'],
    ['Professor(a)', plano.professor || '-'],
    ['Bimestre', plano.bimestre ? `${plano.bimestre}º` : '-'],
    ['Nº de aulas', plano.numero_aulas ? String(plano.numero_aulas) : '-'],
  ];

  const colW = CONTENT_W / 2;
  for (let i = 0; i < linhas.length; i += 2) {
    y = ensureSpace(doc, y, 7);
    doc.setFont('helvetica', 'bold');
    doc.text(linhas[i][0] + ':', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(linhas[i][1], MARGIN + 28, y);
    if (linhas[i + 1]) {
      doc.setFont('helvetica', 'bold');
      doc.text(linhas[i + 1][0] + ':', MARGIN + colW, y);
      doc.setFont('helvetica', 'normal');
      doc.text(linhas[i + 1][1], MARGIN + colW + 28, y);
    }
    y += 6;
  }

  y += 2;
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 4;
}

export function renderPlano(doc: jsPDF, plano: PlanoPdfData, startY: number): number {
  let y = drawHeader(doc, plano, startY);

  y = drawSectionTitle(doc, 'Aprendizagem essencial', y);
  y = drawField(doc, 'Aprendizagem essencial', plano.aprendizagem_essencial, y);
  y = drawField(doc, 'Habilidades', plano.habilidades, y);
  y = drawField(doc, 'Objetivo geral', plano.objetivo_geral, y);

  y = drawSectionTitle(doc, 'Conteúdo e objetivos', y);
  y = drawField(doc, 'Conteúdo', plano.conteudo, y);
  y = drawField(doc, 'Objetivos', plano.objetivos, y);

  y = drawSectionTitle(doc, 'Desenvolvimento da aula', y);
  y = drawField(doc, 'Desenvolvimento', plano.desenvolvimento, y);
  y = drawField(doc, 'Recursos', plano.recursos, y);
  y = drawField(doc, 'Material digital', plano.material_digital, y);

  y = drawSectionTitle(doc, 'Avaliação', y);
  y = drawField(doc, 'Avaliação da aprendizagem', plano.avaliacao_aprendizagem, y);
  if (plano.aulas_previstas) y = drawField(doc, 'Aulas previstas no bimestre', String(plano.aulas_previstas), y);

  if (plano.anexos?.length) {
    y = drawSectionTitle(doc, 'Atividades adaptadas (PEI)', y);
    for (const a of plano.anexos) {
      y = drawField(doc, '📎 Arquivo', a.nome_arquivo, y);
    }
  }

  if (plano.ajustes?.length) {
    y = drawSectionTitle(doc, 'Ajustes (PDCA)', y);
    for (const aj of plano.ajustes) {
      y = drawField(doc, fmtDate(aj.created_at.split('T')[0]), aj.descricao, y);
    }
  }

  y = drawSectionTitle(doc, 'Status de aprovação', y);
  if (plano.status === 'aprovado') {
    y = drawField(doc, 'Status', 'APROVADO', y);
    if (plano.aprovado_por) y = drawField(doc, 'Aprovado por', plano.aprovado_por, y);
    if (plano.data_aprovacao) y = drawField(doc, 'Data da aprovação', new Date(plano.data_aprovacao).toLocaleString('pt-BR'), y);
    if (plano.comentario_aprovacao) y = drawField(doc, 'Comentário', plano.comentario_aprovacao, y);
  } else {
    y = drawField(doc, 'Status', 'Pendente de aprovação', y);
  }

  return y;
}

export function exportPlanoIndividual(plano: PlanoPdfData, filename: string) {
  const doc = new jsPDF();
  renderPlano(doc, plano, MARGIN);
  doc.save(filename);
}

export function exportPlanos(planos: PlanoPdfData[], titulo: string, filename: string) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(139, 94, 60);
  doc.text(titulo, PAGE_W / 2, MARGIN + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${planos.length} plano(s) — gerado em ${new Date().toLocaleDateString('pt-BR')}`, PAGE_W / 2, MARGIN + 10, { align: 'center' });

  planos.forEach((p, i) => {
    if (i === 0) {
      renderPlano(doc, p, MARGIN + 18);
    } else {
      doc.addPage();
      renderPlano(doc, p, MARGIN);
    }
  });
  doc.save(filename);
}
