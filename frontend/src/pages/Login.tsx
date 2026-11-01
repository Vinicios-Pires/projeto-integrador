import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { mensagemDeErro } from '@/lib/api';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logoEscola from '@/assets/logo-escola.png';
import bannerEscola from '@/assets/banner-escola.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email.toLowerCase().trim(), password);
      navigate('/');
    } catch (err) {
      toast({ title: 'Erro ao entrar', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Banner lateral (desktop) / topo (mobile) */}
      <div className="w-full md:w-1/2 md:h-screen flex items-center justify-center bg-primary-light p-4 md:p-8">
        <img
          src={bannerEscola}
          alt="EE Prof. Edson Vianei Alves"
          className="max-w-full max-h-48 md:max-h-full w-auto h-auto object-contain animate-fade-in"
        />
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md shadow-elevated border-0 rounded-3xl bg-card animate-fade-in">
          <CardHeader className="text-center pb-2">
            <img src={logoEscola} alt="Logo da escola" className="mx-auto w-24 h-24 object-contain mb-3" />
            <CardTitle className="text-2xl">Painel Escolar Inteligente</CardTitle>
            <CardDescription className="text-primary font-medium">
              EE Prof. Edson Vianei Alves
            </CardDescription>
            <p className="text-xs text-muted-foreground italic mt-1">
              jovens autônomos, solidários e competentes
            </p>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail institucional</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-4 flex flex-col gap-2 text-center text-sm">
            <Link to="/cadastro" className="text-primary hover:underline inline-flex items-center justify-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Criar conta
            </Link>
            <Link to="/recuperar-senha" className="text-muted-foreground hover:underline inline-flex items-center justify-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> Esqueci minha senha
            </Link>
          </div>
          <p className="mt-6 text-xs text-center text-muted-foreground">
            Acesso permitido apenas para contas cadastradas e aprovadas.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
