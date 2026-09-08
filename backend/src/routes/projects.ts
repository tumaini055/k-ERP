import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateProjectCode, generateHandoverNumber } from '../utils/helpers';

const router = Router();

const handoverPhotosDir = (projectId: string) => path.join(__dirname, '../../uploads/handovers', projectId);

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = handoverPhotosDir((_req as AuthRequest).params.id);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `photo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp|bmp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function listHandoverPhotos(projectId: string): string[] {
  const dir = handoverPhotosDir(projectId);
  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
    return files.sort();
  } catch {
    return [];
  }
}

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

    try { const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png')); const ss = Math.min(120 / s.width, 120 / s.height); const sw = s.width * ss, sh = s.height * ss; doc.save(); doc.translate(doc.page.width - 50 - sw, doc.page.height - 70 - sh); doc.rotate(-6, { origin: [sw / 2, sh / 2] }); doc.image(s, 0, 0, { width: sw, height: sh }); doc.restore(); } catch (_) {}

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ============================================
// PROJECT HANDOVER DOCUMENT (PDF)
// ============================================

async function resolveCompanyId(userId: string, currentCompanyId?: string): Promise<string | null> {
  if (currentCompanyId) return currentCompanyId;
  const { data: company } = await supabase.from('companies').select('id').limit(1).single();
  if (company?.id) return company.id;
  return null;
}

// Upload handover photos for a project (stores images on disk; replaces previous set)
router.post(
  '/:id/handover/photos',
  checkPermission('projects', 'canEdit'),
  (req: AuthRequest, _res: Response, next) => {
    // Clear any previous photos BEFORE multer writes the new ones
    const dir = handoverPhotosDir(req.params.id);
    if (fs.existsSync(dir)) {
      const olds = fs.readdirSync(dir).filter((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
      for (const f of olds) {
        try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
      }
    }
    next();
  },
  photoUpload.array('photos', 4),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      res.status(200).json({
        photos: files.map((f) => `/uploads/handovers/${req.params.id}/${path.basename(f.path)}`),
        count: files.length,
      });
    } catch (error) {
      console.error('Handover photo upload error:', error);
      res.status(500).json({ error: 'Failed to upload handover photos', detail: (error as any)?.message || String(error) });
    }
  }
);

// List stored handover photos for a project
router.get('/:id/handover/photos', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  const files = listHandoverPhotos(req.params.id);
  res.status(200).json({ photos: files.map((f) => `/uploads/handovers/${req.params.id}/${f}`) });
});

router.get('/:id/handover', checkPermission('projects', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const projectRes = await supabase
      .from('projects')
      .select('*, customer:customers!projects_customer_id_fkey(*), manager:users!projects_manager_id_fkey(first_name, last_name, email, phone)')
      .eq('id', req.params.id)
      .single();

    const project = projectRes.data;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Find the quotation for this project.
    // Priority: explicit quotation_id param -> linked via project_id -> latest quotation of the same customer.
    let quotation: any = null;

    const requestedQuotationId = (req.query.quotation_id as string) || null;
    if (requestedQuotationId) {
      const { data: qByParam } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', requestedQuotationId)
        .eq('invoice_type', 'quotation')
        .single();
      quotation = qByParam;
    }

    if (!quotation) {
      const { data: qByProject } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', req.params.id)
        .eq('invoice_type', 'quotation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      quotation = qByProject;
    }

    if (!quotation && project.customer_id) {
      const { data: qByCustomer } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', project.customer_id)
        .eq('invoice_type', 'quotation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      quotation = qByCustomer;
    }

    let items: any[] = [];
    if (quotation) {
      const { data: quotationItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', quotation.id)
        .order('sort_order');
      items = quotationItems || [];
    }

    // Company branding
    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let logoUrl = '';
    let taxId = '';
    let currencySymbol = 'TSh ';
    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);
    if (companyId) {
      const { data: cs } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      if (cs?.settings) {
        const s = cs.settings;
        if (s.company_name) companyName = s.company_name;
        if (s.company_email) companyEmail = s.company_email;
        if (s.company_website) companyWebsite = s.company_website;
        if (s.company_address) companyAddress = s.company_address;
        if (s.company_phone) companyPhone = s.company_phone;
        if (s.logo_url) logoUrl = s.logo_url;
        if (s.tax_id) taxId = s.tax_id;
        if (s.currency === 'USD') currencySymbol = '$ ';
        else if (s.currency === 'EUR') currencySymbol = '€ ';
        else if (s.currency === 'GBP') currencySymbol = '£ ';
        else if (s.currency === 'KES' || s.currency === 'UGX') currencySymbol = `${s.currency} `;
        else currencySymbol = 'TSh ';
      }
    }

    const handoverNumber = generateHandoverNumber();
    const handoverDate = new Date().toISOString().split('T')[0];
    const fullName = (m: any) => [m?.first_name, m?.last_name].map((s: any) => (s || '').trim()).filter(Boolean).join(' ');
    const handedBy = fullName(project.manager) || fullName(req.user) || '';
    const handedByVal = () => handedBy;
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_code || project.name}-handover.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    const brand = '#dc2626';
    const dark = '#111827';
    const gray = '#4b5563';
    const lightText = '#6b7280';
    const lineColor = '#e5e7eb';
    let y = 0;

    // ============ TOP RED BANNER ============
    doc.rect(0, 0, doc.page.width, 48).fill(brand);
    doc.fillColor('#fff').fontSize(17).font('Helvetica-Bold')
      .text('SITE COMPLETION & CUSTOMER HANDOVER FORM', lm, 15, { align: 'center', width: pw });
    y = 68;

    // ============ HEADER: Logo + Company Info / Reference ============
    const addrParts = companyAddress ? companyAddress.split(',').map((s) => s.trim()) : [];
    const addrLine1 = addrParts.length > 0 ? addrParts[0] : '';
    const addrLine2 = addrParts.length > 1 ? addrParts.slice(1).join(', ') : '';

    let logoWidth = 0;
    let logoHeight = 0;
    const logoY = y;
    if (logoUrl) {
      try {
        const logoPath = logoUrl.startsWith('/uploads') ? path.join(__dirname, '../..', logoUrl) : logoUrl;
        const img = doc.openImage(logoPath);
        const maxLogoW = 68;
        const maxLogoH = 58;
        const scale = Math.min(maxLogoW / img.width, maxLogoH / img.height);
        logoWidth = img.width * scale;
        logoHeight = img.height * scale;
        doc.image(img, lm, logoY, { width: logoWidth, height: logoHeight });
      } catch (_e) { /* skip */ }
    }

    const refBoxW = 220;
    const refBoxX = rm - refBoxW;
    const ciX = logoWidth > 0 ? lm + logoWidth + 14 : lm;
    const ciY = logoWidth > 0 ? logoY + 2 : logoY;
    const maxCiWidth = refBoxX - ciX - 14;

    doc.fontSize(15).font('Helvetica-Bold').fillColor(dark).text(companyName, ciX, ciY, { width: maxCiWidth });
    const nameH = doc.heightOfString(companyName, { width: maxCiWidth });
    let ciBottom = ciY + nameH + 6;

    doc.fontSize(8.5).font('Helvetica').fillColor(gray);
    const ciLines = [];
    if (addrLine1) ciLines.push(addrLine1);
    if (addrLine2) ciLines.push(addrLine2);
    if (companyPhone) ciLines.push(companyPhone);
    if (companyEmail) ciLines.push(companyEmail);
    if (taxId) ciLines.push(`TIN: ${taxId}`);
    for (const line of ciLines) {
      doc.text(line, ciX, ciBottom, { width: maxCiWidth });
      ciBottom += Math.max(doc.heightOfString(line, { width: maxCiWidth }), 11) + 2;
    }
    const leftEndY = Math.max(ciBottom, logoY + (logoHeight || 0) + 5);

    // Reference box (top-right)
    const refBoxY = y + 2;
    const refPad = 8;
    const refInnerW = refBoxW - refPad * 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 62).fill('#fef2f2').strokeColor(brand).lineWidth(0.5).stroke();
    doc.fillColor(brand).fontSize(9).font('Helvetica-Bold').text('HANDOVER DOCUMENT', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor(dark).font('Helvetica').fontSize(11).text(handoverNumber, refBoxX + refPad, refBoxY + 20, { width: refInnerW });
    let refRowY = refBoxY + 37;
    doc.fillColor(lightText).fontSize(8);
    doc.text(`Date: ${new Date(handoverDate).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
    refRowY += 11;
    doc.text(`Project: ${project.project_code || ''}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 62;
    y = Math.max(leftEndY, rightEndY) + 14;

    // ============ HELPERS ============
    const ensure = (need: number) => {
      if (y + need > doc.page.height - 60) { doc.addPage(); y = 45; }
    };
    const sectionTitle = (text: string) => {
      ensure(28);
      doc.roundedRect(lm, y, pw, 18, 2).fill(brand);
      doc.fillColor('#fff').fontSize(9.5).font('Helvetica-Bold').text(text, lm + 10, y + 4, { width: pw - 20 });
      y += 24;
    };
    const labelValue = (label: string, value: string) => {
      ensure(16);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text(label, lm, y, { width: 150 });
      doc.font('Helvetica').fontSize(8).fillColor(dark);
      doc.text(value || '____________________', lm + 155, y, { width: pw - 155 });
      y += 15;
    };
    const blankLine = () => {
      ensure(14);
      doc.moveTo(lm, y + 7).lineTo(rm, y + 7).strokeColor(lineColor).lineWidth(0.5).stroke();
      y += 14;
    };
    const checkboxRow = (label: string, options: string[]) => {
      ensure(15);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text(label, lm, y, { width: 150 });
      doc.font('Helvetica').fontSize(8).fillColor(dark);
      let ox = lm + 155;
      for (const o of options) {
        doc.text(`[ ] ${o}`, ox, y, { width: 95 });
        ox += 98;
      }
      y += 15;
    };

    // ============ 1. WORK / VISIT INFORMATION ============
    sectionTitle('1. WORK / VISIT INFORMATION');
    checkboxRow('Type of Work', ['New Installation', 'Relocation', 'Upgrade', 'Replacement']);
    labelValue('Work Start Date', project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '');
    labelValue('Completion Date', (project.actual_end_date || project.end_date) ? new Date(project.actual_end_date || project.end_date).toLocaleDateString('en-GB') : '');
    labelValue('Work Order / Reference', quotation?.invoice_number || '');
    doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text('Scope Requested', lm, y, { width: 150 });
    doc.font('Helvetica').fontSize(8).fillColor(dark);
    const scopeText = project.description || project.name || '';
    doc.text(scopeText, lm + 155, y, { width: pw - 155 });
    y += Math.max(doc.heightOfString(scopeText, { width: pw - 155 }), 12) + 8;

    // ============ 2. CUSTOMER & SITE DETAILS ============
    sectionTitle('2. CUSTOMER & SITE DETAILS');
    labelValue('Customer / Company Name', project.customer?.company_name || project.customer?.contact_person || '');
    labelValue('Site Name / Branch', project.customer?.city || project.customer?.region || '');
    labelValue('Physical Site Address', project.customer?.address || '');
    labelValue('Customer Email', project.customer?.email || '');
    labelValue('Customer Phone', project.customer?.phone || '');

    // ============ 3. WORK COMPLETED / INSTALLATION DETAILS ============
    sectionTitle('3. WORK COMPLETED / INSTALLATION DETAILS');
    {
      const cw = [26, 300, 50, 124];
      const cx = [lm, lm + 26, lm + 326, lm + 376];
      doc.fontSize(8).font('Helvetica-Bold').fillColor(dark);
      ['No.', 'Activity / Equipment / System', 'Qty.', 'Status'].forEach((h, i) => doc.text(h, cx[i], y, { width: cw[i] }));
      y += 4;
      doc.moveTo(lm, y + 9).lineTo(rm, y + 9).strokeColor(dark).lineWidth(0.5).stroke();
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor(dark);
      for (let idx = 1; idx <= 8; idx++) {
        ensure(15);
        doc.text(String(idx), cx[0], y, { width: cw[0] });
        doc.moveTo(cx[1], y + 8).lineTo(cx[3] + cw[3] - 4, y + 8).strokeColor(lineColor).lineWidth(0.5).stroke();
        doc.text(' ', cx[2], y, { width: cw[2] });
        doc.text('[ ] Complete   [ ] N/A', cx[3], y, { width: cw[3] });
        y += 15;
      }
      y += 2;
      doc.moveTo(lm, y).lineTo(rm, y).strokeColor(lineColor).lineWidth(0.5).stroke();
      y += 12;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text('Installation / Relocation Description', lm, y, { width: 180 });
      doc.font('Helvetica').fontSize(8).fillColor(dark);
      const instDesc = project.description || project.name || '';
      doc.text(instDesc, lm + 188, y, { width: pw - 188 });
      y += Math.max(doc.heightOfString(instDesc, { width: pw - 188 }), 12) + 10;
      blankLine();
      blankLine();
    }

    // ============ 4. MATERIALS / COMPONENTS USED ============
    sectionTitle('4. MATERIALS / COMPONENTS USED');
    {
      const cw = [280, 150, 50];
      const cx = [lm, lm + 280, lm + 430];
      doc.fontSize(8).font('Helvetica-Bold').fillColor(dark);
      ['Item / Material', 'Specification / Model', 'Qty.'].forEach((h, i) => doc.text(h, cx[i], y, { width: cw[i] }));
      y += 4;
      doc.moveTo(lm, y + 9).lineTo(rm, y + 9).strokeColor(dark).lineWidth(0.5).stroke();
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor(dark);
      if (items.length === 0) {
        doc.text('No quotation items found for this project.', lm, y, { width: pw });
        y += 15;
      } else {
        for (const it of items) {
          ensure(14);
          const desc = it.description || '';
          doc.text(desc, cx[0], y, { width: cw[0] - 4, height: 11, ellipsis: true });
          doc.text('', cx[1], y, { width: cw[1] - 4 });
          doc.text(String(Number(it.quantity || 0).toLocaleString('en-US')), cx[2], y, { width: cw[2] });
          y += 14;
        }
      }
      y += 2;
      doc.moveTo(lm, y).lineTo(rm, y).strokeColor(lineColor).lineWidth(0.5).stroke();
      y += 12;
    }

    // ============ 5. TESTING & COMMISSIONING ============
    sectionTitle('5. TESTING & COMMISSIONING');
    {
      const tests = ['Power / Electrical Supply', 'Equipment / System Startup', 'Network / Connectivity', 'Functional / Operational Test', 'Configuration / Programming', 'Customer Demonstration'];
      for (const t of tests) {
        ensure(15);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text(t, lm, y, { width: 190 });
        doc.font('Helvetica').fontSize(8).fillColor(dark);
        const opts = t === 'Customer Demonstration' ? '[x] Completed   [ ] N/A' : '[ ] Pass   [ ] Fail   [ ] N/A';
        doc.text(opts, lm + 200, y, { width: pw - 200 });
        y += 15;
      }
    }

    // ============ 6. SITE CONDITION, EXCEPTIONS & OUTSTANDING ============
    sectionTitle('6. SITE CONDITION, EXCEPTIONS & OUTSTANDING ITEMS');
    labelValue('Site Condition / Existing Issues', '');
    blankLine();
    labelValue('Outstanding Works / Exceptions / Constraints', '');
    blankLine();
    labelValue('Recommendations / Follow-up Required', '');
    blankLine();

    // ============ 7. PHOTO / EVIDENCE RECORD ============
    sectionTitle('7. PHOTO / EVIDENCE RECORD');
    {
      const photos = ['Photo 1 - Before / Existing Condition', 'Photo 2 - Completed Installation', 'Photo 3 - Equipment / Serial / Labelling', 'Photo 4 - Final Site Condition'];
      const ph = 58;
      const phW = pw / 2 - 10;
      const labelsH = 12;
      const photoFiles = listHandoverPhotos(project.id);
      const photoImg: Array<any> = [];
      for (const pf of photoFiles) {
        if (photoImg.length >= 4) break;
        try {
          const loaded = doc.openImage(path.join(handoverPhotosDir(project.id), pf));
          photoImg.push(loaded);
        } catch { /* skip unreadable */ }
      }
      const totalH = (ph + labelsH) * 2 + 14;
      ensure(totalH);
      const baseY = y;
      const boxes: Array<[number, number, any | null]> = [];
      for (let i = 0; i < 4; i++) {
        const px = i % 2 === 0 ? lm : lm + phW + 10;
        const py = i < 2 ? baseY : baseY + (ph + labelsH) + 14;
        boxes.push([px, py, photoImg.length > 0 ? photoImg[Math.min(i, photoImg.length - 1)] : null]);
      }
      for (let i = 0; i < 4; i++) {
        const [px, py, img] = boxes[i];
        doc.roundedRect(px, py, phW, ph, 2).strokeColor(lineColor).lineWidth(0.5).stroke();
        if (img) {
          const imgW = img.width;
          const imgH = img.height;
          const scale = Math.min((phW - 4) / imgW, (ph - 4) / imgH);
          const w = imgW * scale;
          const h = imgH * scale;
          try {
            doc.image(img, px + (phW - w) / 2, py + (ph - h) / 2, { width: w, height: h });
          } catch { /* skip draw failure */ }
        }
        doc.fontSize(8).font('Helvetica').fillColor(lightText).text(photos[i] + (img ? '  [x]' : ''), px + 4, py + ph + 1, { width: phW - 8 });
      }
      y = baseY + (ph + labelsH) * 2 + 16;
    }

    // ============ 8. CUSTOMER ACCEPTANCE & HANDOVER ============
    sectionTitle('8. CUSTOMER ACCEPTANCE & HANDOVER');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(dark).text('Customer Acceptance Statement', lm, y, { width: pw });
    y += 13;
    doc.font('Helvetica').fontSize(8).fillColor(dark);
    const stmt = 'I confirm that the above work has been completed as described, the system/equipment has been demonstrated and tested where applicable, and the site has been handed over. Any outstanding items are recorded in Section 6.';
    doc.text(stmt, lm, y, { width: pw });
    y += doc.heightOfString(stmt, { width: pw }) + 14;
    labelValue('Customer Comments', '');
    blankLine();

    {
      ensure(70);
      const sigY = y + 6;
      const sigW = pw / 2 - 10;
      const sig = (title: string, name: string, x: number) => {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(dark).text(title, x, sigY, { width: sigW });
        doc.moveTo(x, sigY + 26).lineTo(x + sigW, sigY + 26).strokeColor(dark).lineWidth(0.5).stroke();
        doc.fontSize(8).font('Helvetica').fillColor(dark);
        doc.text(`Name: ${name}`, x, sigY + 30, { width: sigW });
        doc.text(`Date: ____ / ____ / ______`, x, sigY + 44, { width: sigW });
      };
      sig('K-Connect Technician / Engineer', handedByVal(), lm);
      sig('Customer / Site Manager', '', lm + sigW + 10);
      y = sigY + 68;
    }

    // ============ 9. INTERNAL APPROVAL ============
    sectionTitle('9. INTERNAL APPROVAL');
    ensure(30);
    labelValue('Reviewed By (Supervisor / Project Manager)', fullName(project.manager));
    labelValue('Remarks', '');
    blankLine();

    // Final Status checkboxes - laid out in one clean row
    ensure(20);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text('Final Status', lm, y, { width: 150 });
    doc.font('Helvetica').fontSize(8).fillColor(dark);
    const fsOps: Array<[string, string]> = [
      ['[ ] Completed & Accepted', '190'],
      ['[ ] Completed w/ Outstanding', '190'],
      ['[ ] Revisit Required', '120'],
    ];
    let fx = lm + 155;
    for (const [op, w] of fsOps) {
      doc.text(op, fx, y, { width: Number(w) });
      fx += Number(w);
    }
    y += 15;

    // Approval signature - clean two-column layout with proper spacing
    ensure(34);
    const apprY = y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(dark).text('Approval Signature', lm, apprY, { width: 200 });
    doc.moveTo(lm, apprY + 18).lineTo(lm + 330, apprY + 18).strokeColor(dark).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(dark).text('Date', lm + 360, apprY, { width: 60 });
    doc.moveTo(lm + 360, apprY + 18).lineTo(rm, apprY + 18).strokeColor(dark).lineWidth(0.5).stroke();
    doc.text(new Date(handoverDate).toLocaleDateString('en-GB'), lm + 360, apprY + 22, { width: 60 });
    y = apprY + 40;

    // Document control note
    ensure(24);
    doc.fontSize(7).font('Helvetica').fillColor(lightText);
    const control = 'Document Control: This form should be completed for each installation, relocation, upgrade or other site work and retained with the project/job records. Attach supporting photographs, test results and relevant equipment/asset records where applicable.';
    doc.text(control, lm, y, { width: pw });
    y += doc.heightOfString(control, { width: pw }) + 10;

    // ============ FOOTER (brand bar + stamp) ============
    y += 14;
    if (y + 32 > doc.page.height - 45) { doc.addPage(); y = 45; }
    const footY = y;
    doc.rect(0, footY - 6, doc.page.width, 32).fill(brand);
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica');
    const footerParts = [companyName];
    if (companyEmail) footerParts.push(companyEmail);
    if (companyWebsite) footerParts.push(companyWebsite);
    doc.text(footerParts.join('  |  '), lm, footY + 3, { align: 'center', width: pw });
    doc.text(`Handover #${handoverNumber}  |  Generated ${new Date().toLocaleDateString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    try { const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png')); const ss = Math.min(120 / s.width, 120 / s.height); const sw = s.width * ss, sh = s.height * ss; doc.save(); doc.translate(doc.page.width - 50 - sw, footY - 16 - sh); doc.rotate(-6, { origin: [sw / 2, sh / 2] }); doc.image(s, 0, 0, { width: sw, height: sh }); doc.restore(); } catch (_) {}

    doc.end();

    // Persist a record of the handover (best-effort, non-blocking)
    try {
      const { data: hoDoc, error: hoErr } = await supabase.from('handover_documents').insert({
        handover_number: handoverNumber,
        project_id: project.id,
        customer_id: project.customer_id,
        quotation_id: quotation?.id || null,
        handover_date: handoverDate,
        prepared_by: req.user!.id,
        handed_over_by_name: handedBy,
        generated_by: req.user!.id,
        company_id: companyId,
      }).select('id').single();

      const hoId = (hoDoc as any)?.id;
      if (!hoErr && hoId && items.length > 0) {
        const hoItems = items.map((it, idx) => ({
          handover_document_id: hoId,
          description: it.description || '',
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || 0),
          status: 'delivered',
          sort_order: idx,
        }));
        await supabase.from('handover_document_items').insert(hoItems);
      }
    } catch (_e) { /* ignore persistence errors so PDF still downloads */ }
  } catch (error) {
    console.error('Handover generation error:', error);
    res.status(500).json({ error: 'Failed to generate handover document', detail: (error as any)?.message || String(error) });
  }
});

export default router;
