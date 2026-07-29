ALTER TABLE isp_packages ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2) DEFAULT 0;

UPDATE isp_packages SET cost_price = 0 WHERE cost_price IS NULL;
