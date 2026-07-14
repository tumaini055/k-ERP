-- ============================================
-- CASH REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cash_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  requested_by UUID REFERENCES users(id),
  amount DECIMAL(15,2) NOT NULL,
  purpose TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  payment_method payment_method DEFAULT 'cash',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  disbursed_at TIMESTAMPTZ,
  disbursed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_requests_company ON cash_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_requests_status ON cash_requests(status);
CREATE INDEX IF NOT EXISTS idx_cash_requests_requested_by ON cash_requests(requested_by);
