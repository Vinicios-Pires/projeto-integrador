import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type BlocoHorario = {
  id: string;
  ordem: number;
  rotulo: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: 'aula' | 'intervalo' | 'almoco' | 'planejamento' | 'atpc' | 'reuniao' | 'outro';
};

export type RotinaItem = {
  id: string;
  user_id: string;
  dia_semana: number;
  horario_grade_id: string;
  disciplina_id: string | null;
  turma_id: string | null;
  atividade: string | null;
  cor: string | null;
};

export type ExcecaoItem = {
  id: string;
  user_id: string;
  data: string;
  horario_grade_id: string;
  disciplina_id: string | null;
  turma_id: string | null;
  atividade: string | null;
  cancelado: boolean;
  observacao: string | null;
};

export type EventoEscola = {
  id: string;
  criado_por: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  dia_todo: boolean;
  cor: string | null;
};

export type ApoioPresencial = {
  id: string;
  criado_por: string;
  data: string;
  horario_grade_id: string | null;
  professor_id: string;
  responsavel_id: string;
  observacao: string | null;
};

export function useGradeHorario() {
  const [grade, setGrade] = useState<BlocoHorario[]>([]);
  useEffect(() => {
    supabase
      .from('horario_grade')
      .select('*')
      .order('ordem')
      .then(({ data }) => setGrade((data as BlocoHorario[]) || []));
  }, []);
  return grade;
}

export function useAgenda() {
  const { user } = useAuth();
  const [rotina, setRotina] = useState<RotinaItem[]>([]);
  const [excecoes, setExcecoes] = useState<ExcecaoItem[]>([]);
  const [eventos, setEventos] = useState<EventoEscola[]>([]);
  const [apoios, setApoios] = useState<ApoioPresencial[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [r, e, ev, ap] = await Promise.all([
      supabase.from('agenda_professor').select('*').eq('user_id', user.id),
      supabase.from('agenda_excecoes').select('*').eq('user_id', user.id),
      supabase.from('agenda_escola_eventos').select('*').order('data_inicio'),
      supabase.from('apoio_presencial').select('*').order('data'),
    ]);
    setRotina((r.data as RotinaItem[]) || []);
    setExcecoes((e.data as ExcecaoItem[]) || []);
    setEventos((ev.data as EventoEscola[]) || []);
    setApoios((ap.data as ApoioPresencial[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { rotina, excecoes, eventos, apoios, loading, refetch };
}

/** Resolve a célula (rotina + exceção) para um dia/bloco específico */
export function resolveAula(
  rotina: RotinaItem[],
  excecoes: ExcecaoItem[],
  data: Date,
  horarioId: string,
) {
  const iso = data.toISOString().slice(0, 10);
  const exc = excecoes.find(x => x.data === iso && x.horario_grade_id === horarioId);
  if (exc) return { fonte: 'excecao' as const, ...exc };
  const dia = data.getDay();
  const rot = rotina.find(x => x.dia_semana === dia && x.horario_grade_id === horarioId);
  if (rot) return { fonte: 'rotina' as const, ...rot };
  return null;
}