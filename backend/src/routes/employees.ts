import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';
import path from 'path';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { department, role, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('users')
      .select('id, employee_id, first_name, last_name, email, phone, role, department, position, avatar_url, is_active, created_at, contract:employee_contracts(salary, contract_type, start_date, end_date, is_active)', { count: 'exact' })
      .neq('role', 'customer');

    if (department) query = query.eq('department', department);
    if (role) query = query.eq('role', role);
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

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
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.post('/', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, email, phone, password, role, department, position, employee_id } = req.body;
    if (!first_name || !last_name || !email || !password) {
      res.status(400).json({ error: 'First name, last name, email, and password are required' });
      return;
    }
    const existing = await supabase.from('users').select('id').eq('email', email).single();
    if (existing.data) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }
    const password_hash = await bcrypt.hash(password, 12);
    const empId = employee_id || `EMP-${Date.now().toString().slice(-6)}`;
    let companyId = req.user!.company_id;
    if (!companyId) {
      const { data: company } = await supabase.from('companies').select('id').limit(1).single();
      companyId = company?.id || null;
      if (companyId) {
        await supabase.from('users').update({ company_id: companyId }).eq('id', req.user!.id);
      }
    }
    const { data, error } = await supabase.from('users').insert({
      first_name, last_name, email, phone, password_hash,
      role: role || 'engineer', department, position, employee_id: empId,
      company_id: companyId, is_active: true,
    }).select('*').single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || error?.details || 'Failed to create employee' });
  }
});

router.get('/leave-requests', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase
      .from('leave_requests')
      .select('*, user:users!leave_requests_user_id_fkey(first_name, last_name, department), approver:users!leave_requests_approved_by_fkey(first_name, last_name)');

    if (['engineer'].includes(req.user!.role)) {
      query = query.eq('user_id', req.user!.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if ((error as any)?.message?.includes('relation') || (error as any)?.code === '42P01') {
        res.json({ data: [] });
        return;
      }
      throw error;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

router.post('/leave-requests', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({ ...req.body, user_id: req.user!.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

router.put('/leave-requests/:id/approve', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'approved', approved_by: req.user!.id })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave' });
  }
});

router.get('/:id', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const safeQuery = async (table: string, column = 'user_id', single = false) => {
      try {
        const q = supabase.from(table).select('*').eq(column, req.params.id);
        const { data } = single ? await q.maybeSingle() : await q;
        return data || (single ? null : []);
      } catch { return single ? null : []; }
    };

    const [contract, attendance, leave_requests, evaluations] = await Promise.all([
      safeQuery('employee_contracts', 'user_id', true),
      safeQuery('attendance'),
      safeQuery('leave_requests'),
      safeQuery('performance_evaluations'),
    ]);

    res.json({ data: { ...user, contract, attendance, leave_requests, evaluations } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// ============================================
// EMPLOYEE CONTRACTS
// ============================================

const generateEmployeeContractNumber = (): string => {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `ECT-${year}-${num}`;
};

router.get('/:id/contract', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('user_id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee contract' });
  }
});

router.post('/:id/contract', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: existing } = await supabase
      .from('employee_contracts')
      .select('id')
      .eq('user_id', req.params.id)
      .maybeSingle();

    const { contract_number, ...rest } = req.body;
    const payload: any = { ...rest, user_id: req.params.id };

    let data: any;
    if (existing) {
      ({ data } = await supabase
        .from('employee_contracts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single());
    } else {
      payload.contract_number = contract_number || generateEmployeeContractNumber();
      ({ data } = await supabase
        .from('employee_contracts')
        .insert(payload)
        .select('*')
        .single());
    }

    if (!data) {
      res.status(500).json({ error: 'Failed to save employee contract' });
      return;
    }
    res.status(201).json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to save employee contract' });
  }
});

router.put('/:id/contract', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('employee_contracts')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('user_id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee contract' });
  }
});

