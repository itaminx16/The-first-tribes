import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'public', 'icons');

// Build CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function blendPixel(buf, idx, r, g, b, alpha) {
  if (alpha <= 0) return;
  const a = clamp01(alpha);
  const inv = 1 - a;
  buf[idx] = Math.round(buf[idx] * inv + r * a);
  buf[idx + 1] = Math.round(buf[idx + 1] * inv + g * a);
  buf[idx + 2] = Math.round(buf[idx + 2] * inv + b * a);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 1e-8) return Math.hypot(px - ax, py - ay);
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / lenSq);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function flameDistance(nx, ny, centerY, widthScale, heightScale, lean) {
  // Smooth teardrop SDF: round bulb at bottom tapering smoothly to a rounded-sharp tip
  const ly = (ny - centerY) / heightScale; // top ~ -0.95, center ~ 0, bottom ~ +0.8
  const yTop = -0.92;
  const yBot = 0.76;
  const u = clamp01((yBot - ly) / (yBot - yTop)); // 0 at base, 1 at tip

  // Lean only in upper section
  const curveLean = lean * Math.sin(u * Math.PI) * u;
  const dx = nx - curveLean;

  // Smooth teardrop half-width: sqrt(u) at bottom gives circular base, (1-u)^0.85 tapers smoothly to 0 at tip
  const teardrop = Math.sin(Math.pow(u, 0.52) * Math.PI * 0.5) * Math.pow(1 - u, 0.78) * 1.48;
  const halfW = widthScale * teardrop;

  if (ly < yTop) {
    return Math.hypot(dx, (yTop - ly) * heightScale);
  }
  if (ly > yBot) {
    return Math.hypot(dx, (ly - yBot) * heightScale);
  }
  return Math.abs(dx) - halfW;
}

