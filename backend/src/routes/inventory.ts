import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, checkPermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/products', checkPermission('inventory', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    let query = supabase
      .from('products')
      .select('*, category:categories(name), inventory:inventory(quantity, branch_id)', { count: 'exact' });

    if (category) query = query.eq('category_id', category);
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil((count || 0) / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/products', checkPermission('inventory', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...req.body, company_id: req.user!.company_id })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', checkPermission('inventory', 'canEdit'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.get('/categories', checkPermission('inventory', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/stock-in', checkPermission('inventory', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, quantity, branch_id, notes } = req.body;

    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('branch_id', branch_id)
      .single();

    if (existing) {
      await supabase
        .from('inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('inventory')
        .insert({ product_id, quantity, branch_id });
    }

    await supabase.from('inventory_transactions').insert({
      product_id,
      branch_id,
      type: 'stock_in',
      quantity,
      notes,
      performed_by: req.user!.id,
    });

    res.json({ message: 'Stock added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

router.post('/stock-out', checkPermission('inventory', 'canCreate'), async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, quantity, branch_id, notes, reference_type, reference_id } = req.body;

    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('branch_id', branch_id)
      .single();

    if (!existing || existing.quantity < quantity) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    await supabase
      .from('inventory')
      .update({ quantity: existing.quantity - quantity })
      .eq('id', existing.id);

    await supabase.from('inventory_transactions').insert({
      product_id,
      branch_id,
      type: 'stock_out',
      quantity,
      notes,
      reference_type,
      reference_id,
      performed_by: req.user!.id,
    });

    res.json({ message: 'Stock removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove stock' });
  }
});

router.get('/transactions', checkPermission('inventory', 'canView'), async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, type, page = 1, limit = 20 } = req.query;
    let query = supabase
      .from('inventory_transactions')
      .select('*, product:products(name, sku), user:users!inventory_transactions_performed_by_fkey(first_name, last_name)', { count: 'exact' });

    if (product_id) query = query.eq('product_id', product_id);
    if (type) query = query.eq('type', type);

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
