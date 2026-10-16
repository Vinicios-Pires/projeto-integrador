import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsQR from 'jsqr';

const ALTS = ['A', 'B', 'C', 'D', 'E'];

interface LeituraResultado {
  provaId: string | null;
  numeroChamada: number | null;
  respostas: Record<number, string>;
  qrDetectado: boolean;
  rollDetectado: boolean;
  nomeAluno: string;
}

interface EscaneamentoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provas: any[];
  alunos: any[];
  gabarito: Record<number, string>;
  anuladas: number[];
  valorTotal: number;
  onSalvar: (alunoId: string, respostas: Record<number, string>, nota: number, acertos: number) => Promise<void>;
}

export function EscaneamentoDialog({ open, onOpenChange, provas, alunos, gabarito, anuladas, valorTotal, onSalvar }: EscaneamentoDialogProps) {
  const [step, setStep] = useState<'scan' | 'review' | 'saved'>('scan');
  const [leitura, setLeitura] = useState<LeituraResultado | null>(null);
  const [provaManual, setProvaManual] = useState('');
  const [rollManual, setRollManual] = useState('');
  const [respostasManual, setRespostasManual] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  function reset() {
    setStep('scan');
    setLeitura(null);
    setImgSrc(null);
    setRollManual('');
    setRespostasManual({});
    stopCamera();
  }

  function stopCamera() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setScanning(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
      setScanning(true);
      scanLoop();
    } catch {
      alert('Não foi possível acessar a câmera. Por favor, permita o acesso ou use upload de imagem.');
    }
  }

  function scanLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function tick() {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        processQR(code.data);
        stopCamera();
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
  }

  function processQR(data: string) {
    try {
      const parsed = JSON.parse(data);
      const resultado: LeituraResultado = {
        provaId: parsed.id || null,
        numeroChamada: null,
        respostas: {},
        qrDetectado: !!parsed.id,
        rollDetectado: false,
        nomeAluno: '',
      };
      setLeitura(resultado);
      setProvaManual(parsed.id || '');
      setStep('review');
    } catch {
      alert('QR Code inválido. Certifique-se de escanear o cartão da avaliação correto.');
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setImgSrc(src);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          processQR(code.data);
        } else {
          // QR not found, allow manual entry
          setLeitura({ provaId: null, numeroChamada: null, respostas: {}, qrDetectado: false, rollDetectado: false, nomeAluno: '' });
          setStep('review');
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function entradaManual() {
    setLeitura({ provaId: null, numeroChamada: null, respostas: {}, qrDetectado: false, rollDetectado: false, nomeAluno: '' });
    setStep('review');
  }

  // compute nota
  const respostasFinais = step === 'review' ? { ...leitura?.respostas, ...respostasManual } : {};
  const rollFinal = rollManual ? parseInt(rollManual) : leitura?.numeroChamada;
  const alunoEncontrado = alunos.find(a => a.numero_chamada === rollFinal);
  const questoes = Object.keys(gabarito).map(Number).sort((a, b) => a - b);
  let acertos = 0;
  questoes.forEach(q => {
    if (anuladas.includes(q)) { acertos += 1; return; }
    if (respostasFinais[q] && respostasFinais[q] === gabarito[q]) acertos++;
  });
  const questoesValidas = questoes.filter(q => !anuladas.includes(q));
  const nota = questoes.length > 0 ? (acertos / questoes.length) * (valorTotal || 10) : 0;

  async function handleSalvar() {
    if (!alunoEncontrado) { alert('Aluno não encontrado. Verifique o número de chamada.'); return; }
    setSaving(true);
    await onSalvar(alunoEncontrado.id, respostasFinais, nota, acertos);
    setSaving(false);
    setStep('saved');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); stopCamera(); } onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'scan' && 'Escanear Folha de Respostas'}
            {step === 'review' && 'Conferir e Lançar Resultado'}
            {step === 'saved' && 'Resultado Salvo!'}
          </DialogTitle>
        </DialogHeader>

        {/* STEP: SCAN */}
        {step === 'scan' && (
          <div className="space-y-4">
            {!cameraOn && !imgSrc && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={startCamera} className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 transition-all">
                  <Camera className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium">Usar Câmera</span>
                  <span className="text-xs text-muted-foreground text-center">Aponte para o QR Code da avaliação</span>
                </button>
                <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer">
                  <Upload className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium">Enviar Imagem</span>
                  <span className="text-xs text-muted-foreground text-center">JPG, PNG ou PDF escaneado</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
                <button onClick={entradaManual} className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 transition-all">
                  <span className="text-3xl">✏️</span>
                  <span className="text-sm font-medium">Entrada Manual</span>
                  <span className="text-xs text-muted-foreground text-center">Digitar respostas manualmente</span>
                </button>
              </div>
            )}

            {cameraOn && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 border-2 border-primary rounded-xl animate-pulse opacity-70" />
                  </div>
                  <p className="absolute bottom-2 left-0 right-0 text-center text-white text-xs bg-black/50 py-1">
                    Aponte o QR Code para o centro da tela
                  </p>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <Button variant="outline" size="sm" onClick={stopCamera}><XCircle className="w-4 h-4 mr-1.5" />Cancelar</Button>
              </div>
            )}

            {imgSrc && !cameraOn && (
              <div className="space-y-2">
                <img src={imgSrc} alt="Folha escaneada" className="max-h-48 rounded-xl border border-border object-contain" />
                <p className="text-sm text-muted-foreground">Processando imagem...</p>
              </div>
            )}
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === 'review' && leitura && (
          <div className="space-y-4">
            {/* Status da leitura */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn('flex items-center gap-2 p-3 rounded-xl border', leitura.qrDetectado ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5')}>
                {leitura.qrDetectado ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />}
                <div>
                  <p className="text-xs font-semibold">{leitura.qrDetectado ? 'QR Code Detectado' : 'QR Code Não Lido'}</p>
                  {!leitura.qrDetectado && <p className="text-xs text-muted-foreground">Selecione manualmente</p>}
                </div>
              </div>
              <div className={cn('flex items-center gap-2 p-3 rounded-xl border', alunoEncontrado ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5')}>
                {alunoEncontrado ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />}
                <div>
                  <p className="text-xs font-semibold">{alunoEncontrado ? `Aluno: ${alunoEncontrado.nome.split(' ')[0]}` : 'Aluno Não Identificado'}</p>
                  <p className="text-xs text-muted-foreground">{alunoEncontrado ? `Nº ${alunoEncontrado.numero_chamada}` : 'Informe o número'}</p>
                </div>
              </div>
            </div>

            {/* Prova (caso QR não detectado) */}
            {!leitura.qrDetectado && (
              <div className="space-y-1.5">
                <Label className="text-xs">Prova *</Label>
                <Select value={provaManual} onValueChange={setProvaManual}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a prova" /></SelectTrigger>
                  <SelectContent>{provas.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.titulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Número de chamada */}
            <div className="space-y-1.5">
              <Label className="text-xs">Número de Chamada do Aluno *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 15"
                  value={rollManual}
                  onChange={e => setRollManual(e.target.value)}
                  className="h-8 text-sm w-32"
                />
                {alunoEncontrado && <span className="flex items-center text-sm text-success font-medium"><CheckCircle className="w-4 h-4 mr-1" />{alunoEncontrado.nome}</span>}
                {rollManual && !alunoEncontrado && <span className="flex items-center text-sm text-destructive"><XCircle className="w-4 h-4 mr-1" />Não encontrado</span>}
              </div>
            </div>

            {/* Respostas */}
            {questoes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Respostas do Aluno (confirme ou ajuste)</Label>
                <div className="flex flex-wrap gap-2">
                  {questoes.map(q => {
                    const isAnulada = anuladas.includes(q);
                    return (
                      <div key={q} className={cn('flex flex-col items-center gap-1', isAnulada ? 'opacity-40' : '')}>
                        <span className="text-xs font-bold text-muted-foreground">{q}</span>
                        {isAnulada ? <span className="text-xs text-warning font-semibold px-1">Anul</span> : (
                          <div className="flex gap-0.5">
                            {ALTS.map(alt => {
                              const selected = respostasManual[q] === alt || (!respostasManual[q] && respostasFinais[q] === alt);
                              const isCorrect = selected && gabarito[q] === alt;
                              const isWrong = selected && gabarito[q] && gabarito[q] !== alt;
                              return (
                                <button key={alt}
                                  onClick={() => setRespostasManual(r => ({ ...r, [q]: r[q] === alt ? '' : alt }))}
                                  disabled={isAnulada}
                                  className={cn('w-6 h-6 text-xs font-bold rounded-full border transition-all',
                                    isCorrect ? 'bg-success text-success-foreground border-success' :
                                    isWrong ? 'bg-destructive text-destructive-foreground border-destructive' :
                                    selected ? 'bg-primary text-primary-foreground border-primary' :
                                    'border-border text-muted-foreground hover:border-primary/50')}>
                                  {alt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resultado calculado */}
            {questoes.length > 0 && (
              <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-xl border border-border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Acertos</p>
                  <p className="text-xl font-bold text-foreground">{acertos}<span className="text-sm text-muted-foreground">/{questoes.length}</span></p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Nota</p>
                  <p className={cn('text-2xl font-bold', nota >= (valorTotal * 0.7) ? 'text-success' : nota >= (valorTotal * 0.5) ? 'text-warning' : 'text-destructive')}>
                    {nota.toFixed(1)}
                  </p>
                </div>
                {anuladas.length > 0 && (
                  <>
                    <div className="h-8 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Anuladas</p>
                      <p className="text-xl font-bold text-warning">{anuladas.length}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={reset}><RefreshCw className="w-4 h-4 mr-1.5" />Novo Escaneamento</Button>
              <Button size="sm" onClick={handleSalvar} disabled={saving || !alunoEncontrado || questoes.length === 0}>
                {saving ? 'Salvando...' : 'Confirmar e Salvar Nota'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: SAVED */}
        {step === 'saved' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="w-16 h-16 text-success" />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Resultado salvo com sucesso!</p>
              <p className="text-sm text-muted-foreground">Nota {nota.toFixed(1)} lançada para {alunoEncontrado?.nome}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}><RefreshCw className="w-4 h-4 mr-1.5" />Escanear Próxima</Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
