import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { getUserInitials } from '../lib/utils';
import { User, Camera, Lock, Save } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    language: user?.language || 'en',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user: updated } = await authService.updateProfile(form);
      updateUser(updated);
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPw(true);
    try {
      await authService.changePassword(pwForm.current_password, pwForm.new_password);
      toast.success('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your personal information and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Avatar Card */}
        <div className="card lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover" />
                ) : (
                  getUserInitials(user.first_name, user.last_name)
                )}
              </div>
              <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow hover:bg-primary-700">
                <Camera size={14} />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{user.first_name} {user.last_name}</h2>
            <p className="text-sm text-surface-500 capitalize">{user.role.replace('_', ' ')}</p>
            <p className="mt-1 text-xs text-surface-400">{user.email}</p>
            {user.employee_id && <p className="text-xs text-surface-400 mt-0.5">ID: {user.employee_id}</p>}
          </div>
        </div>

        {/* Edit Profile */}
        <div className="card lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-surface-50">
            <User size={16} /> Personal Information
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">First Name</label>
                <input className="input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input bg-surface-50 dark:bg-surface-700" value={user.email} disabled />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input" value={form.language} onChange={e => setForm({ ...form, language: e.target.value as 'en' | 'sw' })}>
                  <option value="en">English</option>
                  <option value="sw">Kiswahili</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card lg:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-surface-50">
            <Lock size={16} /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input className="input" type="password" value={pwForm.current_password}
                onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">New Password</label>
                <input className="input" type="password" value={pwForm.new_password}
                  onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} required />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input className="input" type="password" value={pwForm.confirm}
                  onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required />
              </div>
            </div>
            <button type="submit" disabled={changingPw} className="btn-secondary flex items-center gap-2">
              <Lock size={16} /> {changingPw ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
