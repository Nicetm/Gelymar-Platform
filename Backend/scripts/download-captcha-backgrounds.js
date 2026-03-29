/**
 * Downloads free landscape photos for captcha backgrounds.
 * Run once: node scripts/download-captcha-backgrounds.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT_DIR = path.join(__dirname, '../public/captcha-backgrounds');
const WIDTH = 340;
const HEIGHT = 190;

// Free-to-use image URLs (Picsum — Lorem Ipsum for photos)
const URLS = [
  'https://picsum.photos/seed/captcha1/800/450',
  'https://picsum.photos/seed/captcha2/800/450',
  'https://picsum.photos/seed/captcha3/800/450',
  'https://picsum.photos/seed/captcha4/800/450',
  'https://picsum.photos/seed/captcha5/800/450',
  'https://picsum.photos/seed/captcha6/800/450',
  'https://picsum.photos/seed/captcha7/800/450',
  'https://picsum.photos/seed/captcha8/800/450',
];

function download(url) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Remove old generated files
  for (const f of fs.readdirSync(OUT_DIR)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }

  for (let i = 0; i < URLS.length; i++) {
    try {
      console.log(`Downloading ${i + 1}/${URLS.length}...`);
      const buf = await download(URLS[i]);
      await sharp(buf)
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .png()
        .toFile(path.join(OUT_DIR, `bg${i + 1}.png`));
      console.log(`  Saved bg${i + 1}.png`);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }
  console.log('Done.');
}

main().catch(console.error);
