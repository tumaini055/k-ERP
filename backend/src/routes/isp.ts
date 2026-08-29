import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import path from 'path';

const router = Router();

router.use(authenticate);

router.get('/packages', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from('isp_packages')
      .select('*')
      .eq('is_active', true);

    if (type) query = query.eq('type', type);

    const { data, error } = await query.order('price', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

router.post('/packages', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_packages')
      .insert({ ...req.body, company_id: req.user!.company_id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

router.put('/packages/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_packages')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update package' });
  }
});

router.get('/subscribers', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, package_id, customer_id, subscriber_code, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('isp_subscribers')
      .select('*, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, phone), package:isp_packages!isp_subscribers_package_id_fkey(name, bandwidth_download, bandwidth_upload, price)', { count: 'exact' });

    if (status) query = query.eq('service_status', status);
    if (package_id) query = query.eq('package_id', package_id);
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (subscriber_code) query = query.eq('subscriber_code', subscriber_code);
    if (search) {
      query = query.or(`subscriber_code.ilike.%${search}%,customer.company_name.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

router.post('/subscribers', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_subscribers')
      .insert({
        ...req.body,
        company_id: req.user!.company_id,
        subscriber_code: `ISP-${Date.now().toString().slice(-6)}`,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

router.put('/subscribers/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('isp_subscribers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, package:isp_packages!isp_subscribers_package_id_fkey(name, price)')
      .single();

    if (error) throw error;

    if (req.body.package_id) {
      const { data: pkg } = await supabase
        .from('isp_packages')
        .select('name, price')
        .eq('id', req.body.package_id)
        .single();

      if (pkg) {
        const desc = `${pkg.name} - ${Number(pkg.price).toLocaleString()} TZS/month`;
        await supabase
          .from('isp_billing')
          .update({ amount: pkg.price, description: desc })
          .eq('subscriber_id', req.params.id)
          .eq('status', 'pending');
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

router.get('/billing', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, subscriber_id, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('isp_billing')
      .select('*, subscriber:isp_subscribers!isp_billing_subscriber_id_fkey(subscriber_code, customer:customers!isp_subscribers_customer_id_fkey(company_name))', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (subscriber_id) query = query.eq('subscriber_id', subscriber_id);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('billing_date', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

// Paid invoices available for receipt generation
router.get('/billing/receipts', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 200, search } = req.query;

    let query = supabase
      .from('isp_billing')
      .select('*, subscriber:isp_subscribers!isp_billing_subscriber_id_fkey(subscriber_code, package:isp_packages!isp_subscribers_package_id_fkey(name), customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, phone))', { count: 'exact' })
      .gt('paid_amount', 0);

    if (search) {
      query = query.or(`subscriber.subscriber_code.ilike.%${search}%,subscriber.customer.company_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('billing_date', { ascending: false })
      .limit(Number(limit) || 200);

    if (error) throw error;
    res.json({ data, pagination: { total: count, limit: Number(limit) || 200 } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

router.post('/billing', checkPermission('isp', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriber_id, amount, billing_date, due_date, description } = req.body;
    if (!subscriber_id || !amount) {
      res.status(400).json({ error: 'Subscriber and amount are required' });
      return;
    }
    const insertData: any = {
      subscriber_id,
      amount,
      billing_date: billing_date || new Date().toISOString().split('T')[0],
      due_date: due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'pending',
    };
    if (description) insertData.description = description;
    const { data, error } = await supabase
      .from('isp_billing')
      .insert(insertData)
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create billing record' });
  }
});

router.put('/billing/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    const { data, error } = await supabase
      .from('isp_billing')
      .update({ description })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update billing record' });
  }
});

router.put('/billing/:id/pay', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { paid_amount } = req.body;
    const { data: bill, error: fetchError } = await supabase
      .from('isp_billing')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !bill) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }
    const newPaid = paid_amount || bill.amount;
    const { data, error } = await supabase
      .from('isp_billing')
      .update({
        paid_amount: newPaid,
        status: newPaid >= bill.amount ? 'paid' : 'partial',
        paid_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;

    // Update subscriber's paid_through_date when fully paid
    if (newPaid >= bill.amount && bill.subscriber_id) {
      const { data: sub } = await supabase
        .from('isp_subscribers')
        .select('paid_through_date, package:isp_packages!isp_subscribers_package_id_fkey(price, billing_cycle)')
        .eq('id', bill.subscriber_id)
        .single();

      if (sub) {
        const monthlyPrice = (sub.package as any)?.price || bill.amount;
        const monthsCovered = Math.max(1, Math.round(bill.amount / monthlyPrice));
        const fromDate = sub.paid_through_date
          ? new Date(sub.paid_through_date)
          : new Date(bill.billing_date || bill.created_at);
        const newPaidThrough = new Date(fromDate);
        newPaidThrough.setMonth(newPaidThrough.getMonth() + monthsCovered);

        await supabase
          .from('isp_subscribers')
          .update({ paid_through_date: newPaidThrough.toISOString().split('T')[0] })
          .eq('id', bill.subscriber_id);
      }
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.delete('/billing/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: bill, error: fetchError } = await supabase
      .from('isp_billing')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchError || !bill) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }

    // If invoice had payments, recalculate subscriber's paid_through_date
    if (Number(bill.paid_amount) > 0 && bill.subscriber_id) {
      const { data: remainingBills } = await supabase
        .from('isp_billing')
        .select('amount, paid_amount, billing_date, created_at')
        .eq('subscriber_id', bill.subscriber_id)
        .neq('id', bill.id)
        .not('paid_at', 'is', null);

      const totalPaid = (remainingBills || []).reduce(
        (sum, b) => sum + (Number(b.paid_amount) || 0), 0
      );

      if (totalPaid > 0) {
        const { data: sub } = await supabase
          .from('isp_subscribers')
          .select('package:isp_packages!isp_subscribers_package_id_fkey(price)')
          .eq('id', bill.subscriber_id)
          .single();

        const monthlyPrice = (sub as any)?.package?.price || bill.amount;
        const monthsCovered = Math.max(1, Math.round(totalPaid / Number(monthlyPrice)));
        const { data: earliestBill } = await supabase
          .from('isp_billing')
          .select('billing_date, created_at')
          .eq('subscriber_id', bill.subscriber_id)
          .neq('id', bill.id)
          .not('paid_at', 'is', null)
          .order('billing_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        const fromDate = earliestBill
          ? new Date(earliestBill.billing_date || earliestBill.created_at)
          : new Date();
        const newPaidThrough = new Date(fromDate);
        newPaidThrough.setMonth(newPaidThrough.getMonth() + monthsCovered);

        await supabase
          .from('isp_subscribers')
          .update({ paid_through_date: newPaidThrough.toISOString().split('T')[0] })
          .eq('id', bill.subscriber_id);
      } else {
        // No remaining payments, clear paid_through_date
        await supabase
          .from('isp_subscribers')
          .update({ paid_through_date: null })
          .eq('id', bill.subscriber_id);
      }
    }

    const { data, error } = await supabase
      .from('isp_billing')
      .delete()
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete billing record' });
  }
});

router.get('/subscriptions', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { ending_within_days, status } = req.query;

    let subQuery = supabase
      .from('isp_subscribers')
      .select('*, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, phone), package:isp_packages!isp_subscribers_package_id_fkey(name, price, billing_cycle, bandwidth_download, bandwidth_upload, bandwidth_unit)');

    if (status) {
      subQuery = subQuery.eq('service_status', status);
    } else {
      subQuery = subQuery.not('service_status', 'eq', 'disconnected');
    }

    const { data: subscribers, error: subError } = await subQuery;
    if (subError) throw subError;

    const result: any[] = [];

    if (subscribers && subscribers.length > 0) {
      const ids = subscribers.map(s => s.id);

      const { data: billingData, error: billError } = await supabase
        .from('isp_billing')
        .select('subscriber_id, due_date')
        .in('subscriber_id', ids)
        .order('due_date', { ascending: false });

      if (billError) throw billError;

      const latestDueDates: Record<string, string> = {};
      for (const bill of billingData || []) {
        if (!latestDueDates[bill.subscriber_id]) {
          latestDueDates[bill.subscriber_id] = bill.due_date;
        }
      }

      const cycleMonths: Record<string, number> = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
      const now = new Date();

      for (const sub of subscribers) {
        let endDate: Date;

        if (sub.paid_through_date) {
          endDate = new Date(sub.paid_through_date);
        } else {
          const lastDueDate = latestDueDates[sub.id];
          if (lastDueDate) {
            endDate = new Date(lastDueDate);
          } else if (sub.installation_date) {
            endDate = new Date(sub.installation_date);
            const months = cycleMonths[sub.package?.billing_cycle] || 1;
            endDate.setMonth(endDate.getMonth() + months);
          } else {
            endDate = new Date(sub.created_at);
            endDate.setMonth(endDate.getMonth() + 1);
          }
        }

        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        result.push({
          id: sub.id,
          subscriber_code: sub.subscriber_code,
          service_status: sub.service_status,
          installation_address: sub.installation_address,
          installation_date: sub.installation_date,
          connection_type: sub.connection_type,
          customer: sub.customer,
          package: sub.package,
          paid_through_date: sub.paid_through_date,
          end_date: endDate.toISOString().split('T')[0],
          days_remaining: daysRemaining,
        });
      }
    }

    let filtered = result;
    if (ending_within_days) {
      const days = Number(ending_within_days);
      filtered = result.filter(r => r.days_remaining <= days && r.days_remaining >= -90);
    }

    filtered.sort((a, b) => a.days_remaining - b.days_remaining);

    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.get('/stats', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count: totalSubs } = await supabase
      .from('isp_subscribers')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await supabase
      .from('isp_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('service_status', 'active');

    const { count: overdueCount } = await supabase
      .from('isp_subscribers')
      .select('*', { count: 'exact', head: true })
      .not('paid_through_date', 'is', null)
      .lt('paid_through_date', todayStr)
      .neq('service_status', 'disconnected');

    // Get active subscribers with packages for projected revenue/cost
    const { data: activeSubs } = await supabase
      .from('isp_subscribers')
      .select('package:isp_packages!isp_subscribers_package_id_fkey(price, cost_price)')
      .eq('service_status', 'active');

    let projectedRevenue = 0;
    let projectedCost = 0;
    for (const sub of activeSubs || []) {
      const pkg = Array.isArray(sub.package) ? sub.package[0] : sub.package;
      if (pkg) {
        projectedRevenue += Number(pkg.price) || 0;
        projectedCost += Number(pkg.cost_price) || 0;
      }
    }

    // Get actual payments this month
    const { data: monthlyBills } = await supabase
      .from('isp_billing')
      .select('paid_amount, subscriber_id')
      .not('paid_at', 'is', null)
      .gte('paid_at', monthStart)
      .lte('paid_at', monthEnd);

    // Get subscriber package cost mappings
    const subIds = [...new Set((monthlyBills || []).map(b => b.subscriber_id).filter(Boolean))];
    const costMap: Record<string, number> = {};

    if (subIds.length > 0) {
      const { data: subs } = await supabase
        .from('isp_subscribers')
        .select('id, package:isp_packages!isp_subscribers_package_id_fkey(price, cost_price)')
        .in('id', subIds);

      for (const sub of subs || []) {
        const pkg = Array.isArray(sub.package) ? sub.package[0] : sub.package;
        if (pkg && Number(pkg.price) > 0) {
          costMap[sub.id] = (Number(pkg.cost_price) || 0) / Number(pkg.price);
        }
      }
    }

    let collected = 0;
    let costTotal = 0;

    for (const bill of monthlyBills || []) {
      const amt = Number(bill.paid_amount) || 0;
      collected += amt;
      const ratio = costMap[bill.subscriber_id] || 0;
      costTotal += amt * ratio;
    }

    res.json({
      data: {
        total_subscribers: totalSubs || 0,
        active_count: activeCount || 0,
        overdue_count: overdueCount || 0,
        projected_revenue: projectedRevenue,
        projected_cost: projectedCost,
        projected_profit: projectedRevenue - projectedCost,
        monthly_collected: collected,
        monthly_cost: Math.round(costTotal * 100) / 100,
        monthly_profit: Math.round((collected - costTotal) * 100) / 100,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// ISP BULK SMS
// ============================================
router.post('/send-bulk-sms', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { subscriber_ids, message, phone_overrides } = req.body;

    if (!subscriber_ids?.length || !message) {
      res.status(400).json({ error: 'subscriber_ids and message are required' });
      return;
    }

    // Get subscribers with customer phone numbers
    const { data: subscribers } = await supabase
      .from('isp_subscribers')
      .select('id, subscriber_code, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, phone)')
      .in('id', subscriber_ids);

    if (!subscribers || subscribers.length === 0) {
      res.status(404).json({ error: 'No subscribers found' });
      return;
    }

    // Get SMS config from company settings
    const { data: cs } = await supabase
      .from('company_settings')
      .select('settings')
      .eq('company_id', req.user!.company_id)
      .single();

    const settings = cs?.settings || {};
    const apiKey = settings.beam_africa_api_key;
    const secretKey = settings.beam_africa_secret_key || '';
    const senderName = settings.beam_africa_sender_name || 'K-connect';

    if (!apiKey) {
      res.status(400).json({ error: 'Beam Africa API key not configured. Go to Settings to add it.' });
      return;
    }

    // Collect valid phone numbers
    const phoneNumbers: string[] = [];
    const results: any[] = [];

    for (const sub of subscribers) {
      const cust = Array.isArray(sub.customer) ? sub.customer[0] : sub.customer;
      let phone = phone_overrides?.[sub.id] || cust?.phone || '';
      phone = phone.replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '255' + phone.slice(1);
      if (!phone.startsWith('255')) phone = '255' + phone;
      if (phone.length >= 10 && phone.length <= 15) {
        phoneNumbers.push(phone);
        results.push({ subscriber_code: sub.subscriber_code, customer: cust?.company_name || cust?.contact_person || '-', phone, status: 'pending' });
      } else {
        results.push({ subscriber_code: sub.subscriber_code, customer: cust?.company_name || cust?.contact_person || '-', phone: cust?.phone || '-', status: 'invalid_number' });
      }
    }

    if (phoneNumbers.length === 0) {
      res.status(400).json({ error: 'No valid phone numbers found' });
      return;
    }

    // Send SMS via Beam Africa
    const { sendBulkSms } = require('../utils/sms');
    const result = await sendBulkSms(apiKey, secretKey, senderName, phoneNumbers, message);

    for (const r of results) {
      if (r.status === 'pending') r.status = 'sent';
    }

    res.json({
      data: {
        total: subscribers.length,
        valid_phones: phoneNumbers.length,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors.slice(0, 10),
        results,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// ============================================
// ISP MONTHLY COLLECTIONS
// ============================================
router.get('/monthly-collections', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const months: any[] = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get all finalized records for this company
    const { data: finalizedRecords } = await supabase
      .from('isp_monthly_collections')
      .select('*')
      .eq('company_id', req.user!.company_id);

    const finalizedMap: Record<string, any> = {};
    for (const r of finalizedRecords || []) {
      finalizedMap[r.year_month] = r;
    }

    // Get active subscribers with packages for projected
    const { data: activeSubs } = await supabase
      .from('isp_subscribers')
      .select('package:isp_packages!isp_subscribers_package_id_fkey(price)')
      .eq('service_status', 'active');

    const activePackagePrices = (activeSubs || []).map((sub: any) => {
      const pkg = Array.isArray(sub.package) ? sub.package[0] : sub.package;
      return pkg ? Number(pkg.price) || 0 : 0;
    });
    const projectedMonthly = activePackagePrices.reduce((s: number, p: number) => s + p, 0);

    // Get all paid billing records for last 12 months
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
    const { data: allBills } = await supabase
      .from('isp_billing')
      .select('paid_amount, paid_at')
      .not('paid_at', 'is', null)
      .gte('paid_at', twelveMonthsAgo);

    // Group billing by year-month
    const collectedByMonth: Record<string, number> = {};
    for (const bill of allBills || []) {
      const d = new Date(bill.paid_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      collectedByMonth[ym] = (collectedByMonth[ym] || 0) + (Number(bill.paid_amount) || 0);
    }

    // Build last 12 months + current + next month
    for (let i = -11; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const finalized = finalizedMap[ym];
      const projected = finalized ? (finalized as any).projected_amount || projectedMonthly : projectedMonthly;
      const collected = finalized ? (finalized as any).collected_amount || 0 : (collectedByMonth[ym] || 0);

      months.push({
        id: finalized?.id || null,
        year_month: ym,
        label,
        projected_amount: projected,
        collected_amount: collected,
        remaining: projected - collected,
        collected_pct: projected > 0 ? Math.round((collected / projected) * 100) : 0,
        status: finalized?.status || 'open',
        finalized_at: finalized?.finalized_at || null,
        is_current: i === 0,
      });
    }

    months.sort((a, b) => a.year_month.localeCompare(b.year_month));

    res.json({ data: months });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly collections' });
  }
});

router.post('/monthly-collections/:yearMonth/finalize', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { yearMonth } = req.params;

    // Compute projected and collected for this month
    const [year, month] = yearMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: activeSubs } = await supabase
      .from('isp_subscribers')
      .select('package:isp_packages!isp_subscribers_package_id_fkey(price)')
      .eq('service_status', 'active');

    let projected = 0;
    for (const sub of activeSubs || []) {
      const pkg = Array.isArray(sub.package) ? sub.package[0] : sub.package;
      if (pkg) projected += Number(pkg.price) || 0;
    }

    const { data: monthBills } = await supabase
      .from('isp_billing')
      .select('paid_amount')
      .not('paid_at', 'is', null)
      .gte('paid_at', monthStart)
      .lte('paid_at', monthEnd);

    let collected = 0;
    for (const bill of monthBills || []) {
      collected += Number(bill.paid_amount) || 0;
    }

    // Upsert the finalized record
    const { data: existing } = await supabase
      .from('isp_monthly_collections')
      .select('id')
      .eq('company_id', req.user!.company_id)
      .eq('year_month', yearMonth)
      .maybeSingle();

    let result;
    if (existing) {
      const { data } = await supabase
        .from('isp_monthly_collections')
        .update({ status: 'finalized', finalized_at: new Date().toISOString(), projected_amount: projected, collected_amount: collected })
        .eq('id', existing.id)
        .select('*')
        .single();
      result = data;
    } else {
      const { data } = await supabase
        .from('isp_monthly_collections')
        .insert({
          company_id: req.user!.company_id,
          year_month: yearMonth,
          status: 'finalized',
          finalized_at: new Date().toISOString(),
          projected_amount: projected,
          collected_amount: collected,
        })
        .select('*')
        .single();
      result = data;
    }

    res.json({ data: { ...result, projected_amount: projected, collected_amount: collected } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to finalize month' });
  }
});

router.delete('/monthly-collections/:id', checkPermission('isp', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('isp_monthly_collections')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete monthly collection' });
  }
});

// ============================================
// ISP BILLING PDF
// ============================================
router.get('/billing/:id/pdf', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: bill } = await supabase
      .from('isp_billing')
      .select('*, subscriber:isp_subscribers!isp_billing_subscriber_id_fkey(subscriber_code, connection_type, installation_address, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, email, phone, address), package:isp_packages!isp_subscribers_package_id_fkey(name, price, bandwidth_download, bandwidth_upload, bandwidth_unit, billing_cycle))')
      .eq('id', req.params.id)
      .single();

    if (!bill) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }

    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let taxId = '';
    let logoUrl = '';
    let currencySymbol = 'TSh ';
    let bankName = '';
    let bankAccountName = '';
    let bankAccountNumber = '';

    const { data: user } = await supabase.from('users').select('company_id').eq('id', req.user!.id).single();
    const companyId = user?.company_id;
    if (companyId) {
      const { data: cs } = await supabase.from('company_settings').select('settings').eq('company_id', companyId).single();
      if (cs?.settings) {
        const s = cs.settings;
        if (s.company_name) companyName = s.company_name;
        if (s.company_email) companyEmail = s.company_email;
        if (s.company_website) companyWebsite = s.company_website;
        if (s.company_address) companyAddress = s.company_address;
        if (s.company_phone) companyPhone = s.company_phone;
        if (s.tax_id) taxId = s.tax_id;
        if (s.logo_url) logoUrl = s.logo_url;
        if (s.bank_name) bankName = s.bank_name;
        if (s.bank_account_name) bankAccountName = s.bank_account_name;
        if (s.bank_account_number) bankAccountNumber = s.bank_account_number;
        if (s.currency === 'USD') currencySymbol = '$ ';
        else if (s.currency === 'EUR') currencySymbol = '€ ';
        else if (s.currency === 'GBP') currencySymbol = '£ ';
        else if (s.currency === 'KES' || s.currency === 'UGX') currencySymbol = `${s.currency} `;
        else currencySymbol = 'TSh ';
      }
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="isp-invoice-${bill.id.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    let y = 0;

    doc.rect(0, 0, doc.page.width, 48).fill('#dc2626');
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('INVOICE', lm, 14, { align: 'center', width: pw });

    y = 68;

    const addrParts = companyAddress ? companyAddress.split(',').map((s: string) => s.trim()) : [];
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

    const refBoxY = y + 2;
    const refPad = 8;
    const refInnerW = refBoxW - refPad * 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill('#fef2f2').strokeColor('#dc2626').lineWidth(0.5).stroke();
    doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold').text('Invoice No', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(`ISP-${bill.id.slice(0, 8).toUpperCase()}`, refBoxX + refPad, refBoxY + 20, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    if (bill.billing_date) {
      doc.text(`Date: ${new Date(bill.billing_date).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
      refRowY += 11;
    }
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 58;
    y = Math.max(leftEndY, rightEndY) + 16;

    const customerName = bill.subscriber?.customer
      ? (bill.subscriber.customer.company_name || bill.subscriber.customer.contact_person || '\u2014')
      : '\u2014';

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('BILL TO', lm, y);
    doc.text('SHIP TO', rm - 200, y);
    y += 14;

    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(customerName, lm, y);
    doc.text(customerName, rm - 200, y);
    y += 12;

    if (bill.subscriber?.customer?.email) {
      doc.text(bill.subscriber.customer.email, lm, y);
      doc.text(bill.subscriber.customer.email, rm - 200, y);
      y += 12;
    }
    if (bill.subscriber?.customer?.phone) {
      doc.text(bill.subscriber.customer.phone, lm, y);
      doc.text(bill.subscriber.customer.phone, rm - 200, y);
      y += 12;
    }
    if (bill.subscriber?.customer?.address) {
      const addrH = doc.heightOfString(bill.subscriber.customer.address, { width: 200 });
      doc.text(bill.subscriber.customer.address, lm, y, { width: 200 });
      doc.text(bill.subscriber.customer.address, rm - 200, y, { width: 200 });
      y += Math.max(addrH, 12);
    }

    y += 10;
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Service Details', lm, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    if (bill.subscriber?.package) {
      const pkg = bill.subscriber.package;
      doc.text(`Package: ${pkg.name}`, lm, y);
      y += 12;
      doc.text(`Bandwidth: ${pkg.bandwidth_download}/${pkg.bandwidth_upload} ${pkg.bandwidth_unit}`, lm, y);
      y += 12;
      doc.text(`Billing Cycle: ${pkg.billing_cycle}`, lm, y);
      y += 12;
    }
    if (bill.subscriber?.subscriber_code) {
      doc.text(`Subscriber Code: ${bill.subscriber.subscriber_code}`, lm, y);
      y += 12;
    }
    if (bill.subscriber?.connection_type) {
      doc.text(`Connection Type: ${bill.subscriber.connection_type}`, lm, y);
      y += 12;
    }
    y += 8;

    const fmt = (n: number) => `${currencySymbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const colW = [18, 260, 38, 90, 95];
    const colX = [lm];
    for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];
    const tableWidth = colW.reduce((s, w) => s + w, 0);
    const headerH = 22;
    const rowH = 19;

    const headerTexts = ['SN', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE'];
    const headerAligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right'];

    doc.roundedRect(colX[0], y, tableWidth, headerH, 2).fill('#dc2626');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    for (let i = 0; i < headerTexts.length; i++) {
      doc.text(headerTexts[i], colX[i], y + 6, { width: colW[i], align: headerAligns[i] });
    }
    y += headerH;

    const pkgDesc = bill.description || (bill.subscriber?.package ? `${bill.subscriber.package.name} - Internet Service` : 'Internet Service');
    doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
    doc.rect(colX[0], y, tableWidth, rowH).fill('#f9fafb');
    doc.fillColor('#374151');
    doc.text('1', colX[0], y + 5, { width: colW[0], align: 'center' });
    doc.text(pkgDesc, colX[1] + 4, y + 5, { width: colW[1] - 8, align: 'left' });
    doc.text('1', colX[2], y + 5, { width: colW[2], align: 'center' });
    doc.text(`${currencySymbol}${Number(bill.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colX[3], y + 5, { width: colW[3], align: 'right' });
    doc.text(`${currencySymbol}${Number(bill.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colX[4], y + 5, { width: colW[4], align: 'right' });
    y += rowH;

    doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 6;

    const sumX = colX[3];
    const sumW = colW[3] + colW[4];
    const summaryH = 16;
    const grandBoxH = 30;
    const totalSummaryH = summaryH + grandBoxH + 6;

    doc.rect(sumX, y, sumW, totalSummaryH).fill('#f9fafb');

    doc.fontSize(9);
    doc.font('Helvetica').fillColor('#4b5563');
    doc.text('Subtotal', sumX + 8, y + 4, { width: 80 });
    doc.text(fmt(bill.amount), sumX + 8, y + 4, { width: sumW - 16, align: 'right' });
    y += 16;

    y += 3;
    doc.roundedRect(sumX + 2, y, sumW - 4, grandBoxH, 3).fill('#dc2626');
    doc.fillColor('#fff').font('Helvetica-Bold');
    doc.fontSize(9).text('GRAND TOTAL', sumX + 10, y + 8, { width: 60 });
    doc.fontSize(12).text(fmt(bill.amount), sumX + 75, y + 8, { width: sumW - 79, align: 'right' });

    y += grandBoxH + 22;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Terms & Conditions of Payment:', lm, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    const defaultTerms = [
      '100% Upfront Invoice Value Payment Payable by Cash/Bank Wire Transfer.',
      `Payment is due by ${new Date(bill.due_date).toLocaleDateString('en-GB')}.`,
      'Late payments may result in service suspension.',
    ];
    for (const t of defaultTerms) {
      doc.text(`\u2022 ${t}`, lm, y, { width: pw });
      y += doc.heightOfString(`\u2022 ${t}`, { width: pw }) + 5;
    }
    y += 8;

    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(9).text('BANK DETAILS', lm, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    const bankRows: { label: string; value: string }[] = [
      { label: 'Bank Name', value: bankName || '_________________________' },
      { label: 'Account Name', value: bankAccountName || '_________________________' },
      { label: 'Account Number', value: bankAccountNumber || '_________________________' },
    ];
    for (const row of bankRows) {
      doc.text(`${row.label}:`, lm, y);
      doc.text(row.value, lm + 100, y);
      y += 13;
    }

    y += 10;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('PREPARED BY', lm, y);
    doc.text('AUTHORIZED SIGNATURE', rm - 200, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9);
    doc.text(`${req.user?.first_name || ''} ${req.user?.last_name || ''}`, lm, y);
    doc.moveTo(rm - 200, y + 2).lineTo(rm - 30, y + 2).strokeColor('#9ca3af').lineWidth(0.5).stroke();

    // Stamp
    try {
      const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png'));
      const ss = Math.min(160 / s.width, 160 / s.height);
      const sw = s.width * ss, sh = s.height * ss;
      const sx = rm - 200 + (200 - sw) / 2;
      const sy = Math.min(y - 20, doc.page.height - 120 - sh);
      doc.save();
      doc.translate(sx, sy);
      doc.rotate(-8, { origin: [sw / 2, sh / 2] });
      doc.image(s, 0, 0, { width: sw, height: sh });
      doc.restore();
    } catch (_) {}

    const footY = doc.page.height - 32;

    doc.rect(0, footY - 6, doc.page.width, 32).fill('#dc2626');
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica');
    const footerParts = [companyName];
    if (companyEmail) footerParts.push(companyEmail);
    if (companyWebsite) footerParts.push(companyWebsite);
    doc.text(footerParts.join('  |  '), lm, footY + 3, { align: 'center', width: pw });
    doc.text(`ISP Invoice #ISP-${bill.id.slice(0, 8).toUpperCase()}  |  Generated ${new Date().toLocaleDateString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ============================================
// ISP BILLING RECEIPT PDF (generated for paid bills)
// ============================================
function numberToWords(value: number): string {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const underHundred = (n: number): string => {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? ` ${ones[o]}` : '');
  };
  if (value === 0) return 'Zero';
  const abs = Math.abs(value);
  const cents = Math.round((abs - Math.floor(abs)) * 100);
  let whole = Math.floor(abs);
  const parts: string[] = [];
  let scaleIdx = 0;
  while (whole > 0) {
    const chunk = whole % 1000;
    if (chunk > 0) {
      const h = Math.floor(chunk / 100);
      const rem = chunk % 100;
      let chunkText = '';
      if (h > 0) {
        chunkText += `${ones[h]} Hundred`;
        if (rem > 0) chunkText += ` and ${underHundred(rem)}`;
      } else {
        chunkText += underHundred(rem);
      }
      if (scales[scaleIdx]) chunkText += ` ${scales[scaleIdx]}`;
      parts.unshift(chunkText);
    }
    whole = Math.floor(whole / 1000);
    scaleIdx++;
  }
  const wholeText = parts.join(' ');
  return cents > 0 ? `${wholeText} and ${cents}/100` : wholeText;
}

router.get('/billing/:id/receipt', checkPermission('isp', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: bill } = await supabase
      .from('isp_billing')
      .select('*, subscriber:isp_subscribers!isp_billing_subscriber_id_fkey(subscriber_code, connection_type, installation_address, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, email, phone, address), package:isp_packages!isp_subscribers_package_id_fkey(name, price, bandwidth_download, bandwidth_upload, bandwidth_unit, billing_cycle))')
      .eq('id', req.params.id)
      .single();

    if (!bill) {
      res.status(404).json({ error: 'Billing record not found' });
      return;
    }

    const paidAmount = Number(bill.paid_amount) || 0;
    if (paidAmount <= 0) {
      res.status(400).json({ error: 'Receipt can only be generated for paid bills' });
      return;
    }

    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let taxId = '';
    let logoUrl = '';
    let currencySymbol = 'TSh ';
    let bankName = '';
    let bankAccountName = '';
    let bankAccountNumber = '';

    const { data: user } = await supabase.from('users').select('company_id').eq('id', req.user!.id).single();
    const companyId = user?.company_id;
    if (companyId) {
      const { data: cs } = await supabase.from('company_settings').select('settings').eq('company_id', companyId).single();
      if (cs?.settings) {
        const s = cs.settings;
        if (s.company_name) companyName = s.company_name;
        if (s.company_email) companyEmail = s.company_email;
        if (s.company_website) companyWebsite = s.company_website;
        if (s.company_address) companyAddress = s.company_address;
        if (s.company_phone) companyPhone = s.company_phone;
        if (s.tax_id) taxId = s.tax_id;
        if (s.logo_url) logoUrl = s.logo_url;
        if (s.bank_name) bankName = s.bank_name;
        if (s.bank_account_name) bankAccountName = s.bank_account_name;
        if (s.bank_account_number) bankAccountNumber = s.bank_account_number;
        if (s.currency === 'USD') currencySymbol = '$ ';
        else if (s.currency === 'EUR') currencySymbol = '€ ';
        else if (s.currency === 'GBP') currencySymbol = '£ ';
        else if (s.currency === 'KES' || s.currency === 'UGX') currencySymbol = `${s.currency} `;
        else currencySymbol = 'TSh ';
      }
    }

    const receiptNumber = `RCT-${bill.id.slice(0, 8).toUpperCase()}`;
    const customerName = bill.subscriber?.customer
      ? (bill.subscriber.customer.company_name || bill.subscriber.customer.contact_person || '\u2014')
      : '\u2014';

    const crypto = require('crypto');
    const verifySource = `${receiptNumber}|${bill.id}|${Number(bill.amount).toFixed(2)}|${paidAmount.toFixed(2)}|${customerName}|${bill.billing_date || bill.created_at}`;
    const verifyHash = crypto.createHash('sha256').update(verifySource).digest('hex').toUpperCase();
    const verifyCode = `${verifyHash.slice(0, 4)}-${verifyHash.slice(4, 8)}-${verifyHash.slice(8, 12)}-${verifyHash.slice(12, 16)}`;

    const receivedBy = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || '\u2014';
    const receiptDate = bill.paid_at || bill.updated_at || new Date().toISOString();

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptNumber}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    const green = '#059669';
    const greenDark = '#065f46';
    const greenLight = '#ecfdf5';
    const greenBorder = '#a7f3d0';
    const fmt = (n: number) => `${currencySymbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    let y = 0;

    doc.rect(0, 0, doc.page.width, 48).fill(green);
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('OFFICIAL RECEIPT', lm, 14, { align: 'center', width: pw });

    y = 62;
    doc.roundedRect(lm, y, 118, 22, 11).fill('#d1fae5');
    doc.fillColor(greenDark).fontSize(10).font('Helvetica-Bold').text('PAID IN FULL', lm, y + 6, { width: 118, align: 'center' });
    y += 34;

    const addrParts = companyAddress ? companyAddress.split(',').map((s: string) => s.trim()) : [];
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

    const refBoxY = y;
    const refPad = 8;
    const refInnerW = refBoxW - refPad * 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 64).fill(greenLight).strokeColor(green).lineWidth(0.5).stroke();
    doc.fillColor(green).fontSize(9).font('Helvetica-Bold').text('RECEIPT NO', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(10).text(receiptNumber, refBoxX + refPad, refBoxY + 19, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    doc.text(`Subscriber: ${bill.subscriber?.subscriber_code || '\u2014'}`, refBoxX + refPad, refRowY, { width: refInnerW });
    refRowY += 11;
    doc.text(`Date: ${new Date(receiptDate).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
    refRowY += 11;
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 64;
    y = Math.max(leftEndY, rightEndY) + 16;

    doc.fontSize(9).font('Helvetica-Bold').fillColor(greenDark).text('PAID BY / BILL TO', lm, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(customerName, lm, y);
    y += 12;
    if (bill.subscriber?.customer?.email) {
      doc.text(bill.subscriber.customer.email, lm, y);
      y += 12;
    }
    if (bill.subscriber?.customer?.phone) {
      doc.text(bill.subscriber.customer.phone, lm, y);
      y += 12;
    }
    if (bill.subscriber?.customer?.address) {
      const addrH = doc.heightOfString(bill.subscriber.customer.address, { width: 200 });
      doc.text(bill.subscriber.customer.address, lm, y, { width: 200 });
      y += Math.max(addrH, 12);
    }

    y += 10;

    const payBoxTop = y;
    const payBoxH = 46;
    doc.rect(lm, payBoxTop, pw, payBoxH).fill(greenLight).strokeColor(greenBorder).lineWidth(0.5).stroke();
    doc.fontSize(8.5).font('Helvetica').fillColor('#065f46');
    const payColX = lm + 12;
    const payColW = (pw - 24) / 4;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(greenDark);
    const payHeaders = ['PAYMENT METHOD', 'REFERENCE NO', 'DATE RECEIVED', 'RECEIVED BY'];
    payHeaders.forEach((h, i) => doc.text(h, payColX + i * payColW, payBoxTop + 8, { width: payColW - 6 }));
    doc.font('Helvetica').fillColor('#111827').fontSize(8.5);
    doc.text('\u2014', payColX, payBoxTop + 24, { width: payColW - 6 });
    doc.text('\u2014', payColX + payColW, payBoxTop + 24, { width: payColW - 6 });
    doc.text(new Date(receiptDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), payColX + payColW * 2, payBoxTop + 24, { width: payColW - 6 });
    doc.text(receivedBy, payColX + payColW * 3, payBoxTop + 24, { width: payColW - 6 });
    y = payBoxTop + payBoxH + 14;

    const tableTop = y;
    const colW = [18, 260, 38, 90, 95];
    const colX = [lm];
    for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];
    const tableWidth = colW.reduce((s, w) => s + w, 0);
    const headerH = 22;
    const rowH = 19;

    const headerTexts = ['SN', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE'];
    const headerAligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right'];

    doc.roundedRect(colX[0], tableTop, tableWidth, headerH, 2).fill(green);
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    for (let i = 0; i < headerTexts.length; i++) {
      doc.text(headerTexts[i], colX[i], tableTop + 6, { width: colW[i], align: headerAligns[i] });
    }

    y = tableTop + headerH;
    doc.rect(colX[0], y, tableWidth, rowH).fill('#f9fafb');
    doc.fillColor('#374151').fontSize(8.5).font('Helvetica');
    const pkgDesc = bill.description || (bill.subscriber?.package ? `${bill.subscriber.package.name} - Internet Service` : 'Internet Service');
    doc.text('1', colX[0], y + 5, { width: colW[0], align: 'center' });
    doc.text(pkgDesc, colX[1] + 4, y + 5, { width: colW[1] - 8, align: 'left' });
    doc.text('1', colX[2], y + 5, { width: colW[2], align: 'center' });
    doc.text(fmt(bill.amount), colX[3], y + 5, { width: colW[3], align: 'right' });
    doc.text(fmt(paidAmount), colX[4], y + 5, { width: colW[4], align: 'right' });
    y += rowH;

    doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 6;

    const sumX = colX[3];
    const sumW = colW[3] + colW[4];
    const summaryH = 16;
    const grandBoxH = 30;
    const totalSummaryH = summaryH + grandBoxH + 6;

    doc.rect(sumX, y, sumW, totalSummaryH).fill('#f9fafb');
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9);
    doc.text('Subtotal', sumX + 8, y + 4, { width: 80 });
    doc.text(fmt(bill.amount), sumX + 8, y + 4, { width: sumW - 16, align: 'right' });
    y += 16;
    y += 3;
    doc.roundedRect(sumX + 2, y, sumW - 4, grandBoxH, 3).fill(green);
    doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold');
    doc.text('GRAND TOTAL', sumX + 10, y + 8, { width: 100 });
    doc.text(fmt(paidAmount), sumX + 10, y + 8, { width: sumW - 20, align: 'right' });
    y += grandBoxH + 10;

    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563');
    doc.text('Amount Paid', sumX + 8, y, { width: 80 });
    doc.font('Helvetica-Bold').fillColor(greenDark);
    doc.text(fmt(paidAmount), sumX + 8, y, { width: sumW - 16, align: 'right' });
    y += 16;
    doc.font('Helvetica').fillColor('#4b5563');
    doc.text('Balance', sumX + 8, y, { width: 80 });
    doc.font('Helvetica-Bold').fillColor('#059669');
    doc.text(fmt(Math.max(0, Number(bill.amount) - paidAmount)), sumX + 8, y, { width: sumW - 16, align: 'right' });
    y += 22;

    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563');
    doc.text('Amount Received in Words:', lm, y, { width: 120 });
    const wordsText = `${numberToWords(paidAmount)} only`;
    doc.font('Helvetica-Bold').fillColor('#111827');
    doc.text(wordsText, lm + 120, y, { width: pw - 120 });
    y += Math.max(doc.heightOfString(wordsText, { width: pw - 120 }), 12) + 12;

    doc.roundedRect(lm, y, pw, 44, 3);
    doc.strokeColor(green).lineWidth(0.5).dash(3, 3).stroke();
    doc.undash();
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text('VERIFICATION CODE', lm + 12, y + 7, { width: pw - 24 });
    doc.font('Helvetica-Bold').fillColor(greenDark).fontSize(11).text(verifyCode, lm + 12, y + 21, { width: pw - 24 });
    doc.font('Helvetica').fillColor('#9ca3af').fontSize(7.5).text('This document is cryptographically signed and can be verified against the original billing record.', lm + 12, y + 36, { width: pw - 24 });
    y += 56;

    if (y + 90 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('RECEIVED BY', lm, y);
    doc.text('AUTHORIZED SIGNATURE', rm - 200, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9);
    doc.text(receivedBy, lm, y);
    doc.moveTo(rm - 200, y + 2).lineTo(rm - 30, y + 2).strokeColor('#9ca3af').lineWidth(0.5).stroke();
    y += 34;

    try {
      const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png'));
      const ss = Math.min(110 / s.width, 110 / s.height);
      const sw = s.width * ss, sh = s.height * ss;
      doc.save();
      doc.translate(lm + 120, y - 8 - sh);
      doc.rotate(-6, { origin: [sw / 2, sh / 2] });
      doc.image(s, 0, 0, { width: sw, height: sh });
      doc.restore();
    } catch (_) { /* skip */ }

    y += 20;
    if (y + 32 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }
    const footY = y;
    doc.rect(0, footY - 6, doc.page.width, 32).fill(green);
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica');
    const footerParts = [companyName];
    if (companyEmail) footerParts.push(companyEmail);
    if (companyWebsite) footerParts.push(companyWebsite);
    doc.text(footerParts.join('  |  '), lm, footY + 3, { align: 'center', width: pw });
    doc.text(`Receipt #${receiptNumber}  |  Generated ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

export default router;
