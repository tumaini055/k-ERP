-- ============================================
-- EMPLOYEE CONTRACTS EXTENDED FIELDS
-- ============================================
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS contract_number VARCHAR(50) UNIQUE;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS probation_months INTEGER DEFAULT 3;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS notice_period_months INTEGER DEFAULT 1;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS working_hours VARCHAR(100);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS leave_entitlement VARCHAR(100);
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS duties TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS benefits TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signed_date DATE;

CREATE INDEX IF NOT EXISTS idx_employee_contracts_user ON employee_contracts(user_id);
