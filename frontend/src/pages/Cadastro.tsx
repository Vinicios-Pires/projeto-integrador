import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemDeErro } from '@/lib/api';
import { School, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const ALLOWED_DOMAIN = '@prof.educacao.sp.gov.br';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const validateDomain = (email: string) => {
    return email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDomain(email)) {
      toast({ title: 'Domínio não permitido', description: `Apenas e-mails ${ALLOWED_DOMAIN} podem se cadastrar.`, variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Senha fraca', description: 'A senha deve ter pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', { nome: nome.trim(), email: email.toLowerCase().trim(), senha: password });
      setSuccess(true);
    } catch (err) {
      toast({ title: 'Erro no cadastro', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 text-center">
          <CardHeader>
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
              <School className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle>Cadastro recebido</CardTitle>
            <CardDescription>
              A conta de <strong>{email}</strong> foi criada e está <strong>aguardando aprovação</strong> do administrador. Assim que for liberada, é só entrar com o e-mail e a senha que você escolheu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button variant="outline" className="w-full">Voltar ao login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <School className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Cadastro para equipe escolar — a função é definida pelo administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail institucional</Label>
              <Input id="email" type="email" placeholder={`seu.nome${ALLOWED_DOMAIN}`} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={72} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-center text-amber-600 dark:text-amber-400">
            Sua conta ficará aguardando aprovação do administrador antes de liberar o acesso.
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
          </p>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Apenas e-mails <strong>{ALLOWED_DOMAIN}</strong> são aceitos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
