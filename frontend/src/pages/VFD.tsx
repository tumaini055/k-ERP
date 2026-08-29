import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { formatCurrency, formatDateTime, getStatusLabel } from '../lib/utils';
import {
  RefreshCw, Plus, Search, Save, PlugZap, KeyRound, X,
  LayoutDashboard, Settings2, ListOrdered, Hash, Clock, FileText,
  ShieldCheck, Ban, ExternalLink, ChevronRight,
} from 'lucide-react';

type TabType = 'dashboard' | 'config' | 'generate' | 'receipts' | 'tax_rates' | 'logs';

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  submitted: 'badge-info',
  accepted: 'badge-success',
  rejected: 'badge-danger',
  failed: 'badge-danger',
  voided: 'badge-danger',
};

const emptyConfig = {
  tin: '', vrn: '', business_name: '', business_address: '', tax_office: '', tax_region: '',
  efd_serial: '', certkey: '', regid: '', uin: '', receipt_code: '', cert_serial: '',
  cert_private_key: '', environment: 'test', api_username: '', api_password: '',
  routing_key: 'vfdrct', receipt_prefix: 'RCT', auto_submit: true, default_tax_rate: 18, currency: 'TZS',
};

export default function VFD() {
  const [tab, setTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  const [genForm, setGenForm] = useState<any>({ invoice_id: '', payment_method: 'cash' });
  const [genItems, setGenItems] = useState<{ description: string; quantity: number; unit_price: number; tax_rate: number }[]>([
    { description: '', quantity: 1, unit_price: 0, tax_rate: 18 },
  ]);
  const [genCustomer, setGenCustomer] = useState({ name: '', tin: '', mobile: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [logAction, setLogAction] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await dataService.getVfdStatus();
      setStatus(data);
    } catch (error) { console.error(error); }
  }, []);

  const fetchTaxRates = useCallback(async () => {
    try {
      const { data } = await dataService.getVfdTaxRates();
      setTaxRates(data || []);
    } catch (error) { console.error(error); }
  }, []);

  const fetchReceipts = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (receiptSearch) params.search = receiptSearch;
      if (receiptStatusFilter) params.status = receiptStatusFilter;
      const { data } = await dataService.getVfdReceipts(params);
      setReceipts(data || []);
    } catch (error) { console.error(error); }
  }, [receiptSearch, receiptStatusFilter]);

  const fetchLogs = useCallback(async () => {
    try {
      const params: any = {};
      if (logAction) params.action = logAction;
      const { data } = await dataService.getVfdLogs(params);
      setLogs(data || []);
    } catch (error) { console.error(error); }
  }, [logAction]);

  useEffect(() => {
    refreshStatus();
    fetchTaxRates();
    setLoading(false);
  }, [refreshStatus, fetchTaxRates]);

  useEffect(() => {
    if (tab === 'receipts') fetchReceipts();
    if (tab === 'logs') fetchLogs();
    if (tab === 'config') loadConfig();
    if (tab === 'generate') loadInvoices();
  }, [tab, fetchReceipts, fetchLogs]);

  const loadConfig = async () => {
    try {
      const { data } = await dataService.getVfdConfig();
      setConfig(data || {});
    } catch (error) { console.error(error); }
  };

  const loadInvoices = async () => {
    try {
      const { data } = await dataService.getInvoices({ limit: 100 });
      setInvoices(data || []);
    } catch (error) { console.error(error); }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dataService.saveVfdConfig(config);
      toast.success('VFD configuration saved');
      refreshStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save configuration');
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleTestConnection = async () => {
    setActionBusy('test');
    try {
      const { data } = await dataService.testTraConnection();
      if (data?.connected) toast.success(data.message);
      else toast.error(data?.message || 'Connection failed');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Connection test failed');
    } finally {
      setActionBusy(null);
      refreshStatus();
    }
  };

  const handleFetchToken = async () => {
    setActionBusy('token');
    try {
      const { data } = await dataService.fetchTraToken();
      toast.success(`Token obtained - expires in ${data.expires_in}s`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to fetch token');
    } finally {
      setActionBusy(null);
      refreshStatus();
    }
  };

  const handleRegister = async () => {
    if (!confirm('Send registration request to TRA? This is normally a one-time step.')) return;
    setActionBusy('register');
    try {
      const { data } = await dataService.registerVfd();
      if (data?.ackCode === 0) {
        toast.success('Registration successful - REGID, UIN, USERNAME & PASSWORD saved to configuration');
        loadConfig();
      } else {
        toast.error(`Registration rejected: ${data?.ackMsg || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Registration failed');
    } finally {
      setActionBusy(null);
      refreshStatus();
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.invoice_id && genItems.some((i) => !i.description || !i.unit_price)) {
      toast.error('Fill in all manual line items or select an invoice');
      return;
    }
    setSubmitting(true);
    try {
      const body: any = {
        sale_id: genForm.invoice_id || null,
        source_type: genForm.invoice_id ? 'invoice' : 'manual',
        payment_method: genForm.payment_method,
      };
      if (!genForm.invoice_id) {
        body.items = genItems.map((i) => ({ ...i, tax_rate: Number(i.tax_rate) }));
        body.customer = genCustomer;
      }
      const { data } = await dataService.createVfdReceipt(body);
      toast.success(
        data.status === 'accepted'
          ? `Fiscal receipt ${data.receipt_number} issued & accepted by TRA`
          : `Fiscal receipt ${data.receipt_number} created (${data.status})`
      );
      setGenForm({ invoice_id: '', payment_method: 'cash' });
      setGenItems([{ description: '', quantity: 1, unit_price: 0, tax_rate: 18 }]);
      setGenCustomer({ name: '', tin: '', mobile: '' });
      refreshStatus();
      fetchReceipts();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to generate fiscal receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const openReceipt = async (id: string) => {
    try {
      const { data } = await dataService.getVfdReceipt(id);
      setSelectedReceipt(data);
    } catch (error) { toast.error('Failed to load receipt'); }
  };

  const handleSubmitReceipt = async (id: string) => {
    setActionBusy(`submit-${id}`);
    try {
      const { data } = await dataService.submitVfdReceipt(id);
      if (data?.ok) toast.success('Receipt accepted by TRA');
      else toast.error(`TRA rejected: ${data?.ack?.ackMsg || 'Unknown error'}`);
      fetchReceipts();
      refreshStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit receipt');
    } finally {
      setActionBusy(null);
    }
  };

  const handleVoidReceipt = async (id: string) => {
    const reason = prompt('Reason for voiding this fiscal receipt:');
    if (reason === null) return;
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    if (!confirm('Void this fiscal receipt? This cannot be undone.')) return;
    setActionBusy(`void-${id}`);
    try {
      await dataService.voidVfdReceipt(id, reason);
      toast.success('Receipt voided');
      fetchReceipts();
      refreshStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to void receipt');
    } finally {
      setActionBusy(null);
    }
  };

  const renderTabBar = () => (
    <div className="mb-6 flex flex-wrap border-b border-surface-200 dark:border-surface-700">
      {([
        ['dashboard', 'Dashboard', LayoutDashboard],
        ['config', 'Configuration', Settings2],
        ['generate', 'Generate Receipt', Plus],
        ['receipts', 'Receipts', ListOrdered],
        ['tax_rates', 'Tax Rates', Hash],
        ['logs', 'API Logs', Clock],
      ] as [TabType, string, any][]).map(([t, label, Icon]) => (
        <button key={t} onClick={() => setTab(t)}
          className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
            tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}>
          <Icon size={14} className="mr-1.5 inline" />
          {label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-surface-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">TRA VFD Fiscal Receipts</h1>
          <p className="page-subtitle">Generate, submit and manage TRA fiscal receipts (VFD/EFD integration)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { refreshStatus(); if (tab === 'receipts') fetchReceipts(); if (tab === 'logs') fetchLogs(); }} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          {tab === 'generate' && (
            <button onClick={handleGenerate} className="btn-primary" disabled={submitting}>
              <Plus size={18} className="mr-1" /> {submitting ? 'Generating...' : 'Generate Receipt'}
            </button>
          )}
        </div>
      </div>

      {renderTabBar()}

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><FileText size={22} /></div>
              <div className="min-w-0 overflow-hidden">
                <p className="stat-value">{status?.counters?.total ?? 0}</p>
                <p className="stat-label">Total Fiscal Receipts</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Clock size={22} /></div>
              <div className="min-w-0 overflow-hidden">
                <p className="stat-value">{status?.counters?.pending ?? 0}</p>
                <p className="stat-label">Pending / Failed</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-green-100 text-green-600"><ShieldCheck size={22} /></div>
              <div className="min-w-0 overflow-hidden">
                <p className="stat-value">{status?.counters?.accepted ?? 0}</p>
                <p className="stat-label">Accepted by TRA</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon shrink-0 bg-red-100 text-red-600"><X size={22} /></div>
              <div className="min-w-0 overflow-hidden">
                <p className="stat-value">{status?.counters?.rejected ?? 0}</p>
                <p className="stat-label">Rejected</p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">TRA Connection</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Environment</span>
                  <span className={`badge ${status?.environment === 'production' ? 'badge-danger' : 'badge-info'}`}>
                    {status?.environment === 'production' ? 'PRODUCTION' : 'TEST'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">API Token</span>
                  <span className={`badge ${status?.token_valid ? 'badge-success' : 'badge-danger'}`}>
                    {status?.token_valid ? 'Valid' : 'Expired / Missing'}
                  </span>
                </div>
                {status?.token_expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500">Token Expires</span>
                    <span className="text-xs">{formatDateTime(status.token_expires_at)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Global Counter (GC)</span>
                  <span className="font-mono text-sm font-semibold">{status?.gc ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Daily Counter (DC)</span>
                  <span className="font-mono text-sm font-semibold">{status?.dc ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Next Receipt #</span>
                  <span className="font-mono text-sm font-semibold">{status?.next_receipt_number ?? 1}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={handleTestConnection} disabled={!!actionBusy} className="btn-secondary">
                  <PlugZap size={16} className="mr-1" /> Test Connection
                </button>
                <button onClick={handleFetchToken} disabled={!!actionBusy} className="btn-secondary">
                  <KeyRound size={16} className="mr-1" /> Fetch Token
                </button>
                <button onClick={handleRegister} disabled={!!actionBusy} className="btn-primary">
                  <ShieldCheck size={16} className="mr-1" /> Register VFD
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Quick Guide</h3>
              <ol className="list-inside list-decimal space-y-2 text-sm text-surface-500">
                <li>Save your VFD configuration under <b>Configuration</b> (TIN, EFD serial, certificate &amp; credentials).</li>
                <li>Run <b>Test Connection</b> to verify TRA reachability, then <b>Fetch Token</b>.</li>
                <li>Use <b>Register VFD</b> once to obtain REGID, UIN and RECEIPTCODE from TRA.</li>
                <li>Generate fiscal receipts from paid invoices under <b>Generate Receipt</b>.</li>
                <li>Resubmit any <span className="badge badge-warning">pending</span> or <span className="badge badge-danger">failed</span> receipts once the connection is restored.</li>
              </ol>
            </div>
          </div>
        </>
      )}

      {/* ===== CONFIGURATION ===== */}
      {tab === 'config' && (
        <form onSubmit={handleSaveConfig} className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Business Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Business Name</label>
                <input className="input" value={config.business_name || ''} onChange={(e) => updateConfig('business_name', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Business Address</label>
                <input className="input" value={config.business_address || ''} onChange={(e) => updateConfig('business_address', e.target.value)} />
              </div>
              <div>
                <label className="label">TIN</label>
                <input className="input" value={config.tin || ''} onChange={(e) => updateConfig('tin', e.target.value)} placeholder="e.g. 123456789" />
              </div>
              <div>
                <label className="label">VRN</label>
                <input className="input" value={config.vrn || ''} onChange={(e) => updateConfig('vrn', e.target.value)} />
              </div>
              <div>
                <label className="label">Tax Office</label>
                <input className="input" value={config.tax_office || ''} onChange={(e) => updateConfig('tax_office', e.target.value)} />
              </div>
              <div>
                <label className="label">Tax Region</label>
                <input className="input" value={config.tax_region || ''} onChange={(e) => updateConfig('tax_region', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">VFD Device &amp; Credentials</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">EFD Serial (EFDSERIAL)</label>
                <input className="input" value={config.efd_serial || ''} onChange={(e) => updateConfig('efd_serial', e.target.value)} placeholder="e.g. 10TZ..." />
              </div>
              <div>
                <label className="label">CERTKEY</label>
                <input className="input" value={config.certkey || ''} onChange={(e) => updateConfig('certkey', e.target.value)} />
              </div>
              <div>
                <label className="label">REGID</label>
                <input className="input" value={config.regid || ''} onChange={(e) => updateConfig('regid', e.target.value)} />
              </div>
              <div>
                <label className="label">UIN</label>
                <input className="input" value={config.uin || ''} onChange={(e) => updateConfig('uin', e.target.value)} />
              </div>
              <div>
                <label className="label">Receipt Code (RECEIPTCODE)</label>
                <input className="input" value={config.receipt_code || ''} onChange={(e) => updateConfig('receipt_code', e.target.value)} placeholder="e.g. AAAA11" />
              </div>
              <div>
                <label className="label">Cert-Serial</label>
                <input className="input" value={config.cert_serial || ''} onChange={(e) => updateConfig('cert_serial', e.target.value)} />
              </div>
              <div>
                <label className="label">API Username</label>
                <input className="input" value={config.api_username || ''} onChange={(e) => updateConfig('api_username', e.target.value)} />
              </div>
              <div>
                <label className="label">API Password</label>
                <input className="input" type="password" value={config.api_password || ''} onChange={(e) => updateConfig('api_password', e.target.value)} placeholder={config.api_password && config.api_password.startsWith('••') ? '••••••••••••' : ''} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Certificate Private Key (PEM / base64)</label>
                <textarea className="input min-h-[90px] font-mono text-xs" value={config.cert_private_key || ''} onChange={(e) => updateConfig('cert_private_key', e.target.value)} placeholder={config.cert_private_key && config.cert_private_key.startsWith('••') ? '••••••••••••' : '-----BEGIN PRIVATE KEY-----...'} />
                <p className="mt-1 text-xs text-surface-400">TRA certificate (.pfx) converted to PEM private key. Kept server-side only.</p>
              </div>
            </div>
          </div>

          <div className="card lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Receipt Settings</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="label">Environment</label>
                <select className="input" value={config.environment || 'test'} onChange={(e) => updateConfig('environment', e.target.value)}>
                  <option value="test">Test (virtual.tra.go.tz)</option>
                  <option value="production">Production (vfd.tra.go.tz)</option>
                </select>
              </div>
              <div>
                <label className="label">Receipt Prefix</label>
                <input className="input" value={config.receipt_prefix || 'RCT'} onChange={(e) => updateConfig('receipt_prefix', e.target.value)} />
              </div>
              <div>
                <label className="label">Default VAT Rate (%)</label>
                <input className="input" type="number" step="0.01" value={config.default_tax_rate ?? 18} onChange={(e) => updateConfig('default_tax_rate', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input" value={config.currency || 'TZS'} onChange={(e) => updateConfig('currency', e.target.value)}>
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Routing Key</label>
                <input className="input" value={config.routing_key || 'vfdrct'} onChange={(e) => updateConfig('routing_key', e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={config.auto_submit !== false} onChange={(e) => updateConfig('auto_submit', e.target.checked)} />
                Auto-submit receipts to TRA
              </label>
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end gap-2">
            <button type="submit" className="btn-primary">
              <Save size={16} className="mr-1" /> Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* ===== GENERATE RECEIPT ===== */}
      {tab === 'generate' && (
        <form onSubmit={handleGenerate} className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Source</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Generate from invoice</label>
                <select className="input" value={genForm.invoice_id} onChange={(e) => setGenForm((p: any) => ({ ...p, invoice_id: e.target.value }))}>
                  <option value="">-- Manual entry --</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.customer?.company_name || 'No customer'} ({formatCurrency(inv.total_amount)})
                    </option>
                  ))}
                </select>
              </div>

              {!genForm.invoice_id && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className="label">Customer Name</label>
                      <input className="input" value={genCustomer.name} onChange={(e) => setGenCustomer({ ...genCustomer, name: e.target.value })} placeholder="Walk-in Customer" />
                    </div>
                    <div>
                      <label className="label">Customer TIN</label>
                      <input className="input" value={genCustomer.tin} onChange={(e) => setGenCustomer({ ...genCustomer, tin: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Mobile</label>
                      <input className="input" value={genCustomer.mobile} onChange={(e) => setGenCustomer({ ...genCustomer, mobile: e.target.value })} placeholder="255712000000" />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="label mb-0">Line Items</label>
                      <button type="button" onClick={() => setGenItems([...genItems, { description: '', quantity: 1, unit_price: 0, tax_rate: 18 }])} className="btn-secondary !px-2 !py-1 text-xs">
                        <Plus size={12} className="mr-1" /> Add Item
                      </button>
                    </div>
                    {genItems.map((item, idx) => (
                      <div key={idx} className="mb-2 grid grid-cols-12 gap-2">
                        <input className="input col-span-4" placeholder="Description" value={item.description} onChange={(e) => { const items = [...genItems]; items[idx] = { ...items[idx], description: e.target.value }; setGenItems(items); }} />
                        <input className="input col-span-2" type="number" min={1} placeholder="Qty" value={item.quantity} onChange={(e) => { const items = [...genItems]; items[idx] = { ...items[idx], quantity: Number(e.target.value) }; setGenItems(items); }} />
                        <input className="input col-span-3" type="number" min={0} placeholder="Price" value={item.unit_price} onChange={(e) => { const items = [...genItems]; items[idx] = { ...items[idx], unit_price: Number(e.target.value) }; setGenItems(items); }} />
                        <input className="input col-span-2" type="number" placeholder="VAT %" value={item.tax_rate} onChange={(e) => { const items = [...genItems]; items[idx] = { ...items[idx], tax_rate: Number(e.target.value) }; setGenItems(items); }} />
                        <button type="button" onClick={() => setGenItems(genItems.filter((_, i) => i !== idx))} className="col-span-1 text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Payment &amp; Submit</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Payment Method</label>
                <select className="input" value={genForm.payment_method} onChange={(e) => setGenForm((p: any) => ({ ...p, payment_method: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money (EMONEY)</option>
                  <option value="bank_transfer">Bank Transfer (INVOICE)</option>
                  <option value="card">Card (CCARD)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="rounded-xl bg-surface-50 p-4 text-sm text-surface-500 dark:bg-surface-800">
                <p>When the receipt is generated the backend will:</p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>Calculate subtotal, VAT and total</li>
                  <li>Assign receipt / daily counter (DC) / global counter (GC)</li>
                  <li>Submit to the TRA EFD receipt API automatically (if configured)</li>
                  <li>Save the TRA acknowledgement for verification</li>
                </ol>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? 'Generating...' : 'Generate Fiscal Receipt'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===== RECEIPTS ===== */}
      {tab === 'receipts' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9" placeholder="Search receipts..." value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)} />
            </div>
            <select className="input w-auto min-w-[130px]" value={receiptStatusFilter} onChange={(e) => setReceiptStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {Object.keys(statusColors).map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date / Time</th>
                  <th>Customer</th>
                  <th>RCTVNUM</th>
                  <th>GC</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-surface-400">No fiscal receipts found</td></tr>
                ) : receipts.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => openReceipt(r.id)}>
                    <td className="font-mono text-xs">{r.receipt_number}</td>
                    <td className="text-xs">{formatDateTime(r.created_at)}</td>
                    <td className="font-medium">{r.customer_name || '-'}</td>
                    <td className="font-mono text-xs">{r.rctvnum || '-'}</td>
                    <td className="font-mono text-xs">{r.gc ?? '-'}</td>
                    <td className="font-medium">{formatCurrency(r.total_amount)}</td>
                    <td><span className={statusColors[r.status] || 'badge-info'}>{getStatusLabel(r.status)}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {(r.status === 'pending' || r.status === 'failed' || r.status === 'rejected') && (
                          <button title="Submit to TRA" onClick={() => handleSubmitReceipt(r.id)} disabled={actionBusy === `submit-${r.id}`} className="rounded-lg p-1.5 text-accent-600 hover:bg-accent-50 dark:hover:bg-surface-700">
                            <ShieldCheck size={15} />
                          </button>
                        )}
                        {r.status !== 'voided' && (
                          <button title="Void" onClick={() => handleVoidReceipt(r.id)} disabled={!!actionBusy} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-surface-700">
                            <Ban size={15} />
                          </button>
                        )}
                        <button title="View" onClick={() => openReceipt(r.id)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700">
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== TAX RATES ===== */}
      {tab === 'tax_rates' && (
        <TaxRatesSection rates={taxRates} />
      )}

      {/* ===== LOGS ===== */}
      {tab === 'logs' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className="input w-auto min-w-[140px]" value={logAction} onChange={(e) => setLogAction(e.target.value)}>
              <option value="">All Actions</option>
              {['register', 'token', 'receipt', 'zreport', 'test'].map((a) => <option key={a} value={a}>{getStatusLabel(a)}</option>)}
            </select>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>ACK Code</th>
                  <th>Message</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-surface-400">No API logs yet</td></tr>
                ) : logs.map((l) => (
                  <tr key={l.id}>
                    <td className="text-xs">{formatDateTime(l.created_at)}</td>
                    <td><span className="badge badge-info">{l.action}</span></td>
                    <td className="max-w-[200px] truncate font-mono text-xs">{l.endpoint || '-'}</td>
                    <td><span className={l.status === 'success' ? 'badge-success' : 'badge-danger'}>{l.status || '-'}</span></td>
                    <td className="font-mono text-xs">{l.ack_code ?? '-'}</td>
                    <td className="max-w-[220px] truncate text-xs">{l.ack_message || l.error_message || '-'}</td>
                    <td className="text-xs">{l.duration_ms != null ? `${l.duration_ms}ms` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== RECEIPT DETAIL SIDE PANEL ===== */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedReceipt(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl dark:bg-surface-800" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-surface-50">Fiscal Receipt</h3>
                <p className="font-mono text-sm text-surface-500">{selectedReceipt.receipt_number}</p>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Status</span>
                <span className={statusColors[selectedReceipt.status] || 'badge-info'}>{getStatusLabel(selectedReceipt.status)}</span>
              </div>
              {selectedReceipt.ack_message && (
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">TRA ACK</span>
                  <span className="text-xs">{selectedReceipt.ack_code} - {selectedReceipt.ack_message}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Verification Code (RCTVNUM)</span>
                <span className="font-mono text-xs">{selectedReceipt.rctvnum || '-'}</span>
              </div>
              {selectedReceipt.verification_url && (
                <a href={selectedReceipt.verification_url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-accent-600 hover:underline">
                  <span className="text-surface-500">Verify on TRA</span>
                  <span className="flex items-center gap-1 text-xs"><ExternalLink size={13} /> Open</span>
                </a>
              )}
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Date / Time</span>
                <span className="text-xs">{selectedReceipt.receipt_date} {selectedReceipt.receipt_time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Customer</span>
                <span className="text-xs">{selectedReceipt.customer_name || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Customer TIN</span>
                <span className="font-mono text-xs">{selectedReceipt.customer_tin || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">TIN / VRN</span>
                <span className="font-mono text-xs">{selectedReceipt.tin} / {selectedReceipt.vrn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">EFD Serial</span>
                <span className="font-mono text-xs">{selectedReceipt.efd_serial || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">REGID / UIN</span>
                <span className="max-w-[200px] truncate font-mono text-xs">{selectedReceipt.regid || '-'} / {selectedReceipt.uin || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-500">Counters DC / GC / ZNUM</span>
                <span className="font-mono text-xs">{selectedReceipt.dc ?? '-'} / {selectedReceipt.gc ?? '-'} / {selectedReceipt.znum || '-'}</span>
              </div>
            </div>

            {selectedReceipt.items && selectedReceipt.items.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-200">Items</h4>
                <div className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
                  <table className="table">
                    <thead>
                      <tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.items.map((it: any) => (
                        <tr key={it.id}>
                          <td className="text-xs">{it.description}</td>
                          <td className="text-xs">{it.quantity}</td>
                          <td className="text-xs">{formatCurrency(it.unit_price)}</td>
                          <td className="text-xs">{formatCurrency(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2 border-t border-surface-200 pt-4 text-sm dark:border-surface-700">
              <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(selectedReceipt.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">VAT</span><span>{formatCurrency(selectedReceipt.tax_amount)}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Discount</span><span>{formatCurrency(selectedReceipt.discount)}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selectedReceipt.total_amount)}</span></div>
            </div>

            <div className="mt-6 flex gap-2">
              {(selectedReceipt.status === 'pending' || selectedReceipt.status === 'failed' || selectedReceipt.status === 'rejected') && (
                <button onClick={() => handleSubmitReceipt(selectedReceipt.id)} className="btn-primary flex-1">
                  <ShieldCheck size={16} className="mr-1" /> Submit to TRA
                </button>
              )}
              {selectedReceipt.status !== 'voided' && (
                <button onClick={() => handleVoidReceipt(selectedReceipt.id)} className="btn-secondary flex-1 text-red-600">
                  <Ban size={16} className="mr-1" /> Void
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxRatesSection({ rates }: { rates: any[] }) {
  const [localRates, setLocalRates] = useState<any[]>(rates);
  const [newRate, setNewRate] = useState({ code: '', name: '', rate: 0, tra_tax_code: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => setLocalRates(rates), [rates]);

  const saveRate = async (r: any, field: string, value: any) => {
    try {
      await dataService.updateVfdTaxRate(r.id, { [field]: value });
      setLocalRates((prev) => prev.map((x) => (x.id === r.id ? { ...x, [field]: value } : x)));
      toast.success('Tax rate updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to update tax rate');
    }
  };

  const addRate = async () => {
    if (!newRate.code || !newRate.name) { toast.error('Code and name are required'); return; }
    setSaving(true);
    try {
      await dataService.createVfdTaxRate(newRate);
      toast.success('Tax rate added');
      setNewRate({ code: '', name: '', rate: 0, tra_tax_code: 1 });
      const { data } = await dataService.getVfdTaxRates();
      setLocalRates(data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add tax rate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="card mb-6">
        <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">TRA VAT Rate Codes</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Rate %</th><th>TRA Tax Code</th></tr>
            </thead>
            <tbody>
              {localRates.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-surface-400">No tax rates configured</td></tr>
              ) : localRates.map((r) => (
                <tr key={r.id}>
                  <td><input className="input !w-16 text-center font-mono" value={r.code} onChange={(e) => saveRate(r, 'code', e.target.value.toUpperCase())} /></td>
                  <td><input className="input" value={r.name} onChange={(e) => saveRate(r, 'name', e.target.value)} /></td>
                  <td><input className="input !w-24" type="number" step="0.01" value={r.rate} onChange={(e) => saveRate(r, 'rate', Number(e.target.value))} /></td>
                  <td>
                    <select className="input !w-32" value={r.tra_tax_code} onChange={(e) => saveRate(r, 'tra_tax_code', Number(e.target.value))}>
                      <option value={1}>1 - Standard</option>
                      <option value={2}>2 - Special Rate</option>
                      <option value={3}>3 - Zero Rated</option>
                      <option value={4}>4 - Special Relief</option>
                      <option value={5}>5 - Exempt</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">Add Tax Rate</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input className="input" placeholder="Code (A)" value={newRate.code} onChange={(e) => setNewRate({ ...newRate, code: e.target.value.toUpperCase() })} />
          <input className="input sm:col-span-2" placeholder="Name" value={newRate.name} onChange={(e) => setNewRate({ ...newRate, name: e.target.value })} />
          <input className="input" type="number" step="0.01" placeholder="Rate %" value={newRate.rate} onChange={(e) => setNewRate({ ...newRate, rate: Number(e.target.value) })} />
          <select className="input" value={newRate.tra_tax_code} onChange={(e) => setNewRate({ ...newRate, tra_tax_code: Number(e.target.value) })}>
            <option value={1}>1 - Standard</option>
            <option value={2}>2 - Special Rate</option>
            <option value={3}>3 - Zero Rated</option>
            <option value={4}>4 - Special Relief</option>
            <option value={5}>5 - Exempt</option>
          </select>
        </div>
        <button onClick={addRate} disabled={saving} className="btn-primary mt-4">
          <Plus size={16} className="mr-1" /> Add Tax Rate
        </button>
      </div>
    </div>
  );
}
