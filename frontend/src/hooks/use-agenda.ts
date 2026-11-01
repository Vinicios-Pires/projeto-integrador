import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
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
    // Já vem em ordem.
    api.get<BlocoHorario[]>('/horario-grade').then(setGrade, () => setGrade([]));
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
    // A própria agenda; os eventos da escola em ordem de início; o apoio presencial (o professor vê só os seus).
    const [r, e, ev, ap] = await Promise.all([
      api.get<RotinaItem[]>('/agenda/rotina').catch(() => []),
      api.get<ExcecaoItem[]>('/agenda/excecoes').catch(() => []),
      api.get<EventoEscola[]>('/eventos-escola').catch(() => []),
      api.get<ApoioPresencial[]>('/apoio-presencial').then(l => [...l].sort((a, b) => a.data.localeCompare(b.data))).catch(() => []),
    ]);
    setRotina(r);
    setExcecoes(e);
    setEventos(ev);
    setApoios(ap);
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