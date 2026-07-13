import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { CompanySettings } from '../types';
import { Save, Building2, Receipt, Globe, RefreshCw, Plus, Pencil, Trash2, X, Check, Upload, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'company' | 'departments' | 'positions';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('company');
  const [settings, setSettings] = useState<CompanySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editDeptForm, setEditDeptForm] = useState({ name: '', code: '', description: '' });

  const [newPos, setNewPos] = useState({ name: '', department_id: '', description: '' });
  const [editingPos, setEditingPos] = useState<string | null>(null);
  const [editPosForm, setEditPosForm] = useState({ name: '', department_id: '', description: '' });

  useEffect(() => {
    fetchSettings();
    fetchDepartments();
    fetchPositions();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await dataService.getSettings();
      setSettings(data?.settings || {});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await dataService.getDepartments();
      setDepartments(data || []);
    } catch (error) { console.error(error); }
  };

  const fetchPositions = async () => {
    try {
      const { data } = await dataService.getPositions();
      setPositions(data || []);
    } catch (error) { console.error(error); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await dataService.updateSettings(settings);
      if (!res?.data?.settings) {
        toast.error('Save failed — your account may have no company assigned');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        toast.success('Settings saved');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof CompanySettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Department handlers
  const handleAddDept = async () => {
    if (!newDept.name) return;
    try {
      await dataService.createDepartment(newDept);
      setNewDept({ name: '', code: '', description: '' });
      toast.success('Department added');
      fetchDepartments();
    } catch (error) { toast.error('Failed to add department'); }
  };

  const handleEditDept = async (id: string) => {
    try {
      await dataService.updateDepartment(id, editDeptForm);
      setEditingDept(null);
      toast.success('Department updated');
      fetchDepartments();
    } catch (error) { toast.error('Failed to update department'); }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await dataService.deleteDepartment(id);
      toast.success('Department deleted');
      fetchDepartments();
    } catch (error) { toast.error('Failed to delete department'); }
  };

  // Position handlers
  const handleAddPos = async () => {
    if (!newPos.name) return;
    try {
      await dataService.createPosition(newPos);
      setNewPos({ name: '', department_id: '', description: '' });
      toast.success('Position added');
      fetchPositions();
    } catch (error) { toast.error('Failed to add position'); }
  };

  const handleEditPos = async (id: string) => {
    try {
      await dataService.updatePosition(id, editPosForm);
      setEditingPos(null);
      toast.success('Position updated');
      fetchPositions();
    } catch (error) { toast.error('Failed to update position'); }
  };

  const handleDeletePos = async (id: string) => {
    if (!confirm('Delete this position?')) return;
    try {
      await dataService.deletePosition(id);
      toast.success('Position deleted');
      fetchPositions();
    } catch (error) { toast.error('Failed to delete position'); }
  };

  if (loading && tab === 'company') {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-surface-400" />
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'company', label: 'Company Info' },
    { key: 'departments', label: 'Departments' },
    { key: 'positions', label: 'Positions' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage system configuration, departments, and positions</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-surface-100 p-1 w-fit dark:bg-surface-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-50'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
          {saved && (
            <div className="rounded-lg bg-accent-50 px-4 py-3 text-sm text-accent-700 border border-accent-200">
              Settings saved successfully.
            </div>
          )}

          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <Building2 size={20} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Company Information</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Company Logo</label>
                <div className="flex items-center gap-4">
                  {settings.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-20 w-20 rounded-lg border border-surface-200 object-contain dark:border-surface-700" />
                  )}
                  <div className="flex-1">
                    <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm">
                      <Upload size={16} /> Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const formData = new FormData();
                          formData.append('logo', file);
                          try {
                            const token = localStorage.getItem('token');
                            const res = await fetch('/api/settings/upload-logo', {
                              method: 'POST',
                              headers: token ? { Authorization: `Bearer ${token}` } : {},
                              body: formData,
                            });
                            const json = await res.json();
                            if (json.url) {
                              update('logo_url', json.url);
                              toast.success('Logo uploaded');
                            } else {
                              toast.error('Upload failed');
                            }
                          } catch {
                            toast.error('Upload failed');
                          }
                        }}
                      />
                    </label>
                    {settings.logo_url && (
                      <button
                        onClick={() => update('logo_url', '')}
                        className="ml-2 text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Company Name</label>
                <input className="input" value={settings.company_name || ''} onChange={(e) => update('company_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Tax / VAT ID</label>
                <input className="input" value={settings.tax_id || ''} onChange={(e) => update('tax_id', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={settings.company_email || ''} onChange={(e) => update('company_email', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={settings.company_phone || ''} onChange={(e) => update('company_phone', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={settings.company_address || ''} onChange={(e) => update('company_address', e.target.value)} />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" value={settings.company_website || ''} onChange={(e) => update('company_website', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <Receipt size={20} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Invoice Settings</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Invoice Number Prefix</label>
                <input className="input" value={settings.invoice_prefix || ''} onChange={(e) => update('invoice_prefix', e.target.value)} placeholder="e.g. INV-" />
              </div>
              <div>
                <label className="label">Default Tax Rate (%)</label>
                <input type="number" min="0" max="100" step="0.01" className="input" value={settings.default_tax_rate || ''} onChange={(e) => update('default_tax_rate', Number(e.target.value))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Default Invoice Terms</label>
                <textarea className="input" rows={2} value={settings.invoice_terms || ''} onChange={(e) => update('invoice_terms', e.target.value)} placeholder="e.g. Payment due within 30 days" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <Landmark size={20} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Bank Details</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={settings.bank_name || ''} onChange={(e) => update('bank_name', e.target.value)} placeholder="e.g. NMB Bank" />
              </div>
              <div>
                <label className="label">Account Name</label>
                <input className="input" value={settings.bank_account_name || ''} onChange={(e) => update('bank_account_name', e.target.value)} placeholder="e.g. K-Connect Technologies Ltd" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input className="input" value={settings.bank_account_number || ''} onChange={(e) => update('bank_account_number', e.target.value)} placeholder="e.g. 1234567890" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <Globe size={20} className="text-primary-600" />
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Regional Settings</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={settings.currency || 'TZS'} onChange={(e) => update('currency', e.target.value)}>
                  <option value="TZS">TZS (Tanzanian Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="UGX">UGX (Ugandan Shilling)</option>
                </select>
              </div>
              <div>
                <label className="label">Date Format</label>
                <select className="input" value={settings.date_format || 'DD/MM/YYYY'} onChange={(e) => update('date_format', e.target.value)}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="label">Timezone</label>
                <select className="input" value={settings.timezone || 'Africa/Dar_es_Salaam'} onChange={(e) => update('timezone', e.target.value)}>
                  <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (EAT)</option>
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="Africa/Kampala">Africa/Kampala (EAT)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                </select>
              </div>
              <div>
                <label className="label">Default Language</label>
                <select className="input" value={settings.language || 'en'} onChange={(e) => update('language', e.target.value)}>
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <button type="submit" disabled={saving} className="btn-primary">
              <Save size={18} className="mr-1.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {tab === 'departments' && (
        <div className="max-w-2xl space-y-4">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Departments</h2>
            </div>

            <div className="mb-4 flex gap-2">
              <input className="input flex-1" placeholder="Department name" value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} />
              <input className="input w-24" placeholder="Code" value={newDept.code} onChange={e => setNewDept({...newDept, code: e.target.value})} />
              <button onClick={handleAddDept} disabled={!newDept.name} className="btn-primary shrink-0">
                <Plus size={16} className="mr-1" /> Add
              </button>
            </div>

            {departments.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-6">No departments yet</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept: any) => (
                  <div key={dept.id} className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                    {editingDept === dept.id ? (
                      <>
                        <input className="input flex-1 text-sm" value={editDeptForm.name} onChange={e => setEditDeptForm({...editDeptForm, name: e.target.value})} />
                        <input className="input w-20 text-sm" placeholder="Code" value={editDeptForm.code} onChange={e => setEditDeptForm({...editDeptForm, code: e.target.value})} />
                        <button onClick={() => handleEditDept(dept.id)} className="btn-primary text-xs py-1 px-2"><Check size={14} /></button>
                        <button onClick={() => setEditingDept(null)} className="btn-secondary text-xs py-1 px-2"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{dept.name}</p>
                          {dept.code && <p className="text-xs text-surface-400">{dept.code}</p>}
                        </div>
                        <button onClick={() => { setEditingDept(dept.id); setEditDeptForm({ name: dept.name, code: dept.code || '', description: dept.description || '' }); }} className="btn-secondary text-xs py-1 px-2"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteDept(dept.id)} className="btn-secondary text-xs py-1 px-2 text-red-600"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'positions' && (
        <div className="max-w-2xl space-y-4">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50">Positions</h2>
            </div>

            <div className="mb-4 flex gap-2">
              <input className="input flex-1" placeholder="Position name" value={newPos.name} onChange={e => setNewPos({...newPos, name: e.target.value})} />
              <select className="input w-40" value={newPos.department_id} onChange={e => setNewPos({...newPos, department_id: e.target.value})}>
                <option value="">No department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button onClick={handleAddPos} disabled={!newPos.name} className="btn-primary shrink-0">
                <Plus size={16} className="mr-1" /> Add
              </button>
            </div>

            {positions.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-6">No positions yet</p>
            ) : (
              <div className="space-y-2">
                {positions.map((pos: any) => (
                  <div key={pos.id} className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                    {editingPos === pos.id ? (
                      <>
                        <input className="input flex-1 text-sm" value={editPosForm.name} onChange={e => setEditPosForm({...editPosForm, name: e.target.value})} />
                        <select className="input w-36 text-sm" value={editPosForm.department_id} onChange={e => setEditPosForm({...editPosForm, department_id: e.target.value})}>
                          <option value="">No department</option>
                          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button onClick={() => handleEditPos(pos.id)} className="btn-primary text-xs py-1 px-2"><Check size={14} /></button>
                        <button onClick={() => setEditingPos(null)} className="btn-secondary text-xs py-1 px-2"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{pos.name}</p>
                          {pos.department && <p className="text-xs text-surface-400">{pos.department.name}</p>}
                        </div>
                        <button onClick={() => { setEditingPos(pos.id); setEditPosForm({ name: pos.name, department_id: pos.department_id || '', description: pos.description || '' }); }} className="btn-secondary text-xs py-1 px-2"><Pencil size={14} /></button>
                        <button onClick={() => handleDeletePos(pos.id)} className="btn-secondary text-xs py-1 px-2 text-red-600"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
