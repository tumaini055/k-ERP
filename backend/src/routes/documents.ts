import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.use(authenticate);

// List documents (with filters)
router.get('/', checkPermission('documents', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { folder_id, type, search, page = 1, limit = 20 } = req.query;
    let query = supabase
      .from('documents')
      .select('*, uploader:users(first_name, last_name)', { count: 'exact' });

    if (folder_id) query = query.eq('folder_id', folder_id);
    if (type) query = query.eq('type', type);
    if (search) query = query.or(`name.ilike.%${search}%,tags.cs.{${search}}`);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Upload document (with file)
router.post('/', checkPermission('documents', 'canCreate'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const body = JSON.parse(JSON.stringify(req.body));

    const fileUrl = file
      ? `/uploads/documents/${file.filename}`
      : body.file_url;

    const { data, error } = await supabase
      .from('documents')
      .insert({
        name: body.name || file?.originalname || 'Untitled',
        description: body.description,
        type: body.type || (file ? file.mimetype.split('/')[1]?.toUpperCase() : null),
        file_url: fileUrl,
        file_size: file?.size || body.file_size,
        file_type: file?.mimetype || body.file_type,
        tags: body.tags || [],
        folder_id: body.folder_id || null,
        version: 1,
        uploaded_by: req.user!.id,
        company_id: req.user!.company_id,
      })
      .select('*, uploader:users(first_name, last_name)')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Folders (MUST be before /:id routes)
router.get('/folders', checkPermission('documents', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('document_folders')
      .select('*')
      .is('parent_id', null)
      .order('name');
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.post('/folders', checkPermission('documents', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('document_folders')
      .insert({ ...req.body, created_by: req.user!.id, company_id: req.user!.company_id })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.delete('/folders/:id', checkPermission('documents', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    // Unlink documents in this folder first
    await supabase.from('documents').update({ folder_id: null }).eq('folder_id', req.params.id);
    const { error } = await supabase.from('document_folders').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Get single document
router.get('/:id', checkPermission('documents', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*, uploader:users(first_name, last_name), versions:document_versions(*, uploader:users(first_name, last_name))')
      .eq('id', req.params.id)
      .single();

    if (error) { res.status(404).json({ error: 'Document not found' }); return; }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update document metadata
router.put('/:id', checkPermission('documents', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, uploader:users(first_name, last_name)')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', checkPermission('documents', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: doc } = await supabase.from('documents').select('file_url').eq('id', req.params.id).single();
    if (doc?.file_url?.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', doc.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const { error } = await supabase.from('documents').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Upload new version
router.post('/:id/versions', checkPermission('documents', 'canCreate'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'File is required' }); return; }

    const { data: doc } = await supabase.from('documents').select('version').eq('id', req.params.id).single();
    const newVersion = (doc?.version || 0) + 1;
    const fileUrl = `/uploads/documents/${file.filename}`;

    const { data: version, error: verErr } = await supabase
      .from('document_versions')
      .insert({
        document_id: req.params.id,
        version: newVersion,
        file_url: fileUrl,
        file_size: file.size,
        uploaded_by: req.user!.id,
        change_notes: req.body.change_notes,
      })
      .select('*')
      .single();

    if (verErr) throw verErr;

    await supabase
      .from('documents')
      .update({ file_url: fileUrl, file_size: file.size, version: newVersion, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({ data: version });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload version' });
  }
});

export default router;
