import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    user: null,
    role: null,
    loading: true,
  });

  const fetchUserProfile = async (authUser) => {
    if (!authUser) {
      setAuthState({ user: null, role: null, loading: false });
      return;
    }
    
    try {
      // Check public.users table directly for the role
      const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        // On intermittent failure, preserve existing role if possible
        setAuthState(prev => ({
          ...prev,
          user: authUser,
          role: prev.role || authUser.user_metadata?.role || null,
          loading: false,
        }));
        return;
      }

      // Prioritize DB role, fallback to metadata
      let finalRole = (profile?.role) || authUser.user_metadata?.role || null;

      setAuthState(prev => ({
        ...prev,
        user: authUser,
        role: finalRole,
        loading: false,
      }));
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      setAuthState(prev => ({
        ...prev,
        user: authUser,
        role: prev.role || authUser.user_metadata?.role || null,
        loading: false,
      }));
    }
  };

  useEffect(() => {
    let settled = false;
    const stopLoading = () => {
      if (settled) return;
      settled = true;
      setAuthState(prev => ({ ...prev, loading: false }));
    };

    // Initial session check. Must ALWAYS resolve the loading gate — otherwise a
    // slow/failed getSession() or profile query leaves the whole app on a blank
    // screen until the user reloads.
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetchUserProfile(session.user);
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        stopLoading();
      }
    };

    checkSession();

    // Safety net: never hang the app on a blank screen. If auth hasn't settled
    // within 5s (slow network, DB timeout), render anyway in a logged-out state;
    // onAuthStateChange will fill in the user once it eventually resolves.
    const safety = setTimeout(stopLoading, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user);
      } else {
        settled = true;
        setAuthState({ user: null, role: null, loading: false });
      }
    });

    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) console.error('Google login error:', error);
  };

  const signup = async (name, email, password, userRole, onboarded = false) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: userRole,
          onboarded: onboarded
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const updateUserProfile = async (updates) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates
    });
    if (error) throw error;
    
    // Refresh the local state
    if (data.user) {
      await fetchUserProfile(data.user);
    }
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAuthState({ user: null, role: null, loading: false });
  };

  const user = authState.user;
  const role = authState.role;

  const formattedUser = user ? {
    id: user.id,
    name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
    email: user.email,
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    role: role,
    onboarded: user.user_metadata?.onboarded || (role && role !== 'new_user' && role !== 'admin') || role === 'admin'
  } : null;

  const value = {
    user: formattedUser,
    login,
    loginWithGoogle,
    signup,
    logout,
    updateUserProfile,
    isAuthenticated: !!user,
    role: formattedUser?.role || null,
    loading: authState.loading
  };

  // NB: this used to render a full-screen spinner *instead of* children while
  // loading. Under SSR that made every route server-render nothing but a
  // spinner — `loading` starts true on the server and the effect that clears it
  // never runs there — which defeats the entire point of server rendering.
  //
  // Children now always render and `loading` is exposed on the context for
  // consumers to gate on: ProtectedRoute returns null while loading, so guarded
  // routes are still never shown to an unauthenticated user. The tradeoff is
  // that auth-dependent chrome (e.g. the navbar's logged-in menu) briefly
  // renders its logged-out state before the session resolves.
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
