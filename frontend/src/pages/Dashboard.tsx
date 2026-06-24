import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { DashboardStats } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import {
  Users, FolderKanban, Headphones, UserCircle,
  TrendingUp, DollarSign, Activity, ArrowUpRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, financialData] = await Promise.all([
          dataService.getDashboardStats(),
          dataService.getFinancialSummary(),
        ]);
        setStats(statsData);
        setFinancial(financialData);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Customers', value: stats?.total_customers || 0, icon: Users, color: 'bg-blue-500', change: '+12%' },
    { label: 'Active Projects', value: stats?.active_projects || 0, icon: FolderKanban, color: 'bg-accent-500', change: '+5%' },
    { label: 'Open Tickets', value: stats?.open_tickets || 0, icon: Headphones, color: 'bg-yellow-500', change: '-3%' },
    { label: 'Total Employees', value: stats?.total_employees || 0, icon: UserCircle, color: 'bg-purple-500', change: '+2%' },
  ];

  const statusLabels: Record<string, string> = {
    in_progress: 'Active',
    completed: 'Completed',
    planning: 'Planning',
    on_hold: 'On Hold',
    cancelled: 'Cancelled',
  };
  const pieData = Object.entries(stats?.project_statuses || {}).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your business performance</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-2 dark:bg-accent-900/20">
          <TrendingUp size={20} className="text-accent-600 dark:text-accent-400" />
          <span className="text-sm font-medium text-accent-700 dark:text-accent-300">
            Revenue: {formatCurrency(financial?.total_revenue || 0)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">{stat.label}</p>
                <p className="stat-value mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} stat-icon text-white`}>
                <stat.icon size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs">
              <ArrowUpRight size={14} className="text-accent-500" />
              <span className="font-medium text-accent-600 dark:text-accent-400">{stat.change}</span>
              <span className="text-surface-400">vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Revenue</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.monthly_revenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Project Status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-surface-600 dark:text-surface-400">{item.name}</span>
                </div>
                <span className="font-medium text-surface-900 dark:text-surface-50">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Financial Summary</h3>
          {financial ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Total Revenue</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(financial.total_revenue)}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Total Expenses</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(financial.total_expenses)}</p>
                </div>
                <div className="rounded-lg bg-accent-50 p-4 dark:bg-accent-900/20">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Net Profit</p>
                  <p className="text-lg font-bold text-accent-700 dark:text-accent-400">{formatCurrency(financial.net_profit)}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                  <p className="text-xs text-surface-500 dark:text-surface-400">Outstanding</p>
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{formatCurrency(financial.outstanding_invoices)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <p className="text-xs font-medium text-surface-500 mb-2">Revenue Breakdown</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-surface-600 dark:text-surface-400">Payments Received</span>
                    <span className="font-medium text-surface-900 dark:text-surface-50">
                      {formatCurrency(financial.total_revenue - (financial.project_revenue || 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-surface-600 dark:text-surface-400">Completed Project Revenue</span>
                    <span className="font-medium text-accent-600">{formatCurrency(financial.project_revenue || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-surface-400">Loading financial data...</p>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Recent Activities</h3>
          <div className="space-y-4">
            {stats?.recent_activities?.slice(0, 6).map((activity: any, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700">
                  <Activity size={14} className="text-surface-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 dark:text-surface-300">
                    <span className="font-medium">{activity.user?.first_name} {activity.user?.last_name}</span>
                    {' '}{activity.action}
                  </p>
                  <p className="text-xs text-surface-400">{formatDateTime(activity.created_at)}</p>
                </div>
              </div>
            ))}
            {(!stats?.recent_activities || stats.recent_activities.length === 0) && (
              <p className="text-sm text-surface-400 text-center py-4">No recent activities</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
