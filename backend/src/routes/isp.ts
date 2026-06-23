import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/packages', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from('isp_packages')
      .select('*')
      .eq('is_active', true);

    if (type) query = query.eq('type', type);

    const { data, error } = await query.order('price', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

router.post('/packages', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_packages')
      .insert({ ...req.body, company_id: req.user!.company_id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

router.put('/packages/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_packages')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

router.get('/subscribers', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, package_id, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('isp_subscribers')
      .select('*, customer:customers(company_name, contact_person, phone), package:isp_packages(name, bandwidth_download, bandwidth_upload, price)', { count: 'exact' });

    if (status) query = query.eq('service_status', status);
    if (package_id) query = query.eq('package_id', package_id);
    if (search) {
      query = query.or(`subscriber_code.ilike.%${search}%,customer.company_name.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

router.post('/subscribers', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_subscribers')
      .insert({
        ...req.body,
        company_id: req.user!.company_id,
        subscriber_code: `ISP-${Date.now().toString().slice(-6)}`,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

router.put('/subscribers/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_subscribers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

router.get('/billing', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, subscriber_id, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('isp_billing')
      .select('*, subscriber:isp_subscribers(subscriber_code, customer:customers(company_name))', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (subscriber_id) query = query.eq('subscriber_id', subscriber_id);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('billing_date', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

router.post('/billing', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriber_id, amount, billing_date, due_date, notes } = req.body;
    if (!subscriber_id || !amount) {
      res.status(400).json({ error: 'Subscriber and amount are required' });
      return;
    }
    const { data, error } = await supabase
      .from('isp_billing')
      .insert({
        subscriber_id,
        amount,
        billing_date: billing_date || new Date().toISOString().split('T')[0],
        due_date: due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create billing record' });
  }
});

router.put('/billing/:id/pay', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { paid_amount } = req.body;
    const { data: bill, error: fetchError } = await supabase
      .from('isp_billing')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !bill) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }
    const newPaid = paid_amount || bill.amount;
    const { data, error } = await supabase
      .from('isp_billing')
      .update({
        paid_amount: newPaid,
        status: newPaid >= bill.amount ? 'paid' : 'partial',
        paid_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
