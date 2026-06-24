import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('employees', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) {
      res.status(400).json({ error: 'Date query parameter is required' });
      return;
    }

    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id, employee_id, first_name, last_name, department, position, role, avatar_url')
      .neq('role', 'customer')
      .eq('is_active', true)
      .order('first_name');

    if (empError) throw empError;

    const { data: attendanceData, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', date);

    if (attError) throw attError;

    const attendanceByUser = new Map(
      (attendanceData || []).map((a: any) => [a.user_id, a])
    );

    const result = (employees || []).map((emp: any) => ({
      ...emp,
      attendance: attendanceByUser.get(emp.id) || null,
    }));

    res.json({ data: result, date });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.put('/', checkPermission('employees', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, date, status, check_in, check_out, notes } = req.body;

    if (!user_id || !date) {
      res.status(400).json({ error: 'user_id and date are required' });
      return;
    }

    const existing = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', user_id)
      .eq('date', date)
      .single();

    let result;
    if (existing.data) {
      result = await supabase
        .from('attendance')
        .update({ status, check_in, check_out, notes, updated_at: new Date().toISOString() })
        .eq('id', existing.data.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('attendance')
        .insert({ user_id, date, status, check_in, check_out, notes })
        .select('*')
        .single();
    }

    if (result.error) throw result.error;
    res.json({ data: result.data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

export default router;
