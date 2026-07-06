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
const SESSION_LOAD_TIMEOUT_MS = 5000;

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
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_LOAD_TIMEOUT_MS,
        );

        if (!data.session) {
          setSession(null);
          return;
        }

        const { error } = await withTimeout(
          supabase.auth.getUser(),
          SESSION_LOAD_TIMEOUT_MS,
        );

        if (error) {
          supabase.auth.signOut();
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

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Tempo esgotado ao carregar a sessao.'));
      }, timeoutMs);
    }),
  ]);
}
