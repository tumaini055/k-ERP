import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, source, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('leads')
      .select('*, customer:customers(company_name, contact_person), assignee:users(first_name, last_name)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (source) query = query.eq('source', source);

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
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/stats', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('status');

    if (error) throw error;

    const stats = {
      new: data.filter(l => l.status === 'new').length,
      contacted: data.filter(l => l.status === 'contacted').length,
      qualified: data.filter(l => l.status === 'qualified').length,
      proposal: data.filter(l => l.status === 'proposal').length,
      negotiation: data.filter(l => l.status === 'negotiation').length,
      won: data.filter(l => l.status === 'won').length,
      lost: data.filter(l => l.status === 'lost').length,
      total: data.length,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

router.get('/:id', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*, customer:customers(*), assignee:users(first_name, last_name, email)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', checkPermission('crm', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...req.body, company_id: req.user!.company_id })
      .select('*, customer:customers(company_name, contact_person), assignee:users(first_name, last_name)')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.put('/:id', checkPermission('crm', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const updateData: any = { ...req.body, updated_at: new Date().toISOString() };
    if (req.body.status === 'won') {
      updateData.converted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, customer:customers(company_name, contact_person), assignee:users(first_name, last_name)')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', checkPermission('crm', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

router.post('/:id/convert', checkPermission('crm', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    let customerId = lead.customer_id;

    if (!customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .insert({
          company_name: lead.title,
          contact_person: req.body.contact_person || '',
          email: req.body.email || '',
          phone: req.body.phone || '',
          company_id: req.user!.company_id,
          customer_code: `CUST-${Date.now().toString().slice(-6)}`,
        })
        .select()
        .single();

      customerId = customer.id;
    }

    await supabase
      .from('leads')
      .update({
        status: 'won',
        customer_id: customerId,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    res.json({ message: 'Lead converted to customer', customer_id: customerId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

export default router;
