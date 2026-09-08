-- ============================================
-- K-CONNECT TECHNOLOGIES ERP SYSTEM
-- Temporary password / force password change
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
