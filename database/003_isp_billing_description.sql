-- Add description column to isp_billing for custom invoice descriptions
ALTER TABLE isp_billing ADD COLUMN IF NOT EXISTS description TEXT;
