import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateProjectCode } from '../utils/helpers';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('projects')
      .select('*, customer:customers!projects_customer_id_fkey(company_name, contact_person), manager:users!projects_manager_id_fkey(first_name, last_name)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    if (['engineer'].includes(req.user!.role)) {
      query = query.or(`manager_id.eq.${req.user!.id},tasks.assigned_to.eq.${req.user!.id}`);
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
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, customer:customers!projects_customer_id_fkey(*), manager:users!projects_manager_id_fkey(first_name, last_name, email, phone), milestones:project_milestones(*), tasks:project_tasks(*), documents:project_documents(*)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', checkPermission('projects', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const projectCode = generateProjectCode();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...req.body,
        project_code: projectCode,
        company_id: req.user!.company_id,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', checkPermission('projects', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    let completedProfit = 0;

    // If status is changing to completed, calculate and record the profit as revenue
    if (req.body.status === 'completed') {
      const { data: current } = await supabase
        .from('projects')
        .select('status, budget, recorded_revenue')
        .eq('id', req.params.id)
        .single();

      // Only calculate recorded_revenue if not already set (prevents duplicate overwrites)
      if (current && current.status !== 'completed' && !current.recorded_revenue) {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('project_id', req.params.id);

        const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
        completedProfit = Math.max(0, Number(current.budget || 0) - totalExpenses);
        req.body.recorded_revenue = completedProfit;
        req.body.actual_end_date = new Date().toISOString().split('T')[0];
      } else if (current && current.status !== 'completed' && current.recorded_revenue) {
        // Keep existing recorded_revenue when re-completing
        req.body.recorded_revenue = current.recorded_revenue;
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    // If column doesn't exist yet, retry without recorded_revenue
    if (error && error.message?.includes('column') && completedProfit > 0) {
      delete req.body.recorded_revenue;
      const { data: retryData, error: retryError } = await supabase
        .from('projects')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (retryError) throw retryError;
      res.json({ data: retryData });
      return;
    }

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', checkPermission('projects', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    // Delete related records first to avoid FK violations
    const tables = ['time_entries', 'expenses', 'project_tasks', 'project_milestones', 'project_documents'];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('project_id', req.params.id);
      if (error && error.code !== '42P01') throw error;
    }

    // Null out project_id on invoices
    const { error: invErr } = await supabase.from('invoices').update({ project_id: null }).eq('project_id', req.params.id);
    if (invErr && invErr.code !== '42P01') throw invErr;

    const { error } = await supabase.from('projects').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Project deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete project' });
  }
});

