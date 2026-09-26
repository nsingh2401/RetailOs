-- AlterEnum: add PAN_SHOP to industry_type
-- PostgreSQL ALTER TYPE ... ADD VALUE is safe — no table rewrite needed.
ALTER TYPE "industry_type" ADD VALUE IF NOT EXISTS 'PAN_SHOP';
