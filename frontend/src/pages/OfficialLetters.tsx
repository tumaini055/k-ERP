import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Customer } from '../types';
import { FileText, RefreshCw, UserCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

type RecipientMode = 'crm' | 'manual';

export default function OfficialLetters() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mode, setMode] = useState<RecipientMode>('crm');

  // CRM customer
  const [customerId, setCustomerId] = useState('');

  // Manual recipient
  const [manual, setManual] = useState({
    company_name: '',
    contact_person: '',
    address: '',
    city: '',
    region: '',
  });

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    dataService.getCustomers({ limit: 500 }).then(r => setCustomers(r.data)).catch(() => {});
  }, []);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const canGenerate = content.trim() && (mode === 'crm' ? customerId : manual.company_name || manual.contact_person);

  const handleGenerate = async () => {
    if (!content.trim()) { toast.error('Please enter letter content'); return; }
    if (mode === 'crm' && !customerId) { toast.error('Please select a customer'); return; }
    if (mode === 'manual' && !manual.company_name && !manual.contact_person) {
      toast.error('Please enter at least company name or contact person'); return;
    }

    setGenerating(true);
    try {
      const body: any = {
        subject: subject.trim() || undefined,
        content: content.trim(),
        reference_number: referenceNumber.trim() || undefined,
      };
      if (mode === 'crm') {
        body.customer_id = customerId;
      } else {
        body.recipient = {
          company_name: manual.company_name.trim() || undefined,
          contact_person: manual.contact_person.trim() || undefined,
          address: manual.address.trim() || undefined,
          city: manual.city.trim() || undefined,
          region: manual.region.trim() || undefined,
        };
      }
      await dataService.generateOfficialLetter(body);
      toast.success('Letter generated successfully');
    } catch (err) {
      toast.error('Failed to generate letter');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setContent(''); setSubject(''); setReferenceNumber('');
    setCustomerId(''); setManual({ company_name: '', contact_person: '', address: '', city: '', region: '' });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Official Letters</h1>
          <p className="page-subtitle">Generate official letters to customers with company letterhead</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4 lg:col-span-1">
          {/* Mode toggle */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-surface-800 dark:text-surface-200">Recipient</h2>
            <div className="mb-4 flex rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
              <button
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  mode === 'crm' ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-100' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400'
                }`}
                onClick={() => setMode('crm')}
              >
                <UserCheck size={14} /> CRM Customer
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                  mode === 'manual' ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-100' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400'
                }`}
                onClick={() => setMode('manual')}
              >
                <UserPlus size={14} /> Manual Entry
              </button>
            </div>

            {mode === 'crm' ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Customer *</label>
                  <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name || c.contact_person || c.email}</option>
                    ))}
                  </select>
                </div>
                {selectedCustomer && (
                  <div className="rounded-lg bg-surface-50 p-3 text-xs text-surface-600 dark:bg-surface-800/50 dark:text-surface-400">
                    {selectedCustomer.company_name && <p><span className="font-medium">Company:</span> {selectedCustomer.company_name}</p>}
                    {selectedCustomer.contact_person && <p><span className="font-medium">Attn:</span> {selectedCustomer.contact_person}</p>}
                    {selectedCustomer.email && <p><span className="font-medium">Email:</span> {selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p><span className="font-medium">Phone:</span> {selectedCustomer.phone}</p>}
                    {selectedCustomer.address && <p><span className="font-medium">Address:</span> {selectedCustomer.address}</p>}
                    {selectedCustomer.city && <p><span className="font-medium">City:</span> {selectedCustomer.city}</p>}
                    {selectedCustomer.region && <p><span className="font-medium">Region:</span> {selectedCustomer.region}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Company Name *</label>
                  <input className="input" placeholder="Company name" value={manual.company_name} onChange={e => setManual({ ...manual, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Contact Person</label>
                  <input className="input" placeholder="Attn: contact person" value={manual.contact_person} onChange={e => setManual({ ...manual, contact_person: e.target.value })} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" placeholder="Street, building, PO Box" value={manual.address} onChange={e => setManual({ ...manual, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">City</label>
                    <input className="input" placeholder="City" value={manual.city} onChange={e => setManual({ ...manual, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Region</label>
                    <input className="input" placeholder="Region" value={manual.region} onChange={e => setManual({ ...manual, region: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-surface-800 dark:text-surface-200">Document Info</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Reference Number</label>
                <input className="input" placeholder="e.g. LET-2024-001 (auto if empty)" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input" placeholder="Letter subject line..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Right - Letter Content */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Letter Content *</h2>
              <div className="text-xs text-surface-400">{content.length} characters</div>
            </div>
            <textarea
              className="input min-h-[400px] w-full resize-y font-mono text-sm leading-relaxed"
              placeholder="Type your letter content here...

The letter will be formatted with:
- Company letterhead & logo
- Reference number & date
- Customer address block
- Subject line
- Salutation
- Body content
- Formal closing"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button className="btn-secondary" onClick={handleReset}>
              <RefreshCw size={16} /> Reset
            </button>
            <button className="btn-primary" onClick={handleGenerate} disabled={generating || !canGenerate}>
              {generating ? <>Generating...</> : <><FileText size={16} /> Generate Letter</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
