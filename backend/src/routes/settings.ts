import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('settings', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    if (!companyId) {
      res.json({ data: { settings: {} } });
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
    const companyId = req.user!.company_id;
    if (!companyId) {
      res.status(400).json({ error: 'User has no company assigned' });
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

export default router;
