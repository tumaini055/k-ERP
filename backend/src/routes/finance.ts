import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateInvoiceNumber } from '../utils/helpers';

const router = Router();

router.use(authenticate);

// ============================================
// INVOICE PDF
// ============================================

router.get('/invoices/:id/pdf', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, customer:customers(company_name, contact_person, email, phone, address)')
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

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 100;
    let y = 50;
    const primary = '#1e40af';
    const gray = '#6b7280';
    const lightGray = '#f3f4f6';

    // === HEADER BAR ===
    doc.rect(0, 0, doc.page.width, 100).fill(primary);
    doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold').text('K-CONNECT TECHNOLOGIES', 50, 28);
    doc.fontSize(10).font('Helvetica').text('info@kconnect.co.tz  |  www.kconnect.co.tz', 50, 58);
    doc.fontSize(10).text('Dar es Salaam, Tanzania', 50, 74);

    // Invoice badge on the right
    const badgeText = invoice.invoice_type?.toUpperCase() === 'credit_note' ? 'CREDIT NOTE' : 'INVOICE';
    doc.fontSize(14).font('Helvetica-Bold').text(badgeText, pw + 50 - 130, 35, { width: 130, align: 'center' });
    doc.roundedRect(pw + 50 - 130, 33, 130, 28, 4).strokeColor('#fff').lineWidth(1.5).stroke();

    y = 130;

    // === INVOICE DETAILS (left) vs Bill To (right) ===
    // Left: Invoice details
    doc.fillColor(primary).fontSize(9).font('Helvetica-Bold').text('INVOICE DETAILS', 50, y);
    y += 18;
    doc.fillColor('#000').fontSize(9).font('Helvetica');
    const invLines = [
      ['Invoice #:', invoice.invoice_number],
      ['Date:', new Date(invoice.invoice_date).toLocaleDateString('en-GB')],
      ['Due Date:', new Date(invoice.due_date).toLocaleDateString('en-GB')],
      ['Status:', invoice.status?.toUpperCase() || 'DRAFT'],
    ];
    invLines.forEach(([label, val]) => {
      doc.font('Helvetica-Bold').text(label, 50, y, { width: 80 });
      doc.font('Helvetica').text(val, 135, y, { width: 150 });
      y += 15;
    });

    // Right: Bill To
    const billToX = pw + 50 - 230;
    doc.fillColor(primary).fontSize(9).font('Helvetica-Bold').text('BILL TO', billToX, 130);
    y = 148;
    doc.fillColor('#000').fontSize(9).font('Helvetica');
    const customerName = invoice.customer
      ? (invoice.customer.company_name || invoice.customer.contact_person || '—')
      : '—';
    doc.text(customerName, billToX, y);
    y += 14;
    if (invoice.customer?.email) {
      doc.text(invoice.customer.email, billToX, y);
      y += 14;
    }
    if (invoice.customer?.phone) {
      doc.text(invoice.customer.phone, billToX, y);
      y += 14;
    }
    if (invoice.customer?.address) {
      doc.text(invoice.customer.address, billToX, y, { width: 200 });
    }

    // === DIVIDER ===
    y = 235;
    doc.moveTo(50, y).lineTo(pw + 50, y).strokeColor(gray).lineWidth(0.5).stroke();
    y += 15;

    // === ITEMS TABLE ===
    const cols = [
      { x: 50, w: 260, label: 'DESCRIPTION' },
      { x: 310, w: 60, label: 'QTY', align: 'right' },
      { x: 370, w: 90, label: 'UNIT PRICE', align: 'right' },
      { x: 460, w: 90, label: 'TOTAL', align: 'right' },
    ];

    // Table header
    doc.rect(50, y - 4, pw, 22).fill(primary);
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    cols.forEach(c => doc.text(c.label, c.x, y, { width: c.w, align: (c as any).align || 'left' }));
    y += 22;

    // Table rows
    doc.fillColor('#000').fontSize(9).font('Helvetica');
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (i % 2 === 0) {
          doc.rect(50, y - 3, pw, 20).fill(lightGray);
        }
        doc.fillColor('#000');
        doc.text(item.description || '—', cols[0].x, y, { width: cols[0].w - 5 });
        doc.text(String(item.quantity), cols[1].x, y, { width: cols[1].w, align: 'right' });
        doc.text(Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 0 }), cols[2].x, y, { width: cols[2].w, align: 'right' });
        doc.text(Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 0 }), cols[3].x, y, { width: cols[3].w, align: 'right' });
        y += 20;
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      }
    }

    y += 10;

    // === SUMMARY SECTION ===
    const sumX = 360;
    const sumW = 200;
    const drawSummaryLine = (label: string, value: string, isBold = false, isTotal = false) => {
      if (isTotal) {
        doc.rect(sumX, y - 4, sumW, 28).fill(primary);
        doc.fillColor('#fff').fontSize(12).font('Helvetica-Bold');
        doc.text(label, sumX + 10, y + 2, { width: sumW - 20 });
        doc.text(value, sumX + 10, y + 2, { width: sumW - 20, align: 'right' });
        y += 30;
      } else {
        doc.fillColor('#000');
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
        doc.text(label, sumX, y, { width: 100 });
        doc.text(value, sumX + 100, y, { width: 100, align: 'right' });
        y += 20;
      }
    };

    const fmt = (n: number) => `TSh ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

    drawSummaryLine('Subtotal:', fmt(invoice.subtotal));
    if (Number(invoice.tax_rate) > 0) {
      drawSummaryLine(`Tax (${invoice.tax_rate}%):`, fmt(invoice.tax_amount));
    }
    if (Number(invoice.discount_amount) > 0) {
      drawSummaryLine('Discount:', `- ${fmt(invoice.discount_amount)}`);
    }
    drawSummaryLine('Total:', fmt(invoice.total_amount), false, true);

    y += 25;

    // === NOTES ===
    if (invoice.notes) {
      doc.fillColor(primary).fontSize(9).font('Helvetica-Bold').text('NOTES', 50, y);
      y += 16;
      doc.fillColor('#000').font('Helvetica').fontSize(9);
      doc.text(invoice.notes, 50, y, { width: pw - 50 });
      // Move y past notes
      const noteH = doc.heightOfString(invoice.notes, { width: pw - 50 });
      y += noteH + 15;
    }

    if (invoice.terms) {
      doc.fillColor(primary).fontSize(9).font('Helvetica-Bold').text('TERMS', 50, y);
      y += 16;
      doc.fillColor('#000').font('Helvetica').fontSize(9);
      doc.text(invoice.terms, 50, y, { width: pw - 50 });
      const termH = doc.heightOfString(invoice.terms, { width: pw - 50 });
      y += termH + 15;
    }

    // === FOOTER ===
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY - 10, doc.page.width, 40).fill(primary);
    doc.fillColor('#fff').fontSize(8).font('Helvetica');
    doc.text('K-CONNECT TECHNOLOGIES  |  info@kconnect.co.tz  |  www.kconnect.co.tz', 50, footerY + 4, { align: 'center', width: pw });
    doc.text(`Invoice #${invoice.invoice_number}  |  Page 1`, 50, footerY + 18, { align: 'center', width: pw, fontSize: 7 });

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
      .select('*, customer:customers(company_name, contact_person)', { count: 'exact' });

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
      .select('*, customer:customers(*), items:invoice_items(*), payments:payments(*)')
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

router.get('/expenses', checkPermission('finance', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, project_id, from_date, to_date, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('expenses')
      .select('*, project:projects(name), user:users(first_name, last_name)', { count: 'exact' });

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
    let query = supabase
      .from('payments')
      .select('amount, payment_date, payment_method')
      .gte('payment_date', from_date || new Date(new Date().getFullYear(), 0, 1).toISOString())
      .lte('payment_date', to_date || new Date().toISOString());

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;

    const totalRevenue = data.reduce((sum, p) => sum + Number(p.amount), 0);
    const byMethod = data.reduce((acc: any, p) => {
      acc[p.payment_method] = (acc[p.payment_method] || 0) + Number(p.amount);
      return acc;
    }, {});

    res.json({ total_revenue: totalRevenue, payments: data, by_method: byMethod });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

export default router;
