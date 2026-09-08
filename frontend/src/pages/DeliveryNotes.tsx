import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { DeliveryNote, DeliveryNoteItem, DeliveryNoteStatus } from '../types';
import { formatDate, formatDateTime } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import {
  Truck, Plus, X, Search, RefreshCw, Edit2, Trash2, Download, Eye, PackageCheck, Loader2,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'badge-warning', dispatched: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger',
};
const statusLabels: Record<string, string> = {
  pending: 'Pending', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};
const statuses: DeliveryNoteStatus[] = ['pending', 'dispatched', 'delivered', 'cancelled'];

const emptyItem = { description: '', quantity: 1, unit: '' };

export default function DeliveryNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);

  // Filtered lists based on cascading selections
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DeliveryNote | null>(null);
  const [form, setForm] = useState({
    customer_id: '', project_id: '', invoice_id: '', delivery_date: new Date().toISOString().split('T')[0],
    delivery_address: '', delivery_contact_name: '', delivery_contact_phone: '',
    dispatch_date: '', received_date: '', received_by_name: '', notes: '', status: 'pending' as DeliveryNoteStatus,
  });
  const [items, setItems] = useState<any[]>([]);

  // Loading states for auto-fill
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const [selected, setSelected] = useState<DeliveryNote | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await dataService.getDeliveryNotes({
        page, limit, search: search || undefined, status: statusFilter || undefined,
      });
      setNotes(res.data || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to load delivery notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [c, p, inv] = await Promise.all([
        dataService.getCustomers({ limit: 500 }),
        dataService.getProjects({ limit: 500 }),
        dataService.getInvoices({ limit: 500 }),
      ]);
      const custList = c.data || c || [];
      const projList = p.data || p || [];
      const invList = inv.data || inv || [];
      setAllCustomers(custList);
      setAllProjects(projList);
      setAllInvoices(invList);
      setFilteredProjects(projList);
      setFilteredInvoices(invList);
    } catch (_) { /* ignore */ }
  };

  useEffect(() => { fetchNotes(); }, [page, statusFilter]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchNotes(); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    if (showModal) fetchOptions();
  }, [showModal]);

  // ============================================
  // CASCADING: Customer -> Filter projects
  // ============================================
  const handleCustomerChange = useCallback((customerId: string) => {
    setForm(prev => ({
      ...prev,
      customer_id: customerId,
      project_id: '',
      invoice_id: '',
    }));

    if (customerId) {
      setFilteredProjects(allProjects.filter(p => p.customer_id === customerId));
      setFilteredInvoices([]);
    } else {
      setFilteredProjects(allProjects);
      setFilteredInvoices(allInvoices);
    }
  }, [allProjects, allInvoices]);

  // ============================================
  // CASCADING: Project -> Auto-fill customer, address, contact, filter invoices
  // ============================================
  const handleProjectChange = useCallback(async (projectId: string) => {
    setForm(prev => ({ ...prev, project_id: projectId }));

    if (!projectId) {
      // Reset to customer-level if customer is set
      if (form.customer_id) {
        setFilteredProjects(allProjects.filter(p => p.customer_id === form.customer_id));
        setFilteredInvoices(allInvoices.filter(i => i.customer_id === form.customer_id));
      } else {
        setFilteredProjects(allProjects);
        setFilteredInvoices(allInvoices);
      }
      return;
    }

    setLoadingProject(true);
    try {
      const proj = await dataService.getProject(projectId);
      const cust = proj?.data?.customer;

      const addressParts = [cust?.address, cust?.city, cust?.region, cust?.country].filter(Boolean);
      const fullAddress = addressParts.join(', ');
      const contactName = cust?.contact_person || cust?.company_name || '';
      const contactPhone = cust?.phone || '';

      setForm(prev => ({
        ...prev,
        project_id: projectId,
        customer_id: cust?.id || prev.customer_id,
        delivery_address: prev.delivery_address || fullAddress,
        delivery_contact_name: prev.delivery_contact_name || contactName,
        delivery_contact_phone: prev.delivery_contact_phone || contactPhone,
      }));

      // Filter invoices to this project or customer
      const relatedInvoices = allInvoices.filter(i =>
        i.project_id === projectId || (cust?.id && i.customer_id === cust?.id)
      );
      setFilteredInvoices(relatedInvoices);
    } catch (_) {
      toast.error('Failed to load project details');
    } finally {
      setLoadingProject(false);
    }
  }, [allProjects, allInvoices, form.customer_id]);

  // ============================================
  // CASCADING: Invoice -> Auto-populate items
  // ============================================
  const handleInvoiceChange = useCallback(async (invoiceId: string) => {
    setForm(prev => ({ ...prev, invoice_id: invoiceId }));

    if (!invoiceId) return;

    setLoadingInvoice(true);
    try {
      const inv = await dataService.getInvoice(invoiceId);
      const invItems = inv?.data?.items || [];

      if (invItems.length > 0) {
        const newItems = invItems.map((it: any) => ({
          description: it.description || '',
          quantity: it.quantity || 1,
          unit: '',
        }));
        setItems(newItems);
        toast.success(`Loaded ${newItems.length} item${newItems.length > 1 ? 's' : ''} from invoice`);
      }

      // Also auto-fill from invoice if fields are empty
      if (inv?.data?.customer) {
        const cust = inv.data.customer;
        const addressParts = [cust.address, cust.city, cust.region, cust.country].filter(Boolean);
        const fullAddress = addressParts.join(', ');
        setForm(prev => ({
          ...prev,
          invoice_id: invoiceId,
          customer_id: prev.customer_id || inv.data.customer_id,
          delivery_address: prev.delivery_address || fullAddress,
          delivery_contact_name: prev.delivery_contact_name || cust?.contact_person || cust?.company_name || '',
          delivery_contact_phone: prev.delivery_contact_phone || cust?.phone || '',
        }));
      }
    } catch (_) {
      toast.error('Failed to load invoice items');
    } finally {
      setLoadingInvoice(false);
    }
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      customer_id: '', project_id: '', invoice_id: '', delivery_date: new Date().toISOString().split('T')[0],
      delivery_address: '', delivery_contact_name: '', delivery_contact_phone: '',
      dispatch_date: '', received_date: '', received_by_name: '', notes: '', status: 'pending',
    });
    setItems([{ ...emptyItem }]);
    setFilteredProjects(allProjects);
    setFilteredInvoices(allInvoices);
    setShowModal(true);
  };

  const openEdit = (note: DeliveryNote) => {
    setEditing(note);
    setForm({
      customer_id: note.customer_id || '', project_id: note.project_id || '', invoice_id: note.invoice_id || '',
      delivery_date: (note.delivery_date || '').slice(0, 10), delivery_address: note.delivery_address || '',
      delivery_contact_name: note.delivery_contact_name || '', delivery_contact_phone: note.delivery_contact_phone || '',
      dispatch_date: (note.dispatch_date || '').slice(0, 10), received_date: (note.received_date || '').slice(0, 10),
      received_by_name: note.received_by_name || '', notes: note.notes || '', status: note.status,
    });
    setItems((note.items || []).map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit || '' })));

    // Filter dropdowns for existing selections
    if (note.customer_id) {
      setFilteredProjects(allProjects.filter(p => p.customer_id === note.customer_id));
    }
    if (note.customer_id || note.project_id) {
      setFilteredInvoices(allInvoices.filter(i =>
        (note.project_id && i.project_id === note.project_id) || (note.customer_id && i.customer_id === note.customer_id)
      ));
    }

    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items.filter(i => i.description.trim());
    if (cleanItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    try {
      const payload = { ...form, items: cleanItems };
      if (editing) {
        await dataService.updateDeliveryNote(editing.id, payload);
        toast.success('Delivery note updated');
      } else {
        await dataService.createDeliveryNote(payload);
        toast.success('Delivery note created');
      }
      setShowModal(false);
      fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save delivery note');
    }
  };

  const handleDelete = async (note: DeliveryNote) => {
    if (!window.confirm(`Delete delivery note ${note.delivery_number}?`)) return;
    try {
      await dataService.deleteDeliveryNote(note.id);
      toast.success('Delivery note deleted');
      fetchNotes();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete delivery note');
    }
  };

  const handlePdf = async (note: DeliveryNote) => {
    try {
      await dataService.downloadDeliveryNotePdf(note.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download PDF');
    }
  };

  const openDetail = async (note: DeliveryNote) => {
    try {
      const full = await dataService.getDeliveryNote(note.id);
      setSelected(full);
    } catch (_) {
      setSelected(note);
    }
  };

  const canCreate = ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer'].includes(user?.role || '');
  const canEdit = ['super_admin', 'ceo', 'managing_director', 'accountant', 'engineer', 'marketing_officer'].includes(user?.role || '');
  const canDelete = ['super_admin', 'ceo', 'managing_director', 'accountant'].includes(user?.role || '');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Truck className="text-primary-600" /> Delivery Notes</h1>
          <p className="page-subtitle">Generate and manage delivery notes for your projects and sales</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={18} className="mr-1" /> New Delivery Note
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        <div className="stat-card">
          <div className="stat-icon bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><PackageCheck size={22} /></div>
          <div>
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total Notes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"><PackageCheck size={22} /></div>
          <div>
            <div className="stat-value">{notes.filter(n => n.status === 'pending').length}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-blue-500 text-white"><PackageCheck size={22} /></div>
          <div>
            <div className="stat-value">{notes.filter(n => n.status === 'dispatched').length}</div>
            <div className="stat-label">Dispatched</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><PackageCheck size={22} /></div>
          <div>
            <div className="stat-value">{notes.filter(n => n.status === 'delivered').length}</div>
            <div className="stat-label">Delivered</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-10" placeholder="Search delivery note number, contact name..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="btn-secondary">
          <RefreshCw size={16} className="mr-1" /> Reset
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Delivery No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Status</th>
              <th>Received By</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-surface-400">Loading...</td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-surface-400">No delivery notes found</td></tr>
            ) : notes.map(note => (
              <tr key={note.id}>
                <td className="font-medium text-primary-600">{note.delivery_number}</td>
                <td>{formatDate(note.delivery_date)}</td>
                <td>{note.customer?.company_name || note.customer?.contact_person || '\u2014'}</td>
                <td>{(note.items?.length || 0)}</td>
                <td><span className={statusColors[note.status] || 'badge-info'}>{statusLabels[note.status] || note.status}</span></td>
                <td>{note.received_by_name || '\u2014'}</td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openDetail(note)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-primary-600" title="View">
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(note)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-blue-600" title="Edit">
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => handlePdf(note)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-emerald-600" title="Download PDF">
                      <Download size={16} />
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(note)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-red-600" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-surface-400">{total} notes</p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-1 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="text-sm text-surface-500">Page {page} of {totalPages}</span>
            <button className="btn-secondary px-3 py-1 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? `Edit ${editing.delivery_number}` : 'New Delivery Note'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">

              {/* Step 1: Customer -> Project -> Invoice (cascading) */}
              <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/30 dark:bg-primary-900/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                  Step 1: Select Customer & Project
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Customer</label>
                    <select className="input" value={form.customer_id} onChange={e => handleCustomerChange(e.target.value)}>
                      <option value="">Select customer</option>
                      {allCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      Project {form.customer_id ? '' : '(select customer first)'}
                    </label>
                    <select
                      className="input"
                      value={form.project_id}
                      onChange={e => handleProjectChange(e.target.value)}
                      disabled={!form.customer_id || loadingProject}
                    >
                      <option value="">{loadingProject ? 'Loading...' : 'Select project'}</option>
                      {filteredProjects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      Invoice {form.project_id ? '' : '(select project first)'}
                    </label>
                    <select
                      className="input"
                      value={form.invoice_id}
                      onChange={e => handleInvoiceChange(e.target.value)}
                      disabled={!form.project_id || loadingInvoice}
                    >
                      <option value="">{loadingInvoice ? 'Loading items...' : 'Select invoice'}</option>
                      {filteredInvoices.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {loadingProject && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-primary-500">
                    <Loader2 size={12} className="animate-spin" /> Fetching project details...
                  </p>
                )}
                {loadingInvoice && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-primary-500">
                    <Loader2 size={12} className="animate-spin" /> Loading invoice items...
                  </p>
                )}
              </div>

              {/* Step 2: Delivery Info (auto-filled but editable) */}
              <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800/50">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Step 2: Delivery Details <span className="font-normal normal-case">(auto-filled, you can edit)</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contact Person</label>
                    <input className="input" placeholder="Contact name" value={form.delivery_contact_name} onChange={e => setForm({ ...form, delivery_contact_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Contact Phone</label>
                    <input className="input" placeholder="Phone" value={form.delivery_contact_phone} onChange={e => setForm({ ...form, delivery_contact_phone: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="label">Delivery Address</label>
                  <textarea className="input" rows={2} value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })} />
                </div>
              </div>

              {/* Step 3: Dates & Status */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Delivery Date</label>
                  <input type="date" className="input" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DeliveryNoteStatus })}>
                    {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Received By (optional)</label>
                  <input className="input" placeholder="Receiver name" value={form.received_by_name} onChange={e => setForm({ ...form, received_by_name: e.target.value })} />
                </div>
              </div>

              {/* Step 4: Items (auto-populated from invoice, fully editable) */}
              <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800/50">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                    Step 3: Items {items.length > 0 && <span className="font-normal normal-case">({items.length} item{items.length > 1 ? 's' : ''})</span>}
                  </p>
                  <button type="button" onClick={() => setItems([...items, { ...emptyItem }])} className="btn-secondary px-2 py-1 text-xs">
                    <Plus size={12} className="mr-1" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-medium text-surface-400">{i + 1}</span>
                      <input className="input flex-1" placeholder="Description" value={item.description} onChange={e => {
                        const arr = [...items]; arr[i].description = e.target.value; setItems(arr);
                      }} required />
                      <input type="number" className="input w-20 text-center" placeholder="Qty" value={item.quantity || ''} onChange={e => {
                        const arr = [...items]; arr[i].quantity = Number(e.target.value); setItems(arr);
                      }} min={1} required />
                      <input className="input w-24" placeholder="Unit" value={item.unit || ''} onChange={e => {
                        const arr = [...items]; arr[i].unit = e.target.value; setItems(arr);
                      }} />
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {items.length === 0 && (
                  <button type="button" onClick={() => setItems([{ ...emptyItem }])} className="mt-2 w-full rounded-lg border border-dashed border-surface-300 py-4 text-center text-sm text-surface-400 hover:border-primary-400 hover:text-primary-500 transition-colors">
                    <Plus size={16} className="mr-1 inline" /> Add first item
                  </button>
                )}
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional delivery notes..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create Delivery Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">{selected.delivery_number}</h2>
                <p className="text-sm text-surface-400">Created {formatDateTime(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={statusColors[selected.status] || 'badge-info'}>{statusLabels[selected.status] || selected.status}</span>
                <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Customer</p>
                <p className="font-medium">{selected.customer?.company_name || selected.customer?.contact_person || '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Delivery Date</p>
                <p>{formatDate(selected.delivery_date)}</p>
              </div>
              {selected.project?.name && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Project</p>
                  <p>{selected.project.name}</p>
                </div>
              )}
              {selected.delivery_contact_name && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Contact Person</p>
                  <p>{selected.delivery_contact_name}{selected.delivery_contact_phone ? ` (${selected.delivery_contact_phone})` : ''}</p>
                </div>
              )}
            </div>

            {selected.delivery_address && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Delivery Address</p>
                <p className="text-surface-600 dark:text-surface-300">{selected.delivery_address}</p>
              </div>
            )}

            <div className="mb-4 rounded-lg border border-surface-200 dark:border-surface-700">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Description</th>
                    <th className="text-center">Qty</th>
                    <th className="text-center">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-surface-400">No items</td></tr>
                  ) : (selected.items || []).map((item, i) => (
                    <tr key={item.id || i}>
                      <td>{i + 1}</td>
                      <td>{item.description}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-center">{item.unit || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected.notes && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Notes</p>
                <p className="text-surface-600 dark:text-surface-300">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {canEdit && (
                <button onClick={() => { setSelected(null); openEdit(selected); }} className="btn-secondary">
                  <Edit2 size={16} className="mr-1" /> Edit
                </button>
              )}
              <button onClick={() => handlePdf(selected)} className="btn-primary">
                <Download size={16} className="mr-1" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
