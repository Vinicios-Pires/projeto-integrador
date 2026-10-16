import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  BookOpen,
  Laptop,
  ScanLine,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  School,
  Menu,
  Palette,
  LogOut,
  Building2,
  FolderHeart,
  Award,
  ShieldCheck,
  CalendarDays,
  Sparkles,
  HeartHandshake,
  AlertCircle,
  NotebookPen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import logoEscola from '@/assets/logo-escola.png';

const navProfessor = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Turmas', icon: School, path: '/turmas' },
  { label: 'Alunos', icon: GraduationCap, path: '/alunos' },
  { label: 'Matérias', icon: Palette, path: '/materias' },
  { label: 'Notas', icon: ClipboardList, path: '/notas' },
  { label: 'Diário do Professor', icon: NotebookPen, path: '/diario' },
  { label: 'Plano de Aula', icon: BookOpen, path: '/plano-aula' },
  { label: 'Agenda', icon: CalendarDays, path: '/agenda' },
  { label: 'Ocorrências de Notebook', icon: Laptop, path: '/ocorrencias' },
  { label: 'Ocorrências Escolares', icon: AlertCircle, path: '/ocorrencias-escolares' },
  { label: 'Correção de Provas', icon: ScanLine, path: '/correcao-provas' },
  { label: 'PDI - Evidências', icon: FolderHeart, path: '/pdi-evidencias' },
  { label: 'Prova Paulista', icon: Award, path: '/prova-paulista' },
  { label: 'Replicabilidade', icon: Sparkles, path: '/replicabilidade' },
  { label: 'Tutoria', icon: HeartHandshake, path: '/tutoria' },
  { label: 'Relatórios', icon: BarChart3, path: '/relatorios' },
  { label: 'Configurações', icon: Settings, path: '/configuracoes' },
];

const navGestao = [
  { label: 'Painel da Gestão', icon: Building2, path: '/gestao' },
  { label: 'Turmas', icon: School, path: '/turmas' },
  { label: 'Alunos', icon: GraduationCap, path: '/alunos' },
  { label: 'Notas (todos)', icon: ClipboardList, path: '/notas' },
  { label: 'Diário do Professor', icon: NotebookPen, path: '/diario' },
  { label: 'Planos de Aula', icon: BookOpen, path: '/plano-aula' },
  { label: 'Agenda', icon: CalendarDays, path: '/agenda' },
  { label: 'Ocorrências de Notebook', icon: Laptop, path: '/ocorrencias' },
  { label: 'Ocorrências Escolares', icon: AlertCircle, path: '/ocorrencias-escolares' },
  { label: 'PDI - Evidências', icon: FolderHeart, path: '/pdi-evidencias' },
  { label: 'Prova Paulista', icon: Award, path: '/prova-paulista' },
  { label: 'Replicabilidade', icon: Sparkles, path: '/replicabilidade' },
  { label: 'Tutoria', icon: HeartHandshake, path: '/tutoria' },
  { label: 'Relatórios', icon: BarChart3, path: '/relatorios' },
  { label: 'Configurações', icon: Settings, path: '/configuracoes' },
];

const ROLE_LABEL: Record<string, string> = {
  professor: 'Professor(a)',
  coordenador: 'Coordenação',
  direcao: 'Direção',
  vice_direcao: 'Vice-direção',
  admin: 'Administrador',
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut, profile, role } = useAuth();
  const { isGestao, isAdmin } = usePermissions();
  const baseNav = isGestao ? navGestao : navProfessor;
  const navItems = isAdmin
    ? [...baseNav.slice(0, 1), { label: 'Gerenciar Usuários', icon: ShieldCheck, path: '/usuarios' }, ...baseNav.slice(1)]
    : baseNav;

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center px-4 py-4 border-b border-sidebar-border', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex items-center justify-center rounded-lg bg-white flex-shrink-0 overflow-hidden shadow-soft w-10 h-10">
          <img src={logoEscola} alt="Logo" className="w-full h-full object-contain p-0.5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-accent-foreground leading-tight">Painel Escolar</p>
            <p className="text-xs text-sidebar-foreground/60">Inteligente</p>
          </div>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.nome || profile?.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sidebar-primary/20 text-sidebar-primary capitalize">
            {ROLE_LABEL[role || 'professor'] ?? role}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2 scrollbar-thin">
        {navItems.map((item) => {
          const active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                active
                  ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-sidebar-primary' : '')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer with logout + collapse */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm',
            collapsed && 'justify-center'
          )}
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-all text-sm',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut, profile, role } = useAuth();
  const { isGestao, isAdmin } = usePermissions();
  const baseNav = isGestao ? navGestao : navProfessor;
  const navItems = isAdmin
    ? [...baseNav.slice(0, 1), { label: 'Gerenciar Usuários', icon: ShieldCheck, path: '/usuarios' }, ...baseNav.slice(1)]
    : baseNav;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-elevated"
      >
        <Menu className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col animate-slide-in">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
              <div className="flex items-center justify-center rounded-lg bg-white overflow-hidden w-10 h-10 shadow-soft">
                <img src={logoEscola} alt="Logo" className="w-full h-full object-contain p-0.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-sidebar-accent-foreground">Painel Escolar</p>
                <p className="text-xs text-sidebar-foreground/60">Inteligente</p>
              </div>
            </div>
            <div className="px-4 py-3 border-b border-sidebar-border">
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.nome || profile?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sidebar-primary/20 text-sidebar-primary capitalize">
                {ROLE_LABEL[role || 'professor'] ?? role}
              </span>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
              {navItems.map((item) => {
                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                      active
                        ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-sidebar-border p-2">
              <button
                onClick={signOut}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
