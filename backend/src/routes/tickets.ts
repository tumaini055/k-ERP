import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateTicketCode } from '../utils/helpers';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('helpdesk', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, category, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('support_tickets')
      .select('*, customer:customers!support_tickets_customer_id_fkey(company_name, contact_person), assigned:users!support_tickets_assigned_to_fkey(first_name, last_name)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);

    if (req.user!.role === 'customer') {
      query = query.eq('customer_id', req.user!.id);
    } else if (req.user!.role === 'engineer') {
      query = query.or(`assigned_to.eq.${req.user!.id},assigned_to.is.null`);
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
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/:id', checkPermission('helpdesk', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, customer:customers!support_tickets_customer_id_fkey(*), assigned:users!support_tickets_assigned_to_fkey(first_name, last_name, email), responses:ticket_responses(*, user:users!ticket_responses_user_id_fkey(first_name, last_name, role)), escalations:ticket_escalations(*)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/', checkPermission('helpdesk', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const ticketCode = generateTicketCode();
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        ...req.body,
        ticket_code: ticketCode,
        company_id: req.user!.company_id,
        customer_id: req.user!.role === 'customer' ? req.user!.id : req.body.customer_id,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.put('/:id', checkPermission('helpdesk', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const updateData: any = { ...req.body, updated_at: new Date().toISOString() };
    if (req.body.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

router.post('/:id/responses', checkPermission('helpdesk', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('ticket_responses')
      .insert({
        ticket_id: req.params.id,
        user_id: req.user!.id,
        message: req.body.message,
        is_internal: req.body.is_internal || false,
      })
      .select('*, user:users!ticket_responses_user_id_fkey(first_name, last_name, role)')
      .single();

    if (error) throw error;

    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add response' });
  }
});

export default router;
