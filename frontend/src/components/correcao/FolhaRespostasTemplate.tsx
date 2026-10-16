import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface FolhaRespostasProps {
  prova: any;
  turmaNome: string;
  disciplinaNome: string;
}

const ALTS = ['A', 'B', 'C', 'D', 'E'];

// Gera SVG de marcador fiducial (quadrado preto)
function FiducialMarker({ size = 20 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, backgroundColor: '#000', flexShrink: 0 }} />
  );
}

export function FolhaRespostasTemplate({ prova, turmaNome, disciplinaNome }: FolhaRespostasProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const questoes = Array.from({ length: prova.numero_questoes }, (_, i) => i + 1);

  const qrData = JSON.stringify({
    id: prova.id,
    titulo: prova.titulo,
    turma: turmaNome,
    questoes: prova.numero_questoes,
  });

  function imprimir() {
    const win = window.open('', '_blank');
    if (!win || !printRef.current) return;
    const escapeHtml = (s: string) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(prova.titulo)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;padding:15px;font-size:11px;color:#000;position:relative;min-height:100vh}
      .fiducial{width:18px;height:18px;background:#000;position:absolute}
      .fiducial-tl{top:8px;left:8px}
      .fiducial-tr{top:8px;right:8px}
      .fiducial-bl{bottom:8px;left:8px}
      .fiducial-br{bottom:8px;right:8px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px;margin-top:24px}
      .header-info h1{font-size:13px;font-weight:bold;text-transform:uppercase}
      .header-info p{font-size:10px;margin-top:2px}
      .qr-box{display:flex;flex-direction:column;align-items:center;gap:3px}
      .qr-label{font-size:8px;text-align:center;font-weight:bold}
      .student-section{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start}
      .student-name{flex:1}
      .field-line{border-bottom:1.5px solid #000;height:22px;margin-top:4px}
      .field-label{font-size:9px;font-weight:bold;color:#333}
      .roll-section{border:2px solid #000;padding:6px;min-width:140px}
      .roll-title{font-size:9px;font-weight:bold;text-align:center;margin-bottom:4px}
      .roll-grid{display:flex;gap:2px;justify-content:center}
      .roll-col{display:flex;flex-direction:column;align-items:center;gap:1px}
      .roll-col-header{font-size:8px;font-weight:bold;margin-bottom:2px}
      .roll-bubble{width:14px;height:14px;border:1.5px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:bold}
      .instructions{background:#f5f5f5;padding:5px 8px;margin-bottom:10px;font-size:9px;border:1px solid #ddd}
      .answer-section{margin-bottom:8px}
      .answer-title{font-size:10px;font-weight:bold;margin-bottom:6px;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:2px}
      .answer-grid{display:flex;flex-wrap:wrap;gap:0}
      .answer-col{flex:1;min-width:0}
      .answer-row{display:flex;align-items:center;border-bottom:1px solid #eee;padding:2px 4px}
      .q-num{font-weight:bold;font-size:9px;width:22px;text-align:right;margin-right:6px;flex-shrink:0}
      .bubble{width:16px;height:16px;border:1.5px solid #000;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;margin:0 2px}
      .alt-header{display:flex;padding:2px 4px;margin-bottom:2px}
      .alt-header span{width:16px;text-align:center;font-size:8px;font-weight:bold;margin:0 2px}
      .alt-header .q-spacer{width:22px;margin-right:6px;flex-shrink:0}
      .footer{margin-top:10px;border-top:1px solid #999;padding-top:4px;display:flex;justify-content:space-between;font-size:9px;color:#666}
      @media print{body{padding:10px}.fiducial{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style>
    </head><body></body></html>`);
    win.document.body.appendChild(printRef.current.cloneNode(true));
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }

  // Divide questões em colunas
  const numCols = questoes.length <= 20 ? 4 : questoes.length <= 40 ? 5 : 6;
  const perCol = Math.ceil(questoes.length / numCols);
  const columns: number[][] = [];
  for (let i = 0; i < numCols; i++) {
    columns.push(questoes.slice(i * perCol, (i + 1) * perCol));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={imprimir}><Printer className="w-4 h-4 mr-1.5" />Imprimir Folha OMR</Button>
      </div>

      {/* Preview */}
      <div ref={printRef} className="bg-white border-2 border-border rounded-lg p-4 text-[11px] text-black font-sans max-w-2xl relative">
        {/* Marcadores fiduciais (4 cantos) */}
        <div className="fiducial fiducial-tl" style={{ width: 18, height: 18, backgroundColor: '#000', position: 'absolute', top: 6, left: 6 }} />
        <div className="fiducial fiducial-tr" style={{ width: 18, height: 18, backgroundColor: '#000', position: 'absolute', top: 6, right: 6 }} />
        <div className="fiducial fiducial-bl" style={{ width: 18, height: 18, backgroundColor: '#000', position: 'absolute', bottom: 6, left: 6 }} />
        <div className="fiducial fiducial-br" style={{ width: 18, height: 18, backgroundColor: '#000', position: 'absolute', bottom: 6, right: 6 }} />

        {/* Header com QR Code */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2 mt-5 ml-5 mr-5">
          <div className="flex-1">
            <h1 className="text-[12px] font-bold uppercase">{prova.escola || 'Escola Municipal'}</h1>
            <p className="mt-0.5 text-[10px]"><strong>Componente:</strong> {disciplinaNome} &nbsp;|&nbsp; <strong>Turma:</strong> {turmaNome}</p>
            <p className="text-[10px]"><strong>Professor(a):</strong> {prova.professor || '_________________________'} &nbsp;|&nbsp; <strong>Data:</strong> {prova.data_aplicacao ? new Date(prova.data_aplicacao + 'T12:00:00').toLocaleDateString('pt-BR') : '____/____/______'}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase">{prova.titulo}</p>
            <p className="text-[10px]"><strong>Bimestre:</strong> {prova.bimestre}º &nbsp;|&nbsp; <strong>Valor:</strong> {prova.valor_total || 10} pts &nbsp;|&nbsp; <strong>Questões:</strong> {prova.numero_questoes}</p>
          </div>
          <div className="flex flex-col items-center gap-1 ml-3 flex-shrink-0">
            <QRCodeSVG value={qrData} size={65} level="M" />
            <span className="text-[8px] font-bold text-center leading-tight">QR Avaliação</span>
          </div>
        </div>

        {/* Identificação do aluno + Roll No OMR */}
        <div className="flex gap-3 mb-2 ml-5 mr-5">
          <div className="flex-1">
            <div className="text-[9px] font-bold text-gray-600 mb-1">IDENTIFICAÇÃO DO ALUNO</div>
            <div className="border-b-[1.5px] border-black pb-0.5 mb-1">
              <span className="text-[9px] font-bold text-gray-500">Nome completo: </span>
            </div>
            <div className="border-b border-black h-4" />
          </div>
          {/* Roll No - Grid OMR profissional */}
          <div className="border-2 border-black p-1.5 flex-shrink-0" style={{ minWidth: 130 }}>
            <div className="text-[9px] font-bold text-center mb-1">Nº CHAMADA (Roll No)</div>
            <div className="flex gap-[3px] justify-center">
              {[0, 1].map(col => (
                <div key={col} className="flex flex-col items-center gap-[2px]">
                  <span className="text-[7px] font-bold mb-[1px]">{col === 0 ? 'D' : 'U'}</span>
                  {[0,1,2,3,4,5,6,7,8,9].map(digit => (
                    <span key={digit} className="w-[13px] h-[13px] border-[1.5px] border-black rounded-full inline-flex items-center justify-center text-[7px] font-bold">
                      {digit}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-gray-100 px-2 py-1 mb-2 text-[9px] mx-5 border border-gray-300">
          <strong>INSTRUÇÕES:</strong> {prova.observacoes || 'Preencha completamente a bolha correspondente à resposta correta. Use caneta preta ou azul escuro. Marque apenas uma alternativa por questão. Não rasure.'}
        </div>

        {/* Gabarito OMR - Grade profissional */}
        <div className="mx-5 mb-2">
          <div className="text-[9px] font-bold mb-1 uppercase border-b border-black pb-0.5">Folha de Respostas</div>
          <div className="flex gap-1">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1">
                {/* Cabeçalho das alternativas */}
                <div className="flex items-center py-[2px]">
                  <span className="text-[8px] font-bold w-[20px] text-right mr-[5px]" />
                  {ALTS.map(alt => (
                    <span key={alt} className="w-[16px] text-center text-[8px] font-bold mx-[2px]">{alt}</span>
                  ))}
                </div>
                {col.map(q => (
                  <div key={q} className="flex items-center py-[1px] border-b border-gray-200">
                    <span className="text-[9px] font-bold w-[20px] text-right mr-[5px] flex-shrink-0">{q}.</span>
                    <div className="flex gap-[2px]">
                      {ALTS.map(alt => (
                        <span key={alt} className="w-[16px] h-[16px] border-[1.5px] border-black rounded-full inline-flex items-center justify-center text-[8px] font-bold mx-[1px]">
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-3 border-t border-gray-400 pt-1.5 flex justify-between text-[9px] text-gray-500 mx-5 mb-5">
          <span>Aulas previstas: {prova.aulas_previstas || '____'}</span>
          <span>Ano letivo: {new Date().getFullYear()}</span>
          <span>Nota: ________</span>
        </div>
      </div>
    </div>
  );
}
