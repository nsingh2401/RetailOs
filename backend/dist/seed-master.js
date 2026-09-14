"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const prisma = new client_1.PrismaClient();
// ─────────────────────────────────────────────────
// SECTION 1 — app_config
// ─────────────────────────────────────────────────
async function seedAppConfig() {
    await prisma.appConfig.createMany({
        skipDuplicates: true,
        data: [
            { key: 'master_data_version', value: '1' },
            { key: 'gold_rate_inr_per_gram', value: '' },
            { key: 'gold_rate_last_fetched', value: '' },
            { key: 'gold_rate_source', value: 'metalpriceapi' },
        ],
    });
    console.log('✓ app_config seeded');
}
// ─────────────────────────────────────────────────
// SECTION 2 — master_industry_config
// ─────────────────────────────────────────────────
async function seedIndustryConfigs() {
    const configs = [
        // ── 1. GROCERY ──────────────────────────────
        {
            industryType: 'GROCERY',
            displayName: 'Grocery / Kirana',
            batchTrackingRequired: true,
            requiresBatchExpiry: true,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'WEIGHT', 'LOOSE', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'KG', 'GM', 'LTR', 'ML',
                'BOX', 'PACK', 'DOZEN'],
            variantAttributes: [
                { name: 'weight', label: 'Weight / Volume',
                    type: 'text', required: false,
                    placeholder: 'e.g. 1KG, 500ML' },
                { name: 'pack_type', label: 'Pack Type',
                    type: 'select', required: false,
                    options: ['Loose', 'Packet', 'Box',
                        'Bottle', 'Can', 'Pouch'] },
                { name: 'fssai_no', label: 'FSSAI License No',
                    type: 'text', required: false },
            ],
            specialFields: [
                { name: 'expiry_required',
                    label: 'Track Expiry Date',
                    type: 'boolean', required: false },
            ],
            dataVersion: 1,
        },
        // ── 2. PHARMACY ─────────────────────────────
        {
            industryType: 'PHARMACY',
            displayName: 'Pharmacy / Medical',
            batchTrackingRequired: true,
            requiresBatchExpiry: true,
            defaultPricingType: 'MRP',
            allowedPricingTypes: ['MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'BOX', 'BOTTLE',
                'STRIP', 'VIAL'],
            variantAttributes: [
                { name: 'strength', label: 'Strength / Dosage',
                    type: 'text', required: false,
                    placeholder: 'e.g. 500mg, 10mg' },
                { name: 'pack_size', label: 'Pack Size',
                    type: 'text', required: false,
                    placeholder: 'e.g. 10 tablets, 30ml' },
                { name: 'form', label: 'Form',
                    type: 'select', required: false,
                    options: ['Tablet', 'Capsule', 'Syrup',
                        'Injection', 'Cream', 'Ointment',
                        'Drops', 'Inhaler', 'Gel'] },
            ],
            specialFields: [
                { name: 'schedule_h',
                    label: 'Schedule H Drug',
                    type: 'boolean', required: false },
                { name: 'generic_name',
                    label: 'Generic / Salt Name',
                    type: 'text', required: false },
                { name: 'drug_license_no',
                    label: 'Drug License No',
                    type: 'text', required: false },
            ],
            dataVersion: 1,
        },
        // ── 3. APPAREL ──────────────────────────────
        {
            industryType: 'APPAREL',
            displayName: 'Apparel / Clothing',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'PAIR', 'SET', 'DOZEN'],
            variantAttributes: [
                { name: 'size', label: 'Size',
                    type: 'select', required: true,
                    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL',
                        '28', '30', '32', '34', '36', '38', '40', '42',
                        '0-3M', '3-6M', '6-12M',
                        '1-2Y', '2-3Y', '3-4Y'] },
                { name: 'color', label: 'Color',
                    type: 'text', required: true,
                    placeholder: 'e.g. Navy Blue, Red' },
                { name: 'fabric', label: 'Fabric',
                    type: 'select', required: false,
                    options: ['Cotton', 'Polyester', 'Silk', 'Linen',
                        'Wool', 'Denim', 'Georgette',
                        'Rayon', 'Nylon', 'Blended'] },
                { name: 'gender', label: 'Gender',
                    type: 'select', required: false,
                    options: ['Men', 'Women', 'Boys',
                        'Girls', 'Unisex', 'Infant'] },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 4. FOOTWEAR ─────────────────────────────
        {
            industryType: 'FOOTWEAR',
            displayName: 'Footwear',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PAIR',
            allowedUnits: ['PAIR', 'PCS'],
            variantAttributes: [
                { name: 'size', label: 'Size (UK/IN)',
                    type: 'select', required: true,
                    options: ['3', '4', '5', '6', '7', '8',
                        '9', '10', '11', '12',
                        '1K', '2K', '3K', '4K', '5K'] },
                { name: 'color', label: 'Color',
                    type: 'text', required: true,
                    placeholder: 'e.g. Black, Brown' },
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Leather', 'Synthetic', 'Canvas',
                        'Mesh', 'Rubber', 'PVC'] },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 5. OPTICAL ──────────────────────────────
        {
            industryType: 'OPTICAL',
            displayName: 'Optical Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'NEGOTIABLE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'PAIR', 'BOX'],
            variantAttributes: [
                { name: 'frame_type', label: 'Frame Type',
                    type: 'select', required: false,
                    options: ['Full Rim', 'Half Rim', 'Rimless'] },
                { name: 'frame_color', label: 'Frame Color',
                    type: 'text', required: false,
                    placeholder: 'e.g. Gold, Black Matte' },
                { name: 'frame_shape', label: 'Frame Shape',
                    type: 'select', required: false,
                    options: ['Rectangle', 'Round', 'Square',
                        'Oval', 'Wayfarer', 'Aviator',
                        'Cat Eye'] },
                { name: 'sphere_r', label: 'Sphere Right',
                    type: 'number', required: false,
                    placeholder: 'e.g. -2.50' },
                { name: 'sphere_l', label: 'Sphere Left',
                    type: 'number', required: false,
                    placeholder: 'e.g. -2.25' },
                { name: 'pd', label: 'Pupillary Distance',
                    type: 'number', required: false,
                    placeholder: 'e.g. 62' },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 6. BAKERY ───────────────────────────────
        {
            industryType: 'BAKERY',
            displayName: 'Bakery / Sweets',
            batchTrackingRequired: true,
            requiresBatchExpiry: true,
            defaultPricingType: 'WEIGHT',
            allowedPricingTypes: ['FIXED', 'WEIGHT', 'LOOSE'],
            defaultUnit: 'KG',
            allowedUnits: ['KG', 'GM', 'PCS', 'BOX', 'DOZEN'],
            variantAttributes: [
                { name: 'weight', label: 'Weight',
                    type: 'text', required: false,
                    placeholder: 'e.g. 500g, 1KG' },
                { name: 'flavour', label: 'Flavour / Variant',
                    type: 'text', required: false,
                    placeholder: 'e.g. Chocolate, Vanilla' },
            ],
            specialFields: [
                { name: 'made_today',
                    label: 'Made Fresh Daily',
                    type: 'boolean', required: false },
                { name: 'shelf_life_days',
                    label: 'Shelf Life (Days)',
                    type: 'number', required: false },
            ],
            dataVersion: 1,
        },
        // ── 7. HARDWARE ─────────────────────────────
        {
            industryType: 'HARDWARE',
            displayName: 'Hardware / Tools',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'WEIGHT', 'LOOSE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'KG', 'BOX', 'DOZEN',
                'PACK', 'MTR', 'SQFT'],
            variantAttributes: [
                { name: 'size', label: 'Size / Dimension',
                    type: 'text', required: false,
                    placeholder: 'e.g. M6x30, 4 inch' },
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Steel', 'Stainless Steel', 'Brass',
                        'Copper', 'Plastic', 'PVC',
                        'Iron', 'Aluminium'] },
                { name: 'weight_per_unit_gm', label: 'Weight per Unit (gm)',
                    type: 'number', required: false },
            ],
            specialFields: [
                { name: 'sold_by_weight',
                    label: 'Sold by Weight',
                    type: 'boolean', required: false },
            ],
            dataVersion: 1,
        },
        // ── 8. ELECTRONICS ──────────────────────────
        {
            industryType: 'ELECTRONICS',
            displayName: 'Electronics / Devices',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'MRP',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'BOX', 'SET'],
            variantAttributes: [
                { name: 'color', label: 'Color / Finish',
                    type: 'text', required: false,
                    placeholder: 'e.g. Midnight Black' },
                { name: 'storage', label: 'Storage / Capacity',
                    type: 'text', required: false,
                    placeholder: 'e.g. 128GB, 6L' },
                { name: 'warranty_months', label: 'Warranty (Months)',
                    type: 'number', required: false },
            ],
            specialFields: [
                { name: 'track_imei',
                    label: 'Track IMEI / Serial No',
                    type: 'boolean', required: false },
                { name: 'warranty_months',
                    label: 'Default Warranty (Months)',
                    type: 'number', required: false },
            ],
            dataVersion: 1,
        },
        // ── 9. ELECTRICAL ───────────────────────────
        {
            industryType: 'ELECTRICAL',
            displayName: 'Electrical / Wiring Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'WEIGHT', 'LOOSE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'MTR', 'BOX', 'ROLL',
                'PACK', 'SET', 'COIL'],
            variantAttributes: [
                { name: 'wire_gauge', label: 'Wire Gauge',
                    type: 'text', required: false,
                    placeholder: 'e.g. 1.5 sqmm, 2.5 sqmm' },
                { name: 'ampere', label: 'Ampere Rating',
                    type: 'text', required: false,
                    placeholder: 'e.g. 6A, 16A, 32A' },
                { name: 'voltage', label: 'Voltage',
                    type: 'select', required: false,
                    options: ['12V', '24V', '220V', '240V', '415V', '5V'] },
                { name: 'color', label: 'Wire Color',
                    type: 'text', required: false,
                    placeholder: 'e.g. Red, Black, Green' },
                { name: 'length_per_unit', label: 'Length per Unit',
                    type: 'text', required: false,
                    placeholder: 'e.g. per metre, 90m roll' },
            ],
            specialFields: [
                { name: 'sold_by_metre',
                    label: 'Sold by Metre',
                    type: 'boolean', required: false },
                { name: 'isi_certified',
                    label: 'ISI Certified',
                    type: 'boolean', required: false },
            ],
            dataVersion: 1,
        },
        // ── 10. JEWELRY ─────────────────────────────
        {
            industryType: 'JEWELRY',
            displayName: 'Jewelry Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'WEIGHT',
            allowedPricingTypes: ['WEIGHT', 'FIXED', 'NEGOTIABLE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'GM'],
            variantAttributes: [
                { name: 'metal', label: 'Metal',
                    type: 'select', required: true,
                    options: ['Gold', 'Silver', 'Platinum',
                        'White Gold', 'Rose Gold'] },
                { name: 'karat', label: 'Purity / Karat',
                    type: 'select', required: true,
                    options: ['24K', '22K', '18K', '14K',
                        '925 Silver', '999 Silver'] },
                { name: 'weight_gm',
                    label: 'Weight (grams)',
                    type: 'number', required: false,
                    placeholder: 'e.g. 5.2' },
                { name: 'making_charge_pct',
                    label: 'Making Charge %',
                    type: 'number', required: false,
                    placeholder: 'e.g. 12' },
                { name: 'making_charge_discount_pct',
                    label: 'Making Charge Discount %',
                    type: 'number', required: false,
                    placeholder: 'Festival or customer discount' },
                { name: 'stone',
                    label: 'Stone / Gemstone',
                    type: 'text', required: false,
                    placeholder: 'e.g. Diamond, Ruby, Emerald' },
                { name: 'hallmark_no',
                    label: 'Hallmark Certificate No',
                    type: 'text', required: false },
            ],
            specialFields: [
                { name: 'gold_rate_per_gram',
                    label: 'Gold Rate per Gram (₹)',
                    type: 'number', required: false },
            ],
            dataVersion: 1,
        },
        // ── 11. FURNITURE ───────────────────────────
        {
            industryType: 'FURNITURE',
            displayName: 'Furniture Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'NEGOTIABLE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'SET'],
            variantAttributes: [
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Teak Wood', 'Sheesham Wood', 'MDF',
                        'Plywood', 'Metal', 'Engineered Wood',
                        'Bamboo', 'Rattan'] },
                { name: 'finish', label: 'Finish',
                    type: 'select', required: false,
                    options: ['Polish', 'Paint', 'Lacquer', 'Wax',
                        'Natural', 'Laminate', 'Veneer'] },
                { name: 'dimensions', label: 'Dimensions',
                    type: 'text', required: false,
                    placeholder: 'e.g. 6x3 ft, 180x90x75 cm' },
                { name: 'color', label: 'Color / Shade',
                    type: 'text', required: false,
                    placeholder: 'e.g. Walnut Brown, White' },
            ],
            specialFields: [
                { name: 'assembly_required',
                    label: 'Assembly Required',
                    type: 'boolean', required: false },
                { name: 'custom_order',
                    label: 'Accept Custom Orders',
                    type: 'boolean', required: false },
            ],
            dataVersion: 1,
        },
        // ── 12. PAINT ───────────────────────────────
        {
            industryType: 'PAINT',
            displayName: 'Paint Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'WEIGHT'],
            defaultUnit: 'LTR',
            allowedUnits: ['LTR', 'KG', 'TIN', 'BOX'],
            variantAttributes: [
                { name: 'volume', label: 'Volume / Size',
                    type: 'select', required: false,
                    options: ['200ml', '500ml', '1 Ltr',
                        '4 Ltr', '10 Ltr', '20 Ltr'] },
                { name: 'color_code', label: 'Color Code',
                    type: 'text', required: false,
                    placeholder: 'e.g. RAL 3020, AP 1234' },
                { name: 'finish', label: 'Finish',
                    type: 'select', required: false,
                    options: ['Matte', 'Silk', 'Gloss',
                        'Semi-Gloss', 'Flat', 'Satin'] },
                { name: 'base', label: 'Base Type',
                    type: 'select', required: false,
                    options: ['Water-based', 'Oil-based',
                        'Solvent-based'] },
            ],
            specialFields: [
                { name: 'tintable',
                    label: 'Can Be Tinted / Custom Color',
                    type: 'boolean', required: false },
            ],
            dataVersion: 1,
        },
        // ── 13. STATIONERY ──────────────────────────
        {
            industryType: 'STATIONERY',
            displayName: 'Stationery / Books',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'MRP',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'BOX', 'DOZEN',
                'PACK', 'SET'],
            variantAttributes: [
                { name: 'color', label: 'Color',
                    type: 'text', required: false },
                { name: 'size', label: 'Size / Ruling',
                    type: 'select', required: false,
                    options: ['A4', 'A5', 'A3', 'Letter',
                        'Single Line', 'Double Line',
                        '4-Line', 'Square'] },
                { name: 'pages', label: 'Pages / Count',
                    type: 'text', required: false,
                    placeholder: 'e.g. 200 pages, 10 pack' },
            ],
            specialFields: [
                { name: 'isbn',
                    label: 'ISBN (for Books)',
                    type: 'text', required: false },
            ],
            dataVersion: 1,
        },
        // ── 14. DECOR (industryType = GIFT) ─────────
        {
            industryType: 'GIFT',
            displayName: 'Decor / Gift / Home',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP', 'NEGOTIABLE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'SET', 'PAIR', 'BOX'],
            variantAttributes: [
                { name: 'material', label: 'Material',
                    type: 'text', required: false,
                    placeholder: 'e.g. Ceramic, Wood, Resin' },
                { name: 'color', label: 'Color / Theme',
                    type: 'text', required: false,
                    placeholder: 'e.g. Gold, Terracotta' },
                { name: 'size', label: 'Size',
                    type: 'text', required: false,
                    placeholder: 'e.g. Small, Medium, Large' },
            ],
            specialFields: [
                { name: 'occasion',
                    label: 'Occasion / Theme',
                    type: 'text', required: false },
            ],
            dataVersion: 1,
        },
        // ── 15. KITCHENWARE ─────────────────────────
        {
            industryType: 'KITCHENWARE',
            displayName: 'Kitchenware',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'SET', 'DOZEN'],
            variantAttributes: [
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Stainless Steel', 'Aluminium',
                        'Copper', 'Cast Iron', 'Non-stick',
                        'Ceramic', 'Glass', 'Plastic'] },
                { name: 'capacity', label: 'Capacity / Size',
                    type: 'text', required: false,
                    placeholder: 'e.g. 3 Ltr, 28cm, 6 pcs set' },
                { name: 'color', label: 'Color',
                    type: 'text', required: false },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 16. TOYS ────────────────────────────────
        {
            industryType: 'TOYS',
            displayName: 'Toys / Games',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'MRP',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'SET', 'BOX'],
            variantAttributes: [
                { name: 'age_group', label: 'Age Group',
                    type: 'select', required: false,
                    options: ['0-1 yr', '1-3 yrs', '3-5 yrs',
                        '5-8 yrs', '8-12 yrs',
                        '12+ yrs', 'All ages'] },
                { name: 'color', label: 'Color',
                    type: 'text', required: false },
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Plastic', 'Wood', 'Fabric',
                        'Metal', 'Rubber', 'Electronic'] },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 17. TEA_CAFE ────────────────────────────
        {
            industryType: 'TEA_CAFE',
            displayName: 'Tea Store / Café',
            batchTrackingRequired: true,
            requiresBatchExpiry: true,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'WEIGHT'],
            defaultUnit: 'KG',
            allowedUnits: ['KG', 'GM', 'PCS', 'BOX', 'PACK'],
            variantAttributes: [
                { name: 'weight', label: 'Pack Weight',
                    type: 'text', required: false,
                    placeholder: 'e.g. 250g, 500g, 1KG' },
                { name: 'blend', label: 'Blend / Type',
                    type: 'select', required: false,
                    options: ['Assam', 'Darjeeling', 'Nilgiri',
                        'Green Tea', 'Herbal', 'Masala',
                        'CTC', 'Orthodox'] },
                { name: 'origin', label: 'Origin / Estate',
                    type: 'text', required: false,
                    placeholder: 'e.g. Darjeeling First Flush' },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 18. BAGS ────────────────────────────────
        {
            industryType: 'BAGS',
            displayName: 'Bags / Luggage',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'SET'],
            variantAttributes: [
                { name: 'size', label: 'Size',
                    type: 'select', required: false,
                    options: ['Small', 'Medium', 'Large',
                        'Extra Large', 'Cabin', 'Check-in'] },
                { name: 'material', label: 'Material',
                    type: 'select', required: false,
                    options: ['Leather', 'Faux Leather', 'Canvas',
                        'Nylon', 'Polyester', 'Jute', 'Fabric'] },
                { name: 'color', label: 'Color',
                    type: 'text', required: false,
                    placeholder: 'e.g. Black, Brown, Navy' },
            ],
            specialFields: [],
            dataVersion: 1,
        },
        // ── 19. GENERAL ─────────────────────────────
        {
            industryType: 'GENERAL',
            displayName: 'General Store',
            batchTrackingRequired: false,
            requiresBatchExpiry: false,
            defaultPricingType: 'FIXED',
            allowedPricingTypes: ['FIXED', 'MRP', 'WEIGHT',
                'LOOSE', 'NEGOTIABLE'],
            defaultUnit: 'PCS',
            allowedUnits: ['PCS', 'KG', 'GM', 'LTR', 'ML',
                'MTR', 'BOX', 'PAIR', 'DOZEN',
                'SQFT', 'PACK', 'SET', 'ROLL'],
            variantAttributes: [
                { name: 'variant', label: 'Variant / Type',
                    type: 'text', required: false },
            ],
            specialFields: [],
            dataVersion: 1,
        },
    ];
    for (const cfg of configs) {
        await prisma.masterIndustryConfig.upsert({
            where: { industryType: cfg.industryType },
            create: cfg,
            update: cfg,
        });
        console.log(`  ✓ ${cfg.industryType}`);
    }
    console.log('✓ master_industry_config seeded (19 rows)');
}
// ─────────────────────────────────────────────────
// SECTION 3 — master_categories
// ─────────────────────────────────────────────────
async function seedCategories() {
    // Helper: upsert root category, return id
    async function upsertRoot(industryType, name, sortOrder) {
        const existing = await prisma.masterCategory.findFirst({
            where: { industryType, name, parentId: null },
        });
        if (existing)
            return existing.id;
        const created = await prisma.masterCategory.create({
            data: { industryType, name, parentId: null, sortOrder },
        });
        return created.id;
    }
    // Helper: upsert sub-category
    async function upsertSub(industryType, name, parentId, sortOrder) {
        const existing = await prisma.masterCategory.findFirst({
            where: { industryType, name, parentId },
        });
        if (!existing) {
            await prisma.masterCategory.create({
                data: { industryType, name, parentId, sortOrder },
            });
        }
    }
    // helper to seed one industry
    async function seedIndustry(industryType, tree) {
        for (let i = 0; i < tree.length; i++) {
            const parentId = await upsertRoot(industryType, tree[i].root, i);
            for (let j = 0; j < tree[i].subs.length; j++) {
                await upsertSub(industryType, tree[i].subs[j], parentId, j);
            }
        }
        console.log(`  ✓ ${industryType}`);
    }
    // ── GROCERY ───────────────────────────────────
    await seedIndustry('GROCERY', [
        { root: 'Staples & Grains',
            subs: ['Rice', 'Wheat & Atta', 'Dal & Pulses',
                'Sugar & Salt', 'Oil & Ghee'] },
        { root: 'Snacks & Beverages',
            subs: ['Biscuits & Cookies', 'Chips & Namkeen',
                'Cold Drinks', 'Juices', 'Tea & Coffee'] },
        { root: 'Dairy & Eggs',
            subs: ['Milk', 'Butter & Cheese', 'Paneer',
                'Curd', 'Eggs'] },
        { root: 'Personal Care',
            subs: ['Soap', 'Shampoo', 'Toothpaste',
                'Detergent'] },
        { root: 'Household',
            subs: ['Cleaning Products', 'Kitchen Items',
                'Disposables'] },
    ]);
    // ── PHARMACY ──────────────────────────────────
    await seedIndustry('PHARMACY', [
        { root: 'Prescription Drugs',
            subs: ['Antibiotics', 'Antidiabetics',
                'Antihypertensives', 'Cardiac',
                'Neurological'] },
        { root: 'OTC Medicines',
            subs: ['Painkillers', 'Cold & Cough', 'Antacids',
                'Vitamins & Supplements', 'Eye Drops'] },
        { root: 'Surgical & Equipment',
            subs: ['Bandages & Dressings', 'Syringes',
                'Gloves', 'BP Monitors', 'Glucometers'] },
        { root: 'Baby Care',
            subs: ['Baby Food', 'Diapers',
                'Baby Oil', 'Gripe Water'] },
        { root: 'Cosmetics & Skin',
            subs: ['Sunscreen', 'Moisturizers',
                'Medicated Creams'] },
    ]);
    // ── APPAREL ───────────────────────────────────
    await seedIndustry('APPAREL', [
        { root: "Men's Wear",
            subs: ['T-Shirts', 'Shirts', 'Trousers', 'Jeans',
                'Kurtas', 'Jackets', 'Suits',
                'Ethnic Wear'] },
        { root: "Women's Wear",
            subs: ['Sarees', 'Salwar Suits', 'Kurtis', 'Tops',
                'Leggings', 'Dresses', 'Ethnic Wear',
                'Western'] },
        { root: 'Kids Wear',
            subs: ['Boys Clothing', 'Girls Clothing',
                'Infants', 'School Uniforms'] },
        { root: 'Accessories',
            subs: ['Belts', 'Ties', 'Scarves', 'Socks'] },
        { root: 'Innerwear & Nightwear',
            subs: ["Men's Innerwear", "Women's Innerwear",
                'Nightwear', 'Thermal'] },
    ]);
    // ── FOOTWEAR ──────────────────────────────────
    await seedIndustry('FOOTWEAR', [
        { root: "Men's Footwear",
            subs: ['Formal Shoes', 'Casual Shoes',
                'Sports Shoes', 'Sandals',
                'Slippers', 'Boots'] },
        { root: "Women's Footwear",
            subs: ['Heels', 'Flats', 'Sandals',
                'Sports Shoes', 'Slippers',
                'Boots', 'Mojaris'] },
        { root: "Kids Footwear",
            subs: ['School Shoes', 'Sports Shoes',
                'Sandals', 'Slippers'] },
    ]);
    // ── OPTICAL ───────────────────────────────────
    await seedIndustry('OPTICAL', [
        { root: 'Frames',
            subs: ['Full Rim', 'Half Rim', 'Rimless',
                'Kids Frames', 'Sports Frames'] },
        { root: 'Lenses',
            subs: ['Single Vision', 'Bifocal', 'Progressive',
                'Anti-Glare', 'Photochromic',
                'Contact Lenses'] },
        { root: 'Sunglasses',
            subs: ["Men's", "Women's", 'Kids',
                'Sports', 'Polarized'] },
        { root: 'Accessories',
            subs: ['Cases', 'Cleaners', 'Chains',
                'Repair Kits'] },
    ]);
    // ── BAKERY ────────────────────────────────────
    await seedIndustry('BAKERY', [
        { root: 'Breads',
            subs: ['White Bread', 'Brown Bread', 'Multigrain',
                'Pav', 'Buns', 'Croissants'] },
        { root: 'Cakes & Pastries',
            subs: ['Celebration Cakes', 'Pastries',
                'Cupcakes', 'Brownies', 'Mousse'] },
        { root: 'Biscuits & Cookies',
            subs: ['Cookies', 'Rusks',
                'Cream Biscuits', 'Crackers'] },
        { root: 'Indian Sweets',
            subs: ['Barfi', 'Ladoo', 'Halwa', 'Pedha',
                'Gulab Jamun', 'Rasgulla', 'Jalebi'] },
        { root: 'Savories',
            subs: ['Samosa', 'Kachori', 'Mathri',
                'Chakli', 'Namkeen'] },
    ]);
    // ── HARDWARE ──────────────────────────────────
    await seedIndustry('HARDWARE', [
        { root: 'Fasteners',
            subs: ['Nails', 'Screws', 'Bolts & Nuts',
                'Washers', 'Rivets', 'Anchors'] },
        { root: 'Hand Tools',
            subs: ['Hammers', 'Screwdrivers', 'Pliers',
                'Wrenches', 'Chisels', 'Saws'] },
        { root: 'Power Tools',
            subs: ['Drills', 'Grinders',
                'Sanders', 'Jig Saws'] },
        { root: 'Plumbing',
            subs: ['Pipes', 'Fittings', 'Valves',
                'Taps & Faucets', 'Sealants'] },
        { root: 'Locks & Safety',
            subs: ['Door Locks', 'Padlocks',
                'Hinges', 'Door Closers'] },
        { root: 'Adhesives & Sealants',
            subs: ['Fevicol', 'Araldite', 'Silicone',
                'M-Seal', 'Putty'] },
    ]);
    // ── ELECTRONICS ───────────────────────────────
    await seedIndustry('ELECTRONICS', [
        { root: 'Mobile & Tablets',
            subs: ['Smartphones', 'Feature Phones',
                'Tablets', 'Smartwatches',
                'TWS Earbuds'] },
        { root: 'Computers & Laptops',
            subs: ['Laptops', 'Desktops', 'Monitors',
                'Keyboards', 'Mouse'] },
        { root: 'TV & Audio',
            subs: ['Smart TVs', 'LED TVs', 'Soundbars',
                'Speakers', 'Headphones'] },
        { root: 'Kitchen Appliances',
            subs: ['Mixer Grinder', 'Microwave',
                'Induction', 'Refrigerator',
                'Washing Machine'] },
        { root: 'Accessories',
            subs: ['Chargers', 'Cables', 'Power Banks',
                'Cases & Covers', 'Screen Guards'] },
    ]);
    // ── ELECTRICAL ────────────────────────────────
    await seedIndustry('ELECTRICAL', [
        { root: 'Wires & Cables',
            subs: ['House Wiring Wire', 'Flexible Wire',
                'Co-axial Cable', 'LAN Cable',
                'Armoured Cable'] },
        { root: 'Switches & Sockets',
            subs: ['Modular Switches',
                'Traditional Switches',
                'Sockets & Outlets',
                'Fan Regulators', 'Dimmers'] },
        { root: 'Circuit Protection',
            subs: ['MCBs', 'RCCBs',
                'Distribution Boards',
                'Fuses', 'Surge Protectors'] },
        { root: 'Lighting',
            subs: ['LED Bulbs', 'Tube Lights', 'Battens',
                'Downlights', 'Strip Lights',
                'Emergency Lights'] },
        { root: 'Conduits & Accessories',
            subs: ['PVC Conduit', 'GI Conduit',
                'Conduit Fittings',
                'Junction Boxes', 'Cable Trays'] },
        { root: 'Fans',
            subs: ['Ceiling Fans', 'Table Fans',
                'Wall Fans', 'Exhaust Fans',
                'Pedestal Fans'] },
        { root: 'Plugs & Connectors',
            subs: ['Plugs', 'Extension Boards',
                'Multi-Plugs', 'Connectors'] },
    ]);
    // ── JEWELRY ───────────────────────────────────
    await seedIndustry('JEWELRY', [
        { root: 'Gold Jewelry',
            subs: ['Necklaces', 'Chains', 'Bangles',
                'Rings', 'Earrings', 'Anklets',
                'Pendants', 'Bracelets'] },
        { root: 'Silver Jewelry',
            subs: ['Necklaces', 'Bangles', 'Rings',
                'Anklets', 'Payal', 'Idols'] },
        { root: 'Diamond & Gemstone',
            subs: ['Diamond Rings', 'Diamond Necklaces',
                'Gemstone Jewelry', 'CZ Jewelry'] },
        { root: 'Artificial & Imitation',
            subs: ['Fashion Jewelry', 'Temple Jewelry',
                'Kundan', 'Meenakari', 'Oxidised'] },
        { root: 'Coins & Bullion',
            subs: ['Gold Coins', 'Silver Coins',
                'Gold Bars', 'Silver Bars'] },
    ]);
    // ── FURNITURE ─────────────────────────────────
    await seedIndustry('FURNITURE', [
        { root: 'Living Room',
            subs: ['Sofas', 'Coffee Tables', 'TV Units',
                'Bookshelves', 'Recliners'] },
        { root: 'Bedroom',
            subs: ['Beds', 'Wardrobes',
                'Dressing Tables', 'Nightstands'] },
        { root: 'Dining',
            subs: ['Dining Tables', 'Chairs',
                'Stools', 'Crockery Units'] },
        { root: 'Office Furniture',
            subs: ['Office Chairs', 'Desks',
                'File Cabinets', 'Conference Tables'] },
        { root: 'Kids Furniture',
            subs: ['Kids Beds', 'Study Tables',
                'Bunk Beds', 'Toy Chests'] },
    ]);
    // ── PAINT ─────────────────────────────────────
    await seedIndustry('PAINT', [
        { root: 'Interior Paints',
            subs: ['Emulsion', 'Distemper', 'Enamel',
                'Texture Paint', 'Primer'] },
        { root: 'Exterior Paints',
            subs: ['Exterior Emulsion', 'Weathershield',
                'Masonry Paint', 'Exterior Primer'] },
        { root: 'Wood & Metal Paints',
            subs: ['Wood Polish', 'Wood Stain',
                'Metal Paint', 'Rust Guard',
                'Lacquer'] },
        { root: 'Ancillaries',
            subs: ['Brushes', 'Rollers', 'Thinner',
                'Putty', 'Tape', 'Sandpaper'] },
    ]);
    // ── STATIONERY ────────────────────────────────
    await seedIndustry('STATIONERY', [
        { root: 'Writing Instruments',
            subs: ['Pens', 'Pencils', 'Markers',
                'Highlighters', 'Ink'] },
        { root: 'Paper Products',
            subs: ['Notebooks', 'Registers', 'A4 Paper',
                'Graph Books', 'Drawing Books'] },
        { root: 'School Supplies',
            subs: ['Geometry Boxes', 'Rulers', 'Erasers',
                'Sharpeners', 'Colour Pencils',
                'Crayons'] },
        { root: 'Books',
            subs: ['Textbooks', 'Reference Books',
                'Competition Books',
                'Children Books', 'Novels'] },
        { root: 'Office Supplies',
            subs: ['Files & Folders', 'Staplers',
                'Scissors', 'Tape',
                'Sticky Notes', 'Calculators'] },
    ]);
    // ── GIFT (Decor) ──────────────────────────────
    await seedIndustry('GIFT', [
        { root: 'Home Decor',
            subs: ['Wall Decor', 'Showpieces', 'Vases',
                'Clocks', 'Photo Frames',
                'Candles', 'Rugs'] },
        { root: 'Gifting',
            subs: ['Gift Sets', 'Gift Hampers',
                'Customized Gifts',
                'Festival Gifts',
                'Corporate Gifts'] },
        { root: 'Festive Decor',
            subs: ['Diwali Decor', 'Christmas Decor',
                'Holi Items', 'Pooja Items',
                'Rangoli'] },
        { root: 'Artificial Plants',
            subs: ['Artificial Flowers',
                'Artificial Plants', 'Garlands'] },
        { root: 'Kitchenware & Tableware',
            subs: ['Serving Trays', 'Dinner Sets',
                'Mugs', 'Jars', 'Coasters'] },
    ]);
    // ── KITCHENWARE ───────────────────────────────
    await seedIndustry('KITCHENWARE', [
        { root: 'Cookware',
            subs: ['Pressure Cookers', 'Kadai & Pans',
                'Tawa', 'Pots', 'Steamers'] },
        { root: 'Bakeware',
            subs: ['Baking Trays', 'Cake Moulds',
                'Mixing Bowls', 'Measuring Cups'] },
        { root: 'Storage & Containers',
            subs: ['Airtight Containers', 'Lunch Boxes',
                'Bottles & Jars',
                'Racks & Holders'] },
        { root: 'Serving & Dining',
            subs: ['Dinner Sets', 'Serving Bowls',
                'Trays', 'Cutlery Sets',
                'Mugs & Glasses'] },
    ]);
    // ── TOYS ──────────────────────────────────────
    await seedIndustry('TOYS', [
        { root: 'Educational Toys',
            subs: ['Puzzles', 'Building Blocks',
                'STEM Kits', 'Flash Cards',
                'Abacus'] },
        { root: 'Action & Play',
            subs: ['Action Figures', 'Dolls',
                'Cars & Vehicles', 'Soft Toys'] },
        { root: 'Outdoor & Sports',
            subs: ['Balls', 'Bats & Rackets',
                'Bicycles', 'Skates'] },
        { root: 'Board & Card Games',
            subs: ['Board Games', 'Card Games',
                'Chess', 'Carom'] },
    ]);
    // ── TEA_CAFE ──────────────────────────────────
    await seedIndustry('TEA_CAFE', [
        { root: 'Tea Varieties',
            subs: ['Assam Tea', 'Darjeeling Tea',
                'Green Tea', 'Herbal Tea',
                'Masala Tea', 'White Tea'] },
        { root: 'Packaged Tea',
            subs: ['Tea Bags', 'Loose Leaf',
                'Instant Tea', 'Flavoured Tea'] },
        { root: 'Coffee',
            subs: ['Filter Coffee', 'Instant Coffee',
                'Cold Brew', 'Espresso Beans'] },
        { root: 'Accessories',
            subs: ['Tea Strainers', 'Kettles',
                'Teapots', 'Mugs', 'Storage Tins'] },
    ]);
    // ── BAGS ──────────────────────────────────────
    await seedIndustry('BAGS', [
        { root: 'Handbags & Purses',
            subs: ['Handbags', 'Clutches', 'Wallets',
                'Sling Bags', 'Tote Bags'] },
        { root: 'Backpacks & Travel',
            subs: ['Backpacks', 'Trolley Bags',
                'Duffle Bags',
                'Travel Organizers'] },
        { root: 'Functional Bags',
            subs: ['Laptop Bags', 'School Bags',
                'Gym Bags', 'Office Bags'] },
    ]);
    // ── GENERAL ───────────────────────────────────
    await seedIndustry('GENERAL', [
        { root: 'General Items',
            subs: ['Miscellaneous', 'Other'] },
    ]);
    console.log('✓ master_categories seeded');
}
// ─────────────────────────────────────────────────
// SECTION 4 — master_brands
// ─────────────────────────────────────────────────
async function seedBrands() {
    const brands = [
        // Grocery & Food
        { name: 'Amul',
            industries: ['GROCERY', 'BAKERY', 'TEA_CAFE'] },
        { name: 'Nestlé',
            industries: ['GROCERY', 'BAKERY', 'TEA_CAFE'] },
        { name: 'Britannia',
            industries: ['GROCERY', 'BAKERY'] },
        { name: 'Haldiram',
            industries: ['GROCERY', 'BAKERY'] },
        { name: 'Tata',
            industries: ['GROCERY', 'TEA_CAFE',
                'ELECTRONICS'] },
        { name: 'ITC',
            industries: ['GROCERY'] },
        { name: 'HUL',
            industries: ['GROCERY', 'PHARMACY'] },
        { name: 'Patanjali',
            industries: ['GROCERY', 'PHARMACY'] },
        { name: 'Dabur',
            industries: ['GROCERY', 'PHARMACY'] },
        { name: 'Parle',
            industries: ['GROCERY', 'BAKERY'] },
        { name: 'MDH',
            industries: ['GROCERY'] },
        { name: 'Everest',
            industries: ['GROCERY'] },
        { name: 'Aashirvaad',
            industries: ['GROCERY'] },
        { name: 'Fortune',
            industries: ['GROCERY'] },
        { name: 'Bikaji',
            industries: ['GROCERY', 'BAKERY'] },
        { name: 'Himalaya',
            industries: ['PHARMACY', 'GROCERY'] },
        { name: 'Emami',
            industries: ['PHARMACY', 'GROCERY'] },
        // Pharmacy
        { name: 'Cipla',
            industries: ['PHARMACY'] },
        { name: 'Sun Pharma',
            industries: ['PHARMACY'] },
        { name: 'Abbott',
            industries: ['PHARMACY'] },
        { name: "Dr. Reddy's",
            industries: ['PHARMACY'] },
        { name: 'Lupin',
            industries: ['PHARMACY'] },
        { name: 'Mankind',
            industries: ['PHARMACY'] },
        { name: 'Zydus',
            industries: ['PHARMACY'] },
        { name: 'Alkem',
            industries: ['PHARMACY'] },
        // Apparel
        { name: "Levi's",
            industries: ['APPAREL'] },
        { name: 'Raymond',
            industries: ['APPAREL'] },
        { name: 'Arrow',
            industries: ['APPAREL'] },
        { name: 'Peter England',
            industries: ['APPAREL'] },
        { name: 'Van Heusen',
            industries: ['APPAREL'] },
        { name: 'Fabindia',
            industries: ['APPAREL', 'DECOR', 'BAGS'] },
        { name: 'Biba',
            industries: ['APPAREL'] },
        { name: 'W for Woman',
            industries: ['APPAREL'] },
        { name: 'Jockey',
            industries: ['APPAREL'] },
        { name: 'Rupa',
            industries: ['APPAREL'] },
        { name: 'Dollar',
            industries: ['APPAREL'] },
        // Apparel + Footwear
        { name: 'Nike',
            industries: ['APPAREL', 'FOOTWEAR', 'TOYS'] },
        { name: 'Adidas',
            industries: ['APPAREL', 'FOOTWEAR', 'TOYS'] },
        { name: 'Puma',
            industries: ['APPAREL', 'FOOTWEAR'] },
        // Footwear
        { name: 'Bata',
            industries: ['FOOTWEAR'] },
        { name: 'Relaxo',
            industries: ['FOOTWEAR'] },
        { name: 'Liberty',
            industries: ['FOOTWEAR'] },
        { name: 'Action',
            industries: ['FOOTWEAR'] },
        { name: 'Campus',
            industries: ['FOOTWEAR'] },
        { name: 'Woodland',
            industries: ['FOOTWEAR', 'BAGS'] },
        { name: 'Red Tape',
            industries: ['FOOTWEAR', 'BAGS'] },
        { name: 'Metro',
            industries: ['FOOTWEAR', 'BAGS'] },
        { name: 'Paragon',
            industries: ['FOOTWEAR'] },
        { name: 'VKC',
            industries: ['FOOTWEAR'] },
        // Optical
        { name: 'Ray-Ban',
            industries: ['OPTICAL'] },
        { name: 'Titan Eye+',
            industries: ['OPTICAL', 'JEWELRY'] },
        { name: 'Fastrack',
            industries: ['OPTICAL', 'BAGS'] },
        { name: 'Oakley',
            industries: ['OPTICAL'] },
        { name: 'Carrera',
            industries: ['OPTICAL'] },
        { name: 'Lenskart',
            industries: ['OPTICAL'] },
        // Bakery
        { name: 'Modern Bread',
            industries: ['BAKERY'] },
        { name: 'Monginis',
            industries: ['BAKERY'] },
        { name: 'Local / House Brand',
            industries: ['BAKERY', 'GROCERY',
                'GENERAL', 'KITCHENWARE'] },
        // Hardware
        { name: 'Stanley',
            industries: ['HARDWARE', 'ELECTRICAL'] },
        { name: 'Bosch',
            industries: ['HARDWARE', 'ELECTRICAL',
                'ELECTRONICS'] },
        { name: 'Dewalt',
            industries: ['HARDWARE'] },
        { name: 'Taparia',
            industries: ['HARDWARE'] },
        { name: 'Jhalani',
            industries: ['HARDWARE'] },
        { name: 'Astral',
            industries: ['HARDWARE'] },
        { name: 'Supreme',
            industries: ['HARDWARE'] },
        { name: 'Finolex Pipes',
            industries: ['HARDWARE'] },
        // Electronics
        { name: 'Samsung',
            industries: ['ELECTRONICS', 'ELECTRICAL'] },
        { name: 'Apple',
            industries: ['ELECTRONICS'] },
        { name: 'Xiaomi',
            industries: ['ELECTRONICS'] },
        { name: 'Realme',
            industries: ['ELECTRONICS'] },
        { name: 'OnePlus',
            industries: ['ELECTRONICS'] },
        { name: 'Vivo',
            industries: ['ELECTRONICS'] },
        { name: 'Oppo',
            industries: ['ELECTRONICS'] },
        { name: 'LG',
            industries: ['ELECTRONICS', 'ELECTRICAL'] },
        { name: 'Sony',
            industries: ['ELECTRONICS'] },
        { name: 'Philips',
            industries: ['ELECTRONICS', 'ELECTRICAL',
                'KITCHENWARE'] },
        { name: 'Panasonic',
            industries: ['ELECTRONICS'] },
        { name: 'Whirlpool',
            industries: ['ELECTRONICS'] },
        { name: 'IFB',
            industries: ['ELECTRONICS'] },
        { name: 'Bajaj',
            industries: ['ELECTRONICS', 'ELECTRICAL',
                'KITCHENWARE'] },
        // Electrical
        { name: 'Havells',
            industries: ['ELECTRICAL', 'ELECTRONICS'] },
        { name: 'Legrand',
            industries: ['ELECTRICAL'] },
        { name: 'Anchor',
            industries: ['ELECTRICAL'] },
        { name: 'Finolex',
            industries: ['ELECTRICAL'] },
        { name: 'Polycab',
            industries: ['ELECTRICAL'] },
        { name: 'Crompton',
            industries: ['ELECTRICAL', 'ELECTRONICS'] },
        { name: 'Wipro',
            industries: ['ELECTRICAL'] },
        { name: 'Orient',
            industries: ['ELECTRICAL', 'ELECTRONICS'] },
        { name: 'V-Guard',
            industries: ['ELECTRICAL'] },
        { name: 'GM Modular',
            industries: ['ELECTRICAL'] },
        { name: 'Schneider',
            industries: ['ELECTRICAL'] },
        { name: 'ABB',
            industries: ['ELECTRICAL'] },
        { name: 'Siemens',
            industries: ['ELECTRICAL'] },
        // Jewelry
        { name: 'Tanishq',
            industries: ['JEWELRY'] },
        { name: 'Malabar Gold',
            industries: ['JEWELRY'] },
        { name: 'Kalyan Jewellers',
            industries: ['JEWELRY'] },
        { name: 'PC Jeweller',
            industries: ['JEWELRY'] },
        { name: 'Senco',
            industries: ['JEWELRY'] },
        { name: 'Local Goldsmith',
            industries: ['JEWELRY'] },
        // Furniture
        { name: 'Godrej Interio',
            industries: ['FURNITURE'] },
        { name: 'Nilkamal',
            industries: ['FURNITURE', 'KITCHENWARE'] },
        { name: 'Durian',
            industries: ['FURNITURE'] },
        { name: 'Royaloak',
            industries: ['FURNITURE'] },
        { name: 'Zuari',
            industries: ['FURNITURE'] },
        // Paint
        { name: 'Asian Paints',
            industries: ['PAINT'] },
        { name: 'Berger',
            industries: ['PAINT'] },
        { name: 'Nerolac',
            industries: ['PAINT'] },
        { name: 'Dulux',
            industries: ['PAINT'] },
        { name: 'Jotun',
            industries: ['PAINT'] },
        { name: 'Indigo Paints',
            industries: ['PAINT'] },
        { name: 'Shalimar',
            industries: ['PAINT'] },
        // Stationery
        { name: 'Camlin',
            industries: ['STATIONERY'] },
        { name: 'Cello',
            industries: ['STATIONERY', 'KITCHENWARE'] },
        { name: 'Classmate',
            industries: ['STATIONERY'] },
        { name: 'Natraj',
            industries: ['STATIONERY'] },
        { name: 'Reynolds',
            industries: ['STATIONERY'] },
        { name: 'Faber-Castell',
            industries: ['STATIONERY', 'TOYS'] },
        { name: 'Luxor',
            industries: ['STATIONERY'] },
        { name: 'Staedtler',
            industries: ['STATIONERY'] },
        // Decor / Gift
        { name: 'Archies',
            industries: ['GIFT', 'STATIONERY'] },
        { name: 'Good Earth',
            industries: ['GIFT', 'KITCHENWARE'] },
        { name: 'Craftsvilla',
            industries: ['GIFT'] },
        { name: 'Noritake',
            industries: ['GIFT', 'KITCHENWARE'] },
        // Kitchenware
        { name: 'Prestige',
            industries: ['KITCHENWARE'] },
        { name: 'Hawkins',
            industries: ['KITCHENWARE'] },
        { name: 'Milton',
            industries: ['KITCHENWARE'] },
        { name: 'Pigeon',
            industries: ['KITCHENWARE'] },
        { name: 'Wonderchef',
            industries: ['KITCHENWARE'] },
        // Toys
        { name: 'Lego',
            industries: ['TOYS'] },
        { name: 'Hot Wheels',
            industries: ['TOYS'] },
        { name: 'Barbie',
            industries: ['TOYS'] },
        { name: 'Funskool',
            industries: ['TOYS'] },
        { name: 'Hamleys',
            industries: ['TOYS'] },
        // Tea
        { name: 'Tata Tea',
            industries: ['TEA_CAFE'] },
        { name: 'Brooke Bond',
            industries: ['TEA_CAFE', 'GROCERY'] },
        { name: 'Wagh Bakri',
            industries: ['TEA_CAFE', 'GROCERY'] },
        { name: 'Goodricke',
            industries: ['TEA_CAFE'] },
        { name: 'Makaibari',
            industries: ['TEA_CAFE'] },
        { name: 'Nescafé',
            industries: ['TEA_CAFE', 'GROCERY'] },
        { name: 'Bru',
            industries: ['TEA_CAFE', 'GROCERY'] },
        // Bags
        { name: 'VIP',
            industries: ['BAGS'] },
        { name: 'Samsonite',
            industries: ['BAGS'] },
        { name: 'American Tourister',
            industries: ['BAGS'] },
        { name: 'Skybags',
            industries: ['BAGS'] },
        { name: 'Wildcraft',
            industries: ['BAGS'] },
        { name: 'Caprese',
            industries: ['BAGS'] },
        { name: 'Hidesign',
            industries: ['BAGS'] },
    ];
    for (const brand of brands) {
        await prisma.masterBrand.upsert({
            where: { name: brand.name },
            create: {
                name: brand.name,
                industries: brand.industries,
                isPopular: true,
            },
            update: {
                industries: brand.industries,
                isPopular: true,
            },
        });
    }
    console.log(`✓ master_brands seeded`
        + ` (${brands.length} brands)`);
}
// ─────────────────────────────────────────────────
// SECTION 5 — Main
// ─────────────────────────────────────────────────
async function main() {
    console.log('🌱 Seeding master data...\n');
    await seedAppConfig();
    await seedIndustryConfigs();
    await seedCategories();
    await seedBrands();
    const [cfgCount, indCount, catCount, brandCount] = await Promise.all([
        prisma.appConfig.count(),
        prisma.masterIndustryConfig.count(),
        prisma.masterCategory.count(),
        prisma.masterBrand.count(),
    ]);
    console.log('\n── Summary ──────────────────────');
    console.log(`  app_config rows:    ${cfgCount}`);
    console.log(`  industry configs:   ${indCount}`);
    console.log(`  master categories:  ${catCount}`);
    console.log(`  master brands:      ${brandCount}`);
    console.log('──────────────────────────────────');
    console.log('✅ Master data seed complete.\n');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-master.js.map