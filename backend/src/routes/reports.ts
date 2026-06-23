import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ============================================
// PROFIT & LOSS STATEMENT
// ============================================
router.get('/profit-loss', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [{ data: payments }, { data: expenses }, { data: projects }] = await Promise.all([
      supabase.from('payments').select('amount, payment_date').gte('payment_date', startDate).lte('payment_date', endDate),
      supabase.from('expenses').select('amount, category, expense_date, description').gte('expense_date', startDate).lte('expense_date', endDate),
      supabase.from('projects').select('id, budget, recorded_revenue, status').eq('status', 'completed'),
    ]);

    const totalPayments = payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

    let projectRevenue = 0;
    if (projects) {
      for (const p of projects) {
        if (p.recorded_revenue) {
          projectRevenue += Number(p.recorded_revenue);
        } else {
          const { data: exps } = await supabase.from('expenses').select('amount').eq('project_id', p.id);
          const totalExp = exps?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
          projectRevenue += Math.max(0, Number(p.budget || 0) - totalExp);
        }
      }
    }

    const totalRevenue = totalPayments + projectRevenue;
    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;

    const expenseByCategory = expenses?.reduce((acc: Record<string, number>, e: any) => {
      acc[e.category || 'other'] = (acc[e.category || 'other'] || 0) + Number(e.amount);
      return acc;
    }, {}) || {};

    const monthlyIncome: Record<number, number> = {};
    const monthlyExpenses: Record<number, number> = {};
    payments?.forEach(p => {
      const m = new Date(p.payment_date).getMonth();
      monthlyIncome[m] = (monthlyIncome[m] || 0) + Number(p.amount);
    });
    expenses?.forEach(e => {
      const m = new Date(e.expense_date).getMonth();
      monthlyExpenses[m] = (monthlyExpenses[m] || 0) + Number(e.amount);
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleString('default', { month: 'short' }),
      income: monthlyIncome[i] || 0,
      expenses: monthlyExpenses[i] || 0,
      profit: (monthlyIncome[i] || 0) - (monthlyExpenses[i] || 0),
    }));

    res.json({
      year,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      payment_revenue: totalPayments,
      project_revenue: projectRevenue,
      expense_by_category: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })),
      monthly,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profit & loss data' });
  }
});

