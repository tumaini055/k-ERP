import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateInvoiceNumber } from '../utils/helpers';
import path from 'path';

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
// INVOICE PDF
// ============================================

router.get('/invoices/:id/pdf', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, customer:customers!invoices_customer_id_fkey(company_name, contact_person, email, phone, address)')
      .eq('id', req.params.id)
      .single();

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', req.params.id)
      .order('sort_order');

    // Fetch company settings for dynamic branding
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

    const docType = invoice.invoice_type?.toUpperCase() || 'INVOICE';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${docType.toLowerCase()}-${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    let y = 0;

    // ============================================
    // TOP RED BANNER
    // ============================================
    doc.rect(0, 0, doc.page.width, 48).fill('#dc2626');
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text(docType, lm, 14, { align: 'center', width: pw });

    y = 68;

    // ============================================
    // HEADER: Logo + Company Info (left) / Reference (right)
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

    // --- Right side: Reference box ---
    const refBoxY = y + 2;
    const refLabel = invoice.invoice_type === 'quotation' ? 'Quotation No' : invoice.invoice_type === 'proforma' ? 'Proforma Invoice No' : 'Invoice No';

    const refPad = 8;
    const refInnerW = refBoxW - refPad * 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill('#fef2f2').strokeColor('#dc2626').lineWidth(0.5).stroke();
    doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold').text(refLabel, refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(invoice.invoice_number, refBoxX + refPad, refBoxY + 20, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    if (invoice.invoice_date) {
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
      refRowY += 11;
    }
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 58;

    y = Math.max(leftEndY, rightEndY) + 16;

    // ============================================
    // BILL TO / SHIP TO
    // ============================================
    const customerName = invoice.customer
      ? (invoice.customer.company_name || invoice.customer.contact_person || '\u2014')
      : '\u2014';

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('BILL TO', lm, y);
    doc.text('SHIP TO', rm - 200, y);
    y += 14;

    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(customerName, lm, y);
    doc.text(customerName, rm - 200, y);
    y += 12;

    if (invoice.customer?.email) {
      doc.text(invoice.customer.email, lm, y);
      doc.text(invoice.customer.email, rm - 200, y);
      y += 12;
    }
    if (invoice.customer?.phone) {
      doc.text(invoice.customer.phone, lm, y);
      doc.text(invoice.customer.phone, rm - 200, y);
      y += 12;
    }
    if (invoice.customer?.address) {
      const addrH = doc.heightOfString(invoice.customer.address, { width: 200 });
      doc.text(invoice.customer.address, lm, y, { width: 200 });
      doc.text(invoice.customer.address, rm - 200, y, { width: 200 });
      y += Math.max(addrH, 12);
    }

    y += 10;

    // ============================================
    // DIVIDER
    // ============================================
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 12;

    // ============================================
    // NOTES / SCOPE
    // ============================================
    if (invoice.notes) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Project Notes', lm, y);
      y += 14;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
      doc.text(invoice.notes, lm, y, { width: pw });
      y += doc.heightOfString(invoice.notes, { width: pw }) + 14;
    }

    // ============================================
    // ITEMS TABLE
    // ============================================
    const tableTop = y;
    const colW = [18, 260, 38, 90, 95];
    const colX = [lm];
    for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];
    const tableWidth = colW.reduce((s, w) => s + w, 0);
    const headerH = 22;
    const rowH = 19;

    const headerTexts = ['SN', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL PRICE'];
    const headerAligns: ('left' | 'right')[] = ['left', 'left', 'left', 'right', 'right'];

    // Header
    doc.roundedRect(colX[0], tableTop, tableWidth, headerH, 2).fill('#dc2626');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    for (let i = 0; i < headerTexts.length; i++) {
      doc.text(headerTexts[i], colX[i], tableTop + 6, { width: colW[i], align: headerAligns[i] });
    }

    y = tableTop + headerH;

    // Rows
    doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
    let grandTotal = 0;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemTotal = Number(item.total_price || 0);
        grandTotal += itemTotal;

        if (i % 2 === 0) {
          doc.rect(colX[0], y, tableWidth, rowH).fill('#f9fafb');
        }
        doc.fillColor('#374151');
        doc.text(String(i + 1), colX[0], y + 5, { width: colW[0], align: 'center' });
        doc.text(item.description || '\u2014', colX[1] + 4, y + 5, { width: colW[1] - 8, align: 'left' });
        doc.text(String(item.quantity), colX[2], y + 5, { width: colW[2], align: 'center' });
        doc.text(`${currencySymbol}${Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colX[3], y + 5, { width: colW[3], align: 'right' });
        doc.text(`${currencySymbol}${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colX[4], y + 5, { width: colW[4], align: 'right' });
        y += rowH;

        if (y > 690) {
          doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
          doc.addPage();
          y = 45;
          doc.roundedRect(colX[0], y, tableWidth, headerH, 2).fill('#dc2626');
          doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
          for (let j = 0; j < headerTexts.length; j++) {
            doc.text(headerTexts[j], colX[j], y + 6, { width: colW[j], align: headerAligns[j] });
          }
          y += headerH;
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
        }
      }
    }

    // Bottom border
    doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 6;

    // ============================================
    // SUMMARY (right-aligned)
    // ============================================
    const sumX = colX[3];
    const sumW = colW[3] + colW[4];
    const fmt = (n: number) => `${currencySymbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    doc.fontSize(9);
    const summaryRows: { label: string; value: string; bold?: boolean }[] = [];
    if (Number(invoice.subtotal) > 0) summaryRows.push({ label: 'Subtotal', value: fmt(invoice.subtotal) });
    if (Number(invoice.tax_rate) > 0) summaryRows.push({ label: `Tax (${invoice.tax_rate}%)`, value: fmt(invoice.tax_amount) });
    if (Number(invoice.discount_amount) > 0) summaryRows.push({ label: 'Discount', value: `-${fmt(invoice.discount_amount)}` });

    const summaryH = summaryRows.length * 16;
    const grandBoxH = 30;
    const totalSummaryH = summaryH + grandBoxH + 6;

    // Background box for summary
    doc.rect(sumX, y, sumW, totalSummaryH).fill('#f9fafb');

    for (const row of summaryRows) {
      doc.font('Helvetica').fillColor('#4b5563');
      doc.text(row.label, sumX + 8, y + 4, { width: 80 });
      doc.text(row.value, sumX + 8, y + 4, { width: sumW - 16, align: 'right' });
      y += 16;
    }

    // Grand Total
    y += 3;
    doc.roundedRect(sumX + 2, y, sumW - 4, grandBoxH, 3).fill('#dc2626');
    doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold');
    doc.text('GRAND TOTAL', sumX + 10, y + 8, { width: 100 });
    doc.text(fmt(invoice.total_amount || grandTotal), sumX + 10, y + 8, { width: sumW - 20, align: 'right' });

    y += grandBoxH + 22;

    // ============================================
    // TERMS & CONDITIONS
    // ============================================
    const termsTitle = invoice.invoice_type === 'quotation' ? 'Terms & Conditions' : 'Terms & Conditions of Payment';
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text(`${termsTitle}:`, lm, y);
    y += 14;

    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    if (invoice.terms) {
      doc.text(invoice.terms, lm, y, { width: pw });
      y += doc.heightOfString(invoice.terms, { width: pw }) + 12;
    } else {
      const defaultTerms = [
        '100% Upfront Invoice Value Payment Payable by Cash/Bank Wire Transfer.',
        'This proforma invoice is valid for a period of 14 Days from the date of quotation.',
        'Goods/Services will be delivery within 4 days Working Days after client approval of supplied.',
      ];
      for (const t of defaultTerms) {
        doc.text(`\u2022 ${t}`, lm, y, { width: pw });
        y += doc.heightOfString(`\u2022 ${t}`, { width: pw }) + 5;
      }
      y += 8;
    }

    // ============================================
    // BANK DETAILS
    // ============================================
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

    // ============================================
    // PREPARED BY / AUTHORIZED SIGNATURE
    // ============================================
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('PREPARED BY', lm, y);
    doc.text('AUTHORIZED SIGNATURE', rm - 200, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9);
    doc.text(`${req.user?.first_name || ''} ${req.user?.last_name || ''}`, lm, y);
    doc.moveTo(rm - 200, y + 2).lineTo(rm - 30, y + 2).strokeColor('#9ca3af').lineWidth(0.5).stroke();

    // ============================================
    // FOOTER
    // ============================================
    const footY = doc.page.height - 32;
    doc.rect(0, footY - 6, doc.page.width, 32).fill('#dc2626');
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica');
    const footerParts = [companyName];
    if (companyEmail) footerParts.push(companyEmail);
    if (companyWebsite) footerParts.push(companyWebsite);
    doc.text(footerParts.join('  |  '), lm, footY + 3, { align: 'center', width: pw });
    doc.text(`${docType} #${invoice.invoice_number}  |  Generated ${new Date().toLocaleDateString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

