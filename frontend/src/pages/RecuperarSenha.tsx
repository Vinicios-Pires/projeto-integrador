import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { School, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const ALLOWED_DOMAIN = '@prof.educacao.sp.gov.br';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const lower = email.toLowerCase().trim();
    if (!lower.endsWith(ALLOWED_DOMAIN)) {
      toast({ title: 'Domínio não permitido', description: `Apenas e-mails ${ALLOWED_DOMAIN} são aceitos.`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 text-center">
          <CardHeader>
            <CardTitle>E-mail enviado</CardTitle>
            <CardDescription>Verifique sua caixa de entrada para redefinir a senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login"><Button variant="outline" className="w-full">Voltar ao login</Button></Link>
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
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Informe seu e-mail institucional</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder={`seu.nome${ALLOWED_DOMAIN}`} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <KeyRound className="w-4 h-4 mr-2" />
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
