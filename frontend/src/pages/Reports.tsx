import { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, FileText, Download, FileDown, X, DollarSign, Users, Briefcase, Package, Wifi, Ticket, UserCircle, Calendar } from 'lucide-react';
import { dataService } from '../services/dataService';
import { formatCurrency } from '../lib/utils';
import jsPDF from 'jspdf';

type ReportKey = 'profit-loss' | 'revenue' | 'expenses' | 'financial' | 'customers' | 'leads' | 'customer-activity' | 'projects' | 'project-budget' | 'resource-allocation' | 'inventory' | 'isp' | 'tickets' | 'employees';

type ReportDef = {
  key: ReportKey;
  name: string;
  description: string;
  icon: any;
  color: string;
};

const reportCategories = [
  {
    title: 'Financial Reports',
    icon: BarChart3,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    reports: [
      { key: 'financial', name: 'Financial Report', description: 'Income & expenses by period with PDF export' } as ReportDef,
      { key: 'profit-loss', name: 'Profit & Loss Statement', description: 'Income and expenses overview' } as ReportDef,
      { key: 'revenue', name: 'Revenue Analysis', description: 'Revenue breakdown by customer' } as ReportDef,
      { key: 'expenses', name: 'Expense Analysis', description: 'Expense tracking and trends' } as ReportDef,
    ],
  },
  {
    title: 'Customer Reports',
    icon: FileSpreadsheet,
    color: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
    reports: [
      { key: 'customers', name: 'Customer List', description: 'All registered customers' } as ReportDef,
      { key: 'leads', name: 'Lead Conversion', description: 'Lead to customer conversion rates' } as ReportDef,
      { key: 'customer-activity', name: 'Customer Activity', description: 'Customer engagement report' } as ReportDef,
    ],
  },
  {
    title: 'Project Reports',
    icon: FileText,
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    reports: [
      { key: 'projects', name: 'Project Status', description: 'All projects current status' } as ReportDef,
      { key: 'project-budget', name: 'Project Budget', description: 'Budget vs actual costs' } as ReportDef,
      { key: 'resource-allocation', name: 'Resource Allocation', description: 'Team workload distribution' } as ReportDef,
    ],
  },
  {
    title: 'Operational Reports',
    icon: Download,
    color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    reports: [
      { key: 'inventory', name: 'Inventory Report', description: 'Stock levels and valuation' } as ReportDef,
      { key: 'isp', name: 'ISP Analytics', description: 'Subscriber and bandwidth usage' } as ReportDef,
      { key: 'tickets', name: 'Support Report', description: 'Ticket resolution metrics' } as ReportDef,
      { key: 'employees', name: 'Employee Report', description: 'Staff performance and attendance' } as ReportDef,
    ],
  },
];

const reportIcons: Record<ReportKey, any> = {
  'financial': Calendar,
  'profit-loss': DollarSign,
  'revenue': BarChart3,
  'expenses': FileText,
  'customers': Users,
  'leads': Users,
  'customer-activity': Users,
  'projects': Briefcase,
  'project-budget': Briefcase,
  'resource-allocation': Users,
  'inventory': Package,
  'isp': Wifi,
  'tickets': Ticket,
  'employees': UserCircle,
};

const reportColors: Record<ReportKey, string> = {
  'financial': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'profit-loss': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'revenue': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'expenses': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'customers': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'leads': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'customer-activity': 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  'projects': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'project-budget': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'resource-allocation': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'inventory': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'isp': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'tickets': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'employees': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
};

