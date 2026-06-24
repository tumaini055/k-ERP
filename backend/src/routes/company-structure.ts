import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ── Departments ──

router.get('/departments', async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase.from('departments').select('*').order('name');

    if (req.user!.role !== 'super_admin' && req.user!.company_id) {
      query = query.eq('company_id', req.user!.company_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }
    const { data, error } = await supabase
      .from('departments')
      .insert({ name, code, description, company_id: req.user!.company_id })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/departments/:id', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.delete('/departments/:id', checkPermission('settings', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ── Positions ──

router.get('/positions', async (req: AuthRequest, res: Response) => {
  try {
    let query = supabase.from('positions').select('*, department:departments(name)').order('name');

    if (req.user!.role !== 'super_admin' && req.user!.company_id) {
      query = query.eq('company_id', req.user!.company_id);
    }

    if (req.query.department_id) {
      query = query.eq('department_id', req.query.department_id);
    }

    const { data, error } = await query;
    if (error) {
      if ((error as any)?.message?.includes('relation') || (error as any)?.code === '42P01') {
        res.json({ data: [] });
        return;
      }
      throw error;
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/positions', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, department_id, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Position name is required' });
      return;
    }
    const { data, error } = await supabase
      .from('positions')
      .insert({ name, department_id, description, company_id: req.user!.company_id })
      .select('*, department:departments(name)')
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create position' });
  }
});

router.put('/positions/:id', checkPermission('settings', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('positions')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*, department:departments(name)')
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update position' });
  }
});

router.delete('/positions/:id', checkPermission('settings', 'canDelete'), async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Position deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// ── Organization Chart ──

router.get('/organization-chart', async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.company_id;
    let deptQuery = supabase.from('departments').select('*').order('name');
    let empQuery = supabase.from('users').select('id, first_name, last_name, email, phone, role, department, position, avatar_url')
      .neq('role', 'customer')
      .order('first_name');

    if (companyId) {
      deptQuery = deptQuery.eq('company_id', companyId);
      empQuery = empQuery.eq('company_id', companyId);
    }

    const [deptRes, empRes] = await Promise.all([deptQuery, empQuery]);

    const departments = deptRes.data || [];
    const employees = empRes.data || [];

    const departmentsWithManager = departments.map((dept: any) => {
      const manager = employees.find((e: any) => e.id === dept.manager_id);
      const deptEmployees = employees.filter((e: any) => e.department === dept.name);
      const positionNames = [...new Set(deptEmployees.map((e: any) => e.position).filter(Boolean))];

      const positions = positionNames.map((posName) => ({
        name: posName,
        employees: deptEmployees.filter((e: any) => e.position === posName),
      }));

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        manager: manager ? { id: manager.id, first_name: manager.first_name, last_name: manager.last_name, email: manager.email } : null,
        positions,
        employee_count: deptEmployees.length,
      };
    });

    res.json({ departments: departmentsWithManager });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization chart' });
  }
});

export default router;