router.get('/:id/contract/pdf', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, employee_id, first_name, last_name, email, phone, department, position, company_id')
      .eq('id', req.params.id)
      .single();

    if (!user) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const { data: contract } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('user_id', req.params.id)
      .maybeSingle();

    if (!contract) {
      res.status(404).json({ error: 'No contract found for this employee' });
      return;
    }

    // Company branding (the employer)
    let companyName = 'K-Connect Technologies';
    let companyEmail = 'info@kconnect.co.tz';
    let companyWebsite = 'www.kconnect.co.tz';
    let companyAddress = '';
    let companyPhone = '';
    let taxId = '';
    let logoUrl = '';
    const companyId = user.company_id || req.user?.company_id;
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

    // Managing Director / signatory for the company
    let mdName = '';
    let mdQuery = supabase.from('users').select('first_name, last_name').in('role', ['managing_director', 'ceo']).limit(1);
    if (companyId) mdQuery = mdQuery.eq('company_id', companyId);
    const { data: mdUser } = await mdQuery.maybeSingle();
    if (mdUser) mdName = `${mdUser.first_name} ${mdUser.last_name}`;

    const crypto = require('crypto');
    const verifySource = `${contract.contract_number}|${user.first_name} ${user.last_name}|${contract.start_date}|${contract.salary}|${contract.contract_type}`;
    const verifyHash = crypto.createHash('sha256').update(verifySource).digest('hex').toUpperCase();
    const verifyCode = `${verifyHash.slice(0, 4)}-${verifyHash.slice(4, 8)}-${verifyHash.slice(8, 12)}-${verifyHash.slice(12, 16)}`;

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const contractNumber = contract.contract_number || `ECT-${user.id.slice(0, 6).toUpperCase()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="employment-contract-${contractNumber}.pdf"`);
    doc.pipe(res);

    const pw = doc.page.width - 90;
    const lm = 45;
    const rm = doc.page.width - 45;
    const blue = '#1d4ed8';
    const blueDark = '#1e3a8a';
    const blueLight = '#eff6ff';
    const blueBorder = '#bfdbfe';
    let y = 0;

    // ============================================
    // TOP BLUE BANNER
    // ============================================
    doc.rect(0, 0, doc.page.width, 48).fill(blue);
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('EMPLOYMENT CONTRACT', lm, 14, { align: 'center', width: pw });

    y = 68;

    // ============================================
    // HEADER: Logo + Employer info / Contract ref
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

    const refBoxW = 200;
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
    doc.rect(refBoxX, refBoxY, refBoxW, 58).fill(blueLight).strokeColor(blue).lineWidth(0.5).stroke();
    doc.fillColor(blue).fontSize(9).font('Helvetica-Bold').text('CONTRACT NO', refBoxX + refPad, refBoxY + 6, { width: refInnerW });
    doc.fillColor('#111827').font('Helvetica').fontSize(10).text(contractNumber, refBoxX + refPad, refBoxY + 19, { width: refInnerW });
    doc.fillColor('#6b7280').fontSize(8);
    let refRowY = refBoxY + 36;
    if (contract.start_date) {
      doc.text(`Start: ${new Date(contract.start_date).toLocaleDateString('en-GB')}`, refBoxX + refPad, refRowY, { width: refInnerW });
      refRowY += 11;
    }
    if (taxId) doc.text(`TIN: ${taxId}`, refBoxX + refPad, refRowY, { width: refInnerW });

    const rightEndY = refBoxY + 58;
    y = Math.max(leftEndY, rightEndY) + 16;

    // ============================================
    // PARTIES
    // ============================================
    doc.fontSize(9).font('Helvetica-Bold').fillColor(blueDark).text('THIS CONTRACT IS MADE BETWEEN', lm, y);
    y += 14;

    const fmtMoney = (n: number) => `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })} TSh`;
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

    // Employer card
    doc.roundedRect(lm, y, pw, 52, 3).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(9).text('1. THE EMPLOYER', lm + 10, y + 7);
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(companyName, lm + 10, y + 20, { width: pw - 20 });
    doc.text([addrLine1, addrLine2, companyPhone, companyEmail].filter(Boolean).join(' | '), lm + 10, y + 33, { width: pw - 20 });
    y += 62;

    // Employee card
    doc.roundedRect(lm, y, pw, 52, 3).fill(blueLight).strokeColor(blueBorder).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(9).text('2. THE EMPLOYEE', lm + 10, y + 7);
    doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
    doc.text(`${user.first_name} ${user.last_name}`, lm + 10, y + 20, { width: pw - 20 });
    const empInfo = [
      user.employee_id ? `Employee ID: ${user.employee_id}` : '',
      user.position ? `Position: ${user.position}` : '',
      user.department ? `Department: ${user.department}` : '',
      user.email ? `Email: ${user.email}` : '',
      user.phone ? `Phone: ${user.phone}` : '',
    ].filter(Boolean).join('   |   ');
    doc.text(empInfo, lm + 10, y + 33, { width: pw - 20 });
    y += 62;

    // ============================================
    // TERMS & CONDITIONS
    // ============================================
    doc.moveTo(lm, y).lineTo(rm, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 12;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(blueDark).text('TERMS & CONDITIONS OF EMPLOYMENT', lm, y);
    y += 16;

    const section = (num: string, title: string, value: string) => {
      if (!value) return;
      const valueH = doc.heightOfString(value, { width: pw - 14 });
      if (y + 30 + valueH > doc.page.height - 90) {
        doc.addPage();
        y = 45;
      }
      doc.font('Helvetica-Bold').fillColor('#111827').fontSize(8.5).text(`${num}. ${title}`, lm, y);
      y += 12;
      doc.font('Helvetica').fillColor('#4b5563').fontSize(8.5);
      doc.text(value, lm + 14, y, { width: pw - 14 });
      y += valueH + 10;
    };

    const employmentType = (contract.employment_type || 'full_time').replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const contractType = (contract.contract_type || 'permanent').replace(/\b\w/g, (c: string) => c.toUpperCase());

    section('3', 'Employment Type', `${contractType} (${employmentType})`);
    section('4', 'Commencement Date', fmtDate(contract.start_date));
    if (contract.end_date) section('5', 'Term of Contract', `The contract shall continue until ${fmtDate(contract.end_date)} unless terminated earlier in accordance with the terms herein.`);
    else section('5', 'Term of Contract', 'This is a permanent employment contract with no fixed end date, subject to termination in accordance with the terms herein.');
    if (contract.probation_months > 0) section('6', 'Probationary Period', `The Employee shall serve a probationary period of ${contract.probation_months} month${contract.probation_months > 1 ? 's' : ''}.`);
    if (contract.salary) section('7', 'Salary & Remuneration', `The Employer shall pay the Employee a monthly salary of ${fmtMoney(contract.salary)} payable in accordance with the Employer's payroll cycle.`);
    if (contract.working_hours) section('8', 'Working Hours', contract.working_hours);
    if (contract.leave_entitlement) section('9', 'Leave Entitlement', contract.leave_entitlement);
    if (contract.notice_period_months > 0) section('10', 'Notice Period', `Either party may terminate this contract by giving ${contract.notice_period_months} month${contract.notice_period_months > 1 ? 's' : ''} written notice.`);
    if (contract.duties) section('11', 'Duties & Responsibilities', contract.duties);
    if (contract.benefits) section('12', 'Benefits & Allowances', contract.benefits);
    if (contract.terms) section('13', 'Additional Terms & Conditions', contract.terms);

    // ============================================
    // VERIFICATION BOX
    // ============================================
    if (y + 70 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }
    doc.roundedRect(lm, y, pw, 44, 3);
    doc.strokeColor(blue).lineWidth(0.5).dash(3, 3).stroke();
    doc.undash();
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text('VERIFICATION CODE', lm + 12, y + 7, { width: pw - 24 });
    doc.font('Helvetica-Bold').fillColor(blueDark).fontSize(11).text(verifyCode, lm + 12, y + 21, { width: pw - 24 });
    doc.font('Helvetica').fillColor('#9ca3af').fontSize(7.5).text('This document is cryptographically signed and can be verified against the original employment record.', lm + 12, y + 36, { width: pw - 24 });
    y += 56;

    // ============================================
    // SIGNATURES
    // ============================================
    const sigPanelH = 128;
    if (y + sigPanelH + 90 > doc.page.height - 45) {
      doc.addPage();
      y = 45;
    }

    doc.fontSize(9).font('Helvetica-Bold').fillColor(blueDark).text('IN WITNESS WHEREOF, the parties have executed this Employment Contract as of the date written below.', lm, y);
    y += 16;

    const panelW = (pw - 16) / 2;
    const empX = lm;
    const cmpX = lm + panelW + 16;
    const dateText = contract.signed_date ? fmtDate(contract.signed_date) : '__________________________';

    // --- Employee signature panel (left) ---
    doc.roundedRect(empX, y, panelW, sigPanelH, 3).fill('#f8fafc').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.fillColor(blueDark).fontSize(8.5).font('Helvetica-Bold').text('SIGNED BY THE EMPLOYEE', empX + 10, y + 9);
    doc.font('Helvetica').fillColor('#6b7280').fontSize(7.5).text('Name', empX + 10, y + 24);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5).text(`${user.first_name} ${user.last_name}`, empX + 10, y + 33);
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7.5).text('Signature', empX + 10, y + 52);
    doc.moveTo(empX + 10, y + 65).lineTo(empX + panelW - 10, y + 65).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7.5).text('Date', empX + 10, y + 76);
    doc.moveTo(empX + 10, y + 89).lineTo(empX + panelW - 10, y + 89).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    doc.font('Helvetica').fillColor('#111827').fontSize(8.5).text(dateText, empX + 10, y + 96);

    // --- Company / Managing Director signature panel (right) ---
    doc.roundedRect(cmpX, y, panelW, sigPanelH, 3).fill(blueLight).strokeColor(blueBorder).lineWidth(0.5).stroke();
    doc.fillColor(blueDark).fontSize(8.5).font('Helvetica-Bold').text('SIGNED FOR AND ON BEHALF OF', cmpX + 10, y + 9);
    doc.font('Helvetica').fillColor('#6b7280').fontSize(7.5).text(companyName, cmpX + 10, y + 19);
    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(9.5).text('Managing Director', cmpX + 10, y + 30);
    doc.font('Helvetica').fillColor('#4b5563').fontSize(9).text(mdName || '\u00A0', cmpX + 10, y + 42);
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7.5).text('Signature', cmpX + 10, y + 56);
    doc.moveTo(cmpX + 10, y + 69).lineTo(cmpX + panelW - 10, y + 69).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    doc.fillColor('#6b7280').font('Helvetica').fontSize(7.5).text('Date', cmpX + 10, y + 80);
    doc.moveTo(cmpX + 10, y + 93).lineTo(cmpX + panelW - 10, y + 93).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    doc.font('Helvetica').fillColor('#111827').fontSize(8.5).text(dateText, cmpX + 10, y + 100);

    // --- Company stamp overlay on the MD panel ---
    try {
      const s = doc.openImage(path.join(__dirname, '../../uploads/stamp.png'));
      const ss = Math.min(120 / s.width, 120 / s.height);
      const sw = s.width * ss, sh = s.height * ss;
      const stampX = cmpX + panelW - 40 - sw;
      const stampY = y + 38;
      doc.save();
      doc.opacity(0.88);
      doc.translate(stampX, stampY);
      doc.rotate(-6, { origin: [sw / 2, sh / 2] });
      doc.image(s, 0, 0, { width: sw, height: sh });
      doc.restore();
      doc.opacity(1);
    } catch (_) { /* skip */ }

    y += sigPanelH + 22;

    // ============================================
    // FOOTER
    // ============================================
    y += 40;
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
    doc.text(`Contract #${contractNumber}  |  Generated ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, lm, footY + 16, { align: 'center', width: pw });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate employment contract PDF' });
  }
});

router.put('/:id', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.get('/:id/attendance', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.params.id);

    const monthStr = month ? String(month) : '';
    const yearStr = year ? String(year) : '';

    if (monthStr && yearStr) {
      const start = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
      const endMonth = parseInt(monthStr) + 1;
      const endYear = endMonth > 12 ? parseInt(yearStr) + 1 : parseInt(yearStr);
      const endMonthStr = endMonth > 12 ? '01' : String(endMonth).padStart(2, '0');
      const end = `${endYear}-${endMonthStr}-01`;
      query = query.gte('date', start).lt('date', end);
    } else if (yearStr) {
      query = query.gte('date', `${yearStr}-01-01`).lt('date', `${parseInt(yearStr) + 1}-01-01`);
    } else if (monthStr) {
      const currentYear = new Date().getFullYear();
      const start = `${currentYear}-${monthStr.padStart(2, '0')}-01`;
      const endMonth = parseInt(monthStr) + 1;
      const endYear = endMonth > 12 ? currentYear + 1 : currentYear;
      const endMonthStr = endMonth > 12 ? '01' : String(endMonth).padStart(2, '0');
      const end = `${endYear}-${endMonthStr}-01`;
      query = query.gte('date', start).lt('date', end);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/attendance', checkPermission('employees', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .insert({ ...req.body, user_id: req.body.user_id || req.user!.id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

router.delete('/:id', checkPermission('employees', 'canDelete'), async (req: AuthRequest, res: Response) => {
  const userId = req.params.id;

  const safeNullify = async (table: string, column: string) => {
    try {
      await supabase.from(table).update({ [column]: null }).eq(column, userId);
    } catch {}
  };

  const safeDelete = async (table: string, column: string) => {
    try {
      await supabase.from(table).delete().eq(column, userId);
    } catch {}
  };

  try {
    // Null out audit/reference columns where user is referenced
    await Promise.all([
      safeNullify('invoices', 'created_by'),
      safeNullify('expenses', 'created_by'),
      safeNullify('expenses', 'approved_by'),
      safeNullify('payments', 'received_by'),
      safeNullify('projects', 'manager_id'),
      safeNullify('project_tasks', 'assigned_to'),
      safeNullify('documents', 'uploaded_by'),
      safeNullify('contracts', 'created_by'),
      safeNullify('events', 'created_by'),
      safeNullify('support_tickets', 'assigned_to'),
      safeNullify('ticket_responses', 'user_id'),
      safeNullify('leave_requests', 'approved_by'),
      safeNullify('performance_evaluations', 'reviewer_id'),
    ]);

    // Delete owned records
    await Promise.all([
      safeDelete('attendance', 'user_id'),
      safeDelete('time_entries', 'user_id'),
      safeDelete('notifications', 'user_id'),
      safeDelete('user_sessions', 'user_id'),
    ]);

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    res.json({ message: 'Employee deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete employee' });
  }
});

export default router;