router.get('/:id/tasks', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*, assignee:users!project_tasks_assigned_to_fkey(first_name, last_name)')
      .eq('project_id', req.params.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/:id/tasks', checkPermission('projects', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('project_tasks')
      .insert({ ...req.body, project_id: req.params.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:taskId', checkPermission('projects', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const updateData: any = { ...req.body, updated_at: new Date().toISOString() };
    if (req.body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .update(updateData)
      .eq('id', req.params.taskId)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Milestones
router.get('/:id/milestones', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', req.params.id)
      .order('due_date', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

router.post('/:id/milestones', checkPermission('projects', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('project_milestones')
      .insert({ ...req.body, project_id: req.params.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

router.put('/milestones/:mid', checkPermission('projects', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const updateData: any = { ...req.body };
    if (req.body.is_completed) {
      updateData.completed_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .update(updateData)
      .eq('id', req.params.mid)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

router.delete('/milestones/:mid', checkPermission('projects', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', req.params.mid);

    if (error) throw error;
    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// Time Entries
router.get('/:id/time-entries', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*, user:users!time_entries_user_id_fkey(first_name, last_name), task:project_tasks(title)')
      .eq('project_id', req.params.id)
      .order('date', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

router.post('/time-entries', checkPermission('projects', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .insert({ ...req.body, user_id: req.user!.id })
      .select('*, user:users!time_entries_user_id_fkey(first_name, last_name)')
      .single();

    if (error) throw error;

    // Update actual hours on task if task_id is provided
    if (req.body.task_id && req.body.hours) {
      const { data: task } = await supabase
        .from('project_tasks')
        .select('actual_hours')
        .eq('id', req.body.task_id)
        .single();

      if (task) {
        await supabase
          .from('project_tasks')
          .update({ actual_hours: (task.actual_hours || 0) + Number(req.body.hours) })
          .eq('id', req.body.task_id);
      }
    }

    // Update project actual cost
    if (req.body.project_id && req.body.hours) {
      const { data: project } = await supabase
        .from('projects')
        .select('actual_cost')
        .eq('id', req.body.project_id)
        .single();

      if (project) {
        await supabase
          .from('projects')
          .update({ actual_cost: (project.actual_cost || 0) + (Number(req.body.hours) * 50000) })
          .eq('id', req.body.project_id);
      }
    }

    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// Project stats
router.get('/stats/summary', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*');

    if (error) throw error;

    const stats = {
      total: data.length,
      planning: data.filter(p => p.status === 'planning').length,
      in_progress: data.filter(p => p.status === 'in_progress').length,
      on_hold: data.filter(p => p.status === 'on_hold').length,
      completed: data.filter(p => p.status === 'completed').length,
      cancelled: data.filter(p => p.status === 'cancelled').length,
      total_budget: data.reduce((s, p) => s + Number(p.budget || 0), 0),
      total_recorded_revenue: data.reduce((s, p) => s + Number(p.recorded_revenue || 0), 0),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
});

// ============================================
// PROJECT FINANCIALS
// ============================================

// Get project expenses
router.get('/:id/expenses', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('project_id', req.params.id)
      .order('expense_date', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project expenses' });
  }
});

// Add expense to project
router.post('/:id/expenses', checkPermission('projects', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        company_id: req.user!.company_id,
        project_id: req.params.id,
        category: req.body.category,
        description: req.body.description,
        amount: req.body.amount,
        expense_date: req.body.expense_date || new Date().toISOString().split('T')[0],
        created_by: req.user!.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Delete project expense
router.delete('/:id/expenses/:expenseId', checkPermission('projects', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', req.params.expenseId);

    if (error) throw error;
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get project invoices (income from invoices linked to this project)
router.get('/:id/invoices', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customer:customers!invoices_customer_id_fkey(company_name, contact_person), payments:payments(*)')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalInvoiced = data?.reduce((s, inv) => s + Number(inv.total_amount), 0) || 0;
    const totalPaid = data?.reduce((s, inv) => s + Number(inv.paid_amount), 0) || 0;

    res.json({
      data,
      summary: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_balance: totalInvoiced - totalPaid,
        invoice_count: data?.length || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project invoices' });
  }
});

// Get all project income summary (aggregated across all projects for Finance)
router.get('/income/summary', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, project_code, budget, recorded_revenue, status');

    const ids = projects?.map(p => p.id) || [];
    if (ids.length === 0) {
      res.json({ projects: [], total_invoiced: 0, total_paid: 0, total_recorded_revenue: 0 });
      return;
    }

    const { data: invoices } = await supabase
      .from('invoices')
      .select('project_id, total_amount, paid_amount')
      .in('project_id', ids);

    const invoiceMap: Record<string, { invoiced: number; paid: number }> = {};
    (invoices || []).forEach(inv => {
      if (!invoiceMap[inv.project_id]) invoiceMap[inv.project_id] = { invoiced: 0, paid: 0 };
      invoiceMap[inv.project_id].invoiced += Number(inv.total_amount);
      invoiceMap[inv.project_id].paid += Number(inv.paid_amount);
    });

    const result = (projects || []).map(p => ({
      ...p,
      total_invoiced: invoiceMap[p.id]?.invoiced || 0,
      total_paid: invoiceMap[p.id]?.paid || 0,
      total_balance: (invoiceMap[p.id]?.invoiced || 0) - (invoiceMap[p.id]?.paid || 0),
    }));

    res.json({
      projects: result,
      total_invoiced: result.reduce((s, p) => s + p.total_invoiced, 0),
      total_paid: result.reduce((s, p) => s + p.total_paid, 0),
      total_recorded_revenue: result.reduce((s, p) => s + Number(p.recorded_revenue || 0), 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project income summary' });
  }
});

// Get project financial summary (budget = profit target, net_profit = budget - expenses)
router.get('/:id/financials', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const [
      { data: expenses },
      { data: project },
    ] = await Promise.all([
      supabase.from('expenses').select('amount').eq('project_id', req.params.id),
      supabase.from('projects').select('*').eq('id', req.params.id).single(),
    ]);

    const totalExpenses = expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
    const budget = Number(project?.budget || 0);
    const netProfit = budget - totalExpenses;
    const recordedRevenue = Number(project?.recorded_revenue || 0);

    res.json({
      budget,               // Expected profit target
      total_expenses: totalExpenses,
      net_profit: netProfit, // Budget minus expenses
      recorded_revenue: recordedRevenue, // Final profit captured at completion
      is_completed: project?.status === 'completed',
      profit_margin: budget > 0 ? Math.round((netProfit / budget) * 100) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project financials' });
  }
});

// ============================================
// PROJECT FINANCIAL REPORT (PDF)
// ============================================

router.get('/:id/report', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const [projectRes, expensesRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('*, customer:customers!projects_customer_id_fkey(*), manager:users!projects_manager_id_fkey(first_name, last_name, email)').eq('id', req.params.id).single(),
      supabase.from('expenses').select('*').eq('project_id', req.params.id).order('expense_date', { ascending: false }),
      supabase.from('project_tasks').select('*').eq('project_id', req.params.id),
    ]);

    const project = projectRes.data;
    const expenses = expensesRes.data || [];
    const tasks = tasksRes.data || [];

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_code || project.name}-financial-report.pdf"`);
    doc.pipe(res);

    // Colors
    const primary = '#2563EB';
    const gray = '#6B7280';
    const dark = '#1F2937';
    const red = '#DC2626';
    const green = '#16A34A';

    // Header
    doc.fontSize(22).font('Helvetica-Bold').fillColor(primary).text('K-CONNECT TECHNOLOGIES', { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor(dark).text('Project Financial Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(gray).text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(1);

    // Separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    // Project Info
    doc.fontSize(16).font('Helvetica-Bold').fillColor(dark).text(project.name, { underline: false });
    doc.moveDown(0.3);

    const infoRows = [
      ['Project Code', project.project_code || '-'],
      ['Status', project.status?.replace('_', ' ').toUpperCase() || '-'],
      ['Category', project.category || '-'],
      ['Start Date', project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-'],
      ['End Date', project.end_date ? new Date(project.end_date).toLocaleDateString('en-GB') : '-'],
      ['Customer', project.customer?.company_name || project.customer?.contact_person || '-'],
      ['Project Manager', project.manager ? `${project.manager.first_name} ${project.manager.last_name}` : '-'],
    ];

    const colX = 50;
    let y = doc.y;
    doc.fontSize(9).font('Helvetica');
    for (const [label, value] of infoRows) {
      doc.fillColor(gray).text(label, colX, y, { width: 120, continued: true });
      doc.fillColor(dark).text(value, { width: 350 });
      y = doc.y + 3;
    }
    doc.y = y;
    doc.moveDown(1);

    // Separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    // Financial Summary
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const budget = Number(project.budget || 0);
    const netProfit = budget - totalExpenses;
    const recordedRevenue = Number(project.recorded_revenue || 0);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(dark).text('Financial Summary');
    doc.moveDown(0.5);

    const financialRows = [
      { label: 'Expected Profit (Budget)', value: budget, color: dark },
      { label: 'Total Expenses', value: totalExpenses, color: red },
      { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? green : red },
      { label: 'Recorded Revenue', value: recordedRevenue, color: primary },
    ];

    const fmt = (v: number) => `TSh${v.toLocaleString('en-US')}`;

    for (const row of financialRows) {
      doc.font('Helvetica').fillColor(gray).fontSize(10).text(row.label, colX, doc.y, { width: 200, continued: true });
      doc.font('Helvetica-Bold').fillColor(row.color).text(fmt(row.value), { align: 'right', width: 295 });
      doc.moveDown(0.4);
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(1);

    // Profit Margin Bar
    if (budget > 0) {
      const margin = Math.round((netProfit / budget) * 100);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(dark).text(`Profit Margin: ${margin}%`);
      doc.moveDown(0.3);
      const barY = doc.y;
      const barW = 300;
      doc.roundedRect(50, barY, barW, 12, 6).fillAndStroke('#E5E7EB', '#E5E7EB');
      const fillW = Math.max(0, Math.min((netProfit / budget) * barW, barW));
      doc.roundedRect(50, barY, fillW, 12, 6).fill(netProfit >= 0 ? green : red);
      doc.y = barY + 20;
      doc.moveDown(0.5);
    }

    // Task Summary
    if (tasks.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor(dark).text('Task Summary');
      doc.moveDown(0.3);
      const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
      doc.fontSize(10).font('Helvetica').fillColor(gray).text(`Total Tasks: ${tasks.length} | Completed: ${completedTasks} | Progress: ${Math.round((completedTasks / tasks.length) * 100)}%`);
      doc.moveDown(1);
    }

    // Expenses Detail
    if (expenses.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor(dark).text('Expenses Detail');
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const cols = [
        { x: 50, w: 80, label: 'Date' },
        { x: 130, w: 100, label: 'Category' },
        { x: 230, w: 200, label: 'Description' },
        { x: 430, w: 100, label: 'Amount', align: 'right' as const },
      ];

      doc.fontSize(9).font('Helvetica-Bold').fillColor(dark);
      for (const col of cols) {
        doc.text(col.label, col.x, tableTop, { width: col.w, align: col.align || 'left' });
      }
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.3);

      doc.fontSize(9).font('Helvetica').fillColor(dark);
      for (const exp of expenses) {
        const ey = doc.y;
        doc.text(exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('en-GB') : '-', 50, ey, { width: 80 });
        doc.text(exp.category || '-', 130, ey, { width: 100 });
        doc.text(exp.description || '-', 230, ey, { width: 200 });
        doc.text(fmt(Number(exp.amount)), 430, ey, { width: 100, align: 'right' });
        doc.moveDown(0.4);
      }

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.3);

      // Total row
      doc.font('Helvetica-Bold').fillColor(red);
      const totalY = doc.y;
      doc.text('Total Expenses', 50, totalY, { width: 380, align: 'right' });
      doc.text(fmt(totalExpenses), 430, totalY, { width: 100, align: 'right' });
      doc.moveDown(1);
    }

    // Footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor(gray).text(
      'K-CONNECT TECHNOLOGIES | This is a system-generated financial report.',
      { align: 'center' }
    );

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
