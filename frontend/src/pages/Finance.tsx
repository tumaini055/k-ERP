import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { Invoice, Expense, InvoiceItem, Payment, CashRequest } from '../types';
import { formatCurrency, formatDate, formatDateTime, getStatusLabel } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, Plus, X, RefreshCw,
  Search, Edit2, Trash2, CreditCard, Receipt, PieChart, Download,
  FolderKanban, ExternalLink, Banknote, Clock, CheckCircle2, XCircle, Ban,
} from 'lucide-react';

const invStatusColors: Record<string, string> = {
  draft: 'badge-info', sent: 'badge-warning', paid: 'badge-success',
  overdue: 'badge-danger', cancelled: 'badge-danger',
};
const expCategoryColors: Record<string, string> = {
  office: 'badge-info', travel: 'badge-warning', utilities: 'badge-info',
  salary: 'badge-success', maintenance: 'badge-warning', equipment: 'badge-danger',
  other: 'badge-info',
};
const invoiceTypes = ['invoice', 'quotation', 'proforma', 'receipt'];
const expenseCategories = ['office', 'travel', 'utilities', 'salary', 'maintenance', 'equipment', 'other'];
const paymentMethods = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'card'];
const paymentMethodLabels: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', mobile_money: 'Mobile Money',
  cheque: 'Cheque', card: 'Card',
};

type TabType = 'invoices' | 'expenses' | 'revenue' | 'cash_requests';

