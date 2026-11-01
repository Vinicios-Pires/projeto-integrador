import React from 'react';
import { Link } from 'react-router-dom';
import { Settings, KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/ui-escola';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function Configuracoes() {
  const { profile } = useAuth();
  return (
    <div className="animate-fade-in">
      <PageHeader title="Configurações" subtitle="Configurações gerais do sistema" />

      <div className="bg-card border border-border rounded-xl p-5 shadow-card max-w-lg mb-4">
        <h2 className="font-semibold mb-1">Minha conta</h2>
        <p className="text-sm text-muted-foreground mb-4">{profile?.nome} · {profile?.email}</p>
        <Link to="/redefinir-senha">
          <Button variant="outline">
            <KeyRound className="w-4 h-4 mr-2" /> Trocar senha
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-card max-w-lg">
        <h2 className="font-semibold mb-4">Sobre o Sistema</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
            <Settings className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Painel Escolar Inteligente</p>
              <p>Sistema completo de gestão escolar</p>
            </div>
          </div>
          <p>✅ Cadastro de turmas e alunos</p>
          <p>✅ Matérias personalizáveis com cores</p>
          <p>✅ Lançamento de notas com cálculo automático</p>
          <p>✅ Planejamento bimestral de aulas</p>
          <p>✅ Registro de ocorrências de notebook</p>
          <p>✅ Correção de provas com gabarito</p>
          <p>✅ Relatórios completos com exportação</p>
          <p>✅ Importação via CSV/Excel</p>
        </div>
      </div>
    </div>
  );
}
