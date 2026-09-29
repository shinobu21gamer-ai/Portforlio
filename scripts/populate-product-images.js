/* Populate product images for seeded products.
 * Generates a branded SVG image per product (category gradient + emoji + name)
 * into uploads/products/<slug>.svg and sets Product.image to its /uploads path.
 * Only fills products whose image is currently null/empty. Idempotent.
 */
const path = require('path');
const fs = require('fs');
const { Product } = require('../src/models');

const CATEGORY_STYLE = {
  beverages:          { from: '#6366f1', to: '#4338ca', emoji: '🥤' },
  snacks:             { from: '#f59e0b', to: '#d97706', emoji: '🍿' },
  dairy:              { from: '#0ea5e9', to: '#0284c7', emoji: '🥛' },
  'bread-bakery':     { from: '#f97316', to: '#ea580c', emoji: '🍞' },
  'meat-seafood':     { from: '#ef4444', to: '#dc2626', emoji: '🍖' },
  'fruits-vegetables':{ from: '#22c55e', to: '#16a34a', emoji: '🥬' },
  'rice-grains':      { from: '#eab308', to: '#ca8a04', emoji: '🍚' },
  'canned-goods':     { from: '#94a3b8', to: '#64748b', emoji: '🥫' },
  'condiments-sauces':{ from: '#f43f5e', to: '#e11d48', emoji: '🍶' },
  'frozen-foods':     { from: '#06b6d4', to: '#0891b2', emoji: '🧊' },
  'personal-care':    { from: '#ec4899', to: '#db2777', emoji: '🧴' },
  household:          { from: '#14b8a6', to: '#0d9488', emoji: '🧽' },
  'baby-care':        { from: '#8b5cf6', to: '#7c3aed', emoji: '🍼' },
  'pet-supplies':     { from: '#84cc16', to: '#65a30d', emoji: '🐾' },
  stationery:         { from: '#a855f7', to: '#9333ea', emoji: '📚' },
};
const CATEGORY_DEFAULT = { from: '#64748b', to: '#475569', emoji: '📦' };

// Per-product emoji overrides make the tiles read as real product photos.
const PRODUCT_EMOJI = {
  'coca-cola-15l': '🥤', 'pepsi-500ml': '🥤', 'lipton-iced-tea-1l': '🍋',
  'summit-water-500ml': '💧', 'lays-classic': '🍟', 'oishi-prawn': '🍤',
  'clorets-gum': '🍬', 'nestle-fresh-milk': '🥛', 'magnolia-icecream': '🍨',
  'gardenia-bread': '🍞', 'royal-pasta': '🍝', 'datu-puti-vinegar': '🧂',
  'silver-swan-soy': '🍶', 'century-tuna': '🥫', 'lucky-me-canton': '🍜',
  'dove-shampoo': '🧴', 'pride-dishwash': '🧼', 'bear-brand': '🥛',
  'jasmine-rice-5kg': '🍚', 'c2-green-tea': '🍵',
};

const xmlEscape = (str) => String(str || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function makeSvg(product) {
  const slug = product.slug;
  const catSlug = product.category?.slug || product.categorySlug || '';
  const style = CATEGORY_STYLE[catSlug] || CATEGORY_DEFAULT;
  const emoji = PRODUCT_EMOJI[slug] || style.emoji;
  const name = String(product.name || 'Product').trim();
  const shortName = name.length > 24 ? name.slice(0, 22).trim() + '…' : name;
  const brand = (product.brand || '').trim();
  const line2 = [brand, catSlug].filter(Boolean).map(x => xmlEscape(x)).join(' • ') || xmlEscape(name);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${style.from}"/>
      <stop offset="1" stop-color="${style.to}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="70" cy="70" r="150" fill="#ffffff" opacity="0.07"/>
  <circle cx="560" cy="540" r="190" fill="#ffffff" opacity="0.08"/>
  <circle cx="540" cy="80" r="80" fill="#ffffff" opacity="0.10"/>
  <circle cx="90" cy="520" r="90" fill="#000000" opacity="0.05"/>
  <text x="300" y="340" font-size="210" text-anchor="middle">${emoji}</text>
  <g>
    <rect x="40" y="430" width="520" height="114" rx="22" fill="#ffffff" opacity="0.96"/>
    <rect x="40" y="430" width="6" height="114" rx="3" fill="${style.from}"/>
    <text x="66" y="482" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#1f2937">${xmlEscape(shortName)}</text>
    <text x="66" y="518" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="500" fill="#6b7280">${line2}</text>
  </g>
</svg>
`;
}

async function main() {
  await require('../src/config/database').connectDB();
  const outDir = path.resolve(__dirname, '..', 'uploads', 'products');
  fs.mkdirSync(outDir, { recursive: true });

  const products = await Product.findAll({
    attributes: ['id', 'slug', 'name', 'brand', 'image', 'categoryId'],
    include: [{ association: 'category', attributes: ['slug'] }],
  });

  let updated = 0;
  let skipped = 0;
  for (const p of products) {
    if (p.image) { skipped += 1; continue; }
    const slug = p.slug || `product-${p.id}`;
    const fileName = `${slug}.svg`;
    const target = path.join(outDir, fileName);
    fs.writeFileSync(target, makeSvg(p), 'utf8');
    p.image = `/uploads/products/${fileName}`;
    await p.save();
    updated += 1;
    console.log(`+ ${p.name} -> ${p.image}`);
  }
  console.log(`\nDone. Updated ${updated}, skipped ${skipped} (already have images).`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });