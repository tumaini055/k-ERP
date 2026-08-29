import { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { ISPSubscriber, ISPPackage, ISPBilling } from '../types';
import { formatDate, formatCurrency, formatCurrencyFull, formatDateTime, getStatusLabel } from '../lib/utils';
import {
  Wifi, Plus, Users, Signal, DollarSign, Search, X, RefreshCw,
  Home, Building2, Globe,   CheckCircle2, CreditCard, Download, Calendar, TrendingUp, ChevronDown, Bell, MessageSquare, Pencil,
} from 'lucide-react';

const typeIcons: Record<string, any> = { home: Home, business: Building2, enterprise: Globe };
const typeColors: Record<string, string> = {
  home: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  business: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  enterprise: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
};
const statusColors: Record<string, string> = {
  active: 'badge-success',
  suspended: 'badge-danger',
  disconnected: 'badge-danger',
  pending: 'badge-warning',
};
const billStatusColors: Record<string, string> = {
  paid: 'badge-success',
  pending: 'badge-warning',
  partial: 'badge-info',
  overdue: 'badge-danger',
};

const serviceStatuses = ['active', 'suspended', 'disconnected', 'pending'];
const connectionTypes = ['fiber', 'wireless', 'dsl', 'satellite', 'lte'];

export default function ISP() {
  const [subscribers, setSubscribers] = useState<ISPSubscriber[]>([]);
  const [packages, setPackages] = useState<ISPPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pkgFilter, setPkgFilter] = useState('');

  const [selectedSub, setSelectedSub] = useState<ISPSubscriber | null>(null);
  const [subDetail, setSubDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'billing'>('overview');
  const [subBilling, setSubBilling] = useState<ISPBilling[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);

  const [showPkgModal, setShowPkgModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ISPPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({
    name: '', type: 'home' as 'home' | 'business' | 'enterprise',
    bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps',
    price: 0, cost_price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '',
  });

  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    customer_id: '', package_id: '', installation_address: '',
    connection_type: 'fiber', static_ip: '', notes: '',
    service_status: 'pending' as string,
  });

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billForm, setBillForm] = useState({ amount: 0, billing_date: '', due_date: '', description: '', months: 1 });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payingBill, setPayingBill] = useState<ISPBilling | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editingPayDate, setEditingPayDate] = useState(false);
  const [editPayDate, setEditPayDate] = useState('');

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsFilter, setSubsFilter] = useState('30');

  const [stats, setStats] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [customerSubs, setCustomerSubs] = useState<any[]>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({ company_name: '', contact_person: '', phone: '', email: '', address: '' });

  const [monthlyCollections, setMonthlyCollections] = useState<any[]>([]);
  const [monthlyCollLoading, setMonthlyCollLoading] = useState(false);
  const [finalizingMonth, setFinalizingMonth] = useState<string | null>(null);
  const [showMonthlyColl, setShowMonthlyColl] = useState(true);
  const [monthlyYearFilter, setMonthlyYearFilter] = useState('all');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [showReceipts, setShowReceipts] = useState(true);
  const [receiptsSearch, setReceiptsSearch] = useState('');
  const [dismissedNotifs, setDismissedNotifs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('isp_dismissed_notifs') || '[]'); } catch { return []; }
  });
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showBulkSms, setShowBulkSms] = useState(false);
  const [bulkSmsTarget, setBulkSmsTarget] = useState('overdue');
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [bulkSmsSending, setBulkSmsSending] = useState(false);
  const [bulkSmsResult, setBulkSmsResult] = useState<any>(null);
  const [showSingleSms, setShowSingleSms] = useState(false);
  const [singleSmsSub, setSingleSmsSub] = useState<any>(null);
  const [singleSmsMessage, setSingleSmsMessage] = useState('');
  const [singleSmsPhone, setSingleSmsPhone] = useState('');
  const [singleSmsSending, setSingleSmsSending] = useState(false);

  const [editingSub, setEditingSub] = useState(false);
  const [editSubForm, setEditSubForm] = useState({
    package_id: '', connection_type: 'fiber', installation_address: '',
    static_ip: '', notes: '',
  });
  const [showQuickPkg, setShowQuickPkg] = useState(false);
  const [quickPkgForm, setQuickPkgForm] = useState({
    name: '', type: 'home' as 'home' | 'business' | 'enterprise',
    bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps',
    price: 0, cost_price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '',
  });

  useEffect(() => {
    const params: any = { limit: 100 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (pkgFilter) params.package_id = pkgFilter;
    loadData(params);
    loadPackages();
    loadStats();
    loadMonthlyCollections();
  }, [search, statusFilter, pkgFilter]);

  useEffect(() => { loadReceipts(receiptsSearch || undefined); }, [receiptsSearch]);

  const loadData = async (params?: any) => {
    setLoading(true);
    try {
      const res = await dataService.getISPSubscribers(params || { limit: 100 });
      setSubscribers(res.data || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const loadPackages = async () => {
    try {
      const res = await dataService.getISPPackages();
      setPackages(res.data || []);
    } catch (error) {}
  };

  const loadStats = async () => {
    try {
      const res = await dataService.getISPStats();
      setStats(res.data || null);
    } catch (error) {}
  };

  const loadBilling = async (subId: string) => {
    setBillingLoading(true);
    try {
      const res = await dataService.getISPBilling({ subscriber_id: subId, limit: 50 });
      setSubBilling(res.data || []);
    } catch (error) { setSubBilling([]); }
    setBillingLoading(false);
  };

  const loadSubscriptions = async (days?: string) => {
    setSubsLoading(true);
    try {
      const params: any = {};
      if (days && days !== 'all') params.ending_within_days = days;
      const res = await dataService.getISPSubscriptions(params);
      setSubscriptions(res.data || []);
    } catch (error) { setSubscriptions([]); }
    setSubsLoading(false);
  };

  useEffect(() => { loadSubscriptions(subsFilter); }, [subsFilter]);

  const loadMonthlyCollections = async () => {
    setMonthlyCollLoading(true);
    try {
      const res = await dataService.getISPMonthlyCollections();
      setMonthlyCollections(res.data || []);
    } catch (error) { setMonthlyCollections([]); }
    setMonthlyCollLoading(false);
  };

  const loadReceipts = async (search?: string) => {
    setReceiptsLoading(true);
    try {
      const res = await dataService.getISPBillingReceipts(search ? { search } : undefined);
      setReceipts(res.data || []);
    } catch (error) { setReceipts([]); }
    setReceiptsLoading(false);
  };

  const handleFinalizeMonth = async (ym: string) => {
    setFinalizingMonth(ym);
    try {
      await dataService.finalizeISPMonthlyCollection(ym);
      toast.success(`Month ${ym} finalized`);
      loadMonthlyCollections();
      loadStats();
    } catch (error) { toast.error('Failed to finalize month'); }
    setFinalizingMonth(null);
  };

  const handleUnfinalizeMonth = async (id: string, ym: string) => {
    try {
      await dataService.deleteISPMonthlyCollection(id);
      toast.success(`Month ${ym} reopened`);
      loadMonthlyCollections();
      loadStats();
    } catch (error) { toast.error('Failed to reopen month'); }
  };

  const subEndColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 ring-red-200 dark:ring-red-800';
    if (days <= 7) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 ring-orange-200 dark:ring-orange-800';
    if (days <= 30) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400 ring-yellow-200 dark:ring-yellow-800';
    return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800';
  };

  const customerSubCount: Record<string, number> = {};
  for (const sub of subscribers) {
    if (sub.customer_id) customerSubCount[sub.customer_id] = (customerSubCount[sub.customer_id] || 0) + 1;
  }

  const totalMonthlyRevenue = subscribers.reduce((s, sub) => {
    if (sub.service_status === 'active' && sub.package) return s + Number(sub.package.price);
    return s;
  }, 0);

  const totalMonthlyCost = subscribers.reduce((s, sub) => {
    if (sub.service_status === 'active' && sub.package) return s + Number((sub.package as any).cost_price || 0);
    return s;
  }, 0);

  const openSubDetail = async (sub: ISPSubscriber) => {
    setEditingSub(false);
    setSelectedSub(sub);
    setDetailTab('overview');
    try {
      const res = await dataService.getISPSubscribers({ subscriber_code: sub.subscriber_code, limit: 1 });
      const detail = res.data?.[0];
      setSubDetail(detail || sub);
    } catch (error) { setSubDetail(sub); }
    loadBilling(sub.id);
  };

  const closeDetail = () => { setEditingSub(false); setSelectedSub(null); setSubDetail(null); setSubBilling([]); };

  const openSubFromReceipt = async (subCode: string) => {
    try {
      const res = await dataService.getISPSubscribers({ subscriber_code: subCode, limit: 1 });
      const sub = res.data?.[0];
      if (sub) {
        await openSubDetail(sub);
        setDetailTab('billing');
      }
    } catch (error) { toast.error('Subscriber not found'); }
  };

  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', type: 'home', bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps', price: 0, cost_price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '' });
    setShowPkgModal(true);
  };

  const openEditPkg = (pkg: ISPPackage) => {
    setEditingPkg(pkg);
    setPkgForm({
      name: pkg.name, type: pkg.type,
      bandwidth_download: pkg.bandwidth_download, bandwidth_upload: pkg.bandwidth_upload,
      bandwidth_unit: pkg.bandwidth_unit, price: pkg.price, cost_price: pkg.cost_price || 0, setup_fee: pkg.setup_fee,
      billing_cycle: pkg.billing_cycle, description: (pkg as any).description || '',
    });
    setShowPkgModal(true);
  };

  const handleSavePkg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPkg) {
        await dataService.updateISPPackage(editingPkg.id, pkgForm);
        toast.success('Package updated');
      } else {
        await dataService.createISPPackage(pkgForm);
        toast.success('Package created');
      }
      setShowPkgModal(false);
      loadPackages();
      loadStats();
    } catch (error) { toast.error('Failed to save package'); }
  };

  const openAddSub = async () => {
    try {
      const cRes = await dataService.getCustomers({ limit: 500 });
      setCustomers(cRes.data || []);
    } catch (error) {}
    setSubForm({ customer_id: '', package_id: '', installation_address: '', connection_type: 'fiber', static_ip: '', notes: '', service_status: 'pending' });
    setCustomerSubs([]);
    setShowSubModal(true);
  };

  const loadCustomerSubs = async (customerId: string) => {
    if (!customerId) { setCustomerSubs([]); return; }
    try {
      const res = await dataService.getISPSubscribers({ customer_id: customerId, limit: 50 });
      setCustomerSubs(res.data || []);
    } catch (error) { setCustomerSubs([]); }
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await dataService.createISPSubscriber(subForm);
      toast.success('Subscriber added');
      setShowSubModal(false);
      loadData();
      loadStats();
    } catch (error) { toast.error('Failed to add subscriber'); }
    setSubmitting(false);
  };

  const updateSubStatus = async (id: string, service_status: string) => {
    try {
      await dataService.updateISPSubscriber(id, { service_status });
      toast.success(`Status changed to ${getStatusLabel(service_status)}`);
      loadData();
      loadStats();
      if (selectedSub) {
        setSelectedSub({ ...selectedSub, service_status });
        setSubDetail({ ...subDetail, service_status });
      }
    } catch (error) { toast.error('Failed to update status'); }
  };

  const saveSubDetail = async () => {
    if (!selectedSub) return;
    try {
      await dataService.updateISPSubscriber(selectedSub.id, editSubForm);
      toast.success('Subscriber updated');
      setEditingSub(false);
      const updatedSub = { ...subDetail, ...editSubForm, package_id: editSubForm.package_id };
      setSubDetail(updatedSub);
      setSelectedSub(updatedSub as ISPSubscriber);
      loadData();
      loadStats();
      loadSubscriptions(subsFilter);
    } catch (error) { toast.error('Failed to update subscriber'); }
  };

  const handleQuickPkg = async () => {
    if (!quickPkgForm.name || !quickPkgForm.price) {
      toast.error('Package name and price are required');
      return;
    }
    try {
      const res = await dataService.createISPPackage(quickPkgForm);
      const newPkg = res.data;
      await loadPackages();
      setEditSubForm({ ...editSubForm, package_id: newPkg.id });
      setShowQuickPkg(false);
      setQuickPkgForm({ name: '', type: 'home', bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps', price: 0, cost_price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '' });
      toast.success('Package created');
    } catch (error) { toast.error('Failed to create package'); }
  };

  const savePayDate = async () => {
    if (!editPayDate || !selectedSub) return;
    try {
      await dataService.updateISPSubscriber(selectedSub.id, { paid_through_date: editPayDate });
      toast.success('Payment date updated');
      setEditingPayDate(false);
      setSubDetail({ ...subDetail, paid_through_date: editPayDate });
      setSelectedSub({ ...selectedSub, paid_through_date: editPayDate } as ISPSubscriber);
      loadData();
      loadSubscriptions(subsFilter);
      loadStats();
    } catch (error) { toast.error('Failed to update payment date'); }
  };

  const openBillingForSub = (sub: any) => {
    const cycleDays: Record<string, number> = { monthly: 30, quarterly: 90, semi_annual: 180, annual: 365 };
    const defaultDueDays = cycleDays[sub.package?.billing_cycle] || 30;
    const nextBillDate = sub.paid_through_date
      ? new Date(new Date(sub.paid_through_date).getTime() + 86400000)
      : new Date();
    const nextDue = new Date(nextBillDate.getTime() + defaultDueDays * 86400000);
    setSelectedSub(sub);
    setSubDetail(sub);
    setBillForm({
      amount: sub.package?.price || 0,
      billing_date: nextBillDate.toISOString().split('T')[0],
      due_date: nextDue.toISOString().split('T')[0],
      description: '',
      months: 1,
    });
    setShowBillingModal(true);
  };

  const openSmsForSub = (sub: any) => {
    setSingleSmsSub(sub);
    setSingleSmsMessage(`Dear ${sub.customer?.company_name || sub.customer?.contact_person || 'Customer'}, your internet subscription (${sub.subscriber_code}) requires payment renewal. Please make payment to avoid service interruption. - K-connect`);
    setSingleSmsPhone(sub.customer?.phone || '');
    setSingleSmsSending(false);
    setShowSingleSms(true);
  };

  const handleCreateBill = async () => {
    if (!billForm.amount || !selectedSub) return;
    try {
      await dataService.createISPBilling({
        subscriber_id: selectedSub.id,
        amount: billForm.amount,
        billing_date: billForm.billing_date || new Date().toISOString().split('T')[0],
        due_date: billForm.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        description: billForm.description || undefined,
      });
      toast.success('Invoice created');
      setShowBillingModal(false);
      setBillForm({ amount: 0, billing_date: '', due_date: '', description: '', months: 1 });
      dismissNotif(selectedSub.id);
      loadBilling(selectedSub.id);
      loadStats();
    } catch (error) { toast.error('Failed to create invoice'); }
  };

  const handleUpdateDescription = async (billId: string) => {
    try {
      await dataService.updateISPBilling(billId, { description: editDescription });
      toast.success('Description updated');
      setEditingBillId(null);
      if (selectedSub) loadBilling(selectedSub.id);
    } catch (error) { toast.error('Failed to update description'); }
  };

  const handlePayBill = async () => {
    if (!payingBill || !payAmount) return;
    try {
      await dataService.payISPBilling(payingBill.id, { paid_amount: payAmount });
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayingBill(null);
      setPayAmount(0);
      if (selectedSub) loadBilling(selectedSub.id);
      loadStats();
      loadReceipts(receiptsSearch || undefined);
    } catch (error) { toast.error('Failed to record payment'); }
  };

  const dismissNotif = (subId: string) => {
    const next = [...dismissedNotifs, subId];
    setDismissedNotifs(next);
    localStorage.setItem('isp_dismissed_notifs', JSON.stringify(next));
  };

  const expiringNotifs = subscriptions.filter(
    (s: any) => s.days_remaining >= 0 && s.days_remaining <= 5 && s.service_status === 'active' && !dismissedNotifs.includes(s.id)
  );

  const sd = subDetail;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">ISP Subscriber Management</h1>
          <p className="page-subtitle">Manage internet packages, subscribers, and billing</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="btn-secondary relative">
              <Bell size={16} />
              {expiringNotifs.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {expiringNotifs.length > 9 ? '9+' : expiringNotifs.length}
                </span>
              )}
            </button>
            {showNotifDropdown && (
              <div className="absolute right-0 top-full mt-2 w-[380px] z-50">
                <div className="rounded-xl border border-surface-200 bg-white shadow-xl dark:border-surface-700 dark:bg-surface-800 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-surface-200 px-4 py-2.5 dark:border-surface-700">
                    <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                      {expiringNotifs.length === 0 ? 'No notifications' : `${expiringNotifs.length} subscriber${expiringNotifs.length > 1 ? 's' : ''} need invoicing`}
                    </span>
                    <button onClick={() => setShowNotifDropdown(false)} className="text-surface-400 hover:text-surface-600"><X size={14} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {expiringNotifs.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-surface-400">All caught up!</p>
                    ) : (
                      expiringNotifs.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between border-b border-surface-100 px-4 py-2.5 last:border-0 dark:border-surface-700/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-medium text-surface-500">{s.subscriber_code}</span>
                              <span className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{s.customer?.company_name || s.customer?.contact_person || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-surface-400 truncate">{s.package?.name}</span>
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${subEndColor(s.days_remaining)}`}>
                                {s.days_remaining === 0 ? 'Today' : `${s.days_remaining}d`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button onClick={() => { openBillingForSub(s); setShowNotifDropdown(false); }} className="btn-primary text-[10px] py-1 px-2 whitespace-nowrap">
                              <CreditCard size={10} className="mr-0.5" /> Invoice
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); dismissNotif(s.id); }} className="btn-secondary text-[10px] py-1 px-1.5" title="Dismiss">
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {expiringNotifs.length > 0 && (
                    <div className="border-t border-surface-200 px-4 py-2 dark:border-surface-700">
                      <button onClick={() => { setDismissedNotifs([]); localStorage.removeItem('isp_dismissed_notifs'); }} className="text-xs text-primary-600 hover:underline">
                        Clear dismissed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowBulkSms(true)} className="btn-secondary">
            <MessageSquare size={16} className="mr-1" /> Bulk SMS
          </button>
          <button onClick={() => { loadData(); loadPackages(); loadStats(); loadReceipts(receiptsSearch || undefined); }} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          <button onClick={openAddPkg} className="btn-secondary">
            <Plus size={16} className="mr-1" /> Package
          </button>
          <button onClick={openAddSub} className="btn-primary">
            <Plus size={18} className="mr-1" /> Add Subscriber
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><Users size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{stats?.total_subscribers ?? subscribers.length}</p><p className="stat-label">Total Subscribers</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Wifi size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{stats?.active_count ?? subscribers.filter(s => s.service_status === 'active').length}</p><p className="stat-label">Active</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-red-100 text-red-600"><Calendar size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{stats?.overdue_count ?? 0}</p><p className="stat-label">Overdue</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><DollarSign size={22} /></div>
          <div className="min-w-0 overflow-hidden">
            <p className="stat-value">{formatCurrencyFull(stats?.projected_revenue ?? 0)}</p>
            <p className="stat-label">Est. Monthly Revenue {stats?.monthly_collected > 0 ? <span className="text-[10px] text-accent-500">({formatCurrency(stats.monthly_collected)} collected)</span> : ''}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-red-100 text-red-600"><TrendingUp size={22} className="rotate-180" /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrencyFull(stats?.projected_cost ?? 0)}</p><p className="stat-label">Est. Monthly Cost</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-emerald-100 text-emerald-600"><TrendingUp size={22} /></div>
          <div className="min-w-0 overflow-hidden">
            <p className="stat-value">{formatCurrencyFull(stats?.projected_profit ?? 0)}</p>
            <p className="stat-label">Est. Monthly Profit {stats?.projected_revenue > 0 ? <span className="text-[10px]">({Math.round((stats.projected_profit / stats.projected_revenue) * 100)}%)</span> : ''}</p>
          </div>
        </div>
      </div>

      {/* Monthly Collections */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowMonthlyColl(!showMonthlyColl)} className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2 hover:text-surface-900">
            <DollarSign size={16} className="text-emerald-500" /> Monthly Collections
            <ChevronDown size={14} className={`transition-transform ${showMonthlyColl ? '' : '-rotate-90'}`} />
            {monthlyCollLoading && <RefreshCw size={14} className="animate-spin text-surface-400" />}
          </button>
          <div className="flex items-center gap-2">
            {showMonthlyColl && monthlyCollections.length > 0 && (
              <select className="input w-auto min-w-[100px] text-xs py-1" value={monthlyYearFilter} onChange={e => setMonthlyYearFilter(e.target.value)}>
                <option value="all">All Years</option>
                {[...new Set(monthlyCollections.map((m: any) => m.year_month.slice(0, 4)))].sort().reverse().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            <button onClick={loadMonthlyCollections} className="btn-secondary text-xs py-1.5 px-3">
              <RefreshCw size={14} className="mr-1" /> Refresh
            </button>
          </div>
        </div>
        {showMonthlyColl && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Projected</th>
                <th className="text-right">Collected</th>
                <th className="text-right">Remaining</th>
                <th>Collection Rate</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {monthlyCollections.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-surface-400 text-sm">{monthlyCollLoading ? 'Loading...' : 'No data available'}</td></tr>
              ) : (
                monthlyCollections.filter((mc: any) => monthlyYearFilter === 'all' || mc.year_month.startsWith(monthlyYearFilter)).map((mc: any) => (
                  <tr key={mc.year_month} className={mc.is_current ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    <td className="font-medium text-sm">{mc.label} {mc.is_current && <span className="badge-info text-[10px] ml-1">Current</span>}</td>
                    <td className="text-right text-sm font-medium">{formatCurrency(mc.projected_amount)}</td>
                    <td className="text-right text-sm font-medium text-emerald-600">{formatCurrency(mc.collected_amount)}</td>
                    <td className={`text-right text-sm font-medium ${mc.remaining > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(mc.remaining)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-surface-200 dark:bg-surface-600 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${mc.collected_pct >= 100 ? 'bg-emerald-500' : mc.collected_pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(mc.collected_pct, 100)}%`}} />
                        </div>
                        <span className="text-xs font-medium text-surface-500">{mc.collected_pct}%</span>
                      </div>
                    </td>
                    <td>
                      {mc.status === 'finalized' ? (
                        <span className="badge-success">Finalized</span>
                      ) : (
                        <span className="badge-warning">Open</span>
                      )}
                    </td>
                    <td className="text-center">
                      {mc.status === 'finalized' ? (
                        <button onClick={() => handleUnfinalizeMonth(mc.id, mc.year_month)} className="btn-secondary text-xs py-1 px-2" title="Reopen month">
                          <RefreshCw size={12} className="mr-1" /> Reopen
                        </button>
                      ) : (
                        <button
                          onClick={() => handleFinalizeMonth(mc.year_month)}
                          disabled={finalizingMonth === mc.year_month}
                          className="btn-primary text-xs py-1 px-2">
                          {finalizingMonth === mc.year_month ? <RefreshCw size={12} className="animate-spin mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                          Finalize
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Receipts - Paid Invoices */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowReceipts(!showReceipts)} className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2 hover:text-surface-900">
            <CheckCircle2 size={16} className="text-green-500" /> Receipts ({receipts.length})
            <ChevronDown size={14} className={`transition-transform ${showReceipts ? '' : '-rotate-90'}`} />
            {receiptsLoading && <RefreshCw size={14} className="animate-spin text-surface-400" />}
          </button>
          <div className="flex items-center gap-2">
            {showReceipts && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  className="input pl-9 w-56 text-xs py-1.5"
                  placeholder="Search subscriber or customer..."
                  value={receiptsSearch}
                  onChange={e => setReceiptsSearch(e.target.value)}
                />
              </div>
            )}
            <button onClick={() => loadReceipts(receiptsSearch || undefined)} className="btn-secondary text-xs py-1.5 px-3">
              <RefreshCw size={14} className="mr-1" /> Refresh
            </button>
          </div>
        </div>
        {showReceipts && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Subscriber</th>
                <th>Customer</th>
                <th>Package / Description</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Paid</th>
                <th>Paid On</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {receiptsLoading ? (
                <tr><td colSpan={9} className="text-center py-10"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
              ) : receipts.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-surface-400 text-sm">No paid invoices yet — receipts will appear here once a payment is recorded.</td></tr>
              ) : (
                receipts.map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50">
                    <td className="font-mono text-xs font-medium">{`RCT-${r.id.slice(0, 8).toUpperCase()}`}</td>
                    <td>
                      <button onClick={() => openSubFromReceipt(r.subscriber?.subscriber_code)} className="font-mono text-xs text-primary-600 hover:underline" title="Open subscriber billing">
                        {r.subscriber?.subscriber_code || '-'}
                      </button>
                    </td>
                    <td className="font-medium text-sm">{r.subscriber?.customer?.company_name || r.subscriber?.customer?.contact_person || '-'}</td>
                    <td className="text-sm">{r.description || (r.subscriber?.package ? r.subscriber.package.name : 'Internet Service')}</td>
                    <td className="text-right text-sm font-medium">{formatCurrency(r.amount)}</td>
                    <td className="text-right text-sm font-medium text-emerald-600">{formatCurrency(r.paid_amount)}</td>
                    <td className="text-xs text-surface-500">{r.paid_at ? formatDate(r.paid_at) : formatDate(r.updated_at)}</td>
                    <td>
                      <span className={billStatusColors[r.status]}>{getStatusLabel(r.status)}</span>
                    </td>
                    <td className="text-center">
                      <button onClick={() => dataService.downloadISPBillingReceiptPdf(r.id).catch(() => toast.error('Failed to create receipt'))} className="btn-success text-xs py-1.5 px-2.5">
                        <CheckCircle2 size={12} className="mr-1" /> Create Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Subscription End Dates */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
            <Calendar size={16} className="text-primary-500" /> Subscription End Dates
            {subsLoading && <RefreshCw size={14} className="animate-spin text-surface-400" />}
          </h3>
          <div className="flex items-center gap-2">
            {[
              { label: '7 Days', value: '7' },
              { label: '30 Days', value: '30' },
              { label: '90 Days', value: '90' },
              { label: 'All', value: 'all' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSubsFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  subsFilter === opt.value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-400 dark:hover:bg-surface-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Customer</th>
                <th>Package</th>
                <th>End Date</th>
                <th>Days Left</th>
                <th>Profit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-surface-400 text-sm">{subsLoading ? 'Loading...' : 'No active subscriptions'}</td></tr>
              ) : (
                subscriptions.map((sub: any) => (
                  <tr key={sub.id}>
                    <td className="font-mono text-xs font-medium">{sub.subscriber_code}</td>
                    <td className="font-medium text-sm">{sub.customer?.company_name || sub.customer?.contact_person || '-'}</td>
                    <td className="text-sm">{sub.package?.name || '-'}</td>
                    <td className="text-sm font-medium">{sub.end_date}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${subEndColor(sub.days_remaining)}`}>
                        {sub.days_remaining < 0 ? `${Math.abs(sub.days_remaining)}d overdue` : `${sub.days_remaining}d`}
                      </span>
                    </td>
                    <td className="text-sm">
                      {sub.package?.cost_price > 0 ? (
                        <span className="text-emerald-600 font-medium">{formatCurrency(sub.package.price - sub.package.cost_price)}</span>
                      ) : (
                        <span className="text-surface-300">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-${sub.service_status === 'active' ? 'success' : 'warning'}`}>
                        {sub.service_status === 'active' ? 'Active' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Cards */}
      {packages.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Internet Packages</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {packages.map((pkg) => {
              const TypeIcon = typeIcons[pkg.type] || Wifi;
              return (
                <div key={pkg.id} className="card relative cursor-pointer transition-all hover:shadow-md" onClick={() => openEditPkg(pkg)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeColors[pkg.type]}`}>
                      <TypeIcon size={20} />
                    </div>
                    <span className="badge-info text-[10px] capitalize">{pkg.type}</span>
                  </div>
                  <p className="font-semibold text-surface-900 dark:text-surface-50">{pkg.name}</p>
                  <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(pkg.price)}<span className="text-xs font-normal text-surface-400">/{pkg.billing_cycle}</span></p>
                  {(() => { const cp = pkg.cost_price || 0; return cp > 0 ? (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className="text-surface-400">Cost: {formatCurrency(cp)}</span>
                      <span className="text-emerald-600 font-medium">+{Math.round((1 - cp / pkg.price) * 100)}%</span>
                    </div>
                  ) : null; })()}
                  <div className="mt-2 flex items-center gap-2 text-xs text-surface-500">
                    <Signal size={14} />
                    <span>{pkg.bandwidth_download}/{pkg.bandwidth_upload} {pkg.bandwidth_unit}</span>
                    {pkg.setup_fee > 0 && <span className="ml-auto">Setup: {formatCurrency(pkg.setup_fee)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search subscriber or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto min-w-[130px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {serviceStatuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
        </select>
        <select className="input w-auto min-w-[140px]" value={pkgFilter} onChange={e => setPkgFilter(e.target.value)}>
          <option value="">All Packages</option>
          {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Subscriber Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Customer</th>
              <th>Package</th>
              <th>Bandwidth</th>
              <th>Monthly</th>
              <th>Connection</th>
              <th>Status</th>
              <th>Since</th>
              <th>Subs</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : subscribers.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-surface-400">No subscribers found</td></tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="cursor-pointer" onClick={() => openSubDetail(sub)}>
                  <td className="font-mono text-xs">{sub.subscriber_code}</td>
                  <td className="font-medium">{sub.customer?.company_name || sub.customer?.contact_person || '-'}</td>
                  <td>{sub.package?.name || '-'}</td>
                  <td className="text-xs">{sub.package ? `${sub.package.bandwidth_download}/${sub.package.bandwidth_upload} ${sub.package.bandwidth_unit}` : '-'}</td>
                  <td className="font-medium">{sub.package ? formatCurrency(sub.package.price) : '-'}</td>
                  <td className="text-xs capitalize">{sub.connection_type || '-'}</td>
                  <td><span className={statusColors[sub.service_status]}>{getStatusLabel(sub.service_status)}</span></td>
                  <td className="text-xs text-surface-400">{formatDate(sub.created_at)}</td>
                  <td>
                    {(sub.customer_id && (customerSubCount[sub.customer_id] || 0) > 1) ? (
                      <span className="badge-info text-xs">{customerSubCount[sub.customer_id]}</span>
                    ) : (
                      <span className="text-surface-300">1</span>
                    )}
                  </td>
                  <td className="text-center">
                    <button onClick={(e) => { e.stopPropagation(); openSmsForSub(sub); }} className="btn-secondary text-[10px] py-1 px-1.5" title="Send SMS">
                      <MessageSquare size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Subscriber Side Panel */}
      {selectedSub && subDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{sd.customer?.company_name || sd.customer?.contact_person || 'Subscriber'}</h2>
                <p className="text-xs text-surface-500">{sd.subscriber_code}</p>
              </div>
              <div className="flex items-center gap-2">
                {editingSub ? (
                  <>
                    <button onClick={saveSubDetail} className="btn-primary text-xs py-1.5 px-3"><CheckCircle2 size={14} className="mr-1" />Save</button>
                    <button onClick={() => setEditingSub(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => {
                    setEditSubForm({
                      package_id: sd.package_id || '',
                      connection_type: sd.connection_type || 'fiber',
                      installation_address: sd.installation_address || '',
                      static_ip: sd.static_ip || '',
                      notes: sd.notes || '',
                    });
                    setEditingSub(true);
                  }} className="btn-secondary text-xs py-1.5 px-3">
                    <Pencil size={14} className="mr-1" />Edit
                  </button>
                )}
                <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
              </div>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'billing'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' ? <><Users size={14} className="inline mr-1" />Overview</> : <><DollarSign size={14} className="inline mr-1" />Billing ({subBilling.length})</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <select
                        value={sd.service_status}
                        onChange={(e) => updateSubStatus(sd.id, e.target.value)}
                        className={`rounded border-0 px-2 py-0.5 text-xs font-medium cursor-pointer ${statusColors[sd.service_status]}`}>
                        {serviceStatuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                      </select>
                    </div>
                    <button onClick={() => {
                      const pkg = sd.package;
                      const cycleDays: Record<string, number> = { monthly: 30, quarterly: 90, semi_annual: 180, annual: 365 };
                      const defaultDueDays = cycleDays[pkg?.billing_cycle] || 30;
                      const nextBillDate = sd.paid_through_date
                        ? new Date(new Date(sd.paid_through_date).getTime() + 86400000)
                        : new Date();
                      const nextDue = new Date(nextBillDate.getTime() + defaultDueDays * 86400000);
                      setBillForm({
                        amount: pkg?.price || 0,
                        billing_date: nextBillDate.toISOString().split('T')[0],
                        due_date: nextDue.toISOString().split('T')[0],
                        description: '',
                        months: 1,
                      });
                      setShowBillingModal(true);
                    }} className="btn-primary text-xs py-1.5 px-3">
                      <CreditCard size={14} className="mr-1" /> Create Invoice
                    </button>
                    <button onClick={() => openSmsForSub(sd)} className="btn-secondary text-xs py-1.5 px-3">
                      <MessageSquare size={14} className="mr-1" /> SMS
                    </button>
                  </div>

                  {editingSub ? (
                    <div>
                      <label className="label text-xs mb-1">Package</label>
                      <div className="flex gap-2">
                        <select className="input flex-1" value={editSubForm.package_id} onChange={e => setEditSubForm({...editSubForm, package_id: e.target.value})}>
                          <option value="">Select package</option>
                          {packages.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowQuickPkg(true)} className="btn-secondary text-xs whitespace-nowrap px-3 py-1.5" title="Add new package">
                          <Plus size={14} className="mr-1" /> New
                        </button>
                      </div>
                      {showQuickPkg && (
                        <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-3 space-y-2 dark:border-accent-700 dark:bg-accent-900/20">
                          <p className="text-xs font-semibold text-accent-700 dark:text-accent-300">Quick Add Package</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input className="input text-xs" placeholder="Package name *" value={quickPkgForm.name} onChange={e => setQuickPkgForm({...quickPkgForm, name: e.target.value})} />
                            <input type="number" className="input text-xs" placeholder="Price *" value={quickPkgForm.price || ''} onChange={e => setQuickPkgForm({...quickPkgForm, price: Number(e.target.value)})} />
                            <input type="number" className="input text-xs" placeholder="Download Mbps" value={quickPkgForm.bandwidth_download || ''} onChange={e => setQuickPkgForm({...quickPkgForm, bandwidth_download: Number(e.target.value)})} />
                            <input type="number" className="input text-xs" placeholder="Upload Mbps" value={quickPkgForm.bandwidth_upload || ''} onChange={e => setQuickPkgForm({...quickPkgForm, bandwidth_upload: Number(e.target.value)})} />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => { setShowQuickPkg(false); setQuickPkgForm({ name: '', type: 'home', bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps', price: 0, cost_price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '' }); }} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                            <button type="button" onClick={handleQuickPkg} className="btn-primary text-xs py-1 px-3">Save Package</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : sd.package && (
                    <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">{sd.package.name}</p>
                          <p className="text-xs text-primary-500">{sd.package.bandwidth_download}/{sd.package.bandwidth_upload} {sd.package.bandwidth_unit}</p>
                        </div>
                        <p className="text-xl font-bold text-primary-600">{formatCurrency(sd.package.price)}<span className="text-xs font-normal">/{sd.package.billing_cycle}</span></p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-surface-500">Customer</p><p className="text-sm font-medium">{sd.customer?.company_name || sd.customer?.contact_person || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Contact</p><p className="text-sm font-medium">{sd.customer?.phone || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Connection Type</p>{editingSub ? (
                      <select className="input text-sm mt-0.5" value={editSubForm.connection_type} onChange={e => setEditSubForm({...editSubForm, connection_type: e.target.value})}>
                        {connectionTypes.map(t => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                      </select>
                    ) : <p className="text-sm font-medium capitalize">{sd.connection_type || '-'}</p>}</div>
                    <div><p className="text-xs text-surface-500">Static IP</p>{editingSub ? (
                      <input className="input text-sm mt-0.5" value={editSubForm.static_ip} onChange={e => setEditSubForm({...editSubForm, static_ip: e.target.value})} placeholder="192.168.1.1" />
                    ) : <p className="text-sm font-mono text-xs">{sd.static_ip || '-'}</p>}</div>
                    <div><p className="text-xs text-surface-500">Installation Date</p><p className="text-sm font-medium">{sd.installation_date ? formatDate(sd.installation_date) : '-'}</p></div>
                    <div>
                      <p className="text-xs text-surface-500">Next Payment Date</p>
                      {editingPayDate ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input type="date" className="input text-xs py-1 px-2 w-36" value={editPayDate} onChange={e => setEditPayDate(e.target.value)} />
                          <button onClick={savePayDate} className="btn-primary text-xs py-1 px-2"><CheckCircle2 size={12} /></button>
                          <button onClick={() => setEditingPayDate(false)} className="btn-secondary text-xs py-1 px-2"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditPayDate(sd.paid_through_date || ''); setEditingPayDate(true); }} className={`text-sm font-medium text-left hover:underline ${sd.paid_through_date && new Date(sd.paid_through_date) < new Date() ? 'text-red-500' : 'text-emerald-600'}`}>
                          {sd.paid_through_date ? formatDate(sd.paid_through_date) : 'Set date'}
                        </button>
                      )}
                    </div>
                    <div><p className="text-xs text-surface-500">Created</p><p className="text-sm font-medium">{formatDate(sd.created_at)}</p></div>
                  </div>

                  {editingSub ? (
                    <div>
                      <p className="text-xs text-surface-500">Installation Address</p>
                      <textarea className="input text-sm mt-0.5" rows={2} value={editSubForm.installation_address} onChange={e => setEditSubForm({...editSubForm, installation_address: e.target.value})} />
                    </div>
                  ) : sd.installation_address && (
                    <div>
                      <p className="text-xs text-surface-500">Installation Address</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300">{sd.installation_address}</p>
                    </div>
                  )}

                  {editingSub ? (
                    <div>
                      <p className="text-xs text-surface-500">Notes</p>
                      <textarea className="input text-sm mt-0.5" rows={2} value={editSubForm.notes} onChange={e => setEditSubForm({...editSubForm, notes: e.target.value})} />
                    </div>
                  ) : sd.notes && (
                    <div>
                      <p className="text-xs text-surface-500">Notes</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300">{sd.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'billing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Billing History</p>
                    <button onClick={() => {
                      const pkg = sd.package;
                      const cycleDays: Record<string, number> = { monthly: 30, quarterly: 90, semi_annual: 180, annual: 365 };
                      const defaultDueDays = cycleDays[pkg?.billing_cycle] || 30;
                      const nextBillDate = sd.paid_through_date
                        ? new Date(new Date(sd.paid_through_date).getTime() + 86400000)
                        : new Date();
                      const nextDue = new Date(nextBillDate.getTime() + defaultDueDays * 86400000);
                      setBillForm({
                        amount: pkg?.price || 0,
                        billing_date: nextBillDate.toISOString().split('T')[0],
                        due_date: nextDue.toISOString().split('T')[0],
                        description: '',
                        months: 1,
                      });
                      setShowBillingModal(true);
                    }} className="btn-primary text-xs py-1.5 px-3">
                      <Plus size={14} className="mr-1" /> New Invoice
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                      <p className="text-xs text-surface-400">Total Billed</p>
                      <p className="text-lg font-bold">{formatCurrency(subBilling.reduce((s, b) => s + Number(b.amount), 0))}</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                      <p className="text-xs text-surface-400">Collected</p>
                      <p className="text-lg font-bold text-accent-600">{formatCurrency(subBilling.reduce((s, b) => s + Number(b.paid_amount), 0))}</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                      <p className="text-xs text-surface-400">Outstanding</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(subBilling.reduce((s, b) => s + (Number(b.amount) - Number(b.paid_amount)), 0))}</p>
                    </div>
                  </div>

                  {billingLoading ? (
                    <p className="text-center py-8 text-surface-400"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading...</p>
                  ) : subBilling.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No billing records</p>
                  ) : (
                    <div className="space-y-2">
                      {subBilling.map((bill: ISPBilling) => {
                        const outstanding = Number(bill.amount) - Number(bill.paid_amount);
                        return (
                          <Fragment key={bill.id}>
                          <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{formatCurrency(bill.amount)}</span>
                                  <span className={billStatusColors[bill.status]}>{getStatusLabel(bill.status)}</span>
                                </div>
                                <p className="text-xs text-surface-500 mt-0.5">
                                  {formatDate(bill.billing_date)} | Due: {formatDate(bill.due_date)}
                                </p>
                                {bill.paid_amount > 0 && (
                                  <p className="text-xs text-accent-600">Paid: {formatCurrency(bill.paid_amount)}{bill.paid_at ? ` on ${formatDate(bill.paid_at)}` : ''}</p>
                                )}
                                {outstanding > 0 && <p className="text-xs text-red-500">Outstanding: {formatCurrency(outstanding)}</p>}
                                {bill.description && editingBillId !== bill.id && (
                                  <p className="text-xs text-surface-600 mt-1 italic">"{bill.description}"</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingBillId(bill.id); setEditDescription(bill.description || ''); }} className="btn-secondary text-xs py-1 px-2" title="Edit description">
                                  <span className="text-[10px]">Edit</span>
                                </button>
                                <button onClick={() => dataService.downloadISPBillingPdf(bill.id).catch(() => toast.error('Failed to download PDF'))} className="btn-secondary text-xs py-1 px-2" title="Download invoice PDF">
                                  <Download size={12} />
                                </button>
                                {bill.paid_amount > 0 && (
                                  <button onClick={() => dataService.downloadISPBillingReceiptPdf(bill.id).catch(() => toast.error('Failed to download receipt'))} className="btn-success text-xs py-1 px-2" title="Download receipt">
                                    <CheckCircle2 size={12} className="mr-0.5" />Receipt
                                  </button>
                                )}
                                {bill.status !== 'paid' && (
                                  <button onClick={() => { setPayingBill(bill); setPayAmount(outstanding); setShowPayModal(true); }} className="btn-primary text-xs py-1 px-2">
                                    <CreditCard size={12} className="mr-1" />Pay
                                  </button>
                                )}
                                <button onClick={async () => {
                                  if (!window.confirm('Delete this invoice? This action cannot be undone.')) return;
                                  try {
                                    await dataService.deleteISPBilling(bill.id);
                                    toast.success('Invoice deleted');
                                    if (selectedSub) loadBilling(selectedSub.id);
                                    loadStats();
                                    loadReceipts(receiptsSearch || undefined);
                                  } catch (error) { toast.error('Failed to delete invoice'); }
                                }} className="btn-secondary text-xs py-1 px-2 text-red-500 hover:text-red-700" title="Delete invoice">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                          {editingBillId === bill.id && (
                            <div className="mt-2 rounded-lg border border-accent-200 bg-accent-50 p-2 dark:border-accent-700 dark:bg-accent-900/20">
                              <label className="text-xs font-medium text-surface-600 mb-1 block">Invoice Description</label>
                              <textarea
                                className="input text-xs w-full"
                                rows={2}
                                placeholder="e.g. Fiber Internet - Monthly Subscription"
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                              />
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleUpdateDescription(bill.id)} className="btn-primary text-xs py-1 px-3">Save</button>
                                <button onClick={() => setEditingBillId(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                              </div>
                            </div>
                          )}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Package Modal */}
      {showPkgModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{editingPkg ? 'Edit Package' : 'New Package'}</h2>
              <button onClick={() => setShowPkgModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePkg} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Package Name *</label>
                  <input className="input" value={pkgForm.name} onChange={e => setPkgForm({...pkgForm, name: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={pkgForm.type} onChange={e => setPkgForm({...pkgForm, type: e.target.value as any})}>
                    <option value="home">Home</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Download (Mbps)</label>
                  <input type="number" className="input" value={pkgForm.bandwidth_download || ''} onChange={e => setPkgForm({...pkgForm, bandwidth_download: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Upload (Mbps)</label>
                  <input type="number" className="input" value={pkgForm.bandwidth_upload || ''} onChange={e => setPkgForm({...pkgForm, bandwidth_upload: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={pkgForm.bandwidth_unit} onChange={e => setPkgForm({...pkgForm, bandwidth_unit: e.target.value})}>
                    <option value="Mbps">Mbps</option>
                    <option value="Kbps">Kbps</option>
                    <option value="Gbps">Gbps</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="label">Sell Price (TZS) *</label>
                  <input type="number" className="input" value={pkgForm.price || ''} onChange={e => setPkgForm({...pkgForm, price: Number(e.target.value)})} required />
                </div>
                <div>
                  <label className="label">Cost Price (TZS)</label>
                  <input type="number" className="input" value={pkgForm.cost_price || ''} onChange={e => setPkgForm({...pkgForm, cost_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Setup Fee</label>
                  <input type="number" className="input" value={pkgForm.setup_fee || ''} onChange={e => setPkgForm({...pkgForm, setup_fee: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Billing Cycle</label>
                  <select className="input" value={pkgForm.billing_cycle} onChange={e => setPkgForm({...pkgForm, billing_cycle: e.target.value})}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={pkgForm.description} onChange={e => setPkgForm({...pkgForm, description: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPkgModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingPkg ? 'Update' : 'Create Package'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subscriber Modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Add Subscriber</h2>
              <button onClick={() => setShowSubModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSub} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Customer *</label>
                  <div className="flex gap-2">
                    <select className="input flex-1" value={subForm.customer_id} onChange={e => { setSubForm({...subForm, customer_id: e.target.value}); loadCustomerSubs(e.target.value); }} required>
                      <option value="">Select customer</option>
                      {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowQuickCustomer(true)} className="btn-secondary text-xs whitespace-nowrap px-3 py-1.5" title="Add new customer">
                      <Plus size={14} className="mr-1" /> New
                    </button>
                  </div>
                  {showQuickCustomer && (
                    <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-3 space-y-2 dark:border-accent-700 dark:bg-accent-900/20">
                      <p className="text-xs font-semibold text-accent-700 dark:text-accent-300">Quick Add Customer</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input text-xs" placeholder="Company name" value={quickCustForm.company_name} onChange={e => setQuickCustForm({...quickCustForm, company_name: e.target.value})} />
                        <input className="input text-xs" placeholder="Contact person" value={quickCustForm.contact_person} onChange={e => setQuickCustForm({...quickCustForm, contact_person: e.target.value})} />
                        <input className="input text-xs" placeholder="Phone *" value={quickCustForm.phone} onChange={e => setQuickCustForm({...quickCustForm, phone: e.target.value})} />
                        <input className="input text-xs" placeholder="Email" value={quickCustForm.email} onChange={e => setQuickCustForm({...quickCustForm, email: e.target.value})} />
                      </div>
                      <input className="input text-xs w-full" placeholder="Address" value={quickCustForm.address} onChange={e => setQuickCustForm({...quickCustForm, address: e.target.value})} />
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => { setShowQuickCustomer(false); setQuickCustForm({ company_name: '', contact_person: '', phone: '', email: '', address: '' }); }} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                        <button type="button" onClick={async () => {
                          if (!quickCustForm.phone && !quickCustForm.company_name && !quickCustForm.contact_person) return toast.error('Enter company name, contact person, or phone');
                          try {
                            const res = await dataService.createCustomer(quickCustForm);
                            const newCust = res.data;
                            const cRes = await dataService.getCustomers({ limit: 500 });
                            setCustomers(cRes.data || []);
                            setSubForm({...subForm, customer_id: newCust.id});
                            setShowQuickCustomer(false);
                            setQuickCustForm({ company_name: '', contact_person: '', phone: '', email: '', address: '' });
                            toast.success('Customer created');
                          } catch (error) { toast.error('Failed to create customer'); }
                        }} className="btn-primary text-xs py-1 px-3">Save Customer</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Package *</label>
                  <select className="input" value={subForm.package_id} onChange={e => setSubForm({...subForm, package_id: e.target.value})} required>
                    <option value="">Select package</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Connection Type</label>
                  <select className="input" value={subForm.connection_type} onChange={e => setSubForm({...subForm, connection_type: e.target.value})}>
                    {connectionTypes.map(t => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={subForm.service_status} onChange={e => setSubForm({...subForm, service_status: e.target.value})}>
                    {serviceStatuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Installation Address</label>
                <textarea className="input" rows={2} value={subForm.installation_address} onChange={e => setSubForm({...subForm, installation_address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Static IP</label>
                  <input className="input" value={subForm.static_ip} onChange={e => setSubForm({...subForm, static_ip: e.target.value})} placeholder="192.168.1.1" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={subForm.notes} onChange={e => setSubForm({...subForm, notes: e.target.value})} />
              </div>
              {customerSubs.length > 0 && (
                <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800">
                  <p className="text-xs font-medium text-surface-500 mb-2">Existing Subscriptions ({customerSubs.length})</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {customerSubs.map((cs: any) => (
                      <div key={cs.id} className="flex items-center justify-between text-xs bg-white dark:bg-surface-700 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-medium text-surface-700 dark:text-surface-200">{cs.subscriber_code}</span>
                          <span className="text-surface-400 truncate">{cs.package?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={statusColors[cs.service_status]}>{getStatusLabel(cs.service_status)}</span>
                          {cs.installation_address && <span className="text-surface-400 truncate max-w-[120px]" title={cs.installation_address}>{cs.installation_address}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSubModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Adding...' : 'Add Subscriber'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Invoice</h2>
              <button onClick={() => setShowBillingModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Months *</label>
                  <input type="number" min={1} className="input" value={billForm.months || 1} onChange={e => {
                    const months = Math.max(1, Number(e.target.value));
                    const pkgPrice = sd?.package?.price || 0;
                    const cycleDays: Record<string, number> = { monthly: 30, quarterly: 90, semi_annual: 180, annual: 365 };
                    const defaultDueDays = cycleDays[sd?.package?.billing_cycle] || 30;
                    const nextBillDate = sd?.paid_through_date
                      ? new Date(new Date(sd.paid_through_date).getTime() + 86400000)
                      : new Date();
                    const totalDays = defaultDueDays * months;
                    const nextDue = new Date(nextBillDate.getTime() + totalDays * 86400000);
                    setBillForm({
                      ...billForm,
                      months,
                      amount: pkgPrice * months,
                      billing_date: nextBillDate.toISOString().split('T')[0],
                      due_date: nextDue.toISOString().split('T')[0],
                    });
                  }} />
                </div>
                <div>
                  <label className="label">Amount (TZS) *</label>
                  <input type="number" className="input" value={billForm.amount || ''} onChange={e => setBillForm({...billForm, amount: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Billing Date</label>
                  <input type="date" className="input" value={billForm.billing_date} onChange={e => setBillForm({...billForm, billing_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={billForm.due_date} onChange={e => setBillForm({...billForm, due_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea className="input" rows={2} placeholder="e.g. 3-month prepaid subscription" value={billForm.description} onChange={e => setBillForm({...billForm, description: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBillingModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleCreateBill} disabled={!billForm.amount} className="btn-primary">
                  <CreditCard size={14} className="mr-1" /> Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && payingBill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
             <div className="space-y-3">
              <p className="text-sm text-surface-500">Invoice amount: <span className="font-bold text-surface-900">{formatCurrency(payingBill.amount)}</span></p>
              <p className="text-sm text-surface-500">Already paid: <span className="font-medium text-accent-600">{formatCurrency(payingBill.paid_amount)}</span></p>
              <p className="text-sm text-surface-500">Outstanding: <span className="font-bold text-red-600">{formatCurrency(Number(payingBill.amount) - Number(payingBill.paid_amount))}</span></p>
              <div>
                <label className="label">Payment Amount *</label>
                <input type="number" className="input" value={payAmount || ''} onChange={e => setPayAmount(Number(e.target.value))} />
              </div>
              {(() => {
                const monthlyPrice = sd?.package?.price || payingBill.amount;
                const months = Math.max(1, Math.round(payAmount / monthlyPrice));
                const fromDate = sd?.paid_through_date ? new Date(sd.paid_through_date) : new Date(payingBill.billing_date || payingBill.created_at);
                const extendedTo = new Date(fromDate);
                extendedTo.setMonth(extendedTo.getMonth() + months);
                return payAmount > 0 ? (
                  <p className="text-xs text-surface-500 bg-surface-50 dark:bg-surface-700 rounded-lg p-2">
                    This payment extends service through <span className="font-semibold text-surface-700 dark:text-surface-200">{formatDate(extendedTo.toISOString().split('T')[0])}</span>
                    {' '}({months} month{months > 1 ? 's' : ''})
                  </p>
                ) : null;
              })()}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowPayModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handlePayBill} disabled={!payAmount} className="btn-primary">
                  <CheckCircle2 size={14} className="mr-1" /> Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single SMS Modal */}
      {showSingleSms && singleSmsSub && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-primary-500" /> Send SMS</h2>
              <button onClick={() => setShowSingleSms(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-surface-50 dark:bg-surface-700/50 p-3">
                <p className="text-xs text-surface-500">To:</p>
                <p className="text-sm font-medium">{singleSmsSub.customer?.company_name || singleSmsSub.customer?.contact_person || '-'} ({singleSmsSub.subscriber_code})</p>
                <input className="input text-xs mt-1 w-full" placeholder="Phone number (e.g. 255712345678)" value={singleSmsPhone} onChange={e => setSingleSmsPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">Message <span className="text-surface-400 font-normal">({singleSmsMessage.length} chars, {Math.ceil(singleSmsMessage.length / 160)} segment{Math.ceil(singleSmsMessage.length / 160) > 1 ? 's' : ''})</span></label>
                <textarea className="input w-full" rows={4} value={singleSmsMessage} onChange={e => setSingleSmsMessage(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowSingleSms(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={async () => {
                    if (!singleSmsMessage.trim()) { toast.error('Enter a message'); return; }
                    setSingleSmsSending(true);
                    try {
                      const payload: any = { subscriber_ids: [singleSmsSub.id], message: singleSmsMessage };
                      if (singleSmsPhone.trim()) payload.phone_overrides = { [singleSmsSub.id]: singleSmsPhone.trim() };
                      const res = await dataService.sendISPBulkSms(payload);
                      if (res.data?.sent > 0) {
                        toast.success('SMS sent successfully');
                        setShowSingleSms(false);
                      } else {
                        toast.error(res.data?.errors?.[0] || 'Failed to send SMS');
                      }
                    } catch (error: any) {
                      toast.error(error?.response?.data?.error || 'Failed to send SMS');
                    }
                    setSingleSmsSending(false);
                  }}
                  disabled={singleSmsSending || !singleSmsMessage.trim()}
                  className="btn-primary"
                >
                  {singleSmsSending ? <RefreshCw size={14} className="animate-spin mr-1" /> : <MessageSquare size={14} className="mr-1" />}
                  {singleSmsSending ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk SMS Modal */}
      {showBulkSms && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-primary-500" /> Bulk SMS</h2>
              <button onClick={() => { setShowBulkSms(false); setBulkSmsResult(null); setBulkSmsMessage(''); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            {!bulkSmsResult ? (
              <div className="space-y-5">
                <div>
                  <label className="label">Target Subscribers</label>
                  <select className="input" value={bulkSmsTarget} onChange={e => setBulkSmsTarget(e.target.value)}>
                    <option value="overdue">Overdue (past paid_through_date)</option>
                    <option value="expiring7">Expiring within 7 days</option>
                    <option value="expiring30">Expiring within 30 days</option>
                    <option value="expiring90">Expiring within 90 days</option>
                    <option value="all_active">All Active</option>
                  </select>
                </div>
                <div>
                  <label className="label">Message <span className="text-surface-400 font-normal">({bulkSmsMessage.length} chars)</span></label>
                  <textarea
                    className="input w-full"
                    rows={5}
                    placeholder="Dear customer, your internet subscription is about to expire. Please make payment to avoid service interruption. - K-connect"
                    value={bulkSmsMessage}
                    onChange={e => setBulkSmsMessage(e.target.value)}
                  />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-surface-400">
                    <span>Use {'{name}'} for customer name and {'{code}'} for subscriber code</span>
                    <span className={bulkSmsMessage.length > 160 ? 'text-red-500 font-medium' : ''}>
                      {Math.ceil(bulkSmsMessage.length / 160)} SMS segment{Math.ceil(bulkSmsMessage.length / 160) > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-surface-500 mb-1">Preview:</p>
                  <p className="text-sm text-surface-700 dark:text-surface-300 bg-white dark:bg-surface-800 rounded p-2 border border-surface-200 dark:border-surface-600">
                    {bulkSmsMessage.replace('{name}', '[Customer]').replace('{code}', '[ISP-XXXXXX]') || 'Your message will appear here'}
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowBulkSms(false); setBulkSmsResult(null); setBulkSmsMessage(''); }} className="btn-secondary">Cancel</button>
                  <button onClick={async () => {
                    if (!bulkSmsMessage.trim()) { toast.error('Enter a message'); return; }
                    setBulkSmsSending(true);
                    try {
                      let subscriberIds: string[] = [];
                      const now = new Date();
                      const todayStr = now.toISOString().split('T')[0];

                      if (bulkSmsTarget === 'overdue') {
                        const { data } = await dataService.getISPSubscribers({ limit: 1000 });
                        subscriberIds = (data || [])
                          .filter((s: any) => s.paid_through_date && s.paid_through_date < todayStr && s.service_status === 'active')
                          .map((s: any) => s.id);
                      } else if (bulkSmsTarget === 'all_active') {
                        const { data } = await dataService.getISPSubscribers({ status: 'active', limit: 1000 });
                        subscriberIds = (data || []).map((s: any) => s.id);
                      } else {
                        const days = parseInt(bulkSmsTarget.replace('expiring', ''));
                        const { data } = await dataService.getISPSubscriptions({ ending_within_days: days });
                        subscriberIds = (data || []).filter((s: any) => s.service_status === 'active').map((s: any) => s.id);
                      }

                      if (subscriberIds.length === 0) {
                        toast.error('No subscribers match the selected filter');
                        setBulkSmsSending(false);
                        return;
                      }

                      const res = await dataService.sendISPBulkSms({ subscriber_ids: subscriberIds, message: bulkSmsMessage });
                      setBulkSmsResult(res.data);
                      toast.success(`SMS sent to ${res.data.sent} subscribers`);
                    } catch (error: any) {
                      toast.error(error?.response?.data?.error || 'Failed to send SMS');
                    }
                    setBulkSmsSending(false);
                  }} disabled={bulkSmsSending || !bulkSmsMessage.trim()} className="btn-primary">
                    {bulkSmsSending ? <RefreshCw size={14} className="animate-spin mr-1" /> : <MessageSquare size={14} className="mr-1" />}
                    {bulkSmsSending ? 'Sending...' : 'Send SMS'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-surface-50 dark:bg-surface-700/50 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-2xl font-bold text-primary-600">{bulkSmsResult.total}</p><p className="text-xs text-surface-500">Total</p></div>
                    <div><p className="text-2xl font-bold text-emerald-600">{bulkSmsResult.sent}</p><p className="text-xs text-surface-500">Sent</p></div>
                    <div><p className={`text-2xl font-bold ${bulkSmsResult.failed > 0 ? 'text-red-500' : 'text-surface-400'}`}>{bulkSmsResult.failed}</p><p className="text-xs text-surface-500">Failed</p></div>
                  </div>
                </div>
                {bulkSmsResult.errors?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-500 mb-1">Errors:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {bulkSmsResult.errors.map((e: string, i: number) => (
                        <p key={i} className="text-xs text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{e}</p>
                      ))}
                    </div>
                  </div>
                )}
                {bulkSmsResult.results?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-1">Recipients:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {bulkSmsResult.results.slice(0, 50).map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-surface-50 dark:bg-surface-700/50 rounded px-2 py-1.5">
                          <span className="font-mono text-surface-500">{r.subscriber_code}</span>
                          <span className="text-surface-700 dark:text-surface-300 truncate mx-2">{r.customer}</span>
                          <span className="text-surface-400">{r.phone}</span>
                          <span className={r.status === 'sent' ? 'text-emerald-600 font-medium' : 'text-red-500'}>{r.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowBulkSms(false); setBulkSmsResult(null); setBulkSmsMessage(''); }} className="btn-secondary">Close</button>
                  <button onClick={() => setBulkSmsResult(null)} className="btn-primary"><MessageSquare size={14} className="mr-1" /> Send Another</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
