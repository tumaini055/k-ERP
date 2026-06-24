import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { cn, getUserInitials, formatDateTime } from '../../lib/utils';
import {
  Bell, Moon, Sun, LogOut, User, Settings, ChevronDown, Menu, CheckCheck,
} from 'lucide-react';
import { Notification } from '../../types';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        dataService.getNotifications({ limit: 10 }),
        dataService.getUnreadCount(),
      ]);
      setNotifications(notifRes.data || []);
      setUnreadCount(countRes.count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const handleMarkRead = async (id: string) => {
    try {
      await dataService.markNotificationRead(id);
      fetchNotifications();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await dataService.markAllNotificationsRead();
      fetchNotifications();
    } catch {}
  };

  if (!user) return null;

  const notifTypeStyles: Record<string, string> = {
    leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    project: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    ticket: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    invoice: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
    default: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur-sm dark:border-surface-700 dark:bg-surface-800/80">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 lg:hidden dark:hover:bg-surface-700 dark:hover:text-surface-300">
          <Menu size={22} />
        </button>
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
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-surface-200 bg-white shadow-lg dark:border-surface-700 dark:bg-surface-800">
              <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-700">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-surface-500">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={cn(
                        'flex items-start gap-3 border-b border-surface-100 px-4 py-3 transition-colors last:border-0 dark:border-surface-700',
                        !n.is_read ? 'bg-primary-50/50 cursor-pointer dark:bg-primary-900/10' : 'hover:bg-surface-50 dark:hover:bg-surface-700/50'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        notifTypeStyles[n.reference_type || 'default']
                      )}>
                        {n.title.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm truncate', !n.is_read ? 'font-semibold text-surface-900 dark:text-surface-50' : 'text-surface-600 dark:text-surface-400')}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-surface-400 mt-1">{formatDateTime(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                      )}
                    </div>
                  ))
                )}
              </div>
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
