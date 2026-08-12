import { createContext, useContext, useRef, useState, useEffect } from 'react';
import { SUPABASE_AUTH_STORAGE_KEY, supabase } from '../lib/supabase';
import { requestWelcomeEmail } from '../lib/welcomeEmail';

const AuthContext = createContext();
const SESSION_ONLY_AUTH_KEY = 'MuviDB_session_only_auth';

function getAuthErrorStatus(error) {
  return Number(error?.status || error?.statusCode || error?.code || 0);
}

function getAuthErrorMessage(error) {
  return String(error?.message || error?.error_description || error || '').toLowerCase();
}

function isTransientAuthError(error) {
  const status = getAuthErrorStatus(error);
  const message = getAuthErrorMessage(error);
  return (
    [408, 409, 425, 429, 500, 502, 503, 504].includes(status) ||
    /failed to fetch|fetch failed|network|timeout|timed out|aborted|offline|rate limit|too many requests|temporar|gateway|service unavailable/.test(message)
  );
}

function isInvalidAuthError(error) {
  if (!error || isTransientAuthError(error)) return false;

  const status = getAuthErrorStatus(error);
  const message = getAuthErrorMessage(error);
  const refreshTokenGone =
    /refresh.*token.*(not found|invalid|expired|revoked|reuse|already used)|invalid.*refresh.*token|session.*(missing|not found)|user.*not found|user from sub claim/.test(message);

  if (refreshTokenGone) return true;

  // Plain 401/403 responses can happen during temporary auth/service edges.
  // Keep the cached session unless Supabase says the refresh token/session is
  // actually gone.
  if ([401, 403].includes(status)) return false;

  return (
    [400, 404].includes(status) ||
    /invalid.*jwt|invalid.*access.*token/.test(message)
  );
}

function roleFromUser(authUser) {
  return authUser?.user_metadata?.role || null;
}

