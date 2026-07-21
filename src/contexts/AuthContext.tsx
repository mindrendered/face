import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';
import { identifyUser, resetUser } from '@/lib/analytics';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, loading: true, isAdmin: false,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*, is_admin').eq('id', uid).maybeSingle();
    setProfile(data ?? null);
    if (data) {
      identifyUser({ id: data.id, email: data.email, plan: data.plan });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setSentryUser({ id: session.user.id, email: session.user.email });
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setSentryUser({ id: session.user.id, email: session.user.email });
        fetchProfile(session.user.id);
      } else {
        clearSentryUser();
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    clearSentryUser();
    resetUser();
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin: profile?.is_admin ?? false, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
