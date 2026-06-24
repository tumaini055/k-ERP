import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { CompanySettings } from '../types';
import { Save, Building2, Receipt, Settings2, Globe, RefreshCw } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await dataService.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof CompanySettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

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
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage system configuration and preferences</p>
        </div>
      </div>

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
    </div>
  );
}
