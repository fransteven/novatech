-- Drop legacy cash_transactions table (consolidated into cash_movements)
-- Layaway deposits now recorded in cash_movements with sourceType='layaway_deposit'
DROP TABLE IF EXISTS "cash_transactions";
