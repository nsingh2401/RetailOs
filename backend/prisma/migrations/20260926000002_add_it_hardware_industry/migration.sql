-- AlterEnum: add IT_HARDWARE to industry_type
-- (PAN_SHOP was already added in 20260926000001)
ALTER TYPE "industry_type" ADD VALUE IF NOT EXISTS 'IT_HARDWARE';
