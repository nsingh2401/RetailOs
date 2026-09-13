import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function clean() {
  const orgs = await prisma.organization.findMany({ where: { slug: 'test-retail' } });
  for (const o of orgs) {
    await prisma.userStoreRole.deleteMany({ where: { store: { orgId: o.orgId } } });
    await prisma.store.deleteMany({ where: { orgId: o.orgId } });
    await prisma.user.deleteMany({ where: { orgId: o.orgId } });
    await prisma.organization.delete({ where: { orgId: o.orgId } });
    console.log('Deleted org:', o.orgId);
  }
  console.log('Done. Cleaned', orgs.length, 'org(s)');
  await prisma.$disconnect();
}

clean().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
