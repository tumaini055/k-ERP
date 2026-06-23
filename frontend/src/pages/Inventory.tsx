import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dataService } from '../services/dataService';
import { Product } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import {
  Package, Plus, Search, X, RefreshCw,
  Edit2, TrendingUp, TrendingDown, ClipboardList,
} from 'lucide-react';

const stockStatus = (qty: number, reorder: number = 0) => {
  if (qty <= 0) return { label: 'Out of Stock', color: 'badge-danger' };
  if (qty <= (reorder || 5)) return { label: 'Low Stock', color: 'badge-warning' };
  return { label: 'In Stock', color: 'badge-success' };
};

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetail, setProductDetail] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'stock' | 'transactions'>('overview');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    sku: '', name: '', description: '', category_id: '',
    unit_price: 0, cost_price: 0, unit: '', reorder_level: 0,
  });

  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [stockForm, setStockForm] = useState({ quantity: 0, notes: '' });

  useEffect(() => { fetchAll(); }, [search, categoryFilter]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await dataService.getProducts(params);
      setProducts(data);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  useEffect(() => {
    dataService.getCategories().then((res: any) => setCategories(res.data || [])).catch(() => {});
  }, []);

  const openProductDetail = async (product: Product) => {
    setSelectedProduct(product);
    setDetailTab('overview');
    setProductDetail(product);
    loadTransactions(product.id);
  };

  const closeDetail = () => {
    setSelectedProduct(null);
    setProductDetail(null);
    setTransactions([]);
  };

  const loadTransactions = async (productId: string) => {
    setTxLoading(true);
    try {
      const { data } = await dataService.getInventoryTransactions({ product_id: productId, limit: 50 });
      setTransactions(data || []);
    } catch (error) { setTransactions([]); }
    setTxLoading(false);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ sku: '', name: '', description: '', category_id: '', unit_price: 0, cost_price: 0, unit: '', reorder_level: 0 });
    setShowProductModal(true);
  };

  const openEditProduct = () => {
    if (!productDetail) return;
    setEditingProduct(productDetail);
    setProductForm({
      sku: productDetail.sku || '',
      name: productDetail.name || '',
      description: productDetail.description || '',
      category_id: productDetail.category_id || '',
      unit_price: productDetail.unit_price || 0,
      cost_price: productDetail.cost_price || 0,
      unit: (productDetail as any).unit || '',
      reorder_level: (productDetail as any).reorder_level || 0,
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await dataService.updateProduct(editingProduct.id, productForm);
        toast.success('Product updated');
      } else {
        await dataService.createProduct(productForm);
        toast.success('Product created');
      }
      setShowProductModal(false);
      fetchAll();
      if (selectedProduct) {
        const { data } = await dataService.getProducts({ limit: 100 });
        const updated = data.find((p: Product) => p.id === selectedProduct.id);
        if (updated) { setSelectedProduct(updated); setProductDetail(updated); }
      }
    } catch (error) {
      toast.error(editingProduct ? 'Failed to update product' : 'Failed to create product');
    }
  };

  const handleStockIn = async () => {
    if (!selectedProduct || !stockForm.quantity) return;
    try {
      await dataService.stockIn({ product_id: selectedProduct.id, quantity: stockForm.quantity, notes: stockForm.notes, branch_id: null });
      toast.success('Stock added');
      setShowStockInModal(false);
      setStockForm({ quantity: 0, notes: '' });
      fetchAll();
      if (selectedProduct) loadTransactions(selectedProduct.id);
    } catch (error) { toast.error('Failed to add stock'); }
  };

  const handleStockOut = async () => {
    if (!selectedProduct || !stockForm.quantity) return;
    try {
      await dataService.stockOut({ product_id: selectedProduct.id, quantity: stockForm.quantity, notes: stockForm.notes, branch_id: null });
      toast.success('Stock removed');
      setShowStockOutModal(false);
      setStockForm({ quantity: 0, notes: '' });
      fetchAll();
      if (selectedProduct) loadTransactions(selectedProduct.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to remove stock');
    }
  };

  const getTotalQty = (p: Product) => p.inventory?.reduce((s, i) => s + i.quantity, 0) || 0;

  const totalStock = products.reduce((sum, p) => sum + getTotalQty(p), 0);
  const totalValue = products.reduce((sum, p) => sum + getTotalQty(p) * Number(p.cost_price), 0);
  const lowStockCount = products.filter(p => {
    const qty = getTotalQty(p);
    return qty <= (p as any).reorder_level || qty <= 5;
  }).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset & Inventory Management</h1>
          <p className="page-subtitle">Track stock levels, assets, and equipment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchAll()} className="btn-secondary">
            <RefreshCw size={16} className="mr-1" /> Refresh
          </button>
          <button onClick={openAddProduct} className="btn-primary">
            <Plus size={18} className="mr-1" /> Add Product
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-blue-100 text-blue-600"><Package size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{products.length}</p><p className="stat-label">Products</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-accent-100 text-accent-600"><Package size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{totalStock}</p><p className="stat-label">Total Stock</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-purple-100 text-purple-600"><Package size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{formatCurrency(totalValue)}</p><p className="stat-label">Stock Value</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon shrink-0 bg-yellow-100 text-yellow-600"><Package size={22} /></div>
          <div className="min-w-0 overflow-hidden"><p className="stat-value">{lowStockCount}</p><p className="stat-label">Low Stock</p></div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto min-w-[140px]" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Cost Price</th>
              <th>In Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><RefreshCw size={20} className="mx-auto animate-spin text-surface-400" /></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-surface-400">No products found</td></tr>
            ) : (
              products.map((product) => {
                const qty = getTotalQty(product);
                const st = stockStatus(qty, (product as any).reorder_level);
                return (
                  <tr key={product.id} className="cursor-pointer" onClick={() => openProductDetail(product)}>
                    <td className="font-mono text-xs">{product.sku}</td>
                    <td className="font-medium">{product.name}</td>
                    <td>{product.category?.name || '-'}</td>
                    <td>{formatCurrency(product.unit_price)}</td>
                    <td>{formatCurrency(product.cost_price)}</td>
                    <td>{qty}</td>
                    <td><span className={st.color}>{st.label}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side Panel */}
      {selectedProduct && productDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-xl bg-white shadow-xl overflow-y-auto dark:bg-surface-800">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{productDetail.name}</h2>
                <p className="text-xs text-surface-500">SKU: {productDetail.sku}</p>
              </div>
              <button onClick={closeDetail} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>

            {productDetail.description && (
              <div className="px-5 pt-4">
                <p className="text-sm text-surface-600 dark:text-surface-400">{productDetail.description}</p>
              </div>
            )}

            <div className="flex border-b border-surface-200 dark:border-surface-700 mt-2">
              {(['overview', 'stock', 'transactions'] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                    detailTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-700'
                  }`}>
                  {t === 'overview' && <><ClipboardList size={14} className="inline mr-1" />Overview</>}
                  {t === 'stock' && <><Package size={14} className="inline mr-1" />Stock</>}
                  {t === 'transactions' && <><RefreshCw size={14} className="inline mr-1" />Transactions</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {detailTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <button onClick={openEditProduct} className="btn-secondary text-xs py-1.5 px-3">
                      <Edit2 size={14} className="mr-1" /> Edit
                    </button>
                    <button onClick={() => { setShowStockInModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                      <TrendingUp size={14} className="mr-1" /> Stock In
                    </button>
                    <button onClick={() => { setShowStockOutModal(true); }} className="btn-danger text-xs py-1.5 px-3">
                      <TrendingDown size={14} className="mr-1" /> Stock Out
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-surface-500">SKU</p><p className="text-sm font-medium">{productDetail.sku || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Category</p><p className="text-sm font-medium">{productDetail.category?.name || '-'}</p></div>
                    <div><p className="text-xs text-surface-500">Unit Price</p><p className="text-sm font-bold text-accent-600">{formatCurrency(productDetail.unit_price)}</p></div>
                    <div><p className="text-xs text-surface-500">Cost Price</p><p className="text-sm font-medium">{formatCurrency(productDetail.cost_price)}</p></div>
                    <div><p className="text-xs text-surface-500">Unit</p><p className="text-sm font-medium">{((productDetail as any).unit || 'piece')}</p></div>
                    <div><p className="text-xs text-surface-500">Reorder Level</p><p className="text-sm font-medium">{(productDetail as any).reorder_level || 0}</p></div>
                    <div><p className="text-xs text-surface-500">In Stock</p><p className="text-sm font-bold text-lg">{getTotalQty(productDetail)}</p></div>
                    <div>
                      <p className="text-xs text-surface-500">Status</p>
                      <p><span className={stockStatus(getTotalQty(productDetail), (productDetail as any).reorder_level).color}>
                        {stockStatus(getTotalQty(productDetail), (productDetail as any).reorder_level).label}
                      </span></p>
                    </div>
                  </div>

                  {getTotalQty(productDetail) > 0 && (
                    <div className="rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                      <p className="text-xs font-medium text-surface-500 mb-2">Stock Value</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-surface-400">At Cost</p>
                          <p className="text-sm font-bold">{formatCurrency(getTotalQty(productDetail) * Number(productDetail.cost_price))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">At Retail</p>
                          <p className="text-sm font-bold text-accent-600">{formatCurrency(getTotalQty(productDetail) * Number(productDetail.unit_price))}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'stock' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setShowStockInModal(true); }} className="btn-primary text-xs py-1.5 px-3">
                      <TrendingUp size={14} className="mr-1" /> Stock In
                    </button>
                    <button onClick={() => { setShowStockOutModal(true); }} className="btn-danger text-xs py-1.5 px-3">
                      <TrendingDown size={14} className="mr-1" /> Stock Out
                    </button>
                  </div>

                  {(!productDetail.inventory || productDetail.inventory.length === 0) ? (
                    <p className="text-center py-8 text-surface-400">No stock records</p>
                  ) : (
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr><th>Branch</th><th>Location</th><th>Quantity</th><th>Batch</th></tr>
                        </thead>
                        <tbody>
                          {productDetail.inventory.map((inv: any) => (
                            <tr key={inv.id}>
                              <td>{inv.branch_id ? inv.branch_id.slice(0, 8) : 'Main'}</td>
                              <td className="text-xs">{inv.location || '-'}</td>
                              <td className="font-bold">{inv.quantity}</td>
                              <td className="text-xs">{inv.batch_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'transactions' && (
                <div className="space-y-3">
                  {txLoading ? (
                    <p className="text-center py-8 text-surface-400"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading...</p>
                  ) : transactions.length === 0 ? (
                    <p className="text-center py-8 text-surface-400">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx: any) => (
                        <div key={tx.id} className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            tx.type === 'stock_in' ? 'bg-accent-100 text-accent-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {tx.type === 'stock_in' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</span>
                              <span className="text-sm font-bold">{tx.quantity} units</span>
                            </div>
                            {tx.notes && <p className="text-xs text-surface-500 truncate">{tx.notes}</p>}
                            <p className="text-xs text-surface-400">
                              {tx.user ? `${tx.user.first_name} ${tx.user.last_name}` : 'System'} · {formatDateTime(tx.created_at)}
                            </p>
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

      {/* Add/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowProductModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU *</label>
                  <input className="input" value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Name *</label>
                  <input className="input" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={productForm.category_id} onChange={e => setProductForm({...productForm, category_id: e.target.value})}>
                    <option value="">Select category</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})}>
                    <option value="piece">Piece</option>
                    <option value="meter">Meter</option>
                    <option value="kg">Kilogram</option>
                    <option value="liter">Liter</option>
                    <option value="box">Box</option>
                    <option value="set">Set</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unit Price (TZS)</label>
                  <input type="number" className="input" value={productForm.unit_price || ''} onChange={e => setProductForm({...productForm, unit_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Cost Price (TZS)</label>
                  <input type="number" className="input" value={productForm.cost_price || ''} onChange={e => setProductForm({...productForm, cost_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Reorder Level</label>
                  <input type="number" className="input" value={productForm.reorder_level || ''} onChange={e => setProductForm({...productForm, reorder_level: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowProductModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingProduct ? 'Update' : 'Create Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {showStockInModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Stock In: {selectedProduct?.name}
              </h2>
              <button onClick={() => setShowStockInModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Quantity *</label>
                <input type="number" className="input" min={1} value={stockForm.quantity || ''} onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={stockForm.notes} onChange={e => setStockForm({...stockForm, notes: e.target.value})} placeholder="Received from supplier, etc." />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowStockInModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleStockIn} disabled={!stockForm.quantity} className="btn-primary">
                  <TrendingUp size={14} className="mr-1" /> Add Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {showStockOutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Stock Out: {selectedProduct?.name}
              </h2>
              <button onClick={() => setShowStockOutModal(false)} className="rounded-lg p-2 text-surface-400 hover:bg-surface-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Quantity *</label>
                <input type="number" className="input" min={1} value={stockForm.quantity || ''} onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={stockForm.notes} onChange={e => setStockForm({...stockForm, notes: e.target.value})} placeholder="Used for project, sold, etc." />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowStockOutModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleStockOut} disabled={!stockForm.quantity} className="btn-danger">
                  <TrendingDown size={14} className="mr-1" /> Remove Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
