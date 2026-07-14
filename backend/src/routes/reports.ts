import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

async function resolveCompanyId(userId: string, currentCompanyId?: string): Promise<string | null> {
  if (currentCompanyId) return currentCompanyId;
  const { data: company } = await supabase.from('companies').select('id').limit(1).single();
  if (company?.id) {
    await supabase.from('users').update({ company_id: company.id }).eq('id', userId);
    return company.id;
  }
  return null;
}

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
      supabase.from('payments').select('amount, payment_date, invoice:invoices(invoice_number, customer:customers!invoices_customer_id_fkey(company_name))').gte('payment_date', startDate).lte('payment_date', endDate).order('payment_date'),
      supabase.from('invoices').select('total_amount, status, invoice_date, customer:customers!invoices_customer_id_fkey(company_name)').gte('invoice_date', startDate).lte('invoice_date', endDate).order('invoice_date'),
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
    const { data: leads } = await supabase.from('leads').select('*, customer:customers!leads_customer_id_fkey(company_name)').order('created_at', { ascending: false });

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
      .select('*, customer:customers!projects_customer_id_fkey(company_name)')
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
    const { data: rawProjects } = await supabase.from('projects').select('id, name, budget, status, customer:customers!projects_customer_id_fkey(company_name)');

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
      .select('*, customer:customers!support_tickets_customer_id_fkey(company_name), assignee:users!support_tickets_assigned_to_fkey(first_name, last_name)')
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
        supabase.from('leave_requests').select('status, start_date, end_date').eq('user_id', u.id).order('created_at', { ascending: false }).limit(10),
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

