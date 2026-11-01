import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api, mensagemDeErro } from '@/lib/api';

/**
 * Troca da própria senha. Com `obrigatoria`, aparece no lugar do sistema enquanto o usuário
 * estiver com a senha temporária criada pelo administrador.
 */
export default function RedefinirSenha({ obrigatoria = false }: { obrigatoria?: boolean }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refresh, signOut } = useAuth();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Senha fraca', description: 'Mínimo de 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmacao) {
      toast({ title: 'As senhas não conferem', description: 'Digite a nova senha igual nos dois campos.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { senha_atual: senhaAtual, nova_senha: password });
      await refresh();
      toast({ title: 'Senha atualizada', description: 'Sua senha foi trocada com sucesso.' });
      navigate('/');
    } catch (err) {
      toast({ title: 'Erro', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <School className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle>{obrigatoria ? 'Crie uma senha nova' : 'Trocar senha'}</CardTitle>
          <CardDescription>
            {obrigatoria
              ? 'Você entrou com uma senha temporária. Para continuar, crie a sua senha.'
              : 'Informe a senha atual e escolha uma nova'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">{obrigatoria ? 'Senha temporária' : 'Senha atual'}</Label>
              <Input id="senha-atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={72} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmacao">Repita a nova senha</Label>
              <Input id="confirmacao" type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required minLength={8} maxLength={72} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
          {obrigatoria ? (
            <Button variant="ghost" className="w-full mt-2" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          ) : (
            <Button variant="ghost" className="w-full mt-2" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
