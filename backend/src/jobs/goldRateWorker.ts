import cron from 'node-cron';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';

const TROY_OZ_TO_GRAM = 31.1035;

const SUPPORTED_CURRENCIES = [
  'INR','USD','AED','GBP','EUR',
  'SGD','SAR','MYR','AUD','CAD',
];

const CURRENCY_META: Record<string,
    { name: string; symbol: string;
      decimals: number }> = {
  XAU: { name: 'Gold (troy oz)',    symbol: 'Au', decimals: 4 },
  XAG: { name: 'Silver (troy oz)',  symbol: 'Ag', decimals: 4 },
  INR: { name: 'Indian Rupee',      symbol: '₹',  decimals: 2 },
  USD: { name: 'US Dollar',         symbol: '$',  decimals: 2 },
  AED: { name: 'UAE Dirham',        symbol: 'د.إ',decimals: 2 },
  GBP: { name: 'British Pound',     symbol: '£',  decimals: 2 },
  EUR: { name: 'Euro',              symbol: '€',  decimals: 2 },
  SGD: { name: 'Singapore Dollar',  symbol: 'S$', decimals: 2 },
  SAR: { name: 'Saudi Riyal',       symbol: '﷼',  decimals: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  CAD: { name: 'Canadian Dollar',   symbol: 'C$', decimals: 2 },
};

async function ensureCurrencies():
    Promise<void> {
  const codes = [
    'XAU', 'XAG', ...SUPPORTED_CURRENCIES,
  ];
  for (const code of codes) {
    const meta = CURRENCY_META[code];
    if (!meta) continue;
    await prisma.currency.upsert({
      where:  { currencyCode: code },
      create: {
        currencyCode:  code,
        name:          meta.name,
        symbol:        meta.symbol,
        decimalPlaces: meta.decimals,
      },
      update: {},
    });
  }
}

export async function fetchGoldRates():
    Promise<void> {
  try {
    const METAL_API_KEY =
        process.env.METAL_PRICE_API_KEY;
    if (!METAL_API_KEY) {
      console.warn(
        '[GoldRate] METAL_PRICE_API_KEY not set — skipping');
      return;
    }

    // Ensure all required currencies exist
    await ensureCurrencies();

    const currencyList =
        SUPPORTED_CURRENCIES.join(',');

    // Fetch gold rates in all currencies
    const goldUrl =
      `https://api.metalpriceapi.com/v1/latest`
      + `?api_key=${METAL_API_KEY}`
      + `&base=XAU`
      + `&currencies=${currencyList}`;

    const goldRes  = await fetch(goldUrl);
    const goldData = await goldRes.json() as {
      success: boolean;
      rates:   Record<string, number>;
      base:    string;
    };

    if (!goldData.success ||
        !goldData.rates) {
      console.error(
        '[GoldRate] Gold API error:',
        goldData);
      return;
    }

    // Fetch silver rates
    const silverUrl =
      `https://api.metalpriceapi.com/v1/latest`
      + `?api_key=${METAL_API_KEY}`
      + `&base=XAG`
      + `&currencies=${currencyList}`;

    const silverRes  = await fetch(
        silverUrl);
    const silverData = await silverRes
        .json() as {
          success: boolean;
          rates:   Record<string, number>;
        };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert gold rates for all currencies
    for (const currency of
        SUPPORTED_CURRENCIES) {
      const ratePerOz =
          goldData.rates[currency];
      if (!ratePerOz) continue;

      // API returns: 1 XAU = X currency
      // Already in currency per troy oz
      const ratePerGram =
          ratePerOz / TROY_OZ_TO_GRAM;

      await prisma.fxRate.upsert({
        where: {
          baseCurrency_quoteCurrency_effectiveDate: {
            baseCurrency:  'XAU',
            quoteCurrency: currency,
            effectiveDate: today,
          },
        },
        create: {
          baseCurrency:  'XAU',
          quoteCurrency: currency,
          rate:          ratePerGram,
          source:        'OPEN_EXCHANGE',
          effectiveDate: today,
        },
        update: {
          rate:   ratePerGram,
          source: 'OPEN_EXCHANGE',
        },
      });

      // Cache INR rate specifically
      // (most common for India stores)
      if (currency === 'INR') {
        await redis.setex(
          'jewelry:gold_rate_per_gram_INR',
          86400,
          ratePerGram.toFixed(2),
        );
        // Keep legacy key for compatibility
        await redis.setex(
          'jewelry:gold_rate_per_gram',
          86400,
          ratePerGram.toFixed(2),
        );
      }
    }

    // Upsert silver rates
    if (silverData.success &&
        silverData.rates) {
      for (const currency of
          SUPPORTED_CURRENCIES) {
        const ratePerOz =
            silverData.rates[currency];
        if (!ratePerOz) continue;

        const ratePerGram =
            ratePerOz / TROY_OZ_TO_GRAM;

        await prisma.fxRate.upsert({
          where: {
            baseCurrency_quoteCurrency_effectiveDate: {
              baseCurrency:  'XAG',
              quoteCurrency: currency,
              effectiveDate: today,
            },
          },
          create: {
            baseCurrency:  'XAG',
            quoteCurrency: currency,
            rate:          ratePerGram,
            source:        'OPEN_EXCHANGE',
            effectiveDate: today,
          },
          update: {
            rate:   ratePerGram,
            source: 'OPEN_EXCHANGE',
          },
        });

        if (currency === 'INR') {
          await redis.setex(
            'jewelry:silver_rate_per_gram_INR',
            86400,
            ratePerGram.toFixed(2),
          );
          await redis.setex(
            'jewelry:silver_rate_per_gram',
            86400,
            ratePerGram.toFixed(2),
          );
        }
      }
    }

    // Update app_config with INR rates
    // (for backward compatibility)
    const goldInr = goldData.rates['INR'];
    if (goldInr) {
      const goldInrPerGram =
          goldInr / TROY_OZ_TO_GRAM;
      await prisma.appConfig.upsert({
        where: {
          key: 'gold_rate_inr_per_gram' },
        create: {
          key:   'gold_rate_inr_per_gram',
          value: goldInrPerGram.toFixed(2),
        },
        update: {
          value: goldInrPerGram.toFixed(2),
        },
      });
    }

    await prisma.appConfig.upsert({
      where: {
        key: 'gold_rate_last_fetched' },
      create: {
        key:   'gold_rate_last_fetched',
        value: new Date().toISOString(),
      },
      update: {
        value: new Date().toISOString(),
      },
    });

    console.log(
      `[GoldRate] Rates updated for `
      + `${SUPPORTED_CURRENCIES.length}`
      + ` currencies`);

  } catch (e) {
    console.error(
      '[GoldRate] fetch error:', e);
  }
}

// Re-export so handler.ts can call on cache miss
export { fetchGoldRates as fetchAndCacheGoldRate };

// Run immediately on startup, then daily at 09:00 AM IST
export function scheduleGoldRateFetch(): void {
  fetchGoldRates();

  cron.schedule('0 9 * * *', () => {
    fetchGoldRates().catch(err =>
      console.error('[GoldRate] cron error:', err));
  }, { timezone: 'Asia/Kolkata' });
}
