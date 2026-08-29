import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import {
  TRA_ENDPOINTS,
  TRA_PAYMENT_TYPES,
  VFDConfig,
  VFDReceiptData,
  fetchTraToken,
  registerVfd,
  submitTraReceipt,
  toMoney,
} from '../services/vfdTra';

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

function sanitizeConfig(config: any): any {
  if (!config) return config;
  const copy = { ...config };
  if (copy.cert_private_key) copy.cert_private_key = copy.cert_private_key ? '••••••••••••' : '';
  if (copy.api_password) copy.api_password = copy.api_password ? '••••••••••••' : '';
  return copy;
}

async function getConfig(companyId: string) {
  const { data, error } = await supabase
    .from('vfd_configurations')
    .select('*')
    .eq('company_id', companyId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function logApi(entry: {
  companyId: string;
  action: string;
  endpoint?: string;
  requestPayload?: string;
  responsePayload?: string;
  status?: string;
  ackCode?: number | null;
  ackMessage?: string;
  errorMessage?: string;
  durationMs?: number;
  createdBy?: string;
}) {
  await supabase.from('vfd_api_logs').insert({
    company_id: entry.companyId,
    action: entry.action,
    endpoint: entry.endpoint,
    request_payload: entry.requestPayload,
    response_payload: entry.responsePayload,
    status: entry.status,
    ack_code: entry.ackCode,
    ack_message: entry.ackMessage,
    error_message: entry.errorMessage,
    duration_ms: entry.durationMs,
    created_by: entry.createdBy,
  });
}

function mapPaymentType(method?: string): string {
  return TRA_PAYMENT_TYPES[(method || 'cash').toLowerCase()] || 'CASH';
}

// ============================================
// CONFIGURATION
// ============================================

router.get('/config', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.json({ data: null });
      return;
    }
    res.json({ data: sanitizeConfig(config) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch VFD configuration' });
  }
});

router.put('/config', checkPermission('vfd', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }

    const existing = await getConfig(companyId);
    const incoming = { ...req.body };

    if (incoming.cert_private_key === '••••••••••••' && existing?.cert_private_key) {
      incoming.cert_private_key = existing.cert_private_key;
    }
    if (incoming.api_password === '••••••••••••' && existing?.api_password) {
      incoming.api_password = existing.api_password;
    }

    delete incoming.id;
    delete incoming.created_at;
    delete incoming.updated_at;

    const payload = { company_id: companyId, ...incoming, updated_at: new Date().toISOString() };

    let result;
    if (existing) {
      result = await supabase
        .from('vfd_configurations')
        .update(payload)
        .eq('company_id', companyId)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('vfd_configurations')
        .insert(payload)
        .select('*')
        .single();
    }

    if (result.error) throw result.error;
    res.json({ data: sanitizeConfig(result.data) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save VFD configuration' });
  }
});

// ============================================
// STATUS / DASHBOARD
// ============================================

router.get('/status', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }

    const config = await getConfig(companyId);

    const [receipts, pending, accepted, rejected, logs] = await Promise.all([
      supabase.from('vfd_receipts').select('id', { count: 'exact' }).eq('company_id', companyId),
      supabase.from('vfd_receipts').select('id', { count: 'exact' }).eq('company_id', companyId).in('status', ['pending', 'failed']),
      supabase.from('vfd_receipts').select('id', { count: 'exact' }).eq('company_id', companyId).eq('status', 'accepted'),
      supabase.from('vfd_receipts').select('id', { count: 'exact' }).eq('company_id', companyId).eq('status', 'rejected'),
      supabase.from('vfd_api_logs').select('id', { count: 'exact' }).eq('company_id', companyId),
    ]);

    const tokenValid = config?.token && config.token_expires_at && new Date(config.token_expires_at) > new Date();

    res.json({
      data: {
        config: config ? sanitizeConfig(config) : null,
        hasConfig: !!config,
        token_valid: !!tokenValid,
        token_expires_at: config?.token_expires_at || null,
        environment: config?.environment || 'test',
        gc: config?.gc || 0,
        dc: config?.dc || 0,
        z_date: config?.z_date || null,
        next_receipt_number: config?.next_receipt_number || 1,
        counters: {
          total: receipts.count || 0,
          pending: pending.count || 0,
          accepted: accepted.count || 0,
          rejected: rejected.count || 0,
        },
        log_count: logs.count || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch VFD status' });
  }
});

// ============================================
// TRA CONNECTION ACTIONS
// ============================================

router.post('/token', checkPermission('vfd', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.status(400).json({ error: 'VFD configuration not found. Save your configuration first.' });
      return;
    }

    const endpoints = TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test;
    const started = Date.now();

    try {
      const token = await fetchTraToken(config as VFDConfig, endpoints);
      const expiresIn = Number(token.expires_in) || 86399;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const { error } = await supabase
        .from('vfd_configurations')
        .update({ token: token.access_token, token_expires_at: expiresAt })
        .eq('company_id', companyId);

      if (error) throw error;

      await logApi({
        companyId,
        action: 'token',
        endpoint: endpoints.token,
        status: 'success',
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });

      res.json({ data: { token_type: token.token_type, expires_in: expiresIn, expires_at: expiresAt } });
    } catch (error: any) {
      await logApi({
        companyId,
        action: 'token',
        endpoint: endpoints.token,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });
      res.status(400).json({ error: error.message || 'Failed to fetch TRA token' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TRA token' });
  }
});

router.post('/register', checkPermission('vfd', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.status(400).json({ error: 'VFD configuration not found. Save your configuration first.' });
      return;
    }

    const endpoints = TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test;
    const started = Date.now();

    try {
      const result = await registerVfd(config as VFDConfig, endpoints);

      if (result.ackCode === 0 && result.fields) {
        const f = result.fields;
        const update = {
          regid: f.regid ?? config.regid,
          efd_serial: f.serial ?? config.efd_serial,
          tin: f.tin ?? config.tin,
          uin: f.uin ?? config.uin,
          vrn: f.vrn ?? config.vrn,
          business_name: f.name ?? config.business_name,
          business_address: f.address ?? config.business_address,
          tax_office: f.taxoffice ?? config.tax_office,
          tax_region: f.region ?? config.tax_region,
          receipt_code: f.receiptcode ?? config.receipt_code,
          gc: f.gc ?? config.gc,
          tax_code: f.taxcode ?? config.tax_code,
          api_username: f.username ?? config.api_username,
          api_password: f.password ?? config.api_password,
          updated_at: new Date().toISOString(),
        };
        const upd = await supabase
          .from('vfd_configurations')
          .update(update)
          .eq('company_id', companyId)
          .select('*')
          .single();
        if (upd.error) throw upd.error;
        result.savedConfig = sanitizeConfig(upd.data);
      }

      await logApi({
        companyId,
        action: 'register',
        endpoint: endpoints.register,
        responsePayload: result.rawXml.slice(0, 4000),
        status: result.ackCode === 0 ? 'success' : 'error',
        ackCode: result.ackCode,
        ackMessage: result.ackMsg,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });

      res.json({ data: result });
    } catch (error: any) {
      await logApi({
        companyId,
        action: 'register',
        endpoint: endpoints.register,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });
      res.status(400).json({ error: error.message || 'Registration request failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Registration request failed' });
  }
});

router.post('/test-connection', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.status(400).json({ error: 'VFD configuration not found' });
      return;
    }

    const endpoints = TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test;
    const started = Date.now();

    try {
      const token = await fetchTraToken(config as VFDConfig, endpoints);
      await logApi({
        companyId,
        action: 'test',
        endpoint: endpoints.token,
        status: 'success',
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });
      res.json({ data: { connected: true, message: `Connected to TRA ${config.environment} environment` } });
    } catch (error: any) {
      await logApi({
        companyId,
        action: 'test',
        endpoint: endpoints.token,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });
      res.json({ data: { connected: false, message: error.message || 'Connection failed' } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Connection test failed' });
  }
});

// ============================================
// TAX RATES
// ============================================

router.get('/tax-rates', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    let { data, error } = await supabase
      .from('vfd_tax_rates')
      .select('*')
      .eq('company_id', companyId)
      .order('code');

    if (!data || data.length === 0) {
      const defaults = [
        { code: 'A', name: 'Standard VAT', rate: 18, tra_tax_code: 1, description: 'Standard Rate (18%)' },
        { code: 'B', name: 'Special Rate', rate: 0, tra_tax_code: 2, description: 'Special Rate (0%)' },
        { code: 'C', name: 'Zero Rated', rate: 0, tra_tax_code: 3, description: 'Zero Rated for Non-VAT items' },
        { code: 'D', name: 'Special Relief', rate: 0, tra_tax_code: 4, description: 'Special Relief for relieved items' },
        { code: 'E', name: 'Exempt', rate: 0, tra_tax_code: 5, description: 'Exempt items' },
      ];
      const { data: seeded, error: seedErr } = await supabase
        .from('vfd_tax_rates')
        .insert(defaults.map((d) => ({ company_id: companyId, ...d })))
        .select('*');
      if (seedErr) throw seedErr;
      data = seeded;
    }

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tax rates' });
  }
});

