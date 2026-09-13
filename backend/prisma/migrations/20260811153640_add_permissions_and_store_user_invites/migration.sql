/*
  Warnings:

  - You are about to alter the column `ip_address` on the `event_logs` table. The data in that column could be lost. The data in that column will be cast from `Inet` to `Unsupported("inet")`.

*/
-- AlterTable
ALTER TABLE "event_logs" ALTER COLUMN "ip_address" SET DATA TYPE inet;

-- AlterTable
ALTER TABLE "user_store_roles" ADD COLUMN     "permissions" JSONB;

-- CreateTable
CREATE TABLE "store_user_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" "store_role" NOT NULL,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_user_invites_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "store_user_invites" ADD CONSTRAINT "store_user_invites_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_user_invites" ADD CONSTRAINT "store_user_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
