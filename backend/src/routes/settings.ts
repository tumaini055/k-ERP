import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.use(authenticate);

async function resolveCompanyId(userId: string, currentCompanyId?: string): Promise<string | null> {
  if (currentCompanyId) return currentCompanyId;
  const { data: company } = await supabase.from('companies').select('id').limit(1).single();
  if (company?.id) {
    await supabase.from('users').update({ company_id: company.id }).eq('id', userId);
    return company.id;
  }
  return null;
}

router.get('/', checkPermission('settings', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ data: data || { settings: {} } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }

    const { settings } = req.body;

    const existing = await supabase
      .from('company_settings')
      .select('id')
      .eq('company_id', companyId)
      .single();

    let result;
    if (existing.data) {
      result = await supabase
        .from('company_settings')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('company_settings')
        .insert({ company_id: companyId, settings })
        .select('*')
        .single();
    }

    if (result.error) throw result.error;
    res.json({ data: result.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.post('/upload-logo', checkPermission('settings', 'canEdit'), upload.single('logo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const filePath = `/uploads/logos/${req.file.filename}`;
    res.json({ url: filePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

export default router;