router.get('/invoices', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, customer_id, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('invoices')
      .select('*, customer:customers!invoices_customer_id_fkey(company_name, contact_person)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('invoice_type', type);
    if (customer_id) query = query.eq('customer_id', customer_id);

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
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customer:customers!invoices_customer_id_fkey(*), items:invoice_items(*), payments:payments(*)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/invoices', checkPermission('finance', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { items, ...invoiceData } = req.body;
    const invoiceNumber = generateInvoiceNumber();

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = subtotal * (invoiceData.tax_rate ?? 18) / 100;
    const totalAmount = subtotal + taxAmount - (invoiceData.discount_amount || 0);

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        invoice_number: invoiceNumber,
        company_id: req.user!.company_id,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        balance: totalAmount,
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (error) throw error;

    const invoiceItems = items.map((item: any, index: number) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate ?? invoiceData.tax_rate ?? 18,
      tax_amount: (item.quantity * item.unit_price) * (item.tax_rate ?? invoiceData.tax_rate ?? 18) / 100,
      total_price: item.quantity * item.unit_price,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) throw itemsError;

    res.status(201).json({ data: invoice });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/invoices/:id', checkPermission('finance', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { items, ...invoiceData } = req.body;
    if (items) {
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const taxAmount = subtotal * (invoiceData.tax_rate ?? 18) / 100;
      invoiceData.subtotal = subtotal;
      invoiceData.tax_amount = taxAmount;
      invoiceData.total_amount = subtotal + taxAmount - (invoiceData.discount_amount || 0);
      invoiceData.balance = invoiceData.total_amount - (invoiceData.paid_amount || 0);
    }
    const { data, error } = await supabase
      .from('invoices')
      .update({ ...invoiceData, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    if (items) {
      await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
      const invoiceItems = items.map((item: any, index: number) => ({
        invoice_id: req.params.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || invoiceData.tax_rate || 18,
        tax_amount: (item.quantity * item.unit_price) * (item.tax_rate || invoiceData.tax_rate || 18) / 100,
        total_price: item.quantity * item.unit_price,
        sort_order: index,
      }));
      await supabase.from('invoice_items').insert(invoiceItems);
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.post('/invoices/:id/payments', checkPermission('finance', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, payment_method, reference_number, notes } = req.body;

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        invoice_id: req.params.id,
        customer_id: invoice.customer_id,
        company_id: req.user!.company_id,
        payment_number: `PAY-${Date.now()}`,
        amount,
        payment_method,
        reference_number,
        notes,
        received_by: req.user!.id,
      })
      .select()
      .single();

    if (error) throw error;

    const paidAmount = (invoice.paid_amount || 0) + Number(amount);
    const balance = invoice.total_amount - paidAmount;
    const status = balance <= 0 ? 'paid' : (paidAmount > 0 ? 'sent' : invoice.status);

    await supabase
      .from('invoices')
      .update({
        paid_amount: paidAmount,
        balance,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    res.status(201).json({ data: payment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.delete('/invoices/:id', checkPermission('finance', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    // Delete related records first to avoid FK violations
    const { error: payErr } = await supabase.from('payments').delete().eq('invoice_id', req.params.id);
    if (payErr) throw payErr;

    const { error } = await supabase.from('invoices').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Invoice deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete invoice' });
  }
});

router.get('/expenses', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, project_id, from_date, to_date, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('expenses')
      .select('*, project:projects(name), user:users!expenses_created_by_fkey(first_name, last_name)', { count: 'exact' });

    if (category) query = query.eq('category', category);
    if (project_id) query = query.eq('project_id', project_id);
    if (from_date) query = query.gte('expense_date', from_date);
    if (to_date) query = query.lte('expense_date', to_date);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('expense_date', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.post('/expenses', checkPermission('finance', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...req.body, company_id: req.user!.company_id, created_by: req.user!.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.delete('/expenses/:id', checkPermission('finance', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

router.get('/revenue', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { from_date, to_date } = req.query;
    const startDate = (from_date as string) || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const endDate = (to_date as string) || new Date().toISOString();

    let query = supabase
      .from('payments')
      .select('amount, payment_date, payment_method')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;

    const totalRevenue = data.reduce((sum, p) => sum + Number(p.amount), 0);
    const byMethod = data.reduce((acc: any, p) => {
      acc[p.payment_method] = (acc[p.payment_method] || 0) + Number(p.amount);
      return acc;
    }, {});

    const startStr = startDate.split('T')[0];
    const endStr = endDate.split('T')[0];

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('expense_date', startStr)
      .lte('expense_date', endStr);

    const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const expensesByCategory = (expenses || []).reduce((acc: any, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {});

    const profit = totalRevenue - totalExpenses;

    res.json({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      profit,
      expenses_by_category: expensesByCategory,
      payments: data,
      by_method: byMethod,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// ============================================
// CASH REQUESTS
// ============================================

const generateCashRequestNumber = (): string => {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `CR-${year}-${num}`;
};

router.get('/cash-requests', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    let query = supabase
      .from('cash_requests')
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name, email), approved_by_user:users!cash_requests_approved_by_fkey(first_name, last_name), disbursed_by_user:users!cash_requests_disbursed_by_fkey(first_name, last_name)', { count: 'exact' });

    if (req.user?.role !== 'super_admin' && req.user?.role !== 'ceo' && req.user?.role !== 'managing_director') {
      query = query.eq('requested_by', req.user!.id);
    }

    if (status) query = query.eq('status', status);

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
    res.status(500).json({ error: 'Failed to fetch cash requests' });
  }
});

router.get('/cash-requests/summary', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);
    let query = supabase.from('cash_requests').select('status, amount');
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) throw error;

    const summary = {
      total_requests: data.length,
      pending: data.filter((r: any) => r.status === 'pending').length,
      approved: data.filter((r: any) => r.status === 'approved').length,
      rejected: data.filter((r: any) => r.status === 'rejected').length,
      disbursed: data.filter((r: any) => r.status === 'disbursed').length,
      total_requested: data.reduce((s: number, r: any) => s + Number(r.amount), 0),
      total_approved: data.filter((r: any) => r.status === 'approved' || r.status === 'disbursed').reduce((s: number, r: any) => s + Number(r.amount), 0),
      total_disbursed: data.filter((r: any) => r.status === 'disbursed').reduce((s: number, r: any) => s + Number(r.amount), 0),
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cash request summary' });
  }
});

router.get('/cash-requests/:id', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cash_requests')
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name, email, phone), approved_by_user:users!cash_requests_approved_by_fkey(first_name, last_name), disbursed_by_user:users!cash_requests_disbursed_by_fkey(first_name, last_name)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Cash request not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cash request' });
  }
});

router.post('/cash-requests', checkPermission('finance', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);
    const referenceNumber = generateCashRequestNumber();

    const { data, error } = await supabase
      .from('cash_requests')
      .insert({
        company_id: companyId,
        reference_number: referenceNumber,
        requested_by: req.user!.id,
        amount: req.body.amount,
        purpose: req.body.purpose,
        category: req.body.category || 'general',
        payment_method: req.body.payment_method || 'cash',
        notes: req.body.notes || '',
      })
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name, email)')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cash request' });
  }
});

router.put('/cash-requests/:id/approve', checkPermission('finance', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cash_requests')
      .update({
        status: 'approved',
        approved_by: req.user!.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name)')
      .single();

    if (error || !data) {
      res.status(400).json({ error: 'Cash request not found or already processed' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve cash request' });
  }
});

router.put('/cash-requests/:id/reject', checkPermission('finance', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { rejection_reason } = req.body;
    const { data, error } = await supabase
      .from('cash_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason || '',
        approved_by: req.user!.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name)')
      .single();

    if (error || !data) {
      res.status(400).json({ error: 'Cash request not found or already processed' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject cash request' });
  }
});

router.put('/cash-requests/:id/disburse', checkPermission('finance', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: cashRequest, error: fetchError } = await supabase
      .from('cash_requests')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .single();

    if (fetchError || !cashRequest) {
      res.status(400).json({ error: 'Cash request not found or not approved' });
      return;
    }

    const { data, error } = await supabase
      .from('cash_requests')
      .update({
        status: 'disbursed',
        disbursed_by: req.user!.id,
        disbursed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name)')
      .single();

    if (error || !data) {
      res.status(400).json({ error: 'Failed to update cash request status' });
      return;
    }

    const { error: expError } = await supabase
      .from('expenses')
      .insert({
        company_id: cashRequest.company_id,
        category: cashRequest.category || 'other',
        description: `Cash Request: ${cashRequest.reference_number} - ${cashRequest.purpose}`,
        amount: cashRequest.amount,
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: cashRequest.payment_method,
        paid_to: cashRequest.requested_by,
        approved_by: cashRequest.approved_by,
        created_by: req.user!.id,
      });

    if (expError) {
      console.error('Failed to create expense from cash request:', expError);
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disburse cash request' });
  }
});

router.put('/cash-requests/:id/cancel', checkPermission('finance', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cash_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      res.status(400).json({ error: 'Cash request not found or already processed' });
      return;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel cash request' });
  }
});

router.delete('/cash-requests/:id', checkPermission('finance', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('cash_requests').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Cash request deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cash request' });
  }
});

// ============================================
// CASH REQUEST PDF
// ============================================
router.get('/cash-requests/:id/pdf', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: cashRequest, error: fetchError } = await supabase
      .from('cash_requests')
      .select('*, requested_by_user:users!cash_requests_requested_by_fkey(first_name, last_name, email, phone), approved_by_user:users!cash_requests_approved_by_fkey(first_name, last_name), disbursed_by_user:users!cash_requests_disbursed_by_fkey(first_name, last_name)')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !cashRequest) {
      res.status(404).json({ error: 'Cash request not found' });
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
        if (s.tax_id) taxId = s.tax_id;
        if (s.logo_url) logoUrl = s.logo_url;
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
    res.setHeader('Content-Disposition', `attachment; filename="cash-request-${cashRequest.reference_number}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    let y = 0;

    doc.rect(0, 0, doc.page.width, 48).fill('#16a34a');
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('CASH REQUEST', lm, 14, { align: 'center', width: pw });

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
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill('#f0fdf4').strokeColor('#16a34a').lineWidth(0.5).stroke();
    doc.fillColor('#16a34a').fontSize(9).font('Helvetica-Bold').text('Request No', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(9).text(cashRequest.reference_number, refBoxX + refPad, refBoxY + 20, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    if (cashRequest.created_at) {
      doc.text(`Date: ${new Date(cashRequest.created_at).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
      refRowY += 11;
    }
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 58;
    y = Math.max(leftEndY, rightEndY) + 16;

    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 12;

    const statusLabel = (cashRequest.status || 'pending').toUpperCase();
    const statusColor = cashRequest.status === 'approved' || cashRequest.status === 'disbursed' ? '#16a34a' : cashRequest.status === 'rejected' ? '#dc2626' : '#f59e0b';
    doc.roundedRect(lm, y, 100, 22, 3).fill(statusColor);
    doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold').text(statusLabel, lm, y + 6, { width: 100, align: 'center' });
    y += 34;

    const fmt = (n: number) => `${currencySymbol}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const amountBoxW = 250;
    doc.roundedRect(lm, y, amountBoxW, 44, 4).fill('#f0fdf4').strokeColor('#16a34a').lineWidth(0.5).stroke();
    doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text('AMOUNT REQUESTED', lm + 12, y + 8);
    doc.fillColor('#16a34a').fontSize(20).font('Helvetica-Bold').text(fmt(cashRequest.amount), lm + 12, y + 22);
    y += 56;

    const drawField = (label: string, value: string, yPos: number) => {
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(label, lm, yPos);
      doc.fillColor('#111827').font('Helvetica').text(value || '\u2014', lm + 120, yPos, { width: pw - 120 });
      return yPos + 18;
    };

    y = drawField('Requested By', cashRequest.requested_by_user ? `${cashRequest.requested_by_user.first_name} ${cashRequest.requested_by_user.last_name}` : '\u2014', y);
    y = drawField('Email', cashRequest.requested_by_user?.email || '\u2014', y);
    y = drawField('Category', (cashRequest.category || 'general').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), y);
    y = drawField('Payment Method', (cashRequest.payment_method || 'cash').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), y);
    y = drawField('Request Date', cashRequest.created_at ? new Date(cashRequest.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014', y);

    y += 8;
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Purpose:', lm, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5).text(cashRequest.purpose || '\u2014', lm, y, { width: pw });
    y += doc.heightOfString(cashRequest.purpose || '\u2014', { width: pw }) + 12;

    if (cashRequest.notes) {
      doc.font('Helvetica-Bold').fillColor('#111827').fontSize(9).text('Notes:', lm, y);
      y += 14;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5).text(cashRequest.notes, lm, y, { width: pw });
      y += doc.heightOfString(cashRequest.notes, { width: pw }) + 12;
    }

    if (cashRequest.status === 'rejected' && cashRequest.rejection_reason) {
      doc.roundedRect(lm, y, pw, 40, 3).fill('#fef2f2');
      doc.fillColor('#dc2626').fontSize(9).font('Helvetica-Bold').text('Rejection Reason', lm + 10, y + 6);
      doc.font('Helvetica').fillColor('#991b1b').fontSize(8.5).text(cashRequest.rejection_reason, lm + 10, y + 20, { width: pw - 20 });
      y += 52;
    }

    if (cashRequest.approved_by_user) {
      doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      y += 12;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Approval Details:', lm, y);
      y += 16;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
      const approverLabel = cashRequest.status === 'rejected' ? 'Reviewed by' : 'Approved by';
      doc.text(`${approverLabel}: ${cashRequest.approved_by_user.first_name} ${cashRequest.approved_by_user.last_name}`, lm, y);
      y += 12;
      if (cashRequest.approved_at) {
        doc.text(`Date: ${new Date(cashRequest.approved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, lm, y);
        y += 12;
      }
    }

    if (cashRequest.disbursed_by_user) {
      y += 4;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
      doc.text(`Disbursed by: ${cashRequest.disbursed_by_user.first_name} ${cashRequest.disbursed_by_user.last_name}`, lm, y);
      y += 12;
      if (cashRequest.disbursed_at) {
        doc.text(`Disbursed on: ${new Date(cashRequest.disbursed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, lm, y);
        y += 12;
      }
    }

    y += 16;
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af').text(`Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} \u2022 This is a system-generated document`, lm, y, { width: pw, align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate cash request PDF' });
  }
});

export default router;
