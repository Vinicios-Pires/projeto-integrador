import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6', className)}>
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  subtitle?: string;
}

export function StatCard({ title, value, icon, color = 'blue', subtitle }: StatCardProps) {
  const colorMap = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-success/10 text-success',
    yellow: 'bg-warning/10 text-warning',
    red: 'bg-destructive/10 text-destructive',
  };
  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-4 flex items-center gap-4 animate-fade-in">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colorMap[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center bg-card border border-border rounded-xl px-4 py-3 mb-4">
      {children}
    </div>
  );
}

export function TableContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        {children}
      </div>
    </div>
  );
}

interface BadgeStatusProps {
  situacao: 'Aprovado' | 'Recuperação' | 'Abaixo da média' | 'Reprovado' | string;
}

export function BadgeSituacao({ situacao }: BadgeStatusProps) {
  if (situacao === 'Aprovado') return <span className="status-badge status-aprovado">✓ Aprovado</span>;
  if (situacao === 'Recuperação') return <span className="status-badge status-recuperacao">⚠ Recuperação</span>;
  return <span className="status-badge status-reprovado">✗ Abaixo da média</span>;
}

export function EmptyState({ message = 'Nenhum dado encontrado', icon }: { message?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-muted-foreground/40 mb-3">{icon}</div>}
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
