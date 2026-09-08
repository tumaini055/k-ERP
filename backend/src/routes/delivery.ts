import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import { generateDeliveryNumber } from '../utils/helpers';
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
// LIST DELIVERY NOTES
// ============================================
router.get('/', checkPermission('delivery', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', search, status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('delivery_notes')
      .select('*, customer:customers!delivery_notes_customer_id_fkey(company_name, contact_person), project:projects!delivery_notes_project_id_fkey(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`delivery_number.ilike.%${search}%,delivery_contact_name.ilike.%${search}%,received_by_name.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);
    if (companyId) query = query.eq('company_id', companyId);

    const { data, count, error } = await query.range(offset, offset + limitNum - 1);
    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    console.error('List delivery notes error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery notes' });
  }
});

// ============================================
// GET SINGLE DELIVERY NOTE
// ============================================
router.get('/:id', checkPermission('delivery', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('*, customer:customers!delivery_notes_customer_id_fkey(company_name, contact_person, email, phone, address), project:projects!delivery_notes_project_id_fkey(name), invoice:invoices!delivery_notes_invoice_id_fkey(invoice_number)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Delivery note not found' });
      return;
    }

    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', req.params.id)
      .order('sort_order');

    res.json({ ...data, items: items || [] });
  } catch (error) {
    console.error('Get delivery note error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery note' });
  }
});

// ============================================
// CREATE DELIVERY NOTE
// ============================================
router.post('/', checkPermission('delivery', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = await resolveCompanyId(req.user!.id, req.user?.company_id);
    const deliveryNumber = generateDeliveryNumber();
    const { items, ...noteData } = req.body;

    const cleanData = Object.fromEntries(
      Object.entries(noteData).map(([k, v]) => [k, v === '' ? null : v])
    );

    const { data, error } = await supabase
      .from('delivery_notes')
      .insert({
        ...cleanData,
        delivery_number: deliveryNumber,
        prepared_by: req.user!.id,
        created_by: req.user!.id,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) throw error;

    if (items && items.length > 0) {
      const insertItems = items.map((item: any, idx: number) => ({
        delivery_note_id: data.id,
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || null,
        notes: item.notes || null,
        sort_order: idx,
      }));

      const { error: itemsError } = await supabase.from('delivery_note_items').insert(insertItems);
      if (itemsError) throw itemsError;
    }

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Create delivery note error:', error);
    res.status(500).json({ error: 'Failed to create delivery note', detail: error?.message || String(error) });
  }
});

