import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { Customer, Lead } from '../types';
import { formatDate, formatCurrency, getStatusLabel } from '../lib/utils';
import {
  Plus, Search, Users, UserPlus, TrendingUp, X, Edit2, Trash2,
  Phone, Mail, MapPin, Building2, ChevronRight, RefreshCw,
  Filter, Download, UserCheck, Clock, DollarSign, Target,
} from 'lucide-react';

type Tab = 'overview' | 'customers' | 'leads';

const leadStatusColors: Record<string, string> = {
  new: 'badge-info',
  contacted: 'badge-warning',
  qualified: 'badge-warning',
  proposal: 'badge-info',
  negotiation: 'badge-warning',
  won: 'badge-success',
  lost: 'badge-danger',
};

export default function CRM() {
  const [tab, setTab] = useState<Tab>('overview');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadStats, setLeadStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    company_name: '', contact_person: '', email: '', phone: '',
    alternative_phone: '', website: '', address: '', city: '',
    region: '', category: '', source: '', notes: '',
  });
  const [leadForm, setLeadForm] = useState({
    title: '', description: '', source: '', status: 'new' as Lead['status'],
    value: 0, probability: 0, customer_id: '',
  });

  useEffect(() => {
    fetchAll();
  }, [search, tab]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      if (tab === 'overview' || tab === 'customers') {
        const { data: cData } = await dataService.getCustomers({ search: search || undefined, limit: 100 });
        setCustomers(cData);
      }
      if (tab === 'overview' || tab === 'leads') {
        const { data: lData } = await dataService.getLeads({ limit: 100 });
        setLeads(lData);
        const stats = await dataService.getLeadStats();
        setLeadStats(stats);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const { data } = await dataService.getCustomer(customer.id);
      setCustomerDetail(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await dataService.updateCustomer(editingCustomer.id, customerForm);
      } else {
        await dataService.createCustomer(customerForm);
      }
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ company_name: '', contact_person: '', email: '', phone: '', alternative_phone: '', website: '', address: '', city: '', region: '', category: '', source: '', notes: '' });
      fetchAll();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dataService.createLead(leadForm);
      setShowLeadModal(false);
      setLeadForm({ title: '', description: '', source: '', status: 'new', value: 0, probability: 0, customer_id: '' });
      fetchAll();
    } catch (error) {
      console.error(error);
    }
  };

  const updateLeadStatus = async (lead: Lead, status: string) => {
    try {
      await dataService.updateLead(lead.id, { status });
      fetchAll();
    } catch (error) {
      console.error(error);
    }
  };

  const editCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      company_name: customer.company_name || '',
      contact_person: customer.contact_person || '',
      email: customer.email || '',
      phone: customer.phone || '',
      alternative_phone: '',
      website: '',
      address: customer.address || '',
      city: customer.city || '',
      region: customer.region || '',
      category: '',
      source: '',
      notes: '',
    });
    setShowCustomerModal(true);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-blue-100 text-blue-600 dark:bg-blue-900/30"><Users size={24} /></div>
            <div><p className="stat-value">{customers.length}</p><p className="stat-label">Total Customers</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-accent-100 text-accent-600 dark:bg-accent-900/30"><UserPlus size={24} /></div>
            <div><p className="stat-value">{leadStats?.new || 0}</p><p className="stat-label">New Leads</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-purple-100 text-purple-600 dark:bg-purple-900/30"><Target size={24} /></div>
            <div><p className="stat-value">{leadStats?.qualified || 0}</p><p className="stat-label">Qualified Leads</p></div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="stat-icon bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"><TrendingUp size={24} /></div>
            <div><p className="stat-value">{leadStats?.won || 0}</p><p className="stat-label">Won Deals</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Lead Pipeline</h3>
          <div className="space-y-3">
            {leadStats && Object.entries(leadStats).filter(([k]) => k !== 'total').map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-24 text-sm capitalize text-surface-600 dark:text-surface-400">{status}</span>
                <div className="flex-1 h-2 rounded-full bg-surface-100 dark:bg-surface-700">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(Number(count) / Math.max(leadStats.total, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-surface-900 dark:text-surface-50">{String(count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Recent Customers</h3>
          <div className="space-y-3">
            {customers.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-200 p-3 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-700/50"
                onClick={() => openCustomerDetail(c)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                  {(c.company_name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{c.company_name || 'Unknown'}</p>
                  <p className="text-xs text-surface-500">{c.contact_person || c.email || '-'}</p>
                </div>
                <ChevronRight size={16} className="text-surface-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-surface-900 dark:text-surface-50">Active Leads</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['new', 'contacted', 'qualified', 'proposal'].map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage).slice(0, 3);
            return (
              <div key={stage} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-surface-500">{stage}</span>
                  <span className="text-xs font-bold text-surface-900 dark:text-surface-50">{leadStats?.[stage] || 0}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-surface-400">No leads</p>
                  )}
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="rounded bg-surface-50 p-2 text-xs dark:bg-surface-700/50">
                      <p className="font-medium text-surface-900 dark:text-surface-50 truncate">{lead.title}</p>
                      {lead.value && <p className="text-surface-500">{formatCurrency(lead.value)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Filter size={16} /></button>
          <button onClick={() => { setEditingCustomer(null); setCustomerForm({ company_name: '', contact_person: '', email: '', phone: '', alternative_phone: '', website: '', address: '', city: '', region: '', category: '', source: '', notes: '' }); setShowCustomerModal(true); }} className="btn-primary">
            <Plus size={18} className="mr-1" /> Add Customer
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Company</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Status</th>
              <th>Created</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-surface-400">No customers found. Add your first customer.</td></tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="cursor-pointer" onClick={() => openCustomerDetail(customer)}>
                  <td className="font-mono text-xs">{customer.customer_code}</td>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30">{customer.company_name?.charAt(0) || '?'}</div>
                      {customer.company_name || <span className="text-surface-400 italic">No name</span>}
                    </div>
                  </td>
                  <td>{customer.contact_person || '-'}</td>
                  <td>{customer.email || '-'}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>{[customer.city, customer.region].filter(Boolean).join(', ') || '-'}</td>
                  <td>
                    <span className={customer.is_active ? 'badge-success' : 'badge-danger'}>
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-surface-400 text-xs">{formatDate(customer.created_at)}</td>
                  <td>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => editCustomer(customer)} className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-primary-600"><Edit2 size={14} /></button>
                      <button onClick={async () => { if (!confirm('Delete this customer permanently?')) return; try { await dataService.deleteCustomer(customer.id); toast.success('Customer deleted'); fetchAll(); } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to delete'); } }} className="rounded p-1.5 text-surface-400 hover:bg-surface-100 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLeads = () => (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {['all', 'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map((s) => (
            <button key={s} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              s === 'all' ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-400'
            }`}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <button onClick={() => setShowLeadModal(true)} className="btn-primary">
          <Plus size={18} className="mr-1" /> Add Lead
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map((stage) => {
          const stageLeads = leads.filter(l => l.status === stage);
          return (
            <div key={stage} className="card">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold capitalize text-surface-900 dark:text-surface-50">{stage}</h4>
                <span className="badge bg-surface-100 text-surface-600 dark:bg-surface-700">{stageLeads.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {stageLeads.length === 0 && (
                  <p className="text-xs text-surface-400 text-center py-4">No leads</p>
                )}
                {stageLeads.map((lead) => (
                  <div key={lead.id} className="group relative rounded-lg border border-surface-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-surface-700 dark:bg-surface-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">{lead.title}</p>
                        {lead.value ? <p className="text-xs font-semibold text-accent-600 mt-0.5">{formatCurrency(lead.value)}</p> : null}
                        <p className="text-xs text-surface-400 mt-0.5">{lead.source || 'Direct'} · {formatDate(lead.created_at)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {stage !== 'won' && stage !== 'lost' && (
                        <>
                          {stage === 'new' && <button onClick={() => updateLeadStatus(lead, 'contacted')} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Contacted</button>}
                          {stage === 'contacted' && <button onClick={() => updateLeadStatus(lead, 'qualified')} className="text-xs px-2 py-0.5 rounded bg-accent-100 text-accent-700 hover:bg-accent-200">Qualify</button>}
                          {stage === 'qualified' && <button onClick={() => updateLeadStatus(lead, 'proposal')} className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200">Proposal</button>}
                          {stage === 'proposal' && <button onClick={() => updateLeadStatus(lead, 'negotiation')} className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Negotiate</button>}
                          {stage === 'negotiation' && <button onClick={() => updateLeadStatus(lead, 'won')} className="text-xs px-2 py-0.5 rounded bg-accent-100 text-accent-700 hover:bg-accent-200">Won</button>}
                          <button onClick={() => updateLeadStatus(lead, 'lost')} className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200">Lost</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Relationship Management</h1>
          <p className="page-subtitle">Manage customers, leads, and sales pipeline</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-surface-100 p-1 dark:bg-surface-800 w-fit">
        {(['overview', 'customers', 'leads'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              tab === t ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-50' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            {t === 'overview' && <><Users size={16} className="inline mr-1.5" />Overview</>}
            {t === 'customers' && <><Building2 size={16} className="inline mr-1.5" />Customers ({customers.length})</>}
            {t === 'leads' && <><Target size={16} className="inline mr-1.5" />Leads ({leads.length})</>}
          </button>
        ))}
      </div>

      {tab === 'overview' && renderOverview()}
      {tab === 'customers' && renderCustomers()}
      {tab === 'leads' && renderLeads()}

      {/* Customer Detail Side Panel */}
      {selectedCustomer && customerDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{customerDetail.company_name || 'Customer Detail'}</h2>
              <button onClick={() => { setSelectedCustomer(null); setCustomerDetail(null); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-2xl font-bold text-primary-700 dark:bg-primary-900/30">{customerDetail.company_name?.charAt(0) || '?'}</div>
                <div>
                  <p className="text-xl font-bold text-surface-900 dark:text-surface-50">{customerDetail.company_name || 'Unknown'}</p>
                  <p className="text-sm text-surface-500">{customerDetail.customer_code}</p>
                  <span className={customerDetail.is_active ? 'badge-success mt-1' : 'badge-danger mt-1'}>{customerDetail.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <UserCheck size={16} /><span className="font-medium text-surface-900 dark:text-surface-50 mr-1">Contact:</span> {customerDetail.contact_person || '-'}
                </div>
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <Mail size={16} /><span className="font-medium text-surface-900 dark:text-surface-50 mr-1">Email:</span> {customerDetail.email || '-'}
                </div>
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <Phone size={16} /><span className="font-medium text-surface-900 dark:text-surface-50 mr-1">Phone:</span> {customerDetail.phone || '-'}
                </div>
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <MapPin size={16} /><span className="font-medium text-surface-900 dark:text-surface-50 mr-1">City:</span> {customerDetail.city || '-'}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Contacts</h4>
                {customerDetail.contacts?.length > 0 ? (
                  <div className="space-y-2">
                    {customerDetail.contacts.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{c.name}</p>
                          <p className="text-xs text-surface-500">{c.position} · {c.email} · {c.phone}</p>
                        </div>
                        {c.is_primary && <span className="badge-success">Primary</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-surface-400">No contacts</p>}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Projects</h4>
                {customerDetail.projects?.length > 0 ? (
                  <div className="space-y-2">
                    {customerDetail.projects.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.name}</p>
                          <p className="text-xs text-surface-500">{p.project_code}</p>
                        </div>
                        <span className={`badge-${p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'warning' : 'info'}`}>{getStatusLabel(p.status)}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-surface-400">No projects</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Add/Edit Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => { setShowCustomerModal(false); setEditingCustomer(null); }} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Company Name *</label>
                  <input className="input" value={customerForm.company_name} onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Contact Person</label>
                  <input className="input" value={customerForm.contact_person} onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Alternative Phone</label>
                  <input className="input" value={customerForm.alternative_phone} onChange={(e) => setCustomerForm({ ...customerForm, alternative_phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input" value={customerForm.website} onChange={(e) => setCustomerForm({ ...customerForm, website: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">City</label>
                  <input className="input" value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                </div>
                <div>
                  <label className="label">Region</label>
                  <input className="input" value={customerForm.region} onChange={(e) => setCustomerForm({ ...customerForm, region: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={customerForm.category} onChange={(e) => setCustomerForm({ ...customerForm, category: e.target.value })}>
                    <option value="">Select category</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="sme">SME</option>
                    <option value="government">Government</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={customerForm.source} onChange={(e) => setCustomerForm({ ...customerForm, source: e.target.value })}>
                    <option value="">Select source</option>
                    <option value="referral">Referral</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="call">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCustomerModal(false); setEditingCustomer(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingCustomer ? 'Update Customer' : 'Save Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Add Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Add New Lead</h2>
              <button onClick={() => setShowLeadModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="label">Lead Title *</label>
                <input className="input" value={leadForm.title} onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })} placeholder="e.g. CCTV Installation for Office" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={leadForm.description} onChange={(e) => setLeadForm({ ...leadForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}>
                    <option value="">Select source</option>
                    <option value="referral">Referral</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="call">Phone Call</option>
                    <option value="email">Email Campaign</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as Lead['status'] })}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Expected Value (TZS)</label>
                  <input type="number" className="input" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Probability (%)</label>
                  <input type="number" min="0" max="100" className="input" value={leadForm.probability} onChange={(e) => setLeadForm({ ...leadForm, probability: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLeadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
