import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type StatusPlanejamento = 'rascunho' | 'aguardando_validacao' | 'validado';

export type Planejamento = {
  id: string;
  user_id: string;
  turma_id: string;
  disciplina_id: string | null;
  bimestre: number;
  ano: number;
  status: StatusPlanejamento;
  validado_por: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
};

export type LinhaAula = {
  id: string;
  planejamento_id: string | null;
  user_id: string;
  turma_id: string | null;
  disciplina_id: string | null;
  bimestre: number;
  data_aula: string;
  numero_aulas: number | null;
  aprendizagem_essencial: string | null;
  conteudo: string | null;
  desenvolvimento: string | null;
  recursos: string | null;
  avaliacao_aprendizagem: string | null;
};

export function usePlanejamentos(filtros?: { bimestre?: number; ano?: number; turma_id?: string; disciplina_id?: string; user_id?: string }) {
  const [data, setData] = useState<Planejamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('planejamentos_bimestrais').select('*').order('ano', { ascending: false }).order('bimestre');
    if (filtros?.bimestre) q = q.eq('bimestre', filtros.bimestre);
    if (filtros?.ano) q = q.eq('ano', filtros.ano);
    if (filtros?.turma_id) q = q.eq('turma_id', filtros.turma_id);
    if (filtros?.disciplina_id) q = q.eq('disciplina_id', filtros.disciplina_id);
    if (filtros?.user_id) q = q.eq('user_id', filtros.user_id);
    const { data } = await q;
    setData((data as Planejamento[]) || []);
    setLoading(false);
  }, [filtros?.bimestre, filtros?.ano, filtros?.turma_id, filtros?.disciplina_id, filtros?.user_id]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, refetch: load };
}

export function useLinhasPlanejamento(planejamentoId: string | null) {
  const [linhas, setLinhas] = useState<LinhaAula[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planejamentoId) { setLinhas([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('planos_aula')
      .select('id,planejamento_id,user_id,turma_id,disciplina_id,bimestre,data_aula,numero_aulas,aprendizagem_essencial,conteudo,desenvolvimento,recursos,avaliacao_aprendizagem')
      .eq('planejamento_id', planejamentoId)
      .order('data_aula');
    setLinhas((data as LinhaAula[]) || []);
    setLoading(false);
  }, [planejamentoId]);

  useEffect(() => { load(); }, [load]);
  return { linhas, setLinhas, loading, refetch: load };
}

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export function diaDaSemanaISO(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? '' : DIAS[d.getDay()];
}

export function fmtDataBR(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export const STATUS_LABEL: Record<StatusPlanejamento, string> = {
  rascunho: 'Rascunho',
  aguardando_validacao: 'Aguardando validação',
  validado: 'Validado',
};