// ============================================
// UPDATE DELIVERY NOTE
// ============================================
router.put('/:id', checkPermission('delivery', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { items, ...noteData } = req.body;

    const cleanData = Object.fromEntries(
      Object.entries(noteData).map(([k, v]) => [k, v === '' ? null : v])
    );

    const { data, error } = await supabase
      .from('delivery_notes')
      .update({ ...cleanData, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (items) {
      await supabase.from('delivery_note_items').delete().eq('delivery_note_id', req.params.id);

      if (items.length > 0) {
        const insertItems = items.map((item: any, idx: number) => ({
          delivery_note_id: req.params.id,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit: item.unit || null,
          notes: item.notes || null,
          sort_order: idx,
        }));

        const { error: itemsError } = await supabase.from('delivery_note_items').insert(insertItems);
        if (itemsError) throw itemsError;
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Update delivery note error:', error);
    res.status(500).json({ error: 'Failed to update delivery note' });
  }
});

// ============================================
// DELETE DELIVERY NOTE
// ============================================
router.delete('/:id', checkPermission('delivery', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Delivery note deleted' });
  } catch (error) {
    console.error('Delete delivery note error:', error);
    res.status(500).json({ error: 'Failed to delete delivery note' });
  }
});

// ============================================
// DELIVERY NOTE PDF
// ============================================
router.get('/:id/pdf', checkPermission('delivery', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: note } = await supabase
      .from('delivery_notes')
      .select('*, customer:customers!delivery_notes_customer_id_fkey(company_name, contact_person, email, phone, address), project:projects!delivery_notes_project_id_fkey(name)')
      .eq('id', req.params.id)
      .single();

    if (!note) {
      res.status(404).json({ error: 'Delivery note not found' });
      return;
    }

    const { data: items } = await supabase
      .from('delivery_note_items')
      .select('*')
      .eq('delivery_note_id', req.params.id)
      .order('sort_order');

    // Fetch company settings
    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let taxId = '';
    let logoUrl = '';
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
      }
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="delivery-note-${note.delivery_number}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    let y = 0;

    const blue = '#2563eb';
    const blueDark = '#1e40af';
    const blueLight = '#eff6ff';

    // ============================================
    // TOP BLUE BANNER
    // ============================================
    doc.rect(0, 0, doc.page.width, 48).fill(blue);
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('DELIVERY NOTE', lm, 14, { align: 'center', width: pw });

    y = 68;

    // ============================================
    // HEADER: Logo + Company Info (left) / Reference (right)
    // ============================================
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

    // --- Right side: Reference box ---
    const refBoxY = y + 2;
    const refPad = 8;
    const refInnerW = refBoxW - refPad * 2;
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill(blueLight).strokeColor(blue).lineWidth(0.5).stroke();
    doc.fillColor(blue).fontSize(9).font('Helvetica-Bold').text('Delivery Note No', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(10).text(note.delivery_number, refBoxX + refPad, refBoxY + 20, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    doc.text(`Date: ${new Date(note.delivery_date).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
    refRowY += 11;
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 58;
    y = Math.max(leftEndY, rightEndY) + 16;

    // ============================================
    // STATUS BADGE
    // ============================================
    const statusLabels: Record<string, string> = {
      pending: 'Pending', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
    };
    const statusColors: Record<string, string> = {
      pending: '#f59e0b', dispatched: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444',
    };
    const badgeColor = statusColors[note.status] || '#6b7280';
    doc.roundedRect(lm, y, 90, 18, 9).fill(badgeColor);
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold').text(statusLabels[note.status] || note.status, lm, y + 4, { width: 90, align: 'center' });
    y += 28;

    // ============================================
    // DELIVERY FROM / DELIVERY TO
    // ============================================
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('DELIVERED FROM', lm, y);
    doc.text('DELIVER TO', rm - 200, y);
    y += 14;

    const customerName = note.customer
      ? (note.customer.company_name || note.customer.contact_person || '\u2014')
      : '\u2014';

    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(companyName, lm, y);
    doc.text(customerName, rm - 200, y);
    y += 12;

    if (addrLine1 || companyAddress) {
      doc.text(companyAddress || addrLine1, lm, y, { width: 200 });
      y += Math.max(doc.heightOfString(companyAddress || addrLine1, { width: 200 }), 12);
    }
    if (companyPhone) {
      doc.text(companyPhone, lm, y);
      y += 12;
    }
    if (companyEmail) {
      doc.text(companyEmail, lm, y);
      y += 12;
    }

    let toY = y - (companyEmail ? 36 : companyPhone ? 24 : addrLine1 ? 12 : 0);
    if (note.customer?.email) {
      doc.text(note.customer.email, rm - 200, toY);
      toY += 12;
    }
    if (note.customer?.phone) {
      doc.text(note.customer.phone, rm - 200, toY);
      toY += 12;
    }
    if (note.customer?.address) {
      doc.text(note.customer.address, rm - 200, toY, { width: 200 });
      toY += Math.max(doc.heightOfString(note.customer.address, { width: 200 }), 12);
    }

    y = Math.max(y, toY) + 6;

    // ============================================
    // PROJECT REFERENCE
    // ============================================
    if (note.project?.name) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827').text('Project:', lm, y);
      doc.font('Helvetica').fillColor('#4b5563').text(note.project.name, lm + 50, y);
      y += 14;
    }

    // ============================================
    // DELIVERY ADDRESS
    // ============================================
    if (note.delivery_address) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827').text('Delivery Address:', lm, y);
      y += 12;
      doc.font('Helvetica').fillColor('#4b5563').text(note.delivery_address, lm, y, { width: pw });
      y += doc.heightOfString(note.delivery_address, { width: pw }) + 6;
    }

    // ============================================
    // CONTACT PERSON
    // ============================================
    if (note.delivery_contact_name || note.delivery_contact_phone) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827').text('Contact Person:', lm, y);
      doc.font('Helvetica').fillColor('#4b5563');
      const contactInfo = [note.delivery_contact_name, note.delivery_contact_phone].filter(Boolean).join(' / ');
      doc.text(contactInfo, lm + 80, y);
      y += 14;
    }

    // ============================================
    // DIVIDER
    // ============================================
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 12;

    // ============================================
    // NOTES
    // ============================================
    if (note.notes) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Notes:', lm, y);
      y += 12;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5).text(note.notes, lm, y, { width: pw });
      y += doc.heightOfString(note.notes, { width: pw }) + 10;
    }

    // ============================================
    // ITEMS TABLE (cleaner, well-spaced columns)
    // ============================================
    const tableTop = y;
    const widths = [28, 0, 55, 75];
    const fixedW = widths[0] + widths[2] + widths[3];
    const flexW = pw - fixedW;
    widths[1] = flexW;
    const cols = ['SN', 'DESCRIPTION', 'QTY', 'UNIT'];
    const colAligns: ('left' | 'center' | 'right')[] = ['center', 'left', 'center', 'center'];
    const colX: number[] = [lm];
    for (let i = 1; i < widths.length; i++) colX[i] = colX[i - 1] + widths[i - 1];
    const tableWidth = widths.reduce((s, w) => s + w, 0);
    const headerH = 22;
    const rowH = 20;

    const drawHeader = (topY: number) => {
      doc.roundedRect(colX[0], topY, tableWidth, headerH, 2).fill(blue);
      doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
      for (let i = 0; i < cols.length; i++) {
        doc.text(cols[i], colX[i] + (colAligns[i] === 'center' ? 0 : 5), topY + 6, { width: widths[i] - (colAligns[i] === 'center' ? 0 : 10), align: colAligns[i] });
      }
    };

    drawHeader(tableTop);
    y = tableTop + headerH;

    doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
    let totalQty = 0;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        totalQty += Number(item.quantity || 0);

        const desc = item.description || '\u2014';
        const descText = desc.length > 200 ? desc.slice(0, 200) + '...' : desc;
        const descH = doc.heightOfString(descText, { width: widths[1] - 10 });
        const descLines = Math.max(Math.ceil(descH / 12), 1);
        const rh = Math.max(rowH, descLines * 13 + 8);

        if (y + rh > (doc.page.height - 45)) {
          doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
          doc.addPage();
          y = 45;
          drawHeader(y);
          y += headerH;
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
        }

        if (i % 2 === 0) {
          doc.rect(colX[0], y, tableWidth, rh).fill('#f9fafb');
        }
        doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#eef2f7').lineWidth(0.5).stroke();
        doc.fillColor('#374151');
        doc.text(String(i + 1), colX[0], y + (rh - 9) / 2, { width: widths[0], align: 'center' });
        doc.text(descText, colX[1] + 5, y + 5, { width: widths[1] - 10, align: 'left' });
        doc.text(String(item.quantity), colX[2], y + (rh - 9) / 2, { width: widths[2], align: 'center' });
        doc.text(item.unit || '\u2014', colX[3], y + (rh - 9) / 2, { width: widths[3], align: 'center' });
        y += rh;
      }
    }

    // Empty row placeholder if no items
    if (!items || items.length === 0) {
      for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
          doc.rect(colX[0], y, tableWidth, rowH).fill('#f9fafb');
        }
        doc.fillColor('#d1d5db');
        doc.text(String(i + 1), colX[0], y + 5, { width: widths[0], align: 'center' });
        y += rowH;
      }
    }

    doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    y += 6;

    // Total quantity row
    if (items && items.length > 0) {
      doc.rect(colX[0], y, tableWidth, 18).fill(blueLight);
      doc.fillColor(blueDark).fontSize(9).font('Helvetica-Bold').text('TOTAL', colX[0] + 4, y + 4, { width: widths[1], align: 'left' });
      doc.text(String(items.length), colX[0], y + 4, { width: widths[0], align: 'center' });
      doc.text(String(totalQty), colX[2], y + 4, { width: widths[2], align: 'center' });
      y += 24;
    }

    // ============================================
    // DISPATCH / RECEIVED DATES
    // ============================================
    y += 6;
    doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563');
    if (note.dispatch_date) {
      doc.font('Helvetica-Bold').fillColor('#111827').text('Dispatch Date:', lm, y);
      doc.font('Helvetica').fillColor('#4b5563').text(new Date(note.dispatch_date).toLocaleDateString('en-GB'), lm + 80, y);
      y += 14;
    }
    if (note.received_date) {
      doc.font('Helvetica-Bold').fillColor('#111827').text('Received Date:', lm, y);
      doc.font('Helvetica').fillColor('#4b5563').text(new Date(note.received_date).toLocaleDateString('en-GB'), lm + 80, y);
      y += 14;
    }

    // ============================================
    // DISPATCHED BY / RECEIVED BY SIGNATURE
    // ============================================
    y += 16;
    if (y + 80 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('DISPATCHED BY', lm, y);
    doc.text('RECEIVED BY', rm - 200, y);
    y += 14;
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9);
    doc.text(`${req.user?.first_name || ''} ${req.user?.last_name || ''}`, lm, y);
    if (note.received_by_name) {
      doc.text(note.received_by_name, rm - 200, y);
    }
    y += 4;
    doc.moveTo(lm, y + 2).lineTo(lm + 180, y + 2).strokeColor('#9ca3af').lineWidth(0.5).stroke();
    doc.moveTo(rm - 200, y + 2).lineTo(rm - 20, y + 2).strokeColor('#9ca3af').lineWidth(0.5).stroke();
    y += 10;
    doc.fontSize(7.5).fillColor('#9ca3af').text('Signature', lm, y);
    doc.text('Signature', rm - 200, y);

    // ============================================
    // FOOTER
    // ============================================
    y += 24;
    if (y + 32 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }
    const footY = y;
    doc.rect(0, footY - 6, doc.page.width, 32).fill(blue);
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica');
    const footerParts = [companyName];
    if (companyEmail) footerParts.push(companyEmail);
    if (companyWebsite) footerParts.push(companyWebsite);
    doc.text(footerParts.join('  |  '), lm, footY + 3, { align: 'center', width: pw });
    doc.text(`Delivery Note #${note.delivery_number}  |  Generated ${new Date().toLocaleDateString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    try {
      const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png'));
      const ss = Math.min(120 / s.width, 120 / s.height);
      const sw = s.width * ss;
      const sh = s.height * ss;
      doc.save();
      doc.translate(doc.page.width - 50 - sw, footY - 16 - sh);
      doc.rotate(-6, { origin: [sw / 2, sh / 2] });
      doc.image(s, 0, 0, { width: sw, height: sh });
      doc.restore();
    } catch (_) {}

    doc.end();
  } catch (error) {
    console.error('Delivery note PDF error:', error);
    res.status(500).json({ error: 'Failed to generate delivery note PDF' });
  }
});

export default router;
