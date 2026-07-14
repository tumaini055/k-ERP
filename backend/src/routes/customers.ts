import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateCode } from '../utils/helpers';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' });

    if (req.user!.role !== 'super_admin' && req.user!.role !== 'ceo' && req.user!.role !== 'managing_director') {
      if (req.user!.company_id) {
        query = query.eq('company_id', req.user!.company_id);
      }
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('is_active', status === 'active');
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/:id', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*, user:users!customers_user_id_fkey(first_name, last_name, email), contacts:customer_contacts(*), documents:customer_documents(*)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, project_code, status, start_date, end_date')
      .eq('customer_id', req.params.id)
      .order('created_at', { ascending: false });

    res.json({ data: { ...customer, projects: projects || [] } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

router.post('/', checkPermission('crm', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const customerCode = generateCode('CUST');
    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...req.body,
        customer_code: customerCode,
        company_id: req.user!.company_id,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

router.put('/:id', checkPermission('crm', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.delete('/:id', checkPermission('crm', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    // Null out references on related tables to avoid FK violations
    const nullifyTables = ['invoices', 'payments', 'isp_subscribers'];
    for (const table of nullifyTables) {
      const { error } = await supabase.from(table).update({ customer_id: null }).eq('customer_id', req.params.id);
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
    }

    // Delete related records with cascade-or-nullable relationships
    const deleteTables = ['customer_contacts', 'leads', 'proposals', 'contracts'];
    for (const table of deleteTables) {
      const { error } = await supabase.from(table).delete().eq('customer_id', req.params.id);
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
    }

    const { error } = await supabase.from('customers').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Customer deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete customer' });
  }
});

router.get('/:id/projects', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('customer_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer projects' });
  }
});

router.post('/:id/contacts', checkPermission('crm', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('customer_contacts')
      .insert({ ...req.body, customer_id: req.params.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

router.get('/:id/contacts', checkPermission('crm', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', req.params.id)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

export default router;
