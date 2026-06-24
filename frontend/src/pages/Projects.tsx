import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { Project, ProjectTask, ProjectMilestone } from '../types';
import { formatDate, formatCurrency, getStatusLabel, cn } from '../lib/utils';
import {
  Plus, Search, FolderKanban, CheckCircle, Clock, AlertCircle,
  X, Edit2, Trash2, ChevronRight, RefreshCw, List, Columns,
  Calendar, User, Target, DollarSign, FileText, BarChart3,
  Circle, CheckCircle2, Timer, PlusCircle, Users,
} from 'lucide-react';

const statusStyles: Record<string, string> = {
  planning: 'badge-info',
  in_progress: 'badge-warning',
  completed: 'badge-success',
  on_hold: 'badge-warning',
  cancelled: 'badge-danger',
};

const priorityColors: Record<string, string> = {
  low: 'text-surface-400',
  medium: 'text-yellow-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export default function Projects() {
  const [view, setView] = useState<'list' | 'board'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectDetail, setProjectDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'tasks' | 'milestones' | 'time' | 'expenses'>('overview');

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '', description: '', category: '', status: 'planning' as Project['status'],
    priority: 'medium', start_date: '', end_date: '', budget: 0, customer_id: '', manager_id: '',
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', due_date: '' });
  const [timeForm, setTimeForm] = useState({ task_id: '', hours: 0, description: '', date: new Date().toISOString().split('T')[0] });
  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: 0, expense_date: new Date().toISOString().split('T')[0] });
  const [projectFinancials, setProjectFinancials] = useState<any>(null);

  useEffect(() => { fetchAll(); }, [search, statusFilter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [{ data: pData }, sData] = await Promise.all([
        dataService.getProjects(params),
        dataService.getProjectStats(),
      ]);
      setProjects(pData);
      setStats(sData);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const openProjectDetail = async (project: Project) => {
    setSelectedProject(project);
    try {
      const [{ data: detail }, { data: tasks }, { data: milestones }, { data: timeEntries }, { data: expenses }, financials] = await Promise.all([
        dataService.getProject(project.id),
        dataService.getProjectTasks(project.id),
        dataService.getMilestones(project.id),
        dataService.getTimeEntries(project.id),
        dataService.getProjectExpenses(project.id),
        dataService.getProjectFinancials(project.id),
      ]);
      setProjectDetail({ ...detail, tasks: tasks || [], milestones: milestones || [], time_entries: timeEntries || [], expenses: expenses || [] });
      setProjectFinancials(financials);
    } catch (error) { console.error(error); }
  };

  const closeDetail = () => { setSelectedProject(null); setProjectDetail(null); setDetailTab('overview'); };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Delete this project permanently?')) return;
    try {
      await dataService.deleteProject(id);
      toast.success('Project deleted');
      closeDetail();
      fetchProjects();
    } catch (error: any) { toast.error(error?.response?.data?.error || 'Failed to delete'); }
  };

  const openCreateModal = async () => {
    try {
      const [{ data: cData }, { data: eData }] = await Promise.all([
        dataService.getCustomers({ limit: 200 }),
        dataService.getEmployees({ limit: 200 }),
      ]);
      setCustomers(cData);
      setEmployees(eData);
    } catch (error) {}
    setEditingProject(null);
    setProjectForm({ name: '', description: '', category: '', status: 'planning', priority: 'medium', start_date: '', end_date: '', budget: 0, customer_id: '', manager_id: '' });
    setShowProjectModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await dataService.updateProject(editingProject.id, projectForm);
      } else {
        await dataService.createProject(projectForm);
      }
      setShowProjectModal(false);
      fetchAll();
    } catch (error) { console.error(error); }
  };

  const createTask = async () => {
    if (!selectedProject || !taskForm.title) return;
    try {
      await dataService.createTask(selectedProject.id, taskForm);
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const updateTaskStatus = async (task: ProjectTask, status: string) => {
    try {
      await dataService.updateTask(task.id, { status });
      if (selectedProject) openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const createMilestone = async () => {
    if (!selectedProject || !milestoneForm.name) return;
    try {
      await dataService.createMilestone(selectedProject.id, milestoneForm);
      setMilestoneForm({ name: '', description: '', due_date: '' });
      openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const toggleMilestone = async (m: ProjectMilestone) => {
    try {
      await dataService.updateMilestone(m.id, { is_completed: !m.is_completed });
      if (selectedProject) openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const addExpense = async () => {
    if (!selectedProject || !expenseForm.amount || !expenseForm.category) return;
    try {
      await dataService.createProjectExpense(selectedProject.id, expenseForm);
      setExpenseForm({ category: '', description: '', amount: 0, expense_date: new Date().toISOString().split('T')[0] });
      openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!selectedProject) return;
    try {
      await dataService.deleteProjectExpense(selectedProject.id, expenseId);
      openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const logTime = async () => {
    if (!selectedProject || !timeForm.hours) return;
    try {
      await dataService.createTimeEntry({ ...timeForm, project_id: selectedProject.id });
      setTimeForm({ task_id: '', hours: 0, description: '', date: new Date().toISOString().split('T')[0] });
      openProjectDetail(selectedProject);
    } catch (error) { console.error(error); }
  };

  const progressPercent = (project: Project) => {
    if (!projectDetail) return 0;
    const tasks = projectDetail.tasks || [];
    if (tasks.length === 0) return project.status === 'completed' ? 100 : 0;
    return Math.round((tasks.filter((t: any) => t.status === 'completed').length / tasks.length) * 100);
  };

  const renderStats = () => (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
      <div className="card"><div className="flex items-center gap-3"><div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><FolderKanban size={22} /></div><div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{stats?.total || 0}</p><p className="stat-label">Total</p></div></div></div>
      <div className="card"><div className="flex items-center gap-3"><div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Clock size={22} /></div><div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{stats?.in_progress || 0}</p><p className="stat-label">In Progress</p></div></div></div>
      <div className="card"><div className="flex items-center gap-3"><div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><CheckCircle size={22} /></div><div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{stats?.completed || 0}</p><p className="stat-label">Completed</p></div></div></div>
      <div className="card"><div className="flex items-center gap-3"><div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><DollarSign size={22} /></div><div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{formatCurrency(stats?.total_budget || 0)}</p><p className="stat-label">Expected Profit</p></div></div></div>
      <div className="card"><div className="flex items-center gap-3"><div className="stat-icon shrink-0 bg-orange-100 text-orange-600"><BarChart3 size={22} /></div><div className="min-w-0 overflow-hidden"><p className="stat-value truncate">{formatCurrency(stats?.total_recorded_revenue || 0)}</p><p className="stat-label">Recorded Revenue</p></div></div></div>
    </div>
  );

  const renderList = () => (
    <div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Project Name</th>
              <th>Category</th>
              <th>Customer</th>
              <th>Manager</th>
              <th>Budget</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Dates</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-surface-400">No projects found</td></tr>
            ) : (
              projects.map((project) => {
                const tasks = projectDetail?.id === project.id ? projectDetail.tasks : [];
                const done = tasks?.filter((t: any) => t.status === 'completed').length || 0;
                const total = tasks?.length || 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : project.status === 'completed' ? 100 : 0;
                return (
                  <tr key={project.id} className="cursor-pointer" onClick={() => openProjectDetail(project)}>
                    <td className="font-mono text-xs">{project.project_code}</td>
                    <td><div className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-full ${project.status === 'completed' ? 'bg-accent-500' : project.status === 'in_progress' ? 'bg-yellow-500' : 'bg-surface-300'}`} /><span className="font-medium">{project.name}</span></div></td>
                    <td>{project.category || '-'}</td>
                    <td>{project.customer?.company_name || '-'}</td>
                    <td>{project.manager ? `${project.manager.first_name} ${project.manager.last_name}` : '-'}</td>
                    <td className="font-medium">{project.budget ? formatCurrency(project.budget) : '-'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-surface-200 dark:bg-surface-700">
                          <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-surface-500">{pct}%</span>
                      </div>
                    </td>
                    <td><span className={statusStyles[project.status]}>{getStatusLabel(project.status)}</span></td>
                    <td className="text-xs text-surface-400">{project.start_date ? formatDate(project.start_date) : '-'} {project.end_date ? `→ ${formatDate(project.end_date)}` : ''}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBoard = () => {
    const columns = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {columns.map((col) => {
          const colProjects = projects.filter(p => p.status === col);
          return (
            <div key={col} className="rounded-xl border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/50">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize text-surface-900 dark:text-surface-50">{col.replace('_', ' ')}</h3>
                <span className="badge bg-surface-200 text-surface-600 dark:bg-surface-700">{colProjects.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {colProjects.map((project) => (
                  <div key={project.id} onClick={() => openProjectDetail(project)} className="cursor-pointer rounded-lg border border-surface-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-surface-700 dark:bg-surface-800">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{project.name}</p>
                      <span className={cn('text-xs font-medium', priorityColors[project.priority])}>{project.priority}</span>
                    </div>
                    <p className="text-xs text-surface-500 mb-2">{project.customer?.company_name || 'No customer'}</p>
                    {project.budget && <p className="text-xs font-medium text-accent-600">{formatCurrency(project.budget)}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const updateProjectStatus = async (id: string, status: string) => {
    try {
      await dataService.updateProject(id, { status });
      openProjectDetail(selectedProject!);
    } catch (error) { console.error(error); }
  };

  const renderDetailOverview = () => {
    if (!projectDetail) return null;
    const p = projectDetail;
    const pct = progressPercent(p);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <select
                value={p.status}
                onChange={(e) => updateProjectStatus(p.id, e.target.value)}
                className={`rounded border-0 px-2 py-0.5 text-xs font-medium cursor-pointer ${statusStyles[p.status]}`}>
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <span className={cn('text-xs font-medium', priorityColors[p.priority || 'medium'])}>{p.priority}</span>
              {p.status === 'completed' && <span className="badge-success">Completed</span>}
              {p.recorded_revenue > 0 && <span className="badge-success">Revenue: {formatCurrency(p.recorded_revenue)}</span>}
            </div>
            <p className="mt-2 text-sm text-surface-600 dark:text-surface-400">{p.description || 'No description provided'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-surface-500">Customer</p>
            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.customer?.company_name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Project Manager</p>
            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.manager ? `${p.manager.first_name} ${p.manager.last_name}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Start Date</p>
            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.start_date ? formatDate(p.start_date) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">End Date</p>
            <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{p.end_date ? formatDate(p.end_date) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Expected Profit</p>
            <p className="truncate text-sm font-bold text-accent-600">{p.budget ? formatCurrency(p.budget) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Recorded Revenue</p>
            <p className="truncate text-sm font-bold text-blue-600">{p.recorded_revenue ? formatCurrency(p.recorded_revenue) : '-'}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-surface-500 mb-1">Progress ({pct}%)</p>
          <div className="h-3 rounded-full bg-surface-200 dark:bg-surface-700">
            <div className="h-3 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {projectFinancials && (
          <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
            <p className="text-xs font-medium text-surface-500 mb-3">Profit &amp; Revenue</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-surface-400">Expected Profit</p>
                <p className="truncate text-sm font-semibold text-surface-900 dark:text-surface-50">{formatCurrency(projectFinancials.budget)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Total Expenses</p>
                <p className="truncate text-sm font-semibold text-red-600">{formatCurrency(projectFinancials.total_expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-surface-400">Net Profit</p>
                <p className={`truncate text-sm font-bold ${projectFinancials.net_profit >= 0 ? 'text-accent-600' : 'text-red-600'}`}>
                  {formatCurrency(projectFinancials.net_profit)}
                </p>
              </div>
              {projectFinancials.is_completed ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-surface-400">Recorded Revenue</p>
                    <p className="truncate text-sm font-bold text-blue-600">{formatCurrency(projectFinancials.recorded_revenue)}</p>
                  </div>
                  <button
                    onClick={() => dataService.downloadProjectReport(p.id)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <FileText size={14} className="mr-1" /> Download PDF Report
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-surface-400">Completion Action</p>
                  <button
                    onClick={() => updateProjectStatus(p.id, 'completed')}
                    className="mt-1 btn-primary text-xs px-3 py-1.5"
                  >
                    Complete & Track Revenue
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDetailTasks = () => {
    if (!projectDetail) return null;
    const tasks = projectDetail.tasks || [];
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Task title..." value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
          <select className="input w-32" value={taskForm.assigned_to} onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
            <option value="">Assign</option>
            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
          <button onClick={createTask} className="btn-primary"><Plus size={16} /></button>
        </div>
        <div className="space-y-1">
          {tasks.length === 0 && <p className="text-sm text-surface-400 text-center py-4">No tasks yet</p>}
          {tasks.map((task: any) => (
            <div key={task.id} className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
              <button onClick={() => updateTaskStatus(task, task.status === 'completed' ? 'pending' : 'completed')}>
                {task.status === 'completed' ? <CheckCircle2 size={18} className="text-accent-500" /> : <Circle size={18} className="text-surface-300" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', task.status === 'completed' && 'line-through text-surface-400')}>{task.title}</p>
                <div className="flex gap-3 text-xs text-surface-400 mt-0.5">
                  {task.assignee && <span className="flex items-center gap-1"><Users size={12} />{task.assignee.first_name}</span>}
                  {task.due_date && <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(task.due_date)}</span>}
                  <span className={cn('font-medium', priorityColors[task.priority])}>{task.priority}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {task.status !== 'in_progress' && task.status !== 'completed' && <button onClick={() => updateTaskStatus(task, 'in_progress')} className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Start</button>}
                {task.status !== 'completed' && task.status !== 'cancelled' && <button onClick={() => updateTaskStatus(task, 'cancelled')} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetailMilestones = () => {
    if (!projectDetail) return null;
    const milestones = projectDetail.milestones || [];
    const sorted = [...milestones].sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime());
    const completedCount = sorted.filter(m => m.is_completed).length;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-surface-500">{completedCount}/{sorted.length} completed</p>
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Milestone name..." value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} />
          <input type="date" className="input w-36" value={milestoneForm.due_date} onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })} />
          <button onClick={createMilestone} className="btn-primary"><Plus size={16} /></button>
        </div>
        <div className="relative ml-2 space-y-0">
          {sorted.length === 0 && <p className="text-sm text-surface-400 text-center py-4">No milestones set</p>}
          {sorted.map((m, idx) => (
            <div key={m.id} className="flex items-start gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <button onClick={() => toggleMilestone(m)} className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${m.is_completed ? 'border-accent-500 bg-accent-500 text-white' : 'border-surface-300 bg-white dark:bg-surface-800'}`}>
                  {m.is_completed && <CheckCircle2 size={14} />}
                </button>
                {idx < sorted.length - 1 && <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700" />}
              </div>
              <div className="flex-1 pt-0.5">
                <p className={cn('text-sm font-medium', m.is_completed ? 'line-through text-surface-400' : 'text-surface-900 dark:text-surface-50')}>{m.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {m.due_date && <span className="text-xs text-surface-400">{formatDate(m.due_date)}</span>}
                  {m.is_completed && m.completed_date && <span className="text-xs text-accent-500">Completed {formatDate(m.completed_date)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetailExpenses = () => {
    if (!projectDetail || !projectFinancials) return null;
    const expenses = projectDetail.expenses || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
            <p className="text-xs text-surface-500">Expected Profit</p>
            <p className="truncate text-sm font-bold text-purple-700 dark:text-purple-400">{formatCurrency(projectFinancials.budget)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-xs text-surface-500">Total Expenses</p>
            <p className="truncate text-sm font-bold text-red-700 dark:text-red-400">{formatCurrency(projectFinancials.total_expenses)}</p>
          </div>
          <div className={`rounded-lg p-3 ${projectFinancials.net_profit >= 0 ? 'bg-accent-50 dark:bg-accent-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs text-surface-500">Net Profit</p>
            <p className={`truncate text-sm font-bold ${projectFinancials.net_profit >= 0 ? 'text-accent-700 dark:text-accent-400' : 'text-red-700 dark:text-red-400'}`}>
              {formatCurrency(projectFinancials.net_profit)}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-xs text-surface-500">{projectFinancials.is_completed ? 'Recorded Revenue' : 'Status'}</p>
            <p className={`truncate text-sm font-bold ${projectFinancials.is_completed ? 'text-blue-700 dark:text-blue-400' : ''}`}>
              {projectFinancials.is_completed ? formatCurrency(projectFinancials.recorded_revenue) : projectDetail.status?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {projectFinancials.budget > 0 && (
          <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
            <p className="text-xs text-surface-500 mb-1">Profit Margin: {projectFinancials.profit_margin}%</p>
            <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700">
              <div
                className={`h-2 rounded-full ${projectFinancials.profit_margin >= 0 ? 'bg-accent-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(Math.abs(projectFinancials.profit_margin), 100)}%` }}
              />
            </div>
          </div>
        )}

        {!projectFinancials.is_completed && (
          <>
            <div className="flex gap-2 flex-wrap">
              <select className="input w-40" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                <option value="">Category</option>
                <option value="materials">Materials</option>
                <option value="equipment">Equipment</option>
                <option value="labor">Labor</option>
                <option value="transport">Transport</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="software">Software</option>
                <option value="other">Other</option>
              </select>
              <input className="input flex-1" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              <input type="number" className="input w-28" placeholder="Amount" value={expenseForm.amount || ''} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} />
              <input type="date" className="input w-36" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
              <button onClick={addExpense} className="btn-primary"><Plus size={16} className="mr-1" /> Add</button>
            </div>

            <div className="rounded-lg border border-accent-200 bg-accent-50 p-4 dark:border-accent-800 dark:bg-accent-900/20">
              <p className="text-xs font-medium text-accent-700 dark:text-accent-400 mb-2">Ready to finalize?</p>
              <p className="text-xs text-surface-500 mb-3">
                Net profit of <strong>{formatCurrency(projectFinancials.net_profit)}</strong> will be recorded as revenue.
              </p>
              <button
                onClick={() => updateProjectStatus(projectDetail.id, 'completed')}
                className="btn-primary text-sm"
              >
                Complete Project & Track Revenue
              </button>
            </div>
          </>
        )}

        {projectFinancials.is_completed && (
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-4 text-center dark:border-accent-800 dark:bg-accent-900/20">
            <CheckCircle size={24} className="mx-auto mb-1 text-accent-600" />
            <p className="text-sm font-medium text-accent-700 dark:text-accent-400">Project Completed</p>
            <p className="text-xs text-surface-500 mt-1">
              Revenue recorded: <strong>{formatCurrency(projectFinancials.recorded_revenue)}</strong>
            </p>
            <button
              onClick={() => dataService.downloadProjectReport(projectDetail.id)}
              className="mt-3 btn-secondary text-xs px-3 py-1.5"
            >
              <FileText size={14} className="mr-1" /> Download PDF Report
            </button>
          </div>
        )}

        <div className="space-y-1">
          {expenses.length === 0 && <p className="text-sm text-surface-400 text-center py-4">No expenses recorded</p>}
          {expenses.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3 dark:border-surface-700">
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{e.description || e.category}</p>
                <div className="flex gap-3 text-xs text-surface-400 mt-0.5">
                  <span className="capitalize">{e.category}</span>
                  <span>{formatDate(e.expense_date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-red-600">{formatCurrency(e.amount)}</p>
                {!projectFinancials.is_completed && (
                  <button onClick={() => deleteExpense(e.id)} className="rounded p-1 text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetailTime = () => {
    if (!projectDetail) return null;
    const entries = projectDetail.time_entries || [];
    const tasks = projectDetail.tasks || [];
    const totalHours = entries.reduce((s: number, e: any) => s + Number(e.hours), 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-surface-900 dark:text-surface-50">Total: {totalHours}h</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input w-48" value={timeForm.task_id} onChange={(e) => setTimeForm({ ...timeForm, task_id: e.target.value })}>
            <option value="">Select task</option>
            {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <input type="number" className="input w-20" placeholder="Hours" value={timeForm.hours || ''} onChange={(e) => setTimeForm({ ...timeForm, hours: Number(e.target.value) })} />
          <input type="date" className="input w-36" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} />
          <button onClick={logTime} className="btn-primary"><Timer size={16} className="mr-1" /> Log</button>
        </div>
        <div className="space-y-1">
          {entries.length === 0 && <p className="text-sm text-surface-400 text-center py-4">No time logged</p>}
          {entries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3 dark:border-surface-700">
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">{e.task?.title || 'General'}</p>
                <p className="text-xs text-surface-400">{e.user?.first_name} {e.user?.last_name} · {formatDate(e.date)}</p>
              </div>
              <p className="text-sm font-bold text-surface-900 dark:text-surface-50">{e.hours}h</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Management</h1>
          <p className="page-subtitle">Plan, track, and deliver projects on time and within budget</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary"><Plus size={18} className="mr-1" /> New Project</button>
      </div>

      {renderStats()}

      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input type="text" placeholder="Search projects..." className="input pl-10 w-full sm:w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-full sm:w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex rounded-lg border border-surface-200 p-0.5 dark:border-surface-700">
          <button onClick={() => setView('list')} className={`p-2 rounded ${view === 'list' ? 'bg-surface-100 text-surface-900 dark:bg-surface-700' : 'text-surface-400'}`}><List size={18} /></button>
          <button onClick={() => setView('board')} className={`p-2 rounded ${view === 'board' ? 'bg-surface-100 text-surface-900 dark:bg-surface-700' : 'text-surface-400'}`}><Columns size={18} /></button>
        </div>
      </div>

      {view === 'list' ? renderList() : renderBoard()}

      {/* Project Detail Side Panel */}
      {selectedProject && projectDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{projectDetail.name}</h2>
                <p className="text-xs text-surface-500">{projectDetail.project_code}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleDeleteProject(projectDetail.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
              </div>
            </div>

            <div className="flex border-b border-surface-200 dark:border-surface-700">
              {(['overview', 'tasks', 'milestones', 'time', 'expenses'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)} className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>
                  {t === 'overview' && <><BarChart3 size={14} className="inline mr-1" />Overview</>}
                  {t === 'tasks' && <><CheckCircle2 size={14} className="inline mr-1" />Tasks</>}
                  {t === 'milestones' && <><Target size={14} className="inline mr-1" />Milestones</>}
                  {t === 'time' && <><Timer size={14} className="inline mr-1" />Time</>}
                  {t === 'expenses' && <><DollarSign size={14} className="inline mr-1" />Expenses</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && renderDetailOverview()}
              {detailTab === 'tasks' && renderDetailTasks()}
              {detailTab === 'milestones' && renderDetailMilestones()}
              {detailTab === 'time' && renderDetailTime()}
              {detailTab === 'expenses' && renderDetailExpenses()}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setShowProjectModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="label">Project Name *</label>
                <input className="input" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={projectForm.category} onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}>
                    <option value="">Select category</option>
                    <option value="cctv">CCTV Installation</option>
                    <option value="isp">ISP Deployment</option>
                    <option value="web">Web Development</option>
                    <option value="mobile">Mobile App Development</option>
                    <option value="software">Software Development</option>
                    <option value="network">Network Installation</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Customer</label>
                  <select className="input" value={projectForm.customer_id} onChange={(e) => setProjectForm({ ...projectForm, customer_id: e.target.value })}>
                    <option value="">Select customer</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.contact_person}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Project Manager</label>
                  <select className="input" value={projectForm.manager_id} onChange={(e) => setProjectForm({ ...projectForm, manager_id: e.target.value })}>
                    <option value="">Select manager</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={projectForm.end_date} onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Budget (TZS)</label>
                  <input type="number" className="input" value={projectForm.budget || ''} onChange={(e) => setProjectForm({ ...projectForm, budget: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as Project['status'] })}>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowProjectModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingProject ? 'Update' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