// ============================================
// REVENUE ANALYSIS
// ============================================
router.get('/revenue', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [{ data: payments }, { data: invoices }] = await Promise.all([
      supabase.from('payments').select('amount, payment_date, invoice:invoices(invoice_number, customer:customers(company_name))').gte('payment_date', startDate).lte('payment_date', endDate).order('payment_date'),
      supabase.from('invoices').select('total_amount, status, invoice_date, customer:customers(company_name)').gte('invoice_date', startDate).lte('invoice_date', endDate).order('invoice_date'),
    ]);

    const totalRevenue = payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
    const outstandingInvoices = invoices?.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.total_amount), 0) || 0;

    const byCustomer = payments?.reduce((acc: Record<string, number>, p: any) => {
      const name = p.invoice?.customer?.company_name || 'Unknown';
      acc[name] = (acc[name] || 0) + Number(p.amount);
      return acc;
    }, {}) || {};

    const byMonth: Record<number, number> = {};
    payments?.forEach(p => {
      const m = new Date(p.payment_date).getMonth();
      byMonth[m] = (byMonth[m] || 0) + Number(p.amount);
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleString('default', { month: 'short' }),
      revenue: byMonth[i] || 0,
    }));

    res.json({
      year,
      total_revenue: totalRevenue,
      outstanding_invoices: outstandingInvoices,
      by_customer: Object.entries(byCustomer).map(([customer, amount]) => ({ customer, amount })).sort((a, b) => b.amount - a.amount),
      monthly,
      payment_count: payments?.length || 0,
      invoice_count: invoices?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// ============================================
// EXPENSE ANALYSIS
// ============================================
router.get('/expenses', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category, expense_date, description')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false });

    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;

    const byCategory = expenses?.reduce((acc: Record<string, { amount: number; count: number }>, e: any) => {
      const cat = e.category || 'other';
      if (!acc[cat]) acc[cat] = { amount: 0, count: 0 };
      acc[cat].amount += Number(e.amount);
      acc[cat].count += 1;
      return acc;
    }, {}) || {};

    const byMonth: Record<number, number> = {};
    expenses?.forEach(e => {
      const m = new Date(e.expense_date).getMonth();
      byMonth[m] = (byMonth[m] || 0) + Number(e.amount);
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleString('default', { month: 'short' }),
      amount: byMonth[i] || 0,
    }));

    const expenseList = expenses?.map(e => ({
      description: e.description || '',
      category: e.category || 'other',
      amount: Number(e.amount),
      date: e.expense_date,
    })) || [];

    res.json({
      year,
      total_expenses: totalExpenses,
      by_category: Object.entries(byCategory).map(([category, data]) => ({ category, ...data })).sort((a, b) => b.amount - a.amount),
      monthly,
      list: expenseList,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expense data' });
  }
});

// ============================================
// CUSTOMER LIST
// ============================================
router.get('/customers', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: customers } = await supabase
      .from('customers')
      .select('*, projects:projects(id, status, budget), invoices:invoices(id, total_amount, status)')
      .order('created_at', { ascending: false });

    if (!customers) {
      res.json({ data: [], total: 0 });
      return;
    }

    const list = customers.map(c => {
      const totalInvoiced = c.invoices?.reduce((s: number, i: any) => s + Number(i.total_amount), 0) || 0;
      const totalPaidQuery = c.invoices?.filter((i: any) => i.status === 'paid') || [];
      const totalPaid = totalPaidQuery.reduce((s: number, i: any) => s + Number(i.total_amount), 0);
      const activeProjects = c.projects?.filter((p: any) => p.status === 'in_progress' || p.status === 'planning').length || 0;

      return {
        id: c.id,
        company_name: c.company_name,
        contact_person: c.contact_person,
        email: c.email,
        phone: c.phone,
        city: c.city,
        total_projects: c.projects?.length || 0,
        active_projects: activeProjects,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        outstanding: totalInvoiced - totalPaid,
        created_at: c.created_at,
      };
    });

    res.json({ data: list, total: list.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer report' });
  }
});

// ============================================
// LEAD CONVERSION
// ============================================
router.get('/leads', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: leads } = await supabase.from('leads').select('*, customer:customers(company_name)').order('created_at', { ascending: false });

    if (!leads) {
      res.json({ total: 0, by_status: [], converted_count: 0, conversion_rate: 0 });
      return;
    }

    const byStatus = leads.reduce((acc: Record<string, number>, l: any) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    const total = leads.length;
    const convertedCount = leads.filter(l => l.status === 'won' && l.customer_id).length;
    const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

    const monthly: Record<string, { total: number; won: number }> = {};
    leads.forEach(l => {
      const m = new Date(l.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthly[m]) monthly[m] = { total: 0, won: 0 };
      monthly[m].total += 1;
      if (l.status === 'won') monthly[m].won += 1;
    });

    res.json({
      total,
      by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      converted_count: convertedCount,
      conversion_rate: conversionRate,
      monthly_trend: Object.entries(monthly).map(([month, data]) => ({ month, ...data })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead conversion data' });
  }
});

// ============================================
// CUSTOMER ACTIVITY
// ============================================
router.get('/customer-activity', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: customers } = await supabase.from('customers').select('id, company_name, contact_person, email, phone, city, created_at').order('created_at', { ascending: false });

    if (!customers) {
      res.json({ data: [], total: 0 });
      return;
    }

    const enriched = await Promise.all(customers.map(async c => {
      const [{ count: ticketCount }, { count: projectCount }, { count: invoiceCount }, { data: recentTickets }] = await Promise.all([
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('customer_id', c.id),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('customer_id', c.id),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('customer_id', c.id),
        supabase.from('support_tickets').select('subject, created_at, status').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(5),
      ]);

      return {
        id: c.id,
        company_name: c.company_name,
        contact_person: c.contact_person,
        email: c.email,
        phone: c.phone,
        city: c.city,
        total_tickets: ticketCount || 0,
        total_projects: projectCount || 0,
        total_invoices: invoiceCount || 0,
        recent_tickets: recentTickets || [],
        created_at: c.created_at,
      };
    }));

    res.json({ data: enriched, total: enriched.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer activity data' });
  }
});

