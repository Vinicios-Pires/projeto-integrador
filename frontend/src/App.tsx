import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import GestaoDashboard from "@/pages/GestaoDashboard";
import Turmas from "@/pages/Turmas";
import Alunos from "@/pages/Alunos";
import Notas from "@/pages/Notas";
import PlanoAula from "@/pages/PlanoAula";
import Ocorrencias from "@/pages/Ocorrencias";
import OcorrenciasEscolares from "@/pages/OcorrenciasEscolares";
import CorrecaoProvas from "@/pages/CorrecaoProvas";
import PdiEvidencias from "@/pages/PdiEvidencias";
import ProvaPaulista from "@/pages/ProvaPaulista";
import Agenda from "@/pages/Agenda";
import DiarioProfessor from "@/pages/DiarioProfessor";
import Replicabilidade from "@/pages/Replicabilidade";
import Tutoria from "@/pages/Tutoria";
import Relatorios from "@/pages/Relatorios";
import Configuracoes from "@/pages/Configuracoes";
import Materias from "@/pages/Materias";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import AguardandoAprovacao from "@/pages/AguardandoAprovacao";
import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
import RecuperarSenha from "@/pages/RecuperarSenha";
import RedefinirSenha from "@/pages/RedefinirSenha";
import { usePermissions } from "@/hooks/use-permissions";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoutes() {
  const { session, loading, deveTrocarSenha } = useAuth();
  const { isGestao, isAdmin } = usePermissions();
  const { profile, role } = useAuth();

  if (loading) return <Carregando />;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Senha temporária (criada pelo admin): o backend recusa as outras rotas até a troca.
  if (deveTrocarSenha) {
    return <RedefinirSenha obrigatoria />;
  }

  // Bloqueia acesso de usuários pendentes/inativos ou sem papel atribuído
  if (profile && (profile.status === 'pendente' || profile.status === 'inativo' || !role)) {
    return <AguardandoAprovacao />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={isGestao ? <Navigate to="/gestao" replace /> : <Dashboard />} />
        <Route path="/gestao" element={isGestao ? <GestaoDashboard /> : <Navigate to="/" replace />} />
        <Route path="/turmas" element={<Turmas />} />
        <Route path="/alunos" element={<Alunos />} />
        <Route path="/materias" element={<Materias />} />
        <Route path="/notas" element={<Notas />} />
        <Route path="/plano-aula" element={<PlanoAula />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
        <Route path="/ocorrencias-escolares" element={<OcorrenciasEscolares />} />
        <Route path="/correcao-provas" element={<CorrecaoProvas />} />
        <Route path="/pdi-evidencias" element={<PdiEvidencias />} />
        <Route path="/prova-paulista" element={<ProvaPaulista />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/diario" element={<DiarioProfessor />} />
        <Route path="/replicabilidade" element={<Replicabilidade />} />
        <Route path="/tutoria" element={<Tutoria />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/usuarios" element={isAdmin ? <GerenciarUsuarios /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

/** Telas de tela cheia (fora do menu) que exigem login. */
function LoggedInRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Carregando />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Toaster />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/cadastro" element={<PublicRoute><Cadastro /></PublicRoute>} />
          <Route path="/recuperar-senha" element={<PublicRoute><RecuperarSenha /></PublicRoute>} />
          <Route path="/redefinir-senha" element={<LoggedInRoute><RedefinirSenha /></LoggedInRoute>} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
