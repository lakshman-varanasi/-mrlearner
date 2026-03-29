import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { Mail, Lock, Loader2, ArrowRight, User, AlertTriangle, ExternalLink } from 'lucide-react';

interface AuthPageProps {
  mode: 'signin' | 'signup';
}

function getFriendlyError(code: string): { message: string; hint?: string } {
  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        message: 'Google Sign-In is not enabled for this domain.',
        hint: `To fix this, go to Firebase Console → Authentication → Settings → Authorized Domains and add: ${window.location.hostname}`,
      };
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return { message: 'Incorrect email or password. Please try again.' };
    case 'auth/email-already-in-use':
      return { message: 'An account with this email already exists. Try signing in instead.' };
    case 'auth/weak-password':
      return { message: 'Password must be at least 6 characters.' };
    case 'auth/too-many-requests':
      return { message: 'Too many failed attempts. Please wait a few minutes and try again.' };
    case 'auth/network-request-failed':
      return { message: 'Network error. Please check your connection and try again.' };
    default:
      return { message: 'Something went wrong. Please try again.' };
  }
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          username: username,
          displayName: username,
          streak: 0,
          onboarded: false,
          xp: 0,
          level: 1,
          recentActivity: [],
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getFriendlyError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">L</div>
            <span className="font-bold text-2xl tracking-tight">LearnAI</span>
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-neutral-500 mt-2">
            {mode === 'signin' ? 'Sign in to continue your learning journey' : 'Join thousands of students mastering subjects with AI'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-700">{error.message}</p>
              </div>
              {error.hint && (
                <p className="text-xs text-red-500 pl-6 leading-relaxed">{error.hint}</p>
              )}
              {error.hint && (
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline pl-6"
                >
                  Open Firebase Console <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="text"
                    required
                    placeholder="johndoe"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-neutral-700">Password</label>
                {mode === 'signin' && (
                  <Link to="/forgot-password" className="text-xs font-bold text-indigo-600 hover:underline">
                    Forgot Password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-neutral-400 font-medium">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-4 bg-white border-2 border-neutral-100 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-50 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Continue with Google
              </>
            )}
          </button>
        </div>

        <p className="text-center mt-8 text-neutral-500 font-medium">
          {mode === 'signin' ? (
            <>Don't have an account? <Link to="/signup" className="text-indigo-600 hover:underline font-bold">Create one</Link></>
          ) : (
            <>Already have an account? <Link to="/signin" className="text-indigo-600 hover:underline font-bold">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
};
