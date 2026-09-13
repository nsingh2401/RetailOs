-- CreateTable: platform_users
CREATE TABLE "platform_users" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    "email"         VARCHAR(255) NOT NULL,
    "name"          VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateTable: platform_roles
CREATE TABLE "platform_roles" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    "name"        VARCHAR(100) NOT NULL,
    "permissions" JSONB        NOT NULL DEFAULT '{}',
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "platform_roles_name_key" ON "platform_roles"("name");

-- CreateTable: platform_user_roles
CREATE TABLE "platform_user_roles" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id"    UUID        NOT NULL REFERENCES "platform_users"("id") ON DELETE CASCADE,
    "role_id"    UUID        NOT NULL REFERENCES "platform_roles"("id") ON DELETE CASCADE,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "platform_user_roles_user_id_role_id_key"
    ON "platform_user_roles"("user_id", "role_id");
