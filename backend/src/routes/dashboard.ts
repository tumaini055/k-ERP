import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

async function computeProjectRevenue(): Promise<number> {
  const { data: completed } = await supabase
    .from('projects')
    .select('id, budget, recorded_revenue')
    .eq('status', 'completed');

  if (!completed || completed.length === 0) return 0;

  let total = 0;
  for (const p of completed) {
    if (p.recorded_revenue) {
      total += Number(p.recorded_revenue);
    } else {
      // Fallback: compute net profit from expenses
      const { data: exps } = await supabase
        .from('expenses')
        .select('amount')
        .eq('project_id', p.id);
      const totalExp = exps?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
      total += Math.max(0, Number(p.budget || 0) - totalExp);
    }
  }
  return total;
}

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    const isSuperAdmin = req.user!.role === 'super_admin';
    const hasCompany = !!(companyId);

    const applyCompanyFilter = (query: any) => {
      if (!isSuperAdmin && hasCompany) return query.eq('company_id', companyId);
      return query;
    };

    const [
      { count: totalCustomers },
      { count: activeProjects },
      { count: completedProjects },
      { count: openTickets },
      { count: totalEmployees },
      { data: projectStatuses },
      { data: revenueData },
      { data: recentActivities },
      { data: monthlyRevenue },
    ] = await Promise.all([
      applyCompanyFilter(supabase.from('customers').select('*', { count: 'exact', head: true })),
      applyCompanyFilter(supabase.from('projects').select('*', { count: 'exact', head: true })).eq('status', 'in_progress'),
      applyCompanyFilter(supabase.from('projects').select('*', { count: 'exact', head: true })).eq('status', 'completed'),
      applyCompanyFilter(supabase.from('support_tickets').select('*', { count: 'exact', head: true })).eq('status', 'open'),
      applyCompanyFilter(supabase.from('users').select('*', { count: 'exact', head: true })).neq('role', 'customer'),
      applyCompanyFilter(supabase.from('projects').select('status')),
      supabase.from('payments').select('amount').gte('payment_date', new Date(new Date().getFullYear(), 0, 1).toISOString()),
      supabase.from('audit_logs').select('*, user:users(first_name, last_name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('payments').select('amount, payment_date'),
    ]);

    const totalRevenue = revenueData?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const projectRevenue = await computeProjectRevenue();

    const monthlyData = monthlyRevenue?.reduce((acc: any, p: any) => {
      const month = new Date(p.payment_date).getMonth();
      acc[month] = (acc[month] || 0) + Number(p.amount);
      return acc;
    }, {}) || {};

    const monthlyRevenueArray = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i).toLocaleString('default', { month: 'short' }),
      revenue: monthlyData[i] || 0,
    }));

    const statusCounts: Record<string, number> = {};
    (projectStatuses || []).forEach((p: any) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    res.json({
      total_customers: totalCustomers || 0,
      active_projects: activeProjects || 0,
      completed_projects: completedProjects || 0,
      open_tickets: openTickets || 0,
      total_employees: totalEmployees || 0,
      project_statuses: statusCounts,
      total_revenue: totalRevenue + projectRevenue,
      project_revenue: projectRevenue,
      monthly_revenue: monthlyRevenueArray,
      recent_activities: recentActivities || [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/financial-summary', async (req: AuthRequest, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).toISOString();
    const endOfYear = new Date(currentYear, 11, 31).toISOString();

    const [{ data: revenue }, { data: expenses }, { data: invoices }] = await Promise.all([
      supabase.from('payments').select('amount').gte('payment_date', startOfYear).lte('payment_date', endOfYear),
      supabase.from('expenses').select('amount').gte('expense_date', startOfYear).lte('expense_date', endOfYear),
      supabase.from('invoices').select('total_amount, status').in('status', ['sent', 'overdue']),
    ]);

    const totalRevenue = revenue?.reduce((s: number, r: any) => s + Number(r.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
    const outstandingInvoices = invoices?.reduce((s: number, i: any) => s + Number(i.total_amount), 0) || 0;
    const projectRevenueTotal = await computeProjectRevenue();

    res.json({
      total_revenue: totalRevenue + projectRevenueTotal,
      total_expenses: totalExpenses,
      net_profit: (totalRevenue + projectRevenueTotal) - totalExpenses,
      outstanding_invoices: outstandingInvoices,
      project_revenue: projectRevenueTotal,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

router.get('/upcoming-events', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, attendees:event_attendees(user_id)')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
