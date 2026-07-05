import { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  User,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { Loader2, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LANGUAGES } from '../constants';

interface AuthPageProps {
  onGoogleToken: (token: string | null) => void;
  onLogin: () => Promise<void>;
}

// ─── Token persistence helpers ───────────────────────────────────────
function storeToken(token: string, uid: string, refreshToken?: string) {
  try {
    localStorage.setItem('beatrice_google_token', token);
    localStorage.setItem('beatrice_google_uid', uid);
    if (refreshToken) {
      localStorage.setItem('beatrice_google_refresh_token', refreshToken);
    }
  } catch {}
}

function clearStoredToken() {
  try {
    localStorage.removeItem('beatrice_google_token');
    localStorage.removeItem('beatrice_google_refresh_token');
    localStorage.removeItem('beatrice_google_uid');
  } catch {}
}

function restoreStoredToken(uid: string): string | null {
  try {
    const stored = localStorage.getItem('beatrice_google_token');
    const storedUid = localStorage.getItem('beatrice_google_uid');
    return stored && storedUid === uid ? stored : null;
  } catch {
    return null;
  }
}

export function AuthPage({ onGoogleToken, onLogin }: AuthPageProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'resetpw'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLanguage, setAuthLanguage] = useState(() => {
    try { return localStorage.getItem('beatrice_language') || 'en'; } catch { return 'en'; }
  });
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const restored = restoreStoredToken(u.uid);
          if (restored) {
            onGoogleToken(restored);
          }
        } catch {}
      }
      setLoading(false);
    });
    return () => unsub();
  }, [onGoogleToken]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) { setAuthError('Email and password required'); return; }
    if (authPassword.length < 6) { setAuthError('Password must be at least 6 characters'); return; }
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authDisplayName.trim()) {
          await updateProfile(cred.user, { displayName: authDisplayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      try { localStorage.setItem('beatrice_language', authLanguage); } catch {}
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already registered. Sign in instead.'
        : err.code === 'auth/user-not-found' ? 'No account with this email. Sign up instead.'
        : err.code === 'auth/wrong-password' ? 'Wrong password. Try again.'
        : err.code === 'auth/invalid-credential' ? 'Invalid email or password.'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Try later.'
        : err.code === 'auth/operation-not-allowed' ? 'This sign-in method is not enabled in Firebase Console. Enable it under Authentication > Sign-in method.'
        : err.message || 'Authentication failed';
      setAuthError(msg);
    }
  };

  const handleLogout = () => {
    onGoogleToken(null);
    clearStoredToken();
    signOut(auth);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) { setAuthError('Enter your email address'); return; }
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, authEmail.trim());
      setResetSent(true);
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' ? 'No account with this email.'
        : err.code === 'auth/invalid-email' ? 'Invalid email address.'
        : err.message || 'Failed to send reset email';
      setAuthError(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500/50" />
          <span className="text-xs font-mono tracking-widest text-amber-500/30 uppercase">
            Initializing System
          </span>
        </div>
      </div>
    );
  }

  // If user is signed in, render nothing (parent shows agent)
  if (user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Softer Apple-style ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] bg-[#d0a78b]/[0.06] rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-amber-700/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[400px] z-10 flex flex-col items-center">
        {/* Minimal header */}
        <div className="flex flex-col items-center gap-3 mb-12">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d0a78b]/20 to-amber-900/30 p-[1px]">
            <div className="w-full h-full rounded-full bg-[#080808] flex items-center justify-center border border-[#d0a78b]/10 overflow-hidden p-2">
              <img src="https://eburon.ai/icon-eburon.svg" alt="" className="w-full h-full object-contain" />
            </div>
          </div>
          <span className="text-xl font-light tracking-[0.2em] text-white/80 uppercase font-['SF_Pro_Display',system-ui,sans-serif]">Beatrice</span>
        </div>

        <AnimatePresence mode="wait">
          {authMode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-7 flex flex-col shadow-2xl">
                <h2 className="text-xl font-light tracking-wide text-white/90 mb-1 font-['SF_Pro_Display',system-ui,sans-serif]">Sign In</h2>
                <p className="text-white/30 text-xs mb-7 font-['SF_Pro_Text',system-ui,sans-serif]">Welcome back. Enter your credentials.</p>

                <form onSubmit={handleEmailAuth} className="space-y-3 mb-5">
                  <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <input
                      type="email"
                      placeholder="Email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                      required
                    />
                  </div>
                  <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <input
                      type="password"
                      placeholder="Password"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                      required
                    />
                  </div>

                  {authError && (
                    <p className="text-red-400/90 text-xs text-center font-medium bg-red-500/5 py-2.5 rounded-xl border border-red-500/10 font-['SF_Pro_Text',system-ui,sans-serif]">{authError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-white text-[#050505] text-sm font-semibold tracking-wide shadow-lg shadow-white/10 active:scale-[0.97] transition-all duration-200 cursor-pointer hover:bg-white/90 font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Sign In
                  </button>
                </form>

                <div className="flex items-center gap-4 w-full mb-5">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-medium font-['SF_Pro_Text',system-ui,sans-serif]">or</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <button
                    onClick={onLogin}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.10] text-white/70 hover:text-white/90 text-sm font-medium active:scale-[0.97] transition-all duration-200 cursor-pointer mb-5 font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>

                <div className="flex items-center justify-between text-xs border-t border-white/[0.04] pt-4">
                  <button
                    onClick={() => { setAuthMode('resetpw'); setAuthError(''); }}
                    className="text-white/30 hover:text-white/60 transition-colors duration-200 cursor-pointer font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Forgot password?
                  </button>
                  <button
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    className="text-[#d0a78b]/70 hover:text-[#d0a78b] font-medium transition-colors duration-200 cursor-pointer font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Create account
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {authMode === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-7 flex flex-col shadow-2xl">
                <h2 className="text-xl font-light tracking-wide text-white/90 mb-1 font-['SF_Pro_Display',system-ui,sans-serif]">Create Account</h2>
                <p className="text-white/30 text-xs mb-7 font-['SF_Pro_Text',system-ui,sans-serif]">Sign up to unlock Beatrice's voice intelligence.</p>

                <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
                  <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={authDisplayName}
                      onChange={e => setAuthDisplayName(e.target.value)}
                      className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                      required
                    />
                  </div>
                  <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <input
                      type="email"
                      placeholder="Email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                      required
                    />
                  </div>
                  <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <input
                      type="password"
                      placeholder="Password (min 6 chars)"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                      required
                    />
                  </div>

                  {/* Onboarding Language Choice */}
                  <div className="relative group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                    <select
                      value={authLanguage}
                      onChange={e => { setAuthLanguage(e.target.value); try { localStorage.setItem('beatrice_language', e.target.value); } catch {} }}
                      className="w-full bg-transparent text-white/60 placeholder-white/25 text-sm px-4 py-3.5 outline-none appearance-none cursor-pointer font-['SF_Pro_Text',system-ui,sans-serif]"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/20">
                      <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>

                  {authError && (
                    <p className="text-red-400/90 text-xs text-center font-medium bg-red-500/5 py-2.5 rounded-xl border border-red-500/10 font-['SF_Pro_Text',system-ui,sans-serif]">{authError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-white text-[#050505] text-sm font-semibold tracking-wide shadow-lg shadow-white/10 active:scale-[0.97] transition-all duration-200 cursor-pointer hover:bg-white/90 font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Create Account
                  </button>
                </form>

                <div className="flex items-center gap-4 w-full mb-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-medium font-['SF_Pro_Text',system-ui,sans-serif]">or</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                  <button
                    onClick={onLogin}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.10] text-white/70 hover:text-white/90 text-sm font-medium active:scale-[0.97] transition-all duration-200 cursor-pointer mb-5 font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continue with Google
                </button>

                <div className="flex items-center justify-center text-xs border-t border-white/[0.04] pt-4">
                  <span className="text-white/30 mr-1.5 font-['SF_Pro_Text',system-ui,sans-serif]">Already have an account?</span>
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className="text-[#d0a78b]/70 hover:text-[#d0a78b] font-medium transition-colors duration-200 cursor-pointer font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {authMode === 'resetpw' && (
            <motion.div
              key="resetpw"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <div className="backdrop-blur-2xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-7 flex flex-col shadow-2xl">
                <h2 className="text-xl font-light tracking-wide text-white/90 mb-1 font-['SF_Pro_Display',system-ui,sans-serif]">Reset Password</h2>
                <p className="text-white/30 text-xs mb-7 font-['SF_Pro_Text',system-ui,sans-serif]">Enter your email and we'll send a recovery link.</p>

                {resetSent ? (
                  <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl p-5 flex flex-col items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400/80">
                      <Check className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-emerald-400/80 text-center font-medium font-['SF_Pro_Text',system-ui,sans-serif]">Reset link sent! Check your email inbox.</span>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4 mb-4">
                    <div className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] focus-within:border-[#d0a78b]/30 focus-within:bg-white/[0.06] transition-all duration-300 has-[:focus]:shadow-[0_0_0_1px_rgba(208,167,139,0.15)]">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        className="w-full bg-transparent text-white/80 placeholder-white/25 text-sm px-4 py-3.5 outline-none font-['SF_Pro_Text',system-ui,sans-serif]"
                        required
                      />
                    </div>

                    {authError && (
                      <p className="text-red-400/90 text-xs text-center font-medium bg-red-500/5 py-2.5 rounded-xl border border-red-500/10 font-['SF_Pro_Text',system-ui,sans-serif]">{authError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-white text-[#050505] text-sm font-semibold tracking-wide shadow-lg shadow-white/10 active:scale-[0.97] transition-all duration-200 cursor-pointer hover:bg-white/90 font-['SF_Pro_Text',system-ui,sans-serif]"
                    >
                      Send Reset Link
                    </button>
                  </form>
                )}

                <div className="flex items-center justify-center text-xs border-t border-white/[0.04] pt-4">
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); }}
                    className="text-white/30 hover:text-white/60 transition-colors duration-200 cursor-pointer font-['SF_Pro_Text',system-ui,sans-serif]"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex items-center gap-2 text-[9px] text-white/15 uppercase tracking-[0.2em] font-['SF_Pro_Text',system-ui,sans-serif] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 animate-pulse" />
          Secure Connection
        </div>
      </div>
    </main>
  );
}
