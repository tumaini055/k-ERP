import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('contracts', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, customer_id, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('service_contracts')
      .select('*, customer:customers(company_name, contact_person, phone)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('contract_type', type);
    if (customer_id) query = query.eq('customer_id', customer_id);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil((count || 0) / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

router.get('/:id', checkPermission('contracts', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('service_contracts')
      .select('*, customer:customers(*), renewals:contract_renewals(*)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

router.post('/', checkPermission('contracts', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('service_contracts')
      .insert({
        ...req.body,
        company_id: req.user!.company_id,
        contract_number: `CTR-${Date.now().toString().slice(-6)}`,
        created_by: req.user!.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

router.put('/:id', checkPermission('contracts', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('service_contracts')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// Delete contract
router.delete('/:id', checkPermission('contracts', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('service_contracts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Contract deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

// Create contract renewal
router.post('/:id/renewals', checkPermission('contracts', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: renewal, error } = await supabase
      .from('contract_renewals')
      .insert({
        contract_id: req.params.id,
        renewed_from: req.params.id,
        renewal_date: req.body.renewal_date,
        new_value: req.body.new_value,
        notes: req.body.notes,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update contract renewal_date
    await supabase
      .from('service_contracts')
      .update({ renewal_date: req.body.renewal_date, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({ data: renewal });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create renewal' });
  }
});

router.get('/expiring', checkPermission('contracts', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data, error } = await supabase
      .from('service_contracts')
      .select('*, customer:customers(company_name, contact_person, phone)')
      .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0])
      .eq('status', 'active')
      .order('end_date', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expiring contracts' });
  }
});

export default router;
