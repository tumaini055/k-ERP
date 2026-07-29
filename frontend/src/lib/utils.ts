import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number, currency?: string): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2);
    return `${sign}TSH ${val.replace(/\.?0+$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(2);
    return `${sign}TSH ${val.replace(/\.?0+$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}TSH ${abs.toLocaleString('en-US')}`;
  }
  return `${sign}TSH ${abs}`;
};

export const formatCurrencyFull = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}TSH ${abs.toLocaleString('en-US')}`;
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: 'success',
    completed: 'success',
    paid: 'success',
    resolved: 'success',
    won: 'success',
    in_progress: 'info',
    sent: 'info',
    pending: 'warning',
    planning: 'warning',
    open: 'warning',
    overdue: 'danger',
    cancelled: 'danger',
    expired: 'danger',
    lost: 'danger',
  };
  return colors[status] || 'info';
};

export const getStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const getUserInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'managing_director', label: 'Managing Director' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'engineer', label: 'Engineer / Technician' },
  { value: 'sales_officer', label: 'Sales & Marketing Officer' },
  { value: 'customer', label: 'Customer' },
] as const;

export const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;