router.post('/tax-rates', checkPermission('vfd', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const { code, name, rate, tra_tax_code, description } = req.body;
    const { data, error } = await supabase
      .from('vfd_tax_rates')
      .insert({ company_id: companyId, code, name, rate, tra_tax_code, description })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tax rate' });
  }
});

router.put('/tax-rates/:id', checkPermission('vfd', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('vfd_tax_rates')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tax rate' });
  }
});

// ============================================
// RECEIPT GENERATION
// ============================================

interface ReceiptLineInput {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_code?: number;
  item_id?: string;
}

router.post('/receipts', checkPermission('vfd', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.status(400).json({ error: 'VFD configuration not found. Save your configuration first.' });
      return;
    }

    const { invoice_id, sale_id, source_type = 'manual', items, customer, payment_method, currency = config.currency || 'TZS', notes } = req.body;

    let invoice: any = null;
    let invoiceItems: any[] = [];

    const saleRef = invoice_id || sale_id;
    if (saleRef) {
      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .select('*, customer:customers!invoices_customer_id_fkey(company_name, contact_person, email, phone)')
        .eq('id', saleRef)
        .single();
      if (invErr) {
        res.status(404).json({ error: 'Sale/invoice not found' });
        return;
      }
      invoice = inv;
      const { data: it, error: itErr } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', saleRef)
        .order('sort_order');
      if (itErr) throw itErr;
      invoiceItems = it || [];
    }

    if (!invoice && (!items || !items.length)) {
      res.status(400).json({ error: 'Provide invoice_id/sale_id or receipt line items' });
      return;
    }

    const rateDefault = Number(config.default_tax_rate ?? 18);

    const effectiveItems: ReceiptLineInput[] = invoice
      ? invoiceItems.map((it: any) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          tax_rate: Number(it.tax_rate) > 0 ? Number(it.tax_rate) : Number(invoice.tax_rate) > 0 ? Number(invoice.tax_rate) : rateDefault,
          item_id: it.id,
        }))
      : (items as ReceiptLineInput[]);

    const { data: taxRates } = await supabase
      .from('vfd_tax_rates')
      .select('*')
      .eq('company_id', companyId);

    const taxCodes: Record<string, { code: string; tra_tax_code: number }> = {};
    (taxRates || []).forEach((tr: any) => {
      taxCodes[String(tr.rate)] = { code: tr.code, tra_tax_code: tr.tra_tax_code };
    });

    const resolveTax = (rate?: number) => {
      const rateKey = String(Number(rate ?? rateDefault));
      return taxCodes[rateKey] || taxCodes[String(rateDefault)] || { code: 'A', tra_tax_code: 1 };
    };

    const lineItems = effectiveItems.map((it, idx) => {
      const amount = Number(it.quantity) * Number(it.unit_price);
      const tax = resolveTax(it.tax_rate);
      return {
        id: it.item_id || String(idx + 1),
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        taxRate: tax.code,
        taxCode: it.tax_code || tax.tra_tax_code,
        amount,
        vat: amount * Number(it.tax_rate ?? rateDefault) / 100,
      };
    });

    const discount = invoice ? Number(invoice.discount_amount) || 0 : Number(req.body.discount) || 0;
    const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
    const taxAmount = lineItems.reduce((s, i) => s + i.vat, 0);
    const totalAmount = subtotal + taxAmount - discount;

    const customerIdType = customer?.tin ? 1 : 6;
    const customerName =
      customer?.name ||
      invoice?.customer?.company_name ||
      invoice?.customer?.contact_person ||
      'Walk-in Customer';
    const customerMobile =
      customer?.mobile ||
      invoice?.customer?.phone ||
      '';
    const customerTin = customer?.tin || invoice?.customer?.tin || '';

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const todayZ = `${yyyy}${mm}${dd}`;
    const isNewDay = !config.z_date || config.z_date !== dateStr;
    const dc = isNewDay ? 1 : Number(config.dc) + 1;
    const gc = Number(config.gc) + 1;
    const znum = todayZ;
    const receiptNumber = `${config.receipt_prefix || 'RCT'}-${String(gc).padStart(6, '0')}`;
    const rctvnum = `${config.receipt_code || ''}${gc}`;
    const verifyBase = TRA_ENDPOINTS[(config.environment as 'test' | 'production')]?.verify || TRA_ENDPOINTS.test.verify;
    const verificationUrl = `${verifyBase}${config.receipt_code || ''}${gc}_${timeStr.replace(/:/g, '')}`;

    const paymentType = mapPaymentType(payment_method);

    const vatTotals: { rate: string; netAmount: number; taxAmount: number }[] = [];
    const vatMap = new Map<string, { netAmount: number; taxAmount: number }>();
    lineItems.forEach((i) => {
      const entry = vatMap.get(i.taxRate) || { netAmount: 0, taxAmount: 0 };
      entry.netAmount += i.amount;
      entry.taxAmount += i.vat;
      vatMap.set(i.taxRate, entry);
    });
    vatMap.forEach((val, rate) => {
      vatTotals.push({ rate, netAmount: val.netAmount, taxAmount: val.taxAmount });
    });

    const receiptData: VFDReceiptData = {
      receipt_number: receiptNumber,
      date: dateStr,
      time: timeStr,
      tin: config.tin || '',
      regid: config.regid || '',
      efdSerial: config.efd_serial || config.certkey || '',
      rctNum: String(gc),
      dc,
      gc,
      zNum: znum,
      rctvNum: rctvnum,
      customerName,
      customerIdType,
      customerId: customerTin,
      customerMobile: String(customerMobile || '').replace(/[^0-9]/g, ''),
      items: lineItems.map((i) => ({
        id: String(i.id),
        description: i.description,
        quantity: i.quantity,
        taxCode: i.taxCode,
        amount: i.amount,
      })),
      totals: {
        totalTaxExcl: subtotal,
        totalTaxIncl: totalAmount,
        discount,
      },
      payments: [{ type: paymentType, amount: totalAmount }],
      vatTotals,
    };

    const { data: receipt, error: insErr } = await supabase
      .from('vfd_receipts')
      .insert({
        company_id: companyId,
        sale_id: invoice?.id || sale_id || null,
        source_type,
        receipt_number: receiptNumber,
        rctnum: String(gc),
        dc,
        gc,
        znum,
        rctvnum,
        receipt_date: dateStr,
        receipt_time: timeStr,
        tin: config.tin || '',
        vrn: config.vrn || '',
        efd_serial: config.efd_serial || '',
        regid: config.regid || '',
        uin: config.uin || '',
        verification_code: rctvnum,
        verification_url: verificationUrl,
        customer_name: customerName,
        customer_tin: customerTin,
        customer_mobile: customerMobile,
        customer_id_type: customerIdType,
        customer_id: customerTin,
        subtotal: toMoney(subtotal),
        discount: toMoney(discount),
        tax_amount: toMoney(taxAmount),
        total_amount: toMoney(totalAmount),
        currency,
        payment_type: paymentType,
        status: 'pending',
        request_payload: JSON.stringify({ receiptData, notes }),
        created_by: req.user!.id,
      })
      .select('*')
      .single();

    if (insErr) throw insErr;

    const { error: itemsErr } = await supabase.from('vfd_receipt_items').insert(
      lineItems.map((i, idx) => ({
        receipt_id: receipt.id,
        item_id: String(i.id),
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        tax_code: i.taxCode,
        tax_rate: i.taxRate,
        amount: i.amount,
        sort_order: idx,
      }))
    );
    if (itemsErr) throw itemsErr;

    await supabase
      .from('vfd_configurations')
      .update({ gc, dc, z_date: dateStr })
      .eq('company_id', companyId);

    const canSubmit = config.auto_submit !== false && !!config.cert_private_key && !!config.regid;

    if (canSubmit) {
      const tokenValid = !!config.token && !!config.token_expires_at && new Date(config.token_expires_at) > new Date();
      let token = config.token;

      if (!tokenValid) {
        try {
          const tokenRes = await fetchTraToken(
            config as VFDConfig,
            TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test
          );
          token = tokenRes.access_token;
          await supabase
            .from('vfd_configurations')
            .update({
              token,
              token_expires_at: new Date(Date.now() + (Number(tokenRes.expires_in) || 86399) * 1000).toISOString(),
            })
            .eq('company_id', companyId);
        } catch {
          token = '';
        }
      }

      if (token) {
        const result = await submitTraReceipt(
          config as VFDConfig,
          TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test,
          receiptData,
          token,
          (req.body.signature_algorithm as 'sha1' | 'sha256') || 'sha1'
        ).catch(async (err: any) => {
          await supabase
            .from('vfd_receipts')
            .update({ status: 'failed', ack_message: err.message, last_attempt_at: new Date().toISOString(), retry_count: 1 })
            .eq('id', receipt.id);
          return null;
        });

        if (result) {
          const { ok, ack } = result;
          await supabase
            .from('vfd_receipts')
            .update({
              status: ok ? 'accepted' : 'rejected',
              ack_code: ack.ackCode,
              ack_message: ack.ackMsg,
              response_payload: ack.rawXml,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', receipt.id);
        }
      }
    }

    const { data: finalReceipt } = await supabase.from('vfd_receipts').select('*').eq('id', receipt.id).single();
    res.status(201).json({ data: finalReceipt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate fiscal receipt' });
  }
});

// ============================================
// RECEIPT LIST / DETAIL
// ============================================

router.get('/receipts', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const { status, search, from, to, page = 1, limit = 20 } = req.query;
    let query = supabase
      .from('vfd_receipts')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId);

    if (status) query = query.eq('status', status);
    if (from) query = query.gte('receipt_date', from);
    if (to) query = query.lte('receipt_date', to);
    if (search) {
      query = query.or(`receipt_number.ilike.%${search}%,customer_name.ilike.%${search}%,rctvnum.ilike.%${search}%`);
    }

    const fromIdx = (Number(page) - 1) * Number(limit);
    const toIdx = fromIdx + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);
    if (error) throw error;
    res.json({ data: data || [], count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fiscal receipts' });
  }
});

