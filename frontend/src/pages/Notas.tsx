import React, { useState, useEffect, useCallback, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { api, mensagemDeErro } from '@/lib/api';
import { Plus, Trash2, Download, AlertCircle, FileSpreadsheet, Pencil, ChevronLeft, ChevronRight, Check, Clipboard, Info, Eye, Settings, RotateCcw } from 'lucide-react';
import { PageHeader, FilterBar, BadgeSituacao, LoadingSpinner } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDisciplinaDot } from '@/pages/Materias';
import { usePermissions } from '@/hooks/use-permissions';
import { exportTablePdf } from '@/lib/pdfHelpers';

interface TipoAvaliacao {
  id: string;
  nome: string;
  peso: number;
  bimestre: number;
  disciplina_id?: string;
  turma_id?: string;
  ordem: number;
}

interface AlunoNota {
  id: string;
  nome: string;
  numero_chamada: number;
  notas: Record<string, number | null>;
  media: number | null;
  situacao: string;
  notaArredondada: number | null;
  arredondadaManual: boolean;
}

type RoundingMode = 'none' | 'decimal' | 'half' | 'integer';

const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: 'Sem arredondamento',
  decimal: '1 casa decimal (ex: 6,75 → 6,8)',
  half: 'Meio ponto (ex: 6,75 → 7,0 / 6,3 → 6,5)',
  integer: 'Número inteiro (ex: 6,75 → 7)',
};

function arredondarMedia(media: number | null, mode: RoundingMode): number | null {
  if (media === null || media === undefined) return null;
  switch (mode) {
    case 'none':
      return Math.round(media * 100) / 100;
    case 'decimal':
      return Math.round(media * 10) / 10;
    case 'half':
      return Math.round(media * 2) / 2;
    case 'integer':
      return Math.round(media);
    default:
      return media;
  }
}

function formatNota(n: number | null, casas = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(casas).replace('.', ',');
}

const ROUNDING_STORAGE_KEY = 'notas:roundingMode';

const DISC_BG: Record<string, string> = {
  azul: 'bg-blue-500', roxo: 'bg-purple-500', verde: 'bg-green-500',
  vermelho: 'bg-red-500', laranja: 'bg-orange-500', rosa: 'bg-pink-500',
  amarelo: 'bg-yellow-500', ciano: 'bg-cyan-500', indigo: 'bg-indigo-500', cinza: 'bg-gray-500',
};

const DISC_BG_LIGHT: Record<string, string> = {
  azul: 'bg-blue-50 dark:bg-blue-950/30', roxo: 'bg-purple-50 dark:bg-purple-950/30', verde: 'bg-green-50 dark:bg-green-950/30',
  vermelho: 'bg-red-50 dark:bg-red-950/30', laranja: 'bg-orange-50 dark:bg-orange-950/30', rosa: 'bg-pink-50 dark:bg-pink-950/30',
  amarelo: 'bg-yellow-50 dark:bg-yellow-950/30', ciano: 'bg-cyan-50 dark:bg-cyan-950/30', indigo: 'bg-indigo-50 dark:bg-indigo-950/30', cinza: 'bg-gray-50 dark:bg-gray-950/30',
};

const DISC_TEXT: Record<string, string> = {
  azul: 'text-blue-700 dark:text-blue-300', roxo: 'text-purple-700 dark:text-purple-300', verde: 'text-green-700 dark:text-green-300',
  vermelho: 'text-red-700 dark:text-red-300', laranja: 'text-orange-700 dark:text-orange-300', rosa: 'text-pink-700 dark:text-pink-300',
  amarelo: 'text-yellow-700 dark:text-yellow-300', ciano: 'text-cyan-700 dark:text-cyan-300', indigo: 'text-indigo-700 dark:text-indigo-300', cinza: 'text-gray-700 dark:text-gray-300',
};

const DISC_BORDER: Record<string, string> = {
  azul: 'border-blue-500', roxo: 'border-purple-500', verde: 'border-green-500',
  vermelho: 'border-red-500', laranja: 'border-orange-500', rosa: 'border-pink-500',
  amarelo: 'border-yellow-500', ciano: 'border-cyan-500', indigo: 'border-indigo-500', cinza: 'border-gray-500',
};

function calcularMedia(notas: Record<string, number | null>, tipos: TipoAvaliacao[]): number | null {
  const validos = tipos.filter(t => notas[t.id] !== null && notas[t.id] !== undefined);
  if (validos.length === 0) return null;
  const totalPeso = validos.reduce((s, t) => s + t.peso, 0);
  const soma = validos.reduce((s, t) => s + (notas[t.id]! * t.peso), 0);
  return totalPeso > 0 ? soma / totalPeso : null;
}

function calcularSituacao(media: number | null): string {
  if (media === null) return '—';
  if (media >= 7) return 'Aprovado';
  if (media >= 5) return 'Recuperação';
  return 'Abaixo da média';
}