function downloadCSV(rows: any[][], filename: string) {
  const csv = rows.map(r => r.map(c => typeof c === 'string' && (c.includes(',') || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const reportNames: Record<string, string> = {
  'financial': 'Financial Report',
  'profit-loss': 'Profit & Loss Statement',
  'revenue': 'Revenue Analysis',
  'expenses': 'Expense Analysis',
  'customers': 'Customer List',
  'leads': 'Lead Conversion Report',
  'customer-activity': 'Customer Activity Report',
  'projects': 'Project Status Report',
  'project-budget': 'Project Budget vs Actual',
  'resource-allocation': 'Resource Allocation Report',
  'inventory': 'Inventory Report',
  'isp-analytics': 'ISP Analytics',
  'support-tickets': 'Support Ticket Report',
  'employees': 'Employee Report',
};

function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  pdf.text(`Page ${pageNum} of ${totalPages}`, pdf.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
  pdf.text(`Generated: ${dateStr}`, pdf.internal.pageSize.getWidth() / 2, 281, { align: 'center' });
}

function addHeader(pdf: jsPDF, title: string) {
  pdf.setFontSize(20);
  pdf.setTextColor(40);
  pdf.text(title, 20, 25);
  pdf.setDrawColor(200);
  pdf.setLineWidth(0.5);
  pdf.line(20, 30, 190, 30);
}

function getColumnCharWidth(text: string): number {
  let w = 0;
  for (const c of text) {
    w += (c.match(/[\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef]/) ? 1.8 : 1);
  }
  return w;
}

function autoFitColumns(headers: string[], data: string[][], maxWidth: number): number[] {
  const colCount = headers.length;
  const colW = new Array(colCount).fill(0);
  for (let i = 0; i < colCount; i++) {
    let max = getColumnCharWidth(headers[i]);
    for (const row of data) {
      const v = row[i] || '';
      const w = getColumnCharWidth(v);
      if (w > max) max = w;
    }
    colW[i] = Math.min(max, maxWidth * 0.35);
  }
  const total = colW.reduce((s, w) => s + w, 0);
  const scale = total > 0 ? (maxWidth - (colCount - 1) * 2) / total : 1;
  for (let i = 0; i < colCount; i++) {
    colW[i] = colW[i] * scale;
  }
  if (colCount > 0) {
    const diff = maxWidth - (colW.reduce((s, w) => s + w, 0) + (colCount - 1) * 2);
    if (diff > 0) colW[colCount - 1] = Math.min(colW[colCount - 1] + diff, maxWidth * 0.4);
  }
  return colW;
}

function drawTable(pdf: jsPDF, headers: string[], data: string[][], startY: number, maxY: number): number {
  const marginX = 15;
  const pageW = pdf.internal.pageSize.getWidth();
  const maxWidth = pageW - 2 * marginX;
  const colW = autoFitColumns(headers, data, maxWidth);
  const rowHeight = 6.5;
  const fontSize = 9;

  let y = startY;

  for (const rows of [headers, ...data]) {
    if (y + rowHeight > maxY) {
      addFooter(pdf, pdf.getNumberOfPages(), pdf.getNumberOfPages());
      pdf.addPage();
      pdf.setFontSize(20);
      pdf.setTextColor(40);
      pdf.text('continued...', 20, 20);
      addFooter(pdf, pdf.getNumberOfPages(), pdf.getNumberOfPages());
      y = 40;
    }

    const isHeader = rows === headers;
    const isEven = data.indexOf(rows) !== -1 && (data.indexOf(rows) % 2 === 0);
    if (isHeader) {
      pdf.setFillColor(55, 55, 55);
      pdf.setTextColor(255);
      pdf.setFont('Helvetica', 'bold');
    } else if (isEven) {
      pdf.setFillColor(240, 240, 240);
      pdf.setTextColor(50);
      pdf.setFont('Helvetica', 'normal');
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.setTextColor(50);
      pdf.setFont('Helvetica', 'normal');
    }
    pdf.rect(marginX, y, maxWidth, rowHeight, 'F');

    pdf.setFontSize(fontSize);
    let x = marginX;
    pdf.setFont('Helvetica', isHeader ? 'bold' : 'normal');
    for (let i = 0; i < rows.length; i++) {
      const cellX = x + 2;
      const cellW = colW[i] - 2;
      let text = rows[i];
      if (text && text.length > 0) {
        while (getColumnCharWidth(text) * fontSize * 0.12 > cellW && text.length > 3) {
          text = text.slice(0, -1);
        }
        if (text !== rows[i]) text = text.slice(0, -3) + '...';
      }
      pdf.text(text || '', cellX, y + rowHeight * 0.68);
      x += colW[i] + 2;
    }
    y += rowHeight;
  }

  return y;
}

function addSummaryLine(pdf: jsPDF, label: string, value: string, y: number, maxY: number): number {
  if (y + 6 > maxY) {
    addFooter(pdf, pdf.getNumberOfPages(), pdf.getNumberOfPages());
    pdf.addPage();
    addFooter(pdf, pdf.getNumberOfPages(), pdf.getNumberOfPages());
    y = 40;
  }
  pdf.setFont('Helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(60);
  pdf.text(label, 15, y);
  pdf.setFont('Helvetica', 'normal');
  pdf.setTextColor(80);
  pdf.text(value, 100, y);
  return y + 7;
}

const pdfExports: Record<string, (reportName: string, data: any) => Promise<void>> = {
  'financial': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Period`, `${data.period} (${data.start_date} to ${data.end_date})`],
      [`Total Income`, `TSh ${data.total_income?.toLocaleString()}`],
      [`Total Expenses`, `TSh ${data.total_expenses?.toLocaleString()}`],
      [`Net Profit`, `TSh ${data.net_profit?.toLocaleString()}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Period', 'Income', 'Expenses', 'Profit'];
    const rows = (data.periods || []).map((p: any) => [
      p.label,
      `TSh ${p.income.toLocaleString()}`,
      `TSh ${p.expenses.toLocaleString()}`,
      `TSh ${p.profit.toLocaleString()}`,
    ]);
    y = drawTable(pdf, headers, rows, y, 275);

    if (data.expense_by_category?.length > 0) {
      y += 10;
      const catHeaders = ['Category', 'Amount'];
      const catRows = data.expense_by_category.map((c: any) => [c.category, `TSh ${c.amount.toLocaleString()}`]);
      drawTable(pdf, catHeaders, catRows, y, 275);
    }

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'financial-report'}.pdf`);
  },
  'profit-loss': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Revenue`, `TSh ${data.total_revenue?.toLocaleString()}`],
      [`Total Expenses`, `TSh ${data.total_expenses?.toLocaleString()}`],
      [`Net Profit`, `TSh ${data.net_profit?.toLocaleString()}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Month', 'Income', 'Expenses', 'Profit'];
    const rows = (data.monthly || []).map((m: any) => [
      m.month,
      `TSh ${m.income.toLocaleString()}`,
      `TSh ${m.expenses.toLocaleString()}`,
      `TSh ${m.profit.toLocaleString()}`
    ]);
    y = drawTable(pdf, headers, rows, y, 275);

    y += 10;
    const catHeaders = ['Category', 'Amount'];
    const catRows = (data.expense_by_category || []).map((c: any) => [c.category, `TSh ${c.amount.toLocaleString()}`]);
    drawTable(pdf, catHeaders, catRows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'profit-loss'}.pdf`);
  },

  'revenue': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Revenue`, `TSh ${data.total_revenue?.toLocaleString()}`],
      [`Outstanding Invoices`, `TSh ${data.outstanding_invoices?.toLocaleString()}`],
      [`Payments Made`, `${data.payment_count}`],
      [`Invoices Sent`, `${data.invoice_count}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Month', 'Revenue'];
    const rows = (data.monthly || []).map((m: any) => [m.month, `TSh ${m.revenue.toLocaleString()}`]);
    y = drawTable(pdf, headers, rows, y, 275);

    y += 10;
    const custHeaders = ['Customer', 'Amount'];
    const custRows = (data.by_customer || []).map((c: any) => [c.customer, `TSh ${c.amount.toLocaleString()}`]);
    drawTable(pdf, custHeaders, custRows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'revenue'}.pdf`);
  },

  'expenses': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    y = addSummaryLine(pdf, `Total Expenses`, `TSh ${data.total_expenses?.toLocaleString()}`, y, 275);
    y += 5;

    const catHeaders = ['Category', 'Count', 'Amount'];
    const catRows = (data.by_category || []).map((c: any) => [c.category, `${c.count}`, `TSh ${c.amount.toLocaleString()}`]);
    y = drawTable(pdf, catHeaders, catRows, y, 275);

    y += 10;
    const monthHeaders = ['Month', 'Amount'];
    const monthRows = (data.monthly || []).map((m: any) => [m.month, `TSh ${m.amount.toLocaleString()}`]);
    y = drawTable(pdf, monthHeaders, monthRows, y, 275);

    y += 10;
    const listHeaders = ['Description', 'Category', 'Amount', 'Date'];
    const listRows = (data.list || []).map((e: any) => [e.description?.slice(0, 50) || '', e.category, `TSh ${e.amount}`, e.date || '']);
    drawTable(pdf, listHeaders, listRows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'expenses'}.pdf`);
  },

  'customers': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;
    y = addSummaryLine(pdf, `Total Customers`, `${data.total}`, y, 275);
    y += 5;

    const headers = ['Company', 'Contact', 'Projects', 'Invoiced', 'Paid'];
    const rows = (data.data || []).map((c: any) => [
      c.company_name?.slice(0, 25) || '',
      c.contact_person || '',
      `${c.active_projects}/${c.total_projects}`,
      `TSh ${c.total_invoiced?.toLocaleString()}`,
      `TSh ${c.total_paid?.toLocaleString()}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'customers'}.pdf`);
  },

  'leads': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Leads`, `${data.total}`],
      [`Converted`, `${data.converted_count}`],
      [`Conversion Rate`, `${data.conversion_rate}%`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const statusHeaders = ['Status', 'Count'];
    const statusRows = (data.by_status || []).map((s: any) => [s.status, `${s.count}`]);
    y = drawTable(pdf, statusHeaders, statusRows, y, 275);

    y += 10;
    const trendHeaders = ['Month', 'Total', 'Won'];
    const trendRows = (data.monthly_trend || []).map((m: any) => [m.month, `${m.total}`, `${m.won}`]);
    drawTable(pdf, trendHeaders, trendRows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'leads'}.pdf`);
  },

  'customer-activity': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;
    y = addSummaryLine(pdf, `Total Customers`, `${data.total}`, y, 275);
    y += 5;

    const headers = ['Company', 'Contact', 'Tickets', 'Projects', 'Invoices'];
    const rows = (data.data || []).map((c: any) => [
      c.company_name?.slice(0, 25) || '',
      c.contact_person || '',
      `${c.total_tickets}`,
      `${c.total_projects}`,
      `${c.total_invoices}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'customer-activity'}.pdf`);
  },

  'projects': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Projects`, `${data.total}`],
      [`Total Budget`, `TSh ${data.total_budget?.toLocaleString()}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Project', 'Customer', 'Status', 'Budget', 'Revenue'];
    const rows = (data.data || []).map((p: any) => [
      p.name?.slice(0, 25) || '',
      p.customer?.slice(0, 20) || '',
      p.status,
      `TSh ${p.budget?.toLocaleString()}`,
      `TSh ${p.recorded_revenue?.toLocaleString()}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'projects'}.pdf`);
  },

  'project-budget': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Budget`, `TSh ${data.total_budget?.toLocaleString()}`],
      [`Total Actual Cost`, `TSh ${data.total_actual?.toLocaleString()}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Project', 'Status', 'Budget', 'Actual', 'Variance', '%'];
    const rows = (data.data || []).map((p: any) => [
      p.name?.slice(0, 20) || '',
      p.status,
      `TSh ${p.budget?.toLocaleString()}`,
      `TSh ${p.actual_cost?.toLocaleString()}`,
      `TSh ${p.variance?.toLocaleString()}`,
      `${p.variance_pct}%`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'project-budget'}.pdf`);
  },

  'resource-allocation': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Team Members`, `${data.total}`],
      [`Total Tasks`, `${data.total_tasks}`],
      [`Pending Tasks`, `${data.total_pending}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Name', 'Role', 'Tasks', 'Pending', 'Completed', 'Projects'];
    const rows = (data.data || []).map((u: any) => [
      u.name || '',
      u.role || '',
      `${u.total_tasks}`,
      `${u.pending_tasks}`,
      `${u.completed_tasks}`,
      `${u.projects_count}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'resource-allocation'}.pdf`);
  },

  'inventory': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Products`, `${data.total}`],
      [`Total Value`, `TSh ${data.total_value?.toLocaleString()}`],
      [`Low Stock Items`, `${data.low_stock}`],
      [`Out of Stock`, `${data.out_of_stock}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Name', 'SKU', 'Category', 'Qty', 'Unit Price', 'Total', 'Status'];
    const rows = (data.data || []).map((p: any) => [
      p.name?.slice(0, 18) || '',
      p.sku || '',
      p.category || '',
      `${p.quantity}`,
      `TSh ${p.unit_price?.toLocaleString()}`,
      `TSh ${p.total_value?.toLocaleString()}`,
      p.status?.replace(/_/g, ' ') || '',
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'inventory'}.pdf`);
  },

  'isp-analytics': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Subscribers`, `${data.total_subscribers}`],
      [`Active Subscribers`, `${data.active_subscribers}`],
      [`Total Revenue`, `TSh ${data.total_revenue?.toLocaleString()}`],
      [`Outstanding`, `TSh ${data.outstanding?.toLocaleString()}`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Package', 'Speed', 'Price', 'Type', 'Subscribers'];
    const rows = (data.packages || []).map((p: any) => [
      p.name || '',
      p.speed || '',
      `TSh ${p.price?.toLocaleString()}`,
      p.type || '',
      `${p.subscriber_count}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'isp-analytics'}.pdf`);
  },

  'support-tickets': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Tickets`, `${data.total}`],
      [`Open Tickets`, `${data.open_tickets}`],
      [`Resolved`, `${data.resolved_tickets}`],
      [`Resolution Rate`, `${data.resolution_rate}%`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    y = drawTable(pdf, ['Status', 'Count'], (data.by_status || []).map((s: any) => [s.status, `${s.count}`]), y, 275);
    y += 5;
    y = drawTable(pdf, ['Priority', 'Count'], (data.by_priority || []).map((p: any) => [p.priority, `${p.count}`]), y, 275);

    y += 5;
    const listHeaders = ['Subject', 'Customer', 'Status', 'Priority', 'Assignee'];
    const listRows = (data.data || []).map((t: any) => [
      t.subject?.slice(0, 30) || '',
      t.customer?.slice(0, 18) || '',
      t.status,
      t.priority,
      t.assignee?.slice(0, 18) || '',
    ]);
    drawTable(pdf, listHeaders, listRows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'support-tickets'}.pdf`);
  },

  'employees': async (reportName, data) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    addHeader(pdf, reportName);
    let y = 45;

    const summary = [
      [`Total Employees`, `${data.total}`],
      [`Average Attendance`, `${data.average_attendance}%`],
    ];
    for (const [label, value] of summary) {
      y = addSummaryLine(pdf, label, value, y, 275);
    }
    y += 5;

    const headers = ['Name', 'Role', 'Department', 'Status', 'Attendance', 'Leaves'];
    const rows = (data.data || []).map((u: any) => [
      u.name || '',
      u.role?.replace(/_/g, ' ') || '',
      u.department || '',
      u.status || '',
      `${u.attendance_rate}%`,
      `${u.pending_leaves}`,
    ]);
    drawTable(pdf, headers, rows, y, 275);

    addFooter(pdf, 1, 1);
    pdf.save(`${data._filename || 'employees'}.pdf`);
  },
};

function downloadPDF(reportKey: string, data: any, filename: string) {
  const name = reportNames[filename] || filename.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const exporter = pdfExports[reportKey];
  if (!exporter) {
    console.warn('No PDF exporter for:', reportKey);
    return;
  }
  data._filename = filename;
  exporter(name, data);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    planning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    closed: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    low_stock: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    out_of_stock: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    in_stock: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    proposal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    negotiation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    present: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors[status] || 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

type ReportViewProps = {
  report: ReportDef;
  onClose: () => void;
};

function ProfitLossView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getProfitLoss({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="profit-loss-content">
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Expenses</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Net Profit</p><p className={`text-xl font-bold ${data.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.net_profit)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 pr-4 font-medium text-surface-500">Income</th><th className="py-2 pr-4 font-medium text-surface-500">Expenses</th><th className="py-2 font-medium text-surface-500">Profit</th></tr></thead>
            <tbody>{data.monthly?.map((m: any) => (
              <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 pr-4 text-green-600">{formatCurrency(m.income)}</td><td className="py-2 pr-4 text-red-600">{formatCurrency(m.expenses)}</td><td className={`py-2 ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(m.profit)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Expenses by Category</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Category</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead>
            <tbody>{data.expense_by_category?.map((c: any) => (
              <tr key={c.category} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{c.category}</td><td className="py-2 text-red-600">{formatCurrency(c.amount)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Month', 'Income', 'Expenses', 'Profit']];
          data.monthly?.forEach((m: any) => rows.push([m.month, m.income, m.expenses, m.profit]));
          rows.push([''], ['Total Revenue', data.total_revenue], ['Total Expenses', data.total_expenses], ['Net Profit', data.net_profit]);
          downloadCSV(rows, `profit-loss-${year}`);
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('profit-loss', data, `profit-loss-${year}`)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function RevenueView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getRevenueReport({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="revenue-content">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Outstanding</p><p className="text-xl font-bold text-orange-600">{formatCurrency(data.outstanding_invoices)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Payments</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.payment_count}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Invoices</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.invoice_count}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Revenue</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 font-medium text-surface-500">Revenue</th></tr></thead><tbody>{data.monthly?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 text-green-600">{formatCurrency(m.revenue)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Revenue by Customer</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Customer</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.by_customer?.map((c: any) => <tr key={c.customer} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{c.customer}</td><td className="py-2 text-green-600">{formatCurrency(c.amount)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Month', 'Revenue']];
          data.monthly?.forEach((m: any) => rows.push([m.month, m.revenue]));
          downloadCSV(rows, `revenue-${year}`);
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('revenue', data, `revenue-${year}`)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function ExpensesView({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    dataService.getExpenseReport({ year }).then(setData).finally(() => setLoading(false));
  }, [year]);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="expenses-content">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Expenses</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Category</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Category</th><th className="py-2 pr-4 font-medium text-surface-500">Count</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.by_category?.map((c: any) => <tr key={c.category} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{c.category}</td><td className="py-2 pr-4 text-surface-500">{c.count}</td><td className="py-2 text-red-600">{formatCurrency(c.amount)}</td></tr>)}</tbody></table></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 font-medium text-surface-500">Amount</th></tr></thead><tbody>{data.monthly?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 text-red-600">{formatCurrency(m.amount)}</td></tr>)}</tbody></table></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Description', 'Category', 'Amount', 'Date']];
          data.list?.forEach((e: any) => rows.push([e.description, e.category, e.amount, e.date]));
          downloadCSV(rows, `expenses-${year}`);
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('expenses', data, `expenses-${year}`)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function CustomersView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getCustomerReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="customers-content">
      <div className="mb-4 text-sm text-surface-500">Total Customers: <strong className="text-surface-900 dark:text-surface-50">{data.total}</strong></div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Company</th><th className="py-2 pr-3 font-medium text-surface-500">Contact</th><th className="py-2 pr-3 font-medium text-surface-500">Email</th><th className="py-2 pr-3 font-medium text-surface-500">Phone</th><th className="py-2 pr-3 font-medium text-surface-500">Projects</th><th className="py-2 pr-3 font-medium text-surface-500">Invoiced</th><th className="py-2 font-medium text-surface-500">Paid</th></tr></thead><tbody>{data.data?.map((c: any) => <tr key={c.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{c.company_name}</td><td className="py-2 pr-3 text-surface-500">{c.contact_person}</td><td className="py-2 pr-3 text-surface-500">{c.email}</td><td className="py-2 pr-3 text-surface-500">{c.phone}</td><td className="py-2 pr-3 text-surface-500">{c.active_projects}/{c.total_projects}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(c.total_invoiced)}</td><td className="py-2 text-green-600">{formatCurrency(c.total_paid)}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Company', 'Contact', 'Email', 'Phone', 'City', 'Active Projects', 'Total Projects', 'Invoiced', 'Paid', 'Outstanding']];
          data.data?.forEach((c: any) => rows.push([c.company_name, c.contact_person, c.email, c.phone, c.city, c.active_projects, c.total_projects, c.total_invoiced, c.total_paid, c.outstanding]));
          downloadCSV(rows, 'customers');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('customers', data, 'customers')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function LeadsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getLeadReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="leads-content">
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Leads</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Converted</p><p className="text-xl font-bold text-green-600">{data.converted_count}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Conversion Rate</p><p className="text-xl font-bold text-primary-600">{data.conversion_rate}%</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Status</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_status?.map((s: any) => <tr key={s.status} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4"><StatusBadge status={s.status} /></td><td className="py-2 text-surface-900 dark:text-surface-50">{s.count}</td></tr>)}</tbody></table></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Monthly Trend</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Month</th><th className="py-2 pr-4 font-medium text-surface-500">Total</th><th className="py-2 font-medium text-surface-500">Won</th></tr></thead><tbody>{data.monthly_trend?.map((m: any) => <tr key={m.month} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{m.month}</td><td className="py-2 pr-4 text-surface-500">{m.total}</td><td className="py-2 text-green-600">{m.won}</td></tr>)}</tbody></table></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Status', 'Count']];
          data.by_status?.forEach((s: any) => rows.push([s.status, s.count]));
          downloadCSV(rows, 'leads');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('leads', data, 'leads')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function CustomerActivityView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getCustomerActivityReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="customer-activity-content">
      <div className="mb-4 text-sm text-surface-500">Total Customers: <strong className="text-surface-900 dark:text-surface-50">{data.total}</strong></div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Company</th><th className="py-2 pr-3 font-medium text-surface-500">Contact</th><th className="py-2 pr-3 font-medium text-surface-500">Tickets</th><th className="py-2 pr-3 font-medium text-surface-500">Projects</th><th className="py-2 font-medium text-surface-500">Invoices</th></tr></thead><tbody>{data.data?.map((c: any) => <tr key={c.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{c.company_name}</td><td className="py-2 pr-3 text-surface-500">{c.contact_person}</td><td className="py-2 pr-3 text-surface-500">{c.total_tickets}</td><td className="py-2 pr-3 text-surface-500">{c.total_projects}</td><td className="py-2 text-surface-500">{c.total_invoices}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Company', 'Contact', 'Email', 'Phone', 'City', 'Tickets', 'Projects', 'Invoices']];
          data.data?.forEach((c: any) => rows.push([c.company_name, c.contact_person, c.email, c.phone, c.city, c.total_tickets, c.total_projects, c.total_invoices]));
          downloadCSV(rows, 'customer-activity');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('customer-activity', data, 'customer-activity')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function ProjectsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getProjectReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="projects-content">
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Projects</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Budget</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_budget)}</p></div>
      </div>
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
        <div className="flex flex-wrap gap-2">{data.by_status?.map((s: any) => <span key={s.status} className="flex items-center gap-2 text-sm"><StatusBadge status={s.status} /><span className="text-surface-500">({s.count})</span></span>)}</div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Customer</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Budget</th><th className="py-2 font-medium text-surface-500">Revenue</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.customer}</td><td className="py-2 pr-3"><StatusBadge status={p.status} /></td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.budget)}</td><td className="py-2 text-green-600">{formatCurrency(p.recorded_revenue)}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Name', 'Customer', 'Status', 'Budget', 'Revenue', 'Start Date', 'End Date']];
          data.data?.forEach((p: any) => rows.push([p.name, p.customer, p.status, p.budget, p.recorded_revenue, p.start_date, p.end_date]));
          downloadCSV(rows, 'projects');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('projects', data, 'projects')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function ProjectBudgetView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getProjectBudgetReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="project-budget-content">
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Budget</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_budget)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Actual Cost</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_actual)}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Project</th><th className="py-2 pr-3 font-medium text-surface-500">Customer</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Budget</th><th className="py-2 pr-3 font-medium text-surface-500">Actual</th><th className="py-2 pr-3 font-medium text-surface-500">Variance</th><th className="py-2 font-medium text-surface-500">%</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.customer}</td><td className="py-2 pr-3"><StatusBadge status={p.status} /></td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.budget)}</td><td className="py-2 pr-3 text-red-600">{formatCurrency(p.actual_cost)}</td><td className={`py-2 pr-3 ${p.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(p.variance)}</td><td className={`py-2 ${p.variance_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{p.variance_pct}%</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Project', 'Customer', 'Status', 'Budget', 'Actual Cost', 'Variance', 'Variance %']];
          data.data?.forEach((p: any) => rows.push([p.name, p.customer, p.status, p.budget, p.actual_cost, p.variance, `${p.variance_pct}%`]));
          downloadCSV(rows, 'project-budget');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('project-budget', data, 'project-budget')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function ResourceView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getResourceAllocationReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div id="resource-content">
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Team Members</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Tasks</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total_tasks}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Pending Tasks</p><p className="text-xl font-bold text-orange-600">{data.total_pending}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Role</th><th className="py-2 pr-3 font-medium text-surface-500">Tasks</th><th className="py-2 pr-3 font-medium text-surface-500">Pending</th><th className="py-2 pr-3 font-medium text-surface-500">Done</th><th className="py-2 font-medium text-surface-500">Projects</th></tr></thead><tbody>{data.data?.map((u: any) => <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800 cursor-pointer" onClick={() => setExpanded(expanded === u.id ? null : u.id)}><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{u.name}</td><td className="py-2 pr-3 text-surface-500 capitalize">{u.role.replace(/_/g, ' ')}</td><td className="py-2 pr-3 text-surface-500">{u.total_tasks}</td><td className="py-2 pr-3 text-orange-600">{u.pending_tasks}</td><td className="py-2 pr-3 text-green-600">{u.completed_tasks}</td><td className="py-2 text-surface-500">{u.projects_count}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Name', 'Role', 'Total Tasks', 'Pending', 'Completed', 'Projects']];
          data.data?.forEach((u: any) => rows.push([u.name, u.role, u.total_tasks, u.pending_tasks, u.completed_tasks, u.projects_count]));
          downloadCSV(rows, 'resource-allocation');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('resource-allocation', data, 'resource-allocation')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function InventoryView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getInventoryReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="inventory-content">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Products</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Value</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_value)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{data.low_stock}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Out of Stock</p><p className="text-xl font-bold text-red-600">{data.out_of_stock}</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">SKU</th><th className="py-2 pr-3 font-medium text-surface-500">Category</th><th className="py-2 pr-3 font-medium text-surface-500">Qty</th><th className="py-2 pr-3 font-medium text-surface-500">Unit Price</th><th className="py-2 pr-3 font-medium text-surface-500">Total</th><th className="py-2 font-medium text-surface-500">Status</th></tr></thead><tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.sku}</td><td className="py-2 pr-3 text-surface-500">{p.category}</td><td className="py-2 pr-3 text-surface-500">{p.quantity}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.unit_price)}</td><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{formatCurrency(p.total_value)}</td><td className="py-2"><StatusBadge status={p.status} /></td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Name', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Total Value', 'Status']];
          data.data?.forEach((p: any) => rows.push([p.name, p.sku, p.category, p.quantity, p.unit_price, p.total_value, p.status]));
          downloadCSV(rows, 'inventory');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('inventory', data, 'inventory')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function ISPView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getISPReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="isp-content">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Subscribers</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total_subscribers}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Active</p><p className="text-xl font-bold text-green-600">{data.active_subscribers}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Revenue</p><p className="text-xl font-bold text-primary-600">{formatCurrency(data.total_revenue)}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Outstanding</p><p className="text-xl font-bold text-orange-600">{formatCurrency(data.outstanding)}</p></div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Packages</h4>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Package</th><th className="py-2 pr-3 font-medium text-surface-500">Speed</th><th className="py-2 pr-3 font-medium text-surface-500">Price</th><th className="py-2 pr-3 font-medium text-surface-500">Type</th><th className="py-2 font-medium text-surface-500">Subscribers</th></tr></thead><tbody>{data.packages?.map((p: any) => <tr key={p.name} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{p.name}</td><td className="py-2 pr-3 text-surface-500">{p.speed}</td><td className="py-2 pr-3 text-surface-500">{formatCurrency(p.price)}</td><td className="py-2 pr-3 text-surface-500 capitalize">{p.type}</td><td className="py-2 text-surface-500">{p.subscriber_count}</td></tr>)}</tbody></table></div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Package', 'Speed', 'Price', 'Type', 'Subscribers']];
          data.packages?.forEach((p: any) => rows.push([p.name, p.speed, p.price, p.type, p.subscriber_count]));
          rows.push([''], ['Total Subscribers', data.total_subscribers], ['Active', data.active_subscribers], ['Collected', data.total_collected], ['Outstanding', data.outstanding]);
          downloadCSV(rows, 'isp-analytics');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('isp-analytics', data, 'isp-analytics')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function TicketsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getTicketReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="tickets-content">
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Tickets</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Open</p><p className="text-xl font-bold text-blue-600">{data.open_tickets}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Resolved</p><p className="text-xl font-bold text-green-600">{data.resolved_tickets}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Resolution Rate</p><p className="text-xl font-bold text-primary-600">{data.resolution_rate}%</p></div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Status</h4>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Status</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_status?.map((s: any) => <tr key={s.status} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4"><StatusBadge status={s.status} /></td><td className="py-2 text-surface-900 dark:text-surface-50">{s.count}</td></tr>)}</tbody></table></div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">By Priority</h4>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-4 font-medium text-surface-500">Priority</th><th className="py-2 font-medium text-surface-500">Count</th></tr></thead><tbody>{data.by_priority?.map((p: any) => <tr key={p.priority} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{p.priority}</td><td className="py-2 text-surface-900 dark:text-surface-50">{p.count}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Subject', 'Customer', 'Assignee', 'Status', 'Priority', 'Created']];
          data.data?.forEach((t: any) => rows.push([t.subject, t.customer, t.assignee, t.status, t.priority, t.created_at]));
          downloadCSV(rows, 'support-tickets');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('support-tickets', data, 'support-tickets')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function EmployeesView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { dataService.getEmployeeReport().then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>;
  if (!data) return null;
  return (
    <div id="employees-content">
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Employees</p><p className="text-xl font-bold text-surface-900 dark:text-surface-50">{data.total}</p></div>
        <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Avg Attendance</p><p className="text-xl font-bold text-primary-600">{data.average_attendance}%</p></div>
      </div>
      <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-surface-900"><tr className="border-b border-surface-200 dark:border-surface-700"><th className="py-2 pr-3 font-medium text-surface-500">Name</th><th className="py-2 pr-3 font-medium text-surface-500">Role</th><th className="py-2 pr-3 font-medium text-surface-500">Department</th><th className="py-2 pr-3 font-medium text-surface-500">Status</th><th className="py-2 pr-3 font-medium text-surface-500">Attendance</th><th className="py-2 font-medium text-surface-500">Pending Leave</th></tr></thead><tbody>{data.data?.map((u: any) => <tr key={u.id} className="border-b border-surface-100 dark:border-surface-800"><td className="py-2 pr-3 text-surface-900 dark:text-surface-50">{u.name}</td><td className="py-2 pr-3 text-surface-500 capitalize">{u.role.replace(/_/g, ' ')}</td><td className="py-2 pr-3 text-surface-500">{u.department}</td><td className="py-2 pr-3"><StatusBadge status={u.status} /></td><td className="py-2 pr-3 text-surface-500">{u.attendance_rate}%</td><td className="py-2 text-orange-600">{u.pending_leaves}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => {
          const rows = [['Name', 'Email', 'Role', 'Department', 'Status', 'Attendance Rate', 'Present Days', 'Pending Leaves']];
          data.data?.forEach((u: any) => rows.push([u.name, u.email, u.role, u.department, u.status, `${u.attendance_rate}%`, u.present_days, u.pending_leaves]));
          downloadCSV(rows, 'employees');
        }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
        <button onClick={() => downloadPDF('employees', data, 'employees')} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
      </div>
    </div>
  );
}

function FinancialReportView({ year }: { year: number }) {
  const now = new Date();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: any = { period };
    if (period === 'monthly') {
      params.month = selectedMonth;
      params.year = year;
    } else if (period === 'yearly') {
      params.year = year;
    } else {
      params.start_date = startDate;
      params.end_date = endDate;
    }
    dataService.getFinancialReport(params).then(setData).finally(() => setLoading(false));
  }, [period, selectedMonth, year, startDate, endDate]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const setQuickRange = (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setPeriod(p);
    const n = new Date();
    if (p === 'daily') {
      setStartDate(n.toISOString().slice(0, 10));
      const tomorrow = new Date(n.getTime() + 86400000);
      setEndDate(tomorrow.toISOString().slice(0, 10));
    } else if (p === 'weekly') {
      const dayOfWeek = n.getDay();
      const monday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday.getTime() + 7 * 86400000);
      setStartDate(monday.toISOString().slice(0, 10));
      setEndDate(sunday.toISOString().slice(0, 10));
    } else if (p === 'monthly') {
      setSelectedMonth(n.getMonth());
    }
  };

  return (
    <div id="financial-content">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
            <button key={p} onClick={() => setQuickRange(p)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-white text-primary-600 shadow-sm dark:bg-surface-700 dark:text-primary-400' : 'text-surface-500 hover:text-surface-700 dark:text-surface-400'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {(period === 'daily' || period === 'weekly') && (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input py-1 text-xs" />
            <span className="text-xs text-surface-400">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input py-1 text-xs" />
          </div>
        )}
        {period === 'monthly' && (
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="input py-1 text-xs">
            {monthNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-surface-500">Loading...</div>
      ) : !data ? null : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Income</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.total_income)}</p></div>
            <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Total Expenses</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.total_expenses)}</p></div>
            <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700"><p className="text-xs text-surface-500">Net Profit</p><p className={`text-xl font-bold ${data.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.net_profit)}</p></div>
          </div>

          <div className="mb-4">
            <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">{period.charAt(0).toUpperCase() + period.slice(1)} Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="py-2 pr-4 font-medium text-surface-500">Period</th>
                  <th className="py-2 pr-4 font-medium text-surface-500">Income</th>
                  <th className="py-2 pr-4 font-medium text-surface-500">Expenses</th>
                  <th className="py-2 font-medium text-surface-500">Profit</th>
                </tr></thead>
                <tbody>{data.periods?.map((p: any) => (
                  <tr key={p.label} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2 pr-4 text-surface-900 dark:text-surface-50">{p.label}</td>
                    <td className="py-2 pr-4 text-green-600">{formatCurrency(p.income)}</td>
                    <td className="py-2 pr-4 text-red-600">{formatCurrency(p.expenses)}</td>
                    <td className={`py-2 ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(p.profit)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {data.expense_by_category?.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">Top Expense Categories</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="py-2 pr-4 font-medium text-surface-500">Category</th>
                    <th className="py-2 font-medium text-surface-500">Amount</th>
                  </tr></thead>
                  <tbody>{data.expense_by_category.map((c: any) => (
                    <tr key={c.category} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-2 pr-4 text-surface-900 capitalize dark:text-surface-50">{c.category}</td>
                      <td className="py-2 text-red-600">{formatCurrency(c.amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={() => {
              const rows: any[][] = [['Period', 'Income', 'Expenses', 'Profit']];
              data.periods?.forEach((p: any) => rows.push([p.label, p.income, p.expenses, p.profit]));
              rows.push([''], ['Total Income', data.total_income], ['Total Expenses', data.total_expenses], ['Net Profit', data.net_profit]);
              downloadCSV(rows, `financial-report-${period}-${data.start_date}-to-${data.end_date}`);
            }} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"><FileDown size={16} /> CSV</button>
            <button onClick={() => dataService.downloadFinancialReportPdf({ period, start_date: data.start_date, end_date: data.end_date }).catch(() => {})} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><Download size={16} /> PDF</button>
          </div>
        </>
      )}
    </div>
  );
}

function ReportView({ report, onClose }: ReportViewProps) {
  const [year, setYear] = useState(new Date().getFullYear());

  const timedReports: ReportKey[] = ['profit-loss', 'revenue', 'expenses'];
  const isTimed = timedReports.includes(report.key);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-surface-900">
        <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${reportColors[report.key]}`}>
              {(() => { const Icon = reportIcons[report.key] || BarChart3; return <Icon size={22} />; })()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{report.name}</h2>
              <p className="text-xs text-surface-500">{report.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isTimed && (
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="input max-w-[120px] text-sm">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"><X size={20} /></button>
          </div>
        </div>
        <div className="px-6 py-4">
          {report.key === 'profit-loss' && <ProfitLossView year={year} />}
          {report.key === 'financial' && <FinancialReportView year={year} />}
          {report.key === 'revenue' && <RevenueView year={year} />}
          {report.key === 'expenses' && <ExpensesView year={year} />}
          {report.key === 'customers' && <CustomersView />}
          {report.key === 'leads' && <LeadsView />}
          {report.key === 'customer-activity' && <CustomerActivityView />}
          {report.key === 'projects' && <ProjectsView />}
          {report.key === 'project-budget' && <ProjectBudgetView />}
          {report.key === 'resource-allocation' && <ResourceView />}
          {report.key === 'inventory' && <InventoryView />}
          {report.key === 'isp' && <ISPView />}
          {report.key === 'tickets' && <TicketsView />}
          {report.key === 'employees' && <EmployeesView />}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporting & Analytics</h1>
          <p className="page-subtitle">Generate and export business reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {reportCategories.map((category) => (
          <div key={category.title} className="card">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.color}`}>
                {(() => { const Icon = category.icon; return <Icon size={22} />; })()}
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-surface-50">{category.title}</h3>
            </div>
            <div className="space-y-3">
              {(category.reports as ReportDef[]).map((report) => (
                <div
                  key={report.key}
                  onClick={() => setActiveReport(report)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-surface-200 p-3 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-700/50"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{report.name}</p>
                    <p className="text-xs text-surface-500">{report.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-primary-600 dark:hover:bg-surface-700" title="View Report">
                      <BarChart3 size={16} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeReport && (
        <ReportView
          report={activeReport}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
