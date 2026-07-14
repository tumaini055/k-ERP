import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20, unread } = req.query;
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (unread === 'true') query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) {
      res.json({ data: [] });
      return;
    }
    res.json({ data: data || [] });
  } catch (error) {
    res.json({ data: [] });
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    if (error) {
      res.json({ count: 0 });
      return;
    }
    res.json({ count: count || 0 });
  } catch (error) {
    res.json({ count: 0 });
  }
});

router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.json({ message: 'Marked as read' });
  }
});

router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.json({ message: 'All marked as read' });
  }
});

export default router;