function gradeClass(nota: number | null): string {
  if (nota === null) return '';
  if (nota < 5) return 'text-red-600 dark:text-red-400';
  if (nota < 7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function recalcularAlunos(alunos: AlunoNota[], tipos: TipoAvaliacao[], mode: RoundingMode): AlunoNota[] {
  return alunos.map(a => {
    const media = calcularMedia(a.notas, tipos);
    const notaArredondada = a.arredondadaManual && a.notaArredondada !== null
      ? a.notaArredondada
      : arredondarMedia(media, mode);
    return { ...a, media, situacao: calcularSituacao(media), notaArredondada };
  });
}

function parseNota(raw: string): number | null {
  const cleaned = raw.replace(',', '.').trim();
  if (cleaned === '' || cleaned === '—' || cleaned === '-') return null;
  const val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  return Math.min(10, Math.max(0, Math.round(val * 10) / 10));
}

/** Aceita "1", "0,5", "0.5", "25%", "40 %", "2,5" etc. Retorna número (sem clamp) ou null. */
function parsePeso(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  const isPct = s.includes('%');
  s = s.replace('%', '').replace(',', '.').trim();
  const val = parseFloat(s);
  if (isNaN(val) || val <= 0) return null;
  const result = isPct ? val / 100 : val;
  return Math.round(result * 1000) / 1000; // 3 casas
}

/* ─── Inline column editor popover ─── */
function ColunaTipoEditor({
  tipo, cor, index, total,
  onUpdate, onDelete, onMove,
}: {
  tipo: TipoAvaliacao; cor: string; index: number; total: number;
  onUpdate: (id: string, nome: string, peso: number, provaPaulista: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(tipo.nome);
  const [pesoStr, setPesoStr] = useState(String(tipo.peso).replace('.', ','));
  const [provaPaulista, setProvaPaulista] = useState((tipo as any).categoria === 'prova_paulista');

  useEffect(() => {
    setNome(tipo.nome);
    setPesoStr(String(tipo.peso).replace('.', ','));
    setProvaPaulista((tipo as any).categoria === 'prova_paulista');
  }, [tipo]);

  const salvar = () => {
    if (!nome.trim()) return;
    const pesoNum = parsePeso(pesoStr);
    if (pesoNum === null) return;
    onUpdate(tipo.id, nome.trim(), pesoNum, provaPaulista);
    setOpen(false);
  };

  return (
    <th className={cn('px-2 py-2.5 text-center font-semibold border-b border-border min-w-[100px]', DISC_TEXT[cor])}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="group flex flex-col items-center w-full hover:opacity-80 transition-opacity">
            <span className="flex items-center gap-1">
              {tipo.nome}
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </span>
            {(tipo as any).categoria === 'prova_paulista' && (
              <span className="mt-0.5 px-1.5 py-px rounded-sm text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-300">
                Prova Paulista
              </span>
            )}
            <span className="text-xs font-normal opacity-60">Peso {tipo.peso}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-sm" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={pesoStr}
                onChange={e => setPesoStr(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } }}
                placeholder="Ex: 1, 2, 0,5 ou 25%"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Aceita números (1, 2, 0,5) ou porcentagem (25%, 40%).</p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs">
              <input
                type="checkbox"
                checked={provaPaulista}
                onChange={e => setProvaPaulista(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                <span className="font-semibold text-amber-800">Marcar como Prova Paulista</span>
                <span className="block text-[10px] text-amber-700/80">Inclui no painel da Prova Paulista sem alterar as notas já lançadas.</span>
              </span>
            </label>
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => { onMove(tipo.id, -1); setOpen(false); }}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1} onClick={() => { onMove(tipo.id, 1); setOpen(false); }}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { onDelete(tipo.id); setOpen(false); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" className="h-7 text-xs px-3" onClick={salvar}>
                  <Check className="w-3.5 h-3.5 mr-1" />Salvar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </th>
  );
}

/* ─── Spreadsheet Cell ─── */
function SpreadsheetCell({
  value, isFocused, onFocus, onCommit, onKeyDown, onPaste, inputRef, saving,
}: {
  value: number | null;
  isFocused: boolean;
  onFocus: () => void;
  onCommit: (val: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  inputRef: (el: HTMLInputElement | null) => void;
  saving: boolean;
}) {
  // Buffer local: permite digitar "7," ou "10" sem que o React force re-render
  // descartando caracteres parciais. Persiste no blur ou Enter/Tab/Setas.
  const [draft, setDraft] = React.useState<string>(value !== null && value !== undefined ? String(value).replace('.', ',') : '');

  React.useEffect(() => {
    setDraft(value !== null && value !== undefined ? String(value).replace('.', ',') : '');
  }, [value]);

  const commit = () => {
    const current = value !== null && value !== undefined ? String(value).replace('.', ',') : '';
    if (draft !== current) onCommit(draft);
  };

  return (
    <td className={cn(
      'px-0 py-0 text-center border border-border/30 relative transition-all',
      isFocused && 'ring-2 ring-primary ring-inset z-10'
    )}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={onFocus}
        onKeyDown={(e) => {
          // Persistir antes de navegar
          if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) commit();
          onKeyDown(e);
        }}
        onPaste={onPaste}
        className={cn(
          'w-full h-9 text-center text-sm font-semibold bg-transparent focus:outline-none focus:bg-background transition-colors',
          value !== null && value !== undefined ? gradeClass(value) : 'text-muted-foreground'
        )}
        placeholder="—"
      />
      {saving && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
    </td>
  );
}

export default function Notas() {
  const [turmas, setTurmas] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [filterTurma, setFilterTurma] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('');
  const [filterBimestre, setFilterBimestre] = useState('1');
  const [tiposAvaliacao, setTiposAvaliacao] = useState<TipoAvaliacao[]>([]);
  const [alunosNotas, setAlunosNotas] = useState<AlunoNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [dialogTipo, setDialogTipo] = useState(false);
  const [formTipo, setFormTipo] = useState<{ nome: string; pesoStr: string; provaPaulista: boolean }>({ nome: '', pesoStr: '1', provaPaulista: false });
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);
  const [pasteCount, setPasteCount] = useState(0);
  const [roundingMode, setRoundingMode] = useState<RoundingMode>(() => {
    if (typeof window === 'undefined') return 'half';
    const saved = window.localStorage.getItem(ROUNDING_STORAGE_KEY) as RoundingMode | null;
    return saved && ['none','decimal','half','integer'].includes(saved) ? saved : 'half';
  });
  const [dialogConfig, setDialogConfig] = useState(false);
  const [usarArredondadaParaSituacao, setUsarArredondadaParaSituacao] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('notas:situacaoArredondada') === '1';
  });
  const { toast } = useToast();
  const { userId, canEdit, readOnly } = usePermissions();

  useEffect(() => {
    window.localStorage.setItem(ROUNDING_STORAGE_KEY, roundingMode);
  }, [roundingMode]);

  useEffect(() => {
    window.localStorage.setItem('notas:situacaoArredondada', usarArredondadaParaSituacao ? '1' : '0');
  }, [usarArredondadaParaSituacao]);

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const tiposRef = useRef(tiposAvaliacao);
  tiposRef.current = tiposAvaliacao;
  const alunosRef = useRef(alunosNotas);
  alunosRef.current = alunosNotas;

  const getCellKey = (row: number, col: number) => `${row}-${col}`;
  const setCellRef = (row: number, col: number) => (el: HTMLInputElement | null) => {
    const key = getCellKey(row, col);
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  };

  const focusCellAt = useCallback((row: number, col: number) => {
    const maxRow = alunosRef.current.length - 1;
    const maxCol = tiposRef.current.length - 1;
    if (row < 0 || row > maxRow || col < 0 || col > maxCol) return;
    setFocusCell({ row, col });
    setTimeout(() => {
      const el = cellRefs.current.get(getCellKey(row, col));
      if (el) { el.focus(); el.select(); }
    }, 0);
  }, []);

  // Carrega apenas turmas onde o professor logado tem ao menos uma matéria vinculada
  useEffect(() => { if (userId) loadTurmas(); }, [userId, readOnly]);

  // Quando muda a turma, carrega APENAS as matérias vinculadas a essa turma para esse professor
  useEffect(() => {
    if (filterTurma && userId) loadDisciplinasDaTurma();
    else { setDisciplinas([]); setFilterDisciplina(''); }
  }, [filterTurma, userId, readOnly]);

  useEffect(() => { if (filterTurma && filterDisciplina) loadNotas(); else setAlunosNotas([]); }, [filterTurma, filterDisciplina, filterBimestre]);

  // Recalcula nota arredondada (não-manual) quando muda o modo de arredondamento
  useEffect(() => {
    setAlunosNotas(prev => prev.map(a => ({
      ...a,
      notaArredondada: a.arredondadaManual && a.notaArredondada !== null
        ? a.notaArredondada
        : arredondarMedia(a.media, roundingMode),
    })));
  }, [roundingMode]);

  async function loadTurmas() {
    if (readOnly) {
      // Gestão vê todas as turmas
      const t = await api.get<typeof turmas>('/turmas').catch(() => []);
      setTurmas(t);
      if (t.length && !filterTurma) setFilterTurma(t[0].id);
      return;
    }
    // Professor: apenas turmas em que tem matéria vinculada
    const [vinculos, minhasTurmas] = await Promise.all([
      api.get<{ turmas: unknown }[]>('/turma-disciplinas', { user_id: userId }).catch(() => []),
      api.get<typeof turmas>('/turmas').catch(() => []),
    ]);
    const turmasUnicas = new Map<string, any>();
    vinculos.forEach(v => {
      if (v.turmas) turmasUnicas.set((v.turmas as { id: string }).id, v.turmas);
    });
    // Inclui também as turmas personalizadas (eletivas) do professor
    minhasTurmas.filter(t => t.tipo === 'personalizada').forEach(t => turmasUnicas.set(t.id, t));
    const lista = Array.from(turmasUnicas.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    setTurmas(lista);
    if (lista.length && !filterTurma) setFilterTurma(lista[0].id);
    else if (!lista.length) setFilterTurma('');
  }

  async function loadDisciplinasDaTurma() {
    // Busca apenas as disciplinas vinculadas à turma selecionada para o professor logado
    // Professor: filtrar pelo seu user_id. Gestão: ver todos.
    const data = await api
      .get<{ disciplinas: { id: string } | null }[]>('/turma-disciplinas', { turma_id: filterTurma, user_id: readOnly ? undefined : userId })
      .catch(() => []);
    const disciplinasUnicas = new Map<string, any>();
    data.forEach(v => {
      if (v.disciplinas) disciplinasUnicas.set(v.disciplinas.id, v.disciplinas);
    });
    const lista = Array.from(disciplinasUnicas.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    setDisciplinas(lista);

    // Auto-selecionar única disciplina, ou limpar se não estiver mais disponível
    if (lista.length === 1) setFilterDisciplina(lista[0].id);
    else if (lista.length === 0) setFilterDisciplina('');
    else if (filterDisciplina && !lista.find(d => d.id === filterDisciplina)) setFilterDisciplina('');
  }

  async function loadNotas() {
    setLoading(true);
    setFocusCell(null);
    const turmaSel = turmas.find((t: any) => t.id === filterTurma);
    const isPersonalizada = (turmaSel as any)?.tipo === 'personalizada';
    const bimestre = parseInt(filterBimestre);
    let tiposArr: TipoAvaliacao[];
    let alunos: { id: string; nome: string; numero_chamada: number }[];
    let notasAll: any[] = [];
    let arredondadas: any[] = [];
    try {
      const tiposPromise = api.get<TipoAvaliacao[]>('/tipos-avaliacao', { turma_id: filterTurma, disciplina_id: filterDisciplina, bimestre });
      const alunosPromise = isPersonalizada
        ? api.get<any[]>(`/turmas/${filterTurma}/membros`, { ativo: true }).then(membros => membros
            .map((m: any) => m.alunos)
            .filter((a: any) => a && a.ativo)
            .sort((a: any, b: any) => (a.numero_chamada || 0) - (b.numero_chamada || 0)))
        : api.get<any[]>('/alunos', { turma_id: filterTurma, ativo: true, ordem: 'numero_chamada' });
      [tiposArr, alunos] = await Promise.all([tiposPromise, alunosPromise]);
      setTiposAvaliacao(tiposArr);
      if (!alunos.length) { setAlunosNotas([]); setLoading(false); return; }
      [notasAll, arredondadas] = await Promise.all([
        tiposArr.length ? api.get<any[]>('/notas', { bimestre, tipo_avaliacao_id: tiposArr.map(t => t.id) }) : Promise.resolve([]),
        // Notas arredondadas manuais salvas
        api.get<any[]>('/medias-arredondadas', { turma_id: filterTurma, disciplina_id: filterDisciplina, bimestre }),
      ]);
    } catch (err) {
      toast({ title: 'Erro ao carregar as notas', description: mensagemDeErro(err), variant: 'destructive' });
      setLoading(false);
      return;
    }

    const notasMap: Record<string, Record<string, number | null>> = {};
    alunos.forEach(a => { notasMap[a.id] = {}; });
    notasAll.forEach((n: any) => {
      if (notasMap[n.aluno_id]) notasMap[n.aluno_id][n.tipo_avaliacao_id] = n.nota;
    });

    const arredMap: Record<string, { nota: number; manual: boolean }> = {};
    arredondadas.forEach((r: any) => {
      arredMap[r.aluno_id] = { nota: Number(r.nota_arredondada), manual: !!r.manual };
    });

    const result: AlunoNota[] = alunos.map(a => {
      const notas = notasMap[a.id] || {};
      const media = calcularMedia(notas, tiposArr);
      const saved = arredMap[a.id];
      const notaArredondada = saved ? saved.nota : arredondarMedia(media, roundingMode);
      return {
        ...a,
        notas,
        media,
        situacao: calcularSituacao(media),
        notaArredondada,
        arredondadaManual: saved ? saved.manual : false,
      };
    });
    setAlunosNotas(result);
    setLoading(false);
  }

  /** Grava várias notas num pedido só (tudo ou nada); `nota: null` apaga. */
  const persistNotas = useCallback(async (itens: { alunoId: string; tipoId: string; nota: number | null }[]) => {
    if (!canEdit || !userId || !itens.length) return;
    const marcar = (valor: boolean) => setSaving(s => {
      const next = { ...s };
      itens.forEach(i => { next[`${i.alunoId}-${i.tipoId}`] = valor; });
      return next;
    });
    marcar(true);
    try {
      await api.put('/notas', { notas: itens.map(i => ({ aluno_id: i.alunoId, tipo_avaliacao_id: i.tipoId, nota: i.nota })) });
    } catch (err) {
      toast({ title: 'Nota não salva', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      marcar(false);
    }
  }, [canEdit, userId, toast]);

  const persistNota = useCallback(
    (alunoId: string, tipoId: string, nota: number | null) => persistNotas([{ alunoId, tipoId, nota }]),
    [persistNotas],
  );

  const handleCellChange = useCallback((rowIdx: number, colIdx: number, rawValue: string) => {
    const nota = parseNota(rawValue);
    const aluno = alunosRef.current[rowIdx];
    const tipo = tiposRef.current[colIdx];
    if (!aluno || !tipo) return;

    setAlunosNotas(prev => prev.map((a, i) => {
      if (i !== rowIdx) return a;
      const novas = { ...a.notas, [tipo.id]: nota };
      const media = calcularMedia(novas, tiposRef.current);
      const notaArredondada = a.arredondadaManual && a.notaArredondada !== null
        ? a.notaArredondada
        : arredondarMedia(media, roundingMode);
      return { ...a, notas: novas, media, situacao: calcularSituacao(media), notaArredondada };
    }));

    persistNota(aluno.id, tipo.id, nota);
  }, [persistNota, roundingMode]);

  const handleCellKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const maxRow = alunosRef.current.length - 1;
    const maxCol = tiposRef.current.length - 1;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        focusCellAt(Math.min(row + 1, maxRow), col);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) focusCellAt(row, col - 1);
          else if (row > 0) focusCellAt(row - 1, maxCol);
        } else {
          if (col < maxCol) focusCellAt(row, col + 1);
          else if (row < maxRow) focusCellAt(row + 1, 0);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusCellAt(Math.min(row + 1, maxRow), col);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusCellAt(Math.max(row - 1, 0), col);
        break;
      case 'ArrowRight':
        if ((e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
          e.preventDefault();
          focusCellAt(row, Math.min(col + 1, maxCol));
        }
        break;
      case 'ArrowLeft':
        if ((e.target as HTMLInputElement).selectionStart === 0) {
          e.preventDefault();
          focusCellAt(row, Math.max(col - 1, 0));
        }
        break;
      case 'Escape':
        (e.target as HTMLInputElement).blur();
        setFocusCell(null);
        break;
    }
  }, [focusCellAt]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const rows = text.split(/\r?\n/).filter(r => r.trim() !== '');
    // If only one value, let the default input behavior handle it
    if (rows.length === 1 && !rows[0].includes('\t')) return;

    e.preventDefault();

    const maxRow = alunosRef.current.length;
    const maxCol = tiposRef.current.length;
    let count = 0;
    let invalidos = 0;
    let foraDoLimite = 0;
    let sobrescritas = 0;
    const updates: { rowIdx: number; colIdx: number; nota: number | null }[] = [];

    rows.forEach((rowStr, ri) => {
      const cells = rowStr.split('\t');
      cells.forEach((cellStr, ci) => {
        const r = startRow + ri;
        const c = startCol + ci;
        if (r >= maxRow || c >= maxCol) { foraDoLimite++; return; }
        const trimmed = cellStr.trim();
        if (trimmed === '') return; // célula vazia: ignora, NÃO apaga existente
        const nota = parseNota(trimmed);
        if (nota === null && trimmed !== '—' && trimmed !== '-') { invalidos++; return; }
        const aluno = alunosRef.current[r];
        const tipo = tiposRef.current[c];
        if (aluno && tipo) {
          const atual = aluno.notas[tipo.id];
          if (atual !== null && atual !== undefined && atual !== nota) sobrescritas++;
        }
        updates.push({ rowIdx: r, colIdx: c, nota });
        count++;
      });
    });

    if (updates.length === 0) {
      toast({ title: 'Nada para colar', description: invalidos > 0 ? `${invalidos} valor(es) inválido(s).` : 'Verifique o conteúdo copiado.', variant: 'destructive' });
      return;
    }

    // Confirmação ao sobrescrever notas existentes
    if (sobrescritas > 0) {
      const ok = window.confirm(
        `Esta colagem irá substituir ${sobrescritas} nota(s) já lançada(s).\n\nDeseja continuar?\n\n(As demais avaliações e notas de outros alunos NÃO serão alteradas.)`
      );
      if (!ok) return;
    }

    // Apply all at once
    setAlunosNotas(prev => {
      const copy = [...prev];
      updates.forEach(({ rowIdx, colIdx, nota }) => {
        const aluno = copy[rowIdx];
        const tipo = tiposRef.current[colIdx];
        if (!aluno || !tipo) return;
        const novas = { ...aluno.notas, [tipo.id]: nota };
        const media = calcularMedia(novas, tiposRef.current);
        copy[rowIdx] = { ...aluno, notas: novas, media, situacao: calcularSituacao(media) };
      });
      return copy;
    });

    // Persist all (num pedido só)
    persistNotas(updates.flatMap(({ rowIdx, colIdx, nota }) => {
      const aluno = alunosRef.current[rowIdx];
      const tipo = tiposRef.current[colIdx];
      return aluno && tipo ? [{ alunoId: aluno.id, tipoId: tipo.id, nota }] : [];
    }));

    setPasteCount(count);
    // Aviso de quantidade copiada x alunos visíveis (apenas para coluna única)
    const linhasColadas = rows.length;
    const alunosRestantes = maxRow - startRow;
    const isColunaUnica = !rows.some(r => r.includes('\t'));
    let aviso = '';
    if (isColunaUnica) {
      if (linhasColadas > alunosRestantes) {
        aviso = ` ⚠ ${linhasColadas - alunosRestantes} nota(s) excederam a lista e foram ignoradas.`;
      } else if (linhasColadas < alunosRestantes && startRow === 0) {
        aviso = ` ℹ Você colou ${linhasColadas} nota(s) para ${alunosRestantes} aluno(s).`;
      }
    }
    if (invalidos > 0) aviso += ` ${invalidos} valor(es) inválido(s) ignorado(s).`;
    if (foraDoLimite > 0 && !isColunaUnica) aviso += ` ${foraDoLimite} célula(s) fora do limite.`;
    toast({
      title: `${count} nota(s) colada(s) com sucesso!`,
      description: (sobrescritas > 0 ? `${sobrescritas} nota(s) substituída(s).` : 'Notas distribuídas em ordem.') + aviso,
    });
  }, [persistNotas, toast]);

  async function adicionarTipoAvaliacao() {
    if (!formTipo.nome.trim() || !canEdit || !userId) return;
    const peso = parsePeso(formTipo.pesoStr);
    if (peso === null) {
      toast({ title: 'Peso inválido', description: 'Digite um número (ex: 1, 2, 0,5) ou porcentagem (25%).', variant: 'destructive' });
      return;
    }
    try {
      await api.post('/tipos-avaliacao', {
        nome: formTipo.nome.trim(), peso, bimestre: parseInt(filterBimestre),
        disciplina_id: filterDisciplina, turma_id: filterTurma, ordem: tiposAvaliacao.length + 1,
        categoria: formTipo.provaPaulista ? 'prova_paulista' : 'normal',
      });
    } catch (err) {
      toast({ title: 'Erro ao adicionar a avaliação', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    setDialogTipo(false);
    setFormTipo({ nome: '', pesoStr: '1', provaPaulista: false });
    loadNotas();
    toast({ title: 'Avaliação adicionada!' });
  }

  async function atualizarTipo(id: string, nome: string, peso: number, provaPaulista: boolean) {
    const categoria = provaPaulista ? 'prova_paulista' : 'normal';
    try {
      await api.patch(`/tipos-avaliacao/${id}`, { nome, peso, categoria });
    } catch (err) {
      toast({ title: 'Erro ao atualizar a avaliação', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    setTiposAvaliacao(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, nome, peso, categoria } as any : t);
      setAlunosNotas(old => recalcularAlunos(old, updated, roundingMode));
      return updated;
    });
    toast({ title: 'Avaliação atualizada!' });
  }

  async function moverTipo(id: string, dir: -1 | 1) {
    const idx = tiposAvaliacao.findIndex(t => t.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= tiposAvaliacao.length) return;
    const copy = [...tiposAvaliacao];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    const updates = copy.map((t, i) => ({ ...t, ordem: i + 1 }));
    setTiposAvaliacao(updates);
    try {
      await api.put('/tipos-avaliacao/ordem', { ids: updates.map(t => t.id) });
    } catch (err) {
      toast({ title: 'Erro ao reordenar', description: mensagemDeErro(err), variant: 'destructive' });
      loadNotas();
    }
  }

  async function removerTipo(id: string) {
    if (!confirm('Remover esta avaliação? As notas serão excluídas.')) return;
    try {
      await api.delete(`/tipos-avaliacao/${id}`);
    } catch (err) {
      toast({ title: 'Erro ao remover a avaliação', description: mensagemDeErro(err), variant: 'destructive' });
    }
    loadNotas();
  }

  /** Persiste nota arredondada manual no banco. Se nota === null, remove (volta ao automático). */
  async function persistArredondada(alunoId: string, nota: number | null, manual: boolean) {
    if (!canEdit || !userId) return;
    try {
      // `null` volta ao cálculo automático (apaga o ajuste).
      await api.put('/medias-arredondadas', {
        turma_id: filterTurma,
        disciplina_id: filterDisciplina,
        bimestre: parseInt(filterBimestre),
        medias: [{ aluno_id: alunoId, nota_arredondada: nota, manual }],
      });
    } catch (err) {
      toast({ title: 'Média não salva', description: mensagemDeErro(err), variant: 'destructive' });
    }
  }

  /** Handler de edição manual da nota arredondada. */
  function handleArredondadaChange(alunoId: string, raw: string) {
    if (!canEdit) return;
    const trimmed = raw.trim();
    const aluno = alunosRef.current.find(a => a.id === alunoId);
    if (!aluno) return;

    if (trimmed === '' || trimmed === '—' || trimmed === '-') {
      // Limpou: volta para o cálculo automático
      const auto = arredondarMedia(aluno.media, roundingMode);
      setAlunosNotas(prev => prev.map(a => a.id === alunoId
        ? { ...a, notaArredondada: auto, arredondadaManual: false }
        : a));
      persistArredondada(alunoId, null, false);
      return;
    }
    const nota = parseNota(trimmed);
    if (nota === null) return;
    setAlunosNotas(prev => prev.map(a => a.id === alunoId
      ? { ...a, notaArredondada: nota, arredondadaManual: true }
      : a));
    persistArredondada(alunoId, nota, true);
  }

  /** Reaplica o arredondamento automático em todos os alunos (descarta sobrescritas manuais). */
  async function resetArredondamentoManual() {
    if (!confirm('Descartar todas as notas arredondadas editadas manualmente nesta planilha?\n\nA média original NÃO será afetada.')) return;
    const idsManuais = alunosRef.current.filter(a => a.arredondadaManual).map(a => a.id);
    if (!idsManuais.length) {
      toast({ title: 'Nada a fazer', description: 'Nenhuma nota arredondada foi editada manualmente.' });
      return;
    }
    try {
      await api.post('/medias-arredondadas/descartar', {
        turma_id: filterTurma,
        disciplina_id: filterDisciplina,
        bimestre: parseInt(filterBimestre),
        aluno_ids: idsManuais,
      });
    } catch (err) {
      toast({ title: 'Erro ao descartar', description: mensagemDeErro(err), variant: 'destructive' });
      return;
    }
    setAlunosNotas(prev => prev.map(a => ({
      ...a,
      arredondadaManual: false,
      notaArredondada: arredondarMedia(a.media, roundingMode),
    })));
    toast({ title: 'Arredondamentos manuais descartados', description: `${idsManuais.length} aluno(s) voltaram ao cálculo automático.` });
  }

  function exportarCSV() {
    const header = ['Nº', 'Nome', ...tiposAvaliacao.map(t => t.nome), 'Média Final', 'Nota Arredondada', 'Situação'].join(',');
    const rows = alunosNotas.map(a =>
      [a.numero_chamada, `"${a.nome}"`, ...tiposAvaliacao.map(t => a.notas[t.id] ?? ''), a.media?.toFixed(2) ?? '', a.notaArredondada ?? '', a.situacao].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `notas_${discAtual?.nome || 'geral'}_${filterBimestre}bim.csv`; link.click();
  }

  function exportarExcel() {
    const discNome = discAtual?.nome || '';
    const turmaNome = turmaAtual?.nome || '';
    const header = `Notas - ${discNome} - ${turmaNome} - ${filterBimestre}º Bimestre\n\n`;
    const cols = ['Nº', 'Nome', ...tiposAvaliacao.map(t => `${t.nome} (Peso ${t.peso})`), 'Média Final', 'Nota Arredondada', 'Situação'].join('\t');
    const rows = alunosNotas.map(a =>
      [a.numero_chamada, a.nome, ...tiposAvaliacao.map(t => a.notas[t.id] ?? ''), a.media?.toFixed(2) ?? '', a.notaArredondada ?? '', a.situacao].join('\t')
    );
    const avgRow = ['', 'Média da Turma', ...tiposAvaliacao.map(tipo => {
      const vals = alunosNotas.map(a => a.notas[tipo.id]).filter(v => v !== null && v !== undefined) as number[];
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '';
    }), (() => {
      const medias = alunosNotas.map(a => a.media).filter(m => m !== null) as number[];
      return medias.length ? (medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(2) : '';
    })(), (() => {
      const arred = alunosNotas.map(a => a.notaArredondada).filter(m => m !== null) as number[];
      return arred.length ? (arred.reduce((a, b) => a + b, 0) / arred.length).toFixed(2) : '';
    })(), ''].join('\t');

    const content = header + [cols, ...rows, '', avgRow].join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `notas_${discNome}_${filterBimestre}bim.xls`; link.click();
  }

  function exportarPDF() {
    const discNome = discAtual?.nome || 'Disciplina';
    const turmaNome = turmaAtual?.nome || 'Turma';
    const cols = ['Nº', 'Nome', ...tiposAvaliacao.map(t => `${t.nome}\n(P${t.peso})`), 'Média', 'Arred.', 'Situação'];
    const rows = alunosNotas.map(a => [
      a.numero_chamada, a.nome,
      ...tiposAvaliacao.map(t => a.notas[t.id] ?? ''),
      a.media?.toFixed(2) ?? '', a.notaArredondada ?? '', a.situacao,
    ]);
    exportTablePdf({
      title: `Notas — ${discNome}`,
      subtitle: `${turmaNome} · ${filterBimestre}º Bimestre`,
      columns: cols, rows,
      filename: `notas_${discNome}_${turmaNome}_${filterBimestre}bim.pdf`.replace(/\s+/g, '_'),
      orientation: 'landscape',
    });
  }


  const turmaAtual = turmas.find(t => t.id === filterTurma);
  const discAtual = disciplinas.find(d => d.id === filterDisciplina);
  const cor = discAtual?.cor || 'azul';

  // Situação: pode usar a média original ou a arredondada (configurável)
  const mediaParaSituacao = (a: AlunoNota): number | null =>
    usarArredondadaParaSituacao && a.notaArredondada !== null ? a.notaArredondada : a.media;
  const abaixoMedia = alunosNotas.filter(a => { const m = mediaParaSituacao(a); return m !== null && m < 5; }).length;
  const emRecuperacao = alunosNotas.filter(a => { const m = mediaParaSituacao(a); return m !== null && m >= 5 && m < 7; }).length;
  const aprovados = alunosNotas.filter(a => { const m = mediaParaSituacao(a); return m !== null && m >= 7; }).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Lançamento de Notas" subtitle={readOnly ? 'Modo gestão — visualizando notas dos professores' : 'Planilha de notas — use Tab, Enter, setas e cole notas do Excel'}>
        <div className="flex items-center gap-2">
          {readOnly && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"><Eye className="w-3 h-3" /> Somente leitura</span>}
          <Button variant="outline" size="sm" onClick={() => setDialogConfig(true)}>
            <Settings className="w-4 h-4 mr-1.5" />Arredondamento
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCSV}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportarExcel}><FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" onClick={exportarPDF}><Download className="w-4 h-4 mr-1.5" />Gerar PDF</Button>
          {canEdit && <Button size="sm" onClick={() => setDialogTipo(true)}><Plus className="w-4 h-4 mr-1.5" />Nova Avaliação</Button>}
        </div>
      </PageHeader>

      <FilterBar>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue placeholder="Turma" /></SelectTrigger>
          <SelectContent>
            {turmas.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma turma vinculada</div>
            ) : turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDisciplina} onValueChange={setFilterDisciplina} disabled={!filterTurma || disciplinas.length === 0}>
          <SelectTrigger className="w-48 h-8 text-sm bg-background"><SelectValue placeholder="Disciplina" /></SelectTrigger>
          <SelectContent>
            {disciplinas.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma matéria vinculada a esta turma</div>
            ) : disciplinas.map(d => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full', getDisciplinaDot(d.cor))} />
                  {d.nome}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBimestre} onValueChange={setFilterBimestre}>
          <SelectTrigger className="w-36 h-8 text-sm bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1º Bimestre</SelectItem>
            <SelectItem value="2">2º Bimestre</SelectItem>
            <SelectItem value="3">3º Bimestre</SelectItem>
            <SelectItem value="4">4º Bimestre</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {/* Discipline header banner */}
      {filterTurma && filterDisciplina && (
        <div className={cn('rounded-xl p-4 mb-4 border-2 flex items-center justify-between flex-wrap gap-3', DISC_BG_LIGHT[cor], DISC_BORDER[cor])}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg', DISC_BG[cor])}>
              {discAtual?.nome?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className={cn('text-lg font-bold', DISC_TEXT[cor])}>{discAtual?.nome}</h2>
              <p className="text-xs text-muted-foreground">{turmaAtual?.nome} · {filterBimestre}º Bimestre · {tiposAvaliacao.length} avaliações</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {alunosNotas.length > 0 && (
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="text-green-600 dark:text-green-400">✓ {aprovados} aprovados</span>
                <span className="text-yellow-600 dark:text-yellow-400">⚠ {emRecuperacao} recuperação</span>
                <span className="text-red-600 dark:text-red-400">✗ {abaixoMedia} abaixo</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paste tip */}
      {filterTurma && filterDisciplina && tiposAvaliacao.length > 0 && alunosNotas.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1 text-xs text-muted-foreground">
          <Clipboard className="w-3.5 h-3.5" />
          <span>
            <strong>Dica:</strong> Copie notas do Excel e cole diretamente na célula — as notas serão distribuídas automaticamente.
            Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono mx-0.5">Tab</kbd> 
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono mx-0.5">Enter</kbd> 
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono mx-0.5">↑↓←→</kbd> para navegar.
          </span>
        </div>
      )}

      {!filterTurma || !filterDisciplina ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-xl">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
          {turmas.length === 0 ? (
            <>
              <p className="text-muted-foreground font-medium">Nenhuma turma vinculada a você</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Vá até <strong>Matérias</strong> e vincule as suas matérias às turmas em que você leciona.</p>
            </>
          ) : filterTurma && disciplinas.length === 0 ? (
            <>
              <p className="text-muted-foreground font-medium">Nenhuma matéria vinculada a esta turma para este professor</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Vá até <strong>Matérias</strong> para vincular suas matérias a esta turma.</p>
            </>
          ) : (
            <p className="text-muted-foreground">Selecione a turma e a disciplina para visualizar as notas</p>
          )}
        </div>
      ) : loading ? <LoadingSpinner /> : (
        <div className={cn('bg-card border-2 rounded-xl shadow-card overflow-hidden', DISC_BORDER[cor])}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={cn(DISC_BG_LIGHT[cor])}>
                  <th className={cn('sticky left-0 z-20 px-3 py-2.5 text-left font-semibold border-b border-border w-8', DISC_BG_LIGHT[cor], DISC_TEXT[cor])}>Nº</th>
                  <th className={cn('sticky left-8 z-20 px-3 py-2.5 text-left font-semibold border-b border-border min-w-[180px]', DISC_BG_LIGHT[cor], DISC_TEXT[cor])}>Nome do Aluno</th>
                  {tiposAvaliacao.map((t, i) => (
                    <ColunaTipoEditor
                      key={t.id}
                      tipo={t}
                      cor={cor}
                      index={i}
                      total={tiposAvaliacao.length}
                      onUpdate={atualizarTipo}
                      onDelete={removerTipo}
                      onMove={moverTipo}
                    />
                  ))}
                  <th className={cn('px-3 py-2.5 text-center font-bold border-b border-border min-w-[80px]', DISC_BG[cor], 'text-white')}>
                    Média Final
                    <div className="text-[9px] font-normal opacity-80">(real / fracionada)</div>
                  </th>
                  <th className={cn('px-3 py-2.5 text-center font-bold border-b border-border min-w-[110px]', DISC_BG[cor], 'text-white border-l border-white/30')}>
                    Nota Arredondada
                    <div className="text-[9px] font-normal opacity-80">{ROUNDING_LABELS[roundingMode].split(' (')[0].toLowerCase()}</div>
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground border-b border-border min-w-[130px]">Situação</th>
                </tr>
              </thead>
              <tbody>
                {alunosNotas.length === 0 ? (
                  <tr><td colSpan={tiposAvaliacao.length + 5} className="py-12 text-center text-muted-foreground">Nenhum aluno nesta turma</td></tr>
                ) : alunosNotas.map((aluno, rowIdx) => {
                  const isLow = aluno.media !== null && aluno.media < 5;
                  return (
                    <tr key={aluno.id} className={cn(
                      'transition-colors',
                      rowIdx % 2 === 0 ? '' : 'bg-muted/10',
                      isLow && 'bg-red-50/50 dark:bg-red-950/20'
                    )}>
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 font-mono text-xs text-muted-foreground border-b border-border/40">{aluno.numero_chamada}</td>
                      <td className={cn('sticky left-8 z-10 bg-inherit px-3 py-1.5 font-medium border-b border-border/40', isLow && 'text-red-600 dark:text-red-400')}>
                        {aluno.nome}
                        {isLow && <span className="ml-1.5 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">⚠</span>}
                      </td>
                      {tiposAvaliacao.map((tipo, colIdx) => {
                        const savingKey = `${aluno.id}-${tipo.id}`;
                        return (
                          <SpreadsheetCell
                            key={tipo.id}
                            value={aluno.notas[tipo.id] ?? null}
                            isFocused={focusCell?.row === rowIdx && focusCell?.col === colIdx}
                            onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
                            onCommit={(val) => canEdit && handleCellChange(rowIdx, colIdx, val)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            onPaste={(e) => canEdit && handlePaste(e, rowIdx, colIdx)}
                            inputRef={setCellRef(rowIdx, colIdx)}
                            saving={!!saving[savingKey]}
                          />
                        );
                      })}
                      <td className={cn('px-3 py-1.5 text-center font-bold text-base border-b border-border/40', DISC_BG_LIGHT[cor], aluno.media !== null ? gradeClass(aluno.media) : 'text-muted-foreground')}>
                        {aluno.media !== null ? aluno.media.toFixed(2) : '—'}
                      </td>
                      <td className={cn(
                        'px-1 py-1 text-center border-b border-border/40 border-l border-border/40',
                        aluno.arredondadaManual && 'bg-amber-50 dark:bg-amber-950/30',
                      )}>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!canEdit || aluno.media === null}
                            value={aluno.notaArredondada !== null ? String(aluno.notaArredondada).replace('.', ',') : ''}
                            onChange={e => {
                              const v = e.target.value;
                              setAlunosNotas(prev => prev.map(a => a.id === aluno.id
                                ? { ...a, notaArredondada: v === '' ? null : parseNota(v), arredondadaManual: true }
                                : a));
                            }}
                            onBlur={e => handleArredondadaChange(aluno.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            placeholder={aluno.media !== null ? formatNota(arredondarMedia(aluno.media, roundingMode), roundingMode === 'integer' ? 0 : 1) : '—'}
                            className={cn(
                              'w-full h-9 text-center text-base font-bold bg-transparent focus:outline-none focus:bg-background rounded transition-colors',
                              aluno.notaArredondada !== null ? gradeClass(aluno.notaArredondada) : 'text-muted-foreground',
                            )}
                            title={aluno.arredondadaManual ? 'Editado manualmente — apague para voltar ao automático' : 'Calculado automaticamente'}
                          />
                          {aluno.arredondadaManual && (
                            <span
                              className="absolute -top-0.5 -right-0.5 text-[9px] bg-amber-500 text-white px-1 rounded-full font-bold leading-tight"
                              title="Editado manualmente"
                            >
                              M
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-border/40">
                        {(() => {
                          const m = mediaParaSituacao(aluno);
                          if (m === null) return <span className="text-xs text-muted-foreground">—</span>;
                          return <BadgeSituacao situacao={calcularSituacao(m)} />;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {alunosNotas.length > 0 && (
                <tfoot>
                  <tr className={cn(DISC_BG_LIGHT[cor])}>
                    <td className={cn('sticky left-0', DISC_BG_LIGHT[cor])} />
                    <td className={cn('sticky left-8 px-3 py-2 text-xs font-bold', DISC_BG_LIGHT[cor], DISC_TEXT[cor])}>Média da Turma</td>
                    {tiposAvaliacao.map(tipo => {
                      const vals = alunosNotas.map(a => a.notas[tipo.id]).filter(v => v !== null && v !== undefined) as number[];
                      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      return (
                        <td key={tipo.id} className={cn('px-2 py-2 text-center text-xs font-bold border border-border/30', DISC_TEXT[cor])}>
                          {avg !== null ? avg.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                    <td className={cn('px-3 py-2 text-center text-sm font-bold', DISC_BG[cor], 'text-white')}>
                      {(() => {
                        const medias = alunosNotas.map(a => a.media).filter(m => m !== null) as number[];
                        return medias.length ? (medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(2) : '—';
                      })()}
                    </td>
                    <td className={cn('px-3 py-2 text-center text-sm font-bold border-l border-white/30', DISC_BG[cor], 'text-white')}>
                      {(() => {
                        const arred = alunosNotas.map(a => a.notaArredondada).filter(m => m !== null) as number[];
                        return arred.length ? (arred.reduce((a, b) => a + b, 0) / arred.length).toFixed(2).replace('.', ',') : '—';
                      })()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogTipo} onOpenChange={setDialogTipo}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Avaliação</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome da avaliação *</Label>
              <Input placeholder="Ex: Prova, Trabalho, Projeto, Participação..." value={formTipo.nome} onChange={e => setFormTipo({ ...formTipo, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Peso (para média ponderada)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 1, 2, 0,5 ou 25%"
                value={formTipo.pesoStr}
                onChange={e => setFormTipo({ ...formTipo, pesoStr: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarTipoAvaliacao(); } }}
              />
              <p className="text-[11px] text-muted-foreground">Aceita números (1, 2, 0,5) ou porcentagem (25%, 40%).</p>
            </div>
            <label className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={formTipo.provaPaulista}
                onChange={e => setFormTipo({ ...formTipo, provaPaulista: e.target.checked })}
              />
              <div className="text-xs leading-snug">
                <span className="font-semibold">Marcar como Prova Paulista</span>
                <p className="text-muted-foreground">Aparece no painel exclusivo da Prova Paulista para acompanhar a evolução dos alunos por bimestre.</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTipo(false)}>Cancelar</Button>
            <Button onClick={adicionarTipoAvaliacao}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de configuração de arredondamento */}
      <Dialog open={dialogConfig} onOpenChange={setDialogConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuração de Arredondamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Tipo de arredondamento da nota final</Label>
              <RadioGroup value={roundingMode} onValueChange={(v) => setRoundingMode(v as RoundingMode)}>
                {(['none', 'decimal', 'half', 'integer'] as RoundingMode[]).map(mode => (
                  <label
                    key={mode}
                    htmlFor={`mode-${mode}`}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      roundingMode === mode ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <RadioGroupItem value={mode} id={`mode-${mode}`} className="mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium">{ROUNDING_LABELS[mode].split(' (')[0]}</div>
                      {ROUNDING_LABELS[mode].includes('(') && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {ROUNDING_LABELS[mode].match(/\((.+)\)/)?.[1]}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="border-t pt-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarArredondadaParaSituacao}
                  onChange={e => setUsarArredondadaParaSituacao(e.target.checked)}
                  className="mt-1"
                />
                <div className="text-sm">
                  <div className="font-medium">Usar nota arredondada para definir a situação</div>
                  <div className="text-xs text-muted-foreground">
                    Quando marcado, "Aprovado / Recuperação / Abaixo" usa a coluna arredondada em vez da média original.
                  </div>
                </div>
              </label>
            </div>

            <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Como funciona</p>
              <p className="text-muted-foreground">• A coluna <strong>Média Final</strong> mantém o valor exato/fracionado.</p>
              <p className="text-muted-foreground">• A coluna <strong>Nota Arredondada</strong> aplica a regra escolhida.</p>
              <p className="text-muted-foreground">• Você pode <strong>editar manualmente</strong> a nota arredondada (fica destacada em amarelo com "M").</p>
              <p className="text-muted-foreground">• Para voltar ao automático, apague a nota da célula manual.</p>
            </div>

            {canEdit && alunosNotas.some(a => a.arredondadaManual) && (
              <Button variant="outline" size="sm" onClick={resetArredondamentoManual} className="w-full">
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Descartar todas as edições manuais ({alunosNotas.filter(a => a.arredondadaManual).length})
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogConfig(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
