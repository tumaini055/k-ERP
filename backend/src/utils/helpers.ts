import { v4 as uuidv4 } from 'uuid';

export const generateCode = (prefix: string): string => {
  const num = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `${prefix}-${num}`;
};

export const generateInvoiceNumber = (): string => {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `INV-${year}-${num}`;
};

export const generateTicketCode = (): string => {
  const num = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `TKT-${num}`;
};

export const generateProjectCode = (): string => {
  const year = new Date().getFullYear().toString().slice(-2);
  const num = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `PRJ-${year}-${num}`;
};

export const calculatePagination = (page: number = 1, limit: number = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit, page };
};

export const formatCurrency = (amount: number, currency: string = 'TZS'): string => {
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const parseDate = (date: string): Date => {
  return new Date(date);
};

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
