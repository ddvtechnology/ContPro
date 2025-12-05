import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Função auxiliar para montar User a partir do Supabase Auth
function buildUserFromAuth(user: SupabaseUser): User {
  // Priorizar display_name, depois user_metadata.name, depois email
  const displayName = user.user_metadata?.display_name;
  const metadataName = user.user_metadata?.name;
  const name = displayName || metadataName || user.email?.split('@')[0] || 'Usuário';
  
  return {
    id: user.id,
    name: name,
    email: user.email || '',
    avatar: user.user_metadata?.avatar,
  };
}

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Sanitizar email antes de enviar
      const sanitizedEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password
      });
      if (error) {
        // Não logar informações sensíveis em produção
        return false;
      }
      if (data.user) {
        const userObj = buildUserFromAuth(data.user);
        setUser(userObj);
        return true;
      }
      return false;
    } catch (error) {
      // Não logar erros detalhados em produção
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }, []);

  // Função para atualizar o usuário localmente
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (mounted) setIsLoading(false);
          return;
        }
        if (mounted) {
          if (session?.user) {
            const userObj = buildUserFromAuth(session.user);
            setUser(userObj);
          }
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) setIsLoading(false);
      }
    };
    // Timeout para evitar loading infinito
    const timeout = setTimeout(() => {
      if (mounted && isLoading) {
        setIsLoading(false);
      }
    }, 5000);
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const userObj = buildUserFromAuth(session.user);
          setUser(userObj);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );
    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    login,
    logout,
    isLoading,
    updateUser,
  };
};

export { AuthContext };