export default function Finance() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('invoices');
  const [loading, setLoading] = useState(true);

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invTypeFilter, setInvTypeFilter] = useState('');

  // Expenses
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expCatFilter, setExpCatFilter] = useState('');
  const [expFromDate, setExpFromDate] = useState('');
  const [expToDate, setExpToDate] = useState('');

  // Revenue
  const [revenueData, setRevenueData] = useState<any>(null);
  const [projectIncome, setProjectIncome] = useState<any[]>([]);
  const [loadingProjectIncome, setLoadingProjectIncome] = useState(false);

  // Side panel
  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [invDetail, setInvDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'items' | 'payments'>('overview');

  // Modals
  const [showInvModal, setShowInvModal] = useState(false);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [invForm, setInvForm] = useState({
    customer_id: '', project_id: '', invoice_type: 'invoice', issue_date: new Date().toISOString().split('T')[0],
    due_date: '', tax_rate: 18, discount_amount: 0, notes: '', terms: '',
  });
  const [invItems, setInvItems] = useState<{ description: string; quantity: number; unit_price: number }[]>(
    [{ description: '', quantity: 1, unit_price: 0 }]
  );

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: 0, payment_method: 'cash', reference_number: '', notes: '' });

  const [showExpModal, setShowExpModal] = useState(false);
  const [expForm, setExpForm] = useState({
    category: 'other', description: '', amount: 0, expense_date: new Date().toISOString().split('T')[0],
    project_id: '', paid_to: '', payment_method: 'cash',
  });

  // Cash Requests
  const [cashRequests, setCashRequests] = useState<CashRequest[]>([]);
  const [cashReqStatusFilter, setCashReqStatusFilter] = useState('');
  const [cashReqSummary, setCashReqSummary] = useState<any>(null);
  const [showCashReqModal, setShowCashReqModal] = useState(false);
  const [cashReqForm, setCashReqForm] = useState({
    amount: 0, purpose: '', category: 'general', payment_method: 'cash', notes: '',
  });
  const [selectedCashReq, setSelectedCashReq] = useState<CashRequest | null>(null);
  const [showCashReqDetail, setShowCashReqDetail] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState('');
  const [cashReqActionLoading, setCashReqActionLoading] = useState(false);

  const cashReqCategories = ['general', 'office_supplies', 'travel', 'project_expenses', 'utilities', 'maintenance', 'emergency', 'other'];
  const cashReqStatusColors: Record<string, string> = {
    pending: 'badge-warning', approved: 'badge-info', rejected: 'badge-danger',
    disbursed: 'badge-success', cancelled: 'badge-danger',
  };

  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (invSearch) params.search = invSearch;
      if (invStatusFilter) params.status = invStatusFilter;
      if (invTypeFilter) params.type = invTypeFilter;
      const { data } = await dataService.getInvoices(params);
      setInvoices(data || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (expCatFilter) params.category = expCatFilter;
      if (expFromDate) params.from_date = expFromDate;
      if (expToDate) params.to_date = expToDate;
      const { data } = await dataService.getExpenses(params);
      setExpenses(data || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const [revRes, incomeRes] = await Promise.all([
        dataService.getRevenue(),
        dataService.getProjectIncomeSummary(),
      ]);
      setRevenueData(revRes);
      setProjectIncome(incomeRes?.projects || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const fetchProjectIncome = async () => {
    setLoadingProjectIncome(true);
    try {
      const res = await dataService.getProjectIncomeSummary();
      setProjectIncome(res?.projects || []);
    } catch (error) { console.error(error); }
    setLoadingProjectIncome(false);
  };

  const fetchCashRequests = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (cashReqStatusFilter) params.status = cashReqStatusFilter;
      const res = await dataService.getCashRequests(params);
      setCashRequests(res?.data || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const fetchCashReqSummary = async () => {
    try {
      const res = await dataService.getCashRequestSummary();
      setCashReqSummary(res);
    } catch (error) { console.error(error); }
  };

  const handleCreateCashRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashReqForm.amount || !cashReqForm.purpose) { toast.error('Amount and purpose are required'); return; }
    try {
      await dataService.createCashRequest(cashReqForm);
      toast.success('Cash request submitted');
      setShowCashReqModal(false);
      setCashReqForm({ amount: 0, purpose: '', category: 'general', payment_method: 'cash', notes: '' });
      fetchCashRequests();
      fetchCashReqSummary();
    } catch (error) { toast.error('Failed to submit cash request'); }
  };

  const handleApproveCashRequest = async (id: string) => {
    setCashReqActionLoading(true);
    try {
      await dataService.approveCashRequest(id);
      toast.success('Cash request approved');
      setShowCashReqDetail(false);
      fetchCashRequests();
      fetchCashReqSummary();
    } catch (error) { toast.error('Failed to approve'); }
    setCashReqActionLoading(false);
  };

  const handleRejectCashRequest = async () => {
    setCashReqActionLoading(true);
    try {
      await dataService.rejectCashRequest(rejectTargetId, rejectReason);
      toast.success('Cash request rejected');
      setShowRejectModal(false);
      setShowCashReqDetail(false);
      setRejectReason('');
      fetchCashRequests();
      fetchCashReqSummary();
    } catch (error) { toast.error('Failed to reject'); }
    setCashReqActionLoading(false);
  };

  const handleDisburseCashRequest = async (id: string) => {
    setCashReqActionLoading(true);
    try {
      await dataService.disburseCashRequest(id);
      toast.success('Cash disbursed successfully');
      setShowCashReqDetail(false);
      fetchCashRequests();
      fetchCashReqSummary();
    } catch (error) { toast.error('Failed to disburse'); }
    setCashReqActionLoading(false);
  };

  const handleDeleteCashRequest = async (id: string) => {
    if (!confirm('Delete this cash request?')) return;
    try {
      await dataService.deleteCashRequest(id);
      toast.success('Cash request deleted');
      fetchCashRequests();
      fetchCashReqSummary();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const isApprover = (user?: any) => {
    return user && ['super_admin', 'ceo', 'managing_director', 'accountant'].includes(user.role);
  };

  useEffect(() => {
    if (tab === 'invoices') fetchInvoices();
    else if (tab === 'expenses') fetchExpenses();
    else if (tab === 'cash_requests') { fetchCashRequests(); fetchCashReqSummary(); }
    else fetchRevenue();
  }, [tab, invSearch, invStatusFilter, invTypeFilter, expCatFilter, expFromDate, expToDate, cashReqStatusFilter]);

  useEffect(() => {
    dataService.getCustomers({ limit: 500 }).then((r: any) => setCustomers(r.data || [])).catch(() => {});
    dataService.getProjects({ limit: 200 }).then((r: any) => setProjects(r.data || [])).catch(() => {});
  }, []);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.balance), 0);
  const totalExpenses = expenses.reduce((s, e: any) => s + Number(e.amount), 0);

  const openInvDetail = async (inv: Invoice) => {
    setSelectedInv(inv);
    setDetailTab('overview');
    try {
      const { data } = await dataService.getInvoice(inv.id);
      setInvDetail(data);
    } catch (error) { console.error(error); }
  };

  const closeDetail = () => { setSelectedInv(null); setInvDetail(null); };

  const openNewInv = () => {
    setEditingInv(null);
    setInvForm({
      customer_id: '', project_id: '', invoice_type: 'invoice',
      issue_date: new Date().toISOString().split('T')[0], due_date: '',
      tax_rate: 18, discount_amount: 0, notes: '', terms: '',
    });
    setInvItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setShowInvModal(true);
  };

  const openEditInv = () => {
    if (!invDetail) return;
    setEditingInv(invDetail);
    setInvForm({
      customer_id: invDetail.customer_id || '', project_id: invDetail.project_id || '',
      invoice_type: invDetail.invoice_type || 'invoice',
      issue_date: invDetail.issue_date?.split('T')[0] || '',
      due_date: invDetail.due_date?.split('T')[0] || '',
      tax_rate: invDetail.tax_rate || 18, discount_amount: invDetail.discount_amount || 0,
      notes: invDetail.notes || '', terms: invDetail.terms || '',
    });
    setInvItems((invDetail.items || []).map((i: InvoiceItem) => ({
      description: i.description, quantity: i.quantity, unit_price: i.unit_price,
    })));
    if (invItems.length === 0) setInvItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setShowInvModal(true);
  };

  const handleSaveInv = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = invItems.filter(i => i.description && i.quantity > 0);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    try {
      const body = { ...invForm, items: validItems };
      if (editingInv) {
        await dataService.updateInvoice(editingInv.id, body);
        toast.success('Invoice updated');
      } else {
        await dataService.createInvoice(body);
        toast.success('Invoice created');
      }
      setShowInvModal(false);
      fetchInvoices();
    } catch (error) { toast.error('Failed to save invoice'); }
  };

  const handleRecordPayment = async () => {
    if (!selectedInv || !payForm.amount) return;
    try {
      await dataService.recordPayment(selectedInv.id, payForm);
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayForm({ amount: 0, payment_method: 'cash', reference_number: '', notes: '' });
      if (selectedInv) {
        const { data } = await dataService.getInvoice(selectedInv.id);
        setInvDetail(data);
      }
      fetchInvoices();
    } catch (error) { toast.error('Failed to record payment'); }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dataService.createExpense(expForm);
      toast.success('Expense recorded');
      setShowExpModal(false);
      setExpForm({ category: 'other', description: '', amount: 0, expense_date: new Date().toISOString().split('T')[0], project_id: '', paid_to: '', payment_method: 'cash' });
      fetchExpenses();
    } catch (error) { toast.error('Failed to create expense'); }
  };

  const handleDeleteInv = async (id: string) => {
    if (!confirm('Delete this invoice permanently?')) return;
    try {
      await dataService.deleteInvoice(id);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (error: any) { toast.error(error?.response?.data?.error || 'Failed to delete'); }
  };

  const handleDeleteExp = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await dataService.deleteExpense(id);
      toast.success('Expense deleted');
      fetchExpenses();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const calcSubtotal = () => invItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const calcTax = () => calcSubtotal() * (invForm.tax_rate || 0) / 100;
  const calcTotal = () => calcSubtotal() + calcTax() - (invForm.discount_amount || 0);

  const renderTabBar = () => (
    <div className="flex border-b border-surface-200 dark:border-surface-700 mb-6">
      {(['invoices', 'expenses', 'cash_requests', 'revenue'] as const).map((t) => (
        <button key={t} onClick={() => setTab(t)}
          className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
            tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}>
          {t === 'invoices' && <><Receipt size={14} className="inline mr-1.5" />Invoices</>}
          {t === 'expenses' && <><TrendingDown size={14} className="inline mr-1.5" />Expenses</>}
          {t === 'cash_requests' && <><Banknote size={14} className="inline mr-1.5" />Cash Requests</>}
          {t === 'revenue' && <><PieChart size={14} className="inline mr-1.5" />Revenue</>}
        </button>
      ))}
    </div>
  );

  const calcInvBalance = (inv: Invoice) => Number(inv.total_amount) - Number(inv.paid_amount);

  const id = invDetail;
  const items: InvoiceItem[] = id?.items || [];
  const payments: Payment[] = id?.payments || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance & Accounting</h1>
          <p className="page-subtitle">Manage invoices, payments, expenses, and revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (tab === 'invoices') fetchInvoices(); else if (tab === 'expenses') fetchExpenses(); else if (tab === 'cash_requests') { fetchCashRequests(); fetchCashReqSummary(); } else fetchRevenue(); }} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          {tab === 'invoices' && (
            <button onClick={openNewInv} className="btn-primary">
              <Plus size={18} className="mr-1" /> New Invoice
            </button>
          )}
          {tab === 'expenses' && (
            <button onClick={() => setShowExpModal(true)} className="btn-primary">
              <Plus size={18} className="mr-1" /> Add Expense
            </button>
          )}
          {tab === 'cash_requests' && (
            <button onClick={() => setShowCashReqModal(true)} className="btn-primary">
              <Plus size={18} className="mr-1" /> Request Cash
            </button>
          )}
        </div>
      </div>

      {tab !== 'revenue' && tab !== 'cash_requests' && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><TrendingUp size={22} /></div>
            <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrency(tab === 'invoices' ? totalRevenue : totalExpenses)}</p><p className="stat-label">{tab === 'invoices' ? 'Total Revenue' : 'Total Expenses'}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><DollarSign size={22} /></div>
            <div className="min-w-0 overflow-hidden"><p className="stat-value">{tab === 'invoices' ? formatCurrency(outstanding) : expenses.length}</p><p className="stat-label">{tab === 'invoices' ? 'Outstanding' : 'Transactions'}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><FileText size={22} /></div>
            <div className="min-w-0 overflow-hidden"><p className="stat-value">{tab === 'invoices' ? invoices.length : expenses.filter((e: any) => e.category === 'salary').length}</p><p className="stat-label">{tab === 'invoices' ? 'Total Invoices' : 'Salary Items'}</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon shrink-0 bg-red-100 text-red-600"><TrendingDown size={22} /></div>
            <div className="min-w-0 overflow-hidden"><p className="stat-value">{tab === 'invoices' ? invoices.filter(i => i.status === 'overdue').length : 0}</p><p className="stat-label">{tab === 'invoices' ? 'Overdue' : '—'}</p></div>
          </div>
        </div>
      )}

      {renderTabBar()}

      {/* ===== INVOICES TAB ===== */}
      {tab === 'invoices' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9" placeholder="Search invoices..." value={invSearch} onChange={e => setInvSearch(e.target.value)} />
            </div>
            <select className="input w-auto min-w-[120px]" value={invStatusFilter} onChange={e => setInvStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="input w-auto min-w-[120px]" value={invTypeFilter} onChange={e => setInvTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {invoiceTypes.map(t => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-surface-400">No invoices found</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="cursor-pointer" onClick={() => openInvDetail(inv)}>
                      <td className="font-mono text-xs">{inv.invoice_number}</td>
                      <td className="capitalize text-xs">{inv.invoice_type}</td>
                      <td className="font-medium">{inv.customer?.company_name || '-'}</td>
                      <td className="text-xs">{formatDate(inv.issue_date)}</td>
                      <td className="text-xs">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                      <td className="font-medium">{formatCurrency(inv.total_amount)}</td>
                      <td>{formatCurrency(inv.paid_amount)}</td>
                      <td className={`font-medium ${calcInvBalance(inv) > 0 ? 'text-red-600' : 'text-accent-600'}`}>{formatCurrency(calcInvBalance(inv))}</td>
                      <td><span className={invStatusColors[inv.status]}>{getStatusLabel(inv.status)}</span></td>
                      <td>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteInv(inv.id); }} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== EXPENSES TAB ===== */}
      {tab === 'expenses' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className="input w-auto min-w-[130px]" value={expCatFilter} onChange={e => setExpCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {expenseCategories.map(c => <option key={c} value={c}>{getStatusLabel(c)}</option>)}
            </select>
            <input type="date" className="input w-auto" value={expFromDate} onChange={e => setExpFromDate(e.target.value)} placeholder="From" />
            <input type="date" className="input w-auto" value={expToDate} onChange={e => setExpToDate(e.target.value)} placeholder="To" />
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Paid To</th>
                  <th>Method</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-surface-400">No expenses found</td></tr>
                ) : (
                  expenses.map((exp: any) => (
                    <tr key={exp.id}>
                      <td className="text-xs">{formatDate(exp.expense_date)}</td>
                      <td><span className={(expCategoryColors as any)[exp.category] || 'badge-info'}>{getStatusLabel(exp.category)}</span></td>
                      <td className="max-w-[200px] truncate">{exp.description || '-'}</td>
                      <td className="text-xs">{exp.project?.name || '-'}</td>
                      <td className="font-medium text-red-600">{formatCurrency(exp.amount)}</td>
                      <td className="text-xs">{exp.paid_to || '-'}</td>
                      <td className="text-xs capitalize">{exp.payment_method || '-'}</td>
                      <td>
                        <button onClick={() => handleDeleteExp(exp.id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== CASH REQUESTS TAB ===== */}
      {tab === 'cash_requests' && (
        <>
          {/* Stat Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Clock size={22} /></div>
              <div className="min-w-0 overflow-hidden"><p className="stat-value">{cashReqSummary?.pending || 0}</p><p className="stat-label">Pending Requests</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><CheckCircle2 size={22} /></div>
              <div className="min-w-0 overflow-hidden"><p className="stat-value">{cashReqSummary?.approved || 0}</p><p className="stat-label">Approved</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><Banknote size={22} /></div>
              <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrency(cashReqSummary?.total_disbursed || 0)}</p><p className="stat-label">Total Disbursed</p></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-red-100 text-red-600"><DollarSign size={22} /></div>
              <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrency(cashReqSummary?.total_requested || 0)}</p><p className="stat-label">Total Requested</p></div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className="input w-auto min-w-[130px]" value={cashReqStatusFilter} onChange={e => setCashReqStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="disbursed">Disbursed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Requested By</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
                ) : cashRequests.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-surface-400">No cash requests found</td></tr>
                ) : (
                  cashRequests.map((cr) => (
                    <tr key={cr.id} className="cursor-pointer" onClick={() => { setSelectedCashReq(cr); setShowCashReqDetail(true); }}>
                      <td className="font-mono text-xs">{cr.reference_number}</td>
                      <td className="text-sm">{cr.requested_by_user ? `${cr.requested_by_user.first_name} ${cr.requested_by_user.last_name}` : '-'}</td>
                      <td className="font-medium">{formatCurrency(cr.amount)}</td>
                      <td className="max-w-[200px] truncate text-sm">{cr.purpose}</td>
                      <td className="text-xs capitalize">{getStatusLabel(cr.category)}</td>
                      <td className="text-xs capitalize">{paymentMethodLabels[cr.payment_method] || cr.payment_method}</td>
                      <td><span className={cashReqStatusColors[cr.status]}>{getStatusLabel(cr.status)}</span></td>
                      <td className="text-xs">{formatDate(cr.created_at)}</td>
                      <td>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCashRequest(cr.id); }} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== REVENUE TAB ===== */}
      {tab === 'revenue' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></p>
          ) : !revenueData ? (
            <p className="text-center py-12 text-surface-400">No revenue data available</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="card">
                  <p className="text-sm text-surface-500">Net Profit</p>
                  <p className={`text-3xl font-bold ${revenueData.profit >= 0 ? 'text-accent-600' : 'text-red-600'}`}>{formatCurrency(revenueData.profit)}</p>
                  <p className="text-xs text-surface-400 mt-1">Revenue - Expenses</p>
                </div>
                <div className="card">
                  <p className="text-sm text-surface-500">Total Revenue</p>
                  <p className="text-3xl font-bold text-primary-600">{formatCurrency(revenueData.total_revenue)}</p>
                  <p className="text-xs text-surface-400 mt-1">{(revenueData.payments || []).length} payments</p>
                </div>
                <div className="card">
                  <p className="text-sm text-surface-500">Total Expenses</p>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(revenueData.total_expenses)}</p>
                  <p className="text-xs text-surface-400 mt-1">{Object.keys(revenueData.expenses_by_category || {}).length} categories</p>
                </div>
                <div className="card">
                  <p className="text-sm text-surface-500">Avg per Transaction</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency((revenueData.payments || []).length > 0
                      ? revenueData.total_revenue / revenueData.payments.length : 0)}
                  </p>
                </div>
              </div>

              {revenueData.profit >= 0 ? (
                <div className="rounded-lg border border-accent-200 bg-accent-50 p-4 dark:border-accent-800 dark:bg-accent-900/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-accent-600" />
                    <p className="text-sm font-semibold text-accent-700">Your company is profitable this period</p>
                  </div>
                  <p className="text-xs text-accent-600 mt-1">Net profit margin: {revenueData.total_revenue > 0 ? ((revenueData.profit / revenueData.total_revenue) * 100).toFixed(1) : 0}%</p>
                </div>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={18} className="text-red-600" />
                    <p className="text-sm font-semibold text-red-700">Your company is running at a loss this period</p>
                  </div>
                  <p className="text-xs text-red-600 mt-1">Net loss margin: {revenueData.total_revenue > 0 ? ((revenueData.profit / revenueData.total_revenue) * 100).toFixed(1) : 0}%</p>
                </div>
              )}

              {revenueData.by_method && Object.keys(revenueData.by_method).length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="card">
                    <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Revenue by Payment Method</p>
                    <div className="space-y-3">
                      {Object.entries(revenueData.by_method).map(([method, amount]: [string, any]) => {
                        const pct = revenueData.total_revenue > 0 ? (Number(amount) / revenueData.total_revenue) * 100 : 0;
                        return (
                          <div key={method}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium capitalize">{paymentMethodLabels[method] || method}</span>
                              <span className="font-semibold">{formatCurrency(Number(amount))} <span className="text-xs text-surface-400">({pct.toFixed(1)}%)</span></span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700">
                              <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {revenueData.expenses_by_category && Object.keys(revenueData.expenses_by_category).length > 0 && (
                    <div className="card">
                      <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Expenses by Category</p>
                      <div className="space-y-3">
                        {Object.entries(revenueData.expenses_by_category).map(([category, amount]: [string, any]) => {
                          const pct = revenueData.total_expenses > 0 ? (Number(amount) / revenueData.total_expenses) * 100 : 0;
                          return (
                            <div key={category}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium capitalize">{getStatusLabel(category)}</span>
                                <span className="font-semibold">{formatCurrency(Number(amount))} <span className="text-xs text-surface-400">({pct.toFixed(1)}%)</span></span>
                              </div>
                              <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700">
                                <div className="h-2 rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== PROJECT INCOME BREAKDOWN ===== */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    <FolderKanban size={16} className="inline mr-1.5" />
                    Income by Project
                  </p>
                  <button onClick={fetchProjectIncome} className="btn-secondary text-xs py-1 px-2">
                    <RefreshCw size={12} className="mr-1" /> Refresh
                  </button>
                </div>

                {loadingProjectIncome ? (
                  <p className="text-center py-6"><RefreshCw size={16} className="mx-auto animate-spin text-surface-400" /></p>
                ) : projectIncome.length === 0 ? (
                  <p className="text-center py-6 text-surface-400">No project income data</p>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Status</th>
                          <th>Invoiced (TZS)</th>
                          <th>Paid (TZS)</th>
                          <th>Balance (TZS)</th>
                          <th>Revenue on Complete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectIncome.map((p: any) => (
                          <tr key={p.id}>
                            <td>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm">{p.name}</span>
                                <span className="font-mono text-xs text-surface-400">({p.project_code})</span>
                              </div>
                            </td>
                            <td><span className={`badge-${p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'warning' : 'info'}`}>{p.status?.replace('_', ' ')}</span></td>
                            <td className="font-medium">{formatCurrency(p.total_invoiced)}</td>
                            <td className="font-medium text-accent-600">{formatCurrency(p.total_paid)}</td>
                            <td className={`font-medium ${p.total_balance > 0 ? 'text-red-600' : 'text-accent-600'}`}>{formatCurrency(p.total_balance)}</td>
                            <td className="text-blue-600 font-medium">{formatCurrency(p.recorded_revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(revenueData.payments || []).length > 0 && (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(revenueData.payments as any[]).map((p: any, i: number) => (
                        <tr key={i}>
                          <td className="text-xs">{formatDate(p.payment_date)}</td>
                          <td className="font-medium text-accent-600">{formatCurrency(p.amount)}</td>
                          <td className="text-xs capitalize">{paymentMethodLabels[p.payment_method] || p.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Invoice Side Panel */}
      {selectedInv && invDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold">{id.invoice_number}</h2>
                <p className="text-xs text-surface-500 capitalize">{id.invoice_type} · {id.customer?.company_name || 'No customer'}</p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'items', 'payments'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' && <><FileText size={14} className="inline mr-1" />Overview</>}
                  {t === 'items' && <><Receipt size={14} className="inline mr-1" />Items ({items.length})</>}
                  {t === 'payments' && <><CreditCard size={14} className="inline mr-1" />Payments ({payments.length})</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className={invStatusColors[id.status]}>{getStatusLabel(id.status)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => dataService.downloadInvoicePdf(id.id)} className="btn-secondary text-xs py-1.5 px-3">
                        <Download size={14} className="mr-1" /> PDF
                      </button>
                      <button onClick={openEditInv} className="btn-secondary text-xs py-1.5 px-3">
                        <Edit2 size={14} className="mr-1" /> Edit
                      </button>
                      {id.status !== 'paid' && (
                        <button onClick={() => { setPayForm({ amount: calcInvBalance(id), payment_method: 'cash', reference_number: '', notes: '' }); setShowPayModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                          <CreditCard size={14} className="mr-1" /> Record Payment
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold">Invoice Summary</p>
                      <p className={`text-2xl font-bold ${calcInvBalance(id) > 0 ? 'text-red-600' : 'text-accent-600'}`}>{formatCurrency(id.total_amount)}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(id.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-surface-500">Tax ({(id as any).tax_rate || 18}%)</span><span>{formatCurrency(id.tax_amount)}</span></div>
                      {(id as any).discount_amount > 0 && <div className="flex justify-between"><span className="text-surface-500">Discount</span><span className="text-red-500">-{formatCurrency((id as any).discount_amount)}</span></div>}
                      <div className="flex justify-between font-semibold border-t border-surface-200 pt-1 dark:border-surface-700"><span>Total</span><span>{formatCurrency(id.total_amount)}</span></div>
                      <div className="flex justify-between text-accent-600"><span>Paid</span><span>{formatCurrency(id.paid_amount)}</span></div>
                      <div className="flex justify-between font-bold"><span>Balance</span><span className={calcInvBalance(id) > 0 ? 'text-red-600' : 'text-accent-600'}>{formatCurrency(calcInvBalance(id))}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-surface-500">Customer</p><p className="text-sm font-medium">{id.customer?.company_name || id.customer?.contact_person || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Type</p><p className="text-sm font-medium capitalize">{id.invoice_type}</p></div>
                    <div><p className="text-xs text-surface-500">Issue Date</p><p className="text-sm font-medium">{formatDate(id.issue_date)}</p></div>
                    <div><p className="text-xs text-surface-500">Due Date</p><p className="text-sm font-medium">{id.due_date ? formatDate(id.due_date) : '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Created</p><p className="text-sm font-medium">{formatDateTime(id.created_at)}</p></div>
                  </div>

                  {id.notes && <div><p className="text-xs text-surface-500">Notes</p><p className="text-sm">{id.notes}</p></div>}
                </div>
              )}

              {detailTab === 'items' && (
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No items</p>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr><th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={item.id || i}>
                              <td className="text-xs text-surface-400">{i + 1}</td>
                              <td className="text-sm">{item.description}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.unit_price)}</td>
                              <td className="font-medium">{formatCurrency(item.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Payment History</p>
                    {id.status !== 'paid' && (
                      <button onClick={() => { setPayForm({ amount: calcInvBalance(id), payment_method: 'cash', reference_number: '', notes: '' }); setShowPayModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                        <Plus size={14} className="mr-1" /> Record Payment
                      </button>
                    )}
                  </div>
                  {payments.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No payments recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((p: any) => (
                        <div key={p.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-accent-600">{formatCurrency(p.amount)}</span>
                                <span className="badge-info text-[10px] capitalize">{paymentMethodLabels[p.payment_method] || p.payment_method}</span>
                              </div>
                              {p.reference_number && <p className="text-xs text-surface-400">Ref: {p.reference_number}</p>}
                              {p.notes && <p className="text-xs text-surface-400">{p.notes}</p>}
                            </div>
                            <p className="text-xs text-surface-400">{formatDateTime(p.payment_date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Invoice Modal */}
      {showInvModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{editingInv ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button onClick={() => setShowInvModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveInv} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={invForm.invoice_type} onChange={e => setInvForm({...invForm, invoice_type: e.target.value})}>
                    {invoiceTypes.map(t => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Customer</label>
                  <select className="input" value={invForm.customer_id} onChange={e => setInvForm({...invForm, customer_id: e.target.value})}>
                    <option value="">Select customer</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Project (optional)</label>
                  <select className="input" value={invForm.project_id} onChange={e => setInvForm({...invForm, project_id: e.target.value})}>
                    <option value="">No project</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Issue Date</label>
                  <input type="date" className="input" value={invForm.issue_date} onChange={e => setInvForm({...invForm, issue_date: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={invForm.due_date} onChange={e => setInvForm({...invForm, due_date: e.target.value})} />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Invoice Items</label>
                  <button type="button" onClick={() => setInvItems([...invItems, { description: '', quantity: 1, unit_price: 0 }])} className="btn-secondary text-xs py-1 px-2">
                    <Plus size={12} className="mr-1" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {invItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="input flex-1" placeholder="Description" value={item.description} onChange={e => {
                        const items = [...invItems]; items[i].description = e.target.value; setInvItems(items);
                      }} required />
                      <input type="number" className="input w-20 text-center" placeholder="Qty" value={item.quantity || ''} onChange={e => {
                        const items = [...invItems]; items[i].quantity = Number(e.target.value); setInvItems(items);
                      }} min={1} required />
                      <input type="number" className="input w-28" placeholder="Unit Price" value={item.unit_price || ''} onChange={e => {
                        const items = [...invItems]; items[i].unit_price = Number(e.target.value); setInvItems(items);
                      }} min={0} required />
                      <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                      {invItems.length > 1 && (
                        <button type="button" onClick={() => setInvItems(invItems.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Tax Rate (%)</label>
                  <input type="number" className="input" value={invForm.tax_rate || ''} onChange={e => setInvForm({...invForm, tax_rate: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Discount (TZS)</label>
                  <input type="number" className="input" value={invForm.discount_amount || ''} onChange={e => setInvForm({...invForm, discount_amount: Number(e.target.value)})} />
                </div>
                <div className="flex items-end justify-end">
                  <div className="text-right">
                    <p className="text-xs text-surface-400">Subtotal: {formatCurrency(calcSubtotal())}</p>
                    <p className="text-xs text-surface-400">Tax: {formatCurrency(calcTax())}</p>
                    <p className="text-sm font-bold text-primary-600">Total: {formatCurrency(calcTotal())}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={invForm.notes} onChange={e => setInvForm({...invForm, notes: e.target.value})} />
                </div>
                <div>
                  <label className="label">Terms</label>
                  <textarea className="input" rows={2} value={invForm.terms} onChange={e => setInvForm({...invForm, terms: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInvModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingInv ? 'Update' : 'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {selectedInv && (
                <div className="text-sm text-surface-500 space-y-1">
                  <p>Invoice: <span className="font-medium text-surface-900">{selectedInv.invoice_number}</span></p>
                  <p>Total: <span className="font-medium">{formatCurrency(selectedInv.total_amount)}</span></p>
                  <p>Balance: <span className="font-bold text-red-600">{formatCurrency(calcInvBalance(invDetail || selectedInv))}</span></p>
                </div>
              )}
              <div>
                <label className="label">Amount *</label>
                <input type="number" className="input" value={payForm.amount || ''} onChange={e => setPayForm({...payForm, amount: Number(e.target.value)})} />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={payForm.payment_method} onChange={e => setPayForm({...payForm, payment_method: e.target.value})}>
                  {paymentMethods.map(m => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Reference Number</label>
                <input className="input" value={payForm.reference_number} onChange={e => setPayForm({...payForm, reference_number: e.target.value})} placeholder="Cheque #, TXN ID, etc." />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowPayModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleRecordPayment} disabled={!payForm.amount} className="btn-primary">
                  <CreditCard size={14} className="mr-1" /> Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button onClick={() => setShowExpModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={expForm.category} onChange={e => setExpForm({...expForm, category: e.target.value})}>
                    {expenseCategories.map(c => <option key={c} value={c}>{getStatusLabel(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount (TZS) *</label>
                  <input type="number" className="input" value={expForm.amount || ''} onChange={e => setExpForm({...expForm, amount: Number(e.target.value)})} required />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Expense Date</label>
                  <input type="date" className="input" value={expForm.expense_date} onChange={e => setExpForm({...expForm, expense_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="input" value={expForm.payment_method} onChange={e => setExpForm({...expForm, payment_method: e.target.value})}>
                    {paymentMethods.map(m => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Project (optional)</label>
                  <select className="input" value={expForm.project_id} onChange={e => setExpForm({...expForm, project_id: e.target.value})}>
                    <option value="">No project</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Paid To</label>
                  <input className="input" value={expForm.paid_to} onChange={e => setExpForm({...expForm, paid_to: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowExpModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary"><Plus size={14} className="mr-1" /> Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== CASH REQUEST DETAIL SIDE PANEL ===== */}
      {showCashReqDetail && selectedCashReq && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold">{selectedCashReq.reference_number}</h2>
                <p className="text-xs text-surface-500 capitalize">{getStatusLabel(selectedCashReq.category)} request</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => dataService.downloadCashRequestPdf(selectedCashReq.id).catch(() => toast.error('Failed to download PDF'))} className="btn-secondary text-xs py-1.5 px-3">
                  <Download size={14} className="mr-1 inline" /> PDF
                </button>
                <button onClick={() => { setShowCashReqDetail(false); setSelectedCashReq(null); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className={cashReqStatusColors[selectedCashReq.status]}>{getStatusLabel(selectedCashReq.status)}</span>
                <span className="text-2xl font-bold text-primary-600">{formatCurrency(selectedCashReq.amount)}</span>
              </div>

              <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-surface-500">Reference</span><span className="font-mono">{selectedCashReq.reference_number}</span></div>
                <div className="flex justify-between text-sm"><span className="text-surface-500">Requested By</span><span className="font-medium">{selectedCashReq.requested_by_user ? `${selectedCashReq.requested_by_user.first_name} ${selectedCashReq.requested_by_user.last_name}` : '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-surface-500">Email</span><span>{selectedCashReq.requested_by_user?.email || '-'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-surface-500">Category</span><span className="capitalize">{getStatusLabel(selectedCashReq.category)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-surface-500">Payment Method</span><span className="capitalize">{paymentMethodLabels[selectedCashReq.payment_method] || selectedCashReq.payment_method}</span></div>
                <div className="flex justify-between text-sm"><span className="text-surface-500">Requested On</span><span>{formatDateTime(selectedCashReq.created_at)}</span></div>
              </div>

              <div>
                <p className="text-xs text-surface-500 mb-1">Purpose</p>
                <p className="text-sm bg-surface-50 dark:bg-surface-700 rounded-lg p-3">{selectedCashReq.purpose}</p>
              </div>

              {selectedCashReq.notes && (
                <div>
                  <p className="text-xs text-surface-500 mb-1">Notes</p>
                  <p className="text-sm">{selectedCashReq.notes}</p>
                </div>
              )}

              {selectedCashReq.status === 'rejected' && selectedCashReq.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-xs font-medium text-red-600 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{selectedCashReq.rejection_reason}</p>
                </div>
              )}

              {selectedCashReq.approved_by_user && (
                <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                  <p className="text-xs text-surface-500 mb-1">{selectedCashReq.status === 'rejected' ? 'Reviewed' : 'Approved'} by</p>
                  <p className="text-sm font-medium">{selectedCashReq.approved_by_user.first_name} {selectedCashReq.approved_by_user.last_name}</p>
                  {selectedCashReq.approved_at && <p className="text-xs text-surface-400">{formatDateTime(selectedCashReq.approved_at)}</p>}
                </div>
              )}

              {selectedCashReq.disbursed_by_user && (
                <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 dark:border-accent-800 dark:bg-accent-900/20">
                  <p className="text-xs text-surface-500 mb-1">Disbursed by</p>
                  <p className="text-sm font-medium">{selectedCashReq.disbursed_by_user.first_name} {selectedCashReq.disbursed_by_user.last_name}</p>
                  {selectedCashReq.disbursed_at && <p className="text-xs text-surface-400">{formatDateTime(selectedCashReq.disbursed_at)}</p>}
                </div>
              )}

              {/* Action Buttons */}
              {selectedCashReq.status === 'pending' && isApprover(user) && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => handleApproveCashRequest(selectedCashReq.id)} disabled={cashReqActionLoading} className="btn-primary flex-1">
                    <CheckCircle2 size={14} className="mr-1" /> Approve
                  </button>
                  <button onClick={() => { setRejectTargetId(selectedCashReq.id); setShowRejectModal(true); }} disabled={cashReqActionLoading} className="btn-danger flex-1">
                    <XCircle size={14} className="mr-1" /> Reject
                  </button>
                </div>
              )}

              {selectedCashReq.status === 'approved' && isApprover(user) && (
                <button onClick={() => handleDisburseCashRequest(selectedCashReq.id)} disabled={cashReqActionLoading} className="btn-primary w-full">
                  <Banknote size={14} className="mr-1" /> Mark as Disbursed
                </button>
              )}

              {selectedCashReq.status === 'pending' && selectedCashReq.requested_by === user?.id && !isApprover(user) && (
                <button onClick={() => { if (confirm('Cancel this cash request?')) { dataService.cancelCashRequest(selectedCashReq.id).then(() => { toast.success('Request cancelled'); setShowCashReqDetail(false); fetchCashRequests(); fetchCashReqSummary(); }).catch(() => toast.error('Failed to cancel')); } }} className="btn-secondary w-full">
                  <Ban size={14} className="mr-1" /> Cancel Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CREATE CASH REQUEST MODAL ===== */}
      {showCashReqModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Request Cash</h2>
              <button onClick={() => setShowCashReqModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCashRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (TZS) *</label>
                  <input type="number" className="input" value={cashReqForm.amount || ''} onChange={e => setCashReqForm({...cashReqForm, amount: Number(e.target.value)})} min={1} required />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={cashReqForm.category} onChange={e => setCashReqForm({...cashReqForm, category: e.target.value})}>
                    {cashReqCategories.map(c => <option key={c} value={c}>{getStatusLabel(c)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Purpose *</label>
                <textarea className="input" rows={3} value={cashReqForm.purpose} onChange={e => setCashReqForm({...cashReqForm, purpose: e.target.value})} placeholder="Explain why you need this cash..." required />
              </div>
              <div>
                <label className="label">Preferred Payment Method</label>
                <select className="input" value={cashReqForm.payment_method} onChange={e => setCashReqForm({...cashReqForm, payment_method: e.target.value})}>
                  {paymentMethods.map(m => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Additional Notes</label>
                <textarea className="input" rows={2} value={cashReqForm.notes} onChange={e => setCashReqForm({...cashReqForm, notes: e.target.value})} placeholder="Any additional information..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCashReqModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary"><Banknote size={14} className="mr-1" /> Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== REJECT REASON MODAL ===== */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Reject Cash Request</h2>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Rejection Reason *</label>
                <textarea className="input" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this request is being rejected..." required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="btn-secondary">Cancel</button>
                <button onClick={handleRejectCashRequest} disabled={!rejectReason || cashReqActionLoading} className="btn-danger">
                  <XCircle size={14} className="mr-1" /> Reject Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
