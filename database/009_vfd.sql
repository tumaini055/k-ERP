-- ============================================
-- K-CONNECT TECHNOLOGIES ERP SYSTEM
-- TRA VFD / EFD Fiscal Receipt Integration
-- ============================================

-- ============================================
-- VFD CONFIGURATION (one row per company)
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  tin VARCHAR(20),
  vrn VARCHAR(50),
  business_name VARCHAR(255),
  business_address TEXT,
  tax_office VARCHAR(100),
  tax_region VARCHAR(100),
  efd_serial VARCHAR(50),
  certkey VARCHAR(255),
  regid VARCHAR(255),
  uin VARCHAR(100),
  receipt_code VARCHAR(50),
  cert_serial VARCHAR(255),
  cert_private_key TEXT,
  environment VARCHAR(10) DEFAULT 'test',
  api_username VARCHAR(255),
  api_password VARCHAR(255),
  token TEXT,
  token_expires_at TIMESTAMPTZ,
  routing_key VARCHAR(50) DEFAULT 'vfdrct',
  gc BIGINT DEFAULT 0,
  dc INTEGER DEFAULT 0,
  z_date DATE,
  next_receipt_number BIGINT DEFAULT 1,
  receipt_prefix VARCHAR(20) DEFAULT 'RCT',
  auto_submit BOOLEAN DEFAULT true,
  default_tax_rate DECIMAL(5,2) DEFAULT 18,
  currency VARCHAR(10) DEFAULT 'TZS',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vfd_config_company ON vfd_configurations(company_id);

-- ============================================
-- VFD TAX RATES (TRA tax codes)
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_tax_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  code CHAR(1) NOT NULL,
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  tra_tax_code INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================
-- VFD RECEIPTS (fiscal receipts)
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  sale_id UUID,
  source_type VARCHAR(20) DEFAULT 'invoice',
  receipt_number VARCHAR(50) UNIQUE,
  rctnum VARCHAR(20),
  dc INTEGER,
  gc BIGINT,
  znum VARCHAR(20),
  rctvnum VARCHAR(200),
  receipt_date DATE,
  receipt_time VARCHAR(20),
  tin VARCHAR(20),
  vrn VARCHAR(50),
  efd_serial VARCHAR(50),
  regid VARCHAR(255),
  uin VARCHAR(100),
  verification_code VARCHAR(200),
  verification_url TEXT,
  customer_name VARCHAR(255),
  customer_tin VARCHAR(20),
  customer_mobile VARCHAR(30),
  customer_id_type INTEGER DEFAULT 6,
  customer_id VARCHAR(50),
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TZS',
  payment_type VARCHAR(20) DEFAULT 'CASH',
  status VARCHAR(20) DEFAULT 'pending',
  ack_code INTEGER,
  ack_message TEXT,
  request_payload TEXT,
  response_payload TEXT,
  retry_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  void_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vfd_receipts_company ON vfd_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_vfd_receipts_status ON vfd_receipts(status);
CREATE INDEX IF NOT EXISTS idx_vfd_receipts_sale ON vfd_receipts(sale_id);
CREATE INDEX IF NOT EXISTS idx_vfd_receipts_date ON vfd_receipts(receipt_date);

-- ============================================
-- VFD RECEIPT ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID REFERENCES vfd_receipts(id) ON DELETE CASCADE,
  item_id VARCHAR(50),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(15,2),
  tax_code INTEGER DEFAULT 1,
  tax_rate CHAR(1) DEFAULT 'A',
  amount DECIMAL(15,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vfd_receipt_items_receipt ON vfd_receipt_items(receipt_id);

-- ============================================
-- VFD API LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  action VARCHAR(30) NOT NULL,
  endpoint TEXT,
  request_payload TEXT,
  response_payload TEXT,
  status VARCHAR(20),
  ack_code INTEGER,
  ack_message TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vfd_logs_company ON vfd_api_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_vfd_logs_created ON vfd_api_logs(created_at);

-- ============================================
-- VFD CANCELLATIONS (voided receipts)
-- ============================================
CREATE TABLE IF NOT EXISTS vfd_cancellations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  receipt_id UUID REFERENCES vfd_receipts(id),
  reason TEXT,
  amount DECIMAL(15,2) DEFAULT 0,
  original_rctnum VARCHAR(20),
  original_rctvnum VARCHAR(200),
  request_payload TEXT,
  response_payload TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vfd_cancellations_receipt ON vfd_cancellations(receipt_id);

-- ============================================
-- SEED DEFAULT TAX RATES (for default company)
-- ============================================
INSERT INTO vfd_tax_rates (company_id, code, name, rate, tra_tax_code, description)
SELECT c.id, 'A', 'Standard VAT', 18, 1, 'Standard Rate (18%)'
FROM companies c
WHERE c.name = 'K-CONNECT TECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM vfd_tax_rates tr WHERE tr.company_id = c.id AND tr.code = 'A');

INSERT INTO vfd_tax_rates (company_id, code, name, rate, tra_tax_code, description)
SELECT c.id, 'B', 'Special Rate', 0, 2, 'Special Rate (0%)'
FROM companies c
WHERE c.name = 'K-CONNECT TECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM vfd_tax_rates tr WHERE tr.company_id = c.id AND tr.code = 'B');

INSERT INTO vfd_tax_rates (company_id, code, name, rate, tra_tax_code, description)
SELECT c.id, 'C', 'Zero Rated', 0, 3, 'Zero Rated for Non-VAT items'
FROM companies c
WHERE c.name = 'K-CONNECT TECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM vfd_tax_rates tr WHERE tr.company_id = c.id AND tr.code = 'C');

INSERT INTO vfd_tax_rates (company_id, code, name, rate, tra_tax_code, description)
SELECT c.id, 'D', 'Special Relief', 0, 4, 'Special Relief for relieved items'
FROM companies c
WHERE c.name = 'K-CONNECT TECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM vfd_tax_rates tr WHERE tr.company_id = c.id AND tr.code = 'D');

INSERT INTO vfd_tax_rates (company_id, code, name, rate, tra_tax_code, description)
SELECT c.id, 'E', 'Exempt', 0, 5, 'Exempt items'
FROM companies c
WHERE c.name = 'K-CONNECT TECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM vfd_tax_rates tr WHERE tr.company_id = c.id AND tr.code = 'E');
