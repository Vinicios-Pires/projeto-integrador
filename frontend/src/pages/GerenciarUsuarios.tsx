import React, { useEffect, useState } from 'react';
import { api, mensagemDeErro } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, UserCheck, UserX, Search, Loader2, KeyRound, Copy } from 'lucide-react';

type Status = 'pendente' | 'ativo' | 'inativo';
type Role = 'professor' | 'coordenador' | 'vice_direcao' | 'direcao' | 'admin';

interface UsuarioRow {
  id: string;
  nome: string | null;
  email: string | null;
  status: Status;
  role: Role | null;
}

const ROLE_LABEL: Record<Role, string> = {
  professor: 'Professor',
  coordenador: 'Coordenação',
  vice_direcao: 'Vice-direção',
  direcao: 'Direção',
  admin: 'Administrador',
};

const STATUS_COLOR: Record<Status, string> = {
  pendente: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
  ativo: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  inativo: 'bg-destructive/20 text-destructive border-destructive/40',
};

export default function GerenciarUsuarios() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{ nome: string; senha: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Já vem com o papel e os mais recentes primeiro.
      setRows(await api.get<UsuarioRow[]>('/users'));
    } catch (err) {
      toast({ title: 'Erro ao carregar usuários', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Acesso restrito ao administrador.
        </CardContent>
      </Card>
    );
  }

  const updateRole = async (userId: string, role: Role) => {
    setSavingId(userId);
    try {
      await api.patch(`/users/${userId}/role`, { role });
      toast({ title: 'Função atualizada', description: ROLE_LABEL[role] });
      setRows(r => r.map(x => x.id === userId ? { ...x, role } : x));
    } catch (err) {
      toast({ title: 'Erro ao atribuir função', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const updateStatus = async (userId: string, status: Status) => {
    setSavingId(userId);
    try {
      await api.patch(`/users/${userId}/status`, { status });
      toast({ title: 'Status atualizado' });
      setRows(r => r.map(x => x.id === userId ? { ...x, status } : x));
    } catch (err) {
      toast({ title: 'Erro ao atualizar status', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const resetarSenha = async (u: UsuarioRow) => {
    if (!window.confirm(`Gerar uma senha temporária para ${u.nome || u.email}? A senha atual deixa de valer.`)) return;
    setSavingId(u.id);
    try {
      const res = await api.post<{ senha_temporaria: string }>(`/users/${u.id}/reset-password`);
      setSenhaTemporaria({ nome: u.nome || u.email || '', senha: res.senha_temporaria });
    } catch (err) {
      toast({ title: 'Erro ao resetar a senha', description: mensagemDeErro(err), variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const aprovar = async (u: UsuarioRow) => {
    if (!u.role) {
      toast({ title: 'Defina uma função primeiro', variant: 'destructive' });
      return;
    }
    await updateStatus(u.id, 'ativo');
  };

  const filtered = rows.filter(r => {
    const f = filter.toLowerCase();
    return !f || (r.nome || '').toLowerCase().includes(f) || (r.email || '').toLowerCase().includes(f);
  });

  const pendentes = filtered.filter(r => r.status === 'pendente');
  const ativos = filtered.filter(r => r.status === 'ativo');
  const inativos = filtered.filter(r => r.status === 'inativo');

  const renderRow = (u: UsuarioRow) => (
    <div key={u.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-card">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{u.nome || '(sem nome)'}</p>
        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
      </div>
      <Badge variant="outline" className={STATUS_COLOR[u.status]}>{u.status}</Badge>
      <Select value={u.role || ''} onValueChange={(v) => updateRole(u.id, v as Role)} disabled={savingId === u.id}>
        <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Definir função" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="professor">Professor</SelectItem>
          <SelectItem value="coordenador">Coordenação</SelectItem>
          <SelectItem value="vice_direcao">Vice-direção</SelectItem>
          <SelectItem value="direcao">Direção</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        {u.status !== 'ativo' && (
          <Button size="sm" onClick={() => aprovar(u)} disabled={savingId === u.id}>
            <UserCheck className="w-4 h-4 mr-1" /> Ativar
          </Button>
        )}
        {u.status !== 'inativo' && (
          <Button size="sm" variant="outline" onClick={() => updateStatus(u.id, 'inativo')} disabled={savingId === u.id}>
            <UserX className="w-4 h-4 mr-1" /> Inativar
          </Button>
        )}
        {u.status === 'ativo' && (
          <Button size="sm" variant="ghost" onClick={() => resetarSenha(u)} disabled={savingId === u.id} title="Gerar senha temporária">
            <KeyRound className="w-4 h-4 mr-1" /> Resetar senha
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
          <p className="text-sm text-muted-foreground">Aprove cadastros, defina funções e gerencie permissões.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Aguardando aprovação ({pendentes.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pendentes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cadastro pendente.</p> : pendentes.map(renderRow)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ativos ({ativos.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ativos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum usuário ativo.</p> : ativos.map(renderRow)}
            </CardContent>
          </Card>

          {inativos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Inativos ({inativos.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">{inativos.map(renderRow)}</CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!senhaTemporaria} onOpenChange={(aberto) => !aberto && setSenhaTemporaria(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha temporária</DialogTitle>
            <DialogDescription>
              Passe esta senha para <strong>{senhaTemporaria?.nome}</strong>. Ela aparece só agora; no próximo acesso,
              o sistema pede para criar uma senha nova.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-lg font-mono tracking-wide select-all">{senhaTemporaria?.senha}</code>
            <Button
              variant="outline"
              size="icon"
              title="Copiar"
              onClick={() => navigator.clipboard?.writeText(senhaTemporaria?.senha ?? '').then(() => toast({ title: 'Senha copiada' }))}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSenhaTemporaria(null)}>Pronto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}