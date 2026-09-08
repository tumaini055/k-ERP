-- ============================================
-- K-CONNECT TECHNOLOGIES ERP SYSTEM
-- Delivery Notes Module
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_number VARCHAR(50) NOT NULL UNIQUE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'delivered', 'cancelled')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  delivery_address TEXT,
  delivery_contact_name VARCHAR(255),
  delivery_contact_phone VARCHAR(50),
  dispatch_date DATE,
  received_date DATE,
  received_by_name VARCHAR(255),
  notes TEXT,
  prepared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_notes_customer ON delivery_notes(customer_id);
CREATE INDEX idx_delivery_notes_project ON delivery_notes(project_id);
CREATE INDEX idx_delivery_notes_invoice ON delivery_notes(invoice_id);
CREATE INDEX idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX idx_delivery_notes_company ON delivery_notes(company_id);
CREATE INDEX idx_delivery_note_items_delivery ON delivery_note_items(delivery_note_id);
