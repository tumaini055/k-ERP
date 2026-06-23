import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { ISPSubscriber, ISPPackage, ISPBilling } from '../types';
import { formatDate, formatCurrency, formatDateTime, getStatusLabel } from '../lib/utils';
import {
  Wifi, Plus, Users, Signal, DollarSign, Search, X, RefreshCw,
  Home, Building2, Globe, CheckCircle2, CreditCard,
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
    price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '',
  });

  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    customer_id: '', package_id: '', installation_address: '',
    connection_type: 'fiber', static_ip: '', notes: '',
    service_status: 'pending' as string,
  });

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billForm, setBillForm] = useState({ amount: 0, billing_date: '', due_date: '' });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payingBill, setPayingBill] = useState<ISPBilling | null>(null);
  const [payAmount, setPayAmount] = useState(0);

  const [customers, setCustomers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params: any = { limit: 100 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (pkgFilter) params.package_id = pkgFilter;
    loadData(params);
    loadPackages();
  }, [search, statusFilter, pkgFilter]);

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

  const loadBilling = async (subId: string) => {
    setBillingLoading(true);
    try {
      const res = await dataService.getISPBilling({ subscriber_id: subId, limit: 50 });
      setSubBilling(res.data || []);
    } catch (error) { setSubBilling([]); }
    setBillingLoading(false);
  };

  const totalMonthlyRevenue = subscribers.reduce((s, sub) => {
    if (sub.service_status === 'active' && sub.package) return s + Number(sub.package.price);
    return s;
  }, 0);

  const openSubDetail = async (sub: ISPSubscriber) => {
    setSelectedSub(sub);
    setDetailTab('overview');
    try {
      const res = await dataService.getISPSubscribers({ subscriber_code: sub.subscriber_code, limit: 1 });
      const detail = res.data?.[0];
      setSubDetail(detail || sub);
    } catch (error) { setSubDetail(sub); }
    loadBilling(sub.id);
  };

  const closeDetail = () => { setSelectedSub(null); setSubDetail(null); setSubBilling([]); };

  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', type: 'home', bandwidth_download: 0, bandwidth_upload: 0, bandwidth_unit: 'Mbps', price: 0, setup_fee: 0, billing_cycle: 'monthly', description: '' });
    setShowPkgModal(true);
  };

  const openEditPkg = (pkg: ISPPackage) => {
    setEditingPkg(pkg);
    setPkgForm({
      name: pkg.name, type: pkg.type,
      bandwidth_download: pkg.bandwidth_download, bandwidth_upload: pkg.bandwidth_upload,
      bandwidth_unit: pkg.bandwidth_unit, price: pkg.price, setup_fee: pkg.setup_fee,
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
    } catch (error) { toast.error('Failed to save package'); }
  };

  const openAddSub = async () => {
    try {
      const cRes = await dataService.getCustomers({ limit: 500 });
      setCustomers(cRes.data || []);
    } catch (error) {}
    setSubForm({ customer_id: '', package_id: '', installation_address: '', connection_type: 'fiber', static_ip: '', notes: '', service_status: 'pending' });
    setShowSubModal(true);
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await dataService.createISPSubscriber(subForm);
      toast.success('Subscriber added');
      setShowSubModal(false);
      loadData();
    } catch (error) { toast.error('Failed to add subscriber'); }
    setSubmitting(false);
  };

  const updateSubStatus = async (id: string, service_status: string) => {
    try {
      await dataService.updateISPSubscriber(id, { service_status });
      toast.success(`Status changed to ${getStatusLabel(service_status)}`);
      loadData();
      if (selectedSub) {
        setSelectedSub({ ...selectedSub, service_status });
        setSubDetail({ ...subDetail, service_status });
      }
    } catch (error) { toast.error('Failed to update status'); }
  };

  const handleCreateBill = async () => {
    if (!billForm.amount || !selectedSub) return;
    try {
      await dataService.createISPBilling({
        subscriber_id: selectedSub.id,
        amount: billForm.amount,
        billing_date: billForm.billing_date || new Date().toISOString().split('T')[0],
        due_date: billForm.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
      toast.success('Invoice created');
      setShowBillingModal(false);
      setBillForm({ amount: 0, billing_date: '', due_date: '' });
      loadBilling(selectedSub.id);
    } catch (error) { toast.error('Failed to create invoice'); }
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
    } catch (error) { toast.error('Failed to record payment'); }
  };

  const sd = subDetail;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">ISP Subscriber Management</h1>
          <p className="page-subtitle">Manage internet packages, subscribers, and billing</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadData(); loadPackages(); }} className="btn-secondary">
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><Users size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{subscribers.length}</p><p className="stat-label">Total Subscribers</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><Signal size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{packages.length}</p><p className="stat-label">Packages</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Wifi size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{subscribers.filter(s => s.service_status === 'active').length}</p><p className="stat-label">Active</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><DollarSign size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrency(totalMonthlyRevenue)}</p><p className="stat-label">Monthly Revenue</p></div>
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
                  <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : subscribers.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-surface-400">No subscribers found</td></tr>
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
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
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
                    <button onClick={() => { setBillForm({ amount: sd.package?.price || 0, billing_date: new Date().toISOString().split('T')[0], due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }); setShowBillingModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                      <CreditCard size={14} className="mr-1" /> Create Invoice
                    </button>
                  </div>

                  {sd.package && (
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
                    <div><p className="text-xs text-surface-500">Connection Type</p><p className="text-sm font-medium capitalize">{sd.connection_type || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Static IP</p><p className="text-sm font-mono text-xs">{sd.static_ip || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Installation Date</p><p className="text-sm font-medium">{sd.installation_date ? formatDate(sd.installation_date) : '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Created</p><p className="text-sm font-medium">{formatDate(sd.created_at)}</p></div>
                  </div>

                  {sd.installation_address && (
                    <div>
                      <p className="text-xs text-surface-500">Installation Address</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300">{sd.installation_address}</p>
                    </div>
                  )}

                  {sd.notes && (
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
                    <button onClick={() => { setBillForm({ amount: sd.package?.price || 0, billing_date: new Date().toISOString().split('T')[0], due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }); setShowBillingModal(true); }} className="btn-primary text-xs py-1.5 px-3">
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
                          <div key={bill.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                            <div className="flex items-start justify-between">
                              <div>
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
                              </div>
                              {bill.status !== 'paid' && (
                                <button onClick={() => { setPayingBill(bill); setPayAmount(outstanding); setShowPayModal(true); }} className="btn-primary text-xs py-1 px-2">
                                  <CreditCard size={12} className="mr-1" />Pay
                                </button>
                              )}
                            </div>
                          </div>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Price (TZS) *</label>
                  <input type="number" className="input" value={pkgForm.price || ''} onChange={e => setPkgForm({...pkgForm, price: Number(e.target.value)})} required />
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
                  <select className="input" value={subForm.customer_id} onChange={e => setSubForm({...subForm, customer_id: e.target.value})} required>
                    <option value="">Select customer</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>)}
                  </select>
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
              <div>
                <label className="label">Amount (TZS) *</label>
                <input type="number" className="input" value={billForm.amount || ''} onChange={e => setBillForm({...billForm, amount: Number(e.target.value)})} />
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
    </div>
  );
}
