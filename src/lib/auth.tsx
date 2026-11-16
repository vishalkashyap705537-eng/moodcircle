import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Mood, Profile } from './types';
import { identifyPurchaser, logoutPurchaser } from './purchases';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  moods: Mood[];
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  ready: false,
  session: null,
  profile: null,
  moods: [],
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('moods').select('*').order('sort'),
    ]);
    setProfile((p as Profile) ?? null);
    setMoods((m as Mood[]) ?? []);
    identifyPurchaser(s.user.id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);

  const signOut = useCallback(async () => {
    await logoutPurchaser();
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ ready, session, profile, moods, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export function useMood(id: string | null | undefined) {
  const { moods } = useAuth();
  return moods.find((m) => m.id === id) ?? null;
}
