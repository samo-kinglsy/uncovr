import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getOrCreateOnboardingProfile } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';

type AuthResult = {
  error: string | null;
  requiresEmailConfirmation?: boolean;
};

type AuthContextValue = {
  isLoading: boolean;
  markOnboardingComplete: () => void;
  onboardingCompleted: boolean;
  session: Session | null;
  createAccount: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const hydrationRequestId = useRef(0);

  async function hydrateSession(nextSession: Session | null) {
    const requestId = ++hydrationRequestId.current;
    setSession(nextSession);

    if (!nextSession) {
      setOnboardingCompleted(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const profile = await getOrCreateOnboardingProfile(nextSession.user.id);
      if (requestId !== hydrationRequestId.current) return;

      setOnboardingCompleted(profile.onboardingCompleted);
    } catch {
      if (requestId !== hydrationRequestId.current) return;

      setOnboardingCompleted(false);
    } finally {
      if (requestId === hydrationRequestId.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;

        void hydrateSession(data.session);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void hydrateSession(nextSession);
      } else {
        setSession(nextSession);
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

      await hydrateSession(data.session);
      return {
        error: null,
        requiresEmailConfirmation: Boolean(data.user && !data.session),
      };
    } catch {
      return { error: 'Unable to create your account. Check your connection and try again.' };
    }
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { error: error.message };

      await hydrateSession(data.session);
      return { error: null };
    } catch {
      return { error: 'Unable to sign in. Check your connection and try again.' };
    }
  }

  async function signOut(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) return { error: error.message };

      await hydrateSession(null);
      return { error: null };
    } catch {
      return { error: 'Unable to sign out. Check your connection and try again.' };
    }
  }

  function markOnboardingComplete() {
    setOnboardingCompleted(true);
  }

  return (
    <AuthContext.Provider
      value={{
        createAccount,
        isLoading,
        markOnboardingComplete,
        onboardingCompleted,
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
