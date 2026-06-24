import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ── Departments ──

router.get('/departments', async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase.from('departments').select('*').order('name');

    if (req.user!.role !== 'super_admin' && req.user!.company_id) {
      query = query.eq('company_id', req.user!.company_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }
    const { data, error } = await supabase
      .from('departments')
      .insert({ name, code, description, company_id: req.user!.company_id })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/departments/:id', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/departments/:id', checkPermission('settings', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ── Positions ──

router.get('/positions', async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase.from('positions').select('*, department:departments(name)').order('name');

    if (req.user!.role !== 'super_admin' && req.user!.company_id) {
      query = query.eq('company_id', req.user!.company_id);
    }

    if (req.query.department_id) {
      query = query.eq('department_id', req.query.department_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/positions', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, department_id, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Position name is required' });
      return;
    }
    const { data, error } = await supabase
      .from('positions')
      .insert({ name, department_id, description, company_id: req.user!.company_id })
      .select('*, department:departments(name)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create position' });
  }
});

router.put('/positions/:id', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('positions')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*, department:departments(name)')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update position' });
  }
});

router.delete('/positions/:id', checkPermission('settings', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Position deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

export default router;