function renderIcon(size, maskable) {
  const rgba = new Uint8Array(size * size * 4);
  const emblemScale = maskable ? 0.68 : 0.88;
  const aa = 2.6 / size;

  const sparks = [
    { x: -0.22, y: -0.44, r: 0.032, a: 0.92 },
    { x: 0.25, y: -0.38, r: 0.028, a: 0.88 },
    { x: -0.1, y: -0.58, r: 0.022, a: 0.78 },
    { x: 0.14, y: -0.56, r: 0.026, a: 0.85 },
    { x: 0.02, y: -0.66, r: 0.019, a: 0.7 },
    { x: -0.32, y: -0.22, r: 0.02, a: 0.65 },
    { x: 0.34, y: -0.18, r: 0.02, a: 0.65 }
  ];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;

      // Normalized square coordinates [-1, 1]
      const ux = ((px + 0.5) / size) * 2 - 1;
      const uy = ((py + 0.5) / size) * 2 - 1;

      // Rounded square clip when non-maskable (standard icon), full bleed when maskable
      let bgAlpha = 1;
      if (!maskable) {
        const cornerRadius = 0.22;
        const limit = 1 - cornerRadius;
        const qx = Math.max(Math.abs(ux) - limit, 0);
        const qy = Math.max(Math.abs(uy) - limit, 0);
        const roundDist = Math.hypot(qx, qy) - cornerRadius;
        bgAlpha = 1 - smoothstep(-aa, aa, roundDist);
      }

      // 1. Warm dark-ember radial background (#2e1b0f center -> #110a06 edge)
      const bgR = Math.hypot(ux, uy * 0.95);
      const radialT = clamp01(bgR / 1.18);
      let r = 46 + (17 - 46) * radialT;
      let g = 27 + (10 - 27) * radialT;
      let b = 15 + (6 - 15) * radialT;

      // Subtle warm firelight halo near center
      const fireHalo = Math.exp(-Math.pow(bgR / 0.55, 2));
      r = Math.min(255, r + fireHalo * 44);
      g = Math.min(255, g + fireHalo * 18);
      b = Math.min(255, b + fireHalo * 4);

      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(g);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = Math.round(bgAlpha * 255);

      if (bgAlpha <= 0.002) continue;

      // Coordinates scaled into emblem space
      const ex = ux / emblemScale;
      const ey = uy / emblemScale;
      const eDist = Math.hypot(ex, ey);
      const eAA = aa / emblemScale;

      // 2. Tribal shield circular emblem disc & golden-bronze ring
      if (eDist < 0.96) {
        const innerFill = 1 - smoothstep(0.84 - eAA, 0.84 + eAA, eDist);
        if (innerFill > 0) {
          // Deep warm hearth interior
          const hearthGlow = Math.exp(-Math.pow(Math.hypot(ex, ey - 0.05) / 0.56, 2));
          blendPixel(
            rgba,
            idx,
            34 + hearthGlow * 64,
            20 + hearthGlow * 26,
            12 + hearthGlow * 6,
            innerFill * 0.95
          );
        }

        // Golden-bronze outer shield ring (#d99b52 -> #fde68a highlight)
        const ringBand = Math.abs(eDist - 0.87) - 0.048;
        const ringAlpha = 1 - smoothstep(-eAA, eAA, ringBand);
        if (ringAlpha > 0) {
          const highlight = clamp01(0.5 - ey * 0.45 - ex * 0.25);
          const rr = 195 + highlight * 58;
          const rg = 135 + highlight * 90;
          const rb = 66 + highlight * 68;
          blendPixel(rgba, idx, rr, rg, rb, ringAlpha);
        }

        // Subtle inner rim accent
        const innerRim = Math.abs(eDist - 0.8) - 0.012;
        const innerRimAlpha = 1 - smoothstep(-eAA, eAA, innerRim);
        blendPixel(rgba, idx, 253, 230, 138, innerRimAlpha * 0.48);

        // Decorative tribal notch ticks around shield ring (8 compass points)
        const angle = Math.atan2(ey, ex);
        const tickPhase = Math.abs(Math.sin(angle * 4));
        if (tickPhase > 0.985 && eDist > 0.82 && eDist < 0.92) {
          blendPixel(rgba, idx, 254, 243, 199, 0.72);
        }
      }

      // 3. Crossed dark-wood campfire logs at bottom
      const log1Dist = distToSegment(ex, ey, -0.44, 0.44, 0.44, 0.26) - 0.072;
      const log2Dist = distToSegment(ex, ey, -0.44, 0.26, 0.44, 0.44) - 0.072;
      const log1Alpha = 1 - smoothstep(-eAA, eAA, log1Dist);
      const log2Alpha = 1 - smoothstep(-eAA, eAA, log2Dist);

      if (log1Alpha > 0) {
        const barkShade = clamp01(0.5 + (0.35 - ey) * 4);
        blendPixel(rgba, idx, 64 + barkShade * 32, 36 + barkShade * 18, 20 + barkShade * 10, log1Alpha);
      }
      if (log2Alpha > 0) {
        const barkShade = clamp01(0.5 + (0.35 - ey) * 4);
        blendPixel(rgba, idx, 82 + barkShade * 36, 46 + barkShade * 20, 24 + barkShade * 12, log2Alpha);
        // Ember glow at log crossing center
        const centerEmber = Math.exp(-Math.pow(Math.hypot(ex, ey - 0.34) / 0.18, 2));
        blendPixel(rgba, idx, 249, 115, 22, log2Alpha * centerEmber * 0.75);
      }

      // 4. Layered glowing campfire flame
      // Outer flame (#ea580c)
      const fOuter1 = flameDistance(ex, ey, 0.0, 0.39, 0.5, 0.05);
      const fOuter2 = flameDistance(ex + 0.16, ey - 0.05, 0.04, 0.17, 0.34, -0.07);
      const fOuter3 = flameDistance(ex - 0.17, ey - 0.07, 0.05, 0.16, 0.32, 0.07);
      const outerD = Math.min(fOuter1, Math.min(fOuter2, fOuter3));
      const outerAlpha = 1 - smoothstep(-eAA, eAA, outerD);
      if (outerAlpha > 0) {
        blendPixel(rgba, idx, 234, 88, 12, outerAlpha);
      }

      // Mid flame (#f59e0b)
      const fMid = flameDistance(ex, ey - 0.02, 0.03, 0.27, 0.39, 0.03);
      const midAlpha = 1 - smoothstep(-eAA, eAA, fMid);
      if (midAlpha > 0) {
        blendPixel(rgba, idx, 245, 158, 11, midAlpha);
      }

      // Core flame (#fef08a)
      const fCore = flameDistance(ex, ey - 0.04, 0.06, 0.15, 0.26, -0.01);
      const coreAlpha = 1 - smoothstep(-eAA, eAA, fCore);
      if (coreAlpha > 0) {
        blendPixel(rgba, idx, 254, 240, 138, coreAlpha);
      }

      // 5. Rising sparks
      for (const s of sparks) {
        const sd = Math.hypot(ex - s.x, ey - s.y) - s.r;
        const sa = 1 - smoothstep(-eAA, eAA, sd);
        if (sa > 0) {
          blendPixel(rgba, idx, 253, 224, 71, sa * s.a);
        }
      }
    }
  }

  return encodePng(size, size, rgba);
}

fs.mkdirSync(outDir, { recursive: true });

const specs = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true }
];

for (const spec of specs) {
  const target = path.join(outDir, spec.file);
  const png = renderIcon(spec.size, spec.maskable);
  fs.writeFileSync(target, png);
  console.log(`Generated ${spec.file} (${spec.size}x${spec.size}, ${png.length} bytes)`);
}
