import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return undefined;
    }

    async function loadSession() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setSession(null);
          return;
        }

        const { error } = await supabase.auth.getUser();

        if (error) {
          await supabase.auth.signOut();
          setSession(null);
          return;
        }

        setSession(data.session);
      } catch (error) {
        console.warn('Nao foi possivel carregar a sessao salva.', error);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    (email, password) =>
      supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }),
    [],
  );

  const signUp = useCallback(
    (email, password) =>
      supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            email: email.trim(),
          },
        },
      }),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const resetPassword = useCallback(
    (email) => supabase.auth.resetPasswordForEmail(email.trim()),
    [],
  );

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      resetPassword,
      session,
      signIn,
      signOut,
      signUp,
      user: session?.user ?? null,
    }),
    [isLoading, resetPassword, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de AuthProvider.');
  }

  return context;
}