// ============================================
// PROJECT STATUS
// ============================================
router.get('/projects', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: projects } = await supabase
      .from('projects')
      .select('*, customer:customers(company_name)')
      .order('created_at', { ascending: false });

    if (!projects) {
      res.json({ data: [], total: 0, by_status: [] });
      return;
    }

    const byStatus = projects.reduce((acc: Record<string, number>, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    const list = projects.map(p => ({
      id: p.id,
      name: p.name,
      customer: p.customer?.company_name || 'N/A',
      status: p.status,
      budget: Number(p.budget || 0),
      recorded_revenue: Number(p.recorded_revenue || 0),
      start_date: p.start_date,
      end_date: p.end_date,
      created_at: p.created_at,
    }));

    res.json({
      data: list,
      total: list.length,
      total_budget: list.reduce((s, p) => s + p.budget, 0),
      by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project report' });
  }
});

// ============================================
// PROJECT BUDGET vs ACTUAL
// ============================================
router.get('/project-budget', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: rawProjects } = await supabase.from('projects').select('id, name, budget, status, customer:customers(company_name)');

    if (!rawProjects) {
      res.json({ data: [], total: 0 });
      return;
    }

    const projects = rawProjects as any[];
    const enriched = await Promise.all(projects.map(async (p: any) => {
      const { data: exps } = await supabase.from('expenses').select('amount').eq('project_id', p.id);
      const actualCost = exps?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
      const budget = Number(p.budget || 0);
      const variance = budget - actualCost;
      const variancePct = budget > 0 ? Math.round((variance / budget) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        customer: p.customer?.company_name || 'N/A',
        status: p.status,
        budget,
        actual_cost: actualCost,
        variance,
        variance_pct: variancePct,
      };
    }));

    res.json({
      data: enriched,
      total: enriched.length,
      total_budget: enriched.reduce((s, p) => s + p.budget, 0),
      total_actual: enriched.reduce((s, p) => s + p.actual_cost, 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project budget data' });
  }
});

// ============================================
// RESOURCE ALLOCATION
// ============================================
router.get('/resource-allocation', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: users } = await supabase.from('users').select('id, first_name, last_name, email, role').neq('role', 'customer');

    if (!users) {
      res.json({ data: [], total: 0 });
      return;
    }

    const enriched = await Promise.all(users.map(async u => {
      const [{ data: rawTasks }, { count: projectCount }] = await Promise.all([
        supabase.from('project_tasks').select('id, title, project:projects(name), status, due_date').eq('assignee_id', u.id),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('assignee_id', u.id),
      ]);

      const tasks = (rawTasks || []) as any[];
      return {
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role,
        total_tasks: tasks.length,
        pending_tasks: tasks.filter(t => t.status !== 'done').length,
        completed_tasks: tasks.filter(t => t.status === 'done').length,
        projects_count: projectCount || 0,
        tasks: tasks.map(t => ({
          title: t.title,
          project: t.project?.name || 'N/A',
          status: t.status,
          due_date: t.due_date,
        })),
      };
    }));

    res.json({
      data: enriched,
      total: enriched.length,
      total_tasks: enriched.reduce((s, u) => s + u.total_tasks, 0),
      total_pending: enriched.reduce((s, u) => s + u.pending_tasks, 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resource allocation data' });
  }
});

// ============================================
// INVENTORY REPORT
// ============================================
router.get('/inventory', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: products } = await supabase
      .from('inventory')
      .select('*, category:inventory_categories(name)')
      .order('name');

    if (!products) {
      res.json({ data: [], total: 0, total_value: 0 });
      return;
    }

    const list = products.map(p => {
      const qty = Number(p.quantity || 0);
      const unitPrice = Number(p.unit_price || 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        category: p.category?.name || 'N/A',
        quantity: qty,
        unit_price: unitPrice,
        total_value: qty * unitPrice,
        min_stock: Number(p.min_stock || 0),
        status: qty <= 0 ? 'out_of_stock' : qty <= Number(p.min_stock || 0) ? 'low_stock' : 'in_stock',
      };
    });

    const totalValue = list.reduce((s, p) => s + p.total_value, 0);
    const lowStock = list.filter(p => p.status === 'low_stock').length;
    const outOfStock = list.filter(p => p.status === 'out_of_stock').length;

    res.json({
      data: list,
      total: list.length,
      total_value: totalValue,
      low_stock: lowStock,
      out_of_stock: outOfStock,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory report' });
  }
});

