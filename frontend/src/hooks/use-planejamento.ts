import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
  /** Quantas aulas a planilha tem (vem do backend). */
  aulas_count?: number;
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
    // Ano mais recente primeiro; cada um já vem com aulas_count.
    const data = await api.get<Planejamento[]>('/planejamentos', {
      bimestre: filtros?.bimestre,
      ano: filtros?.ano,
      turma_id: filtros?.turma_id,
      disciplina_id: filtros?.disciplina_id,
      user_id: filtros?.user_id,
    }).catch(() => []);
    setData(data);
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
    // Em ordem de data.
    const data = await api.get<LinhaAula[]>('/planos-aula', { planejamento_id: planejamentoId }).catch(() => []);
    setLinhas(data);
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