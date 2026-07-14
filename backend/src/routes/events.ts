import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /events?from=&to= - Events in date range
router.get('/', checkPermission('events', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('events')
      .select('*, creator:users!events_created_by_fkey(first_name, last_name), attendees:event_attendees(user_id)')
      .order('start_time', { ascending: true });

    if (from) query = query.gte('start_time', from);
    if (to) query = query.lte('end_time', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /events/feed - Unified calendar feed (events + tasks + milestones + contracts + leave + tickets)
router.get('/feed', checkPermission('events', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const fromQ = req.query.from as string | undefined;
    const toQ = req.query.to as string | undefined;
    const f = fromQ || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const t = toQ || new Date(new Date().getFullYear() + 1, 0, 1).toISOString();
    const fd = f.split('T')[0];
    const td = t.split('T')[0];

    const [eventsRes, tasksRes, milestonesRes, contractsRes, leaveRes, ticketsRes] = await Promise.all([
      supabase.from('events').select('*').gte('start_time', f).lte('end_time', t).order('start_time'),
      supabase.from('project_tasks').select('*, project:projects(name), assignee:users!project_tasks_assigned_to_fkey(first_name, last_name)').not('due_date', 'is', null).gte('due_date', fd).lte('due_date', td),
      supabase.from('project_milestones').select('*, project:projects(name)').not('due_date', 'is', null).gte('due_date', fd).lte('due_date', td),
      supabase.from('service_contracts').select('*, customer:customers!service_contracts_customer_id_fkey(company_name)').gte('end_date', fd).lte('end_date', td),
      supabase.from('leave_requests').select('*, employee:users!leave_requests_user_id_fkey(first_name, last_name)').gte('start_date', fd).lte('end_date', td),
      supabase.from('support_tickets').select('*, customer:customers!support_tickets_customer_id_fkey(company_name)').not('due_date', 'is', null).gte('due_date', f).lte('due_date', t),
    ]);

    const feed: any[] = [];

    (eventsRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'event', title: e.title, description: e.description, start: e.start_time, end: e.end_time, allDay: e.is_all_day, location: e.location, color: e.color || '#3b82f6', type: e.event_type, meta: {} });
    });

    (tasksRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'task', title: e.title, description: `Task · ${e.project?.name || ''}`, start: e.due_date, end: e.due_date, allDay: true, color: '#8b5cf6', type: e.status, meta: { project: e.project?.name, assignee: e.assignee ? `${e.assignee.first_name} ${e.assignee.last_name}` : null } });
    });

    (milestonesRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'milestone', title: e.name, description: `Milestone · ${e.project?.name || ''}`, start: e.due_date, end: e.due_date, allDay: true, color: '#f59e0b', type: e.is_completed ? 'completed' : 'pending', meta: { project: e.project?.name } });
    });

    (contractsRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'contract', title: `Contract End: ${e.title || e.contract_number}`, description: `${e.customer?.company_name || ''} · ${e.contract_type}`, start: e.end_date, end: e.end_date, allDay: true, color: '#ef4444', type: e.status, meta: { customer: e.customer?.company_name } });
    });

    (leaveRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'leave', title: `Leave: ${e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : ''}`, description: `${e.leave_type || ''} · ${e.status}`, start: e.start_date, end: e.end_date, allDay: true, color: '#10b981', type: e.status, meta: { employee: e.employee ? `${e.employee.first_name} ${e.employee.last_name}` : null } });
    });

    (ticketsRes.data || []).forEach((e: any) => {
      feed.push({ id: e.id, source: 'ticket', title: `Ticket: ${e.subject}`, description: `${e.customer?.company_name || ''} · ${e.priority || ''}`, start: e.due_date, end: e.due_date, allDay: true, color: '#ec4899', type: e.status, meta: { customer: e.customer?.company_name, priority: e.priority } });
    });

    feed.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    res.json({ data: feed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calendar feed' });
  }
});

// POST /events
router.post('/', checkPermission('events', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...req.body, created_by: req.user!.id, company_id: req.user!.company_id })
      .select('*, creator:users!events_created_by_fkey(first_name, last_name)')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /events/:id
router.put('/:id', checkPermission('events', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, creator:users!events_created_by_fkey(first_name, last_name)')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /events/:id
router.delete('/:id', checkPermission('events', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
