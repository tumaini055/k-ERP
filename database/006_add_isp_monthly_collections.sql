CREATE TABLE IF NOT EXISTS isp_monthly_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  year_month VARCHAR(7) NOT NULL,
  projected_amount DECIMAL(15,2) DEFAULT 0,
  collected_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, year_month)
);
