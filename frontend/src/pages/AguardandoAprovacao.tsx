import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, Ban } from 'lucide-react';

export default function AguardandoAprovacao() {
  const { profile, signOut } = useAuth();
  const inativo = profile?.status === 'inativo';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 text-center">
        <CardHeader>
          <div className={`mx-auto flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${inativo ? 'bg-destructive' : 'bg-amber-500'}`}>
            {inativo ? <Ban className="w-8 h-8 text-white" /> : <Clock className="w-8 h-8 text-white" />}
          </div>
          <CardTitle>{inativo ? 'Acesso desativado' : 'Aguardando aprovação'}</CardTitle>
          <CardDescription>
            {inativo
              ? 'Sua conta foi desativada pelo administrador. Entre em contato para mais informações.'
              : 'Sua conta foi criada com sucesso e está aguardando aprovação do administrador. Você receberá acesso assim que seu perfil for liberado.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{profile?.email}</p>
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}