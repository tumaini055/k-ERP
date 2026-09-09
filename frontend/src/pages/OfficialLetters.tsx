import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Customer } from '../types';
import {
  FileText, RefreshCw, UserCheck, UserPlus, Presentation, FileCode2, Plus, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

type RecipientMode = 'crm' | 'manual';
type Tab = 'letter' | 'presentation';

interface SlideDraft {
  id: number;
  title: string;
  content: string;
}

const TEMPLATE_SLIDES: Omit<SlideDraft, 'id'>[] = [
  { title: 'About Us', content: 'We are a professional technology company committed to delivering reliable, innovative and affordable solutions to our valued clients across the region.' },
  { title: 'Our Mission', content: 'To deliver high-quality technology solutions and services that help our customers achieve their goals efficiently, securely and reliably.' },
  { title: 'Our Vision', content: 'To be the preferred technology partner in the region, recognised for excellence, integrity and long-term partnerships.' },
  { title: 'Our Services', content: '- IT Infrastructure and Networking\n- Software Development\n- Internet and Connectivity Solutions\n- CCTV and Security Systems\n- Maintenance and Technical Support' },
  { title: 'Why Choose Us', content: '- Experienced and professional team\n- Reliable and responsive support\n- Competitive pricing\n- Tailored solutions for every client\n- Commitment to long-term partnerships' },
];

let nextSlideId = 1;
const makeSlides = () => TEMPLATE_SLIDES.map((s) => ({ ...s, id: nextSlideId++ }));

export default function OfficialLetters() {
  const [tab, setTab] = useState<Tab>('letter');

  // Letter state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mode, setMode] = useState<RecipientMode>('crm');
  const [customerId, setCustomerId] = useState('');
  const [manual, setManual] = useState({ company_name: '', contact_person: '', address: '', city: '', region: '' });
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [generating, setGenerating] = useState(false);

  // Presentation state
  const [slides, setSlides] = useState<SlideDraft[]>(makeSlides);
  const [pres, setPres] = useState({
    title: '',
    tagline: '',
    company_name: '',
    company_email: '',
    company_phone: '',
    company_website: '',
    company_address: '',
  });
  const [presBusy, setPresBusy] = useState<'pdf' | 'pptx' | null>(null);

  useEffect(() => {
    dataService.getCustomers({ limit: 500 }).then((r) => setCustomers(r.data)).catch(() => {});
    dataService.getSettings()
      .then((r: any) => {
        const s = r?.data?.settings || {};
        setPres((p) => ({
          ...p,
          company_name: s.company_name || '',
          company_email: s.company_email || '',
          company_phone: s.company_phone || '',
          company_website: s.company_website || '',
          company_address: s.company_address || '',
        }));
      })
      .catch(() => {});
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId);
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

  // Presentation helpers
  const updateSlide = (id: number, patch: Partial<SlideDraft>) =>
    setSlides((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSlide = () => setSlides((arr) => [...arr, { id: nextSlideId++, title: '', content: '' }]);

  const removeSlide = (id: number) => setSlides((arr) => arr.filter((s) => s.id !== id));

  const moveSlide = (id: number, dir: -1 | 1) => {
    setSlides((arr) => {
      const idx = arr.findIndex((s) => s.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= arr.length) return arr;
      const next = [...arr];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const buildPresBody = () => ({
    title: pres.title.trim() || undefined,
    tagline: pres.tagline.trim() || undefined,
    company_name: pres.company_name.trim() || undefined,
    company_email: pres.company_email.trim() || undefined,
    company_phone: pres.company_phone.trim() || undefined,
    company_website: pres.company_website.trim() || undefined,
    company_address: pres.company_address.trim() || undefined,
    slides: slides.map((s) => ({ title: s.title.trim() || 'Untitled Section', content: s.content })),
  });

  const handleGeneratePres = async (format: 'pdf' | 'pptx') => {
    if (slides.length === 0) { toast.error('Add at least one slide'); return; }
    setPresBusy(format);
    try {
      await dataService.generatePresentation(buildPresBody(), format);
      toast.success(format === 'pdf' ? 'PDF presentation generated' : 'PowerPoint presentation generated');
    } catch {
      toast.error(format === 'pdf' ? 'Failed to generate PDF presentation' : 'Failed to generate PowerPoint presentation');
    } finally {
      setPresBusy(null);
    }
  };

  const setPresField = (key: keyof typeof pres, value: string) => setPres((p) => ({ ...p, [key]: value }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{tab === 'letter' ? 'Official Letters' : 'Company Presentations'}</h1>
          <p className="page-subtitle">
            {tab === 'letter'
              ? 'Generate official letters to customers with company letterhead'
              : 'Create professional PDF and PowerPoint presentations from company data'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-full max-w-md rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
            tab === 'letter' ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-100' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400'
          }`}
          onClick={() => setTab('letter')}
        >
          <FileText size={14} /> Official Letter
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
            tab === 'presentation' ? 'bg-white text-surface-900 shadow-sm dark:bg-surface-700 dark:text-surface-100' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400'
          }`}
          onClick={() => setTab('presentation')}
        >
          <Presentation size={14} /> Company Presentation
        </button>
      </div>

      {tab === 'letter' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left sidebar */}
          <div className="space-y-4 lg:col-span-1">
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
                    <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Select customer...</option>
                      {customers.map((c) => (
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
                    <input className="input" placeholder="Company name" value={manual.company_name} onChange={(e) => setManual({ ...manual, company_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Contact Person</label>
                    <input className="input" placeholder="Attn: contact person" value={manual.contact_person} onChange={(e) => setManual({ ...manual, contact_person: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Address</label>
                    <input className="input" placeholder="Street, building, PO Box" value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">City</label>
                      <input className="input" placeholder="City" value={manual.city} onChange={(e) => setManual({ ...manual, city: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Region</label>
                      <input className="input" placeholder="Region" value={manual.region} onChange={(e) => setManual({ ...manual, region: e.target.value })} />
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
                  <input className="input" placeholder="e.g. LET-2024-001 (auto if empty)" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                </div>
                <div>
                  <label className="label">Subject</label>
                  <input className="input" placeholder="Letter subject line..." value={subject} onChange={(e) => setSubject(e.target.value)} />
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
                onChange={(e) => setContent(e.target.value)}
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
      )}

      {tab === 'presentation' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left - Company + meta */}
          <div className="space-y-4 lg:col-span-1">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-surface-800 dark:text-surface-200">Company Information</h2>
              <p className="mb-3 text-xs text-surface-400">Prefilled from Settings — override for this presentation.</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Company Name</label>
                  <input className="input" placeholder="Company name" value={pres.company_name} onChange={(e) => setPresField('company_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" placeholder="info@company.co.tz" value={pres.company_email} onChange={(e) => setPresField('company_email', e.target.value)} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="+255 ..." value={pres.company_phone} onChange={(e) => setPresField('company_phone', e.target.value)} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input" placeholder="www.company.co.tz" value={pres.company_website} onChange={(e) => setPresField('company_website', e.target.value)} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" placeholder="City / address" value={pres.company_address} onChange={(e) => setPresField('company_address', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-surface-800 dark:text-surface-200">Presentation Info</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Presentation Title</label>
                  <input className="input" placeholder="e.g. Company Profile" value={pres.title} onChange={(e) => setPresField('title', e.target.value)} />
                </div>
                <div>
                  <label className="label">Tagline / Slogan</label>
                  <input className="input" placeholder="e.g. Your Trusted Technology Partner" value={pres.tagline} onChange={(e) => setPresField('tagline', e.target.value)} />
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-surface-50 p-3 text-xs leading-relaxed text-surface-500 dark:bg-surface-800/50 dark:text-surface-400">
                The presentation is generated with a company cover, content slides, a
                closing contact slide, letterhead-style headers and page footers.
              </div>
            </div>
          </div>

          {/* Right - Slides + actions */}
          <div className="lg:col-span-2">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Slide Content {slides.length > 0 && <span className="ml-1 text-xs font-normal text-surface-400">({slides.length} slide{slides.length === 1 ? '' : 's'})</span>}
                </h2>
                <button className="btn-secondary" onClick={addSlide}>
                  <Plus size={16} /> Add Slide
                </button>
              </div>

              <div className="space-y-4">
                {slides.length === 0 && (
                  <div className="rounded-lg border border-dashed border-surface-200 p-8 text-center text-sm text-surface-400 dark:border-surface-700">
                    No slides yet. Click "Add Slide" to begin building your presentation.
                  </div>
                )}
                {slides.map((slide, index) => (
                  <div key={slide.id} className="rounded-xl border border-surface-200 bg-surface-50/50 p-4 dark:border-surface-700 dark:bg-surface-800/50">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-surface-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-600 text-[10px] font-bold text-white">{index + 1}</span>
                        Slide {index + 1}
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="icon-btn" title="Move up" disabled={index === 0} onClick={() => moveSlide(slide.id, -1)}>
                          <ChevronUp size={15} />
                        </button>
                        <button className="icon-btn" title="Move down" disabled={index === slides.length - 1} onClick={() => moveSlide(slide.id, 1)}>
                          <ChevronDown size={15} />
                        </button>
                        <button className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove slide" onClick={() => removeSlide(slide.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <input
                        className="input"
                        placeholder="Slide title, e.g. Our Services"
                        value={slide.title}
                        onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                      />
                      <textarea
                        className="input min-h-[110px] w-full resize-y text-sm leading-relaxed"
                        placeholder={"Slide content...\n\nStart lines with '-' or '*' to render them as bullet points."}
                        value={slide.content}
                        onChange={(e) => updateSlide(slide.id, { content: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
              <button
                className="btn-secondary"
                disabled={presBusy !== null}
                onClick={() => handleGeneratePres('pptx')}
              >
                {presBusy === 'pptx' ? <>Generating PPTX...</> : <><FileCode2 size={16} /> Generate PowerPoint (.pptx)</>}
              </button>
              <button
                className="btn-primary"
                disabled={presBusy !== null}
                onClick={() => handleGeneratePres('pdf')}
              >
                {presBusy === 'pdf' ? <>Generating PDF...</> : <><Presentation size={16} /> Generate PDF Presentation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}