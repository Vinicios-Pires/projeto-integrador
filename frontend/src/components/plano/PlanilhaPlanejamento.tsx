import React, { useEffect, useMemo, useState } from 'react';
import { api, mensagemDeErro } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useLinhasPlanejamento, type LinhaAula, type Planejamento, STATUS_LABEL, diaDaSemanaISO, fmtDataBR } from '@/hooks/use-planejamento';
import { CelulaEditavel } from './CelulaEditavel';
import { AnexosLinha } from './AnexosLinha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Plus, Copy, Trash2, MoreVertical, ArrowDown, PenLine, FileDown, CheckCircle, Clock, Loader2, CalendarPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportPlanejamentoBimestralPdf } from '@/lib/planejamentoPdf';

type Props = {
  planejamento: Planejamento;
  professorNome: string;
  disciplinaNome: string;
  turmaNome: string;
  onBack: () => void;
  onChange: () => void;
};

const COLUNAS_COPIAVEIS = [
  { key: 'aprendizagem_essencial', label: 'Aprendizagem essencial' },
  { key: 'conteudo', label: 'Conteúdo/Objetivo' },
  { key: 'desenvolvimento', label: 'Desenvolvimento/Metodologia' },
  { key: 'recursos', label: 'Recursos' },
  { key: 'avaliacao_aprendizagem', label: 'Avaliação' },
] as const;