// ============================================
// ISP ANALYTICS
// ============================================
router.get('/isp', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const [{ data: packages }, { data: subscribers }, { data: billing }] = await Promise.all([
      supabase.from('isp_packages').select('*, subscribers:isp_subscribers(count)'),
      supabase.from('isp_subscribers').select('*, package:isp_packages(name)'),
      supabase.from('isp_billing').select('*, subscriber:isp_subscribers(name, package:isp_packages(name))').order('due_date', { ascending: false }),
    ]);

    const totalSubscribers = subscribers?.length || 0;
    const activeSubscribers = subscribers?.filter((s: any) => s.status === 'active').length || 0;
    const totalRevenue = billing?.reduce((s: number, b: any) => s + Number(b.amount || 0), 0) || 0;
    const totalCollected = billing?.filter((b: any) => b.status === 'paid').reduce((s: number, b: any) => s + Number(b.amount || 0), 0) || 0;
    const outstanding = totalRevenue - totalCollected;

    const packageStats = packages?.map((p: any) => ({
      name: p.name,
      speed: p.speed,
      price: Number(p.price || 0),
      type: p.type,
      subscriber_count: p.subscribers?.length || 0,
    })) || [];

    res.json({
      total_subscribers: totalSubscribers,
      active_subscribers: activeSubscribers,
      total_revenue: totalRevenue,
      total_collected: totalCollected,
      outstanding,
      packages: packageStats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ISP analytics' });
  }
});

// ============================================
// SUPPORT REPORT
// ============================================
router.get('/tickets', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('*, customer:customers(company_name), assignee:users(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (!tickets) {
      res.json({ data: [], total: 0, by_status: [], by_priority: [] });
      return;
    }

    const byStatus = tickets.reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    const byPriority = tickets.reduce((acc: Record<string, number>, t: any) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});

    const openTickets = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const resolutionRate = tickets.length > 0 ? Math.round((resolvedTickets / tickets.length) * 100) : 0;

    const list = tickets.map(t => ({
      id: t.id,
      subject: t.subject,
      customer: t.customer?.company_name || 'N/A',
      assignee: t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : 'Unassigned',
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
      due_date: t.due_date,
    }));

    res.json({
      data: list,
      total: list.length,
      open_tickets: openTickets,
      resolved_tickets: resolvedTickets,
      resolution_rate: resolutionRate,
      by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      by_priority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch support report' });
  }
});

// ============================================
// EMPLOYEE REPORT
// ============================================
router.get('/employees', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: users } = await supabase.from('users').select('id, first_name, last_name, email, role, department, status').neq('role', 'customer');

    if (!users) {
      res.json({ data: [], total: 0 });
      return;
    }

    const enriched = await Promise.all(users.map(async u => {
      const [{ count: attendanceCount, data: attendanceData }, { data: leaves }] = await Promise.all([
        supabase.from('attendance').select('*', { count: 'exact' }).eq('user_id', u.id).gte('date', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]),
        supabase.from('leave_requests').select('status, start_date, end_date').eq('employee_id', u.id).order('created_at', { ascending: false }).limit(10),
      ]);

      const presentDays = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalAttendance = attendanceCount || 0;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentDays / totalAttendance) * 100) : 0;
      const pendingLeave = leaves?.filter(l => l.status === 'pending').length || 0;

      return {
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role,
        department: u.department || 'N/A',
        status: u.status,
        attendance_rate: attendanceRate,
        present_days: presentDays,
        total_attendance: totalAttendance,
        pending_leaves: pendingLeave,
        recent_leaves: leaves?.slice(0, 3) || [],
      };
    }));

    res.json({
      data: enriched,
      total: enriched.length,
      average_attendance: enriched.length > 0 ? Math.round(enriched.reduce((s, u) => s + u.attendance_rate, 0) / enriched.length) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee report' });
  }
});

export default router;
