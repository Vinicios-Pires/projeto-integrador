import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, QrCode, ScanLine, Download, Printer, FileText, Eye } from 'lucide-react';
import { PageHeader, LoadingSpinner } from '@/components/ui-escola';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { ProvaFormDialog } from '@/components/correcao/ProvaFormDialog';
import { GabaritoEditor } from '@/components/correcao/GabaritoEditor';
import { FolhaRespostasTemplate } from '@/components/correcao/FolhaRespostasTemplate';
import { EscaneamentoDialog } from '@/components/correcao/EscaneamentoDialog';
import { ResultadosTable } from '@/components/correcao/ResultadosTable';

const DEFAULT_FORM = {
  turma_id: '', disciplina_id: '', bimestre: 1,
  titulo: '', numero_questoes: 10, data_aplicacao: new Date().toISOString().split('T')[0],
  valor_total: 10, observacoes: '', escola: '', professor: '',
};

export default function CorrecaoProvas() {
  const [provas, setProvas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [selectedProva, setSelectedProva] = useState<any>(null);
  const [gabarito, setGabarito] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<Record<string, Record<number, string>>>({});
  const [loading, setLoading] = useState(false);
  const [dialogProva, setDialogProva] = useState(false);
  const [dialogScan, setDialogScan] = useState(false);
  const [formProva, setFormProva] = useState({ ...DEFAULT_FORM });
  const [gabForm, setGabForm] = useState<Record<number, string>>({});
  const [anuladas, setAnuladas] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { userId, canEdit, readOnly } = usePermissions();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedProva) loadProvaDetails(); }, [selectedProva]);

  async function loadData() {
    const [{ data: p }, { data: t }, { data: d }] = await Promise.all([
      supabase.from('provas').select('*, turmas(nome), disciplinas(nome)').order('created_at', { ascending: false }),
      supabase.from('turmas').select('id, nome').order('nome'),
      supabase.from('disciplinas').select('id, nome').order('nome'),
    ]);
    setProvas(p || []);
    setTurmas(t || []);
    setDisciplinas(d || []);
  }

  async function loadProvaDetails() {
    if (!selectedProva) return;
    setLoading(true);
    const [{ data: gab }, { data: al }, { data: res }] = await Promise.all([
      supabase.from('gabaritos').select('*').eq('prova_id', selectedProva.id).order('numero_questao'),
      supabase.from('alunos').select('id, nome, numero_chamada').eq('turma_id', selectedProva.turma_id).eq('ativo', true).order('numero_chamada'),
      supabase.from('resultados_prova').select('*').eq('prova_id', selectedProva.id),
    ]);
    setGabarito(gab || []);
    setAlunos(al || []);
    const gabMap: Record<number, string> = {};
    (gab || []).forEach((g: any) => { gabMap[g.numero_questao] = g.resposta_correta; });
    setGabForm(gabMap);
    const anuladasList: number[] = (gab || []).filter((g: any) => g.anulada).map((g: any) => g.numero_questao);
    setAnuladas(anuladasList);
    const resMap: Record<string, Record<number, string>> = {};
    (res || []).forEach((r: any) => { resMap[r.aluno_id] = r.respostas || {}; });
    setRespostas(resMap);
    setLoading(false);
  }

  async function salvarGabarito() {
    if (!selectedProva || !canEdit) return;
    const questoes = Array.from({ length: selectedProva.numero_questoes }, (_, i) => i + 1);
    const upserts = questoes.map(q => ({
      prova_id: selectedProva.id,
      numero_questao: q,
      resposta_correta: gabForm[q] || 'A',
      anulada: anuladas.includes(q),
      peso: 1.0,
    }));
    const { error } = await (supabase as any).from('gabaritos').upsert(upserts, { onConflict: 'prova_id,numero_questao' });
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Gabarito salvo com sucesso!' });
    loadProvaDetails();
  }

  async function criarProva() {
    if (!canEdit || !userId) return;
    setSaving(true);
    const { data, error } = await supabase.from('provas').insert({
      turma_id: formProva.turma_id || null,
      disciplina_id: formProva.disciplina_id || null,
      bimestre: formProva.bimestre,
      titulo: formProva.titulo,
      numero_questoes: formProva.numero_questoes,
      data_aplicacao: formProva.data_aplicacao || null,
      observacoes: formProva.observacoes || null,
      user_id: userId,
    }).select().single();
    setSaving(false);
    setDialogProva(false);
    if (error) { toast({ title: 'Erro ao criar prova', description: error.message, variant: 'destructive' }); return; }
    if (data) {
      await loadData();
      setSelectedProva({ ...data, turmas: turmas.find(t => t.id === formProva.turma_id), disciplinas: disciplinas.find(d => d.id === formProva.disciplina_id) });
    }
    setFormProva({ ...DEFAULT_FORM });
    toast({ title: 'Prova criada!', description: 'Agora configure o gabarito e imprima as folhas.' });
  }

  async function salvarResultadoEscaneamento(alunoId: string, respostasAluno: Record<number, string>, nota: number, acertos: number) {
    if (!canEdit || !userId) return;
    const { error } = await (supabase as any).from('resultados_prova').upsert(
      { prova_id: selectedProva.id, aluno_id: alunoId, respostas: respostasAluno, acertos, nota, user_id: userId },
      { onConflict: 'prova_id,aluno_id' }
    );
    if (error) { toast({ title: 'Erro ao salvar resultado', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Nota ${nota.toFixed(1)} lançada!` });
    setRespostas(r => ({ ...r, [alunoId]: respostasAluno }));
  }

  function exportarCSV() {
    if (!selectedProva || alunos.length === 0) return;
    const questoes = Array.from({ length: selectedProva.numero_questoes }, (_, i) => i + 1);
    const header = ['Nº Chamada', 'Nome', ...questoes.map(q => `Q${q}`), 'Acertos', 'Nota', 'Situação'];
    const rows = alunos.map(a => {
      const resAl = respostas[a.id] || {};
      let acertos = 0;
      questoes.forEach(q => { if (anuladas.includes(q) || resAl[q] === gabForm[q]) acertos++; });
      const nota = questoes.length > 0 ? (acertos / questoes.length) * (selectedProva.valor_total || 10) : 0;
      const temResp = questoes.some(q => resAl[q]);
      const situacao = !temResp ? 'Pendente' : nota >= (selectedProva.valor_total * 0.7) ? 'Aprovado' : nota >= (selectedProva.valor_total * 0.5) ? 'Recuperação' : 'Reprovado';
      return [a.numero_chamada, a.nome, ...questoes.map(q => resAl[q] || ''), acertos, nota.toFixed(1), situacao];
    });
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultados_${selectedProva.titulo.replace(/\s+/g, '_')}.csv`;
    link.click();
  }

  const questoes = selectedProva ? Array.from({ length: selectedProva.numero_questoes }, (_, i) => i + 1) : [];
  const turmaNome = selectedProva?.turmas?.nome || turmas.find(t => t.id === selectedProva?.turma_id)?.nome || '';
  const disciplinaNome = selectedProva?.disciplinas?.nome || disciplinas.find(d => d.id === selectedProva?.disciplina_id)?.nome || '';

  return (
    <div className="animate-fade-in">
      <PageHeader title="Correção de Provas" subtitle={readOnly ? 'Modo gestão — visualização' : 'Sistema de correção automática por QR Code'}>
        {readOnly && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"><Eye className="w-3 h-3" /> Somente leitura</span>
        )}
        {!readOnly && selectedProva && (
          <Button size="sm" variant="outline" onClick={() => setDialogScan(true)} className="gap-1.5">
            <ScanLine className="w-4 h-4" />Escanear Folha
          </Button>
        )}
        {!readOnly && (
          <Button size="sm" onClick={() => setDialogProva(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />Nova Prova
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lista de provas */}
        <div className="bg-card border border-border rounded-xl shadow-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Provas Cadastradas</h2>
            <p className="text-xs text-muted-foreground">{provas.length} prova{provas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-border/50">
            {provas.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Nenhuma prova criada</p>
            ) : provas.map(p => (
              <button key={p.id} onClick={() => setSelectedProva(p)}
                className={cn('w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors',
                  selectedProva?.id === p.id ? 'bg-primary/5 border-l-2 border-primary' : '')}>
                <div className="flex items-start gap-2">
                  <QrCode className={cn('w-4 h-4 mt-0.5 flex-shrink-0', selectedProva?.id === p.id ? 'text-primary' : 'text-muted-foreground/50')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground">{p.turmas?.nome} · {p.bimestre}º Bim</p>
                    <p className="text-xs text-muted-foreground">{p.numero_questoes} questões · Valor: {p.valor_total || 10} pts</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detalhes */}
        <div className="lg:col-span-3">
          {!selectedProva ? (
            <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-xl text-center gap-3">
              <QrCode className="w-16 h-16 text-muted-foreground/20" />
              <div>
                <p className="font-medium text-foreground">Selecione ou crie uma prova</p>
                <p className="text-sm text-muted-foreground mt-1">Cada prova terá um QR Code único para escaneamento automático</p>
              </div>
              <Button size="sm" onClick={() => setDialogProva(true)} className="mt-2 gap-1.5">
                <Plus className="w-4 h-4" />Criar Primeira Prova
              </Button>
            </div>
          ) : loading ? <LoadingSpinner /> : (
            <Tabs defaultValue="gabarito">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h2 className="font-bold text-foreground">{selectedProva.titulo}</h2>
                  <p className="text-xs text-muted-foreground">{turmaNome} · {disciplinaNome} · {selectedProva.bimestre}º Bimestre</p>
                </div>
                <TabsList className="h-8">
                  <TabsTrigger value="gabarito" className="text-xs px-3">Gabarito</TabsTrigger>
                  <TabsTrigger value="folha" className="text-xs px-3">Folha de Respostas</TabsTrigger>
                  <TabsTrigger value="resultados" className="text-xs px-3">Resultados</TabsTrigger>
                </TabsList>
              </div>

              {/* Gabarito */}
              <TabsContent value="gabarito" className="mt-0">
                <GabaritoEditor
                  questoes={questoes}
                  gabForm={gabForm}
                  anuladas={anuladas}
                  onSelectAlt={(q, alt) => setGabForm(g => ({ ...g, [q]: alt }))}
                  onToggleAnulada={(q) => setAnuladas(a => a.includes(q) ? a.filter(x => x !== q) : [...a, q])}
                  onSave={salvarGabarito}
                  valorTotal={selectedProva.valor_total || 10}
                />
                {/* QR Code da prova */}
                <div className="mt-4 bg-card border border-border rounded-xl p-4 flex items-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG
                      value={JSON.stringify({ id: selectedProva.id, titulo: selectedProva.titulo, turma: turmaNome, questoes: selectedProva.numero_questoes })}
                      size={100}
                      level="M"
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground font-semibold">QR Code Único da Prova</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Como funciona:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Configure o gabarito acima e salve</li>
                      <li>Vá em "Folha de Respostas" e imprima para toda a turma</li>
                      <li>Os alunos preenchem nome, nº chamada e respostas</li>
                      <li>Use "Escanear Folha" para corrigir automaticamente</li>
                      <li>O QR Code identifica a prova; o nº chamada identifica o aluno</li>
                    </ol>
                  </div>
                </div>
              </TabsContent>

              {/* Folha de Respostas para impressão */}
              <TabsContent value="folha" className="mt-0">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-sm">Modelo Único de Folha de Respostas</h3>
                      <p className="text-xs text-muted-foreground">Imprima este modelo para todos os alunos. O QR Code identifica a prova automaticamente.</p>
                    </div>
                  </div>
                  <FolhaRespostasTemplate
                    prova={{ ...selectedProva, escola: selectedProva.escola, professor: selectedProva.professor, valor_total: selectedProva.valor_total || 10 }}
                    turmaNome={turmaNome}
                    disciplinaNome={disciplinaNome}
                  />
                </div>
              </TabsContent>

              {/* Resultados */}
              <TabsContent value="resultados" className="mt-0">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-muted-foreground">{alunos.filter(a => respostas[a.id] && Object.keys(respostas[a.id]).length > 0).length} de {alunos.length} alunos lançados</p>
                  <Button size="sm" onClick={() => setDialogScan(true)} className="gap-1.5 h-8">
                    <ScanLine className="w-3.5 h-3.5" />Escanear Folha
                  </Button>
                </div>
                <ResultadosTable
                  alunos={alunos}
                  gabarito={gabForm}
                  anuladas={anuladas}
                  respostas={respostas}
                  questoes={questoes}
                  valorTotal={selectedProva.valor_total || 10}
                  onSalvarAluno={() => {}}
                  onExportar={exportarCSV}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <ProvaFormDialog
        open={dialogProva}
        onOpenChange={setDialogProva}
        form={formProva}
        onChange={setFormProva}
        onSave={criarProva}
        saving={saving}
        turmas={turmas}
        disciplinas={disciplinas}
      />

      {selectedProva && (
        <EscaneamentoDialog
          open={dialogScan}
          onOpenChange={setDialogScan}
          provas={provas}
          alunos={alunos}
          gabarito={gabForm}
          anuladas={anuladas}
          valorTotal={selectedProva?.valor_total || 10}
          onSalvar={salvarResultadoEscaneamento}
        />
      )}
    </div>
  );
}