// ============================================
// FLEXIBLE FINANCIAL REPORT (Daily / Weekly / Monthly / Yearly)
// ============================================
router.get('/financial', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'monthly';
    const now = new Date();
    let startDate: string;
    let endDateExclusive: string;

    if (req.query.start_date && req.query.end_date) {
      startDate = String(req.query.start_date);
      const end = new Date(String(req.query.end_date));
      end.setDate(end.getDate() + 1);
      endDateExclusive = end.toISOString().slice(0, 10);
    } else if (period === 'daily') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = d.toISOString().slice(0, 10);
      endDateExclusive = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
      const nextMonday = new Date(monday.getTime() + 7 * 86400000);
      startDate = monday.toISOString().slice(0, 10);
      endDateExclusive = nextMonday.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      const m = req.query.month != null ? Number(req.query.month) : now.getMonth();
      const y = Number(req.query.year) || now.getFullYear();
      startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const nextMonthFirst = new Date(y, m + 1, 1);
      endDateExclusive = nextMonthFirst.toISOString().slice(0, 10);
    } else {
      const y = Number(req.query.year) || now.getFullYear();
      startDate = `${y}-01-01`;
      endDateExclusive = `${y + 1}-01-01`;
    }

    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);

    let paymentsQuery = supabase.from('payments').select('amount, payment_date').gte('payment_date', startDate).lt('payment_date', endDateExclusive);
    let expensesQuery = supabase.from('expenses').select('amount, category, expense_date, description').gte('expense_date', startDate).lt('expense_date', endDateExclusive);
    if (companyId) {
      paymentsQuery = paymentsQuery.eq('company_id', companyId);
      expensesQuery = expensesQuery.eq('company_id', companyId);
    }

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      paymentsQuery,
      expensesQuery,
    ]);

    const displayEndDate = new Date(new Date(endDateExclusive).getTime() - 86400000).toISOString().slice(0, 10);

    const totalIncome = payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
    const netProfit = totalIncome - totalExpenses;

    const expenseByCategory = expenses?.reduce((acc: Record<string, number>, e: any) => {
      acc[e.category || 'other'] = (acc[e.category || 'other'] || 0) + Number(e.amount);
      return acc;
    }, {}) || {};

    let periods: { label: string; income: number; expenses: number; profit: number }[] = [];

    if (period === 'daily') {
      const incomeByHour: Record<number, number> = {};
      const expenseByHour: Record<number, number> = {};
      payments?.forEach((p: any) => { const h = new Date(p.payment_date).getHours(); incomeByHour[h] = (incomeByHour[h] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const h = new Date(e.expense_date).getHours(); expenseByHour[h] = (expenseByHour[h] || 0) + Number(e.amount); });
      periods = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        income: incomeByHour[h] || 0,
        expenses: expenseByHour[h] || 0,
        profit: (incomeByHour[h] || 0) - (expenseByHour[h] || 0),
      }));
    } else if (period === 'weekly') {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const incomeByDay: Record<number, number> = {};
      const expenseByDay: Record<number, number> = {};
      payments?.forEach((p: any) => {
        const d = new Date(p.payment_date);
        const dayIdx = (d.getDay() + 6) % 7;
        incomeByDay[dayIdx] = (incomeByDay[dayIdx] || 0) + Number(p.amount);
      });
      expenses?.forEach((e: any) => {
        const d = new Date(e.expense_date);
        const dayIdx = (d.getDay() + 6) % 7;
        expenseByDay[dayIdx] = (expenseByDay[dayIdx] || 0) + Number(e.amount);
      });
      periods = dayNames.map((name, i) => ({
        label: name,
        income: incomeByDay[i] || 0,
        expenses: expenseByDay[i] || 0,
        profit: (incomeByDay[i] || 0) - (expenseByDay[i] || 0),
      }));
    } else if (period === 'monthly') {
      const incomeByDay: Record<number, number> = {};
      const expenseByDay: Record<number, number> = {};
      payments?.forEach((p: any) => { const d = new Date(p.payment_date).getDate(); incomeByDay[d] = (incomeByDay[d] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const d = new Date(e.expense_date).getDate(); expenseByDay[d] = (expenseByDay[d] || 0) + Number(e.amount); });
      const startD = new Date(startDate).getDate();
      const endD = new Date(displayEndDate).getDate();
      for (let d = startD; d <= endD; d++) {
        periods.push({
          label: `Day ${d}`,
          income: incomeByDay[d] || 0,
          expenses: expenseByDay[d] || 0,
          profit: (incomeByDay[d] || 0) - (expenseByDay[d] || 0),
        });
      }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const incomeByMonth: Record<number, number> = {};
      const expenseByMonth: Record<number, number> = {};
      payments?.forEach((p: any) => { const m = new Date(p.payment_date).getMonth(); incomeByMonth[m] = (incomeByMonth[m] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const m = new Date(e.expense_date).getMonth(); expenseByMonth[m] = (expenseByMonth[m] || 0) + Number(e.amount); });
      periods = monthNames.map((name, i) => ({
        label: name,
        income: incomeByMonth[i] || 0,
        expenses: expenseByMonth[i] || 0,
        profit: (incomeByMonth[i] || 0) - (expenseByMonth[i] || 0),
      }));
    }

    const topExpenseCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, amount]) => ({ category, amount }));

    res.json({
      period,
      start_date: startDate,
      end_date: displayEndDate,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      expense_by_category: topExpenseCategories,
      periods,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch financial report' });
  }
});

