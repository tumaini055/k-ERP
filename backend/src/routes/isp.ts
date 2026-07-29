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
      .select('*')
      .single();

    if (error) throw error;
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
    doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold');
    doc.text('GRAND TOTAL', sumX + 10, y + 8, { width: 100 });
    doc.text(fmt(bill.amount), sumX + 10, y + 8, { width: sumW - 20, align: 'right' });

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

export default router;
