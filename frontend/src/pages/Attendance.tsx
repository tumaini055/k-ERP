import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import {
  CalendarDays, RefreshCw, Check, X, Clock, AlertTriangle,
  Save, Sun, Moon, Sunrise,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  present: 'bg-accent-100 text-accent-700 border-accent-300 dark:bg-accent-900/30 dark:text-accent-400 dark:border-accent-700',
  absent: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  late: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  half_day: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
};

const statusIcons: Record<string, any> = {
  present: Check,
  absent: X,
  late: AlertTriangle,
  half_day: Sunrise,
};

const statusOptions = [
  { value: 'present', label: 'Present', icon: Check },
  { value: 'absent', label: 'Absent', icon: X },
  { value: 'late', label: 'Late', icon: AlertTriangle },
  { value: 'half_day', label: 'Half Day', icon: Sunrise },
];

export default function Attendance() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, half_day: 0, unmarked: 0 });
  const [editing, setEditing] = useState<Record<string, { status: string; check_in: string; check_out: string; notes: string }>>({});

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await dataService.getAttendanceByDate(date);
      const data = res?.data || [];
      setEmployees(data);

      const edits: Record<string, any> = {};
      const counts = { present: 0, absent: 0, late: 0, half_day: 0, unmarked: 0 };

      data.forEach((emp: any) => {
        const att = emp.attendance;
        const stat = att?.status || '';
        edits[emp.id] = {
          status: stat,
          check_in: att?.check_in ? att.check_in.slice(11, 16) : '',
          check_out: att?.check_out ? att.check_out.slice(11, 16) : '',
          notes: att?.notes || '',
        };
        if (stat) counts[stat as keyof typeof counts]++;
        else counts.unmarked++;
      });

      setEditing(edits);
      setSummary(counts);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (userId: string, status: string) => {
    setEditing((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], status },
    }));
  };

  const updateField = (userId: string, field: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const recordAll = async () => {
    setSaving(true);
    try {
      const promises = employees
        .filter((emp) => editing[emp.id]?.status)
        .map((emp) => {
          const e = editing[emp.id];
          const checkIn = e.check_in ? `${date}T${e.check_in}:00` : undefined;
          const checkOut = e.check_out ? `${date}T${e.check_out}:00` : undefined;
          return dataService.saveAttendance({
            user_id: emp.id,
            date,
            status: e.status,
            check_in: checkIn,
            check_out: checkOut,
            notes: e.notes || undefined,
          });
        });

      await Promise.all(promises);
      toast.success('Attendance recorded successfully');
      fetchAttendance();
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const quickMark = (status: string) => {
    const updates: Record<string, any> = {};
    employees.forEach((emp) => {
      updates[emp.id] = { ...editing[emp.id], status };
    });
    setEditing(updates);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Register</h1>
          <p className="page-subtitle">Record and manage daily employee attendance</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAttendance} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          <div className="relative">
            <CalendarDays size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input pl-10 w-auto"
            />
          </div>
        </div>
      </div>

      {!loading && (
        <div className="mb-6 grid grid-cols-5 gap-3">
          {statusOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => quickMark(opt.value)}
                className="flex items-center gap-2 rounded-lg border border-surface-200 p-3 text-sm font-medium transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-700/50"
              >
                <Icon size={16} />
                <span>{opt.label}: <strong>{summary[opt.value as keyof typeof summary]}</strong></span>
              </button>
            );
          })}
          <div className="flex items-center gap-2 rounded-lg border border-surface-200 p-3 text-sm dark:border-surface-700">
            <span className="text-surface-500">Unmarked: <strong>{summary.unmarked}</strong></span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-surface-400" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Status</th>
                <th className="w-28">Check In</th>
                <th className="w-28">Check Out</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-surface-400">
                    No active employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp, idx) => {
                  const edit = editing[emp.id] || { status: '', check_in: '', check_out: '', notes: '' };
                  const StatIcon = edit.status ? (statusIcons[edit.status] || null) : null;
                  return (
                    <tr key={emp.id}>
                      <td className="text-xs text-surface-400">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30">
                            {emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                              {emp.first_name} {emp.last_name}
                            </p>
                            {emp.employee_id && (
                              <p className="text-xs text-surface-400">{emp.employee_id}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-surface-500">{emp.department || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          {statusOptions.map((opt) => {
                            const Icon = opt.icon;
                            const isActive = edit.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setStatus(emp.id, isActive ? '' : opt.value)}
                                className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                                  isActive
                                    ? statusColors[opt.value]
                                    : 'border-surface-200 text-surface-400 hover:border-surface-300 dark:border-surface-700 dark:hover:border-surface-600'
                                }`}
                                title={opt.label}
                              >
                                <Icon size={14} />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <input
                          type="time"
                          value={edit.check_in}
                          onChange={(e) => updateField(emp.id, 'check_in', e.target.value)}
                          className="input text-xs py-1.5 px-2"
                          disabled={!edit.status || edit.status === 'absent'}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={edit.check_out}
                          onChange={(e) => updateField(emp.id, 'check_out', e.target.value)}
                          className="input text-xs py-1.5 px-2"
                          disabled={!edit.status || edit.status === 'absent'}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={edit.notes}
                          onChange={(e) => updateField(emp.id, 'notes', e.target.value)}
                          className="input text-xs py-1.5 px-2"
                          placeholder="Optional"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && employees.length > 0 && (
        <div className="sticky bottom-0 mt-6 flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-4 shadow-lg dark:border-surface-700 dark:bg-surface-800">
          <p className="text-sm text-surface-500">
            {summary.unmarked > 0
              ? `${summary.unmarked} employee(s) still need status set`
              : 'All employees have been marked'}
          </p>
          <button onClick={recordAll} disabled={saving} className="btn-primary">
            <Save size={18} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      )}
    </div>
  );
}