// ============================================
// FINANCIAL REPORT PDF
// ============================================
router.get('/financial/pdf', checkPermission('reports', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'monthly';
    const now = new Date();
    let startDate: string;
    let endDateExclusive: string;
    let displayEndDate: string;

    if (req.query.start_date && req.query.end_date) {
      startDate = String(req.query.start_date);
      displayEndDate = String(req.query.end_date);
      const end = new Date(String(req.query.end_date));
      end.setDate(end.getDate() + 1);
      endDateExclusive = end.toISOString().slice(0, 10);
    } else if (period === 'daily') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = d.toISOString().slice(0, 10);
      endDateExclusive = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
      displayEndDate = startDate;
    } else if (period === 'weekly') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((dayOfWeek + 6) % 7));
      const nextMonday = new Date(monday.getTime() + 7 * 86400000);
      startDate = monday.toISOString().slice(0, 10);
      endDateExclusive = nextMonday.toISOString().slice(0, 10);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      displayEndDate = sunday.toISOString().slice(0, 10);
    } else if (period === 'monthly') {
      const m = req.query.month != null ? Number(req.query.month) : now.getMonth();
      const y = Number(req.query.year) || now.getFullYear();
      startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const nextMonthFirst = new Date(y, m + 1, 1);
      endDateExclusive = nextMonthFirst.toISOString().slice(0, 10);
      const lastDay = new Date(y, m + 1, 0).getDate();
      displayEndDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const y = Number(req.query.year) || now.getFullYear();
      startDate = `${y}-01-01`;
      endDateExclusive = `${y + 1}-01-01`;
      displayEndDate = `${y}-12-31`;
    }

    const pdfCompanyId = await resolveCompanyId(req.user!.id, req.user?.company_id);

    let paymentsQuery = supabase.from('payments').select('amount, payment_date').gte('payment_date', startDate).lt('payment_date', endDateExclusive);
    let expensesQuery = supabase.from('expenses').select('amount, category, expense_date, description').gte('expense_date', startDate).lt('expense_date', endDateExclusive);
    if (pdfCompanyId) {
      paymentsQuery = paymentsQuery.eq('company_id', pdfCompanyId);
      expensesQuery = expensesQuery.eq('company_id', pdfCompanyId);
    }

    const [{ data: payments }, { data: expenses }] = await Promise.all([
      paymentsQuery,
      expensesQuery,
    ]);

    const totalIncome = payments?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
    const netProfit = totalIncome - totalExpenses;

    const expenseByCategory: Record<string, number> = {};
    expenses?.forEach((e: any) => { expenseByCategory[e.category || 'other'] = (expenseByCategory[e.category || 'other'] || 0) + Number(e.amount); });

    let periods: { label: string; income: number; expenses: number; profit: number }[] = [];
    if (period === 'daily') {
      const incomeByHour: Record<number, number> = {};
      const expenseByHour: Record<number, number> = {};
      payments?.forEach((p: any) => { const h = new Date(p.payment_date).getHours(); incomeByHour[h] = (incomeByHour[h] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const h = new Date(e.expense_date).getHours(); expenseByHour[h] = (expenseByHour[h] || 0) + Number(e.amount); });
      periods = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, income: incomeByHour[h] || 0, expenses: expenseByHour[h] || 0, profit: (incomeByHour[h] || 0) - (expenseByHour[h] || 0) }));
    } else if (period === 'weekly') {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const incomeByDay: Record<number, number> = {};
      const expenseByDay: Record<number, number> = {};
      payments?.forEach((p: any) => { const dayIdx = (new Date(p.payment_date).getDay() + 6) % 7; incomeByDay[dayIdx] = (incomeByDay[dayIdx] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const dayIdx = (new Date(e.expense_date).getDay() + 6) % 7; expenseByDay[dayIdx] = (expenseByDay[dayIdx] || 0) + Number(e.amount); });
      periods = dayNames.map((name, i) => ({ label: name, income: incomeByDay[i] || 0, expenses: expenseByDay[i] || 0, profit: (incomeByDay[i] || 0) - (expenseByDay[i] || 0) }));
    } else if (period === 'monthly') {
      const incomeByDay: Record<number, number> = {};
      const expenseByDay: Record<number, number> = {};
      payments?.forEach((p: any) => { const d = new Date(p.payment_date).getDate(); incomeByDay[d] = (incomeByDay[d] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const d = new Date(e.expense_date).getDate(); expenseByDay[d] = (expenseByDay[d] || 0) + Number(e.amount); });
      const startD = new Date(startDate).getDate();
      const endD = new Date(displayEndDate).getDate();
      for (let d = startD; d <= endD; d++) { periods.push({ label: `Day ${d}`, income: incomeByDay[d] || 0, expenses: expenseByDay[d] || 0, profit: (incomeByDay[d] || 0) - (expenseByDay[d] || 0) }); }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const incomeByMonth: Record<number, number> = {};
      const expenseByMonth: Record<number, number> = {};
      payments?.forEach((p: any) => { const m = new Date(p.payment_date).getMonth(); incomeByMonth[m] = (incomeByMonth[m] || 0) + Number(p.amount); });
      expenses?.forEach((e: any) => { const m = new Date(e.expense_date).getMonth(); expenseByMonth[m] = (expenseByMonth[m] || 0) + Number(e.amount); });
      periods = monthNames.map((name, i) => ({ label: name, income: incomeByMonth[i] || 0, expenses: expenseByMonth[i] || 0, profit: (incomeByMonth[i] || 0) - (expenseByMonth[i] || 0) }));
    }

    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let taxId = '';
    let logoUrl = '';
    let currencySymbol = 'TSh ';
    if (pdfCompanyId) {
      const { data: cs } = await supabase.from('company_settings').select('settings').eq('company_id', pdfCompanyId).single();
      if (cs?.settings) {
        const s = cs.settings;
        if (s.company_name) companyName = s.company_name;
        if (s.company_email) companyEmail = s.company_email;
        if (s.company_website) companyWebsite = s.company_website;
        if (s.company_address) companyAddress = s.company_address;
        if (s.company_phone) companyPhone = s.company_phone;
        if (s.tax_id) taxId = s.tax_id;
        if (s.logo_url) logoUrl = s.logo_url;
        if (s.currency === 'USD') currencySymbol = '$ ';
        else if (s.currency === 'EUR') currencySymbol = '\u20AC ';
        else if (s.currency === 'GBP') currencySymbol = '\u00A3 ';
        else if (s.currency === 'KES' || s.currency === 'UGX') currencySymbol = `${s.currency} `;
        else currencySymbol = 'TSh ';
      }
    }

    const PDFDocument = require('pdfkit');
    const path = require('path');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const safeName = `financial-report-${period}-${startDate}-to-${displayEndDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    const fmt = (n: number) => `${currencySymbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

    // ============================================
    // PAGE NUMBER HELPER
    // ============================================
    let pageCount = 1;

    const startNewPage = () => {
      doc.addPage();
      pageCount++;
    };

    // ============================================
    // TOP COLORED BANNER
    // ============================================
    doc.rect(0, 0, doc.page.width, 48).fill('#1e3a5f');
    doc.fontSize(8).font('Helvetica').fillColor('#ffffff');
    doc.text(`${companyWebsite}  |  ${companyPhone}  |  ${companyEmail}`, lm, 16, { width: pw, align: 'center' });

    let y = 68;

    // ============================================
    // HEADER: Logo + Company Info (left) / Report Info (right)
    // ============================================
    const addrParts = companyAddress ? companyAddress.split(',').map((s: string) => s.trim()) : [];
    const addrLine1 = addrParts.length > 0 ? addrParts[0] : '';
    const addrLine2 = addrParts.length > 1 ? addrParts.slice(1).join(', ') : '';

    // --- Left side: Logo + Company info ---
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

    const refBoxW = 210;
    const refBoxX = rm - refBoxW;
    const ciX = logoWidth > 0 ? lm + logoWidth + 14 : lm;
    const ciY = logoWidth > 0 ? logoY + 2 : logoY;
    const maxCiWidth = refBoxX - ciX - 14;

    doc.fontSize(15).font('Helvetica-Bold').fillColor('#111827').text(companyName, ciX, ciY, { width: maxCiWidth });
    const nameH = doc.heightOfString(companyName, { width: maxCiWidth });
    let ciBottom = ciY + nameH + 6;

    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563');
    const ciLines: string[] = [];
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

    // --- Right side: Report reference box ---
    const refBoxY = y + 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill('#eef2ff').strokeColor('#1e3a5f').lineWidth(0.5).stroke();
    doc.fillColor('#1e3a5f').fontSize(9).font('Helvetica-Bold').text('FINANCIAL REPORT', refBoxX + 8, refBoxY + 6, { width: refBoxW - 16 });
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(periodLabel, refBoxX + 8, refBoxY + 20, { width: refBoxW - 16 });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    doc.text(`${startDate} to ${displayEndDate}`, refBoxX + 8, refRowY, { width: refBoxW - 16 });
    refRowY += 11;
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + 8, refRowY, { width: refBoxW - 16 });

    const rightEndY = refBoxY + 58;
    y = Math.max(leftEndY, rightEndY) + 16;

    // ============================================
    // DIVIDER
    // ============================================
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 14;

    // ============================================
    // SUMMARY CARDS
    // ============================================
    const cardW = (pw - 20) / 3;
    const cardH = 46;
    const cardGap = 10;

    // Income card
    doc.roundedRect(lm, y, cardW, cardH, 4).fill('#ecfdf5').strokeColor('#86efac').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#166534').text('TOTAL INCOME', lm + 10, y + 8, { width: cardW - 20 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#15803d').text(fmt(totalIncome), lm + 10, y + 22, { width: cardW - 20 });

    // Expenses card
    doc.roundedRect(lm + cardW + cardGap, y, cardW, cardH, 4).fill('#fef2f2').strokeColor('#fca5a5').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#991b1b').text('TOTAL EXPENSES', lm + cardW + cardGap + 10, y + 8, { width: cardW - 20 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#dc2626').text(fmt(totalExpenses), lm + cardW + cardGap + 10, y + 22, { width: cardW - 20 });

    // Net Profit card
    const profitColor = netProfit >= 0 ? '#15803d' : '#dc2626';
    const profitBg = netProfit >= 0 ? '#ecfdf5' : '#fef2f2';
    const profitBorder = netProfit >= 0 ? '#86efac' : '#fca5a5';
    doc.roundedRect(lm + 2 * (cardW + cardGap), y, cardW, cardH, 4).fill(profitBg).strokeColor(profitBorder).lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor(profitColor).text('NET PROFIT', lm + 2 * (cardW + cardGap) + 10, y + 8, { width: cardW - 20 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(profitColor).text(fmt(netProfit), lm + 2 * (cardW + cardGap) + 10, y + 22, { width: cardW - 20 });

    y += cardH + 18;

    // ============================================
    // HELPER: Draw a professional table
    // ============================================
    const drawProfessionalTable = (headers: string[], rows: string[][], startX: number, colWidths: number[], headerColor: string = '#1e3a5f'): number => {
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const headerH = 22;
      const rowH = 18;
      const aligns: ('left' | 'right' | 'center')[] = headers.map((h, i) => i === 0 ? 'left' : 'right');

      // Header
      doc.roundedRect(startX, y, tableWidth, headerH, 2).fill(headerColor);
      doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8, align: aligns[i] });
        x += colWidths[i];
      }
      y += headerH;

      // Rows
      for (let r = 0; r < rows.length; r++) {
        if (y + rowH > 750) {
          startNewPage();
          y = 45;
          // Re-draw header on new page
          doc.roundedRect(startX, y, tableWidth, headerH, 2).fill(headerColor);
          doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
          x = startX;
          for (let i = 0; i < headers.length; i++) {
            doc.text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8, align: aligns[i] });
            x += colWidths[i];
          }
          y += headerH;
        }

        const isEven = r % 2 === 0;
        doc.rect(startX, y, tableWidth, rowH).fill(isEven ? '#f9fafb' : '#ffffff');
        doc.font('Helvetica').fontSize(8).fillColor('#374151');
        x = startX;
        for (let i = 0; i < rows[r].length; i++) {
          const cellText = rows[r][i];
          const isNegative = cellText.includes('-') && cellText.includes(currencySymbol.trim());
          doc.fillColor(isNegative ? '#dc2626' : '#374151');
          doc.text(cellText, x + 4, y + 5, { width: colWidths[i] - 8, align: aligns[i] });
          x += colWidths[i];
        }
        y += rowH;
      }

      // Bottom border
      doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      y += 4;

      return y;
    };

    // ============================================
    // SECTION: Period Breakdown Table
    // ============================================
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(`${periodLabel} Breakdown`, lm, y);
    y += 6;
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(`${startDate} to ${displayEndDate}`, lm, y);
    y += 14;

    const periodHeaders = ['Period', 'Income', 'Expenses', 'Profit'];
    const periodRows = periods.map(p => [
      p.label,
      fmt(p.income),
      fmt(p.expenses),
      fmt(p.profit),
    ]);

    // Add totals row
    periodRows.push(['', '', '', '']);
    periodRows.push(['TOTAL', fmt(totalIncome), fmt(totalExpenses), fmt(netProfit)]);

    const periodColWidths = [pw * 0.2, pw * 0.27, pw * 0.27, pw * 0.26];
    y = drawProfessionalTable(periodHeaders, periodRows, lm, periodColWidths);

    // ============================================
    // SECTION: Expense Categories (if any)
    // ============================================
    const categories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (categories.length > 0) {
      if (y > 620) {
        startNewPage();
        y = 45;
      }

      y += 10;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Expense Breakdown by Category', lm, y);
      y += 16;

      const maxAmount = Math.max(...categories.map(c => c[1]));
      const barMaxWidth = 120;
      const catColWidths = [pw * 0.22, pw * 0.22, pw * 0.56];

      // Draw category table with visual bars
      const catHeaders = ['Category', 'Amount', 'Distribution'];
      const catHeaderH = 22;
      const catRowH = 20;
      const tableWidth = catColWidths.reduce((a, b) => a + b, 0);

      doc.roundedRect(lm, y, tableWidth, catHeaderH, 2).fill('#1e3a5f');
      doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
      let x = lm;
      doc.text(catHeaders[0], x + 4, y + 6, { width: catColWidths[0] - 8, align: 'left' });
      x += catColWidths[0];
      doc.text(catHeaders[1], x + 4, y + 6, { width: catColWidths[1] - 8, align: 'right' });
      x += catColWidths[1];
      doc.text(catHeaders[2], x + 4, y + 6, { width: catColWidths[2] - 8, align: 'left' });
      y += catHeaderH;

      for (let r = 0; r < categories.length; r++) {
        if (y + catRowH > 750) {
          startNewPage();
          y = 45;
          doc.roundedRect(lm, y, tableWidth, catHeaderH, 2).fill('#1e3a5f');
          doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
          x = lm;
          doc.text(catHeaders[0], x + 4, y + 6, { width: catColWidths[0] - 8, align: 'left' });
          x += catColWidths[0];
          doc.text(catHeaders[1], x + 4, y + 6, { width: catColWidths[1] - 8, align: 'right' });
          x += catColWidths[1];
          doc.text(catHeaders[2], x + 4, y + 6, { width: catColWidths[2] - 8, align: 'left' });
          y += catHeaderH;
        }

        const isEven = r % 2 === 0;
        doc.rect(lm, y, tableWidth, catRowH).fill(isEven ? '#f9fafb' : '#ffffff');

        x = lm;
        doc.font('Helvetica').fontSize(8).fillColor('#374151');
        doc.text(categories[r][0].charAt(0).toUpperCase() + categories[r][0].slice(1), x + 4, y + 5, { width: catColWidths[0] - 8, align: 'left' });
        x += catColWidths[0];
        doc.fillColor('#dc2626');
        doc.text(fmt(categories[r][1]), x + 4, y + 5, { width: catColWidths[1] - 8, align: 'right' });
        x += catColWidths[1];

        // Visual bar
        const barWidth = maxAmount > 0 ? (categories[r][1] / maxAmount) * barMaxWidth : 0;
        const barY = y + 6;
        doc.roundedRect(x + 4, barY, barMaxWidth, 8, 2).fill('#fee2e2');
        if (barWidth > 2) {
          doc.roundedRect(x + 4, barY, barWidth, 8, 2).fill('#dc2626');
        }
        const pct = totalExpenses > 0 ? ((categories[r][1] / totalExpenses) * 100).toFixed(1) : '0';
        doc.fontSize(7).fillColor('#6b7280').text(`${pct}%`, x + barMaxWidth + 10, y + 5, { width: 40, align: 'left' });

        y += catRowH;
      }

      doc.moveTo(lm, y).lineTo(lm + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      y += 4;
    }

    // ============================================
    // SECTION: Expense Details List (if any)
    // ============================================
    if (expenses && expenses.length > 0) {
      if (y > 600) {
        startNewPage();
        y = 45;
      }

      y += 10;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Expense Details', lm, y);
      y += 16;

      const expHeaders = ['Date', 'Category', 'Description', 'Amount'];
      const expColWidths = [pw * 0.14, pw * 0.18, pw * 0.44, pw * 0.24];
      const expTableWidth = expColWidths.reduce((a, b) => a + b, 0);
      const expHeaderH = 22;
      const expRowH = 16;

      doc.roundedRect(lm, y, expTableWidth, expHeaderH, 2).fill('#1e3a5f');
      doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
      let x = lm;
      for (let i = 0; i < expHeaders.length; i++) {
        doc.text(expHeaders[i], x + 4, y + 6, { width: expColWidths[i] - 8, align: i === 3 ? 'right' : 'left' });
        x += expColWidths[i];
      }
      y += expHeaderH;

      const sortedExpenses = [...expenses].sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());
      const maxExpRows = Math.min(sortedExpenses.length, 30);
      for (let r = 0; r < maxExpRows; r++) {
        const exp = sortedExpenses[r];
        if (y + expRowH > 750) {
          startNewPage();
          y = 45;
          doc.roundedRect(lm, y, expTableWidth, expHeaderH, 2).fill('#1e3a5f');
          doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
          x = lm;
          for (let i = 0; i < expHeaders.length; i++) {
            doc.text(expHeaders[i], x + 4, y + 6, { width: expColWidths[i] - 8, align: i === 3 ? 'right' : 'left' });
            x += expColWidths[i];
          }
          y += expHeaderH;
        }

        const isEven = r % 2 === 0;
        doc.rect(lm, y, expTableWidth, expRowH).fill(isEven ? '#f9fafb' : '#ffffff');
        doc.font('Helvetica').fontSize(7.5).fillColor('#374151');
        x = lm;
        doc.text(new Date(exp.expense_date).toLocaleDateString('en-GB'), x + 4, y + 4, { width: expColWidths[0] - 8, align: 'left' });
        x += expColWidths[0];
        doc.text((exp.category || '-').charAt(0).toUpperCase() + (exp.category || '-').slice(1), x + 4, y + 4, { width: expColWidths[1] - 8, align: 'left' });
        x += expColWidths[1];
        doc.text((exp.description || '-').slice(0, 50), x + 4, y + 4, { width: expColWidths[2] - 8, align: 'left' });
        x += expColWidths[2];
        doc.fillColor('#dc2626');
        doc.text(fmt(exp.amount), x + 4, y + 4, { width: expColWidths[3] - 8, align: 'right' });
        y += expRowH;
      }

      if (sortedExpenses.length > maxExpRows) {
        doc.fontSize(7.5).font('Helvetica').fillColor('#6b7280');
        doc.text(`... and ${sortedExpenses.length - maxExpRows} more expenses`, lm, y + 4);
        y += 14;
      }

      doc.moveTo(lm, y).lineTo(lm + expTableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
      y += 4;
    }

    // ============================================
    // FOOTER NOTE
    // ============================================
    if (y > 720) {
      startNewPage();
      y = 45;
    }

    y += 16;
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 10;

    doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af');
    doc.text('This report is generated from actual recorded payments (income) and approved expenses.', lm, y, { width: pw, align: 'center' });
    y += 10;
    doc.text(`Generated on ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}  |  Income = payments received  |  Expenses = cash outflows recorded`, lm, y, { width: pw, align: 'center' });

    // Final page footer
    const footerY = doc.page.height - 30;
    doc.moveTo(lm, footerY - 8).lineTo(rm, footerY - 8).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af');
    doc.text(`${companyName}  |  ${companyEmail}  |  ${companyWebsite}`, lm, footerY - 4, { width: pw, align: 'center' });
    doc.text(`Page 1 of ${pageCount}`, lm, footerY + 6, { width: pw, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Financial report PDF error:', error);
    res.status(500).json({ error: 'Failed to generate financial report PDF' });
  }
});

export default router;
