import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { getUserInitials } from '../lib/utils';
import { Building2, Users, UserCircle, ChevronDown, ChevronRight, Mail, Phone } from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  avatar_url?: string;
}

interface Position {
  name: string;
  employees: Employee[];
}

interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  manager: Employee | null;
  positions: Position[];
  employee_count: number;
}

export default function Organization() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOrgChart();
  }, []);

  const fetchOrgChart = async () => {
    setLoading(true);
    try {
      const res = await dataService.getOrganizationChart();
      setDepartments(res.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalEmployees = departments.reduce((s: number, d: Department) => s + d.employee_count, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Structure</h1>
          <p className="page-subtitle">Company departments, positions, and team members</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <Building2 size={22} className="stat-icon shrink-0 text-blue-600 bg-blue-100" />
          <div className="min-w-0 overflow-hidden">
            <p className="stat-value">{departments.length}</p>
            <p className="stat-label">Departments</p>
          </div>
        </div>
        <div className="stat-card">
          <Users size={22} className="stat-icon shrink-0 text-accent-600 bg-accent-100" />
          <div className="min-w-0 overflow-hidden">
            <p className="stat-value">{totalEmployees}</p>
            <p className="stat-label">Total Staff</p>
          </div>
        </div>
        <div className="stat-card">
          <UserCircle size={22} className="stat-icon shrink-0 text-purple-600 bg-purple-100" />
          <div className="min-w-0 overflow-hidden">
            <p className="stat-value">
              {departments.reduce((s: number, d: Department) => s + d.positions.length, 0)}
            </p>
            <p className="stat-label">Positions</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-surface-400">
          <Building2 size={48} className="mb-3 opacity-40" />
          <p>No departments configured yet</p>
          <p className="text-sm mt-1">Go to Settings → Departments to add them</p>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => (
            <div key={dept.id} className="card overflow-hidden">
              <button
                onClick={() => toggleDept(dept.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
              >
                {expandedDepts.has(dept.id) ? <ChevronDown size={20} className="text-surface-400 shrink-0" /> : <ChevronRight size={20} className="text-surface-400 shrink-0" />}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700 font-bold text-sm dark:bg-primary-900/30 dark:text-primary-400">
                  {dept.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-surface-50">{dept.name}</p>
                  <p className="text-xs text-surface-500">
                    {dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}
                    {dept.code ? ` · ${dept.code}` : ''}
                  </p>
                </div>
                {dept.manager && (
                  <div className="hidden sm:flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-1.5 dark:bg-surface-700">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
                      {getUserInitials(dept.manager.first_name, dept.manager.last_name)}
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-surface-700 dark:text-surface-300">{dept.manager.first_name} {dept.manager.last_name}</p>
                      <p className="text-surface-400">Manager</p>
                    </div>
                  </div>
                )}
              </button>

              {expandedDepts.has(dept.id) && (
                <div className="border-t border-surface-200 p-4 dark:border-surface-700">
                  {dept.employee_count === 0 ? (
                    <p className="text-sm text-surface-400 text-center py-4">No staff assigned to this department</p>
                  ) : dept.positions.length === 0 ? (
                    <div className="space-y-2">
                      {dept.manager && (
                        <div className="flex items-center gap-3 rounded-lg border border-accent-200 bg-accent-50 p-3 dark:border-accent-800 dark:bg-accent-900/20">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-200 text-xs font-bold text-accent-800 dark:bg-accent-800 dark:text-accent-200">
                            {getUserInitials(dept.manager.first_name, dept.manager.last_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{dept.manager.first_name} {dept.manager.last_name}</p>
                            <p className="text-xs text-surface-500">Department Manager</p>
                          </div>
                          <div className="flex items-center gap-2 text-surface-400">
                            {dept.manager.email && <Mail size={14} className="hidden sm:block" title={dept.manager.email} />}
                            {dept.manager.phone && <Phone size={14} className="hidden sm:block" title={dept.manager.phone} />}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-surface-400 text-center pt-2">Positions not yet defined — staff assigned directly to department</p>
                      {dept.manager && (
                        <p className="text-xs text-surface-500 text-center">No other staff assigned</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {dept.positions.map((pos) => (
                        <div key={pos.name} className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                          <p className="text-sm font-semibold text-surface-900 dark:text-surface-50 mb-2">{pos.name}</p>
                          {pos.employees.length === 0 ? (
                            <p className="text-xs text-surface-400">Vacant</p>
                          ) : (
                            <div className="space-y-2">
                              {pos.employees.map((emp) => (
                                <div key={emp.id} className="flex items-center gap-2.5 rounded-md bg-surface-50 p-2 dark:bg-surface-700/50">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                    {getUserInitials(emp.first_name, emp.last_name)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">
                                      {emp.first_name} {emp.last_name}
                                    </p>
                                    <p className="text-xs text-surface-400 truncate">{emp.email}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
