export interface User {
  id: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  department?: string;
  position?: string;
  avatar_url?: string;
  language: 'en' | 'sw';
  is_active: boolean;
  company_id?: string;
  branch_id?: string;
  last_login?: string;
  created_at: string;
}

export type UserRole =
  | 'super_admin'
  | 'managing_director'
  | 'accountant'
  | 'project_manager'
  | 'engineer'
  | 'sales_officer'
  | 'customer';

export interface Customer {
  id: string;
  customer_code: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  name: string;
  description?: string;
  category?: string;
  status: ProjectStatus;
  priority: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  actual_cost?: number;
  customer_id?: string;
  manager_id?: string;
  customer?: Customer;
  manager?: Partial<User>;
  tasks?: ProjectTask[];
  milestones?: ProjectMilestone[];
  created_at: string;
}

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: string;
  assigned_to?: string;
  assignee?: Partial<User>;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ProjectMilestone {
  id: string;
  name: string;
  due_date?: string;
  is_completed: boolean;
}

export interface SupportTicket {
  id: string;
  ticket_code: string;
  subject: string;
  description?: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  customer_id?: string;
  assigned_to?: string;
  customer?: Customer;
  assigned?: Partial<User>;
  responses?: TicketResponse[];
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  due_date?: string;
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'on_hold';

export interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  user?: Partial<User>;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  issue_date: string;
  due_date?: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  tax_rate?: number;
  discount_amount?: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  notes?: string;
  terms?: string;
  customer_id?: string;
  project_id?: string;
  customer?: Customer;
  items?: InvoiceItem[];
  payments?: Payment[];
  created_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  total_price: number;
  sort_order?: number;
}

export interface Payment {
  id: string;
  invoice_id?: string;
  payment_number?: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  payment_date: string;
  received_by?: string;
}

export interface Expense {
  id: string;
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit_price: number;
  cost_price: number;
  category_id?: string;
  category?: { name: string };
  inventory?: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  product_id: string;
  branch_id?: string;
  quantity: number;
  location?: string;
}

export interface ISPPackage {
  id: string;
  name: string;
  type: 'home' | 'business' | 'enterprise';
  bandwidth_download: number;
  bandwidth_upload: number;
  bandwidth_unit: string;
  price: number;
  setup_fee: number;
  billing_cycle: string;
  is_active: boolean;
}

export interface ISPSubscriber {
  id: string;
  subscriber_code: string;
  customer_id?: string;
  package_id?: string;
  service_status: string;
  installation_address?: string;
  installation_date?: string;
  connection_type?: string;
  static_ip?: string;
  notes?: string;
  customer?: Customer;
  package?: ISPPackage;
  created_at: string;
}

export interface ISPBilling {
  id: string;
  subscriber_id: string;
  invoice_id?: string;
  billing_date: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
  paid_at?: string;
  subscriber?: { subscriber_code: string; customer?: { company_name?: string } };
  created_at: string;
}

export interface ServiceContract {
  id: string;
  contract_number: string;
  title: string;
  description?: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  renewal_date?: string;
  value?: number;
  sla_response_hours?: number;
  sla_resolution_hours?: number;
  status: ContractStatus;
  notes?: string;
  customer_id?: string;
  customer?: Customer;
  renewals?: ContractRenewal[];
  created_at: string;
  updated_at?: string;
}

export interface ContractRenewal {
  id: string;
  contract_id: string;
  renewed_from?: string;
  renewed_to?: string;
  renewal_date: string;
  new_value?: number;
  notes?: string;
  created_at: string;
}

export type ContractStatus = 'active' | 'expired' | 'terminated' | 'pending';

export interface DashboardStats {
  total_customers: number;
  active_projects: number;
  completed_projects: number;
  open_tickets: number;
  total_employees: number;
  total_revenue: number;
  monthly_revenue: { month: string; revenue: number }[];
  project_statuses: Record<string, number>;
  recent_activities: any[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Lead {
  id: string;
  title: string;
  description?: string;
  source?: string;
  status: LeadStatus;
  value?: number;
  assigned_to?: string;
  customer_id?: string;
  customer?: Customer;
  created_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface CompanySettings {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_website?: string;
  tax_id?: string;
  currency?: string;
  date_format?: string;
  timezone?: string;
  language?: string;
  invoice_prefix?: string;
  invoice_terms?: string;
  default_tax_rate?: number;
}

export interface CalendarEvent {
  id: string;
  source: 'event' | 'task' | 'milestone' | 'contract' | 'leave' | 'ticket';
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  type?: string;
  location?: string;
  meta?: Record<string, any>;
}

export interface AppDocument {
  id: string;
  name: string;
  description?: string;
  type?: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  version: number;
  tags?: string[];
  folder_id?: string;
  folder?: DocumentFolder;
  uploader?: Partial<User>;
  uploaded_by?: string;
  versions?: DocumentVersion[];
  created_at: string;
  updated_at?: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  file_url: string;
  file_size?: number;
  change_notes?: string;
  uploader?: Partial<User>;
  created_at: string;
}
