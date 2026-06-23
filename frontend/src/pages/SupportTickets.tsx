import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { SupportTicket, TicketResponse } from '../types';
import { formatDate, formatDateTime, getStatusLabel, cn } from '../lib/utils';
import {
  Plus, Headphones, MessageSquare, Clock, CheckCircle2,
  X, User, Building2, Tag, ArrowUpRight, Send,
  RefreshCw, ChevronDown,
} from 'lucide-react';

const priorityColors: Record<string, string> = {
  low: 'badge-info',
  medium: 'badge-warning',
  high: 'badge-danger',
  urgent: 'badge-danger',
};

const statusColors: Record<string, string> = {
  open: 'badge-info',
  in_progress: 'badge-warning',
  resolved: 'badge-success',
  closed: 'badge-info',
  on_hold: 'badge-warning',
};

const statusList: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const categories = [
  'Technical Support', 'Billing', 'Account', 'Sales', 'General Inquiry', 'Complaint',
];

export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketDetail, setTicketDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'responses'>('overview');

  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    subject: '', description: '', category: '', priority: 'medium', customer_id: '',
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [responseText, setResponseText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    try {
      const { data } = await dataService.getTickets({ limit: 100 });
      setTickets(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openTicketDetail = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDetailTab('overview');
    try {
      const { data } = await dataService.getTicket(ticket.id);
      setTicketDetail(data);
    } catch (error) {
      console.error(error);
    }
  };

  const closeDetail = () => {
    setSelectedTicket(null);
    setTicketDetail(null);
  };

  const openNewTicketModal = async () => {
    try {
      const { data } = await dataService.getCustomers({ limit: 500 });
      setCustomers(data);
    } catch (error) {}
    setTicketForm({ subject: '', description: '', category: '', priority: 'medium', customer_id: '' });
    setShowNewTicketModal(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject) return;
    try {
      await dataService.createTicket(ticketForm);
      setShowNewTicketModal(false);
      toast.success('Ticket created successfully');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to create ticket');
    }
  };

  const updateTicketStatus = async (id: string, status: string) => {
    try {
      await dataService.updateTicket(id, { status });
      const { data } = await dataService.getTicket(id);
      setTicketDetail(data);
      fetchTickets();
      toast.success(`Status changed to ${getStatusLabel(status)}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const updateTicketAssignment = async (id: string, assigned_to: string) => {
    try {
      await dataService.updateTicket(id, { assigned_to: assigned_to || null });
      const { data } = await dataService.getTicket(id);
      setTicketDetail(data);
      fetchTickets();
      toast.success(assigned_to ? 'Ticket assigned' : 'Ticket unassigned');
    } catch (error) {
      toast.error('Failed to assign ticket');
    }
  };

  const addResponse = async () => {
    if (!responseText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await dataService.addTicketResponse(selectedTicket.id, { message: responseText });
      setResponseText('');
      const { data } = await dataService.getTicket(selectedTicket.id);
      setTicketDetail(data);
      fetchTickets();
      toast.success('Response added');
    } catch (error) {
      toast.error('Failed to add response');
    } finally {
      setSending(false);
    }
  };

  const td = ticketDetail;
  const responses: TicketResponse[] = td?.responses || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">Manage help desk and support requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTickets} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          <button onClick={openNewTicketModal} className="btn-primary">
            <Plus size={18} className="mr-1" /> New Ticket
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><Headphones size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{tickets.length}</p><p className="stat-label">Total</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Clock size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{tickets.filter(t => t.status === 'open').length}</p><p className="stat-label">Open</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><CheckCircle2 size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{tickets.filter(t => t.status === 'resolved').length}</p><p className="stat-label">Resolved</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><MessageSquare size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{tickets.filter(t => t.status === 'in_progress').length}</p><p className="stat-label">In Progress</p></div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Subject</th>
              <th>Customer</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-surface-400">No tickets found</td></tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                  <td className="font-mono text-xs">{ticket.ticket_code}</td>
                  <td className="font-medium">{ticket.subject}</td>
                  <td>{ticket.customer?.company_name || ticket.customer?.contact_person || '-'}</td>
                  <td>{ticket.category || '-'}</td>
                  <td><span className={priorityColors[ticket.priority]}>{getStatusLabel(ticket.priority)}</span></td>
                  <td><span className={statusColors[ticket.status]}>{getStatusLabel(ticket.status)}</span></td>
                  <td>{ticket.assigned ? `${ticket.assigned.first_name} ${ticket.assigned.last_name}` : 'Unassigned'}</td>
                  <td className="text-surface-400">{formatDate(ticket.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Detail Side Panel */}
      {selectedTicket && ticketDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{td.subject}</h2>
                <p className="text-xs text-surface-500">{td.ticket_code}</p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'responses'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' ? <><Tag size={14} className="inline mr-1" />Overview</> : <><MessageSquare size={14} className="inline mr-1" />Responses ({responses.length})</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <select
                      value={td.status}
                      onChange={(e) => updateTicketStatus(td.id, e.target.value)}
                      className={`rounded border-0 px-2 py-0.5 text-xs font-medium cursor-pointer ${statusColors[td.status]}`}>
                      {statusList.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <span className={priorityColors[td.priority]}>{getStatusLabel(td.priority)}</span>
                  </div>

                  {td.description && (
                    <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{td.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-surface-500">Customer</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                        {td.customer?.company_name || td.customer?.contact_person || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500">Category</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{td.category || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500">Assigned To</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                        {td.assigned ? `${td.assigned.first_name} ${td.assigned.last_name}` : 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500">Created</p>
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{formatDateTime(td.created_at)}</p>
                    </div>
                    {td.due_date && (
                      <div>
                        <p className="text-xs text-surface-500">Due Date</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{formatDate(td.due_date)}</p>
                      </div>
                    )}
                    {td.resolved_at && (
                      <div>
                        <p className="text-xs text-surface-500">Resolved At</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{formatDateTime(td.resolved_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'responses' && (
                <div className="space-y-4">
                  {responses.length === 0 ? (
                    <p className="text-center text-surface-400 py-8">No responses yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {responses.map((r) => (
                        <div key={r.id} className={`rounded-lg border p-3 ${r.is_internal ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20' : 'border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold dark:bg-primary-900/30 dark:text-primary-400">
                                {r.user ? (r.user.first_name?.[0] || '?') : '?'}
                              </div>
                              <span className="text-sm font-medium text-surface-900 dark:text-surface-50">
                                {r.user ? `${r.user.first_name} ${r.user.last_name}` : 'Unknown'}
                              </span>
                              {r.is_internal && (
                                <span className="badge-warning text-[10px] py-0">Internal</span>
                              )}
                            </div>
                            <span className="text-xs text-surface-400">{formatDateTime(r.created_at)}</span>
                          </div>
                          <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-surface-200 pt-4 dark:border-surface-700">
                    <p className="text-xs font-medium text-surface-500 mb-2">Add Response</p>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Type your response..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={addResponse}
                        disabled={!responseText.trim() || sending}
                        className="btn-primary"
                      >
                        <Send size={14} className="mr-1" />
                        {sending ? 'Sending...' : 'Send Response'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">New Support Ticket</h2>
              <button onClick={() => setShowNewTicketModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="label">Subject *</label>
                <input className="input" placeholder="Brief summary of the issue" value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} placeholder="Detailed description of the issue" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Customer</label>
                <select className="input" value={ticketForm.customer_id} onChange={(e) => setTicketForm({ ...ticketForm, customer_id: e.target.value })}>
                  <option value="">Select customer</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person || c.email}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewTicketModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
