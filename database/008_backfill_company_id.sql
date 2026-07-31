-- ============================================
-- BACKFILL company_id FOR LEGACY ROWS
-- Fixes data created before a user had a company assigned.
-- Only runs when exactly one company exists to avoid mis-assigning data.
-- ============================================
DO $$
DECLARE cid uuid;
BEGIN
  SELECT id INTO cid FROM companies LIMIT 1;

  IF FOUND AND (SELECT COUNT(*) FROM companies) = 1 THEN
    UPDATE departments SET company_id = cid WHERE company_id IS NULL;
    UPDATE positions SET company_id = cid WHERE company_id IS NULL;
    UPDATE users SET company_id = cid WHERE company_id IS NULL AND role <> 'customer';
    UPDATE customers SET company_id = cid WHERE company_id IS NULL;
    UPDATE projects SET company_id = cid WHERE company_id IS NULL;
    UPDATE invoices SET company_id = cid WHERE company_id IS NULL;
    UPDATE expenses SET company_id = cid WHERE company_id IS NULL;
    UPDATE payments SET company_id = cid WHERE company_id IS NULL;
    UPDATE cash_requests SET company_id = cid WHERE company_id IS NULL;
    UPDATE support_tickets SET company_id = cid WHERE company_id IS NULL;
    UPDATE service_contracts SET company_id = cid WHERE company_id IS NULL;
  END IF;
END $$;
