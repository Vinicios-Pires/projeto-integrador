import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useAgenda, useGradeHorario, resolveAula, type BlocoHorario, type RotinaItem } from '@/hooks/use-agenda';
import { PageHeader } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getDisciplinaBg, getDisciplinaDot } from '@/pages/Materias';
import { ChevronLeft, ChevronRight, CalendarDays, Settings2, Building2, UserCheck, Printer, Plus, Trash2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_UTEIS = [1, 2, 3, 4, 5];
const TIPO_EVENTO_LABEL: Record<string, string> = {
  reuniao: 'Reunião', formacao: 'Formação', evento: 'Evento', avaliacao_externa: 'Avaliação Externa',
  conselho: 'Conselho de Classe', apoio_presencial: 'Apoio Presencial', acompanhamento: 'Acompanhamento',
  observacao: 'Observação Pedagógica', visita: 'Visita', aviso: 'Aviso',
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function fmtBR(d: Date) { return d.toLocaleDateString('pt-BR'); }

export default function Agenda() {
  const { isGestao } = usePermissions();
  return (
    <div className="space-y-4">
      <PageHeader title="Agenda Escolar" subtitle="Sua rotina, agenda da escola e apoios presenciais" />
      <Tabs defaultValue="minha">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="minha"><CalendarDays className="w-4 h-4 mr-1" /> Minha Agenda</TabsTrigger>
          <TabsTrigger value="rotina"><Settings2 className="w-4 h-4 mr-1" /> Configurar Rotina</TabsTrigger>
          <TabsTrigger value="escola"><Building2 className="w-4 h-4 mr-1" /> Agenda da Escola</TabsTrigger>
          <TabsTrigger value="apoio"><UserCheck className="w-4 h-4 mr-1" /> Apoio Presencial</TabsTrigger>
        </TabsList>
        <TabsContent value="minha"><MinhaAgenda /></TabsContent>
        <TabsContent value="rotina"><ConfigurarRotina /></TabsContent>
        <TabsContent value="escola"><AgendaEscola podeEditar={isGestao} /></TabsContent>
        <TabsContent value="apoio"><ApoioPresencialPanel podeEditar={isGestao} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ===================== MINHA AGENDA ===================== */
function MinhaAgenda() {
  const grade = useGradeHorario();
  const { rotina, excecoes, eventos, apoios } = useAgenda();
  const [view, setView] = useState<'dia' | 'semana' | 'mes' | 'ano'>('semana');
  const [ref, setRef] = useState(new Date());
  const [openCell, setOpenCell] = useState<{ data: Date; bloco: BlocoHorario } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['dia','semana','mes','ano'] as const).map(v => (
            <Button key={v} size="sm" variant={view===v?'default':'outline'} onClick={() => setView(v)}>
              {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : 'Ano'}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <Button size="icon" variant="outline" onClick={() => {
            const step = view==='dia'?1:view==='semana'?7:view==='mes'?30:365;
            setRef(addDays(ref, -step));
          }}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setRef(new Date())}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => {
            const step = view==='dia'?1:view==='semana'?7:view==='mes'?30:365;
            setRef(addDays(ref, step));
          }}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {view === 'semana' && <GradeSemanal grade={grade} rotina={rotina} excecoes={excecoes} refDate={ref} onClickCell={(data, bloco) => setOpenCell({ data, bloco })} eventos={eventos} apoios={apoios} />}
      {view === 'dia' && <VisaoDia grade={grade} rotina={rotina} excecoes={excecoes} data={ref} onClickCell={(data, bloco) => setOpenCell({ data, bloco })} eventos={eventos} apoios={apoios} />}
      {view === 'mes' && <VisaoMes refDate={ref} eventos={eventos} apoios={apoios} rotina={rotina} excecoes={excecoes} onSelectDay={(d) => { setRef(d); setView('dia'); }} />}
      {view === 'ano' && <VisaoAno refDate={ref} eventos={eventos} apoios={apoios} onSelectMonth={(d) => { setRef(d); setView('mes'); }} />}

      {openCell && (
        <PainelAula
          data={openCell.data}
          bloco={openCell.bloco}
          rotina={rotina}
          excecoes={excecoes}
          onClose={() => setOpenCell(null)}
        />
      )}
    </div>
  );
}

/* ===================== GRADE SEMANAL ===================== */
function GradeSemanal({ grade, rotina, excecoes, refDate, onClickCell, eventos, apoios }: any) {
  const inicio = startOfWeek(refDate);
  const dias = DIAS_UTEIS.map(i => addDays(inicio, i - 1));
  const [disciplinas, setDisciplinas] = useState<Record<string, any>>({});
  const [turmas, setTurmas] = useState<Record<string, any>>({});
  useEffect(() => {
    Promise.all([
      supabase.from('disciplinas').select('id,nome,cor'),
      supabase.from('turmas').select('id,nome'),
    ]).then(([d, t]) => {
      setDisciplinas(Object.fromEntries((d.data || []).map((x: any) => [x.id, x])));
      setTurmas(Object.fromEntries((t.data || []).map((x: any) => [x.id, x])));
    });
  }, []);

  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <div className="text-sm font-medium px-4 py-2 border-b bg-muted/30">
        Semana de {fmtBR(inicio)} a {fmtBR(addDays(inicio, 4))}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="p-2 text-left border-r w-32">Horário</th>
            {dias.map(d => (
              <th key={d.toISOString()} className="p-2 text-left border-r min-w-[140px]">
                <div className="font-semibold">{DIAS[d.getDay()]}</div>
                <div className="text-muted-foreground">{fmtBR(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grade.map((b: BlocoHorario) => (
            <tr key={b.id} className="border-t">
              <td className="p-2 border-r bg-muted/20">
                <div className="font-semibold">{b.rotulo}</div>
                <div className="text-muted-foreground">{b.hora_inicio.slice(0,5)} - {b.hora_fim.slice(0,5)}</div>
              </td>
              {dias.map(d => {
                const aula = resolveAula(rotina, excecoes, d, b.id);
                const isNaoAula = b.tipo !== 'aula';
                if (isNaoAula && !aula) {
                  return (
                    <td key={d.toISOString()} className="p-2 border-r bg-muted/10 text-muted-foreground italic">
                      {b.rotulo}
                    </td>
                  );
                }
                if (!aula) {
                  return (
                    <td key={d.toISOString()} className="p-1 border-r">
                      <button onClick={() => onClickCell(d, b)} className="w-full h-full min-h-[44px] rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/30 text-xs">
                        + adicionar
                      </button>
                    </td>
                  );
                }
                const disc = aula.disciplina_id ? disciplinas[aula.disciplina_id] : null;
                const turma = aula.turma_id ? turmas[aula.turma_id] : null;
                return (
                  <td key={d.toISOString()} className="p-1 border-r">
                    <button onClick={() => onClickCell(d, b)} className={`w-full text-left p-2 rounded border ${disc ? getDisciplinaBg(disc.cor) : 'bg-muted/30'}`}>
                      {aula.fonte === 'excecao' && aula.cancelado && <Badge variant="destructive" className="mb-1 text-[10px]">Cancelada</Badge>}
                      <div className="font-semibold truncate">{disc?.nome || aula.atividade || '—'}</div>
                      {turma && <div className="text-muted-foreground truncate">{turma.nome}</div>}
                      {aula.fonte === 'excecao' && <div className="text-[10px] text-amber-700">alterada</div>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== VISÃO DIA ===================== */
function VisaoDia({ grade, rotina, excecoes, data, onClickCell, eventos, apoios }: any) {
  const [disciplinas, setDisciplinas] = useState<Record<string, any>>({});
  const [turmas, setTurmas] = useState<Record<string, any>>({});
  useEffect(() => {
    Promise.all([
      supabase.from('disciplinas').select('id,nome,cor'),
      supabase.from('turmas').select('id,nome'),
    ]).then(([d, t]) => {
      setDisciplinas(Object.fromEntries((d.data || []).map((x: any) => [x.id, x])));
      setTurmas(Object.fromEntries((t.data || []).map((x: any) => [x.id, x])));
    });
  }, []);
  const iso = fmtDate(data);
  const eventosDia = eventos.filter((e: any) => e.data_inicio.slice(0,10) === iso);
  const apoiosDia = apoios.filter((a: any) => a.data === iso);

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">{DIAS[data.getDay()]}, {fmtBR(data)}</div>
      {(eventosDia.length > 0 || apoiosDia.length > 0) && (
        <div className="border rounded-lg p-3 bg-amber-50 border-amber-200 space-y-1">
          {eventosDia.map((e: any) => (
            <div key={e.id} className="text-sm"><Badge variant="outline" className="mr-2">{TIPO_EVENTO_LABEL[e.tipo]}</Badge>{e.titulo}</div>
          ))}
          {apoiosDia.map((a: any) => (
            <div key={a.id} className="text-sm"><Badge variant="outline" className="mr-2">Apoio Presencial</Badge>{a.observacao || '—'}</div>
          ))}
        </div>
      )}
      <div className="border rounded-lg divide-y bg-card">
        {grade.map((b: BlocoHorario) => {
          const aula = resolveAula(rotina, excecoes, data, b.id);
          const disc = aula?.disciplina_id ? disciplinas[aula.disciplina_id] : null;
          const turma = aula?.turma_id ? turmas[aula.turma_id] : null;
          return (
            <button key={b.id} onClick={() => onClickCell(data, b)} className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30">
              <div className="w-24 text-xs text-muted-foreground">{b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</div>
              <div className={`flex-1 rounded p-2 ${disc ? getDisciplinaBg(disc.cor) : 'bg-muted/20'}`}>
                <div className="font-semibold text-sm">{disc?.nome || aula?.atividade || b.rotulo}</div>
                {turma && <div className="text-xs text-muted-foreground">{turma.nome}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== VISÃO MÊS ===================== */
function VisaoMes({ refDate: ref, eventos, apoios, rotina, excecoes, onSelectDay }: any) {
  const ano = ref.getFullYear(), mes = ref.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const inicioGrid = addDays(primeiro, -((primeiro.getDay() + 6) % 7));
  const dias: Date[] = [];
  for (let i = 0; i < 42; i++) dias.push(addDays(inicioGrid, i));

  return (
    <div>
      <div className="text-lg font-semibold mb-2 capitalize">
        {primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border border rounded-lg overflow-hidden">
        {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
          <div key={d} className="bg-muted/50 p-2 text-xs font-semibold text-center">{d}</div>
        ))}
        {dias.map(d => {
          const iso = fmtDate(d);
          const ev = eventos.filter((e: any) => e.data_inicio.slice(0,10) === iso);
          const ap = apoios.filter((a: any) => a.data === iso);
          const inMonth = d.getMonth() === mes;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const hasRotina = !isWeekend && rotina.some((r: any) => r.dia_semana === d.getDay());
          return (
            <button
              key={iso}
              onClick={() => onSelectDay(d)}
              className={`bg-card min-h-[80px] p-1 text-left text-xs ${inMonth ? '' : 'opacity-40'} hover:bg-muted/30`}
            >
              <div className="font-semibold mb-1">{d.getDate()}</div>
              {hasRotina && <div className="text-[10px] text-muted-foreground">aulas</div>}
              {ev.slice(0,2).map((e: any) => (
                <div key={e.id} className="truncate bg-primary/10 text-primary rounded px-1 mb-0.5">{e.titulo}</div>
              ))}
              {ap.length > 0 && <div className="truncate bg-amber-100 text-amber-800 rounded px-1">Apoio ({ap.length})</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== VISÃO ANO ===================== */
function VisaoAno({ refDate: ref, eventos, apoios, onSelectMonth }: any) {
  const ano = ref.getFullYear();
  return (
    <div>
      <div className="text-lg font-semibold mb-3">{ano}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, m) => {
          const primeiro = new Date(ano, m, 1);
          const ultimo = new Date(ano, m + 1, 0);
          const inicioGrid = addDays(primeiro, -((primeiro.getDay() + 6) % 7));
          const eventosMes = eventos.filter((e: any) => new Date(e.data_inicio).getMonth() === m && new Date(e.data_inicio).getFullYear() === ano);
          const apoiosMes = apoios.filter((a: any) => new Date(a.data).getMonth() === m && new Date(a.data).getFullYear() === ano);
          return (
            <button key={m} onClick={() => onSelectMonth(primeiro)} className="border rounded-lg p-2 bg-card hover:bg-muted/20 text-left">
              <div className="font-semibold text-sm mb-1 capitalize">{primeiro.toLocaleDateString('pt-BR', { month: 'long' })}</div>
              <div className="grid grid-cols-7 gap-0.5 text-[10px]">
                {['S','T','Q','Q','S','S','D'].map((d,i) => <div key={i} className="text-center text-muted-foreground">{d}</div>)}
                {Array.from({ length: 42 }).map((_, i) => {
                  const d = addDays(inicioGrid, i);
                  const inMonth = d.getMonth() === m;
                  const iso = fmtDate(d);
                  const hasEv = eventos.some((e: any) => e.data_inicio.slice(0,10) === iso);
                  const hasAp = apoios.some((a: any) => a.data === iso);
                  return (
                    <div key={i} className={`text-center rounded ${inMonth ? '' : 'opacity-30'} ${hasEv ? 'bg-primary/20 text-primary font-semibold' : hasAp ? 'bg-amber-100' : ''}`}>
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{eventosMes.length} eventos · {apoiosMes.length} apoios</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== PAINEL DA AULA (clique) ===================== */
function PainelAula({ data, bloco, rotina, excecoes, onClose }: any) {
  const { user } = useAuth();
  const { refetch } = useAgenda();
  const { toast } = useToast();
  const aula = resolveAula(rotina, excecoes, data, bloco.id);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [plano, setPlano] = useState<any>(null);
  const [disciplinaId, setDisciplinaId] = useState<string>(aula?.disciplina_id || '');
  const [turmaId, setTurmaId] = useState<string>(aula?.turma_id || '');
  const [atividade, setAtividade] = useState<string>(aula?.atividade || '');
  const [recorrencia, setRecorrencia] = useState<'data' | 'futuro' | 'rotina'>('data');

  useEffect(() => {
    Promise.all([
      supabase.from('disciplinas').select('id,nome,cor').order('nome'),
      supabase.from('turmas').select('id,nome').order('nome'),
    ]).then(([d, t]) => { setDisciplinas(d.data || []); setTurmas(t.data || []); });
    if (aula?.turma_id && aula?.disciplina_id) {
      supabase.from('planos_aula').select('id,status,data_aula')
        .eq('turma_id', aula.turma_id).eq('disciplina_id', aula.disciplina_id)
        .eq('data_aula', fmtDate(data)).maybeSingle()
        .then(({ data: p }) => setPlano(p));
    }
  }, []);

  const salvar = async () => {
    if (!user) return;
    const payload = {
      disciplina_id: disciplinaId || null,
      turma_id: turmaId || null,
      atividade: atividade || null,
    };
    if (recorrencia === 'rotina') {
      const existing = rotina.find((r: any) => r.dia_semana === data.getDay() && r.horario_grade_id === bloco.id);
      if (existing) {
        await supabase.from('agenda_professor').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('agenda_professor').insert({ ...payload, user_id: user.id, dia_semana: data.getDay(), horario_grade_id: bloco.id });
      }
    } else if (recorrencia === 'data') {
      const existing = excecoes.find((e: any) => e.data === fmtDate(data) && e.horario_grade_id === bloco.id);
      if (existing) {
        await supabase.from('agenda_excecoes').update({ ...payload, cancelado: false }).eq('id', existing.id);
      } else {
        await supabase.from('agenda_excecoes').insert({ ...payload, user_id: user.id, data: fmtDate(data), horario_grade_id: bloco.id });
      }
    } else {
      // futuro: criar exceções para todas as ocorrências do dia da semana até fim do ano
      const fim = new Date(data.getFullYear(), 11, 31);
      const datas: string[] = [];
      for (let d = new Date(data); d <= fim; d = addDays(d, 7)) datas.push(fmtDate(d));
      const rows = datas.map(dt => ({ ...payload, user_id: user.id, data: dt, horario_grade_id: bloco.id, cancelado: false }));
      await supabase.from('agenda_excecoes').upsert(rows, { onConflict: 'user_id,data,horario_grade_id' });
    }
    toast({ title: 'Aula salva' });
    refetch();
    onClose();
  };

  const cancelarAula = async () => {
    if (!user) return;
    const existing = excecoes.find((e: any) => e.data === fmtDate(data) && e.horario_grade_id === bloco.id);
    if (existing) await supabase.from('agenda_excecoes').update({ cancelado: true }).eq('id', existing.id);
    else await supabase.from('agenda_excecoes').insert({ user_id: user.id, data: fmtDate(data), horario_grade_id: bloco.id, cancelado: true });
    toast({ title: 'Aula cancelada nesta data' });
    refetch();
    onClose();
  };

  const statusPlano = plano ? plano.status : 'sem-plano';
  const statusLabel = { 'sem-plano': 'Sem plano', pendente: 'Pendente', aprovado: 'Aprovado', ajustado: 'Ajustado' } as any;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{DIAS[data.getDay()]}, {fmtBR(data)} · {bloco.rotulo} ({bloco.hora_inicio.slice(0,5)}–{bloco.hora_fim.slice(0,5)})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Disciplina</Label>
            <Select value={disciplinaId} onValueChange={setDisciplinaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {disciplinas.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getDisciplinaDot(d.cor)}`} />{d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Atividade (livre)</Label>
            <Input value={atividade} onChange={e => setAtividade(e.target.value)} placeholder="Ex: ATPC, planejamento..." />
          </div>
          <div>
            <Label>Aplicar em</Label>
            <Select value={recorrencia} onValueChange={(v: any) => setRecorrencia(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="data">Apenas esta data</SelectItem>
                <SelectItem value="futuro">Desta data em diante</SelectItem>
                <SelectItem value="rotina">Rotina semanal fixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {aula?.disciplina_id && aula?.turma_id && (
            <div className="border rounded p-2 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Plano de Aula</div>
              <div className="flex items-center justify-between">
                <Badge variant={statusPlano === 'aprovado' ? 'default' : 'outline'}>{statusLabel[statusPlano]}</Badge>
                <Link to="/plano-aula" className="text-xs text-primary underline flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {plano ? 'Ver/Editar plano' : 'Criar plano'}
                </Link>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={cancelarAula}>Cancelar esta aula</Button>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== CONFIGURAR ROTINA ===================== */
function ConfigurarRotina() {
  const { user } = useAuth();
  const { toast } = useToast();
  const grade = useGradeHorario();
  const { rotina, refetch } = useAgenda();
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('disciplinas').select('id,nome,cor').order('nome'),
      supabase.from('turmas').select('id,nome').order('nome'),
    ]).then(([d, t]) => { setDisciplinas(d.data || []); setTurmas(t.data || []); });
  }, []);

  const get = (dia: number, horarioId: string) =>
    rotina.find(r => r.dia_semana === dia && r.horario_grade_id === horarioId);

  const set = async (dia: number, horarioId: string, patch: Partial<RotinaItem>) => {
    if (!user) return;
    const existing = get(dia, horarioId);
    if (existing) {
      await supabase.from('agenda_professor').update(patch).eq('id', existing.id);
    } else {
      await supabase.from('agenda_professor').insert({
        user_id: user.id, dia_semana: dia, horario_grade_id: horarioId, ...patch,
      });
    }
    refetch();
  };

  const limpar = async (dia: number, horarioId: string) => {
    const existing = get(dia, horarioId);
    if (existing) {
      await supabase.from('agenda_professor').delete().eq('id', existing.id);
      refetch();
    }
  };

  const replicarSegunda = async () => {
    if (!user) return;
    const base = rotina.filter(r => r.dia_semana === 1);
    for (const dia of [2, 3, 4, 5]) {
      for (const b of base) {
        const ex = get(dia, b.horario_grade_id);
        const payload = { disciplina_id: b.disciplina_id, turma_id: b.turma_id, atividade: b.atividade };
        if (ex) await supabase.from('agenda_professor').update(payload).eq('id', ex.id);
        else await supabase.from('agenda_professor').insert({ ...payload, user_id: user.id, dia_semana: dia, horario_grade_id: b.horario_grade_id });
      }
    }
    toast({ title: 'Segunda replicada para a semana' });
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Defina sua rotina semanal uma única vez. O sistema replica para o ano todo.
          Use a aba <strong>Minha Agenda</strong> para alterar aulas pontuais.
        </p>
        <Button size="sm" variant="outline" onClick={replicarSegunda}>Replicar segunda para a semana</Button>
      </div>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left border-r w-32">Horário</th>
              {DIAS_UTEIS.map(i => <th key={i} className="p-2 text-left border-r min-w-[180px]">{DIAS[i]}</th>)}
            </tr>
          </thead>
          <tbody>
            {grade.map(b => (
              <tr key={b.id} className="border-t">
                <td className="p-2 border-r bg-muted/20">
                  <div className="font-semibold">{b.rotulo}</div>
                  <div className="text-muted-foreground">{b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</div>
                </td>
                {DIAS_UTEIS.map(dia => {
                  const r = get(dia, b.id);
                  const isAula = b.tipo === 'aula';
                  return (
                    <td key={dia} className="p-1 border-r align-top">
                      {isAula ? (
                        <div className="space-y-1">
                          <Select value={r?.disciplina_id || ''} onValueChange={v => set(dia, b.id, { disciplina_id: v || null })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Disciplina" /></SelectTrigger>
                            <SelectContent>{disciplinas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={r?.turma_id || ''} onValueChange={v => set(dia, b.id, { turma_id: v || null })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Turma" /></SelectTrigger>
                            <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                          </Select>
                          {r && <Button size="sm" variant="ghost" className="h-6 w-full text-[10px] text-destructive" onClick={() => limpar(dia, b.id)}>limpar</Button>}
                        </div>
                      ) : (
                        <Input
                          className="h-8 text-xs"
                          placeholder={b.rotulo}
                          defaultValue={r?.atividade || ''}
                          onBlur={e => set(dia, b.id, { atividade: e.target.value || null })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== AGENDA DA ESCOLA ===================== */
function AgendaEscola({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ titulo: '', descricao: '', tipo: 'aviso', data_inicio: '', data_fim: '', dia_todo: false });

  const load = () => supabase.from('agenda_escola_eventos').select('*').order('data_inicio', { ascending: false }).then(({ data }) => setItems(data || []));
  useEffect(() => { load(); }, []);

  const salvar = async () => {
    if (!user || !form.titulo || !form.data_inicio) { toast({ title: 'Preencha título e data' }); return; }
    await supabase.from('agenda_escola_eventos').insert({
      criado_por: user.id, titulo: form.titulo, descricao: form.descricao || null,
      tipo: form.tipo, data_inicio: form.data_inicio, data_fim: form.data_fim || null, dia_todo: form.dia_todo,
    });
    toast({ title: 'Evento criado' });
    setOpen(false); setForm({ titulo: '', descricao: '', tipo: 'aviso', data_inicio: '', data_fim: '', dia_todo: false });
    load();
  };

  const remover = async (id: string) => {
    await supabase.from('agenda_escola_eventos').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{podeEditar ? 'Crie reuniões, formações, eventos e avisos para todos os professores.' : 'Eventos cadastrados pela gestão.'}</p>
        {podeEditar && <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Novo evento</Button>}
      </div>
      <div className="border rounded-lg divide-y bg-card">
        {items.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Nenhum evento cadastrado.</div>}
        {items.map(e => (
          <div key={e.id} className="p-3 flex items-start gap-3">
            <Badge variant="outline">{TIPO_EVENTO_LABEL[e.tipo] || e.tipo}</Badge>
            <div className="flex-1">
              <div className="font-semibold text-sm">{e.titulo}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.data_inicio).toLocaleString('pt-BR')}
                {e.data_fim && ` — ${new Date(e.data_fim).toLocaleString('pt-BR')}`}
              </div>
              {e.descricao && <div className="text-sm mt-1">{e.descricao}</div>}
            </div>
            {podeEditar && (
              <Button size="icon" variant="ghost" onClick={() => remover(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo evento da escola</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_EVENTO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="datetime-local" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="datetime-local" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===================== APOIO PRESENCIAL ===================== */
function ApoioPresencialPanel({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const grade = useGradeHorario();
  const [items, setItems] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ data: '', horario_grade_id: '', professor_id: '', responsavel_id: '', observacao: '' });

  const load = async () => {
    const { data } = await supabase.from('apoio_presencial').select('*').order('data', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => {
    load();
    supabase.from('profiles').select('id,nome,email').eq('status', 'ativo').order('nome').then(({ data }) => setProfessores(data || []));
  }, []);

  const nome = (id: string) => professores.find(p => p.id === id)?.nome || professores.find(p => p.id === id)?.email || '—';
  const horarioRot = (id: string | null) => grade.find(g => g.id === id)?.rotulo || '—';

  const salvar = async () => {
    if (!user || !form.data || !form.professor_id || !form.responsavel_id) { toast({ title: 'Preencha data, professor e responsável' }); return; }
    await supabase.from('apoio_presencial').insert({ criado_por: user.id, ...form, horario_grade_id: form.horario_grade_id || null });
    toast({ title: 'Apoio registrado' });
    setOpen(false); setForm({ data: '', horario_grade_id: '', professor_id: '', responsavel_id: '', observacao: '' });
    load();
  };

  const remover = async (id: string) => { await supabase.from('apoio_presencial').delete().eq('id', id); load(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{podeEditar ? 'Organize o apoio presencial à sala de aula. Aparece também na agenda do professor envolvido.' : 'Apoios presenciais vinculados a você.'}</p>
        {podeEditar && <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Novo apoio</Button>}
      </div>
      <div className="border rounded-lg divide-y bg-card">
        {items.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Nenhum apoio cadastrado.</div>}
        {items.map(a => (
          <div key={a.id} className="p-3 flex items-start gap-3">
            <Badge variant="outline">{new Date(a.data).toLocaleDateString('pt-BR')}</Badge>
            <div className="flex-1 text-sm">
              <div><strong>Horário:</strong> {horarioRot(a.horario_grade_id)}</div>
              <div><strong>Professor:</strong> {nome(a.professor_id)}</div>
              <div><strong>Responsável:</strong> {nome(a.responsavel_id)}</div>
              {a.observacao && <div className="text-muted-foreground mt-1">{a.observacao}</div>}
            </div>
            {podeEditar && <Button size="icon" variant="ghost" onClick={() => remover(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo apoio presencial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
              <div>
                <Label>Horário/Aula</Label>
                <Select value={form.horario_grade_id} onValueChange={v => setForm({ ...form, horario_grade_id: v })}>
                  <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                  <SelectContent>{grade.map(g => <SelectItem key={g.id} value={g.id}>{g.rotulo} ({g.hora_inicio.slice(0,5)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Professor acompanhado</Label>
              <Select value={form.professor_id} onValueChange={v => setForm({ ...form, professor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável pelo apoio</Label>
              <Select value={form.responsavel_id} onValueChange={v => setForm({ ...form, responsavel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{professores.map(p => <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}