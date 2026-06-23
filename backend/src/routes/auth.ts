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

    await supabase
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', req.user!.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
