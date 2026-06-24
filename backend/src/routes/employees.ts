import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { department, role, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('users')
      .select('id, employee_id, first_name, last_name, email, phone, role, department, position, avatar_url, is_active, created_at, contract:employee_contracts(salary, contract_type, start_date, end_date, is_active)', { count: 'exact' })
      .neq('role', 'customer');

    if (department) query = query.eq('department', department);
    if (role) query = query.eq('role', role);
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

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
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.post('/', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, email, phone, password, role, department, position, employee_id } = req.body;
    if (!first_name || !last_name || !email || !password) {
      res.status(400).json({ error: 'First name, last name, email, and password are required' });
      return;
    }
    const existing = await supabase.from('users').select('id').eq('email', email).single();
    if (existing.data) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }
    const password_hash = await bcrypt.hash(password, 12);
    const empId = employee_id || `EMP-${Date.now().toString().slice(-6)}`;
    const { data, error } = await supabase.from('users').insert({
      first_name, last_name, email, phone, password_hash,
      role: role || 'engineer', department, position, employee_id: empId,
      company_id: req.user!.company_id, is_active: true,
    }).select('*').single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || error?.details || 'Failed to create employee' });
  }
});

router.get('/leave-requests', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase
      .from('leave_requests')
      .select('*, user:users(first_name, last_name, department), approver:users(first_name, last_name)');

    if (['engineer'].includes(req.user!.role)) {
      query = query.eq('user_id', req.user!.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if ((error as any)?.message?.includes('relation') || (error as any)?.code === '42P01') {
        res.json({ data: [] });
        return;
      }
      throw error;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

router.post('/leave-requests', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({ ...req.body, user_id: req.user!.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

router.put('/leave-requests/:id/approve', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: req.user!.id })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave' });
  }
});

router.get('/:id', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const safeQuery = async (table: string, column = 'user_id', single = false) => {
      try {
        const q = supabase.from(table).select('*').eq(column, req.params.id);
        const { data } = single ? await q.maybeSingle() : await q;
        return data || (single ? null : []);
      } catch { return single ? null : []; }
    };

    const [contract, attendance, leave_requests, evaluations] = await Promise.all([
      safeQuery('employee_contracts', 'user_id', true),
      safeQuery('attendance'),
      safeQuery('leave_requests'),
      safeQuery('performance_evaluations'),
    ]);

    res.json({ data: { ...user, contract, attendance, leave_requests, evaluations } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.put('/:id', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.get('/:id/attendance', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.params.id);

    if (month) query = query.eq('date.extract.month', month);
    if (year) query = query.eq('date.extract.year', year);

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/attendance', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .insert({ ...req.body, user_id: req.body.user_id || req.user!.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

router.delete('/:id', checkPermission('employees', 'canDelete'), async (req: AuthRequest, res: Response) => {
  const userId = req.params.id;

  const safeNullify = async (table: string, column: string) => {
    try {
      await supabase.from(table).update({ [column]: null }).eq(column, userId);
    } catch {}
  };

  const safeDelete = async (table: string, column: string) => {
    try {
      await supabase.from(table).delete().eq(column, userId);
    } catch {}
  };

  try {
    // Null out audit/reference columns where user is referenced
    await Promise.all([
      safeNullify('invoices', 'created_by'),
      safeNullify('expenses', 'created_by'),
      safeNullify('expenses', 'approved_by'),
      safeNullify('payments', 'received_by'),
      safeNullify('projects', 'manager_id'),
      safeNullify('project_tasks', 'assigned_to'),
      safeNullify('documents', 'uploaded_by'),
      safeNullify('contracts', 'created_by'),
      safeNullify('events', 'created_by'),
      safeNullify('support_tickets', 'assigned_to'),
      safeNullify('ticket_responses', 'user_id'),
      safeNullify('leave_requests', 'approved_by'),
      safeNullify('performance_evaluations', 'reviewer_id'),
    ]);

    // Delete owned records
    await Promise.all([
      safeDelete('attendance', 'user_id'),
      safeDelete('time_entries', 'user_id'),
      safeDelete('notifications', 'user_id'),
      safeDelete('user_sessions', 'user_id'),
    ]);

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    res.json({ message: 'Employee deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete employee' });
  }
});

export default router;
