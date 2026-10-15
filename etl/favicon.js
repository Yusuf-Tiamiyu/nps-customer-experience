/* ============================================================================
   favicon.js: generate a 32x32 .ico from the same design as src/favicon.svg.

   Modern browsers use the SVG. The .ico exists because browsers still request
   /favicon.ico unprompted, and a 404 on every page load is untidy. Generating
   it here rather than checking in a binary keeps it in step with the SVG.

   Format: ICONDIR + ICONDIRENTRY + BITMAPINFOHEADER + BGRA pixels + AND mask.
   ========================================================================== */

const SIZE = 32;

// Same palette as src/favicon.svg and the dashboard's NPS split.
const NAVY      = [0x0A, 0x1F, 0x44];
const DETRACTOR = [0xd0, 0x3b, 0x3b];
const PASSIVE   = [0xb8, 0xb7, 0xb0];
const PROMOTER  = [0x4d, 0x94, 0xec];

// Bars at 32px, scaled from the 64px viewBox: x, y, width, height, colour.
const BARS = [
  [6, 17, 5,  9, DETRACTOR],
  [13, 13, 5, 13, PASSIVE],
  [20, 7,  5, 18, PROMOTER]
];

const CORNER = 5;   // rounded-corner radius, in pixels

function pixelAt(x, y) {
  // Corner rounding: clear the pixels outside the rounded square.
  for (const [cx, cy] of [[CORNER, CORNER], [SIZE - 1 - CORNER, CORNER],
                          [CORNER, SIZE - 1 - CORNER], [SIZE - 1 - CORNER, SIZE - 1 - CORNER]]) {
    const outsideX = (cx === CORNER) ? x < CORNER : x > SIZE - 1 - CORNER;
    const outsideY = (cy === CORNER) ? y < CORNER : y > SIZE - 1 - CORNER;
    if (outsideX && outsideY) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > CORNER * CORNER) return null;   // transparent
    }
  }
  for (const [bx, by, bw, bh, colour] of BARS) {
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) return colour;
  }
  return NAVY;
}

function buildIco() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const andMask = Buffer.alloc(SIZE * 4);          // 32 rows, 4 bytes each

  // ICO stores rows bottom-up.
  for (let row = 0; row < SIZE; row++) {
    const y = SIZE - 1 - row;
    for (let x = 0; x < SIZE; x++) {
      const c = pixelAt(x, y);
      const o = (row * SIZE + x) * 4;
      if (c === null) {
        pixels.writeUInt32LE(0, o);                            // fully transparent
        andMask[row * 4 + (x >> 3)] |= 0x80 >> (x & 7);        // and masked out
      } else {
        pixels[o] = c[2]; pixels[o + 1] = c[1]; pixels[o + 2] = c[0]; pixels[o + 3] = 0xFF;
      }
    }
  }

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);            // header size
  dib.writeInt32LE(SIZE, 4);           // width
  dib.writeInt32LE(SIZE * 2, 8);       // height: doubled, colour + mask
  dib.writeUInt16LE(1, 12);            // planes
  dib.writeUInt16LE(32, 14);           // bits per pixel
  dib.writeUInt32LE(0, 16);            // BI_RGB, uncompressed
  dib.writeUInt32LE(pixels.length + andMask.length, 20);

  const image = Buffer.concat([dib, pixels, andMask]);

  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);             // reserved
  dir.writeUInt16LE(1, 2);             // type 1 = icon
  dir.writeUInt16LE(1, 4);             // one image

  const entry = Buffer.alloc(16);
  entry[0] = SIZE; entry[1] = SIZE;    // width, height
  entry[2] = 0;                        // palette colours (0 = truecolour)
  entry[3] = 0;                        // reserved
  entry.writeUInt16LE(1, 4);           // planes
  entry.writeUInt16LE(32, 6);          // bits per pixel
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(dir.length + entry.length, 12);

  return Buffer.concat([dir, entry, image]);
}

module.exports = { buildIco };