router.get('/receipts/:id', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('vfd_receipts')
      .select('*, items:vfd_receipt_items(*)')
      .eq('id', req.params.id)
      .single();
    if (error) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

router.post('/receipts/:id/submit', checkPermission('vfd', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const config = await getConfig(companyId);
    if (!config) {
      res.status(400).json({ error: 'VFD configuration not found' });
      return;
    }

    const { data: receipt, error: rErr } = await supabase
      .from('vfd_receipts')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single();
    if (rErr || !receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    if (receipt.status === 'accepted') {
      res.status(400).json({ error: 'Receipt already accepted by TRA' });
      return;
    }

    const requested = receipt.request_payload ? JSON.parse(receipt.request_payload) : null;
    if (!requested?.receiptData) {
      res.status(400).json({ error: 'Receipt payload is missing' });
      return;
    }

    let token = config.token;
    const tokenValid = config.token && config.token_expires_at && new Date(config.token_expires_at) > new Date();
    if (!tokenValid) {
      const endpoints = TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test;
      const tokenRes = await fetchTraToken(config as VFDConfig, endpoints);
      token = tokenRes.access_token;
      await supabase
        .from('vfd_configurations')
        .update({ token, token_expires_at: new Date(Date.now() + (Number(tokenRes.expires_in) || 86399) * 1000).toISOString() })
        .eq('company_id', companyId);
    }

    const endpoints = TRA_ENDPOINTS[(config.environment as 'test' | 'production')] || TRA_ENDPOINTS.test;
    const started = Date.now();
    const signatureAlgorithm = (req.body.signature_algorithm as 'sha1' | 'sha256') || 'sha1';

    try {
      const { ok, ack } = await submitTraReceipt(
        config as VFDConfig,
        endpoints,
        requested.receiptData,
        token,
        signatureAlgorithm
      );

      await supabase
        .from('vfd_receipts')
        .update({
          status: ok ? 'accepted' : 'rejected',
          ack_code: ack.ackCode,
          ack_message: ack.ackMsg,
          response_payload: ack.rawXml,
          retry_count: (receipt.retry_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', receipt.id);

      await logApi({
        companyId,
        action: 'receipt',
        endpoint: endpoints.receipt,
        responsePayload: ack.rawXml.slice(0, 4000),
        status: ok ? 'success' : 'error',
        ackCode: ack.ackCode,
        ackMessage: ack.ackMsg,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });

      res.json({ data: { ok, ack } });
    } catch (error: any) {
      await supabase
        .from('vfd_receipts')
        .update({ status: 'failed', ack_message: error.message, retry_count: (receipt.retry_count || 0) + 1, last_attempt_at: new Date().toISOString() })
        .eq('id', receipt.id);
      await logApi({
        companyId,
        action: 'receipt',
        endpoint: endpoints.receipt,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - started,
        createdBy: req.user!.id,
      });
      res.status(400).json({ error: error.message || 'Failed to submit receipt to TRA' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit receipt to TRA' });
  }
});

router.post('/receipts/:id/void', checkPermission('vfd', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const { reason } = req.body;

    const { data: receipt, error: rErr } = await supabase
      .from('vfd_receipts')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single();
    if (rErr || !receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }
    if (receipt.status === 'voided') {
      res.status(400).json({ error: 'Receipt already voided' });
      return;
    }

    const { data: cancellation, error: cErr } = await supabase
      .from('vfd_cancellations')
      .insert({
        company_id: companyId,
        receipt_id: receipt.id,
        reason: reason || 'Voided',
        amount: Number(receipt.total_amount) || 0,
        original_rctnum: receipt.rctnum,
        original_rctvnum: receipt.rctvnum,
        status: 'voided',
        created_by: req.user!.id,
      })
      .select('*')
      .single();
    if (cErr) throw cErr;

    const { data, error } = await supabase
      .from('vfd_receipts')
      .update({ status: 'voided', void_reason: reason || null, updated_at: new Date().toISOString() })
      .eq('id', receipt.id)
      .select('*')
      .single();
    if (error) throw error;

    res.json({ data: { receipt: data, cancellation } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to void receipt' });
  }
});

// ============================================
// LOGS
// ============================================

router.get('/logs', checkPermission('vfd', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user!.company_id);
    if (!companyId) {
      res.status(400).json({ error: 'No company assigned to your account' });
      return;
    }
    const { action, limit = 50 } = req.query;
    let query = supabase
      .from('vfd_api_logs')
      .select('*')
      .eq('company_id', companyId);
    if (action) query = query.eq('action', action);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API logs' });
  }
});

export default router;
