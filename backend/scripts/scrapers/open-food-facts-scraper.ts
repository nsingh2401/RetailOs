/**
 * Open Food Facts scraper for BillFlow YOLOv8 training data.
 * Scrapes Indian grocery products with images.
 *
 * Usage: npx ts-node scripts/scrapers/open-food-facts-scraper.ts --pages=10
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const BASE_URL   = 'https://world.openfoodfacts.org/cgi/search.pl';
const DELAY_MS   = 1000; // 1 req/sec — be respectful

// Parse CLI args
const pagesArg = process.argv.find(a => a.startsWith('--pages='));
const TOTAL_PAGES = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : 10;

interface OFFProduct {
  code:                string;
  product_name?:       string;
  brands?:             string;
  categories?:         string;
  image_url?:          string;
  image_front_url?:    string;
  image_nutrition_url?: string;
  nutriments?:         Record<string, unknown>;
  ingredients_text?:   string;
}

interface OFFResponse {
  products: OFFProduct[];
  count:    number;
  page:     number;
  page_size: number;
}

interface MetadataEntry {
  barcode:      string;
  name:         string;
  brands:       string;
  categories:   string;
  ingredients:  string;
  images:       { angle: string; file: string }[];
  scrapedAt:    string;
}

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'BillFlow-Training-Scraper/1.0' } }, res => {
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', err => {
      file.close();
      fsSync.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function fetchPage(page: number): Promise<OFFResponse> {
  const params = new URLSearchParams({
    action:         'process',
    tagtype_0:      'countries',
    tag_contains_0: 'contains',
    tag_0:          'india',
    json:           '1',
    page_size:      '100',
    page:           String(page),
  });
  const url = `${BASE_URL}?${params}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BillFlow-Training-Scraper/1.0' },
  });
  if (!res.ok) throw new Error(`OFF API error: ${res.status}`);
  return res.json() as Promise<OFFResponse>;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const trainingDir  = path.join(UPLOAD_DIR, 'training', 'grocery');
  const metadataPath = path.join(trainingDir, 'metadata.json');
  await fs.mkdir(trainingDir, { recursive: true });

  // Load existing metadata (resume support)
  let metadata: Record<string, MetadataEntry> = {};
  try {
    const raw = await fs.readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(metadata).length} existing entries from metadata.json`);
  } catch {
    console.log('Starting fresh metadata.json');
  }

  let totalImages   = 0;
  let totalProducts = 0;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    console.log(`\nPage ${page}/${TOTAL_PAGES}: fetching...`);
    let data: OFFResponse;
    try {
      data = await fetchPage(page);
    } catch (err) {
      console.error(`  Failed to fetch page ${page}: ${err}`);
      await sleep(DELAY_MS * 3);
      continue;
    }

    const products = data.products ?? [];
    let pageImages   = 0;
    let pageProducts = 0;

    for (const p of products) {
      const barcode = p.code?.trim();
      if (!barcode) continue;

      // Need at least one image
      const front = p.image_front_url || p.image_url;
      if (!front) continue;

      const productDir = path.join(trainingDir, barcode);
      await fs.mkdir(productDir, { recursive: true });

      const angles: { url: string; angle: string; file: string }[] = [
        { url: front,                    angle: 'FRONT', file: 'front.jpg' },
        ...(p.image_url && p.image_url !== front
          ? [{ url: p.image_url,           angle: 'BACK',  file: 'back.jpg' }]
          : []),
        ...(p.image_nutrition_url
          ? [{ url: p.image_nutrition_url, angle: 'LABEL', file: 'label.jpg' }]
          : []),
      ];

      const savedImages: { angle: string; file: string }[] = [];

      for (const img of angles) {
        const dest = path.join(productDir, img.file);
        // Skip already downloaded
        try { await fs.access(dest); continue; } catch {}

        try {
          await download(img.url, dest);
          savedImages.push({ angle: img.angle, file: img.file });
          pageImages++;
          totalImages++;
        } catch (err) {
          console.warn(`  Skipped ${barcode}/${img.file}: ${err}`);
        }
      }

      // Update metadata
      if (!metadata[barcode]) {
        metadata[barcode] = {
          barcode,
          name:        p.product_name ?? '',
          brands:      p.brands       ?? '',
          categories:  p.categories   ?? '',
          ingredients: p.ingredients_text ?? '',
          images:      savedImages,
          scrapedAt:   new Date().toISOString(),
        };
        pageProducts++;
        totalProducts++;
      } else if (savedImages.length > 0) {
        metadata[barcode].images.push(...savedImages);
      }
    }

    console.log(`Page ${page}/${TOTAL_PAGES}: downloaded ${pageImages} images for ${pageProducts} products`);

    // Persist metadata after each page
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Rate limit
    if (page < TOTAL_PAGES) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Total: ${totalImages} images, ${totalProducts} new products.`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Images:   ${path.join(UPLOAD_DIR, 'training', 'grocery')}`);
  console.log('\nNext step: import images into Label Studio for bounding-box annotation.');
}

main().catch(err => { console.error(err); process.exit(1); });
