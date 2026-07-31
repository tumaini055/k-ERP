import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

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

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, subject, content, reference_number, recipient } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Letter content is required' });
      return;
    }

    let recipientName = '';
    let contactPerson = '';
    let address = '';
    let city = '';
    let region = '';

    if (customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customer_id)
        .single();
      if (!customer) { res.status(404).json({ error: 'Customer not found' }); return; }
      recipientName = customer.company_name || '';
      contactPerson = customer.contact_person || '';
      address = customer.address || '';
      city = customer.city || '';
      region = customer.region || '';
    } else if (recipient) {
      recipientName = recipient.company_name || '';
      contactPerson = recipient.contact_person || '';
      address = recipient.address || '';
      city = recipient.city || '';
      region = recipient.region || '';
    } else {
      res.status(400).json({ error: 'Customer ID or recipient details required' });
      return;
    }

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
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const ref = reference_number || `LET-${Date.now().toString(36).toUpperCase()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="letter-${ref}.pdf"`);
    doc.pipe(res);

    const lm = 50;
    const rm = doc.page.width - 50;
    const pw = doc.page.width - 100;

    // ================================
    // HEADER
    // ================================
    const logoW = 65;
    const logoX = lm;
    const logoY = 20;
    const nameX = logoX + logoW + 14;
    const infoW = 200;

    if (logoUrl) {
      const logoPath = path.resolve(__dirname, '../../', logoUrl.replace(/^\//, ''));
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, logoX, logoY, { width: logoW }); } catch { }
      }
    }

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(companyName, nameX, logoY + 16);

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    const infoItems = [
      companyAddress, companyPhone ? `Phone: ${companyPhone}` : '',
      companyEmail ? `Email: ${companyEmail}` : '',
      companyWebsite ? `Web: ${companyWebsite}` : '',
      taxId ? `Tax ID: ${taxId}` : '',
    ].filter(Boolean);
    const infoStartY = 28;
    for (let i = 0; i < infoItems.length; i++) {
      doc.text(infoItems[i], rm, infoStartY + i * 12, { align: 'right', width: infoW });
    }

    const sepY = Math.max(logoY + 55, infoStartY + infoItems.length * 12) + 8;
    doc.moveTo(lm, sepY).lineTo(rm, sepY).strokeColor('#dc2626').lineWidth(2).stroke();

    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    doc.text(`Ref: ${ref}`, lm, sepY + 16);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, rm, sepY + 16, { align: 'right', width: 200 });

    doc.x = lm;
    doc.y = sepY + 40;

    // === TO ===
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('To,');
    doc.y += 14;

    doc.fontSize(10).font('Helvetica').fillColor('#334155');
    doc.x = lm;
    const addrLines: string[] = [];
    if (recipientName) addrLines.push(recipientName);
    if (contactPerson) addrLines.push(`Attn: ${contactPerson}`);
    if (address) addrLines.push(address);
    if (city || region) addrLines.push([city, region].filter(Boolean).join(', '));
    if (addrLines.length === 0) addrLines.push(recipientName || contactPerson || 'Valued Customer');

    for (const addrLine of addrLines) {
      doc.text(addrLine);
      doc.y += 2;
    }
    doc.y += 12;

    // === SUBJECT ===
    if (subject) {
      doc.moveTo(lm, doc.y).lineTo(rm, doc.y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.y += 8;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(`Subject: ${subject}`, lm, doc.y);
      doc.y += 4;
      doc.moveTo(lm, doc.y).lineTo(rm, doc.y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.y += 14;
    }

    // === SALUTATION ===
    doc.fontSize(10).font('Helvetica').fillColor('#334155');
    doc.x = lm;
    doc.text(`Dear ${contactPerson || recipientName || 'Sir/Madam'},`);
    doc.y += 16;

    // === BODY ===
    doc.fontSize(10).font('Helvetica').fillColor('#334155');
    doc.x = lm;
    const paragraphs = content.split('\n');
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed === '') { doc.y += 6; continue; }
      doc.text(trimmed, { align: 'left', width: pw, lineGap: 2 });
      doc.y += 2;
    }

    // === CLOSING ===
    doc.x = lm;
    if (doc.y > doc.page.height - 131) {
      doc.addPage();
      doc.x = lm;
      doc.y = 50;
    } else {
      doc.y += 10;
    }

    doc.text('Yours faithfully,');
    doc.y += 32;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(companyName);
    doc.y += 12;
    doc.fontSize(9).font('Helvetica').fillColor('#64748b');
    if (companyAddress) doc.text(companyAddress);
    else doc.text(companyEmail);

    const footerParts = [companyName, companyEmail, companyPhone, companyWebsite].filter(Boolean);
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
    doc.text(footerParts.join(' | '), lm, doc.page.height - 36, { align: 'center', width: pw });

    try { const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png')); const ss = Math.min(120 / s.width, 120 / s.height); const sw = s.width * ss, sh = s.height * ss; doc.save(); doc.translate(doc.page.width - 50 - sw, doc.page.height - 70 - sh); doc.rotate(-6, { origin: [sw / 2, sh / 2] }); doc.image(s, 0, 0, { width: sw, height: sh }); doc.restore(); } catch (_) {}

    doc.end();
  } catch (error) {
    console.error('Letter PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate letter' });
  }
});

export default router;
