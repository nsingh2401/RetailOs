import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const HSN_CODES = [
  // ── JEWELRY (GST 3%) ───────────────────────────────────────
  { hsnCode: '71131100', description: 'Silver jewellery',                    defaultGstRate: 3,  isService: false },
  { hsnCode: '71131910', description: 'Gold jewellery',                       defaultGstRate: 3,  isService: false },
  { hsnCode: '71131920', description: 'Platinum jewellery',                   defaultGstRate: 3,  isService: false },
  { hsnCode: '71131930', description: 'Other precious metal jewellery',       defaultGstRate: 3,  isService: false },
  { hsnCode: '71141100', description: 'Silver articles of goldsmiths',        defaultGstRate: 3,  isService: false },
  { hsnCode: '71179000', description: 'Imitation jewellery',                  defaultGstRate: 3,  isService: false },
  { hsnCode: '71189000', description: 'Coins (non-legal tender)',             defaultGstRate: 3,  isService: false },

  // ── GROCERY — Zero-rated staples (GST 0%) ─────────────────
  { hsnCode: '04011000', description: 'Milk (fat ≤1%)',                       defaultGstRate: 0,  isService: false },
  { hsnCode: '04012000', description: 'Milk (fat >1% ≤6%)',                  defaultGstRate: 0,  isService: false },
  { hsnCode: '04031000', description: 'Yogurt / curd',                        defaultGstRate: 0,  isService: false },
  { hsnCode: '04061000', description: 'Fresh cheese',                         defaultGstRate: 0,  isService: false },
  { hsnCode: '04071100', description: 'Eggs (fertilised, for incubation)',    defaultGstRate: 0,  isService: false },
  { hsnCode: '04090000', description: 'Natural honey',                        defaultGstRate: 0,  isService: false },
  { hsnCode: '07019000', description: 'Potatoes (fresh)',                     defaultGstRate: 0,  isService: false },
  { hsnCode: '07031000', description: 'Onions (fresh)',                       defaultGstRate: 0,  isService: false },
  { hsnCode: '07070000', description: 'Cucumbers (fresh)',                    defaultGstRate: 0,  isService: false },
  { hsnCode: '10061000', description: 'Rice (husked brown)',                  defaultGstRate: 0,  isService: false },
  { hsnCode: '10011100', description: 'Durum wheat (seed)',                   defaultGstRate: 0,  isService: false },
  { hsnCode: '11010000', description: 'Wheat flour / atta',                   defaultGstRate: 0,  isService: false },

  // ── GROCERY — Processed (GST 5%) ──────────────────────────
  { hsnCode: '15079000', description: 'Soybean oil (refined)',                defaultGstRate: 5,  isService: false },
  { hsnCode: '15121100', description: 'Sunflower oil (crude)',                defaultGstRate: 5,  isService: false },
  { hsnCode: '17011200', description: 'Cane sugar (raw)',                     defaultGstRate: 5,  isService: false },

  // ── GROCERY — Packaged/processed (GST 12%) ────────────────
  { hsnCode: '19021100', description: 'Pasta (uncooked, no egg)',             defaultGstRate: 12, isService: false },
  { hsnCode: '19059090', description: 'Biscuits / cookies',                   defaultGstRate: 12, isService: false },
  { hsnCode: '20091100', description: 'Orange juice (frozen)',                 defaultGstRate: 12, isService: false },
  { hsnCode: '21011100', description: 'Coffee extract / essence',             defaultGstRate: 12, isService: false },
  { hsnCode: '21012000', description: 'Tea / maté extract / essence',        defaultGstRate: 12, isService: false },

  // ── PHARMACY — Medicines (GST 12%) ────────────────────────
  { hsnCode: '30041011', description: 'Ayurvedic medicines (with narcotic)',  defaultGstRate: 12, isService: false },
  { hsnCode: '30042012', description: 'Antibiotics (other)',                  defaultGstRate: 12, isService: false },
  { hsnCode: '30049099', description: 'Other medicaments (mixed/unmixed)',    defaultGstRate: 12, isService: false },
  { hsnCode: '30049041', description: 'Antidiabetic medicaments',             defaultGstRate: 12, isService: false },
  { hsnCode: '30021590', description: 'Vaccines (other)',                     defaultGstRate: 5,  isService: false },
  { hsnCode: '30051010', description: 'Adhesive dressings',                   defaultGstRate: 12, isService: false },
  { hsnCode: '30061010', description: 'Surgical gut / sutures',              defaultGstRate: 12, isService: false },
  { hsnCode: '38220090', description: 'Diagnostic reagents',                  defaultGstRate: 12, isService: false },
  { hsnCode: '90181990', description: 'Medical instruments (other)',           defaultGstRate: 12, isService: false },
  { hsnCode: '90189099', description: 'Other medical devices',                defaultGstRate: 12, isService: false },
  // Pharmacy — personal care (GST 18%)
  { hsnCode: '33049910', description: 'Sunscreen / suntan preparations',      defaultGstRate: 18, isService: false },
  { hsnCode: '33051000', description: 'Shampoos',                             defaultGstRate: 18, isService: false },
  { hsnCode: '33061000', description: 'Toothpaste / dentifrices',            defaultGstRate: 18, isService: false },
  { hsnCode: '33042000', description: 'Eye makeup preparations',              defaultGstRate: 18, isService: false },

  // ── APPAREL (GST 12%) ──────────────────────────────────────
  { hsnCode: '61051000', description: 'Men\'s shirts (cotton, knitted)',       defaultGstRate: 12, isService: false },
  { hsnCode: '61061000', description: 'Women\'s blouses (cotton, knitted)',    defaultGstRate: 12, isService: false },
  { hsnCode: '61091000', description: 'T-shirts (cotton)',                     defaultGstRate: 12, isService: false },
  { hsnCode: '61103000', description: 'Jerseys / pullovers (man-made fibres)', defaultGstRate: 12, isService: false },
  { hsnCode: '61142000', description: 'Garments (cotton, knitted)',            defaultGstRate: 12, isService: false },
  { hsnCode: '62034200', description: 'Men\'s trousers (cotton, woven)',       defaultGstRate: 12, isService: false },
  { hsnCode: '62042200', description: 'Women\'s suits (cotton, woven)',        defaultGstRate: 12, isService: false },
  { hsnCode: '61160910', description: 'Gloves (other)',                        defaultGstRate: 12, isService: false },
  { hsnCode: '61171010', description: 'Shawls / scarves (knitted)',            defaultGstRate: 12, isService: false },
  { hsnCode: '62099090', description: 'Other garments (woven)',                defaultGstRate: 12, isService: false },

  // ── FOOTWEAR (GST 18%) ─────────────────────────────────────
  { hsnCode: '64011000', description: 'Waterproof footwear (rubber/plastic)',  defaultGstRate: 18, isService: false },
  { hsnCode: '64019990', description: 'Other waterproof footwear',             defaultGstRate: 18, isService: false },
  { hsnCode: '64021990', description: 'Sports footwear (rubber/plastic)',      defaultGstRate: 18, isService: false },
  { hsnCode: '64039190', description: 'Other footwear (leather upper)',        defaultGstRate: 18, isService: false },
  { hsnCode: '64041110', description: 'Sports footwear (rubber outer sole)',   defaultGstRate: 18, isService: false },
  { hsnCode: '64042000', description: 'Footwear (textile upper)',              defaultGstRate: 18, isService: false },
  { hsnCode: '64061000', description: 'Uppers of footwear',                   defaultGstRate: 18, isService: false },
  { hsnCode: '64062000', description: 'Outer soles and heels',                defaultGstRate: 18, isService: false },

  // ── ELECTRONICS (GST 18%) ──────────────────────────────────
  { hsnCode: '85171200', description: 'Telephones (mobile / smartphones)',     defaultGstRate: 18, isService: false },
  { hsnCode: '84713000', description: 'Laptops / portable computers',          defaultGstRate: 18, isService: false },
  { hsnCode: '84714100', description: 'Desktop computers',                     defaultGstRate: 18, isService: false },
  { hsnCode: '85258000', description: 'Digital cameras / camcorders',          defaultGstRate: 18, isService: false },
  { hsnCode: '85271200', description: 'Radio receivers / clock-radios',        defaultGstRate: 18, isService: false },
  { hsnCode: '85284900', description: 'Monitors (colour, other)',               defaultGstRate: 18, isService: false },
  { hsnCode: '85176200', description: 'Base stations (telecom)',                defaultGstRate: 18, isService: false },
  { hsnCode: '85369010', description: 'Switches (electrical)',                  defaultGstRate: 18, isService: false },
  { hsnCode: '85423100', description: 'Electronic integrated circuits (MCU)',   defaultGstRate: 18, isService: false },
  { hsnCode: '85044010', description: 'UPS / static converters',               defaultGstRate: 18, isService: false },

  // ── ELECTRICAL (GST 18%) ───────────────────────────────────
  { hsnCode: '85311000', description: 'Burglar / fire alarms',                 defaultGstRate: 18, isService: false },
  { hsnCode: '85361010', description: 'Fuses (≤1000V)',                        defaultGstRate: 18, isService: false },
  { hsnCode: '85362010', description: 'Circuit breakers / MCB (≤1000V)',       defaultGstRate: 18, isService: false },
  { hsnCode: '85364900', description: 'Relays (≤1000V, other)',                defaultGstRate: 18, isService: false },
  { hsnCode: '85371010', description: 'Switchboards / distribution panels',    defaultGstRate: 18, isService: false },
  { hsnCode: '85444900', description: 'Electric conductors / wires',           defaultGstRate: 18, isService: false },
  { hsnCode: '85423900', description: 'Other electronic ICs',                  defaultGstRate: 18, isService: false },
  { hsnCode: '85392200', description: 'LED bulbs / filament lamps',            defaultGstRate: 12, isService: false },
  { hsnCode: '85167900', description: 'Other electrothermic appliances',       defaultGstRate: 18, isService: false },
  { hsnCode: '85044030', description: 'Battery chargers',                      defaultGstRate: 18, isService: false },

  // ── HARDWARE (GST 18%) ─────────────────────────────────────
  { hsnCode: '73181500', description: 'Screws / bolts (iron/steel)',           defaultGstRate: 18, isService: false },
  { hsnCode: '73181600', description: 'Nuts (iron/steel)',                     defaultGstRate: 18, isService: false },
  { hsnCode: '73182100', description: 'Washers (iron/steel)',                  defaultGstRate: 18, isService: false },
  { hsnCode: '82041100', description: 'Hand spanners / wrenches',              defaultGstRate: 18, isService: false },
  { hsnCode: '82051000', description: 'Drilling / reaming tools',              defaultGstRate: 18, isService: false },
  { hsnCode: '82055900', description: 'Other hand tools',                      defaultGstRate: 18, isService: false },
  { hsnCode: '73084000', description: 'Scaffolding / shuttering (iron/steel)', defaultGstRate: 18, isService: false },
  { hsnCode: '83024100', description: 'Hinges (base metal)',                   defaultGstRate: 18, isService: false },
  { hsnCode: '83025000', description: 'Hat-racks / hat-pegs (base metal)',     defaultGstRate: 18, isService: false },
  { hsnCode: '73269099', description: 'Other iron/steel articles',             defaultGstRate: 18, isService: false },

  // ── BAKERY (GST 5–18%) ─────────────────────────────────────
  { hsnCode: '19011000', description: 'Infant food preparations',              defaultGstRate: 18, isService: false },
  { hsnCode: '19012000', description: 'Baking mixes / dough',                  defaultGstRate: 18, isService: false },
  { hsnCode: '19021900', description: 'Other pasta (uncooked)',                 defaultGstRate: 12, isService: false },
  { hsnCode: '19053100', description: 'Sweet biscuits',                         defaultGstRate: 18, isService: false },
  { hsnCode: '19054000', description: 'Rusks / toasted bread',                  defaultGstRate: 12, isService: false },
  { hsnCode: '19059010', description: 'Bread (plain)',                           defaultGstRate: 0,  isService: false },
  { hsnCode: '19059020', description: 'Pastries / cakes',                        defaultGstRate: 18, isService: false },
  { hsnCode: '19059030', description: 'Waffles and wafers',                      defaultGstRate: 18, isService: false },
  { hsnCode: '17049090', description: 'Other sugar confectionery',               defaultGstRate: 18, isService: false },
  { hsnCode: '18069000', description: 'Chocolate / cocoa food preparations',    defaultGstRate: 18, isService: false },

  // ── FURNITURE (GST 18%) ────────────────────────────────────
  { hsnCode: '94011000', description: 'Seats (aircraft)',                        defaultGstRate: 18, isService: false },
  { hsnCode: '94013000', description: 'Swivel seats (adjustable height)',         defaultGstRate: 18, isService: false },
  { hsnCode: '94016100', description: 'Upholstered seats (wooden frame)',         defaultGstRate: 18, isService: false },
  { hsnCode: '94021000', description: 'Dental / medical chairs',                  defaultGstRate: 12, isService: false },
  { hsnCode: '94031000', description: 'Metal office furniture',                   defaultGstRate: 18, isService: false },
  { hsnCode: '94032000', description: 'Other metal furniture',                    defaultGstRate: 18, isService: false },
  { hsnCode: '94033000', description: 'Wooden office furniture',                  defaultGstRate: 18, isService: false },
  { hsnCode: '94034000', description: 'Wooden kitchen furniture',                 defaultGstRate: 18, isService: false },
  { hsnCode: '94035000', description: 'Wooden bedroom furniture',                 defaultGstRate: 18, isService: false },
  { hsnCode: '94036000', description: 'Other wooden furniture',                   defaultGstRate: 18, isService: false },

  // ── PAINT (GST 18%) ────────────────────────────────────────
  { hsnCode: '32081000', description: 'Paints (polyester-based)',               defaultGstRate: 18, isService: false },
  { hsnCode: '32082000', description: 'Paints (acrylic/vinyl polymer-based)',   defaultGstRate: 18, isService: false },
  { hsnCode: '32089010', description: 'Other paints / varnishes (non-aqueous)', defaultGstRate: 18, isService: false },
  { hsnCode: '32089090', description: 'Other varnishes and lacquers',           defaultGstRate: 18, isService: false },
  { hsnCode: '32091000', description: 'Acrylic / vinyl latex paints (aqueous)', defaultGstRate: 18, isService: false },
  { hsnCode: '32099000', description: 'Other water-based paints',               defaultGstRate: 18, isService: false },
  { hsnCode: '32100000', description: 'Other paints / varnishes / mastics',    defaultGstRate: 18, isService: false },
  { hsnCode: '32141000', description: 'Glaziers putty / sealants',              defaultGstRate: 18, isService: false },
  { hsnCode: '32151100', description: 'Black printing ink',                     defaultGstRate: 18, isService: false },
  { hsnCode: '32151900', description: 'Other printing ink',                     defaultGstRate: 18, isService: false },

  // ── OPTICAL (GST 12%) ──────────────────────────────────────
  { hsnCode: '90011000', description: 'Optical fibres / bundles / cables',     defaultGstRate: 12, isService: false },
  { hsnCode: '90013000', description: 'Contact lenses',                         defaultGstRate: 12, isService: false },
  { hsnCode: '90014000', description: 'Spectacle lenses (glass)',               defaultGstRate: 12, isService: false },
  { hsnCode: '90015000', description: 'Spectacle lenses (other material)',      defaultGstRate: 12, isService: false },
  { hsnCode: '90021900', description: 'Other objective lenses',                 defaultGstRate: 18, isService: false },
  { hsnCode: '90041000', description: 'Sunglasses',                             defaultGstRate: 18, isService: false },
  { hsnCode: '90049000', description: 'Other spectacles / goggles',             defaultGstRate: 12, isService: false },
  { hsnCode: '90051000', description: 'Binoculars',                             defaultGstRate: 12, isService: false },
  { hsnCode: '90069900', description: 'Other cameras',                          defaultGstRate: 18, isService: false },
  { hsnCode: '90139000', description: 'Other optical devices / instruments',   defaultGstRate: 12, isService: false },

  // ── STATIONERY (GST 12–18%) ────────────────────────────────
  { hsnCode: '48010000', description: 'Newsprint (rolls/sheets)',               defaultGstRate: 5,  isService: false },
  { hsnCode: '48021000', description: 'Paper for writing / printing',           defaultGstRate: 12, isService: false },
  { hsnCode: '48101300', description: 'Coated paper (multi-ply)',               defaultGstRate: 12, isService: false },
  { hsnCode: '48169000', description: 'Carbon paper / copying paper',           defaultGstRate: 12, isService: false },
  { hsnCode: '48201000', description: 'Registers / notebooks / diaries',        defaultGstRate: 12, isService: false },
  { hsnCode: '48211000', description: 'Paper labels (printed)',                  defaultGstRate: 12, isService: false },
  { hsnCode: '96081000', description: 'Ballpoint pens',                          defaultGstRate: 12, isService: false },
  { hsnCode: '96082000', description: 'Felt-tip / porous-point pens',           defaultGstRate: 12, isService: false },
  { hsnCode: '96089100', description: 'Pen nibs and nib points',                defaultGstRate: 12, isService: false },
  { hsnCode: '96100000', description: 'Slates / blackboards',                   defaultGstRate: 12, isService: false },

  // ── GIFT / DECOR (GST 12–18%) ──────────────────────────────
  { hsnCode: '83062100', description: 'Statuettes / ornaments (plated precious metal)', defaultGstRate: 12, isService: false },
  { hsnCode: '83062900', description: 'Other statuettes and ornaments',          defaultGstRate: 12, isService: false },
  { hsnCode: '83069000', description: 'Other decorative articles (base metal)', defaultGstRate: 12, isService: false },
  { hsnCode: '94051000', description: 'Chandeliers / ceiling lamps',             defaultGstRate: 12, isService: false },
  { hsnCode: '94052000', description: 'Bedside / desk / standard lamps',         defaultGstRate: 12, isService: false },
  { hsnCode: '94054000', description: 'Other electric lamps / lighting',         defaultGstRate: 12, isService: false },
  { hsnCode: '94059900', description: 'Other lighting fittings / parts',        defaultGstRate: 12, isService: false },
  { hsnCode: '63012000', description: 'Woollen blankets',                        defaultGstRate: 5,  isService: false },
  { hsnCode: '63041900', description: 'Other bedspreads',                        defaultGstRate: 5,  isService: false },
  { hsnCode: '57050090', description: 'Other carpets and rugs',                  defaultGstRate: 5,  isService: false },

  // ── KITCHENWARE (GST 12–18%) ───────────────────────────────
  { hsnCode: '73211110', description: 'Cooking stoves / ranges (gas)',          defaultGstRate: 18, isService: false },
  { hsnCode: '73239300', description: 'Stainless steel kitchen articles',        defaultGstRate: 18, isService: false },
  { hsnCode: '73239400', description: 'Iron / steel kitchen articles',          defaultGstRate: 18, isService: false },
  { hsnCode: '76151010', description: 'Aluminium pressure cookers',             defaultGstRate: 12, isService: false },
  { hsnCode: '76151090', description: 'Other aluminium kitchen articles',       defaultGstRate: 12, isService: false },
  { hsnCode: '39241010', description: 'Plastic tableware / kitchenware',        defaultGstRate: 18, isService: false },
  { hsnCode: '39249090', description: 'Other plastic household articles',       defaultGstRate: 18, isService: false },
  { hsnCode: '69111000', description: 'Porcelain / china tableware',            defaultGstRate: 12, isService: false },
  { hsnCode: '69120000', description: 'Ceramic tableware / kitchenware',        defaultGstRate: 12, isService: false },
  { hsnCode: '44199090', description: 'Other wooden household/kitchen articles',defaultGstRate: 12, isService: false },

  // ── TOYS (GST 12%) ─────────────────────────────────────────
  { hsnCode: '95021000', description: 'Dolls (representing human beings)',      defaultGstRate: 12, isService: false },
  { hsnCode: '95030010', description: 'Electric trains / accessories',          defaultGstRate: 12, isService: false },
  { hsnCode: '95030090', description: 'Other toy sets / models',                defaultGstRate: 12, isService: false },
  { hsnCode: '95042000', description: 'Billiards / billiard tables',            defaultGstRate: 28, isService: false },
  { hsnCode: '95043000', description: 'Games (coin / token operated)',          defaultGstRate: 28, isService: false },
  { hsnCode: '95044000', description: 'Playing cards',                           defaultGstRate: 12, isService: false },
  { hsnCode: '95045000', description: 'Video game consoles',                     defaultGstRate: 18, isService: false },
  { hsnCode: '95049090', description: 'Other games and amusements',             defaultGstRate: 18, isService: false },
  { hsnCode: '95051000', description: 'Christmas / festive articles',            defaultGstRate: 12, isService: false },
  { hsnCode: '95059090', description: 'Other festive / carnival articles',      defaultGstRate: 12, isService: false },

  // ── TEA / CAFÉ (GST 5–18%) ─────────────────────────────────
  { hsnCode: '09011100', description: 'Coffee (not roasted, not decaffeinated)',defaultGstRate: 0,  isService: false },
  { hsnCode: '09021000', description: 'Green tea (not fermented, ≤3kg packs)', defaultGstRate: 5,  isService: false },
  { hsnCode: '09022000', description: 'Other green tea (not fermented)',        defaultGstRate: 5,  isService: false },
  { hsnCode: '09023000', description: 'Black tea (fermented, ≤3kg packs)',      defaultGstRate: 5,  isService: false },
  { hsnCode: '09024000', description: 'Other black tea (fermented)',            defaultGstRate: 5,  isService: false },
  { hsnCode: '09030000', description: 'Maté',                                   defaultGstRate: 5,  isService: false },
  { hsnCode: '09041100', description: 'Pepper (dried, neither crushed nor ground)', defaultGstRate: 5, isService: false },
  { hsnCode: '09042200', description: 'Other pepper (crushed / ground)',        defaultGstRate: 5,  isService: false },
  { hsnCode: '21011200', description: 'Preparations with basis of tea / maté',defaultGstRate: 18, isService: false },
  { hsnCode: '21012010', description: 'Coffee machines / parts',               defaultGstRate: 18, isService: false },

  // ── BAGS (GST 18%) ─────────────────────────────────────────
  { hsnCode: '42021100', description: 'Trunks / suitcases (leather outer)',     defaultGstRate: 18, isService: false },
  { hsnCode: '42021200', description: 'Trunks / suitcases (plastic outer)',     defaultGstRate: 18, isService: false },
  { hsnCode: '42021900', description: 'Other trunks / suitcases',              defaultGstRate: 18, isService: false },
  { hsnCode: '42022100', description: 'Handbags (leather outer)',               defaultGstRate: 18, isService: false },
  { hsnCode: '42022200', description: 'Handbags (plastic outer)',               defaultGstRate: 18, isService: false },
  { hsnCode: '42022900', description: 'Other handbags',                         defaultGstRate: 18, isService: false },
  { hsnCode: '42023100', description: 'Wallets / purses (leather)',             defaultGstRate: 18, isService: false },
  { hsnCode: '42029200', description: 'Other travel bags (plastic/textile)',   defaultGstRate: 18, isService: false },
  { hsnCode: '42029900', description: 'Other travel bags / cases',             defaultGstRate: 18, isService: false },
  { hsnCode: '42031000', description: 'Leather garments / clothing',           defaultGstRate: 18, isService: false },

  // ── GENERAL / UNCLASSIFIED ─────────────────────────────────
  { hsnCode: '99990000', description: 'Unclassified goods',                    defaultGstRate: 18, isService: false },
  { hsnCode: '99989900', description: 'Other miscellaneous goods/services',    defaultGstRate: 18, isService: false },
];

async function main() {
  console.log(`Seeding ${HSN_CODES.length} HSN codes...`);

  const result = await prisma.hsnCode.createMany({
    data: HSN_CODES,
    skipDuplicates: true,
  });

  console.log(`Done — inserted ${result.count} new rows (duplicates skipped).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
