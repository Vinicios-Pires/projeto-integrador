import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, aoPerderLogin, token } from '@/lib/api';

export type AppRole = 'professor' | 'coordenador' | 'direcao' | 'vice_direcao' | 'admin';
export type ProfileStatus = 'pendente' | 'ativo' | 'inativo';

/** Login ativo: o token do backend. */
export interface Session {
  token: string;
}

export interface User {
  id: string;
  email: string;
}

type Profile = { nome: string; email: string; status: ProfileStatus };

/** Resposta de `POST /auth/login` (sem o token) e de `GET /me`. */
interface Me {
  user: User;
  role: AppRole | null;
  profile: Profile | null;
  deve_trocar_senha: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  /** Senha temporária (criada pelo admin): é preciso trocar antes de usar o sistema. */
  deveTrocarSenha: boolean;
  loading: boolean;
  signIn: (email: string, senha: string) => Promise<void>;
  /** Relê os dados do usuário (ex.: depois de trocar a senha). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profile: null,
  deveTrocarSenha: false,
  loading: true,
  signIn: async () => {},
  refresh: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const limpar = () => {
    token.clear();
    setSession(null);
    setMe(null);
  };

  const refresh = async () => {
    const atual = token.get();
    if (!atual) return limpar();
    try {
      setMe(await api.get<Me>('/me'));
      setSession({ token: atual });
    } catch {
      // Token recusado (401) já foi apagado pelo cliente da API; sem conexão, ele fica para a próxima vez.
      setSession(null);
      setMe(null);
    }
  };

  useEffect(() => {
    aoPerderLogin(limpar);
    refresh().finally(() => setLoading(false));
    return () => aoPerderLogin(null);
  }, []);

  const signIn = async (email: string, senha: string) => {
    const { token: novo, ...dados } = await api.post<Me & { token: string }>('/auth/login', { email, senha });
    token.set(novo);
    setMe(dados);
    setSession({ token: novo });
  };

  const signOut = async () => limpar();

  return (
    <AuthContext.Provider
      value={{
        session,
        user: me?.user ?? null,
        role: me?.role ?? null,
        profile: me?.profile ?? null,
        deveTrocarSenha: me?.deve_trocar_senha ?? false,
        loading,
        signIn,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
