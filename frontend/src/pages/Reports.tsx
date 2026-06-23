import { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, FileText, Download, X, Calendar, DollarSign, Users, Briefcase, Package, Wifi, Ticket, UserCircle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../lib/utils';

type ReportKey = 'profit-loss' | 'revenue' | 'expenses' | 'customers' | 'leads' | 'customer-activity' | 'projects' | 'project-budget' | 'resource-allocation' | 'inventory' | 'isp' | 'tickets' | 'employees';

type ReportDef = {
  key: ReportKey;
  name: string;
  description: string;
  icon: any;
  color: string;
};

const reportCategories = [
  {
    title: 'Financial Reports',
    icon: BarChart3,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    reports: [
      { key: 'profit-loss', name: 'Profit & Loss Statement', description: 'Income and expenses overview' } as ReportDef,
      { key: 'revenue', name: 'Revenue Analysis', description: 'Revenue breakdown by customer' } as ReportDef,
      { key: 'expenses', name: 'Expense Analysis', description: 'Expense tracking and trends' } as ReportDef,
    ],
  },
  {
    title: 'Customer Reports',
    icon: FileSpreadsheet,
    color: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
    reports: [
      { key: 'customers', name: 'Customer List', description: 'All registered customers' } as ReportDef,
      { key: 'leads', name: 'Lead Conversion', description: 'Lead to customer conversion rates' } as ReportDef,
      { key: 'customer-activity', name: 'Customer Activity', description: 'Customer engagement report' } as ReportDef,
    ],
  },
  {
    title: 'Project Reports',
    icon: FileText,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    reports: [
      { key: 'projects', name: 'Project Status', description: 'All projects current status' } as ReportDef,
      { key: 'project-budget', name: 'Project Budget', description: 'Budget vs actual costs' } as ReportDef,
      { key: 'resource-allocation', name: 'Resource Allocation', description: 'Team workload distribution' } as ReportDef,
    ],
  },
  {
    title: 'Operational Reports',
    icon: Download,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    reports: [
      { key: 'inventory', name: 'Inventory Report', description: 'Stock levels and valuation' } as ReportDef,
      { key: 'isp', name: 'ISP Analytics', description: 'Subscriber and bandwidth usage' } as ReportDef,
      { key: 'tickets', name: 'Support Report', description: 'Ticket resolution metrics' } as ReportDef,
      { key: 'employees', name: 'Employee Report', description: 'Staff performance and attendance' } as ReportDef,
    ],
  },
];

const reportIcons: Record<ReportKey, any> = {
  'profit-loss': DollarSign,
  'revenue': BarChart3,
  'expenses': FileText,
  'customers': Users,
  'leads': Users,
  'customer-activity': Users,
  'projects': Briefcase,
  'project-budget': Briefcase,
  'resource-allocation': Users,
  'inventory': Package,
  'isp': Wifi,
  'tickets': Ticket,
  'employees': UserCircle,
};

const reportColors: Record<ReportKey, string> = {
  'profit-loss': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'revenue': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'expenses': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'customers': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'leads': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'customer-activity': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'projects': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'project-budget': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'resource-allocation': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'inventory': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'isp': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'tickets': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'employees': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function downloadCSV(rows: any[][], filename: string) {
  const csv = rows.map(r => r.map(c => typeof c === 'string' && (c.includes(',') || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    planning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    closed: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    low_stock: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    out_of_stock: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    in_stock: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    proposal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    negotiation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors[status] || 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

type ReportViewProps = {
  report: ReportDef;
  onClose: () => void;
};

function ProfitLossView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getProfitLoss({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Expenses</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Net Profit</p><p className={`text-xl font-bold ${data.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.net_profit)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 pr-4 font-medium text-surface-500">Income</th><th className="py-2 pr-4 font-medium text-surface-500">Expenses</th><th className="py-2 font-medium text-surface-500">Profit</th></tr></thead>
            <tbody>{data.monthly?.map((m: any) => (
              <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 pr-4 text-green-600">{formatCurrency(m.income)}</td><td className="py-2 pr-4 text-red-600">{formatCurrency(m.expenses)}</td><td className={`py-2 ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(m.profit)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Expenses by Category</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Category</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead>
            <tbody>{data.expense_by_category?.map((c: any) => (
              <tr key={c.category} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{c.category}</td><td className="py-2 text-red-600">{formatCurrency(c.amount)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <button onClick={() => {
        const rows = [['Month', 'Income', 'Expenses', 'Profit']];
        data.monthly?.forEach((m: any) => rows.push([m.month, m.income, m.expenses, m.profit]));
        rows.push([''], ['Total Revenue', data.total_revenue], ['Total Expenses', data.total_expenses], ['Net Profit', data.net_profit]);
        downloadCSV(rows, `profit-loss-${year}`);
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function RevenueView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getRevenueReport({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Outstanding</p><p className="text-xl font-bold text-orange-600">{formatCurrency(data.outstanding_invoices)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Payments</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.payment_count}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Invoices</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.invoice_count}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Revenue</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 font-medium text-surface-500">Revenue</th></tr></thead><tbody>{data.monthly?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 text-green-600">{formatCurrency(m.revenue)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Revenue by Customer</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Customer</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.by_customer?.map((c: any) => <tr key={c.customer} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{c.customer}</td><td className="py-2 text-green-600">{formatCurrency(c.amount)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <button onClick={() => {
        const rows = [['Month', 'Revenue']];
        data.monthly?.forEach((m: any) => rows.push([m.month, m.revenue]));
        downloadCSV(rows, `revenue-${year}`);
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ExpensesView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getExpenseReport({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Expenses</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Category</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Category</th><th className="py-2 pr-4 font-medium text-surface-500">Count</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.by_category?.map((c: any) => <tr key={c.category} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{c.category}</td><td className="py-2 pr-4 text-surface-500">{c.count}</td><td className="py-2 text-red-600">{formatCurrency(c.amount)}</td></tr>)}</tbody></table></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.monthly?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 text-red-600">{formatCurrency(m.amount)}</td></tr>)}</tbody></table></div>
      </div>
      <button onClick={() => {
        const rows = [['Description', 'Category', 'Amount', 'Date']];
        data.list?.forEach((e: any) => rows.push([e.description, e.category, e.amount, e.date]));
        downloadCSV(rows, `expenses-${year}`);
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function CustomersView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getCustomerReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-4 text-sm text-surface-500">Total Customers: <strong className="text-surface-900 dark:text-surface-50">{data.total}</strong></div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Company</th><th className="py-2 pr-3 font-medium text-surface-500">Contact</th><th className="py-2 pr-3 font-medium text-surface-500">Email</th><th className="py-2 pr-3 font-medium text-surface-500">Phone</th><th className="py-2 pr-3 font-medium text-surface-500">Projects</th><th className="py-2 pr-3 font-medium text-surface-500">Invoiced</th><th className="py-2 font-medium text-surface-500">Paid</th></tr></thead><tbody>{data.data?.map((c: any) => <tr key={c.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{c.company_name}</td><td className="py-2 pr-3 text-surface-500">{c.contact_person}</td><td className="py-2 pr-3 text-surface-500">{c.email}</td><td className="py-2 pr-3 text-surface-500">{c.phone}</td><td className="py-2 pr-3 text-surface-500">{c.active_projects}/{c.total_projects}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(c.total_invoiced)}</td><td className="py-2 text-green-600">{formatCurrency(c.total_paid)}</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Company', 'Contact', 'Email', 'Phone', 'City', 'Active Projects', 'Total Projects', 'Invoiced', 'Paid', 'Outstanding']];
        data.data?.forEach((c: any) => rows.push([c.company_name, c.contact_person, c.email, c.phone, c.city, c.active_projects, c.total_projects, c.total_invoiced, c.total_paid, c.outstanding]));
        downloadCSV(rows, 'customers');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function LeadsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getLeadReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Leads</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Converted</p><p className="text-xl font-bold text-green-600">{data.converted_count}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Conversion Rate</p><p className="text-xl font-bold text-primary-600">{data.conversion_rate}%</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Status</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_status?.map((s: any) => <tr key={s.status} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4"><StatusBadge status={s.status} /></td><td className="py-2 text-surface-900 dark:text-surface-50">{s.count}</td></tr>)}</tbody></table></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Trend</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 pr-4 font-medium text-surface-500">Total</th><th className="py-2 font-medium text-surface-500">Won</th></tr></thead><tbody>{data.monthly_trend?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 pr-4 text-surface-500">{m.total}</td><td className="py-2 text-green-600">{m.won}</td></tr>)}</tbody></table></div>
      </div>
      <button onClick={() => {
        const rows = [['Status', 'Count']];
        data.by_status?.forEach((s: any) => rows.push([s.status, s.count]));
        downloadCSV(rows, 'leads');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function CustomerActivityView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getCustomerActivityReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-4 text-sm text-surface-500">Total Customers: <strong className="text-surface-900 dark:text-surface-50">{data.total}</strong></div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Company</th><th className="py-2 pr-3 font-medium text-surface-500">Contact</th><th className="py-2 pr-3 font-medium text-surface-500">Tickets</th><th className="py-2 pr-3 font-medium text-surface-500">Projects</th><th className="py-2 font-medium text-surface-500">Invoices</th></tr></thead><tbody>{data.data?.map((c: any) => <tr key={c.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{c.company_name}</td><td className="py-2 pr-3 text-surface-500">{c.contact_person}</td><td className="py-2 pr-3 text-surface-500">{c.total_tickets}</td><td className="py-2 pr-3 text-surface-500">{c.total_projects}</td><td className="py-2 text-surface-500">{c.total_invoices}</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Company', 'Contact', 'Email', 'Phone', 'City', 'Tickets', 'Projects', 'Invoices']];
        data.data?.forEach((c: any) => rows.push([c.company_name, c.contact_person, c.email, c.phone, c.city, c.total_tickets, c.total_projects, c.total_invoices]));
        downloadCSV(rows, 'customer-activity');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ProjectsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getProjectReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Projects</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Budget</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_budget)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
        <div className="flex flex-wrap gap-2">{data.by_status?.map((s: any) => <span key={s.status} className="flex items-center gap-2 text-sm"><StatusBadge status={s.status} /><span className="text-surface-500">({s.count})</span></span>)}</div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Customer</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Budget</th><th className="py-2 font-medium text-surface-500">Revenue</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.customer}</td><td className="py-2 pr-3"><StatusBadge status={p.status} /></td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.budget)}</td><td className="py-2 text-green-600">{formatCurrency(p.recorded_revenue)}</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Name', 'Customer', 'Status', 'Budget', 'Revenue', 'Start Date', 'End Date']];
        data.data?.forEach((p: any) => rows.push([p.name, p.customer, p.status, p.budget, p.recorded_revenue, p.start_date, p.end_date]));
        downloadCSV(rows, 'projects');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ProjectBudgetView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getProjectBudgetReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Budget</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_budget)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Actual Cost</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_actual)}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Project</th><th className="py-2 pr-3 font-medium text-surface-500">Customer</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Budget</th><th className="py-2 pr-3 font-medium text-surface-500">Actual</th><th className="py-2 pr-3 font-medium text-surface-500">Variance</th><th className="py-2 font-medium text-surface-500">%</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.customer}</td><td className="py-2 pr-3"><StatusBadge status={p.status} /></td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.budget)}</td><td className="py-2 pr-3 text-red-600">{formatCurrency(p.actual_cost)}</td><td className={`py-2 pr-3 ${p.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(p.variance)}</td><td className={`py-2 ${p.variance_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{p.variance_pct}%</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Project', 'Customer', 'Status', 'Budget', 'Actual Cost', 'Variance', 'Variance %']];
        data.data?.forEach((p: any) => rows.push([p.name, p.customer, p.status, p.budget, p.actual_cost, p.variance, `${p.variance_pct}%`]));
        downloadCSV(rows, 'project-budget');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ResourceView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getResourceAllocationReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Team Members</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Tasks</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total_tasks}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Pending Tasks</p><p className="text-xl font-bold text-orange-600">{data.total_pending}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Role</th><th className="py-2 pr-3 font-medium text-surface-500">Tasks</th><th className="py-2 pr-3 font-medium text-surface-500">Pending</th><th className="py-2 pr-3 font-medium text-surface-500">Done</th><th className="py-2 font-medium text-surface-500">Projects</th></tr></thead><tbody>{data.data?.map((u: any) => <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800 cursor-pointer" onClick={() => setExpanded(expanded === u.id ? null : u.id)}><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{u.name}</td><td className="py-2 pr-3 text-surface-500 capitalize">{u.role.replace(/_/g, ' ')}</td><td className="py-2 pr-3 text-surface-500">{u.total_tasks}</td><td className="py-2 pr-3 text-orange-600">{u.pending_tasks}</td><td className="py-2 pr-3 text-green-600">{u.completed_tasks}</td><td className="py-2 text-surface-500">{u.projects_count}</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Name', 'Role', 'Total Tasks', 'Pending', 'Completed', 'Projects']];
        data.data?.forEach((u: any) => rows.push([u.name, u.role, u.total_tasks, u.pending_tasks, u.completed_tasks, u.projects_count]));
        downloadCSV(rows, 'resource-allocation');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function InventoryView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getInventoryReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Products</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Value</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_value)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{data.low_stock}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Out of Stock</p><p className="text-xl font-bold text-red-600">{data.out_of_stock}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">SKU</th><th className="py-2 pr-3 font-medium text-surface-500">Category</th><th className="py-2 pr-3 font-medium text-surface-500">Qty</th><th className="py-2 pr-3 font-medium text-surface-500">Unit Price</th><th className="py-2 pr-3 font-medium text-surface-500">Total</th><th className="py-2 font-medium text-surface-500">Status</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.sku}</td><td className="py-2 pr-3 text-surface-500">{p.category}</td><td className="py-2 pr-3 text-surface-500">{p.quantity}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.unit_price)}</td><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{formatCurrency(p.total_value)}</td><td className="py-2"><StatusBadge status={p.status} /></td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Name', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Total Value', 'Status']];
        data.data?.forEach((p: any) => rows.push([p.name, p.sku, p.category, p.quantity, p.unit_price, p.total_value, p.status]));
        downloadCSV(rows, 'inventory');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ISPView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getISPReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Subscribers</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total_subscribers}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Active</p><p className="text-xl font-bold text-green-600">{data.active_subscribers}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Outstanding</p><p className="text-xl font-bold text-orange-600">{formatCurrency(data.outstanding)}</p></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Packages</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Package</th><th className="py-2 pr-3 font-medium text-surface-500">Speed</th><th className="py-2 pr-3 font-medium text-surface-500">Price</th><th className="py-2 pr-3 font-medium text-surface-500">Type</th><th className="py-2 font-medium text-surface-500">Subscribers</th></tr></thead><tbody>{data.packages?.map((p: any) => <tr key={p.name} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.speed}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.price)}</td><td className="py-2 pr-3 text-surface-500 capitalize">{p.type}</td><td className="py-2 text-surface-500">{p.subscriber_count}</td></tr>)}</tbody></table></div>
      </div>
      <button onClick={() => {
        const rows = [['Package', 'Speed', 'Price', 'Type', 'Subscribers']];
        data.packages?.forEach((p: any) => rows.push([p.name, p.speed, p.price, p.type, p.subscriber_count]));
        rows.push([''], ['Total Subscribers', data.total_subscribers], ['Active', data.active_subscribers], ['Collected', data.total_collected], ['Outstanding', data.outstanding]);
        downloadCSV(rows, 'isp-analytics');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function TicketsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getTicketReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Tickets</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Open</p><p className="text-xl font-bold text-blue-600">{data.open_tickets}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Resolved</p><p className="text-xl font-bold text-green-600">{data.resolved_tickets}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Resolution Rate</p><p className="text-xl font-bold text-primary-600">{data.resolution_rate}%</p></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Status</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_status?.map((s: any) => <tr key={s.status} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4"><StatusBadge status={s.status} /></td><td className="py-2 text-surface-900 dark:text-surface-50">{s.count}</td></tr>)}</tbody></table></div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Priority</h4>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Priority</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_priority?.map((p: any) => <tr key={p.priority} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{p.priority}</td><td className="py-2 text-surface-900 dark:text-surface-50">{p.count}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      <button onClick={() => {
        const rows = [['Subject', 'Customer', 'Assignee', 'Status', 'Priority', 'Created']];
        data.data?.forEach((t: any) => rows.push([t.subject, t.customer, t.assignee, t.status, t.priority, t.created_at]));
        downloadCSV(rows, 'support-tickets');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function EmployeesView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getEmployeeReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Employees</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Avg Attendance</p><p className="text-xl font-bold text-primary-600">{data.average_attendance}%</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Role</th><th className="py-2 pr-3 font-medium text-surface-500">Department</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Attendance</th><th className="py-2 font-medium text-surface-500">Pending Leave</th></tr></thead><tbody>{data.data?.map((u: any) => <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{u.name}</td><td className="py-2 pr-3 text-surface-500 capitalize">{u.role.replace(/_/g, ' ')}</td><td className="py-2 pr-3 text-surface-500">{u.department}</td><td className="py-2 pr-3"><StatusBadge status={u.status} /></td><td className="py-2 pr-3 text-surface-500">{u.attendance_rate}%</td><td className="py-2 text-orange-600">{u.pending_leaves}</td></tr>)}</tbody></table></div>
      <button onClick={() => {
        const rows = [['Name', 'Email', 'Role', 'Department', 'Status', 'Attendance Rate', 'Present Days', 'Pending Leaves']];
        data.data?.forEach((u: any) => rows.push([u.name, u.email, u.role, u.department, u.status, `${u.attendance_rate}%`, u.present_days, u.pending_leaves]));
        downloadCSV(rows, 'employees');
      }} className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><Download size={16} /> Download CSV</button>
    </div>
  );
}

function ReportView({ report, onClose }: ReportViewProps) {
  const [year, setYear] = useState(new Date().getFullYear());

  const timedReports: ReportKey[] = ['profit-loss', 'revenue', 'expenses'];
  const isTimed = timedReports.includes(report.key);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-surface-900">
        <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${reportColors[report.key]}`}>
              {(() => { const Icon = reportIcons[report.key] || BarChart3; return <Icon size={22} />; })()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{report.name}</h2>
              <p className="text-xs text-surface-500">{report.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isTimed && (
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="input max-w-[120px] text-sm">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"><X size={20} /></button>
          </div>
        </div>
        <div className="px-6 py-4">
          {report.key === 'profit-loss' && <ProfitLossView year={year} />}
          {report.key === 'revenue' && <RevenueView year={year} />}
          {report.key === 'expenses' && <ExpensesView year={year} />}
          {report.key === 'customers' && <CustomersView />}
          {report.key === 'leads' && <LeadsView />}
          {report.key === 'customer-activity' && <CustomerActivityView />}
          {report.key === 'projects' && <ProjectsView />}
          {report.key === 'project-budget' && <ProjectBudgetView />}
          {report.key === 'resource-allocation' && <ResourceView />}
          {report.key === 'inventory' && <InventoryView />}
          {report.key === 'isp' && <ISPView />}
          {report.key === 'tickets' && <TicketsView />}
          {report.key === 'employees' && <EmployeesView />}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporting & Analytics</h1>
          <p className="page-subtitle">Generate and export business reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {reportCategories.map((category) => (
          <div key={category.title} className="card">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.color}`}>
                {(() => { const Icon = category.icon; return <Icon size={22} />; })()}
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-surface-50">{category.title}</h3>
            </div>
            <div className="space-y-3">
              {(category.reports as ReportDef[]).map((report) => (
                <div
                  key={report.key}
                  onClick={() => setActiveReport(report)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-700/50"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{report.name}</p>
                    <p className="text-xs text-surface-500">{report.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-primary-600 dark:hover:bg-surface-700" title="View Report">
                      <BarChart3 size={16} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeReport && (
        <ReportView
          report={activeReport}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