export function PlanilhaPlanejamento({ planejamento, professorNome, disciplinaNome, turmaNome, onBack, onChange }: Props) {
  const { user } = useAuth();
  const { isGestao, isProfessor, isAdmin } = usePermissions();
  const { toast } = useToast();
  const { linhas, setLinhas, refetch } = useLinhasPlanejamento(planejamento.id);

  const sou_dono = user?.id === planejamento.user_id;
  const readOnly = !(sou_dono || isAdmin) || planejamento.status === 'validado';

  const [openSeq, setOpenSeq] = useState(false);
  const [openValidar, setOpenValidar] = useState<null | 'validar' | 'ajustes' | 'reabrir'>(null);
  const [openAjuste, setOpenAjuste] = useState<LinhaAula | null>(null);

  /* ------- Manipulação otimista de linhas ------- */
  const atualizarLinha = async (id: string, patch: Partial<LinhaAula>) => {
    setLinhas(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    try {
      await api.patch(`/planos-aula/${id}`, patch);
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: mensagemDeErro(err), variant: 'destructive' });
      refetch();
    }
  };

  const adicionarLinha = async (data: string) => {
    if (!user) return;
    try {
      // Turma, matéria, bimestre e dono vêm do planejamento.
      await api.post('/planos-aula', { data_aula: data, planejamento_id: planejamento.id, numero_aulas: 1 });
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    refetch();
  };

  const adicionarHoje = () => adicionarLinha(new Date().toISOString().slice(0, 10));

  const adicionarSequencia = async (inicio: string, fim: string, diasSemana: number[]) => {
    if (!user) return;
    const ini = new Date(inicio + 'T12:00:00');
    const f = new Date(fim + 'T12:00:00');
    if (isNaN(ini.getTime()) || isNaN(f.getTime()) || ini > f) { toast({ title: 'Datas inválidas', variant: 'destructive' }); return; }
    const datas: string[] = [];
    for (let d = new Date(ini); d <= f; d.setDate(d.getDate() + 1)) {
      if (diasSemana.includes(d.getDay())) datas.push(d.toISOString().slice(0, 10));
    }
    if (datas.length === 0) { toast({ title: 'Nenhuma data gerada' }); return; }
    try {
      await api.post(`/planejamentos/${planejamento.id}/aulas`, { datas, numero_aulas: 1 });
      toast({ title: `${datas.length} aulas adicionadas` });
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    }
    refetch();
  };

  const duplicarLinha = async (l: LinhaAula) => {
    if (!user) return;
    try {
      // Cópia pendente, uma semana depois (o padrão do backend).
      await api.post(`/planos-aula/${l.id}/duplicar`, {});
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    }
    refetch();
  };

  const copiarParaBaixo = async (l: LinhaAula, campo: keyof LinhaAula) => {
    const idx = linhas.findIndex(x => x.id === l.id);
    const alvos = linhas.slice(idx + 1).map(x => x.id);
    if (alvos.length === 0) { toast({ title: 'Sem linhas abaixo' }); return; }
    const valor = (l as any)[campo];
    try {
      await api.patch('/planos-aula/lote', { ids: alvos, dados: { [campo]: valor } });
      toast({ title: `Copiado para ${alvos.length} linhas` });
    } catch (err) {
      toast({ title: 'Erro ao copiar', description: mensagemDeErro(err), variant: 'destructive' });
    }
    refetch();
  };

  const excluirLinha = async (l: LinhaAula) => {
    if (!confirm('Excluir esta aula do planejamento?')) return;
    try {
      await api.delete(`/planos-aula/${l.id}`);
    } catch (err) {
      toast({ title: 'Erro ao excluir', description: mensagemDeErro(err), variant: 'destructive' });
    }
    refetch();
  };

  const mudarStatus = async (novo: 'rascunho' | 'aguardando_validacao' | 'validado', obs?: string) => {
    try {
      // O backend confere quem pode fazer cada passagem e grava quem validou e quando.
      await api.post(`/planejamentos/${planejamento.id}/status`, { status: novo, observacao: obs });
      toast({ title: 'Status atualizado' });
      onChange();
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    }
  };

  const exportarPdf = async () => {
    const ids = linhas.map(l => l.id);
    let cont: Record<string, { doc: number; adapt: number }> = {};
    if (ids.length > 0) {
      const anexos = (await Promise.all(ids.map(id =>
        api.get<{ plano_id: string; tipo: string }[]>(`/planos-aula/${id}/anexos`).catch(() => []),
      ))).flat();
      anexos.forEach(a => {
        if (!cont[a.plano_id]) cont[a.plano_id] = { doc: 0, adapt: 0 };
        if (a.tipo === 'adaptada') cont[a.plano_id].adapt++; else cont[a.plano_id].doc++;
      });
    }
    exportPlanejamentoBimestralPdf(
      { professor: professorNome, disciplina: disciplinaNome, turma: turmaNome, bimestre: planejamento.bimestre, ano: planejamento.ano, status: STATUS_LABEL[planejamento.status], validado_em: planejamento.validado_em ?? undefined },
      linhas.map(l => ({
        data_aula: l.data_aula, dia_semana: diaDaSemanaISO(l.data_aula),
        numero_aulas: l.numero_aulas, aprendizagem_essencial: l.aprendizagem_essencial,
        conteudo: l.conteudo, desenvolvimento: l.desenvolvimento, recursos: l.recursos,
        avaliacao_aprendizagem: l.avaliacao_aprendizagem,
        qtd_anexos_doc: cont[l.id]?.doc, qtd_anexos_adapt: cont[l.id]?.adapt,
      })),
    );
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <div>
            <h2 className="text-lg font-bold">{disciplinaNome} — {turmaNome}</h2>
            <p className="text-xs text-muted-foreground">Professor: {professorNome} · {planejamento.bimestre}º Bimestre · {planejamento.ano}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={planejamento.status} />
          <Button variant="outline" size="sm" onClick={exportarPdf}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          {sou_dono && planejamento.status === 'rascunho' && (
            <Button size="sm" onClick={() => mudarStatus('aguardando_validacao')}><Clock className="w-4 h-4 mr-1" /> Enviar para validação</Button>
          )}
          {isGestao && planejamento.status !== 'validado' && (
            <Button size="sm" onClick={() => setOpenValidar('validar')}><CheckCircle className="w-4 h-4 mr-1" /> Validar Planejamento</Button>
          )}
          {isGestao && planejamento.status === 'aguardando_validacao' && (
            <Button size="sm" variant="outline" onClick={() => setOpenValidar('ajustes')}>Solicitar ajustes</Button>
          )}
          {isGestao && planejamento.status === 'validado' && (
            <Button size="sm" variant="outline" onClick={() => setOpenValidar('reabrir')}>Reabrir</Button>
          )}
        </div>
      </div>

      {planejamento.observacao_validacao && (
        <div className="text-xs p-2 bg-amber-50 border border-amber-200 rounded">
          <strong>Observação da coordenação:</strong> {planejamento.observacao_validacao}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={adicionarHoje}><Plus className="w-4 h-4 mr-1" /> Adicionar aula</Button>
          <Button size="sm" variant="outline" onClick={() => setOpenSeq(true)}><CalendarPlus className="w-4 h-4 mr-1" /> Datas em sequência</Button>
        </div>
      )}

      {/* Tabela */}
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="p-2 border-b border-r w-28">Data</th>
              <th className="p-2 border-b border-r w-24">Dia</th>
              <th className="p-2 border-b border-r w-14">Aulas</th>
              <th className="p-2 border-b border-r min-w-[160px]">Aprendizagem essencial</th>
              <th className="p-2 border-b border-r min-w-[200px]">Conteúdo / Objetivo</th>
              <th className="p-2 border-b border-r min-w-[220px]">Desenvolvimento / Metodologia</th>
              <th className="p-2 border-b border-r min-w-[140px]">Recursos</th>
              <th className="p-2 border-b border-r min-w-[140px]">Avaliação</th>
              <th className="p-2 border-b border-r w-32">Anexos</th>
              {!readOnly && <th className="p-2 border-b w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 9 : 10} className="text-center p-8 text-muted-foreground">
                  Nenhuma aula ainda. {!readOnly && 'Use "Adicionar aula" ou "Datas em sequência".'}
                </td>
              </tr>
            )}
            {linhas.map((l, i) => (
              <tr key={l.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="border-b border-r align-top p-1">
                  {readOnly ? <div className="px-2 py-1.5 text-xs">{fmtDataBR(l.data_aula)}</div> : (
                    <Input type="date" value={l.data_aula} onChange={(e) => atualizarLinha(l.id, { data_aula: e.target.value })} className="h-8 text-xs" />
                  )}
                </td>
                <td className="border-b border-r align-top px-2 py-2 text-xs text-muted-foreground">{diaDaSemanaISO(l.data_aula)}</td>
                <td className="border-b border-r align-top p-1">
                  {readOnly ? <div className="px-2 py-1.5 text-xs">{l.numero_aulas ?? ''}</div> : (
                    <Input type="number" min={1} value={l.numero_aulas ?? 1} onChange={(e) => atualizarLinha(l.id, { numero_aulas: Number(e.target.value) })} className="h-8 text-xs w-14" />
                  )}
                </td>
                <td className="border-b border-r align-top">
                  <CelulaEditavel value={l.aprendizagem_essencial ?? ''} onSave={(v) => atualizarLinha(l.id, { aprendizagem_essencial: v })} readOnly={readOnly} />
                </td>
                <td className="border-b border-r align-top">
                  <CelulaEditavel value={l.conteudo ?? ''} onSave={(v) => atualizarLinha(l.id, { conteudo: v })} readOnly={readOnly} />
                </td>
                <td className="border-b border-r align-top">
                  <CelulaEditavel value={l.desenvolvimento ?? ''} onSave={(v) => atualizarLinha(l.id, { desenvolvimento: v })} readOnly={readOnly} />
                </td>
                <td className="border-b border-r align-top">
                  <CelulaEditavel value={l.recursos ?? ''} onSave={(v) => atualizarLinha(l.id, { recursos: v })} readOnly={readOnly} />
                </td>
                <td className="border-b border-r align-top">
                  <CelulaEditavel value={l.avaliacao_aprendizagem ?? ''} onSave={(v) => atualizarLinha(l.id, { avaliacao_aprendizagem: v })} readOnly={readOnly} />
                </td>
                <td className="border-b border-r align-top p-1">
                  <div className="flex flex-col gap-1">
                    <AnexosLinha planoId={l.id} userId={l.user_id} tipo="documento" readOnly={readOnly} label="Documento" />
                    <AnexosLinha planoId={l.id} userId={l.user_id} tipo="adaptada" readOnly={readOnly} label="Adaptada" />
                  </div>
                </td>
                {!readOnly && (
                  <td className="border-b align-top p-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => duplicarLinha(l)}><Copy className="w-4 h-4 mr-2" /> Duplicar (próx. semana)</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {COLUNAS_COPIAVEIS.map(c => (
                          <DropdownMenuItem key={c.key} onClick={() => copiarParaBaixo(l, c.key as keyof LinhaAula)}>
                            <ArrowDown className="w-4 h-4 mr-2" /> Copiar {c.label} ↓
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setOpenAjuste(l)}><PenLine className="w-4 h-4 mr-2" /> Ajustar (PDCA)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => excluirLinha(l)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog: datas em sequência */}
      <DialogSequencia open={openSeq} onClose={() => setOpenSeq(false)} onConfirm={adicionarSequencia} />
      {/* Dialog: validação */}
      <DialogValidacao
        modo={openValidar}
        onClose={() => setOpenValidar(null)}
        onConfirm={async (obs) => {
          if (openValidar === 'validar') await mudarStatus('validado', obs);
          else if (openValidar === 'ajustes') await mudarStatus('rascunho', obs);
          else if (openValidar === 'reabrir') await mudarStatus('rascunho', obs);
          setOpenValidar(null);
        }}
      />
      {/* Dialog: ajuste por linha */}
      <DialogAjuste linha={openAjuste} onClose={() => setOpenAjuste(null)} />
    </div>
  );
}

function StatusBadge({ status }: { status: 'rascunho' | 'aguardando_validacao' | 'validado' }) {
  const map = {
    rascunho: 'bg-muted text-muted-foreground',
    aguardando_validacao: 'bg-amber-100 text-amber-800 border border-amber-300',
    validado: 'bg-green-100 text-green-800 border border-green-300',
  } as const;
  return <Badge className={map[status]}>{STATUS_LABEL[status]}</Badge>;
}

function DialogSequencia({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (i: string, f: string, dias: number[]) => Promise<void> }) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [dias, setDias] = useState<number[]>([1, 3]);
  const toggle = (d: number) => setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const DIAS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]] as const;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar várias datas</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>De</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
            <div><Label>Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-1 block">Dias da semana</Label>
            <div className="flex flex-wrap gap-1">
              {DIAS.map(([nome, num]) => (
                <button key={num} type="button" onClick={() => toggle(num as number)}
                  className={`px-3 py-1.5 rounded text-xs border ${dias.includes(num as number) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>
                  {nome}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => { await onConfirm(inicio, fim, dias); onClose(); }} disabled={!inicio || !fim || dias.length === 0}>Criar aulas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogValidacao({ modo, onClose, onConfirm }: { modo: null | 'validar' | 'ajustes' | 'reabrir'; onClose: () => void; onConfirm: (obs?: string) => Promise<void> }) {
  const [obs, setObs] = useState('');
  useEffect(() => { if (!modo) setObs(''); }, [modo]);
  if (!modo) return null;
  const titulo = modo === 'validar' ? 'Validar Planejamento' : modo === 'ajustes' ? 'Solicitar ajustes' : 'Reabrir planejamento';
  const obrigatorio = modo !== 'validar';
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Observação {obrigatorio ? '(obrigatória)' : '(opcional)'}</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={4} placeholder={modo === 'validar' ? 'Parabéns pelo planejamento…' : 'O que precisa ser ajustado?'} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(obs.trim() || undefined)} disabled={obrigatorio && !obs.trim()}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogAjuste({ linha, onClose }: { linha: LinhaAula | null; onClose: () => void }) {
  const [desc, setDesc] = useState('');
  const [hist, setHist] = useState<{ id: string; descricao: string; created_at: string }[]>([]);
  const { toast } = useToast();
  useEffect(() => {
    if (!linha) { setDesc(''); setHist([]); return; }
    api.get<typeof hist>(`/planos-aula/${linha.id}/ajustes`).then(setHist, () => setHist([]));
  }, [linha?.id]);
  if (!linha) return null;
  const salvar = async () => {
    if (!desc.trim()) return;
    try {
      await api.post(`/planos-aula/${linha.id}/ajustes`, { descricao: desc });
      toast({ title: 'Ajuste registrado' });
      onClose();
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajustar aula de {fmtDataBR(linha.data_aula)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Alteração realizada</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="O que foi ajustado nesta aula…" />
          </div>
          {hist.length > 0 && (
            <div>
              <Label>Histórico</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto mt-1">
                {hist.map(h => (
                  <div key={h.id} className="text-xs p-2 bg-muted/30 rounded">
                    <p className="text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                    <p>{h.descricao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={salvar} disabled={!desc.trim()}>Registrar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}