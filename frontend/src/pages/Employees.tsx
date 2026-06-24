import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { formatDate, formatDateTime, formatCurrency, getUserInitials, getStatusLabel } from '../lib/utils';
import {
  UserCircle, Plus, Users, CalendarDays, Award, Search,
  X, RefreshCw, Edit2, Check,
  Briefcase, Clock, CheckCircle2, Send,
} from 'lucide-react';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  ceo: 'CEO',
  managing_director: 'Managing Director',
  accountant: 'Accountant',
  engineer: 'Engineer / Technician',
  marketing_officer: 'Marketing Officer',
  customer: 'Customer',
};

const leaveStatusColors: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  cancelled: 'badge-info',
};

const attendanceStatusColors: Record<string, string> = {
  present: 'badge-success',
  absent: 'badge-danger',
  late: 'badge-warning',
  half_day: 'badge-info',
};

export default function Employees() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'contract' | 'attendance' | 'leave'>('overview');

  const [showAddModal, setShowAddModal] = useState(false);
  const generateEmployeeId = () => `EMP-${Date.now().toString().slice(-6)}`;
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };
  const [addForm, setAddForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: generatePassword(),
    role: 'engineer', department: '', position: '', employee_id: generateEmployeeId(),
  });

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    role: '', department: '', position: '', is_active: true,
  });

  const [attendanceMonth, setAttendanceMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual', start_date: '', end_date: '', reason: '',
  });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[];
  const roles = [...new Set(employees.map(e => e.role).filter(r => r !== 'customer'))] as string[];

  useEffect(() => { fetchAll(); }, [search, departmentFilter, roleFilter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (departmentFilter) params.department = departmentFilter;
      if (roleFilter) params.role = roleFilter;
      const { data } = await dataService.getEmployees(params);
      setEmployees(data);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const fetchLeaves = async () => {
    try {
      const data = await dataService.getLeaveRequests();
      setAllLeaves(Array.isArray(data) ? data : data?.data || []);
    } catch (error) {}
  };

  useEffect(() => { fetchLeaves(); }, []);

  const onLeaveNow = allLeaves.filter((l: any) => {
    if (l.status !== 'approved') return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= l.start_date && today <= l.end_date;
  }).length;

  const attendanceRate = employees.length > 0
    ? Math.round(((employees.length - onLeaveNow) / employees.length) * 100)
    : 0;

  const openEmployeeDetail = async (emp: User) => {
    setSelectedEmployee(emp);
    setDetailTab('overview');
    setEditing(false);
    try {
      const { data } = await dataService.getEmployee(emp.id);
      setEmployeeDetail(data);
      setEditForm({
        first_name: data.first_name || '', last_name: data.last_name || '',
        email: data.email || '', phone: data.phone || '',
        role: data.role || '', department: data.department || '',
        position: data.position || '', is_active: data.is_active ?? true,
      });
    } catch (error) { console.error(error); }
  };

  const closeDetail = () => {
    setSelectedEmployee(null);
    setEmployeeDetail(null);
    setEditing(false);
    setShowLeaveForm(false);
  };

  const saveEdit = async () => {
    if (!selectedEmployee) return;
    try {
      await dataService.updateEmployee(selectedEmployee.id, editForm);
      toast.success('Employee updated');
      setEditing(false);
      openEmployeeDetail(selectedEmployee);
      fetchAll();
    } catch (error) { toast.error('Failed to update'); }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dataService.createEmployee(addForm);
      setShowAddModal(false);
      setAddForm({ first_name: '', last_name: '', email: '', phone: '', password: generatePassword(), role: 'engineer', department: '', position: '', employee_id: generateEmployeeId() });
      toast.success('Employee added successfully');
      fetchAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to add employee');
    }
  };

  const loadAttendance = async (userId: string) => {
    setAttendanceLoading(true);
    try {
      const [y, m] = attendanceMonth.split('-');
      const { data } = await dataService.getAttendance(userId, { month: m, year: y });
      setAttendanceRecords(data || []);
    } catch (error) { setAttendanceRecords([]); }
    setAttendanceLoading(false);
  };

  useEffect(() => {
    if (selectedEmployee && detailTab === 'attendance') {
      loadAttendance(selectedEmployee.id);
    }
  }, [selectedEmployee, detailTab, attendanceMonth]);

  const handleApproveLeave = async (leaveId: string) => {
    try {
      await dataService.approveLeave(leaveId);
      toast.success('Leave approved');
      if (selectedEmployee) openEmployeeDetail(selectedEmployee);
      fetchLeaves();
    } catch (error) { toast.error('Failed to approve'); }
  };

  const handleCreateLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.leave_type) return;
    if (!selectedEmployee) return;
    setSubmitting(true);
    try {
      await dataService.createLeaveRequest({
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason,
        user_id: selectedEmployee.id,
      });
      toast.success('Leave request created');
      setShowLeaveForm(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      openEmployeeDetail(selectedEmployee);
      fetchLeaves();
    } catch (error) { toast.error('Failed to create leave'); }
    setSubmitting(false);
  };

  const ed = employeeDetail;
  const leaves: any[] = ed?.leave_requests || [];
  const contract = ed?.contract;
  const evaluations: any[] = ed?.evaluations || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">Manage staff, contracts, attendance, and leave</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchAll(); fetchLeaves(); }} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={18} className="mr-1" /> Add Employee
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><Users size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{employees.length}</p><p className="stat-label">Total Employees</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-orange-100 text-orange-600"><CalendarDays size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{onLeaveNow}</p><p className="stat-label">On Leave Now</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><Award size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{departments.length}</p><p className="stat-label">Departments</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><CheckCircle2 size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{attendanceRate}%</p><p className="stat-label">Attendance Rate</p></div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto min-w-[140px]" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input w-auto min-w-[140px]" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{roleLabels[r] || r}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></p>
        ) : employees.length === 0 ? (
          <p className="col-span-full text-center py-12 text-surface-400">No employees found</p>
        ) : (
          employees.map((emp) => {
            const c = (emp as any).contract;
            return (
              <div key={emp.id} onClick={() => openEmployeeDetail(emp)}
                className="card flex items-center gap-4 cursor-pointer transition-all hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                  {getUserInitials(emp.first_name, emp.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 dark:text-surface-50 truncate">
                    {emp.first_name} {emp.last_name}
                  </p>
                  <p className="text-xs text-surface-500 truncate">{emp.position || roleLabels[emp.role] || emp.role}</p>
                  <p className="text-xs text-surface-400 truncate">{emp.department || '-'}{c?.salary ? ` · ${formatCurrency(c.salary)}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={emp.is_active ? 'badge-success' : 'badge-danger'}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {c?.is_active && <span className="badge-info text-[10px]">Contracted</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Side Panel */}
      {selectedEmployee && employeeDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                  {getUserInitials(ed.first_name, ed.last_name)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{ed.first_name} {ed.last_name}</h2>
                  <p className="text-xs text-surface-500">{ed.employee_id || ed.email}</p>
                </div>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'contract', 'attendance', 'leave'] as const).map((t) => (
                <button key={t} onClick={() => { setDetailTab(t); setEditing(false); }}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' && <><UserCircle size={14} className="inline mr-1" />Overview</>}
                  {t === 'contract' && <><Briefcase size={14} className="inline mr-1" />Contract</>}
                  {t === 'attendance' && <><Clock size={14} className="inline mr-1" />Attendance</>}
                  {t === 'leave' && <><CalendarDays size={14} className="inline mr-1" />Leave</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* Overview Tab */}
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className={ed.is_active ? 'badge-success' : 'badge-danger'}>
                      {ed.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => setEditing(!editing)} className="btn-secondary text-xs py-1.5 px-3">
                      <Edit2 size={14} className="mr-1" /> {editing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {editing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label">First Name</label><input className="input" value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} /></div>
                        <div><label className="label">Last Name</label><input className="input" value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label">Email</label><input className="input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                        <div><label className="label">Phone</label><input className="input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label">Role</label>
                          <select className="input" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                            {Object.entries(roleLabels).filter(([k]) => k !== 'customer').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div><label className="label">Department</label><input className="input" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} /></div>
                      </div>
                      <div><label className="label">Position</label><input className="input" value={editForm.position} onChange={e => setEditForm({...editForm, position: e.target.value})} /></div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="is_active" checked={editForm.is_active} onChange={e => setEditForm({...editForm, is_active: e.target.checked})} className="rounded border-surface-300" />
                        <label htmlFor="is_active" className="text-sm text-surface-700 dark:text-surface-300">Active</label>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={saveEdit} className="btn-primary"><Check size={14} className="mr-1" />Save Changes</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-xs text-surface-500">Employee ID</p><p className="text-sm font-medium">{ed.employee_id || '-'}</p></div>
                        <div><p className="text-xs text-surface-500">Role</p><p className="text-sm font-medium">{roleLabels[ed.role] || ed.role}</p></div>
                        <div><p className="text-xs text-surface-500">Department</p><p className="text-sm font-medium">{ed.department || '-'}</p></div>
                        <div><p className="text-xs text-surface-500">Position</p><p className="text-sm font-medium">{ed.position || '-'}</p></div>
                        <div><p className="text-xs text-surface-500">Email</p><p className="text-sm font-medium">{ed.email}</p></div>
                        <div><p className="text-xs text-surface-500">Phone</p><p className="text-sm font-medium">{ed.phone || '-'}</p></div>
                        <div><p className="text-xs text-surface-500">Language</p><p className="text-sm font-medium capitalize">{ed.language || 'en'}</p></div>
                        <div><p className="text-xs text-surface-500">Joined</p><p className="text-sm font-medium">{ed.created_at ? formatDate(ed.created_at) : '-'}</p></div>
                      </div>
                    </div>
                  )}

                  {evaluations.length > 0 && !editing && (
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Performance Evaluations</p>
                      <div className="space-y-2">
                        {evaluations.map((ev: any) => (
                          <div key={ev.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{ev.review_period || 'Review'}</span>
                              <span className="text-sm font-bold text-primary-600">{ev.rating}/5</span>
                            </div>
                            {ev.comments && <p className="text-xs text-surface-500 mt-1">{ev.comments}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contract Tab */}
              {detailTab === 'contract' && (
                <div className="space-y-5">
                  {contract ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-surface-500">Contract Type</p><p className="text-sm font-medium capitalize">{contract.contract_type}</p></div>
                      <div><p className="text-xs text-surface-500">Status</p><span className={contract.is_active ? 'badge-success' : 'badge-danger'}>{contract.is_active ? 'Active' : 'Inactive'}</span></div>
                      <div><p className="text-xs text-surface-500">Salary</p><p className="text-sm font-bold text-accent-600">{contract.salary ? formatCurrency(contract.salary) : '-'}</p></div>
                      <div><p className="text-xs text-surface-500">Employment Type</p><p className="text-sm font-medium capitalize">{contract.employment_type?.replace('_', ' ') || '-'}</p></div>
                      <div><p className="text-xs text-surface-500">Start Date</p><p className="text-sm font-medium">{contract.start_date ? formatDate(contract.start_date) : '-'}</p></div>
                      <div><p className="text-xs text-surface-500">End Date</p><p className="text-sm font-medium">{contract.end_date ? formatDate(contract.end_date) : 'Indefinite'}</p></div>
                      {contract.created_at && <div><p className="text-xs text-surface-500">Created</p><p className="text-sm font-medium">{formatDate(contract.created_at)}</p></div>}
                    </div>
                  ) : (
                    <p className="text-center text-surface-400 py-8">No contract information available</p>
                  )}
                </div>
              )}

              {/* Attendance Tab */}
              {detailTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input type="month" className="input w-auto" value={attendanceMonth} onChange={e => setAttendanceMonth(e.target.value)} />
                    <span className="text-xs text-surface-500">{attendanceRecords.length} records</span>
                  </div>
                  {attendanceLoading ? (
                    <p className="text-center py-8 text-surface-400"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading...</p>
                  ) : attendanceRecords.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No attendance records for this month</p>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Status</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRecords.map((a: any) => (
                            <tr key={a.id}>
                              <td className="text-xs font-medium">{formatDate(a.date)}</td>
                              <td className="text-xs">{a.check_in ? formatDateTime(a.check_in) : '-'}</td>
                              <td className="text-xs">{a.check_out ? formatDateTime(a.check_out) : '-'}</td>
                              <td><span className={attendanceStatusColors[a.status]}>{getStatusLabel(a.status)}</span></td>
                              <td className="text-xs text-surface-400">{a.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Leave Tab */}
              {detailTab === 'leave' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Leave Requests</p>
                    <button onClick={() => setShowLeaveForm(!showLeaveForm)} className="btn-primary text-xs py-1.5 px-3">
                      <Plus size={14} className="mr-1" /> {showLeaveForm ? 'Cancel' : 'New Leave'}
                    </button>
                  </div>

                  {showLeaveForm && (
                    <div className="rounded-lg border border-surface-200 p-4 space-y-3 dark:border-surface-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Leave Type</label>
                          <select className="input" value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value})}>
                            <option value="annual">Annual</option>
                            <option value="sick">Sick</option>
                            <option value="personal">Personal</option>
                            <option value="maternity">Maternity</option>
                            <option value="paternity">Paternity</option>
                            <option value="unpaid">Unpaid</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Start Date</label>
                          <input type="date" className="input" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} />
                        </div>
                        <div>
                          <label className="label">End Date</label>
                          <input type="date" className="input" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Reason</label>
                        <textarea className="input" rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
                      </div>
                      <div className="flex justify-end">
                        <button onClick={handleCreateLeave} disabled={submitting || !leaveForm.start_date || !leaveForm.end_date} className="btn-primary">
                          <Send size={14} className="mr-1" /> {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                    </div>
                  )}

                  {leaves.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No leave requests</p>
                  ) : (
                    <div className="space-y-2">
                      {leaves.map((l: any) => (
                        <div key={l.id} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium capitalize">{l.leave_type} Leave</span>
                                <span className={leaveStatusColors[l.status]}>{getStatusLabel(l.status)}</span>
                              </div>
                              <p className="text-xs text-surface-500 mt-0.5">
                                {formatDate(l.start_date)} → {formatDate(l.end_date)}
                              </p>
                              {l.reason && <p className="text-xs text-surface-500 mt-1">{l.reason}</p>}
                              {l.approver && <p className="text-xs text-surface-400 mt-1">Approved by: {l.approver.first_name} {l.approver.last_name}</p>}
                            </div>
                            {l.status === 'pending' && (
                              <button onClick={() => handleApproveLeave(l.id)} className="btn-primary text-xs py-1 px-2">
                                <Check size={12} className="mr-1" />Approve
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">Add Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={addForm.first_name} onChange={e => setAddForm({...addForm, first_name: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={addForm.last_name} onChange={e => setAddForm({...addForm, last_name: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee ID</label>
                  <input className="input" value={addForm.employee_id} onChange={e => setAddForm({...addForm, employee_id: e.target.value})} />
                </div>
                <div>
                  <label className="label">Password *</label>
                  <div className="flex gap-2">
                    <input type="text" className="input flex-1 font-mono text-xs" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} required />
                    <button type="button" onClick={() => setAddForm({...addForm, password: generatePassword()})} className="btn-secondary text-xs shrink-0 px-2" title="Generate new password">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                    {Object.entries(roleLabels).filter(([k]) => k !== 'customer').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Department</label>
                  <input className="input" value={addForm.department} onChange={e => setAddForm({...addForm, department: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Position</label>
                <input className="input" value={addForm.position} onChange={e => setAddForm({...addForm, position: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
