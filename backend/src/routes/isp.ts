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
    const { status, package_id, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('isp_subscribers')
      .select('*, customer:customers!isp_subscribers_customer_id_fkey(company_name, contact_person, phone), package:isp_packages!isp_subscribers_package_id_fkey(name, bandwidth_download, bandwidth_upload, price)', { count: 'exact' });

    if (status) query = query.eq('service_status', status);
    if (package_id) query = query.eq('package_id', package_id);
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
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment' });
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
