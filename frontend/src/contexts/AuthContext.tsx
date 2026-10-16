import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'professor' | 'coordenador' | 'direcao' | 'vice_direcao' | 'admin';
export type ProfileStatus = 'pendente' | 'ativo' | 'inativo';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: { nome: string; email: string; status: ProfileStatus } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ nome: string; email: string; status: ProfileStatus } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('nome, email, status').eq('id', userId).maybeSingle(),
    ]);

    setRole(rolesRes.data ? (rolesRes.data.role as AppRole) : null);
    setProfile(profileRes.data ? (profileRes.data as any) : null);
  };

  useEffect(() => {
    let active = true;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setLoading(true);
      } else {
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!user) return;

    setLoading(true);
    fetchUserData(user.id)
      .catch(() => {
        if (!active) return;
        setRole(null);
        setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
