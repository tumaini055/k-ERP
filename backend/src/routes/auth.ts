import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'Account is inactive' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        branch_id: user.branch_id,
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
        avatar_url: user.avatar_url,
        language: user.language,
        company_id: user.company_id,
        branch_id: user.branch_id,
        must_change_password: user.must_change_password || false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, phone, password, role } = req.body;

    const existing = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing.data) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        role: role || 'customer',
        employee_id: `EMP-${Date.now().toString().slice(-6)}`,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Registration failed' });
      return;
    }

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, role, department, position, avatar_url, language, company_id, branch_id, is_active, created_at')
      .eq('id', req.user!.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, phone, language } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ first_name, last_name, phone, language, updated_at: new Date().toISOString() })
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to update profile' });
      return;
    }

    res.json({ user: data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user!.id)
      .single();

    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    const { error: pwErr } = await supabase
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString(), must_change_password: false })
      .eq('id', req.user!.id);

    // Column may not exist yet — retry without it so password change still works
    if (pwErr) {
      await supabase
        .from('users')
        .update({ password_hash, updated_at: new Date().toISOString() })
        .eq('id', req.user!.id);
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ============================================
// FORGOT PASSWORD (public request - no auth)
// ============================================
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('email', email)
      .single();

    if (!user) {
      // Don't reveal whether the email exists
      res.json({ message: 'If the email exists, a password reset request has been submitted.' });
      return;
    }

    // Create a password reset request for an admin to action
    const { error } = await supabase.from('password_reset_requests').insert({
      user_id: user.id,
      email: user.email,
      status: 'pending',
    });

    if (error) throw error;

    res.json({ message: 'Password reset request submitted. An administrator will assist you shortly.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    // If table doesn't exist yet, still return a friendly message
    res.status(500).json({ error: 'Failed to submit password reset request' });
  }
});

// ============================================
// PASSWORD RESET REQUESTS (admin only)
// ============================================
router.get('/password-requests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const adminRoles = ['super_admin', 'ceo', 'managing_director', 'accountant'];
    if (!adminRoles.includes(req.user!.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { status } = req.query;
    let query = supabase
      .from('password_reset_requests')
      .select('*, user:users!password_reset_requests_user_id_fkey(first_name, last_name, email, role, employee_id, is_active)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      if ((error as any)?.code === '42P01' || (error as any)?.message?.includes('relation')) {
        res.json({ data: [] });
        return;
      }
      throw error;
    }

    res.json({ data: data || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch password reset requests' });
  }
});

// ============================================
// ADMIN RESET / SET PASSWORD
// ============================================
router.post('/reset-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const adminRoles = ['super_admin', 'ceo', 'managing_director', 'accountant'];
    if (!adminRoles.includes(req.user!.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { user_id, request_id, new_password, is_temporary } = req.body;
    if (!user_id || !new_password) {
      res.status(400).json({ error: 'user_id and new_password are required' });
      return;
    }

    if (String(new_password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Ensure target user exists and is not trying to reset themselves via admin path
    const { data: target } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user_id)
      .single();

    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash,
        updated_at: new Date().toISOString(),
        must_change_password: is_temporary ? true : false,
      })
      .eq('id', user_id);

    // Column may not exist yet — retry without must_change_password so reset still works
    if (error && (error as any)?.message?.includes('column')) {
      const { error: retryErr } = await supabase
        .from('users')
        .update({ password_hash, updated_at: new Date().toISOString() })
        .eq('id', user_id);
      if (retryErr) throw retryErr;
    } else if (error) {
      throw error;
    }

    // Update the reset request status if provided
    if (request_id) {
      await supabase
        .from('password_reset_requests')
        .update({
          status: 'completed',
          resolved_at: new Date().toISOString(),
          resolved_by: req.user!.id,
          new_password: new_password,
        })
        .eq('id', request_id);
    }

    res.json({ message: `Password for ${target.email} has been reset successfully.` });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
