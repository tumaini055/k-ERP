import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn, getUserInitials } from '../../lib/utils';
import {
  Bell, Moon, Sun, LogOut, User, Settings, ChevronDown,
} from 'lucide-react';

export default function Header() {
  const { user, logout, updateUser } = useAuth();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur-sm dark:border-surface-700 dark:bg-surface-800/80">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
          Welcome back, {user.first_name}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-700 dark:hover:text-surface-300"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-700 dark:hover:text-surface-300"
          >
            <Bell size={20} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-800">
              <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-700">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Notifications</p>
              </div>
              <div className="p-4 text-center text-sm text-surface-500">No new notifications</div>
            </div>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {getUserInitials(user.first_name, user.last_name)}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <ChevronDown size={16} className="text-surface-400" />
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-800">
              <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-700">
                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-surface-500">{user.email}</p>
              </div>
              <div className="p-2">
                <Link to="/profile" onClick={() => setShowProfile(false)} className="sidebar-link">
                  <User size={16} /> Profile
                </Link>
                <Link to="/settings" onClick={() => setShowProfile(false)} className="sidebar-link">
                  <Settings size={16} /> Settings
                </Link>
                <button onClick={logout} className="sidebar-link w-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
