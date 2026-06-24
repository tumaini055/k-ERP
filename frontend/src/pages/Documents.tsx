import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { AppDocument, DocumentFolder } from '../types';
import { formatDate, formatDateTime } from '../lib/utils';
import {
  FileText, Folder, Plus, X, RefreshCw, Search, Download, Trash2,
  Grid3X3, List, Upload, Edit2, Tag, FileImage, FileArchive,
  FileSpreadsheet, File, ChevronRight,
} from 'lucide-react';

const FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'image', 'archive', 'other'];

function fileIcon(type?: string) {
  if (!type) return <File size={20} className="text-surface-400" />;
  const t = type.toLowerCase();
  if (t.includes('pdf')) return <FileText size={20} className="text-red-500" />;
  if (t.includes('image') || t.includes('jpg') || t.includes('png')) return <FileImage size={20} className="text-blue-500" />;
  if (t.includes('sheet') || t.includes('xls')) return <FileSpreadsheet size={20} className="text-accent-600" />;
  if (t.includes('zip') || t.includes('rar')) return <FileArchive size={20} className="text-yellow-600" />;
  if (t.includes('doc')) return <FileText size={20} className="text-blue-600" />;
  return <File size={20} className="text-surface-400" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const [docs, setDocs] = useState<AppDocument[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [selected, setSelected] = useState<AppDocument | null>(null);
  const [detail, setDetail] = useState<AppDocument | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [showFolder, setShowFolder] = useState(false);
  const [editDoc, setEditDoc] = useState<AppDocument | null>(null);
  const [folderName, setFolderName] = useState('');
  const [uploadForm, setUploadForm] = useState({
    name: '', description: '', type: '', tags: '', folder_id: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [showVersionUpload, setShowVersionUpload] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (folderFilter !== 'all') params.folder_id = folderFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;
      const [docRes, folderRes] = await Promise.all([
        dataService.getDocuments(params),
        dataService.getFolders(),
      ]);
      setDocs(docRes.data || []);
      setFolders(folderRes.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchAll(), 300);
    return () => clearTimeout(t);
  }, [search, typeFilter, folderFilter]);

  const openDetail = async (d: AppDocument) => {
    setSelected(d);
    try {
      const { data } = await dataService.getDocument(d.id);
      setDetail(data);
    } catch { setDetail(null); }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await dataService.deleteDocument(id);
    fetchAll();
    if (selected?.id === id) closeDetail();
  };

  const handleUpload = async () => {
    const fd = new FormData();
    if (uploadFile) fd.append('file', uploadFile);
    if (uploadForm.name) fd.append('name', uploadForm.name);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    if (uploadForm.type) fd.append('type', uploadForm.type);
    if (uploadForm.tags) fd.append('tags', JSON.stringify(uploadForm.tags.split(',').map((t: string) => t.trim())));
    if (uploadForm.folder_id) fd.append('folder_id', uploadForm.folder_id);
    await dataService.uploadDocument(fd);
    setShowUpload(false);
    setUploadFile(null);
    setUploadForm({ name: '', description: '', type: '', tags: '', folder_id: '' });
    fetchAll();
  };

  const handleVersionUpload = async () => {
    if (!detail || !versionFile) return;
    const fd = new FormData();
    fd.append('file', versionFile);
    if (versionNotes) fd.append('change_notes', versionNotes);
    await dataService.uploadVersion(detail.id, fd);
    setShowVersionUpload(false);
    setVersionFile(null);
    setVersionNotes('');
    openDetail(detail);
    fetchAll();
  };

  const handleUpdate = async () => {
    if (!editDoc) return;
    await dataService.updateDocument(editDoc.id, {
      name: editDoc.name,
      description: editDoc.description,
      type: editDoc.type,
      tags: editDoc.tags,
      folder_id: editDoc.folder_id || null,
    });
    setEditDoc(null);
    fetchAll();
    if (selected) openDetail(selected);
  };

  const filtered = docs;

  const tags = detail?.tags?.length ? (typeof detail.tags === 'string' ? JSON.parse(detail.tags as string) : detail.tags) : [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Document Management</h1>
          <p className="page-subtitle">Store, organize, and manage all company documents</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowFolder(true)} className="btn-secondary">
            <Folder size={18} className="mr-1" /> New Folder
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload size={18} className="mr-1" /> Upload
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {FILE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select className="input w-full sm:w-44" value={folderFilter} onChange={e => setFolderFilter(e.target.value)}>
          <option value="all">All Folders</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex rounded-lg border border-surface-200 overflow-hidden">
          <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:bg-surface-50'}`}>
            <List size={18} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:bg-surface-50'}`}>
            <Grid3X3 size={18} />
          </button>
        </div>
        <button onClick={fetchAll} className="btn-secondary btn-icon"><RefreshCw size={16} /></button>
      </div>

      {/* Folder chips */}
      {folders.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setFolderFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${folderFilter === 'all' ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-surface-200 text-surface-500 hover:bg-surface-50'}`}>
            All
          </button>
          {folders.map(f => (
            <div key={f.id} className="inline-flex items-center gap-0 rounded-lg border overflow-hidden">
              <button onClick={() => setFolderFilter(f.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${folderFilter === f.id ? 'bg-primary-50 text-primary-700' : 'text-surface-500 hover:bg-surface-50'}`}>
                <Folder size={14} className="text-yellow-500" /> {f.name}
              </button>
              <button onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete folder "${f.name}"?`)) { await dataService.deleteFolder(f.id); fetchAll(); } }}
                className="px-1.5 py-1.5 text-surface-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-surface-400">No documents found. Upload your first document!</div>
      ) : viewMode === 'list' ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Folder</th>
                <th>Version</th>
                <th>Uploaded By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} onClick={() => openDetail(d)} className="cursor-pointer hover:bg-surface-50">
                  <td>
                    <div className="flex items-center gap-2">
                      {fileIcon(d.file_type)}
                      <span className="font-medium truncate max-w-[200px]">{d.name}</span>
                    </div>
                  </td>
                  <td><span className="capitalize text-xs">{d.type || '-'}</span></td>
                  <td className="text-xs text-surface-500">{formatSize(d.file_size)}</td>
                  <td className="text-xs text-surface-500">{d.folder?.name || '-'}</td>
                  <td><span className="text-xs font-mono">v{d.version}</span></td>
                  <td className="text-xs text-surface-500">{d.uploader ? `${d.uploader.first_name} ${d.uploader.last_name}` : '-'}</td>
                  <td className="text-xs text-surface-400">{formatDate(d.created_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                        className="rounded p-1.5 text-surface-400 hover:text-primary-600 transition-colors" title="Download">
                        <Download size={15} />
                      </a>
                      <button onClick={() => handleDelete(d.id)}
                        className="rounded p-1.5 text-surface-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid view */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(d => (
            <div key={d.id} onClick={() => openDetail(d)}
              className="rounded-xl border border-surface-200 bg-white p-4 cursor-pointer hover:shadow-md transition-shadow dark:border-surface-700 dark:bg-surface-800">
              <div className="flex justify-center mb-3 pt-2">
                {fileIcon(d.file_type)}
              </div>
              <p className="text-sm font-medium text-center truncate">{d.name}</p>
              <p className="text-xs text-surface-400 text-center mt-1">
                {d.type && <span className="capitalize">{d.type}</span>}
                {d.file_size && <span> · {formatSize(d.file_size)}</span>}
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-surface-100 text-xs text-surface-400">
                <span>v{d.version}</span>
                <span>·</span>
                <span>{formatDate(d.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side Panel */}
      {selected && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div className="flex items-center gap-3">
                {fileIcon(detail.file_type)}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate max-w-[300px]">{detail.name}</h2>
                  <p className="text-xs text-surface-500">v{detail.version} · {formatSize(detail.file_size)} · {detail.type || '—'}</p>
                </div>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <a href={detail.file_url} target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-xs py-1.5 px-3"><Download size={14} className="mr-1" /> Download</a>
                <button onClick={() => setShowVersionUpload(true)}
                  className="btn-secondary text-xs py-1.5 px-3"><Upload size={14} className="mr-1" /> New Version</button>
                <button onClick={() => setEditDoc({ ...detail })}
                  className="btn-secondary text-xs py-1.5 px-3"><Edit2 size={14} className="mr-1" /> Edit</button>
                <button onClick={() => handleDelete(detail.id)}
                  className="btn-secondary text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 size={14} className="mr-1" /> Delete
                </button>
              </div>

              {/* Info */}
              <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                <p className="text-sm font-semibold mb-3">Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-surface-500">Name</span><p className="font-medium">{detail.name}</p></div>
                  <div><span className="text-surface-500">Type</span><p className="font-medium capitalize">{detail.type || '-'}</p></div>
                  <div><span className="text-surface-500">File Type</span><p className="font-medium">{detail.file_type || '-'}</p></div>
                  <div><span className="text-surface-500">Size</span><p className="font-medium">{formatSize(detail.file_size)}</p></div>
                  <div><span className="text-surface-500">Version</span><p className="font-medium">v{detail.version}</p></div>
                  <div><span className="text-surface-500">Folder</span><p className="font-medium">{detail.folder?.name || '-'}</p></div>
                  <div><span className="text-surface-500">Uploaded by</span><p className="font-medium">{detail.uploader ? `${detail.uploader.first_name} ${detail.uploader.last_name}` : '-'}</p></div>
                  <div><span className="text-surface-500">Created</span><p className="font-medium">{formatDateTime(detail.created_at)}</p></div>
                </div>
                {detail.description && <div className="mt-3"><span className="text-surface-500 text-sm">Description</span><p className="text-sm mt-1">{detail.description}</p></div>}
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"><Tag size={10} />{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Version History */}
              <div className="rounded-lg border border-surface-200 dark:border-surface-700">
                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
                  <p className="text-sm font-semibold">Version History</p>
                  <button onClick={() => setShowVersionUpload(true)} className="btn-secondary text-xs py-1 px-2"><Upload size={12} className="mr-1" /> Upload New</button>
                </div>
                {(detail.versions || []).length === 0 ? (
                  <p className="text-sm text-surface-400 text-center py-6">No version history</p>
                ) : (
                  <div className="divide-y divide-surface-200 dark:divide-surface-700">
                    {[...(detail.versions || [])].sort((a, b) => b.version - a.version).map(v => (
                      <div key={v.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-primary-600 bg-primary-50 rounded px-2 py-0.5">v{v.version}</span>
                          <div>
                            <p className="text-sm">{v.change_notes || 'No notes'}</p>
                            <p className="text-xs text-surface-400">{v.uploader ? `${v.uploader.first_name} ${v.uploader.last_name}` : '-'} · {formatDate(v.created_at)} · {formatSize(v.file_size)}</p>
                          </div>
                        </div>
                        <a href={v.file_url} target="_blank" rel="noopener noreferrer"
                          className="rounded p-1.5 text-surface-400 hover:text-primary-600 transition-colors">
                          <Download size={15} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">File <span className="text-red-500">*</span></label>
                <input type="file" className="input" onChange={e => {
                  const f = e.target.files?.[0];
                  setUploadFile(f || null);
                  if (f && !uploadForm.name) setUploadForm(p => ({ ...p, name: f.name.replace(/\.[^/.]+$/, '') }));
                }} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Name</label>
                  <input type="text" className="input" value={uploadForm.name} onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={uploadForm.type} onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}>
                    <option value="">Auto-detect</option>
                    {FILE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Folder</label>
                  <select className="input" value={uploadForm.folder_id} onChange={e => setUploadForm({ ...uploadForm, folder_id: e.target.value })}>
                    <option value="">None</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input" rows={2} value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Tags (comma-separated)</label>
                  <input type="text" className="input" value={uploadForm.tags} onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value })} placeholder="e.g. contract, signed, 2024" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleUpload} disabled={!uploadFile} className="btn-primary"><Upload size={16} className="mr-1" /> Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowFolder(false)}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">New Folder</h2>
              <button onClick={() => setShowFolder(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Folder Name</label>
                <input type="text" className="input" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="e.g. Contracts, Reports" autoFocus />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowFolder(false)} className="btn-secondary">Cancel</button>
                <button onClick={async () => {
                  if (!folderName.trim()) return;
                  await dataService.createFolder({ name: folderName.trim() });
                  setFolderName('');
                  setShowFolder(false);
                  fetchAll();
                }} className="btn-primary">Create Folder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setEditDoc(null)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Edit Document</h2>
              <button onClick={() => setEditDoc(null)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input type="text" className="input" value={editDoc.name} onChange={e => setEditDoc({ ...editDoc, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={editDoc.type || ''} onChange={e => setEditDoc({ ...editDoc, type: e.target.value })}>
                    <option value="">—</option>
                    {FILE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Folder</label>
                  <select className="input" value={editDoc.folder_id || ''} onChange={e => setEditDoc({ ...editDoc, folder_id: e.target.value })}>
                    <option value="">None</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={editDoc.description || ''} onChange={e => setEditDoc({ ...editDoc, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input type="text" className="input" value={(editDoc.tags || []).join(', ')} onChange={e => setEditDoc({ ...editDoc, tags: e.target.value.split(',').map((t: string) => t.trim()) })} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditDoc(null)} className="btn-secondary">Cancel</button>
                <button onClick={handleUpdate} className="btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Version Modal */}
      {showVersionUpload && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowVersionUpload(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 dark:bg-surface-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Upload New Version</h2>
              <button onClick={() => setShowVersionUpload(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <p className="text-sm text-surface-500 mb-4">
              Document: <strong>{detail.name}</strong> (current v{detail.version})
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">New File <span className="text-red-500">*</span></label>
                <input type="file" className="input" onChange={e => setVersionFile(e.target.files?.[0] || null)} required />
              </div>
              <div>
                <label className="label">Change Notes</label>
                <textarea className="input" rows={2} value={versionNotes} onChange={e => setVersionNotes(e.target.value)} placeholder="What changed in this version?" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowVersionUpload(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleVersionUpload} disabled={!versionFile} className="btn-primary"><Upload size={16} className="mr-1" /> Upload v{detail.version + 1}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
