/**
 * Generates textured background images for the puzzle captcha.
 * Run once: node scripts/generate-captcha-backgrounds.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../public/captcha-backgrounds');
const WIDTH = 340;
const HEIGHT = 190;

const SCENES = [
  { name: 'sky', top: [100, 160, 220], mid: [140, 190, 230], bot: [60, 120, 60] },
  { name: 'ocean', top: [135, 200, 235], mid: [40, 100, 160], bot: [20, 70, 120] },
  { name: 'sunset', top: [30, 20, 60], mid: [200, 100, 50], bot: [180, 140, 80] },
  { name: 'forest', top: [80, 140, 80], mid: [40, 90, 40], bot: [30, 60, 25] },
  { name: 'mountain', top: [160, 190, 220], mid: [100, 110, 130], bot: [60, 70, 50] },
];

async function generate() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { name, top, mid, bot } of SCENES) {
    const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
    for (let y = 0; y < HEIGHT; y++) {
      let r, g, b;
      const t = y / HEIGHT;
      if (t < 0.4) {
        const lt = t / 0.4;
        r = top[0] + (mid[0] - top[0]) * lt;
        g = top[1] + (mid[1] - top[1]) * lt;
        b = top[2] + (mid[2] - top[2]) * lt;
      } else {
        const lt = (t - 0.4) / 0.6;
        r = mid[0] + (bot[0] - mid[0]) * lt;
        g = mid[1] + (bot[1] - mid[1]) * lt;
        b = mid[2] + (bot[2] - mid[2]) * lt;
      }
      for (let x = 0; x < WIDTH; x++) {
        const noise = Math.floor(Math.random() * 30) - 15;
        const wave = Math.sin(x * 0.05 + y * 0.03) * 8;
        const offset = (y * WIDTH + x) * 3;
        pixels[offset] = Math.max(0, Math.min(255, Math.round(r + noise + wave)));
        pixels[offset + 1] = Math.max(0, Math.min(255, Math.round(g + noise + wave * 0.7)));
        pixels[offset + 2] = Math.max(0, Math.min(255, Math.round(b + noise + wave * 0.5)));
      }
    }
    await sharp(pixels, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
      .blur(0.8)
      .png()
      .toFile(path.join(OUT_DIR, `${name}.png`));
    console.log(`Generated ${name}.png`);
  }
  console.log('Done.');
}

generate().catch(console.error);
