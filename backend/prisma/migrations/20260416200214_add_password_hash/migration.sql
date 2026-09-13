/*
  Warnings:

  - You are about to alter the column `ip_address` on the `event_logs` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "event_logs" ALTER COLUMN "ip_address" SET DATA TYPE inet;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" VARCHAR(255);