export function AuthProvider({ children }) {
  const manualSignOutRef = useRef(false);
  const [authState, setAuthState] = useState({
    user: null,
    role: null,
    loading: true,
  });

  const clearLocalAuth = async () => {
    try {
      // Local scope clears the browser session even if the auth user was already deleted.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {
      /* ignore */
    }
    setAuthState({ user: null, role: null, loading: false });
  };

  const setRememberedSession = (remember) => {
    if (typeof window === 'undefined') return;

    if (remember) {
      window.sessionStorage.removeItem(SESSION_ONLY_AUTH_KEY);
      return;
    }

    window.sessionStorage.setItem(SESSION_ONLY_AUTH_KEY, 'true');
    window.localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
  };

  /**
   * getSession() only reads the cached JWT from storage — a deleted Supabase
   * Auth user can still look "logged in" until the token expires. getUser()
   * hits the Auth API and fails when the account no longer exists.
   */
  const validateAuthUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user) return { user, invalid: false, transient: false, error: null };
      if (error) {
        return {
          user: null,
          invalid: isInvalidAuthError(error),
          transient: isTransientAuthError(error),
          error,
        };
      }
      return { user: null, invalid: true, transient: false, error: null };
    } catch (error) {
      return {
        user: null,
        invalid: isInvalidAuthError(error),
        transient: !isInvalidAuthError(error),
        error,
      };
    }
  };

  const applyCachedAuthUser = (authUser) => {
    if (!authUser) return;
    setAuthState(prev => ({
      ...prev,
      user: authUser,
      role: prev.role || roleFromUser(authUser),
      loading: false,
    }));
  };

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

      // New accounts only — server is idempotent; never blocks auth UX.
      // Small delay so the access token is fully available right after signup.
      const name = authUser.user_metadata?.name || authUser.user_metadata?.full_name;
      setTimeout(() => {
        void requestWelcomeEmail(name);
      }, 600);
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
        if (!session) return;

        // Trust the cached session immediately, then verify it in the background.
        // Temporary network/rate-limit failures must not become real logouts.
        settled = true;
        applyCachedAuthUser(session.user);

        const validation = await validateAuthUser();
        if (validation.invalid) {
          await clearLocalAuth();
          return;
        }
        if (validation.transient) {
          console.warn('Auth validation temporarily failed; preserving cached session:', validation.error);
        }
        await fetchUserProfile(validation.user || session.user);
      } catch (err) {
        console.error('Session check failed:', err);
        if (isInvalidAuthError(err)) {
          await clearLocalAuth();
        } else {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      } finally {
        stopLoading();
      }
    };

    checkSession();

    // Safety net: never hang the app on a blank screen. If auth hasn't settled
    // within 5s (slow network, DB timeout), render anyway in a logged-out state;
    // onAuthStateChange will fill in the user once it eventually resolves.
    const safety = setTimeout(stopLoading, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        settled = true;
        if (manualSignOutRef.current) {
          manualSignOutRef.current = false;
          setAuthState({ user: null, role: null, loading: false });
          return;
        }
        void (async () => {
          const { data: { session: cachedSession } } = await supabase.auth.getSession();
          if (cachedSession?.user) {
            applyCachedAuthUser(cachedSession.user);
            await fetchUserProfile(cachedSession.user);
            return;
          }
          setAuthState({ user: null, role: null, loading: false });
        })();
        return;
      }

      if (!session) {
        settled = true;
        setAuthState(prev => ({ ...prev, loading: false }));
        return;
      }

      // TOKEN_REFRESHED / USER_UPDATED: re-check the account still exists.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        applyCachedAuthUser(session.user);
        void (async () => {
          const validation = await validateAuthUser();
          if (validation.invalid) {
            await clearLocalAuth();
            return;
          }
          if (validation.transient) {
            console.warn(`Auth ${event} validation temporarily failed; preserving cached session:`, validation.error);
          }
          await fetchUserProfile(validation.user || session.user);
        })();
        return;
      }

      if (session) {
        applyCachedAuthUser(session.user);
        void (async () => {
          const validation = await validateAuthUser();
          if (validation.invalid) {
            await clearLocalAuth();
            return;
          }
          if (validation.transient) {
            console.warn(`Auth ${event} validation temporarily failed; preserving cached session:`, validation.error);
          }
          await fetchUserProfile(validation.user || session.user);
        })();

        // Email-confirm / OAuth return often lands as SIGNED_IN — force a welcome
        // attempt in case an earlier in-tab attempt failed before the server was ready.
        if (event === 'SIGNED_IN') {
          const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
          setTimeout(() => {
            void requestWelcomeEmail(name, { force: true });
          }, 800);
        }
      }
    });

    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const isAdminRoute = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

    const keepAdminSessionFresh = async () => {
      if (!isAdminRoute() || document.hidden) return;
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error && !isTransientAuthError(error) && isInvalidAuthError(error)) {
          await clearLocalAuth();
          return;
        }
        const activeSession = session || (await supabase.auth.getSession()).data?.session;
        if (activeSession?.user) {
          applyCachedAuthUser(activeSession.user);
          await fetchUserProfile(activeSession.user);
        }
      } catch (error) {
        if (!isTransientAuthError(error) && isInvalidAuthError(error)) {
          await clearLocalAuth();
        }
      }
    };

    const interval = window.setInterval(keepAdminSessionFresh, 10 * 60 * 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) void keepAdminSessionFresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const login = async (email, password, options = {}) => {
    const remember = options.remember !== false;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setRememberedSession(remember);
    if (data?.user) {
      await fetchUserProfile(data.user);
    }
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

  /** Send Supabase recovery email. Always resolve on success; do not leak whether the email exists. */
  const requestPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) throw error;
  };

  /** Set a new password while in a PASSWORD_RECOVERY session. */
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
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
    manualSignOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthState({ user: null, role: null, loading: false });
    } finally {
      manualSignOutRef.current = false;
    }
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
    requestPasswordReset,
    updatePassword,
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
