-- ============================================
-- K-CONNECT TECHNOLOGIES ERP SYSTEM
-- Password Reset Requests Module
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  new_password VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX idx_password_reset_requests_email ON password_reset_requests(email);
