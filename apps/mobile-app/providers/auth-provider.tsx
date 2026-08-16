import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthResult = {
  error: string | null;
  requiresEmailConfirmation?: boolean;
  shouldStartOnboarding?: boolean;
};

type AuthContextValue = {
  completeOnboarding: () => void;
  isLoading: boolean;
  needsOnboarding: boolean;
  session: Session | null;
  createAccount: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Temporary until onboarding completion is stored in the user's Supabase profile.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;

        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        setNeedsOnboarding(false);
      }
    });

    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              supabase.auth.startAutoRefresh();
            } else {
              supabase.auth.stopAutoRefresh();
            }
          });

    if (Platform.OS !== 'web' && AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
      appStateSubscription?.remove();

      if (Platform.OS !== 'web') {
        supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  async function createAccount(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) return { error: error.message };

      setSession(data.session);
      setNeedsOnboarding(true);
      return {
        error: null,
        requiresEmailConfirmation: Boolean(data.user && !data.session),
        shouldStartOnboarding: Boolean(data.session),
      };
    } catch {
      return { error: 'Unable to create your account. Check your connection and try again.' };
    }
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { error: error.message };

      setSession(data.session);
      return { error: null, shouldStartOnboarding: needsOnboarding };
    } catch {
      return { error: 'Unable to sign in. Check your connection and try again.' };
    }
  }

  async function signOut(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) return { error: error.message };

      setSession(null);
      return { error: null };
    } catch {
      return { error: 'Unable to sign out. Check your connection and try again.' };
    }
  }

  function completeOnboarding() {
    setNeedsOnboarding(false);
  }

  return (
    <AuthContext.Provider
      value={{
        completeOnboarding,
        createAccount,
        isLoading,
        needsOnboarding,
        session,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
