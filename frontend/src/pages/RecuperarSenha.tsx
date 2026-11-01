import React from 'react';
import { Link } from 'react-router-dom';
import { School, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * O sistema não envia e-mails: quem esqueceu a senha pede ao administrador uma senha
 * temporária (Gerenciar Usuários > Resetar senha) e cria uma nova no próximo acesso.
 */
export default function RecuperarSenha() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--primary-light))] p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <School className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle>Esqueceu a senha?</CardTitle>
          <CardDescription>Peça uma senha temporária ao administrador do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
            <li>Fale com o administrador (direção ou coordenação) e peça para <strong>resetar a sua senha</strong>.</li>
            <li>Ele vai te passar uma <strong>senha temporária</strong>.</li>
            <li>Entre com o seu e-mail e essa senha: o sistema vai pedir para você criar uma senha nova.</li>
          </ol>
          <Link to="/login">
            <Button className="w-full">
              <KeyRound className="w-4 h-4 mr-2" /> Voltar ao login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
