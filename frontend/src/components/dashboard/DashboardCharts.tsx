import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

// ── Paleta semântica suave (terracota / sálvia / rosé) ─────────────
const C_PRIMARY    = 'hsl(22 35% 45%)';   // terracota
const C_GLOW       = 'hsl(18 50% 62%)';   // terracota clara
const C_SUCCESS    = 'hsl(134 28% 52%)';  // verde sálvia
const C_WARNING    = 'hsl(38 65% 60%)';   // mostarda suave
const C_DANGER     = 'hsl(0 55% 68%)';    // vermelho suave
const C_ROSE       = 'hsl(4 50% 75%)';    // rosé
const C_MUTED      = 'hsl(25 12% 60%)';
const C_GRID       = 'hsl(30 18% 88%)';

const PIE_COLORS = [C_SUCCESS, C_WARNING, C_DANGER];
const BAR_COLORS = [C_PRIMARY, C_GLOW, C_ROSE, 'hsl(34 30% 70%)', 'hsl(28 25% 78%)'];
const DIST_COLORS = [C_DANGER, C_ROSE, C_WARNING, C_GLOW, C_SUCCESS];

// ── Tipos ──────────────────────────────────────────────────────────
export interface SituacaoData { name: string; value: number }
export interface MediaTurmaData { turma: string; media: number }
export interface EvolucaoData { label: string; [key: string]: string | number }
export interface TipoAvalData { nome: string; media: number }
export interface DistribuicaoData { faixa: string; quantidade: number }
export interface AlunoDesempenhoData { nome: string; media: number; turma: string }

// ── 1. Gráfico pizza – situação dos alunos ─────────────────────────
export function GraficoPizza({ data }: { data: SituacaoData[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartContainer config={{ aprovado: { color: C_SUCCESS }, recuperacao: { color: C_WARNING }, reprovado: { color: C_DANGER } }} className="h-[220px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={3} dataKey="value" nameKey="name">
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ChartContainer>
  );
}

// ── 2. Gráfico de barras – média por turma ─────────────────────────
export function GraficoBarraTurma({ data }: { data: MediaTurmaData[] }) {
  return (
    <ChartContainer config={{ media: { label: 'Média', color: C_PRIMARY } }} className="h-[220px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C_GRID} />
        <XAxis dataKey="turma" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="media" fill={C_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  );
}

// ── 3. Gráfico de linhas – evolução das notas ──────────────────────
export function GraficoEvolucao({ data, keys }: { data: EvolucaoData[]; keys: string[] }) {
  const colors = [C_PRIMARY, C_GLOW, C_SUCCESS, C_WARNING, C_DANGER];
  return (
    <ChartContainer config={Object.fromEntries(keys.map((k, i) => [k, { label: k, color: colors[i % colors.length] }]))} className="h-[220px] w-full">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
      </LineChart>
    </ChartContainer>
  );
}

// ── 4. Média por tipo de avaliação ─────────────────────────────────
export function GraficoTipoAvaliacao({ data }: { data: TipoAvalData[] }) {
  return (
    <ChartContainer config={{ media: { label: 'Média', color: C_GLOW } }} className="h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C_GRID} />
        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={90} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="media" fill={C_GLOW} radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ── 5. Distribuição das notas ──────────────────────────────────────
export function GraficoDistribuicao({ data }: { data: DistribuicaoData[] }) {
  return (
    <ChartContainer config={{ quantidade: { label: 'Alunos', color: C_PRIMARY } }} className="h-[220px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C_GRID} />
        <XAxis dataKey="faixa" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((_, i) => <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ── 6. Desempenho por aluno (top/bottom) ──────────────────────────
export function GraficoAlunos({ data }: { data: AlunoDesempenhoData[] }) {
  const colored = data.map(d => ({
    ...d,
    fill: d.media >= 7 ? C_SUCCESS : d.media >= 5 ? C_WARNING : C_DANGER,
  }));
  return (
    <ChartContainer config={{ media: { label: 'Média', color: C_PRIMARY } }} className="h-[260px] w-full">
      <BarChart data={colored} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C_GRID} />
        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={110} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="media" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {colored.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
