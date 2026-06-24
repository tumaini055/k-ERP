import api from '../lib/api';
import { CompanySettings } from '../types';

export const dataService = {
  // Customers
  async getCustomers(params?: any) {
    const { data } = await api.get('/customers', { params });
    return data;
  },
  async getCustomer(id: string) {
    const { data } = await api.get(`/customers/${id}`);
    return data;
  },
  async createCustomer(body: any) {
    const { data } = await api.post('/customers', body);
    return data;
  },
  async updateCustomer(id: string, body: any) {
    const { data } = await api.put(`/customers/${id}`, body);
    return data;
  },
  async deleteCustomer(id: string) {
    const { data } = await api.delete(`/customers/${id}`);
    return data;
  },
  async getCustomerProjects(id: string) {
    const { data } = await api.get(`/customers/${id}/projects`);
    return data;
  },

  // Projects
  async getProjects(params?: any) {
    const { data } = await api.get('/projects', { params });
    return data;
  },
  async getProject(id: string) {
    const { data } = await api.get(`/projects/${id}`);
    return data;
  },
  async createProject(body: any) {
    const { data } = await api.post('/projects', body);
    return data;
  },
  async updateProject(id: string, body: any) {
    const { data } = await api.put(`/projects/${id}`, body);
    return data;
  },
  async deleteProject(id: string) {
    const { data } = await api.delete(`/projects/${id}`);
    return data;
  },
  async getProjectTasks(id: string) {
    const { data } = await api.get(`/projects/${id}/tasks`);
    return data;
  },
  async createTask(projectId: string, body: any) {
    const { data } = await api.post(`/projects/${projectId}/tasks`, body);
    return data;
  },
  async updateTask(taskId: string, body: any) {
    const { data } = await api.put(`/projects/tasks/${taskId}`, body);
    return data;
  },

  // Tickets
  async getTickets(params?: any) {
    const { data } = await api.get('/tickets', { params });
    return data;
  },
  async getTicket(id: string) {
    const { data } = await api.get(`/tickets/${id}`);
    return data;
  },
  async createTicket(body: any) {
    const { data } = await api.post('/tickets', body);
    return data;
  },
  async updateTicket(id: string, body: any) {
    const { data } = await api.put(`/tickets/${id}`, body);
    return data;
  },
  async addTicketResponse(ticketId: string, body: any) {
    const { data } = await api.post(`/tickets/${ticketId}/responses`, body);
    return data;
  },

  // Inventory
  async getProducts(params?: any) {
    const { data } = await api.get('/inventory/products', { params });
    return data;
  },
  async createProduct(body: any) {
    const { data } = await api.post('/inventory/products', body);
    return data;
  },
  async updateProduct(id: string, body: any) {
    const { data } = await api.put(`/inventory/products/${id}`, body);
    return data;
  },
  async stockIn(body: any) {
    const { data } = await api.post('/inventory/stock-in', body);
    return data;
  },
  async stockOut(body: any) {
    const { data } = await api.post('/inventory/stock-out', body);
    return data;
  },
  async getInventoryTransactions(params?: any) {
    const { data } = await api.get('/inventory/transactions', { params });
    return data;
  },
  async getCategories() {
    const { data } = await api.get('/inventory/categories');
    return data;
  },

  // Finance
  async getInvoices(params?: any) {
    const { data } = await api.get('/finance/invoices', { params });
    return data;
  },
  async getInvoice(id: string) {
    const { data } = await api.get(`/finance/invoices/${id}`);
    return data;
  },
  async createInvoice(body: any) {
    const { data } = await api.post('/finance/invoices', body);
    return data;
  },
  async updateInvoice(id: string, body: any) {
    const { data } = await api.put(`/finance/invoices/${id}`, body);
    return data;
  },
  async recordPayment(invoiceId: string, body: any) {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/payments`, body);
    return data;
  },
  async downloadInvoicePdf(invoiceId: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/finance/invoices/${invoiceId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  async getExpenses(params?: any) {
    const { data } = await api.get('/finance/expenses', { params });
    return data;
  },
  async createExpense(body: any) {
    const { data } = await api.post('/finance/expenses', body);
    return data;
  },
  async deleteExpense(id: string) {
    const { data } = await api.delete(`/finance/expenses/${id}`);
    return data;
  },
  async getRevenue(params?: any) {
    const { data } = await api.get('/finance/revenue', { params });
    return data;
  },

  // Dashboard
  async getDashboardStats() {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
  async getFinancialSummary() {
    const { data } = await api.get('/dashboard/financial-summary');
    return data;
  },

  // Employees
  async getEmployees(params?: any) {
    const { data } = await api.get('/employees', { params });
    return data;
  },
  async getEmployee(id: string) {
    const { data } = await api.get(`/employees/${id}`);
    return data;
  },
  async createEmployee(body: any) {
    const { data } = await api.post('/employees', body);
    return data;
  },
  async updateEmployee(id: string, body: any) {
    const { data } = await api.put(`/employees/${id}`, body);
    return data;
  },
  async getAttendance(userId: string, params?: any) {
    const { data } = await api.get(`/employees/${userId}/attendance`, { params });
    return data;
  },
  async recordAttendance(body: any) {
    const { data } = await api.post('/employees/attendance', body);
    return data;
  },
  async getLeaveRequests(params?: any) {
    const { data } = await api.get('/employees/leave-requests', { params });
    return data;
  },
  async createLeaveRequest(body: any) {
    const { data } = await api.post('/employees/leave-requests', body);
    return data;
  },
  async approveLeave(id: string) {
    const { data } = await api.put(`/employees/leave-requests/${id}/approve`);
    return data;
  },

  // ISP
  async getISPPackages(params?: any) {
    const { data } = await api.get('/isp/packages', { params });
    return data;
  },
  async createISPPackage(body: any) {
    const { data } = await api.post('/isp/packages', body);
    return data;
  },
  async updateISPPackage(id: string, body: any) {
    const { data } = await api.put(`/isp/packages/${id}`, body);
    return data;
  },
  async getISPSubscribers(params?: any) {
    const { data } = await api.get('/isp/subscribers', { params });
    return data;
  },
  async createISPSubscriber(body: any) {
    const { data } = await api.post('/isp/subscribers', body);
    return data;
  },
  async updateISPSubscriber(id: string, body: any) {
    const { data } = await api.put(`/isp/subscribers/${id}`, body);
    return data;
  },
  async getISPBilling(params?: any) {
    const { data } = await api.get('/isp/billing', { params });
    return data;
  },
  async createISPBilling(body: any) {
    const { data } = await api.post('/isp/billing', body);
    return data;
  },
  async payISPBilling(id: string, body?: any) {
    const { data } = await api.put(`/isp/billing/${id}/pay`, body || {});
    return data;
  },

  // Contracts
  async getContracts(params?: any) {
    const { data } = await api.get('/contracts', { params });
    return data;
  },
  async getContract(id: string) {
    const { data } = await api.get(`/contracts/${id}`);
    return data;
  },
  async createContract(body: any) {
    const { data } = await api.post('/contracts', body);
    return data;
  },
  async updateContract(id: string, body: any) {
    const { data } = await api.put(`/contracts/${id}`, body);
    return data;
  },
  async getExpiringContracts() {
    const { data } = await api.get('/contracts/expiring');
    return data;
  },
  async deleteContract(id: string) {
    const { data } = await api.delete(`/contracts/${id}`);
    return data;
  },
  async createRenewal(contractId: string, body: any) {
    const { data } = await api.post(`/contracts/${contractId}/renewals`, body);
    return data;
  },

  // Leads
  async getLeads(params?: any) {
    const { data } = await api.get('/leads', { params });
    return data;
  },
  async getLeadStats() {
    const { data } = await api.get('/leads/stats');
    return data;
  },
  async getLead(id: string) {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },
  async createLead(body: any) {
    const { data } = await api.post('/leads', body);
    return data;
  },
  async updateLead(id: string, body: any) {
    const { data } = await api.put(`/leads/${id}`, body);
    return data;
  },
  async deleteLead(id: string) {
    const { data } = await api.delete(`/leads/${id}`);
    return data;
  },
  async convertLead(id: string, body?: any) {
    const { data } = await api.post(`/leads/${id}/convert`, body || {});
    return data;
  },

  // Customer Contacts
  async getCustomerContacts(customerId: string) {
    const { data } = await api.get(`/customers/${customerId}/contacts`);
    return data;
  },
  async createCustomerContact(customerId: string, body: any) {
    const { data } = await api.post(`/customers/${customerId}/contacts`, body);
    return data;
  },

  // Project Milestones
  async getMilestones(projectId: string) {
    const { data } = await api.get(`/projects/${projectId}/milestones`);
    return data;
  },
  async createMilestone(projectId: string, body: any) {
    const { data } = await api.post(`/projects/${projectId}/milestones`, body);
    return data;
  },
  async updateMilestone(milestoneId: string, body: any) {
    const { data } = await api.put(`/projects/milestones/${milestoneId}`, body);
    return data;
  },
  async deleteMilestone(milestoneId: string) {
    const { data } = await api.delete(`/projects/milestones/${milestoneId}`);
    return data;
  },

  // Time Entries
  async getTimeEntries(projectId: string) {
    const { data } = await api.get(`/projects/${projectId}/time-entries`);
    return data;
  },
  async createTimeEntry(body: any) {
    const { data } = await api.post('/projects/time-entries', body);
    return data;
  },

  // Project Stats
  async getProjectStats() {
    const { data } = await api.get('/projects/stats/summary');
    return data;
  },

  // Project Expenses
  async getProjectExpenses(projectId: string) {
    const { data } = await api.get(`/projects/${projectId}/expenses`);
    return data;
  },
  async createProjectExpense(projectId: string, body: any) {
    const { data } = await api.post(`/projects/${projectId}/expenses`, body);
    return data;
  },
  async deleteProjectExpense(projectId: string, expenseId: string) {
    const { data } = await api.delete(`/projects/${projectId}/expenses/${expenseId}`);
    return data;
  },

  // Project Financials
  async getProjectFinancials(projectId: string) {
    const { data } = await api.get(`/projects/${projectId}/financials`);
    return data;
  },

  // Download Project Financial Report
  async downloadProjectReport(projectId: string) {
    const response = await api.get(`/projects/${projectId}/report`, { responseType: 'blob' as any });
    const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `project-${projectId}-report.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Reports
  async getProfitLoss(params?: any) {
    const { data } = await api.get('/reports/profit-loss', { params });
    return data;
  },
  async getRevenueReport(params?: any) {
    const { data } = await api.get('/reports/revenue', { params });
    return data;
  },
  async getExpenseReport(params?: any) {
    const { data } = await api.get('/reports/expenses', { params });
    return data;
  },
  async getCustomerReport() {
    const { data } = await api.get('/reports/customers');
    return data;
  },
  async getLeadReport() {
    const { data } = await api.get('/reports/leads');
    return data;
  },
  async getCustomerActivityReport() {
    const { data } = await api.get('/reports/customer-activity');
    return data;
  },
  async getProjectReport() {
    const { data } = await api.get('/reports/projects');
    return data;
  },
  async getProjectBudgetReport() {
    const { data } = await api.get('/reports/project-budget');
    return data;
  },
  async getResourceAllocationReport() {
    const { data } = await api.get('/reports/resource-allocation');
    return data;
  },
  async getInventoryReport() {
    const { data } = await api.get('/reports/inventory');
    return data;
  },
  async getISPReport() {
    const { data } = await api.get('/reports/isp');
    return data;
  },
  async getTicketReport() {
    const { data } = await api.get('/reports/tickets');
    return data;
  },
  async getEmployeeReport() {
    const { data } = await api.get('/reports/employees');
    return data;
  },

  // Events
  async getEvents(params?: any) {
    const { data } = await api.get('/events', { params });
    return data;
  },
  async getCalendarFeed(params?: any) {
    const { data } = await api.get('/events/feed', { params });
    return data;
  },
  async createEvent(body: any) {
    const { data } = await api.post('/events', body);
    return data;
  },
  async updateEvent(id: string, body: any) {
    const { data } = await api.put(`/events/${id}`, body);
    return data;
  },
  async deleteEvent(id: string) {
    const { data } = await api.delete(`/events/${id}`);
    return data;
  },

  // Documents
  async getDocuments(params?: any) {
    const { data } = await api.get('/documents', { params });
    return data;
  },
  async updateDocument(id: string, body: any) {
    const { data } = await api.put(`/documents/${id}`, body);
    return data;
  },
  async deleteDocument(id: string) {
    const { data } = await api.delete(`/documents/${id}`);
    return data;
  },
  async getFolders() {
    const { data } = await api.get('/documents/folders');
    return data;
  },
  async createFolder(body: any) {
    const { data } = await api.post('/documents/folders', body);
    return data;
  },
  async deleteFolder(id: string) {
    const { data } = await api.delete(`/documents/folders/${id}`);
    return data;
  },
  async getDocument(id: string) {
    const { data } = await api.get(`/documents/${id}`);
    return data;
  },
  uploadDocument(formData: FormData) {
    return api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadVersion(id: string, formData: FormData) {
    return api.post(`/documents/${id}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Attendance
  async getAttendanceByDate(date: string) {
    const { data } = await api.get('/attendance', { params: { date } });
    return data;
  },
  async saveAttendance(body: { user_id: string; date: string; status: string; check_in?: string; check_out?: string; notes?: string }) {
    const { data } = await api.put('/attendance', body);
    return data;
  },

  // Settings
  async getSettings() {
    const { data } = await api.get('/settings');
    return data;
  },
  async updateSettings(settings: CompanySettings) {
    const { data } = await api.put('/settings', { settings });
    return data;
  },

  // Departments
  async getDepartments() {
    const { data } = await api.get('/company/departments');
    return data;
  },
  async createDepartment(body: any) {
    const { data } = await api.post('/company/departments', body);
    return data;
  },
  async updateDepartment(id: string, body: any) {
    const { data } = await api.put(`/company/departments/${id}`, body);
    return data;
  },
  async deleteDepartment(id: string) {
    const { data } = await api.delete(`/company/departments/${id}`);
    return data;
  },

  // Positions
  async getPositions(params?: any) {
    const { data } = await api.get('/company/positions', { params });
    return data;
  },
  async createPosition(body: any) {
    const { data } = await api.post('/company/positions', body);
    return data;
  },
  async updatePosition(id: string, body: any) {
    const { data } = await api.put(`/company/positions/${id}`, body);
    return data;
  },
  async deletePosition(id: string) {
    const { data } = await api.delete(`/company/positions/${id}`);
    return data;
  },
};
