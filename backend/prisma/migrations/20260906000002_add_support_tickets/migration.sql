-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('BILLING', 'TECHNICAL', 'ACCOUNT', 'GENERAL');
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "ticket_status"   AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "author_type"     AS ENUM ('STORE_USER', 'PLATFORM_ADMIN');

-- CreateTable support_tickets
CREATE TABLE "support_tickets" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"      UUID         NOT NULL,
  "store_id"    UUID,
  "user_id"     UUID         NOT NULL,
  "title"       VARCHAR(200) NOT NULL,
  "description" TEXT         NOT NULL,
  "category"    "ticket_category" NOT NULL DEFAULT 'GENERAL',
  "priority"    "ticket_priority" NOT NULL DEFAULT 'MEDIUM',
  "status"      "ticket_status"   NOT NULL DEFAULT 'OPEN',
  "assigned_to" UUID,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_org_id_fkey"      FOREIGN KEY ("org_id")      REFERENCES "organizations"("org_id"),
  CONSTRAINT "support_tickets_store_id_fkey"    FOREIGN KEY ("store_id")    REFERENCES "stores"("store_id"),
  CONSTRAINT "support_tickets_user_id_fkey"     FOREIGN KEY ("user_id")     REFERENCES "users"("user_id"),
  CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "platform_users"("id")
);

-- CreateTable ticket_replies
CREATE TABLE "ticket_replies" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"   UUID        NOT NULL,
  "author_type" "author_type" NOT NULL,
  "author_id"   UUID        NOT NULL,
  "message"     TEXT        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "ticket_replies_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "ticket_replies_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "support_tickets_org_id_idx"  ON "support_tickets"("org_id");
CREATE INDEX "support_tickets_status_idx"  ON "support_tickets"("status");
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");
CREATE INDEX "ticket_replies_ticket_id_idx" ON "ticket_replies"("ticket_id");
