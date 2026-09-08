import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ForcePasswordChange() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ temporary_password: '', new_password: '', confirm: '' });
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await authService.changePassword(form.temporary_password, form.new_password);
      // Clear the local flag so user can proceed
      updateUser({ ...user, must_change_password: false });
      toast.success('Password updated. Welcome back!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-blue-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative flex w-full items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-white/10">
              <Lock size={28} className="text-primary-300" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Set a New Password</h1>
            <p className="mt-2 text-sm text-primary-200/80">
              Your account is using a temporary password. Create a new password to continue.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl ring-1 ring-white/[0.06]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium text-primary-200 block mb-1.5">Temporary Password</label>
                <div className="relative">
                  <input
                    type={showTemp ? 'text' : 'password'}
                    value={form.temporary_password}
                    onChange={(e) => setForm({ ...form, temporary_password: e.target.value })}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder-primary-300 transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="Enter the temporary password"
                    required
                  />
                  <button type="button" onClick={() => setShowTemp(!showTemp)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-primary-300 hover:bg-white/5 hover:text-primary-100">
                    {showTemp ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-primary-200 block mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={form.new_password}
                    onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder-primary-300 transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="New password (min 6 characters)"
                    required
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-primary-300 hover:bg-white/5 hover:text-primary-100">
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-primary-200 block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-primary-300 transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Set New Password'}
              </button>

              <button
                type="button"
                onClick={() => { logout(); navigate('/login'); }}
                className="block w-full text-center text-sm font-medium text-primary-300 transition-colors hover:text-primary-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
