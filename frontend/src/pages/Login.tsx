import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser?.must_change_password) {
        navigate('/force-password-change');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error;
      setError(typeof errMsg === 'string' ? errMsg : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setForgotMsg('');
    try {
      const res = await authService.requestPasswordReset(forgotEmail);
      setForgotDone(true);
      setForgotMsg(res?.message || 'Your request has been submitted. An administrator will reset your password.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-blue-950">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-accent-500/5 blur-3xl" />
      </div>

      <div className="relative flex w-full items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-sm p-3 ring-1 ring-white/10">
              <img src="/logo.png" alt="K-CONNECT" className="h-full w-full object-contain drop-shadow-lg" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">K-CONNECT TECHNOLOGIES</h1>
            <p className="mt-2 text-sm font-medium text-primary-200/80">Enterprise Management System</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl ring-1 ring-white/[0.06]">
            {view === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    {error}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-primary-200 block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-primary-300 shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-primary-200 block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder-primary-300 shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-primary-300 transition-colors hover:bg-white/5 hover:text-primary-100"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-primary-950 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                      Sign In
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); setForgotEmail(email); }}
                  className="block w-full text-center text-sm font-medium text-primary-300 transition-colors hover:text-primary-100"
                >
                  Forgot password?
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                {forgotDone ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <CheckCircle2 size={40} className="text-accent-400" />
                      <p className="text-sm font-semibold text-white">Request Submitted</p>
                      <p className="text-sm text-primary-200/80">{forgotMsg}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setView('login'); setForgotDone(false); setForgotMsg(''); }}
                      className="relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-500"
                    >
                      <ArrowLeft size={16} /> Back to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    {error && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/20">
                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        {error}
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-lg font-semibold text-white">Reset Password</p>
                      <p className="mt-1 text-sm text-primary-200/80">
                        No email link needed. Submit your email to notify an administrator, who will issue you a temporary password.
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-primary-200 block mb-1.5">Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-primary-300 shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                        placeholder="you@company.com"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-primary-950 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : 'Submit Request'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setView('login'); setError(''); }}
                      className="flex w-full items-center justify-center gap-1 text-sm font-medium text-primary-300 transition-colors hover:text-primary-100"
                    >
                      <ArrowLeft size={14} /> Back to Sign In
                    </button>
                  </>
                )}
              </form>
            )}
          </div>

          <p className="mt-8 text-center text-xs font-medium text-primary-300/60">
            &copy; {new Date().getFullYear()} K-CONNECT TECHNOLOGIES. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
