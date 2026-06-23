import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { ServiceContract, ContractRenewal, Customer, ContractStatus } from '../types';
import { formatDate, formatCurrency, getStatusLabel } from '../lib/utils';
import {
  ClipboardList, Plus, X, RefreshCw, Search, Edit2, Trash2,
  FileText, AlertTriangle, CheckCircle, Calendar, Clock,
} from 'lucide-react';

const CONTRACT_TYPES = ['amc', 'sla', 'maintenance', 'service', 'support', 'other'];

export default function Contracts() {
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expiring, setExpiring] = useState<ServiceContract[]>([]);

  const [selected, setSelected] = useState<ServiceContract | null>(null);
  const [detail, setDetail] = useState<ServiceContract | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'renewals'>('overview');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceContract | null>(null);
  const [form, setForm] = useState<any>({
    title: '', description: '', contract_type: 'amc',
    start_date: '', end_date: '', value: '',
    sla_response_hours: '', sla_resolution_hours: '',
    customer_id: '', notes: '',
  });
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [renewalForm, setRenewalForm] = useState({ renewal_date: '', new_value: '', notes: '' });
  const [showRenewal, setShowRenewal] = useState(false);

  const statuses: ContractStatus[] = ['active', 'expired', 'terminated', 'pending'];

  useEffect(() => {
    fetchContracts();
    fetchExpiring();
    dataService.getCustomers({ limit: 200 }).then(r => setCustomers(r.data)).catch(() => {});
  }, []);

  const fetchContracts = async (sFilter?: string, tFilter?: string) => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      const sf = sFilter ?? statusFilter;
      const tf = tFilter ?? typeFilter;
      if (sf !== 'all') params.status = sf;
      if (tf !== 'all') params.contract_type = tf;
      const { data } = await dataService.getContracts(params);
      setContracts(data);
    } catch (e) { console.error(e) } finally { setLoading(false); }
  };

  const fetchExpiring = async () => {
    try {
      const { data } = await dataService.getExpiringContracts();
      setExpiring(data || []);
    } catch (e) { /* ignore */ }
  };

  const openDetail = async (c: ServiceContract) => {
    setSelected(c);
    try {
      const { data } = await dataService.getContract(c.id);
      setDetail(data);
    } catch (e) { setDetail(null); }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); setDetailTab('overview'); };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contract?')) return;
    await dataService.deleteContract(id);
    fetchContracts();
    if (selected?.id === id) closeDetail();
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', contract_type: 'amc', start_date: '', end_date: '', value: '', sla_response_hours: '', sla_resolution_hours: '', customer_id: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditing(detail);
    setForm({
      title: detail.title || '',
      description: detail.description || '',
      contract_type: detail.contract_type || 'amc',
      start_date: detail.start_date?.split('T')[0] || '',
      end_date: detail.end_date?.split('T')[0] || '',
      value: detail.value || '',
      sla_response_hours: detail.sla_response_hours || '',
      sla_resolution_hours: detail.sla_resolution_hours || '',
      customer_id: detail.customer_id || '',
      notes: detail.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...form,
      value: form.value ? Number(form.value) : null,
      sla_response_hours: form.sla_response_hours ? Number(form.sla_response_hours) : null,
      sla_resolution_hours: form.sla_resolution_hours ? Number(form.sla_resolution_hours) : null,
    };
    if (editing) {
      await dataService.updateContract(editing.id, body);
    } else {
      await dataService.createContract(body);
    }
    setShowModal(false);
    fetchContracts();
    if (selected && editing) openDetail(selected);
  };

  const handleRenewal = async () => {
    if (!detail || !renewalForm.renewal_date) return;
    await dataService.createRenewal(detail.id, renewalForm);
    setShowRenewal(false);
    setRenewalForm({ renewal_date: '', new_value: '', notes: '' });
    openDetail(detail);
    fetchContracts();
    fetchExpiring();
  };

  const updateStatus = async (c: ServiceContract, status: ContractStatus) => {
    await dataService.updateContract(c.id, { status });
    fetchContracts();
    if (selected?.id === c.id) openDetail(c);
  };

  const filtered = contracts.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.contract_number.toLowerCase().includes(search.toLowerCase()) ||
    c.customer?.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = contracts.reduce((s, c) => s + Number(c.value || 0), 0);

  const statusColors: Record<string, string> = {
    active: 'badge-success', expired: 'badge-danger', terminated: 'badge-danger', pending: 'badge-warning',
  };
  const invStatusColors: Record<string, string> = {
    active: 'bg-accent-100 text-accent-700', expired: 'bg-red-100 text-red-700',
    terminated: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Contracts</h1>
          <p className="page-subtitle">Manage AMC, SLA agreements, and contract renewals</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} className="mr-1" /> New Contract</button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-600"><FileText size={24} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{contracts.length}</p><p className="stat-label">Total Contracts</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-accent-100 text-accent-600"><CheckCircle size={24} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{contracts.filter(c => c.status === 'active').length}</p><p className="stat-label">Active</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-yellow-100 text-yellow-600"><AlertTriangle size={24} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{expiring.length}</p><p className="stat-label">Expiring Soon</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-purple-100 text-purple-600"><ClipboardList size={24} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{formatCurrency(totalValue)}</p><p className="stat-label">Total Value</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => { const v = e.target.value; setStatusFilter(v); fetchContracts(v, typeFilter); }} className="input w-36">
          <option value="all">All Status</option>
          {statuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
        </select>
        <select value={typeFilter} onChange={e => { const v = e.target.value; setTypeFilter(v); fetchContracts(statusFilter, v); }} className="input w-36">
          <option value="all">All Types</option>
          {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <button onClick={() => { fetchContracts(); fetchExpiring(); }} className="btn-secondary btn-icon"><RefreshCw size={16} /></button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-surface-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-surface-400">No contracts found</td></tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)} className="cursor-pointer hover:bg-surface-50">
                  <td className="font-mono text-xs">{c.contract_number}</td>
                  <td className="font-medium">{c.title}</td>
                  <td>{c.customer?.company_name || '-'}</td>
                  <td className="capitalize">{c.contract_type}</td>
                  <td>{formatDate(c.start_date)}</td>
                  <td><span className={new Date(c.end_date) < new Date() && c.status === 'active' ? 'text-red-600 font-medium' : ''}>{formatDate(c.end_date)}</span></td>
                  <td>{c.value ? formatCurrency(c.value) : '-'}</td>
                  <td><span className={statusColors[c.status]}>{getStatusLabel(c.status)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Side Panel */}
      {selected && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold">{detail.contract_number}</h2>
                <p className="text-xs text-surface-500">{detail.title} · {detail.customer?.company_name || 'No customer'}</p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'renewals'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' && <><FileText size={14} className="inline mr-1" />Overview</>}
                  {t === 'renewals' && <><RefreshCw size={14} className="inline mr-1" />Renewals ({(detail.renewals || []).length})</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  {/* Status + Actions */}
                  <div className="flex items-center justify-between">
                    <select value={detail.status} onChange={e => updateStatus(detail, e.target.value as ContractStatus)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium capitalize ${invStatusColors[detail.status] || 'bg-surface-100 text-surface-600'}`}>
                      {statuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={openEdit} className="btn-secondary text-xs py-1.5 px-3"><Edit2 size={14} className="mr-1" /> Edit</button>
                      <button onClick={() => handleDelete(detail.id)} className="btn-secondary text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 size={14} className="mr-1" /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Info Card */}
                  <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                    <p className="text-sm font-semibold mb-3">Contract Information</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-surface-500">Title</span><p className="font-medium">{detail.title}</p></div>
                      <div><span className="text-surface-500">Type</span><p className="font-medium capitalize">{detail.contract_type}</p></div>
                      <div><span className="text-surface-500">Customer</span><p className="font-medium">{detail.customer?.company_name || detail.customer?.contact_person || '-'}</p></div>
                      <div><span className="text-surface-500">Value</span><p className="font-medium">{detail.value ? formatCurrency(detail.value) : '-'}</p></div>
                      <div><span className="text-surface-500">Start Date</span><p className="font-medium">{formatDate(detail.start_date)}</p></div>
                      <div><span className="text-surface-500">End Date</span><p className="font-medium">{formatDate(detail.end_date)}</p></div>
                      {detail.renewal_date && <div><span className="text-surface-500">Renewal Date</span><p className="font-medium">{formatDate(detail.renewal_date)}</p></div>}
                      <div><span className="text-surface-500">Created</span><p className="font-medium">{formatDate(detail.created_at)}</p></div>
                    </div>
                    {detail.description && <div className="mt-3"><span className="text-surface-500 text-sm">Description</span><p className="text-sm mt-1">{detail.description}</p></div>}
                  </div>

                  {/* SLA Info */}
                  {(detail.sla_response_hours || detail.sla_resolution_hours) && (
                    <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                      <p className="text-sm font-semibold mb-3">SLA</p>
                      <div className="flex gap-6 text-sm">
                        {detail.sla_response_hours && (
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-primary-500" />
                            <span>Response: <strong>{detail.sla_response_hours}h</strong></span>
                          </div>
                        )}
                        {detail.sla_resolution_hours && (
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-primary-500" />
                            <span>Resolution: <strong>{detail.sla_resolution_hours}h</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {detail.notes && (
                    <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                      <p className="text-sm font-semibold mb-1">Notes</p>
                      <p className="text-sm text-surface-600">{detail.notes}</p>
                    </div>
                  )}

                  {/* Renewal action */}
                  <button onClick={() => setShowRenewal(true)} className="btn-primary w-full py-2">
                    <RefreshCw size={16} className="mr-2" /> Record Renewal
                  </button>
                </div>
              )}

              {detailTab === 'renewals' && (
                <div className="space-y-4">
                  {(detail.renewals || []).length === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-8">No renewals recorded</p>
                  ) : (
                    (detail.renewals || []).map(r => (
                      <div key={r.id} className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-primary-500" />
                            <span className="font-medium">{formatDate(r.renewal_date)}</span>
                          </div>
                          {r.new_value && <span className="text-sm font-semibold">{formatCurrency(r.new_value)}</span>}
                        </div>
                        {r.notes && <p className="text-sm text-surface-500 mt-2">{r.notes}</p>}
                      </div>
                    ))
                  )}

                  <button onClick={() => setShowRenewal(true)} className="btn-primary w-full py-2">
                    <RefreshCw size={16} className="mr-2" /> Record Renewal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Contract' : 'New Contract'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Title</label>
                  <input type="text" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Value (TSh)</label>
                  <input type="number" className="input" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Customer</label>
                  <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                    <option value="">Select customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.contact_person || c.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">SLA Response (hrs)</label>
                  <input type="number" className="input" value={form.sla_response_hours} onChange={e => setForm({ ...form, sla_response_hours: e.target.value })} />
                </div>
                <div>
                  <label className="label">SLA Resolution (hrs)</label>
                  <input type="number" className="input" value={form.sla_resolution_hours} onChange={e => setForm({ ...form, sla_resolution_hours: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary">{editing ? 'Update' : 'Create'} Contract</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Renewal Modal */}
      {showRenewal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowRenewal(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Record Renewal</h2>
              <button onClick={() => setShowRenewal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <p className="text-sm text-surface-500 mb-4">Contract: <strong>{detail.contract_number}</strong> — {detail.title}</p>
            <div className="space-y-4">
              <div>
                <label className="label">Renewal Date</label>
                <input type="date" className="input" value={renewalForm.renewal_date}
                  onChange={e => setRenewalForm({ ...renewalForm, renewal_date: e.target.value })} required />
              </div>
              <div>
                <label className="label">New Value (TSh) — optional</label>
                <input type="number" className="input" value={renewalForm.new_value}
                  onChange={e => setRenewalForm({ ...renewalForm, new_value: e.target.value })} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={renewalForm.notes}
                  onChange={e => setRenewalForm({ ...renewalForm, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowRenewal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleRenewal} className="btn-primary">Record Renewal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
