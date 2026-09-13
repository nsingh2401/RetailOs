import { prisma } from '../src/lib/prisma';
import { provisionStoreCategories } from '../src/services/categoryProvisioning';

const stores = [
  { storeId: '8688cf42-de73-4cb3-bbc2-7cc577a9e284', industryType: 'GROCERY'  },
  { storeId: 'd93de652-8bc9-4f45-be97-dcd605ca4bc7', industryType: 'APPAREL'  },
  { storeId: '5542e3ec-777a-4db4-9a14-491d13e2dd81', industryType: 'GENERAL'  },
  { storeId: '86088c8e-a642-4714-b4ef-8caadbf02eb4', industryType: 'APPAREL'  },
];

async function main() {
  for (const { storeId, industryType } of stores) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        return provisionStoreCategories(storeId, industryType, tx);
      });
      console.log(`✓ ${storeId} (${industryType}): ${result.synced} categories synced`);
    } catch (err) {
      console.error(`✗ ${storeId} (${industryType}): ${err}`);
    }
  }
  await prisma.$disconnect();
}

main();
