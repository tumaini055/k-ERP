import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Users, FolderKanban, Headphones,
  Package, Wifi, DollarSign, ShoppingCart, FileText,
  BarChart3, Settings, UserCircle, Building2, FileSpreadsheet,
  Calendar, Bell, ClipboardList, Clock, ChevronLeft, ChevronRight, User,
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer', 'marketing_officer'] },
  { path: '/profile', label: 'Profile', icon: User, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer', 'marketing_officer', 'customer'] },
  { path: '/crm', label: 'CRM', icon: Users, roles: ['super_admin', 'ceo', 'managing_director', 'marketing_officer'] },
  { path: '/projects', label: 'Projects', icon: FolderKanban, roles: ['super_admin', 'ceo', 'managing_director', 'engineer', 'customer'] },
  { path: '/tickets', label: 'Support', icon: Headphones, roles: ['super_admin', 'ceo', 'managing_director', 'engineer', 'customer'] },
  { path: '/employees', label: 'Employees', icon: UserCircle, roles: ['super_admin', 'ceo', 'managing_director'] },
  { path: '/attendance', label: 'Attendance', icon: Clock, roles: ['super_admin', 'ceo', 'managing_director'] },
  { path: '/inventory', label: 'Inventory', icon: Package, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer'] },
  { path: '/isp', label: 'ISP Management', icon: Wifi, roles: ['super_admin', 'ceo', 'managing_director'] },
  { path: '/finance', label: 'Finance', icon: DollarSign, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'customer'] },
  { path: '/contracts', label: 'Contracts', icon: ClipboardList, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'marketing_officer'] },
  { path: '/documents', label: 'Documents', icon: FileText, roles: ['super_admin', 'ceo', 'managing_director', 'engineer', 'marketing_officer', 'customer'] },
  { path: '/calendar', label: 'Calendar', icon: Calendar, roles: ['super_admin', 'ceo', 'managing_director', 'engineer', 'marketing_officer'] },
  { path: '/organization', label: 'Org Chart', icon: Building2, roles: ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer', 'marketing_officer'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['super_admin', 'ceo', 'managing_director', 'accountant'] },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredItems = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-surface-200 bg-white transition-all duration-300 dark:border-surface-700 dark:bg-surface-800',
          collapsed ? 'w-16' : 'w-64',
          'max-lg:transition-transform max-lg:duration-300',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        )}
      >
      <div className={cn('flex h-16 items-center border-b border-surface-200 px-4 dark:border-surface-700', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">K</div>
            <span className="text-sm font-bold text-surface-900 dark:text-surface-50">K-CONNECT</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-700">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'sidebar-link group',
                isActive && 'active',
                collapsed && 'justify-center px-2'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {user && ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer', 'marketing_officer', 'customer'].includes(user.role) && (
        <div className={cn('border-t border-surface-200 p-3 dark:border-surface-700', collapsed && 'flex justify-center')}>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'active', collapsed && 'justify-center px-2')
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings size={20} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </div>
      )}
      </aside>
    </>
  );
}
