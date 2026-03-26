/**
 * Rasterize vector app icons (same Brain + tile as in-app header) to PNGs for Expo.
 * Run: npm run generate:icons  (requires devDependency `sharp`)
 * EAS: eas-build-post-install runs this automatically after npm ci.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.error('[rasterize-app-icon] sharp is required. Run: npm install', e.message || e);
    process.exit(1);
  }

  const fullSvg = fs.readFileSync(path.join(assets, 'app-icon-brain.svg'), 'utf8');
  const adaptiveSvg = fs.readFileSync(
    path.join(assets, 'app-icon-brain-adaptive.svg'),
    'utf8'
  );

  await sharp(Buffer.from(fullSvg)).resize(1024, 1024).png().toFile(path.join(assets, 'icon.png'));

  await sharp(Buffer.from(adaptiveSvg))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'adaptive-icon.png'));

  await sharp(Buffer.from(fullSvg)).resize(1024, 1024).png().toFile(path.join(assets, 'splash-icon.png'));

  await sharp(Buffer.from(fullSvg)).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'));

  console.log('[rasterize-app-icon] Wrote icon.png, adaptive-icon.png, splash-icon.png, favicon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
