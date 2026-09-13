import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const allPermissions = {
    can_manage_orgs:        true,
    can_manage_stores:      true,
    can_manage_users:       true,
    can_manage_plans:       true,
    can_view_analytics:     true,
    can_manage_master_data: true,
    can_manage_tickets:     true,
    can_manage_roles:       true,
  };

  const role = await prisma.platformRole.upsert({
    where:  { name: 'Super Admin' },
    update: { permissions: allPermissions, isActive: true },
    create: {
      name:        'Super Admin',
      permissions: allPermissions,
      description: 'Full platform access',
    },
  });

  const hash = await bcrypt.hash('Admin@123', 12);
  const user = await prisma.platformUser.upsert({
    where:  { email: 'admin@billflow.in' },
    update: { name: 'BillFlow Admin', passwordHash: hash, isActive: true },
    create: {
      email:        'admin@billflow.in',
      name:         'BillFlow Admin',
      passwordHash: hash,
    },
  });

  await prisma.platformUserRole.upsert({
    where:  { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`✓ Super Admin role : ${role.id}`);
  console.log(`✓ Platform user    : ${user.email}`);
  console.log(`✓ Role assigned`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
