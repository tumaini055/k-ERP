import { Response } from 'express';
import path from 'path';
import fs from 'fs';

export interface CompanyInfo {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
  taxId: string;
  logoUrl: string;
}

export interface PresentationSlide {
  title: string;
  content: string;
}

const COLORS = {
  red: '#dc2626',
  dark: '#1e293b',
  slate: '#334155',
  gray: '#64748b',
  lightGray: '#94a3b8',
  border: '#e2e8f0',
  white: '#ffffff',
};

export function resolveLogoPath(logoUrl: string): string | null {
  if (!logoUrl) return null;
  const p = path.resolve(__dirname, '../../', logoUrl.replace(/^\//, ''));
  return fs.existsSync(p) ? p : null;
}

export function defaultSlides(companyName: string): PresentationSlide[] {
  return [
    { title: 'About Us', content: `${companyName} is a professional technology company committed to delivering reliable, innovative and affordable solutions to our valued clients across the region.` },
    { title: 'Our Mission', content: 'To deliver high-quality technology solutions and services that help our customers achieve their goals efficiently, securely and reliably.' },
    { title: 'Our Vision', content: 'To be the preferred technology partner in the region, recognised for excellence, integrity and long-term partnerships.' },
    {
      title: 'Our Services',
      content: '- IT Infrastructure and Networking\n- Software Development\n- Internet and Connectivity Solutions\n- CCTV and Security Systems\n- Maintenance and Technical Support',
    },
    {
      title: 'Why Choose Us',
      content: '- Experienced and professional team\n- Reliable and responsive support\n- Competitive pricing\n- Tailored solutions for every client\n- Commitment to long-term partnerships',
    },
  ];
}

export function normalizeSlides(raw: any, companyName: string): PresentationSlide[] {
  const defaults = defaultSlides(companyName);
  if (!Array.isArray(raw) || raw.length === 0) return defaults;
  return raw.map((s) => ({
    title: String(s?.title || 'Untitled Section').slice(0, 200),
    content: String(s?.content || ''),
  }));
}

// ============================================================
// PDF PRESENTATION (A4 landscape, office-document formatting)
// ============================================================
export function buildPresentationPdf(
  res: Response,
  info: CompanyInfo,
  title: string,
  tagline: string,
  slides: PresentationSlide[]
): void {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="presentation-${Date.now()}.pdf"`);
  doc.pipe(res);

  const pw = doc.page.width;
  const ph = doc.page.height;
  const lm = 40;
  const rm = pw - 40;
  const cw = rm - lm;
  const logoPath = resolveLogoPath(info.logoUrl);

  const state: any = {
    doc, pw, ph, lm, rm, cw,
    page: 1,
    bodyTop: 108,
    bodyBottom: ph - 56,
  };

  function footer() {
    doc.moveTo(lm, ph - 46).lineTo(rm, ph - 46).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightGray);
    doc.text(info.companyName, lm, ph - 40, { width: cw / 2 });
    doc.text(`Page ${state.page}`, rm, ph - 40, { width: cw / 2, align: 'right' });
  }

  function contentPage(slideTitle: string) {
    doc.addPage();
    state.page += 1;
    doc.rect(0, 0, pw, 6).fill(COLORS.red);
    const logoW = 32;
    let nameX = lm;
    let nameY = 20;
    if (logoPath) {
      try { doc.image(logoPath, lm, 14, { width: logoW }); nameX = lm + logoW + 10; nameY = 22; } catch (_) {}
    }
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.dark).text(info.companyName, nameX, nameY);
    doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.gray);
    doc.text([info.companyPhone, info.companyWebsite, info.companyEmail].filter(Boolean).join('  |  '), rm, nameY + 2, { align: 'right', width: 260 });
    doc.moveTo(lm, 52).lineTo(rm, 52).strokeColor(COLORS.red).lineWidth(1.5).stroke();

    doc.rect(lm, 68, 5, 22).fill(COLORS.red);
    doc.fontSize(21).font('Helvetica-Bold').fillColor(COLORS.dark).text(slideTitle, lm + 15, 70);
    doc.moveTo(lm, 99).lineTo(rm, 99).strokeColor(COLORS.border).lineWidth(1).stroke();

    footer();
    state.y = state.bodyTop;
  }

  function body(text: string, slideTitle: string) {
    const lineH = 16;
    let cy = state.y;
    const lines = String(text || '').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { cy += 6; if (cy > state.bodyBottom) cy = (contentPage(slideTitle), state.y); continue; }
      const isBullet = /^[-*•\u2022]\s*/.test(line);
      const clean = isBullet ? line.replace(/^[-*•\u2022]\s*/, '') : line;
      const indent = isBullet ? 18 : 0;
      const tw = cw - indent;
      const words = clean.split(/\s+/);
      const wrapped: string[] = [];
      let cur = '';
      for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (doc.widthOfString(t) <= tw - 2) cur = t;
        else { if (cur) wrapped.push(cur); cur = w; }
      }
      if (cur) wrapped.push(cur);
      if (!wrapped.length) continue;

      for (let i = 0; i < wrapped.length; i++) {
        if (cy + lineH > state.bodyBottom) cy = (contentPage(slideTitle), state.y);
        if (isBullet && i === 0) {
          doc.fillColor(COLORS.red).fontSize(12).font('Helvetica').text('•', lm + 1, cy);
          doc.fillColor(COLORS.slate).fontSize(12).font('Helvetica').text(wrapped[i], lm + indent, cy, { width: tw });
        } else {
          doc.fillColor(COLORS.slate).fontSize(12).font('Helvetica').text(wrapped[i], lm + indent, cy, { width: tw });
        }
        cy += lineH;
      }
      cy += 4;
    }
    state.y = cy;
  }

  // ---------- COVER (page 1) ----------
  (function cover() {
    doc.rect(0, 0, pw, 8).fill(COLORS.red);
    const bandY = ph - 130;
    doc.rect(0, bandY, pw, 130).fill(COLORS.red);
    doc.rect(lm, 96, 5, 34).fill(COLORS.red);

    let y = 64;
    if (logoPath) {
      try {
        const img = doc.openImage(logoPath);
        const w = 74;
        const h = img.height * (w / img.width);
        doc.image(logoPath, (pw - w) / 2, y, { width: w });
        y += h + 16;
      } catch (_) {}
    }
    doc.fontSize(31).font('Helvetica-Bold').fillColor(COLORS.dark).text(info.companyName.toUpperCase(), 0, y, { align: 'center', width: pw });
    y += 42;
    if (title) {
      doc.fontSize(16).font('Helvetica').fillColor(COLORS.gray).text(title, 0, y, { align: 'center', width: pw });
      y += 28;
    }
    if (tagline) {
      doc.fontSize(11).font('Helvetica-Oblique').fillColor(COLORS.gray).text(tagline, 0, y, { align: 'center', width: pw });
      y += 24;
    }
    doc.moveTo(pw / 2 - 70, y + 8).lineTo(pw / 2 + 70, y + 8).strokeColor(COLORS.red).lineWidth(2).stroke();

    const contactLine = [
      info.companyAddress,
      info.companyPhone ? `Phone: ${info.companyPhone}` : '',
      info.companyEmail ? `Email: ${info.companyEmail}` : '',
      info.companyWebsite ? `Web: ${info.companyWebsite}` : '',
      info.taxId ? `Tax ID: ${info.taxId}` : '',
    ].filter(Boolean).join('     |     ');
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.white).text(contactLine, lm, bandY + 26, { align: 'center', width: cw });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.white).text(info.companyName, 0, bandY + 70, { align: 'center', width: pw });
    footer();
  })();

  // ---------- CONTENT SLIDES ----------
  for (const slide of slides) {
    contentPage(slide.title);
    body(slide.content, slide.title);
  }

  // ---------- CLOSING ----------
  (function closing() {
    contentPage('Contact Us');
    doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.dark).text('Thank You', 0, state.bodyTop, { align: 'center', width: pw });
    doc.fontSize(12).font('Helvetica').fillColor(COLORS.slate).text('We appreciate your time and look forward to working with you.', 0, state.bodyTop + 36, { align: 'center', width: pw });

    const cardY = state.bodyTop + 86;
    doc.rect(lm, cardY, cw, 150).fill('#f8fafc');
    doc.rect(lm, cardY, cw, 6).fill(COLORS.red);
    doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.dark).text(info.companyName, 0, cardY + 26, { align: 'center', width: pw });
    const cl = [
      info.companyAddress,
      info.companyPhone ? `Phone: ${info.companyPhone}` : '',
      info.companyEmail ? `Email: ${info.companyEmail}` : '',
      info.companyWebsite ? `Web: ${info.companyWebsite}` : '',
      info.taxId ? `Tax ID: ${info.taxId}` : '',
    ].filter(Boolean);
    doc.fontSize(11).font('Helvetica').fillColor(COLORS.slate);
    let cy = cardY + 60;
    for (const line of cl) { doc.text(line, 0, cy, { align: 'center', width: pw }); cy += 18; }
  })();

  doc.end();
}

// ============================================================
// POWERPOINT PRESENTATION (.pptx)
// ============================================================
export async function buildPresentationPptx(
  res: Response,
  info: CompanyInfo,
  title: string,
  tagline: string,
  slides: PresentationSlide[]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const W = 13.333;
  const H = 7.5;
  const logoPath = resolveLogoPath(info.logoUrl);
  const contacts = [
    info.companyAddress,
    info.companyPhone ? `Phone: ${info.companyPhone}` : '',
    info.companyEmail ? `Email: ${info.companyEmail}` : '',
    info.companyWebsite ? `Web: ${info.companyWebsite}` : '',
  ].filter(Boolean);

  const tryLogo = (slide: any, w: number, x: number, y: number) => {
    if (logoPath) { try { slide.addImage({ path: logoPath, x, y, w, h: w, sizing: { type: 'contain' } }); } catch (_) {} }
  };

  // ---------- COVER ----------
  const cover = pptx.addSlide();
  cover.background = { color: 'FFFFFF' };
  cover.addShape('rect', { x: 0, y: 0, w: W, h: 0.14, fill: { color: 'DC2626' } });
  cover.addShape('rect', { x: 0, y: H - 1.5, w: W, h: 1.5, fill: { color: 'DC2626' } });
  tryLogo(cover, 1.3, (W - 1.3) / 2, 0.75);
  cover.addText(info.companyName.toUpperCase(), { x: 0.5, y: 2.2, w: W - 1, h: 1.0, fontSize: 42, bold: true, color: '1E293B', fontFace: 'Arial', align: 'center', charSpacing: 3 });
  cover.addText(title, { x: 0.5, y: 3.3, w: W - 1, h: 0.6, fontSize: 20, color: '64748B', fontFace: 'Arial', align: 'center' });
  if (tagline) cover.addText(tagline, { x: 0.5, y: 3.95, w: W - 1, h: 0.5, fontSize: 14, italic: true, color: '94A3B8', align: 'center' });
  cover.addShape('rect', { x: (W - 1.4) / 2, y: 4.65, w: 1.4, h: 0.06, fill: { color: 'DC2626' } });
  cover.addText(contacts.join('    |    '), { x: 0.5, y: H - 1.1, w: W - 1, h: 0.4, fontSize: 11, color: 'FFFFFF', align: 'center', fontFace: 'Arial' });
  cover.addText(info.companyName, { x: 0.5, y: H - 0.68, w: W - 1, h: 0.4, fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial' });

  // ---------- CONTENT SLIDES ----------
  slides.forEach((slide, idx) => {
    const sn = pptx.addSlide();
    sn.background = { color: 'FFFFFF' };
    sn.addShape('rect', { x: 0, y: 0, w: W, h: 0.14, fill: { color: 'DC2626' } });
    tryLogo(sn, 0.42, 0.5, 0.28);
    sn.addText(info.companyName, { x: 1.05, y: 0.3, w: 6, h: 0.35, fontSize: 11, bold: true, color: '1E293B', fontFace: 'Arial' });
    sn.addShape('rect', { x: 0, y: 0.78, w: W, h: 0.7, fill: { color: '1E293B' } });
    sn.addShape('rect', { x: 0, y: 0.78, w: 0.14, h: 0.7, fill: { color: 'DC2626' } });
    sn.addText(slide.title, { x: 0.5, y: 0.82, w: W - 1, h: 0.6, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle', fontFace: 'Arial' });
    sn.addShape('line', { x: 0.5, y: H - 0.6, w: W - 1, h: 0, line: { color: 'E2E8F0', width: 1 } });
    sn.addText(info.companyName, { x: 0.5, y: H - 0.55, w: 4, h: 0.3, fontSize: 9, color: '94A3B8', fontFace: 'Arial' });
    sn.addText(`Page ${idx + 2}`, { x: W - 1.2, y: H - 0.55, w: 0.8, h: 0.3, fontSize: 9, color: '94A3B8', align: 'right', fontFace: 'Arial' });

    const paras = String(slide.content || '').split('\n').map((p) => p.trim()).filter(Boolean);
    const blocks: any[] = [];
    paras.forEach((p) => {
      const bullet = /^[-*•\u2022]\s*/.test(p);
      blocks.push({
        text: p.replace(/^[-*•\u2022]\s*/, ''),
        options: bullet
          ? { bullet: { code: '2022', indent: 14 }, breakLine: true, paragraphSpacingAfter: 8 }
          : { breakLine: true, paragraphSpacingAfter: 10 },
      });
    });
    if (blocks.length) {
      sn.addText(blocks, { x: 0.65, y: 1.75, w: W - 1.3, h: H - 2.7, fontSize: 16, color: '334155', fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.2 });
    }
  });

  // ---------- CLOSING ----------
  const close = pptx.addSlide();
  close.background = { color: 'FFFFFF' };
  close.addShape('rect', { x: 0, y: 0, w: W, h: 0.14, fill: { color: 'DC2626' } });
  close.addShape('rect', { x: 0, y: H - 1.5, w: W, h: 1.5, fill: { color: 'DC2626' } });
  close.addText('Contact Us', { x: 0.5, y: 1.05, w: W - 1, h: 0.9, fontSize: 40, bold: true, color: '1E293B', align: 'center', fontFace: 'Arial' });
  close.addShape('rect', { x: (W - 1.2) / 2, y: 2.0, w: 1.2, h: 0.06, fill: { color: 'DC2626' } });
  close.addText('Thank you for your time. We look forward to working with you.', { x: 0.5, y: 2.3, w: W - 1, h: 0.5, fontSize: 16, italic: true, color: '334155', align: 'center', fontFace: 'Arial' });
  close.addText(contacts.join('\n'), { x: 0.5, y: 3.2, w: W - 1, h: 2.4, fontSize: 16, color: '1E293B', align: 'center', lineSpacingMultiple: 1.3, fontFace: 'Arial' });
  close.addText(info.companyName, { x: 0.5, y: H - 0.68, w: W - 1, h: 0.4, fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Arial' });

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="presentation-${Date.now()}.pptx"`);
  res.send(buffer);
}