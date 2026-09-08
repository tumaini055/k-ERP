-- ============================================
-- K-CONNECT TECHNOLOGIES ERP SYSTEM
-- Project Handover Documents Module
-- ============================================

CREATE TABLE IF NOT EXISTS handover_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handover_number VARCHAR(50) NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  prepared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by_name VARCHAR(255),
  received_by_signature TEXT,
  handed_over_by_name VARCHAR(255),
  handed_over_by_signature TEXT,
  notes TEXT,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handover_document_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handover_document_id UUID NOT NULL REFERENCES handover_documents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'delivered',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handover_documents_project ON handover_documents(project_id);
CREATE INDEX idx_handover_documents_customer ON handover_documents(customer_id);
CREATE INDEX idx_handover_documents_quotation ON handover_documents(quotation_id);
CREATE INDEX idx_handover_documents_company ON handover_documents(company_id);
CREATE INDEX idx_handover_document_items_doc ON handover_document_items(handover_document_id);
