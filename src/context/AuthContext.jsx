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
      
      // Prioritize DB role, fallback to metadata
      let finalRole = (profile?.role) || authUser.user_metadata?.role || null;

      setAuthState({
        user: authUser,
        role: finalRole,
        loading: false,
      });
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setAuthState({
        user: authUser,
        role: authUser.user_metadata?.role || null,
        loading: false,
      });
    }
  };

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchUserProfile(session.user);
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user);
      } else {
        setAuthState({ user: null, role: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
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

  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand"></div>
      </div>
    );
  }

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
