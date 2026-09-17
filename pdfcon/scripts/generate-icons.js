'use strict';

// Uwaga dot. kolejności require: icon-gen musi zostać załadowany PRZED sharp.
// Odwrotna kolejność powoduje konflikt natywnych bibliotek (libpng/zlib) między
// obiema paczkami i twardy crash procesu Node (munmap_chunk: invalid pointer).
const iconGen = require('icon-gen');
const sharp = require('sharp');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG_SOURCE = path.join(ROOT, 'assets', 'icon.svg');
const OUT_DIR = path.join(ROOT, 'build', 'icons');
const WIN_DIR = path.join(OUT_DIR, 'win');
const MAC_DIR = path.join(OUT_DIR, 'mac');
const PNG_DIR = path.join(OUT_DIR, 'png');

async function main() {
  fs.mkdirSync(WIN_DIR, { recursive: true });
  fs.mkdirSync(MAC_DIR, { recursive: true });
  fs.mkdirSync(PNG_DIR, { recursive: true });

  await iconGen(SVG_SOURCE, OUT_DIR, {
    report: false,
    ico: { name: 'win/icon' },
    icns: { name: 'mac/icon' }
  });

  const pngSizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  for (const size of pngSizes) {
    await sharp(SVG_SOURCE, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(path.join(PNG_DIR, `icon-${size}.png`));
  }

  console.log('Ikony wygenerowane w build/icons (win/icon.ico, mac/icon.icns, png/icon-*.png)');
}

main().catch((err) => {
  console.error('Nie udało się wygenerować ikon:', err);
  process.exit(1);
});
