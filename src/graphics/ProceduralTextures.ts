import Phaser from 'phaser';
import { LifeStage, VillagerAppearanceId } from '../types/game';
import { generateExpandedTextures } from './ExpandedTextures';

const OUTLINE = '#2b1e14';

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): void {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  tex.refresh();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawLeafBlade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lean: number,
  height: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - height * 0.55, x + lean, y - height);
  ctx.stroke();
}

export function generateProceduralTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('grass-spring-0')) {
    return;
  }

  createTerrainTextures(scene);
  createWeatherParticleTextures(scene);
  createCampfireAndParticleTextures(scene);
  createStorageTextures(scene);
  createTreeTextures(scene);
  createRockTextures(scene);
  createBushTextures(scene);
  createLakeAndDepletedTextures(scene);
  createHutTextures(scene);
  createTribeBuildingTextures(scene);
  createAnimalTextures(scene);
  createVillagerTextures(scene);
  createToolsAndCarryTextures(scene);
  createUiAndRingTextures(scene);
  generateExpandedTextures(scene);
}

function createTerrainTextures(scene: Phaser.Scene): void {
  const size = 256;

  const seasonGroundSpecs = [
    {
      key: 'spring',
      base: '#5cb846',
      blobLight: 'rgba(126, 214, 90, 0.36)',
      blobDark: 'rgba(68, 148, 46, 0.28)',
      blade: 'rgba(54, 128, 38, 0.5)'
    },
    {
      key: 'summer',
      base: '#65ad49',
      blobLight: 'rgba(134, 206, 92, 0.34)',
      blobDark: 'rgba(84, 152, 58, 0.28)',
      blade: 'rgba(66, 128, 42, 0.48)'
    },
    {
      key: 'autumn',
      base: '#b3933f',
      blobLight: 'rgba(216, 174, 78, 0.36)',
      blobDark: 'rgba(148, 108, 42, 0.28)',
      blade: 'rgba(126, 88, 28, 0.5)'
    },
    {
      key: 'winter',
      base: '#e2effa',
      blobLight: 'rgba(255, 255, 255, 0.34)',
      blobDark: 'rgba(184, 212, 236, 0.26)',
      blade: 'rgba(156, 188, 216, 0.45)'
    }
  ];

  for (const sp of seasonGroundSpecs) {
    for (let variant = 0; variant < 2; variant++) {
      makeCanvas(scene, `grass-${sp.key}-${variant}`, size, size, (ctx) => {
        ctx.fillStyle = sp.base;
        ctx.fillRect(0, 0, size, size);

        const blobs =
          variant === 0
            ? [
                { x: 82, y: 78, r: 58, col: sp.blobLight },
                { x: 178, y: 112, r: 54, col: sp.blobDark },
                { x: 118, y: 186, r: 56, col: sp.blobLight },
                { x: 182, y: 194, r: 46, col: sp.blobDark }
              ]
            : [
                { x: 172, y: 78, r: 56, col: sp.blobLight },
                { x: 86, y: 122, r: 54, col: sp.blobDark },
                { x: 162, y: 184, r: 54, col: sp.blobLight },
                { x: 88, y: 192, r: 46, col: sp.blobDark }
              ];

        for (const b of blobs) {
          const grad = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.r);
          grad.addColorStop(0, b.col);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 42; i++) {
          const sx = ((i * 53 + variant * 29) % (size - 24)) + 12;
          const sy = ((i * 89 + variant * 41) % (size - 24)) + 14;
          if (i % 3 === 0) {
            ctx.fillStyle = sp.blobDark;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 4, 2.2, (i % 5) * 0.4, 0, Math.PI * 2);
            ctx.fill();
          } else if (sp.key !== 'winter') {
            const lean = (i % 2 === 0 ? -1 : 1) * (2 + (i % 3));
            drawLeafBlade(ctx, sx, sy, lean, 6 + (i % 4), sp.blade);
          }
        }
      });
    }
  }

  // Tuft decal
  makeCanvas(scene, 'decal-tuft', 48, 36, (ctx) => {
    const cx = 24;
    const cy = 28;
    ctx.fillStyle = 'rgba(54, 108, 34, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    drawLeafBlade(ctx, cx - 5, cy, -8, 12, '#3d822a');
    drawLeafBlade(ctx, cx - 2, cy, -3, 16, '#4b9e34');
    drawLeafBlade(ctx, cx + 1, cy, 2, 18, '#58b33e');
    drawLeafBlade(ctx, cx + 5, cy, 8, 13, '#44912e');
  });

  // Flower decals
  const flowerPalettes = [
    { petal: '#fff8d6', center: '#f59e0b' },
    { petal: '#ffd6e7', center: '#fb7185' }
  ];
  flowerPalettes.forEach((pal, idx) => {
    makeCanvas(scene, `decal-flower-${idx}`, 48, 48, (ctx) => {
      const flowers = [
        { x: 18, y: 24, r: 4.5 },
        { x: 31, y: 18, r: 3.8 },
        { x: 28, y: 31, r: 3.4 }
      ];
      for (const f of flowers) {
        drawLeafBlade(ctx, f.x, f.y + 8, -2, 9, '#3d822a');
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.fillStyle = pal.petal;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * (f.r * 0.65), f.y + Math.sin(a) * (f.r * 0.65), f.r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = pal.center;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  // Pebbles decal
  makeCanvas(scene, 'decal-pebbles', 44, 32, (ctx) => {
    const stones = [
      { x: 14, y: 18, rx: 6, ry: 4, col: '#8d96a0' },
      { x: 25, y: 14, rx: 4.5, ry: 3, col: '#a0a8b0' },
      { x: 29, y: 21, rx: 5, ry: 3.2, col: '#78808a' }
    ];
    for (const s of stones) {
      ctx.fillStyle = 'rgba(30, 50, 20, 0.24)';
      ctx.beginPath();
      ctx.ellipse(s.x + 1, s.y + 2, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = s.col;
      ctx.strokeStyle = '#474c54';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(s.x - 1.5, s.y - 1, s.rx * 0.4, s.ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Soft trampled dirt trail patch
  makeCanvas(scene, 'decal-dirt-path', 96, 64, (ctx) => {
    const grad = ctx.createRadialGradient(48, 32, 8, 48, 32, 46);
    grad.addColorStop(0, 'rgba(158, 122, 74, 0.65)');
    grad.addColorStop(0.6, 'rgba(158, 122, 74, 0.35)');
    grad.addColorStop(1, 'rgba(158, 122, 74, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(48, 32, 46, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Drifting soft cloud shadow
  makeCanvas(scene, 'cloud-shadow', 512, 320, (ctx) => {
    const puffs = [
      { x: 180, y: 170, r: 115 },
      { x: 270, y: 145, r: 135 },
      { x: 350, y: 175, r: 105 },
      { x: 240, y: 195, r: 100 }
    ];
    for (const p of puffs) {
      const grad = ctx.createRadialGradient(p.x, p.y, 18, p.x, p.y, p.r);
      grad.addColorStop(0, 'rgba(18, 36, 18, 0.9)');
      grad.addColorStop(0.55, 'rgba(18, 36, 18, 0.45)');
      grad.addColorStop(1, 'rgba(18, 36, 18, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createWeatherParticleTextures(scene: Phaser.Scene): void {
  // Spring rain streak
  makeCanvas(scene, 'particle-rain', 6, 18, (ctx) => {
    const g = ctx.createLinearGradient(4, 1, 1, 17);
    g.addColorStop(0, 'rgba(186, 230, 253, 0)');
    g.addColorStop(0.5, 'rgba(186, 230, 253, 0.72)');
    g.addColorStop(1, 'rgba(224, 242, 254, 0.92)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4.5, 1);
    ctx.lineTo(1.5, 17);
    ctx.stroke();
  });

  // Winter snowflake
  makeCanvas(scene, 'particle-snow', 10, 10, (ctx) => {
    const g = ctx.createRadialGradient(5, 5, 1, 5, 5, 4.8);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, 'rgba(224, 242, 254, 0.85)');
    g.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(5, 5, 4.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Autumn leaves
  const leafColors = [
    { main: '#f59e0b', vein: '#b45309' },
    { main: '#ea580c', vein: '#9a3412' }
  ];
  leafColors.forEach((lc, idx) => {
    makeCanvas(scene, `particle-leaf-${idx}`, 12, 10, (ctx) => {
      ctx.fillStyle = lc.main;
      ctx.beginPath();
      ctx.ellipse(6, 5, 5, 3, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = lc.vein;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.lineTo(10, 6);
      ctx.stroke();
    });
  });

  // Summer butterflies
  const wingColors = ['#fde047', '#7dd3fc'];
  wingColors.forEach((wc, idx) => {
    makeCanvas(scene, `particle-butterfly-${idx}`, 14, 12, (ctx) => {
      ctx.fillStyle = wc;
      ctx.beginPath();
      ctx.ellipse(4.5, 4.5, 3.8, 2.8, -0.35, 0, Math.PI * 2);
      ctx.ellipse(9.5, 4.5, 3.8, 2.8, 0.35, 0, Math.PI * 2);
      ctx.ellipse(5, 8, 2.8, 2, 0.25, 0, Math.PI * 2);
      ctx.ellipse(9, 8, 2.8, 2, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b1e14';
      ctx.fillRect(6.4, 2.5, 1.2, 7);
    });
  });
}

function createCampfireAndParticleTextures(scene: Phaser.Scene): void {
  // Campfire base
  makeCanvas(scene, 'campfire-base', 192, 150, (ctx) => {
    const cx = 96;
    const cy = 82;

    // Warm trampled earth clearing
    const dirtGrad = ctx.createRadialGradient(cx, cy, 16, cx, cy, 88);
    dirtGrad.addColorStop(0, 'rgba(130, 96, 56, 0.92)');
    dirtGrad.addColorStop(0.65, 'rgba(152, 114, 68, 0.68)');
    dirtGrad.addColorStop(1, 'rgba(152, 114, 68, 0)');
    ctx.fillStyle = dirtGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 88, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Charred ash bed
    ctx.fillStyle = '#33261d';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 42, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone ring (back stones then front stones for 2.5D depth)
    const count = 12;
    const stones: Array<{ x: number; y: number; i: number }> = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      stones.push({
        x: cx + Math.cos(a) * 44,
        y: cy + 3 + Math.sin(a) * 28,
        i
      });
    }
    stones.sort((a, b) => a.y - b.y);

    for (const s of stones) {
      // Shadow
      ctx.fillStyle = 'rgba(20, 15, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x + 2, s.y + 4, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stone body
      const stoneGrad = ctx.createLinearGradient(s.x - 10, s.y - 8, s.x + 10, s.y + 8);
      stoneGrad.addColorStop(0, '#9ca3af');
      stoneGrad.addColorStop(1, '#585e68');
      ctx.fillStyle = stoneGrad;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 11.5, 8.5, (s.i % 3) * 0.2 - 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(s.x - 3, s.y - 3, 4.5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crossed logs
    const drawFireLog = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = '#6f4222';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = '#925a32';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1 - 1.5);
      ctx.lineTo(x2, y2 - 1.5);
      ctx.stroke();
      ctx.restore();
    };

    drawFireLog(cx - 26, cy + 12, cx + 26, cy - 6);
    drawFireLog(cx - 24, cy - 6, cx + 26, cy + 12);
    drawFireLog(cx - 6, cy + 16, cx + 8, cy - 10);

    // Glowing ember bed
    const emberGrad = ctx.createRadialGradient(cx, cy + 2, 2, cx, cy + 2, 24);
    emberGrad.addColorStop(0, '#fff3b0');
    emberGrad.addColorStop(0.35, '#ff9f1c');
    emberGrad.addColorStop(0.75, '#e63900');
    emberGrad.addColorStop(1, 'rgba(230, 57, 0, 0)');
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4 animated flame frames
  for (let f = 0; f < 4; f++) {
    makeCanvas(scene, `flame-${f}`, 80, 96, (ctx) => {
      const fx = 40;
      const fy = 82;
      const sway = Math.sin((f / 4) * Math.PI * 2) * 5;
      const boost = (f % 2) * 5;

      // Soft warm glow behind flame
      const glow = ctx.createRadialGradient(fx, fy - 24, 4, fx, fy - 24, 34);
      glow.addColorStop(0, 'rgba(255, 180, 40, 0.5)');
      glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fx, fy - 24, 34, 0, Math.PI * 2);
      ctx.fill();

      // Outer orange flame
      ctx.fillStyle = '#ff6d00';
      ctx.beginPath();
      ctx.moveTo(fx - 20, fy);
      ctx.bezierCurveTo(
        fx - 26,
        fy - 22,
        fx - 12 + sway * 0.4,
        fy - 42 - boost,
        fx + sway,
        fy - 58 - boost
      );
      ctx.bezierCurveTo(
        fx + 14 + sway * 0.4,
        fy - 40 - boost,
        fx + 26,
        fy - 20,
        fx + 20,
        fy
      );
      ctx.quadraticCurveTo(fx, fy + 8, fx - 20, fy);
      ctx.fill();

      // Mid golden flame
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(fx - 13, fy - 1);
      ctx.bezierCurveTo(
        fx - 16,
        fy - 18,
        fx - 6 + sway * 0.5,
        fy - 32 - boost * 0.6,
        fx + sway * 0.7,
        fy - 42 - boost * 0.6
      );
      ctx.bezierCurveTo(
        fx + 9 + sway * 0.4,
        fy - 28,
        fx + 16,
        fy - 16,
        fx + 13,
        fy - 1
      );
      ctx.quadraticCurveTo(fx, fy + 4, fx - 13, fy - 1);
      ctx.fill();

      // White-hot cream core
      ctx.fillStyle = '#fff8cc';
      ctx.beginPath();
      ctx.ellipse(fx + sway * 0.15, fy - 11, 7.5, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Particles
  makeCanvas(scene, 'particle-spark', 12, 12, (ctx) => {
    const g = ctx.createRadialGradient(6, 6, 1, 6, 6, 6);
    g.addColorStop(0, '#fff8c9');
    g.addColorStop(0.5, '#ffaa00');
    g.addColorStop(1, 'rgba(255, 90, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(6, 6, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'particle-smoke', 28, 28, (ctx) => {
    const g = ctx.createRadialGradient(14, 14, 2, 14, 14, 13);
    g.addColorStop(0, 'rgba(225, 225, 220, 0.65)');
    g.addColorStop(0.55, 'rgba(190, 190, 185, 0.3)');
    g.addColorStop(1, 'rgba(180, 180, 175, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(14, 14, 13, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'particle-chip-wood', 12, 8, (ctx) => {
    ctx.fillStyle = '#d49b63';
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, 1, 1, 10, 6, 2);
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'particle-chip-stone', 10, 10, (ctx) => {
    ctx.fillStyle = '#9ca3af';
    ctx.strokeStyle = '#3e424a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(1, 3);
    ctx.lineTo(6, 1);
    ctx.lineTo(9, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'particle-chip-food', 10, 10, (ctx) => {
    ctx.fillStyle = '#3ba847';
    ctx.beginPath();
    ctx.ellipse(5, 5, 4, 2.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(6, 4, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createStorageTextures(scene: Phaser.Scene): void {
  const drawLog = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    len: number,
    thick: number
  ) => {
    ctx.fillStyle = '#7b4b28';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, x, y, len, thick, thick / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9e653a';
    drawRoundedRect(ctx, x + 2, y + 1.5, len - 8, thick * 0.42, 2);
    ctx.fill();

    // Cut wood end
    ctx.fillStyle = '#e6c29f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x + len - thick * 0.45, y + thick / 2, thick * 0.34, thick * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const drawRockChip = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
    ctx.fillStyle = 'rgba(20, 30, 15, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + r * 0.55, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#b5bcc6');
    grad.addColorStop(1, '#646b75');
    ctx.fillStyle = grad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.4);
    ctx.lineTo(cx - r * 0.75, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.15, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.95, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.36, r * 0.2, -0.25, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawBasket = (ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(20, 30, 15, 0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 9, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Woven basket body
    ctx.fillStyle = '#c68b45';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(-10, 8);
    ctx.quadraticCurveTo(0, 12, 10, 8);
    ctx.lineTo(13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Weave lines
    ctx.strokeStyle = '#8c5a24';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.quadraticCurveTo(0, 5, 11, 2);
    ctx.stroke();

    // Overflowing berries & leaves
    const berries = [
      { x: -7, y: -5, c: '#d90429' },
      { x: 0, y: -7, c: '#ef233c' },
      { x: 7, y: -5, c: '#d90429' },
      { x: -3, y: -3, c: '#9d0208' },
      { x: 4, y: -3, c: '#e63946' }
    ];
    ctx.fillStyle = '#43aa4f';
    ctx.beginPath();
    ctx.ellipse(-9, -6, 4.5, 2.5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(9, -6, 4.5, 2.5, 0.4, 0, Math.PI * 2);
    ctx.fill();

    for (const b of berries) {
      ctx.fillStyle = b.c;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(b.x - 1.2, b.y - 1.2, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  for (let stage = 0; stage <= 4; stage++) {
    // Wood depot
    makeCanvas(scene, `storage-wood-${stage}`, 112, 96, (ctx) => {
      // Dirt pad
      ctx.fillStyle = 'rgba(130, 95, 55, 0.55)';
      ctx.beginPath();
      ctx.ellipse(56, 62, 46, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wooden rack stakes
      const drawStake = (sx: number, sy: number) => {
        ctx.fillStyle = '#6f4222';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        drawRoundedRect(ctx, sx - 3, sy - 18, 6, 20, 2);
        ctx.fill();
        ctx.stroke();
      };
      drawStake(26, 54);
      drawStake(86, 54);

      if (stage >= 1) {
        drawLog(ctx, 24, 52, 64, 11);
        drawLog(ctx, 28, 44, 58, 10);
      }
      if (stage >= 2) {
        drawLog(ctx, 26, 36, 60, 10);
        drawLog(ctx, 32, 29, 52, 9.5);
      }
      if (stage >= 3) {
        drawLog(ctx, 30, 21, 54, 9.5);
        drawLog(ctx, 22, 60, 68, 10);
      }
      if (stage >= 4) {
        drawLog(ctx, 34, 14, 46, 9);
        drawLog(ctx, 28, 56, 60, 10);
      }

      drawStake(22, 68);
      drawStake(90, 68);
    });

    // Stone depot
    makeCanvas(scene, `storage-stone-${stage}`, 112, 96, (ctx) => {
      // Slate/dirt pad
      ctx.fillStyle = 'rgba(115, 105, 86, 0.58)';
      ctx.beginPath();
      ctx.ellipse(56, 62, 46, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Marker stones
      ctx.strokeStyle = 'rgba(70, 74, 82, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(56, 62, 42, 21, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (stage >= 1) {
        drawRockChip(ctx, 44, 62, 13);
        drawRockChip(ctx, 68, 64, 12);
      }
      if (stage >= 2) {
        drawRockChip(ctx, 56, 58, 14);
        drawRockChip(ctx, 34, 67, 10);
      }
      if (stage >= 3) {
        drawRockChip(ctx, 48, 48, 12);
        drawRockChip(ctx, 65, 49, 11);
        drawRockChip(ctx, 77, 67, 10);
      }
      if (stage >= 4) {
        drawRockChip(ctx, 56, 37, 11.5);
        drawRockChip(ctx, 56, 69, 11);
      }
    });

    // Food depot
    makeCanvas(scene, `storage-food-${stage}`, 112, 96, (ctx) => {
      // Woven reed mat
      ctx.fillStyle = 'rgba(130, 95, 55, 0.5)';
      ctx.beginPath();
      ctx.ellipse(56, 62, 46, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#d4a359';
      ctx.strokeStyle = '#7c5321';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 20, 44, 72, 34, 10);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(124, 83, 33, 0.45)';
      ctx.lineWidth = 1.2;
      for (let gx = 30; gx <= 82; gx += 12) {
        ctx.beginPath();
        ctx.moveTo(gx, 46);
        ctx.lineTo(gx, 76);
        ctx.stroke();
      }

      if (stage >= 1) drawBasket(ctx, 42, 58, 1.0);
      if (stage >= 2) drawBasket(ctx, 70, 58, 0.96);
      if (stage >= 3) drawBasket(ctx, 56, 46, 0.94);
      if (stage >= 4) drawBasket(ctx, 56, 65, 1.04);
    });
  }
}

function createTreeTextures(scene: Phaser.Scene): void {
  const oakPalettes = [
    {
      key: 'tree-oak-spring',
      cDark: '#1f6a29',
      cMid: '#3aa845',
      cLight: '#6ee274',
      dab: 'rgba(185, 248, 132, 0.46)',
      snow: false
    },
    {
      key: 'tree-oak-summer',
      cDark: '#1e5f29',
      cMid: '#329640',
      cLight: '#5ed162',
      dab: 'rgba(163, 240, 120, 0.42)',
      snow: false
    },
    {
      key: 'tree-oak-autumn',
      cDark: '#9a3412',
      cMid: '#d97706',
      cLight: '#fbbf24',
      dab: 'rgba(254, 240, 138, 0.48)',
      snow: false
    },
    {
      key: 'tree-oak-winter',
      cDark: '#2c4f44',
      cMid: '#4c7566',
      cLight: '#7fa898',
      dab: 'rgba(255, 255, 255, 0.35)',
      snow: true
    }
  ];

  for (const pal of oakPalettes) {
    makeCanvas(scene, pal.key, 160, 176, (ctx) => {
      const cx = 80;
      const baseY = 154;

      const sh = ctx.createRadialGradient(cx + 8, baseY, 8, cx + 8, baseY, 54);
      sh.addColorStop(0, 'rgba(20, 42, 16, 0.42)');
      sh.addColorStop(1, 'rgba(20, 42, 16, 0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(cx + 8, baseY, 54, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6f4324';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 17, baseY + 2);
      ctx.quadraticCurveTo(cx - 10, baseY - 14, cx - 10, baseY - 64);
      ctx.lineTo(cx + 10, baseY - 64);
      ctx.quadraticCurveTo(cx + 10, baseY - 14, cx + 17, baseY + 2);
      ctx.quadraticCurveTo(cx, baseY + 6, cx - 17, baseY + 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#925c35';
      ctx.beginPath();
      ctx.moveTo(cx - 8, baseY - 2);
      ctx.quadraticCurveTo(cx - 5, baseY - 30, cx - 5, baseY - 58);
      ctx.lineTo(cx, baseY - 58);
      ctx.lineTo(cx - 1, baseY - 2);
      ctx.closePath();
      ctx.fill();

      const drawCanopyCluster = (x: number, y: number, r: number) => {
        ctx.fillStyle = pal.cDark;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.15, x, y, r);
        grad.addColorStop(0, pal.cLight);
        grad.addColorStop(0.55, pal.cMid);
        grad.addColorStop(1, pal.cDark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y - 2, r * 0.9, 0, Math.PI * 2);
        ctx.fill();

        if (pal.snow) {
          ctx.fillStyle = '#f0f9ff';
          ctx.beginPath();
          ctx.ellipse(x, y - r * 0.56, r * 0.72, r * 0.36, 0, Math.PI, Math.PI * 2);
          ctx.quadraticCurveTo(x + r * 0.35, y - r * 0.38, x, y - r * 0.45);
          ctx.quadraticCurveTo(x - r * 0.35, y - r * 0.38, x - r * 0.72, y - r * 0.56);
          ctx.fill();
        }
      };

      drawCanopyCluster(cx - 28, baseY - 72, 30);
      drawCanopyCluster(cx + 28, baseY - 72, 30);
      drawCanopyCluster(cx, baseY - 102, 36);
      drawCanopyCluster(cx - 18, baseY - 88, 25);
      drawCanopyCluster(cx + 16, baseY - 86, 24);
      drawCanopyCluster(cx, baseY - 70, 28);

      const highlights = [
        { x: cx - 10, y: baseY - 118, r: 10 },
        { x: cx + 10, y: baseY - 108, r: 8 },
        { x: cx - 24, y: baseY - 88, r: 7 },
        { x: cx + 22, y: baseY - 82, r: 7 }
      ];
      for (const h of highlights) {
        ctx.fillStyle = pal.dab;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Layered pine trees (normal + snowy winter)
  for (const isWinter of [false, true]) {
    makeCanvas(scene, isWinter ? 'tree-pine-winter' : 'tree-pine', 160, 176, (ctx) => {
      const cx = 80;
      const baseY = 154;

      const sh = ctx.createRadialGradient(cx + 6, baseY, 8, cx + 6, baseY, 48);
      sh.addColorStop(0, 'rgba(20, 42, 16, 0.4)');
      sh.addColorStop(1, 'rgba(20, 42, 16, 0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(cx + 6, baseY, 48, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#683e21';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      drawRoundedRect(ctx, cx - 9, baseY - 40, 18, 42, 4);
      ctx.fill();
      ctx.stroke();

      const tiers = [
        { y: baseY - 26, w: 50, h: 48, dark: '#17542c', mid: '#237a42', light: '#3ba35e' },
        { y: baseY - 58, w: 41, h: 46, dark: '#1b6134', mid: '#298c4c', light: '#44b56a' },
        { y: baseY - 88, w: 32, h: 42, dark: '#1f6e3b', mid: '#319f58', light: '#56c77c' },
        { y: baseY - 114, w: 22, h: 36, dark: '#247c43', mid: '#3bb165', light: '#6ed88f' }
      ];

      for (const t of tiers) {
        ctx.fillStyle = t.dark;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx, t.y - t.h);
        ctx.quadraticCurveTo(cx + t.w * 0.55, t.y - t.h * 0.35, cx + t.w, t.y);
        ctx.quadraticCurveTo(cx, t.y + 8, cx - t.w, t.y);
        ctx.quadraticCurveTo(cx - t.w * 0.55, t.y - t.h * 0.35, cx, t.y - t.h);
        ctx.fill();
        ctx.stroke();

        const grad = ctx.createLinearGradient(cx - t.w * 0.5, t.y - t.h, cx + t.w * 0.4, t.y);
        grad.addColorStop(0, t.light);
        grad.addColorStop(0.55, t.mid);
        grad.addColorStop(1, t.dark);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 1, t.y - t.h + 4);
        ctx.quadraticCurveTo(cx + t.w * 0.4, t.y - t.h * 0.3, cx + t.w * 0.72, t.y - 3);
        ctx.quadraticCurveTo(cx - 2, t.y + 4, cx - t.w * 0.85, t.y - 3);
        ctx.quadraticCurveTo(cx - t.w * 0.45, t.y - t.h * 0.35, cx - 1, t.y - t.h + 4);
        ctx.fill();

        if (isWinter) {
          ctx.fillStyle = '#f0f9ff';
          ctx.beginPath();
          ctx.moveTo(cx, t.y - t.h + 1);
          ctx.quadraticCurveTo(cx + t.w * 0.35, t.y - t.h * 0.62, cx + t.w * 0.6, t.y - t.h * 0.42);
          ctx.quadraticCurveTo(cx, t.y - t.h * 0.34, cx - t.w * 0.6, t.y - t.h * 0.42);
          ctx.quadraticCurveTo(cx - t.w * 0.35, t.y - t.h * 0.62, cx, t.y - t.h + 1);
          ctx.fill();
        }
      }
    });
  }
}

function createRockTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < 2; i++) {
    for (const isWinter of [false, true]) {
      const key = isWinter ? `rock-${i}-winter` : `rock-${i}`;
      makeCanvas(scene, key, 128, 112, (ctx) => {
        const cx = 64;
        const baseY = 88;

        const sh = ctx.createRadialGradient(cx + 5, baseY + 2, 6, cx + 5, baseY + 2, 46);
        sh.addColorStop(0, 'rgba(20, 40, 16, 0.38)');
        sh.addColorStop(1, 'rgba(20, 40, 16, 0)');
        ctx.fillStyle = sh;
        ctx.beginPath();
        ctx.ellipse(cx + 5, baseY + 2, 46, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        const rockGrad = ctx.createLinearGradient(cx - 32, baseY - 52, cx + 32, baseY + 8);
        rockGrad.addColorStop(0, '#9fa8b4');
        rockGrad.addColorStop(0.5, '#767f8b');
        rockGrad.addColorStop(1, '#4f5660');

        ctx.fillStyle = rockGrad;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        if (i === 0) {
          ctx.moveTo(cx - 38, baseY - 2);
          ctx.lineTo(cx - 30, baseY - 34);
          ctx.lineTo(cx - 8, baseY - 52);
          ctx.lineTo(cx + 22, baseY - 40);
          ctx.lineTo(cx + 40, baseY - 12);
          ctx.lineTo(cx + 34, baseY + 4);
          ctx.quadraticCurveTo(cx, baseY + 10, cx - 38, baseY - 2);
        } else {
          ctx.moveTo(cx - 36, baseY);
          ctx.lineTo(cx - 26, baseY - 40);
          ctx.lineTo(cx + 4, baseY - 50);
          ctx.lineTo(cx + 34, baseY - 28);
          ctx.lineTo(cx + 38, baseY + 2);
          ctx.quadraticCurveTo(cx, baseY + 10, cx - 36, baseY);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isWinter ? '#f0f9ff' : '#bcc4cf';
        ctx.beginPath();
        ctx.moveTo(cx - 25, baseY - 26);
        ctx.lineTo(cx - 6, baseY - 47);
        ctx.lineTo(cx + 18, baseY - 36);
        ctx.lineTo(cx + 6, baseY - 18);
        ctx.lineTo(cx - 18, baseY - 15);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(cx - 7, baseY - 36, 11, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#3b4048';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + 5, baseY - 24);
        ctx.lineTo(cx + 14, baseY - 12);
        ctx.lineTo(cx + 8, baseY - 1);
        ctx.moveTo(cx - 16, baseY - 14);
        ctx.lineTo(cx - 8, baseY - 6);
        ctx.stroke();

        ctx.fillStyle = i === 0 ? '#f4b942' : '#93c5fd';
        ctx.beginPath();
        ctx.arc(cx + 16, baseY - 20, 3.2, 0, Math.PI * 2);
        ctx.arc(cx - 12, baseY - 22, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (!isWinter) {
          drawLeafBlade(ctx, cx - 32, baseY + 4, -5, 10, '#3e842b');
          drawLeafBlade(ctx, cx - 28, baseY + 5, 2, 11, '#4ea337');
          drawLeafBlade(ctx, cx + 30, baseY + 4, 5, 9, '#3e842b');
        }
      });
    }
  }
}

function createBushTextures(scene: Phaser.Scene): void {
  const configs: Array<{ key: string; mode: 'berries' | 'empty' | 'buds' | 'winter' }> = [
    { key: 'bush-berries', mode: 'berries' },
    { key: 'bush-empty', mode: 'empty' },
    { key: 'bush-buds', mode: 'buds' },
    { key: 'bush-winter', mode: 'winter' }
  ];

  for (const cfg of configs) {
    makeCanvas(scene, cfg.key, 112, 96, (ctx) => {
      const cx = 56;
      const baseY = 74;

      const sh = ctx.createRadialGradient(cx + 4, baseY + 2, 6, cx + 4, baseY + 2, 40);
      sh.addColorStop(0, 'rgba(20, 40, 16, 0.36)');
      sh.addColorStop(1, 'rgba(20, 40, 16, 0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.ellipse(cx + 4, baseY + 2, 40, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      const darkCol = cfg.mode === 'winter' ? '#3e5446' : '#20632a';
      const lightCol = cfg.mode === 'winter' ? '#8ea897' : '#62d968';
      const midCol = cfg.mode === 'winter' ? '#5e7867' : '#369e42';

      const drawLeafPuff = (x: number, y: number, r: number) => {
        ctx.fillStyle = darkCol;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, lightCol);
        g.addColorStop(0.55, midCol);
        g.addColorStop(1, darkCol);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y - 1.5, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
      };

      drawLeafPuff(cx - 20, baseY - 14, 20);
      drawLeafPuff(cx + 20, baseY - 14, 20);
      drawLeafPuff(cx, baseY - 26, 23);
      drawLeafPuff(cx - 10, baseY - 12, 18);
      drawLeafPuff(cx + 10, baseY - 12, 18);

      if (cfg.mode === 'winter') {
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        ctx.ellipse(cx, baseY - 40, 20, 9, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 18, baseY - 26, 14, 7, -0.2, 0, Math.PI * 2);
        ctx.ellipse(cx + 18, baseY - 26, 14, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (cfg.mode === 'buds') {
        const buds = [
          [cx - 16, baseY - 18],
          [cx - 5, baseY - 28],
          [cx + 12, baseY - 20],
          [cx + 2, baseY - 12],
          [cx - 14, baseY - 10]
        ];
        for (const [bx, by] of buds) {
          ctx.fillStyle = '#bef264';
          ctx.strokeStyle = '#3f6212';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (cfg.mode === 'berries') {
        const berries = [
          { x: cx - 18, y: baseY - 20 },
          { x: cx - 12, y: baseY - 14 },
          { x: cx - 4, y: baseY - 30 },
          { x: cx + 4, y: baseY - 25 },
          { x: cx + 16, y: baseY - 18 },
          { x: cx + 22, y: baseY - 11 },
          { x: cx + 2, y: baseY - 12 },
          { x: cx - 22, y: baseY - 9 }
        ];
        for (const b of berries) {
          ctx.fillStyle = '#d90429';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffd6de';
          ctx.beginPath();
          ctx.arc(b.x - 1.5, b.y - 1.5, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }
}

interface VillagerSpec {
  id: VillagerAppearanceId;
  skinSpec: string;
  skinLight: string;
  skinMid: string;
  skinShadow: string;
  skinAO: string;
  skinRim: string;
  tunicLight: string;
  tunicMid: string;
  tunicDark: string;
  tunicDeep: string;
  tunicRim: string;
  spot: string;
  hairLight: string;
  hairMid: string;
  hairDark: string;
  hairSpec: string;
  eyeColor: string;
  eyeDark: string;
  female: boolean;
  beard: boolean;
  scar: boolean;
}

const VILLAGER_SPECS: VillagerSpec[] = [
  {
    id: 'male-1',
    skinSpec: '#ffebd9',
    skinLight: '#f6cba9',
    skinMid: '#df9c71',
    skinShadow: '#a7633e',
    skinAO: '#723a20',
    skinRim: 'rgba(255, 222, 185, 0.36)',
    tunicLight: '#f0a24b',
    tunicMid: '#cc6d1e',
    tunicDark: '#7c390b',
    tunicDeep: '#441d04',
    tunicRim: 'rgba(255, 214, 150, 0.32)',
    spot: '#4f2306',
    hairLight: '#7b4827',
    hairMid: '#4c2813',
    hairDark: '#231006',
    hairSpec: 'rgba(255, 224, 185, 0.38)',
    eyeColor: '#2d7a4f',
    eyeDark: '#133d25',
    female: false,
    beard: false,
    scar: true
  },
  {
    id: 'male-2',
    skinSpec: '#ffe1c7',
    skinLight: '#ebb58d',
    skinMid: '#ce8a5e',
    skinShadow: '#935331',
    skinAO: '#623017',
    skinRim: 'rgba(255, 215, 180, 0.32)',
    tunicLight: '#cf7d46',
    tunicMid: '#a3511f',
    tunicDark: '#612b0b',
    tunicDeep: '#361504',
    tunicRim: 'rgba(245, 182, 130, 0.3)',
    spot: '#361504',
    hairLight: '#563e34',
    hairMid: '#2f2019',
    hairDark: '#140c09',
    hairSpec: 'rgba(220, 200, 190, 0.3)',
    eyeColor: '#396394',
    eyeDark: '#182f4c',
    female: false,
    beard: true,
    scar: true
  },
  {
    id: 'female',
    skinSpec: '#fff0e4',
    skinLight: '#fad2b6',
    skinMid: '#e6a079',
    skinShadow: '#b46b48',
    skinAO: '#7c3f25',
    skinRim: 'rgba(255, 228, 206, 0.38)',
    tunicLight: '#f48c72',
    tunicMid: '#d1563b',
    tunicDark: '#822917',
    tunicDeep: '#481308',
    tunicRim: 'rgba(255, 198, 180, 0.34)',
    spot: '#fff2e6',
    hairLight: '#c25437',
    hairMid: '#8a311c',
    hairDark: '#47150a',
    hairSpec: 'rgba(255, 214, 185, 0.44)',
    eyeColor: '#2a7d65',
    eyeDark: '#124234',
    female: true,
    beard: false,
    scar: false
  }
];

function drawHairLock(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  width: number,
  s: VillagerSpec
): void {
  // Deep shadow under hair clump
  ctx.strokeStyle = s.hairDark;
  ctx.lineWidth = width + 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y1 + 3);
  ctx.quadraticCurveTo(cx + 2, cy + 3, x2 + 2, y2 + 3);
  ctx.stroke();

  // Mid volume body
  ctx.strokeStyle = s.hairMid;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();

  // Top-left sunlit ridge
  ctx.strokeStyle = s.hairLight;
  ctx.lineWidth = Math.max(2, width * 0.42);
  ctx.beginPath();
  ctx.moveTo(x1 - 1.5, y1 - 1.5);
  ctx.quadraticCurveTo(cx - 1.5, cy - 1.5, x2 - 1.5, y2 - 1.5);
  ctx.stroke();
}

function draw3DEye(
  ctx: CanvasRenderingContext2D,
  ex: number,
  eyeY: number,
  rx: number,
  ry: number,
  s: VillagerSpec,
  blink: boolean,
  lookOffsetX: number
): void {
  const socket = ctx.createRadialGradient(ex, eyeY, 2, ex, eyeY, rx + 5);
  socket.addColorStop(0, 'rgba(92, 42, 24, 0.34)');
  socket.addColorStop(1, 'rgba(92, 42, 24, 0)');
  ctx.fillStyle = socket;
  ctx.beginPath();
  ctx.arc(ex, eyeY, rx + 5, 0, Math.PI * 2);
  ctx.fill();

  if (blink) {
    ctx.strokeStyle = '#4e2716';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex, eyeY + 2, rx * 0.85, Math.PI + 0.25, -0.25);
    ctx.stroke();
    return;
  }

  const sclGrad = ctx.createLinearGradient(ex, eyeY - ry, ex, eyeY + ry);
  sclGrad.addColorStop(0, '#b9c6d6');
  sclGrad.addColorStop(0.28, '#ffffff');
  sclGrad.addColorStop(0.85, '#edf2f7');
  sclGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = sclGrad;
  ctx.beginPath();
  ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const irisX = ex + lookOffsetX;
  const irisGrad = ctx.createRadialGradient(irisX - 0.5, eyeY - 0.5, 0.8, irisX, eyeY + 0.5, 4.6);
  irisGrad.addColorStop(0, s.eyeColor);
  irisGrad.addColorStop(1, s.eyeDark);
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(irisX, eyeY + 0.5, 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.arc(irisX, eyeY + 0.5, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Crisp glossy specular catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(irisX - 1.6, eyeY - 2.3, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(irisX + 1.4, eyeY + 2.1, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkinTextureAndBlush(
  ctx: CanvasRenderingContext2D,
  s: VillagerSpec,
  cx: number,
  cy: number,
  isFront: boolean
): void {
  // Subtle pore/freckle skin grain
  ctx.fillStyle = s.skinAO;
  ctx.globalAlpha = 0.22;
  const grains = isFront
    ? [
        [cx - 16, cy + 7],
        [cx - 12, cy + 12],
        [cx + 14, cy + 8],
        [cx + 17, cy + 12],
        [cx - 8, cy - 8]
      ]
    : [
        [cx - 14, cy + 8],
        [cx - 10, cy + 13],
        [cx + 16, cy + 9],
        [cx - 6, cy - 8]
      ];
  for (const [gx, gy] of grains) {
    ctx.beginPath();
    ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Subsurface cheek warmth
  const drawBlush = (bx: number, by: number, rx: number, ry: number) => {
    const blush = ctx.createRadialGradient(bx, by, 1, bx, by, rx);
    blush.addColorStop(0, 'rgba(232, 86, 98, 0.36)');
    blush.addColorStop(1, 'rgba(232, 86, 98, 0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  if (isFront) {
    drawBlush(cx - 17, cy + 10, 8, 5);
    drawBlush(cx + 17, cy + 10, 8, 5);
  } else {
    drawBlush(cx - 13, cy + 11, 8.5, 5);
    drawBlush(cx + 21, cy + 10, 7, 4.5);
  }

  // Rugged prehistoric cheek/brow scar for males
  if (s.scar) {
    const sx = isFront ? cx + 15 : cx - 10;
    const sy = cy + 6;
    ctx.strokeStyle = 'rgba(255, 228, 208, 0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 4);
    ctx.lineTo(sx + 4, sy + 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(130, 58, 34, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx - 3.5, sy - 4.5);
    ctx.lineTo(sx + 3.5, sy + 3.5);
    ctx.stroke();
  }
}

function drawVillagerHeadFront3D(
  ctx: CanvasRenderingContext2D,
  s: VillagerSpec,
  cx: number,
  cy: number,
  blink: boolean,
  lifeStage: LifeStage = 'ADULT'
): void {
  // Subtle silhouette of ponytail behind left/right ear for female
  if (s.female) {
    drawHairLock(ctx, cx - 22, cy - 8, cx - 32, cy + 8, cx - 26, cy + 24, 13, s);
  }

  // Symmetrical 3D ears
  for (const side of [-1, 1]) {
    const ex = cx + side * 28.5;
    const earGrad = ctx.createRadialGradient(ex - 2, cy + 1, 1, ex, cy + 4, 9);
    earGrad.addColorStop(0, side < 0 ? s.skinLight : s.skinMid);
    earGrad.addColorStop(1, s.skinShadow);
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(ex, cy + 4, 6, 8.5, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sculpted 3D head sphere (top-left key light -> deep warm bottom-right shadow)
  const headGrad = ctx.createRadialGradient(cx - 12, cy - 14, 4, cx + 4, cy + 4, 34);
  headGrad.addColorStop(0, s.skinSpec);
  headGrad.addColorStop(0.26, s.skinLight);
  headGrad.addColorStop(0.62, s.skinMid);
  headGrad.addColorStop(0.88, s.skinShadow);
  headGrad.addColorStop(1, s.skinAO);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 29, lifeStage === 'CHILD' ? 27.5 : 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle rim light on bottom-right jawline
  ctx.strokeStyle = s.skinRim;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 27.2, 0.25, 1.35);
  ctx.stroke();

  // Brow AO under bangs
  ctx.fillStyle = s.skinAO;
  ctx.globalAlpha = 0.26;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 12, 25, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Full sculpted beard
  if (s.beard) {
    const beardGrad = ctx.createRadialGradient(cx - 8, cy + 10, 4, cx + 4, cy + 20, 30);
    beardGrad.addColorStop(0, s.hairLight);
    beardGrad.addColorStop(0.55, s.hairMid);
    beardGrad.addColorStop(1, s.hairDark);
    ctx.fillStyle = beardGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 27, cy + 6);
    ctx.bezierCurveTo(cx - 26, cy + 33, cx - 10, cy + 37, cx, cy + 37);
    ctx.bezierCurveTo(cx + 10, cy + 37, cx + 26, cy + 33, cx + 27, cy + 6);
    ctx.quadraticCurveTo(cx + 12, cy + 15, cx, cy + 12);
    ctx.quadraticCurveTo(cx - 12, cy + 15, cx - 27, cy + 6);
    ctx.fill();

    drawHairLock(ctx, cx - 16, cy + 18, cx - 8, cy + 29, cx - 2, cy + 32, 6, s);
    drawHairLock(ctx, cx + 16, cy + 18, cx + 8, cy + 29, cx + 2, cy + 32, 6, s);
  }

  drawSkinTextureAndBlush(ctx, s, cx, cy, true);

  if (lifeStage === 'CHILD') {
    // Extra youthful rosy cheek glow
    for (const side of [-1, 1]) {
      const bx = cx + side * 16;
      const g = ctx.createRadialGradient(bx, cy + 9, 1, bx, cy + 9, 9.5);
      g.addColorStop(0, 'rgba(244, 63, 94, 0.34)');
      g.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, cy + 9, 9.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (lifeStage === 'ELDER') {
    // Subtle wisdom wrinkle lines on forehead & outer eyes
    ctx.strokeStyle = 'rgba(110, 58, 34, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 14);
    ctx.quadraticCurveTo(cx, cy - 16, cx + 10, cy - 14);
    ctx.moveTo(cx - 21, cy + 2);
    ctx.lineTo(cx - 25, cy + 4);
    ctx.moveTo(cx + 21, cy + 2);
    ctx.lineTo(cx + 25, cy + 4);
    ctx.stroke();
  }

  // Expressive symmetrical 3D eyes (bigger & brighter for CHILD)
  const eyeY = cy + 1;
  const eyeRx = lifeStage === 'CHILD' ? 7.1 : 6;
  const eyeRy = lifeStage === 'CHILD' ? 9.0 : 7.6;
  draw3DEye(ctx, cx - 11, eyeY, eyeRx, eyeRy, s, blink, 0);
  draw3DEye(ctx, cx + 11, eyeY, eyeRx, eyeRy, s, blink, 0);

  // Sculpted 3D nose bridge + cast shadow underneath
  ctx.fillStyle = 'rgba(110, 50, 26, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy + 9.5, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const noseGrad = ctx.createRadialGradient(cx - 1.5, cy + 4.5, 1, cx, cy + 6.5, 6);
  noseGrad.addColorStop(0, s.skinSpec);
  noseGrad.addColorStop(0.65, s.skinMid);
  noseGrad.addColorStop(1, s.skinShadow);
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6.5, 5, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Brow ridges
  ctx.strokeStyle = s.hairMid;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 16.5, eyeY - 10);
  ctx.quadraticCurveTo(cx - 11, eyeY - 12.5, cx - 5.5, eyeY - 10);
  ctx.moveTo(cx + 5.5, eyeY - 10);
  ctx.quadraticCurveTo(cx + 11, eyeY - 12.5, cx + 16.5, eyeY - 10);
  ctx.stroke();

  if (!s.beard) {
    ctx.strokeStyle = '#8b412b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, cy + 13, 5.2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Shaggy 3D hair crown + tousled fringe locks
  const hairGrad = ctx.createRadialGradient(cx - 10, cy - 26, 4, cx + 2, cy - 14, 34);
  hairGrad.addColorStop(0, s.hairLight);
  hairGrad.addColorStop(0.55, s.hairMid);
  hairGrad.addColorStop(1, s.hairDark);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 30, Math.PI * 0.92, Math.PI * 2.08);
  ctx.quadraticCurveTo(cx, cy - 14, cx - 29.5, cy - 2);
  ctx.fill();

  if (s.female) {
    drawHairLock(ctx, cx - 26, cy - 8, cx - 12, cy - 20, cx - 2, cy - 13, 10, s);
    drawHairLock(ctx, cx + 2, cy - 14, cx + 14, cy - 20, cx + 26, cy - 8, 10, s);
  } else {
    drawHairLock(ctx, cx - 24, cy - 12, cx - 14, cy - 32, cx - 6, cy - 14, 9, s);
    drawHairLock(ctx, cx - 6, cy - 14, cx + 2, cy - 36, cx + 10, cy - 14, 10, s);
    drawHairLock(ctx, cx + 10, cy - 14, cx + 18, cy - 30, cx + 26, cy - 10, 9, s);
  }

  ctx.strokeStyle = s.hairSpec;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 15, 16, Math.PI * 1.15, Math.PI * 1.7);
  ctx.stroke();
}

function drawVillagerHeadSide3D(
  ctx: CanvasRenderingContext2D,
  s: VillagerSpec,
  cx: number,
  cy: number,
  blink: boolean,
  lifeStage: LifeStage = 'ADULT'
): void {
  // Ponytail for female
  if (s.female) {
    drawHairLock(ctx, cx - 18, cy - 6, cx - 34, cy - 4, cx - 30, cy + 20, 18, s);
    const boneGrad = ctx.createLinearGradient(cx - 34, cy - 18, cx - 14, cy - 8);
    boneGrad.addColorStop(0, '#fffdf5');
    boneGrad.addColorStop(0.6, '#efe0be');
    boneGrad.addColorStop(1, '#9d855f');
    ctx.fillStyle = boneGrad;
    drawRoundedRect(ctx, cx - 33, cy - 18, 17, 8, 4);
    ctx.fill();
  }

  // Ear with inner AO recess
  const earGrad = ctx.createRadialGradient(cx - 28, cy + 2, 1, cx - 26, cy + 4, 9);
  earGrad.addColorStop(0, s.skinLight);
  earGrad.addColorStop(0.7, s.skinMid);
  earGrad.addColorStop(1, s.skinShadow);
  ctx.fillStyle = earGrad;
  ctx.beginPath();
  ctx.ellipse(cx - 27, cy + 4, 6.5, 8.5, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = s.skinAO;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(cx - 27, cy + 5, 3, 4.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 3D Sphere Head Base (top-left key light -> deep warm bottom-right shadow)
  const headGrad = ctx.createRadialGradient(cx - 12, cy - 13, 4, cx + 4, cy + 4, 34);
  headGrad.addColorStop(0, s.skinSpec);
  headGrad.addColorStop(0.26, s.skinLight);
  headGrad.addColorStop(0.64, s.skinMid);
  headGrad.addColorStop(0.9, s.skinShadow);
  headGrad.addColorStop(1, s.skinAO);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 29, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rim highlight on jaw edge
  ctx.strokeStyle = s.skinRim;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 27.2, 0.2, 1.35);
  ctx.stroke();

  // Brow AO under hair
  ctx.fillStyle = s.skinAO;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 13, 25, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Volumetric 3D Beard for male-2
  if (s.beard) {
    const beardGrad = ctx.createRadialGradient(cx - 4, cy + 12, 4, cx + 4, cy + 20, 29);
    beardGrad.addColorStop(0, s.hairLight);
    beardGrad.addColorStop(0.58, s.hairMid);
    beardGrad.addColorStop(1, s.hairDark);
    ctx.fillStyle = beardGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 6);
    ctx.bezierCurveTo(cx - 24, cy + 32, cx - 10, cy + 36, cx + 3, cy + 36);
    ctx.bezierCurveTo(cx + 16, cy + 36, cx + 27, cy + 28, cx + 27, cy + 6);
    ctx.quadraticCurveTo(cx + 14, cy + 16, cx + 3, cy + 13);
    ctx.quadraticCurveTo(cx - 12, cy + 16, cx - 26, cy + 6);
    ctx.fill();

    drawHairLock(ctx, cx - 14, cy + 17, cx - 6, cy + 28, cx + 2, cy + 32, 6, s);
    drawHairLock(ctx, cx + 18, cy + 16, cx + 14, cy + 27, cx + 7, cy + 31, 6, s);
  }

  drawSkinTextureAndBlush(ctx, s, cx, cy, false);

  // Expressive 3/4 eyes
  const eyeLeftX = cx - 5;
  const eyeRightX = cx + 14;
  const eyeY = cy + 1;
  const eyeScale = lifeStage === 'CHILD' ? 1.18 : 1;
  draw3DEye(ctx, eyeLeftX, eyeY, 6.4 * eyeScale, 7.8 * eyeScale, s, blink, 1.3);
  draw3DEye(ctx, eyeRightX, eyeY, 5.6 * eyeScale, 7.6 * eyeScale, s, blink, 1.1);

  if (lifeStage === 'ELDER') {
    ctx.strokeStyle = 'rgba(110, 58, 34, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(eyeLeftX - 7, eyeY + 3);
    ctx.lineTo(eyeLeftX - 11, eyeY + 5);
    ctx.stroke();
  }

  // Nose shadow & sculpted 3D nose tip
  ctx.fillStyle = 'rgba(110, 50, 26, 0.34)';
  ctx.beginPath();
  ctx.ellipse(cx + 7, cy + 9, 5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const noseGrad = ctx.createRadialGradient(cx + 4, cy + 5, 1, cx + 6, cy + 7, 5.5);
  noseGrad.addColorStop(0, s.skinSpec);
  noseGrad.addColorStop(0.65, s.skinMid);
  noseGrad.addColorStop(1, s.skinShadow);
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.ellipse(cx + 6, cy + 7, 5, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Brow ridges
  ctx.strokeStyle = s.hairMid;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(eyeLeftX - 5.5, eyeY - 10.5);
  ctx.quadraticCurveTo(eyeLeftX, eyeY - 13, eyeLeftX + 5.5, eyeY - 10.5);
  ctx.moveTo(eyeRightX - 5, eyeY - 10.5);
  ctx.quadraticCurveTo(eyeRightX, eyeY - 13, eyeRightX + 5, eyeY - 10.5);
  ctx.stroke();

  if (!s.beard) {
    ctx.strokeStyle = '#8b412b';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 5, cy + 13, 5.4, 0.2, Math.PI - 0.35);
    ctx.stroke();
  }

  // Shaggy layered 3D hair locks
  const hairGrad = ctx.createRadialGradient(cx - 10, cy - 26, 4, cx + 2, cy - 12, 34);
  hairGrad.addColorStop(0, s.hairLight);
  hairGrad.addColorStop(0.58, s.hairMid);
  hairGrad.addColorStop(1, s.hairDark);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 30, Math.PI * 0.9, Math.PI * 2.08);
  ctx.quadraticCurveTo(cx + 8, cy - 15, cx - 29, cy - 2);
  ctx.fill();

  if (s.female) {
    drawHairLock(ctx, cx - 25, cy - 4, cx - 14, cy - 22, cx + 2, cy - 14, 11, s);
    drawHairLock(ctx, cx + 2, cy - 14, cx + 16, cy - 20, cx + 26, cy - 9, 9, s);
  } else {
    drawHairLock(ctx, cx - 26, cy - 4, cx - 20, cy - 27, cx - 6, cy - 14, 10, s);
    drawHairLock(ctx, cx - 6, cy - 14, cx + 4, cy - 35, cx + 14, cy - 14, 10, s);
    drawHairLock(ctx, cx + 12, cy - 14, cx + 22, cy - 28, cx + 28, cy - 9, 8.5, s);
  }

  ctx.strokeStyle = s.hairSpec;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 14, 16, Math.PI * 1.15, Math.PI * 1.72);
  ctx.stroke();
}

function drawVillagerHeadBack3D(
  ctx: CanvasRenderingContext2D,
  s: VillagerSpec,
  cx: number,
  cy: number
): void {
  // Ear peeks from left/right sides
  for (const side of [-1, 1]) {
    const ex = cx + side * 28;
    const earGrad = ctx.createRadialGradient(ex - 2, cy + 1, 1, ex, cy + 4, 8);
    earGrad.addColorStop(0, side < 0 ? s.skinLight : s.skinMid);
    earGrad.addColorStop(1, s.skinShadow);
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(ex, cy + 4, 5.5, 8, side * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lower nape skin shadow
  const napeGrad = ctx.createRadialGradient(cx - 6, cy + 14, 3, cx + 2, cy + 18, 22);
  napeGrad.addColorStop(0, s.skinMid);
  napeGrad.addColorStop(1, s.skinAO);
  ctx.fillStyle = napeGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 21, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Full 3D back-of-head hair dome
  const hairGrad = ctx.createRadialGradient(cx - 12, cy - 14, 5, cx + 4, cy + 2, 34);
  hairGrad.addColorStop(0, s.hairLight);
  hairGrad.addColorStop(0.55, s.hairMid);
  hairGrad.addColorStop(1, s.hairDark);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 30, 29, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tousled shaggy locks overlapping nape & crown
  drawHairLock(ctx, cx - 22, cy - 10, cx - 18, cy + 8, cx - 13, cy + 24, 10, s);
  drawHairLock(ctx, cx - 10, cy - 14, cx - 6, cy + 6, cx - 2, cy + 25, 11, s);
  drawHairLock(ctx, cx + 6, cy - 14, cx + 8, cy + 6, cx + 8, cy + 24, 10, s);
  drawHairLock(ctx, cx + 20, cy - 10, cx + 20, cy + 8, cx + 16, cy + 22, 9, s);

  if (!s.female) {
    drawHairLock(ctx, cx - 12, cy - 24, cx - 2, cy - 35, cx + 8, cy - 23, 9, s);
  } else {
    // Centered sculpted ponytail & bone clip on the back of Ая's head
    const boneGrad = ctx.createLinearGradient(cx - 14, cy - 4, cx + 14, cy + 6);
    boneGrad.addColorStop(0, '#fffdf5');
    boneGrad.addColorStop(0.6, '#efe0be');
    boneGrad.addColorStop(1, '#9d855f');
    ctx.fillStyle = boneGrad;
    drawRoundedRect(ctx, cx - 14, cy - 3, 28, 9, 4.5);
    ctx.fill();

    drawHairLock(ctx, cx, cy + 2, cx - 4, cy + 18, cx - 2, cy + 34, 18, s);
  }

  // Sunlit crown rim
  ctx.strokeStyle = s.hairSpec;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 12, 18, Math.PI * 1.1, Math.PI * 1.65);
  ctx.stroke();
}

function drawFurTunic3D(
  ctx: CanvasRenderingContext2D,
  s: VillagerSpec,
  cx: number,
  top: number,
  view: 'front' | 'side' | 'back'
): void {
  const halfW = view === 'side' ? 25 : 28;
  const lightShiftX = view === 'side' ? -10 : -14;

  // Volumetric 3D fur tunic body (top-left sunlit -> deep warm core shadow on bottom-right)
  const bodyGrad = ctx.createRadialGradient(
    cx + lightShiftX,
    top + 14,
    5,
    cx + 6,
    top + 32,
    46
  );
  bodyGrad.addColorStop(0, s.tunicLight);
  bodyGrad.addColorStop(0.45, s.tunicMid);
  bodyGrad.addColorStop(0.84, s.tunicDark);
  bodyGrad.addColorStop(1, s.tunicDeep);
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  ctx.moveTo(cx - (halfW - 6), top + 7);
  ctx.quadraticCurveTo(cx, top, cx + (halfW - 6), top + 7);
  ctx.quadraticCurveTo(cx + halfW + 3, top + 28, cx + halfW, top + 50);
  ctx.lineTo(cx + 17, top + 61);
  ctx.lineTo(cx + 7, top + 53);
  ctx.lineTo(cx - 2, top + 63);
  ctx.lineTo(cx - 13, top + 52);
  ctx.lineTo(cx - halfW, top + 59);
  ctx.quadraticCurveTo(cx - halfW - 2, top + 28, cx - (halfW - 6), top + 7);
  ctx.closePath();
  ctx.fill();

  // Warm bounce rim light on right silhouette edge
  ctx.strokeStyle = s.tunicRim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + halfW - 3, top + 14);
  ctx.quadraticCurveTo(cx + halfW + 1, top + 30, cx + halfW - 2, top + 46);
  ctx.stroke();

  // Shaggy fur collar tuft around shoulders
  const collarPuffs = [-14, -5, 5, 14];
  for (const px of collarPuffs) {
    const cg = ctx.createRadialGradient(cx + px - 2, top + 7, 1, cx + px, top + 10, 10);
    cg.addColorStop(0, '#f7ebd4');
    cg.addColorStop(0.65, '#ceb48e');
    cg.addColorStop(1, '#7a5f3e');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx + px, top + 10, 7.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Coarse fur bristle hatch strokes & pelt spots
  ctx.strokeStyle = 'rgba(46, 20, 6, 0.28)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const fx = cx - 16 + ((i * 11) % 34);
    const fy = top + 18 + ((i * 13) % 32);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + (i % 2 === 0 ? -2 : 2), fy + 6);
    ctx.stroke();
  }

  ctx.fillStyle = s.spot;
  ctx.globalAlpha = 0.72;
  const spots = [
    { x: cx - 11, y: top + 24, r: 4.8 },
    { x: cx + 11, y: top + 29, r: 4.5 },
    { x: cx - 4, y: top + 40, r: 4 }
  ];
  for (const sp of spots) {
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Soft AO shadow cast from head onto collar/chest
  const chinAO = ctx.createRadialGradient(cx, top + 8, 2, cx, top + 12, 18);
  chinAO.addColorStop(0, 'rgba(36, 14, 4, 0.52)');
  chinAO.addColorStop(1, 'rgba(36, 14, 4, 0)');
  ctx.fillStyle = chinAO;
  ctx.beginPath();
  ctx.ellipse(cx, top + 12, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal stitched leather strap (flips direction on back view so strap wraps naturally!)
  const sx1 = view === 'back' ? cx + 18 : cx - 18;
  const sx2 = view === 'back' ? cx - 18 : cx + 19;

  ctx.strokeStyle = 'rgba(28, 12, 3, 0.38)';
  ctx.lineWidth = 9.5;
  ctx.beginPath();
  ctx.moveTo(sx1, top + 11);
  ctx.lineTo(sx2, top + 41);
  ctx.stroke();

  const strapGrad = ctx.createLinearGradient(sx1, top + 8, sx2, top + 38);
  strapGrad.addColorStop(0, '#965e36');
  strapGrad.addColorStop(1, '#4c2911');
  ctx.strokeStyle = strapGrad;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(sx1, top + 8);
  ctx.lineTo(sx2, top + 38);
  ctx.stroke();

  // Rawhide X-stitches on strap
  ctx.strokeStyle = '#ecd5b0';
  ctx.lineWidth = 1.6;
  const mx = (sx1 + sx2) * 0.5;
  const my = top + 23;
  ctx.beginPath();
  ctx.moveTo(mx - 3, my - 3);
  ctx.lineTo(mx + 3, my + 3);
  ctx.moveTo(mx + 3, my - 3);
  ctx.lineTo(mx - 3, my + 3);
  ctx.stroke();

  // Belt AO shadow
  ctx.fillStyle = 'rgba(26, 10, 2, 0.45)';
  drawRoundedRect(ctx, cx - (halfW - 1), top + 38, (halfW - 1) * 2, 12, 4);
  ctx.fill();

  // Thick leather belt
  const beltGrad = ctx.createLinearGradient(cx - halfW, top + 35, cx + halfW, top + 45);
  beltGrad.addColorStop(0, '#925930');
  beltGrad.addColorStop(0.5, '#683a1a');
  beltGrad.addColorStop(1, '#3d1f0a');
  ctx.fillStyle = beltGrad;
  drawRoundedRect(ctx, cx - (halfW - 1), top + 35, (halfW - 1) * 2, 10, 4);
  ctx.fill();

  // Carved bone buckle on front/side; leather tie on back
  if (view !== 'back') {
    const bx = view === 'front' ? cx - 6 : cx - 3;
    const buckleGrad = ctx.createRadialGradient(bx + 4, top + 38, 1, bx + 6, top + 40, 8);
    buckleGrad.addColorStop(0, '#fffdf5');
    buckleGrad.addColorStop(0.65, '#ede0c4');
    buckleGrad.addColorStop(1, '#9d8764');
    ctx.fillStyle = buckleGrad;
    drawRoundedRect(ctx, bx, top + 33.5, 13, 13, 3.5);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#ecd5b0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, top + 37);
    ctx.lineTo(cx + 4, top + 43);
    ctx.moveTo(cx + 4, top + 37);
    ctx.lineTo(cx - 4, top + 43);
    ctx.stroke();
  }
}

function createVillagerTextures(scene: Phaser.Scene): void {
  const makeHeadAndPortrait = (
    prefix: string,
    portraitKey: string,
    hs: VillagerSpec,
    lifeStage: LifeStage = 'ADULT'
  ) => {
    // 2x Oversampled Directional Heads (120x120 -> rendered at 0.5 scale)
    makeCanvas(scene, `${prefix}-head-front`, 120, 120, (ctx) => {
      drawVillagerHeadFront3D(ctx, hs, 60, 62, false, lifeStage);
    });
    makeCanvas(scene, `${prefix}-head-front-blink`, 120, 120, (ctx) => {
      drawVillagerHeadFront3D(ctx, hs, 60, 62, true, lifeStage);
    });
    makeCanvas(scene, `${prefix}-head-side`, 120, 120, (ctx) => {
      drawVillagerHeadSide3D(ctx, hs, 60, 62, false, lifeStage);
    });
    makeCanvas(scene, `${prefix}-head-side-blink`, 120, 120, (ctx) => {
      drawVillagerHeadSide3D(ctx, hs, 60, 62, true, lifeStage);
    });
    makeCanvas(scene, `${prefix}-head-back`, 120, 120, (ctx) => {
      drawVillagerHeadBack3D(ctx, hs, 60, 62);
    });

    // 2x Oversampled 3D Bust Portrait for UI card (128x128 -> 0.52 scale)
    makeCanvas(scene, portraitKey, 128, 128, (ctx) => {
      const bg = ctx.createRadialGradient(54, 46, 10, 64, 64, 60);
      if (lifeStage === 'CHILD') {
        bg.addColorStop(0, '#4d8b55');
        bg.addColorStop(1, '#1b3822');
      } else if (lifeStage === 'ELDER') {
        bg.addColorStop(0, '#64748b');
        bg.addColorStop(1, '#1e293b');
      } else {
        bg.addColorStop(0, '#8a6240');
        bg.addColorStop(1, '#26180e');
      }
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(64, 64, 55, 0, Math.PI * 2);
      ctx.clip();

      const shGrad = ctx.createRadialGradient(50, 96, 8, 64, 114, 46);
      shGrad.addColorStop(0, hs.tunicLight);
      shGrad.addColorStop(0.6, hs.tunicMid);
      shGrad.addColorStop(1, hs.tunicDark);
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(64, 116, 44, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      drawVillagerHeadFront3D(ctx, hs, 64, 62, false, lifeStage);
      ctx.restore();

      const ringGrad = ctx.createLinearGradient(16, 16, 112, 112);
      if (lifeStage === 'ELDER') {
        ringGrad.addColorStop(0, '#e2e8f0');
        ringGrad.addColorStop(0.5, '#94a3b8');
        ringGrad.addColorStop(1, '#475569');
      } else if (lifeStage === 'CHILD') {
        ringGrad.addColorStop(0, '#bef264');
        ringGrad.addColorStop(0.5, '#4ade80');
        ringGrad.addColorStop(1, '#15803d');
      } else {
        ringGrad.addColorStop(0, '#ffe082');
        ringGrad.addColorStop(0.5, '#d99b52');
        ringGrad.addColorStop(1, '#8a5823');
      }
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(64, 64, 57.5, 0, Math.PI * 2);
      ctx.stroke();
    });
  };

  for (const s of VILLAGER_SPECS) {
    makeHeadAndPortrait(`v-${s.id}`, `portrait-${s.id}`, s, 'ADULT');

    // Child variant matching exact villager palette (smooth unscarred skin, bigger sparkling eyes)
    makeHeadAndPortrait(
      `v-${s.id}-child`,
      `portrait-${s.id}-child`,
      {
        ...s,
        beard: false,
        scar: false
      },
      'CHILD'
    );

    // Silver-haired elder variant (male elders grow a distinguished white beard)
    const elderSpec: VillagerSpec = {
      ...s,
      hairLight: '#f1f5f9',
      hairMid: '#cbd5e1',
      hairDark: '#64748b',
      hairSpec: 'rgba(255, 255, 255, 0.55)',
      beard: !s.female
    };
    makeHeadAndPortrait(`v-${s.id}-elder`, `portrait-${s.id}-elder`, elderSpec, 'ELDER');

    // 2x Oversampled Directional Torsos (104x104 -> rendered at 0.5 scale)
    (['front', 'side', 'back'] as const).forEach((view) => {
      makeCanvas(scene, `v-${s.id}-torso-${view}`, 104, 104, (ctx) => {
        drawFurTunic3D(ctx, s, 52, 14, view);
      });
    });

    // 2x Oversampled 3D Leg with sculpted knee & laced moccasin (48x64 -> 0.5 scale)
    makeCanvas(scene, `v-${s.id}-leg`, 48, 64, (ctx) => {
      const legGrad = ctx.createRadialGradient(20, 12, 2, 24, 18, 16);
      legGrad.addColorStop(0, s.skinSpec);
      legGrad.addColorStop(0.45, s.skinLight);
      legGrad.addColorStop(0.85, s.skinMid);
      legGrad.addColorStop(1, s.skinShadow);
      ctx.fillStyle = legGrad;
      drawRoundedRect(ctx, 15, 5, 17, 29, 8);
      ctx.fill();

      // Knee cap highlight & lower knee crease shadow
      ctx.fillStyle = 'rgba(255, 238, 222, 0.35)';
      ctx.beginPath();
      ctx.ellipse(21, 17, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fur cuff trim
      const cuffGrad = ctx.createLinearGradient(14, 24, 34, 31);
      cuffGrad.addColorStop(0, '#f5e8cf');
      cuffGrad.addColorStop(1, '#a98e68');
      ctx.fillStyle = cuffGrad;
      drawRoundedRect(ctx, 13.5, 23, 21, 8, 4);
      ctx.fill();

      // Laced 3D leather moccasin boot
      const bootGrad = ctx.createRadialGradient(20, 33, 2, 25, 39, 18);
      bootGrad.addColorStop(0, '#a66b40');
      bootGrad.addColorStop(0.6, '#6d3f1e');
      bootGrad.addColorStop(1, '#3b1f0b');
      ctx.fillStyle = bootGrad;
      drawRoundedRect(ctx, 13, 28, 24, 19, 8.5);
      ctx.fill();

      // Sole shadow edge
      ctx.fillStyle = '#291406';
      drawRoundedRect(ctx, 13.5, 42, 23, 5, 2.5);
      ctx.fill();
    });

    // 2x Oversampled 3D Arm with deltoid shoulder, wrist wrap & fist (48x64 -> 0.5 scale)
    makeCanvas(scene, `v-${s.id}-arm`, 48, 64, (ctx) => {
      // Rounded shoulder deltoid + forearm shading
      const armGrad = ctx.createRadialGradient(19, 12, 2, 24, 22, 20);
      armGrad.addColorStop(0, s.skinSpec);
      armGrad.addColorStop(0.35, s.skinLight);
      armGrad.addColorStop(0.78, s.skinMid);
      armGrad.addColorStop(1, s.skinShadow);
      ctx.fillStyle = armGrad;
      drawRoundedRect(ctx, 15.5, 5, 17, 34, 8.5);
      ctx.fill();

      // Rawhide wrist band
      ctx.fillStyle = '#6d3f1e';
      drawRoundedRect(ctx, 15.5, 30, 17, 6, 3);
      ctx.fill();

      // Sculpted 3D fist/hand
      const fistGrad = ctx.createRadialGradient(21, 39, 2, 25, 42, 11);
      fistGrad.addColorStop(0, s.skinSpec);
      fistGrad.addColorStop(0.5, s.skinLight);
      fistGrad.addColorStop(1, s.skinShadow);
      ctx.fillStyle = fistGrad;
      ctx.beginPath();
      ctx.arc(24, 42, 9.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Child heads & UI portraits (smooth unscarred skin, no beard)
  makeHeadAndPortrait(
    'v-child-male',
    'portrait-child-male',
    {
      ...VILLAGER_SPECS[0],
      beard: false,
      scar: false
    },
    'CHILD'
  );
  makeHeadAndPortrait(
    'v-child-female',
    'portrait-child-female',
    {
      ...VILLAGER_SPECS[2],
      beard: false,
      scar: false
    },
    'CHILD'
  );
}

function createToolsAndCarryTextures(scene: Phaser.Scene): void {
  // 2x Oversampled 3D Stone Axe (56x64 -> 0.5 scale)
  makeCanvas(scene, 'tool-axe', 56, 64, (ctx) => {
    const shaftGrad = ctx.createLinearGradient(22, 12, 32, 56);
    shaftGrad.addColorStop(0, '#b57845');
    shaftGrad.addColorStop(1, '#633b1d');
    ctx.fillStyle = shaftGrad;
    drawRoundedRect(ctx, 22, 12, 10, 44, 5);
    ctx.fill();

    const bladeGrad = ctx.createLinearGradient(26, 8, 50, 28);
    bladeGrad.addColorStop(0, '#e2e8f0');
    bladeGrad.addColorStop(0.5, '#94a3b8');
    bladeGrad.addColorStop(1, '#475569');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(26, 10);
    ctx.quadraticCurveTo(46, 6, 50, 22);
    ctx.quadraticCurveTo(42, 32, 26, 28);
    ctx.closePath();
    ctx.fill();

    // Specular blade edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(45, 11);
    ctx.quadraticCurveTo(49, 20, 45, 26);
    ctx.stroke();

    // Rawhide lashings
    ctx.strokeStyle = '#e6c29f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, 16);
    ctx.lineTo(32, 24);
    ctx.stroke();
  });

  // 2x Oversampled 3D Stone Pickaxe (56x64 -> 0.5 scale)
  makeCanvas(scene, 'tool-pickaxe', 56, 64, (ctx) => {
    const shaftGrad = ctx.createLinearGradient(22, 14, 32, 56);
    shaftGrad.addColorStop(0, '#b57845');
    shaftGrad.addColorStop(1, '#633b1d');
    ctx.fillStyle = shaftGrad;
    drawRoundedRect(ctx, 22, 14, 10, 42, 5);
    ctx.fill();

    const headGrad = ctx.createLinearGradient(6, 14, 50, 26);
    headGrad.addColorStop(0, '#cbd5e1');
    headGrad.addColorStop(0.5, '#94a3b8');
    headGrad.addColorStop(1, '#475569');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.quadraticCurveTo(28, 6, 50, 26);
    ctx.quadraticCurveTo(28, 18, 8, 28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e6c29f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, 15);
    ctx.lineTo(32, 22);
    ctx.stroke();
  });

  // 2x Oversampled 3D Wooden Club (44x60 -> 0.5 scale)
  makeCanvas(scene, 'tool-club', 44, 60, (ctx) => {
    const clubGrad = ctx.createLinearGradient(14, 12, 30, 52);
    clubGrad.addColorStop(0, '#bd7f4a');
    clubGrad.addColorStop(0.55, '#8b5730');
    clubGrad.addColorStop(1, '#543118');
    ctx.fillStyle = clubGrad;
    ctx.beginPath();
    ctx.moveTo(18, 52);
    ctx.lineTo(14, 16);
    ctx.quadraticCurveTo(22, 6, 30, 16);
    ctx.lineTo(26, 52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 228, 196, 0.32)';
    ctx.beginPath();
    ctx.ellipse(19, 22, 2.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2x Oversampled 3D Fishing Spear (64x72 -> 0.5 scale)
  makeCanvas(scene, 'tool-spear', 64, 72, (ctx) => {
    const shaftGrad = ctx.createLinearGradient(18, 16, 42, 64);
    shaftGrad.addColorStop(0, '#c4864f');
    shaftGrad.addColorStop(1, '#6e4321');
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(31, 66);
    ctx.lineTo(31, 18);
    ctx.stroke();

    // Chiseled flint spear tip
    const tipGrad = ctx.createLinearGradient(22, 4, 40, 22);
    tipGrad.addColorStop(0, '#e2e8f0');
    tipGrad.addColorStop(0.6, '#94a3b8');
    tipGrad.addColorStop(1, '#475569');
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.moveTo(31, 3);
    ctx.lineTo(40, 21);
    ctx.lineTo(31, 17);
    ctx.lineTo(22, 21);
    ctx.closePath();
    ctx.fill();

    // Lashings
    ctx.strokeStyle = '#e6c29f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(26, 20);
    ctx.lineTo(36, 23);
    ctx.stroke();
  });

  // 2x Oversampled 3D Stone Builder Mallet (56x64 -> 0.5 scale)
  makeCanvas(scene, 'tool-hammer', 56, 64, (ctx) => {
    const shaftGrad = ctx.createLinearGradient(22, 14, 32, 56);
    shaftGrad.addColorStop(0, '#b57845');
    shaftGrad.addColorStop(1, '#633b1d');
    ctx.fillStyle = shaftGrad;
    drawRoundedRect(ctx, 22.5, 16, 10, 40, 5);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(22, 12, 3, 28, 16, 18);
    headGrad.addColorStop(0, '#e2e8f0');
    headGrad.addColorStop(0.55, '#94a3b8');
    headGrad.addColorStop(1, '#475569');
    ctx.fillStyle = headGrad;
    drawRoundedRect(ctx, 11, 7, 34, 18, 6);
    ctx.fill();

    ctx.strokeStyle = '#e6c29f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(33, 24);
    ctx.stroke();
  });

  // 2x Oversampled 3D Elder Walking Staff (48x68 -> 0.5 scale)
  makeCanvas(scene, 'tool-staff', 48, 68, (ctx) => {
    const woodGrad = ctx.createLinearGradient(18, 10, 30, 64);
    woodGrad.addColorStop(0, '#c08552');
    woodGrad.addColorStop(0.55, '#8a552a');
    woodGrad.addColorStop(1, '#4c2b10');
    ctx.strokeStyle = woodGrad;
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 63);
    ctx.lineTo(24, 22);
    ctx.bezierCurveTo(24, 10, 35, 8, 36, 17);
    ctx.stroke();

    // Leather grip wrap
    ctx.strokeStyle = '#6d3f1e';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(24, 34);
    ctx.lineTo(24, 44);
    ctx.stroke();

    // Suspended wooden/bone charm bead at crook
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(35, 22, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(35, 22, 2.1, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2x Oversampled 3D Chief Horned Animal Skull Headdress (76x52 -> 0.5 scale)
  makeCanvas(scene, 'chief-crown', 76, 52, (ctx) => {
    const drawHorn = (dir: -1 | 1) => {
      const hx = 38 + dir * 13;
      const hy = 25;
      const tx = 38 + dir * 34;
      const ty = 6;
      const g = ctx.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, '#d6cbb8');
      g.addColorStop(0.55, '#64748b');
      g.addColorStop(1, '#1e293b');
      ctx.fillStyle = g;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 5);
      ctx.quadraticCurveTo(38 + dir * 28, 26, tx, ty);
      ctx.quadraticCurveTo(38 + dir * 24, 15, hx, hy - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ivory highlight ridge along horn
      ctx.strokeStyle = 'rgba(255, 250, 235, 0.55)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(hx + dir * 2, hy - 1);
      ctx.quadraticCurveTo(38 + dir * 23, 19, tx - dir * 3, ty + 3);
      ctx.stroke();
    };

    drawHorn(-1);
    drawHorn(1);

    // Braided leather strap around forehead
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 17, 31, 42, 11, 5);
    ctx.fill();
    ctx.stroke();

    // Sculpted animal cranium cap
    const skullGrad = ctx.createRadialGradient(34, 22, 3, 38, 28, 19);
    skullGrad.addColorStop(0, '#fffef7');
    skullGrad.addColorStop(0.65, '#eae0cb');
    skullGrad.addColorStop(1, '#a89984');
    ctx.fillStyle = skullGrad;
    ctx.beginPath();
    ctx.moveTo(22, 32);
    ctx.quadraticCurveTo(21, 14, 38, 12);
    ctx.quadraticCurveTo(55, 14, 54, 32);
    ctx.lineTo(46, 44);
    ctx.quadraticCurveTo(38, 48, 30, 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hollow animal eye sockets & nasal cavity
    ctx.fillStyle = '#1f1610';
    ctx.beginPath();
    ctx.ellipse(30, 29, 4.2, 3.3, -0.25, 0, Math.PI * 2);
    ctx.ellipse(46, 29, 4.2, 3.3, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(36, 39);
    ctx.lineTo(38, 35);
    ctx.lineTo(40, 39);
    ctx.lineTo(38, 42);
    ctx.closePath();
    ctx.fill();

    // Small ochre/turquoise bead accents on strap
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(23, 36.5, 2, 0, Math.PI * 2);
    ctx.arc(53, 36.5, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2x Oversampled 3D Sharp Starter Flint Stone (48x48 -> 0.5 scale)
  makeCanvas(scene, 'tool-sharp-stone', 48, 48, (ctx) => {
    const g = ctx.createRadialGradient(20, 18, 2, 24, 24, 18);
    g.addColorStop(0, '#e2e8f0');
    g.addColorStop(0.55, '#94a3b8');
    g.addColorStop(1, '#475569');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 6);
    ctx.lineTo(38, 17);
    ctx.lineTo(35, 36);
    ctx.lineTo(22, 42);
    ctx.lineTo(10, 32);
    ctx.lineTo(13, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 9);
    ctx.lineTo(34, 18);
    ctx.lineTo(24, 25);
    ctx.stroke();
  });

  // Thrown Sharp Stone Projectile (20x20)
  makeCanvas(scene, 'projectile-stone', 20, 20, (ctx) => {
    const g = ctx.createRadialGradient(8, 7, 1, 10, 10, 8);
    g.addColorStop(0, '#e2e8f0');
    g.addColorStop(0.6, '#64748b');
    g.addColorStop(1, '#334155');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, 3);
    ctx.lineTo(17, 9);
    ctx.lineTo(13, 17);
    ctx.lineTo(4, 15);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.fill();
  });

  // Thrown Hunting Spear Projectile (48x16)
  makeCanvas(scene, 'projectile-spear', 48, 16, (ctx) => {
    const shaft = ctx.createLinearGradient(2, 8, 36, 8);
    shaft.addColorStop(0, '#7c4b27');
    shaft.addColorStop(1, '#b57845');
    ctx.strokeStyle = shaft;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 8);
    ctx.lineTo(34, 8);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(32, 3);
    ctx.lineTo(46, 8);
    ctx.lineTo(32, 13);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e6c29f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(32, 5);
    ctx.lineTo(32, 11);
    ctx.stroke();
  });

  // Wading Waist-Deep Water Ripple Ring (64x26)
  makeCanvas(scene, 'wade-water-ring', 64, 26, (ctx) => {
    const waterGrad = ctx.createRadialGradient(32, 13, 4, 32, 13, 30);
    waterGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    waterGrad.addColorStop(0.75, 'rgba(186, 230, 253, 0.65)');
    waterGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(32, 13, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(240, 249, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(32, 13, 22, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(32, 13, 14, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 2x Oversampled Tiered 3D Carried Armloads 1..5 (88x72 -> 0.5 scale)
  for (let count = 1; count <= 5; count++) {
    // Wood logs armload
    makeCanvas(scene, `carry-wood-${count}`, 88, 72, (ctx) => {
      const positions = [
        { x: 20, y: 40 },
        { x: 36, y: 34 },
        { x: 28, y: 26 },
        { x: 44, y: 42 },
        { x: 32, y: 16 }
      ];
      for (let i = 0; i < count; i++) {
        const p = positions[i];
        const logGrad = ctx.createLinearGradient(p.x - 14, p.y - 6, p.x - 14, p.y + 10);
        logGrad.addColorStop(0, '#a66d3f');
        logGrad.addColorStop(0.6, '#7c4b27');
        logGrad.addColorStop(1, '#4f2c14');
        ctx.fillStyle = logGrad;
        drawRoundedRect(ctx, p.x - 14, p.y - 6, 48, 15, 7);
        ctx.fill();

        const endGrad = ctx.createRadialGradient(p.x + 29, p.y + 1, 1, p.x + 30, p.y + 1.5, 7);
        endGrad.addColorStop(0, '#f5d9b8');
        endGrad.addColorStop(1, '#c99b68');
        ctx.fillStyle = endGrad;
        ctx.beginPath();
        ctx.ellipse(p.x + 30, p.y + 1.5, 5.2, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Stone armload
    makeCanvas(scene, `carry-stone-${count}`, 88, 72, (ctx) => {
      const positions = [
        { x: 36, y: 44, r: 13 },
        { x: 54, y: 44, r: 12 },
        { x: 44, y: 30, r: 12 },
        { x: 26, y: 34, r: 10.5 },
        { x: 48, y: 18, r: 10.5 }
      ];
      for (let i = 0; i < count; i++) {
        const p = positions[i];
        const stGrad = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, 2, p.x, p.y, p.r);
        stGrad.addColorStop(0, '#dce2ea');
        stGrad.addColorStop(0.55, '#949ea9');
        stGrad.addColorStop(1, '#525964');
        ctx.fillStyle = stGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Food basket / berry armload
    makeCanvas(scene, `carry-food-${count}`, 88, 72, (ctx) => {
      const bGrad = ctx.createLinearGradient(20, 34, 68, 58);
      bGrad.addColorStop(0, '#dfaa62');
      bGrad.addColorStop(0.6, '#b87a34');
      bGrad.addColorStop(1, '#7c4d19');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(20, 34);
      ctx.lineTo(28, 56);
      ctx.quadraticCurveTo(44, 62, 60, 56);
      ctx.lineTo(68, 34);
      ctx.closePath();
      ctx.fill();

      const berryOffsets = [
        { x: 34, y: 32, c: '#ef233c', d: '#9d0208' },
        { x: 50, y: 32, c: '#ff4d6d', d: '#b51738' },
        { x: 42, y: 24, c: '#ef233c', d: '#9d0208' },
        { x: 28, y: 24, c: '#d90429', d: '#7a0214' },
        { x: 56, y: 24, c: '#ff4d6d', d: '#b51738' }
      ];
      for (let i = 0; i < count; i++) {
        const b = berryOffsets[i];
        const bg = ctx.createRadialGradient(b.x - 2.5, b.y - 2.5, 1, b.x, b.y, 8.5);
        bg.addColorStop(0, '#ffd6de');
        bg.addColorStop(0.25, b.c);
        bg.addColorStop(1, b.d);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Fish bundle armload (1..5 glossy blue-silver fish)
    makeCanvas(scene, `carry-fish-${count}`, 88, 72, (ctx) => {
      const offsets = [
        { x: 44, y: 46, a: -0.15 },
        { x: 42, y: 37, a: 0.1 },
        { x: 46, y: 28, a: -0.08 },
        { x: 39, y: 20, a: 0.16 },
        { x: 47, y: 13, a: -0.12 }
      ];
      for (let i = 0; i < count; i++) {
        const f = offsets[i];
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.a);

        // Tail fin
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-26, -7);
        ctx.lineTo(-23, 0);
        ctx.lineTo(-26, 7);
        ctx.closePath();
        ctx.fill();

        // 3D fish body
        const fishGrad = ctx.createLinearGradient(0, -8, 0, 8);
        fishGrad.addColorStop(0, '#0284c7');
        fishGrad.addColorStop(0.45, '#7dd3fc');
        fishGrad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = fishGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 19, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Specular belly highlight & eye
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(2, -2.5, 10, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(11, -1.5, 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    });

    // Hunted meat haunches armload (1..5)
    makeCanvas(scene, `carry-meat-${count}`, 88, 72, (ctx) => {
      const haunches = [
        { x: 40, y: 44, a: -0.18 },
        { x: 48, y: 36, a: 0.14 },
        { x: 38, y: 27, a: -0.1 },
        { x: 49, y: 22, a: 0.2 },
        { x: 44, y: 15, a: -0.05 }
      ];
      for (let i = 0; i < count; i++) {
        const m = haunches[i];
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.a);

        // Protruding pale bone
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.4;
        drawRoundedRect(ctx, -22, -3.5, 16, 7, 3);
        ctx.fill();
        ctx.stroke();

        // Rich 3D meat haunch
        const meatGrad = ctx.createRadialGradient(-2, -3, 2, 4, 0, 18);
        meatGrad.addColorStop(0, '#fb7185');
        meatGrad.addColorStop(0.5, '#dc2626');
        meatGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = meatGrad;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(4, 0, 15, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 240, 240, 0.55)';
        ctx.beginPath();
        ctx.ellipse(2, -3, 6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    });
  }
}

function createLakeAndDepletedTextures(scene: Phaser.Scene): void {
  // Tree stump (after tree is felled)
  makeCanvas(scene, 'tree-stump', 96, 72, (ctx) => {
    const cx = 48;
    const baseY = 50;

    // Ground shadow + sawdust chips
    const sh = ctx.createRadialGradient(cx + 3, baseY + 2, 4, cx + 3, baseY + 2, 30);
    sh.addColorStop(0, 'rgba(20, 40, 16, 0.38)');
    sh.addColorStop(1, 'rgba(20, 40, 16, 0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx + 3, baseY + 2, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flared roots & bark stump body
    const barkGrad = ctx.createLinearGradient(cx - 18, baseY - 22, cx + 18, baseY + 6);
    barkGrad.addColorStop(0, '#8f5830');
    barkGrad.addColorStop(0.6, '#6a3e1f');
    barkGrad.addColorStop(1, '#472813');
    ctx.fillStyle = barkGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 22, baseY + 4);
    ctx.quadraticCurveTo(cx - 13, baseY - 6, cx - 12, baseY - 20);
    ctx.lineTo(cx + 12, baseY - 20);
    ctx.quadraticCurveTo(cx + 13, baseY - 6, cx + 22, baseY + 4);
    ctx.quadraticCurveTo(cx + 6, baseY + 9, cx, baseY + 5);
    ctx.quadraticCurveTo(cx - 8, baseY + 9, cx - 22, baseY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Freshly cut wood top + concentric growth rings
    ctx.fillStyle = '#e8c49a';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 20, 12.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#c49664';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 20, 8, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 20, 3.5, 1.8, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Scattered sawdust flecks
    ctx.fillStyle = '#e8c49a';
    for (const [sx, sy] of [
      [cx - 25, baseY + 8],
      [cx - 16, baseY + 11],
      [cx + 18, baseY + 9],
      [cx + 26, baseY + 6]
    ]) {
      ctx.fillRect(sx, sy, 4, 2.5);
    }
  });

  // Rock rubble (after rock is mined out)
  makeCanvas(scene, 'rock-rubble', 96, 72, (ctx) => {
    const cx = 48;
    const baseY = 46;

    const dust = ctx.createRadialGradient(cx, baseY + 2, 4, cx, baseY + 2, 34);
    dust.addColorStop(0, 'rgba(130, 125, 114, 0.55)');
    dust.addColorStop(1, 'rgba(130, 125, 114, 0)');
    ctx.fillStyle = dust;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2, 34, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    const chunks = [
      { x: cx - 14, y: baseY + 2, r: 8 },
      { x: cx + 10, y: baseY + 4, r: 7.5 },
      { x: cx - 2, y: baseY - 3, r: 9 },
      { x: cx + 22, y: baseY + 8, r: 5 },
      { x: cx - 23, y: baseY + 7, r: 5.5 },
      { x: cx + 4, y: baseY + 10, r: 5 }
    ];
    for (const c of chunks) {
      const g = ctx.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
      g.addColorStop(0, '#b5bcc6');
      g.addColorStop(1, '#5d646f');
      ctx.fillStyle = g;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c.x - c.r, c.y + c.r * 0.4);
      ctx.lineTo(c.x - c.r * 0.5, c.y - c.r * 0.7);
      ctx.lineTo(c.x + c.r * 0.6, c.y - c.r * 0.6);
      ctx.lineTo(c.x + c.r, c.y + c.r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });

  // Summer Lake (360x240)
  makeCanvas(scene, 'lake-summer', 360, 240, (ctx) => {
    const cx = 180;
    const cy = 120;

    // Sandy/earthy shoreline transition
    const shoreGrad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 174);
    shoreGrad.addColorStop(0, 'rgba(182, 154, 102, 0.95)');
    shoreGrad.addColorStop(0.84, 'rgba(168, 144, 94, 0.85)');
    shoreGrad.addColorStop(1, 'rgba(168, 144, 94, 0)');
    ctx.fillStyle = shoreGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 174, 114, 0, 0, Math.PI * 2);
    ctx.fill();

    // Organic curved water shape
    const drawPondPath = (scale = 1) => {
      ctx.beginPath();
      ctx.moveTo(cx - 144 * scale, cy);
      ctx.bezierCurveTo(
        cx - 148 * scale,
        cy - 86 * scale,
        cx - 46 * scale,
        cy - 102 * scale,
        cx + 18 * scale,
        cy - 92 * scale
      );
      ctx.bezierCurveTo(
        cx + 104 * scale,
        cy - 98 * scale,
        cx + 154 * scale,
        cy - 54 * scale,
        cx + 148 * scale,
        cy + 8 * scale
      );
      ctx.bezierCurveTo(
        cx + 144 * scale,
        cy + 78 * scale,
        cx + 58 * scale,
        cy + 102 * scale,
        cx - 22 * scale,
        cy + 94 * scale
      );
      ctx.bezierCurveTo(
        cx - 104 * scale,
        cy + 98 * scale,
        cx - 142 * scale,
        cy + 58 * scale,
        cx - 144 * scale,
        cy
      );
      ctx.closePath();
    };

    // Shallow turquoise rim -> deep cerulean center
    const waterGrad = ctx.createRadialGradient(cx - 18, cy - 12, 16, cx, cy, 152);
    waterGrad.addColorStop(0, '#0369a1');
    waterGrad.addColorStop(0.5, '#0ea5e9');
    waterGrad.addColorStop(0.85, '#38bdf8');
    waterGrad.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = waterGrad;
    drawPondPath(1);
    ctx.fill();

    // Inner shore caustic glow
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = 4;
    drawPondPath(0.95);
    ctx.stroke();

    // Shore pebbles
    const pebbles = [
      [56, 70],
      [88, 36],
      [274, 42],
      [314, 154],
      [96, 204],
      [230, 210]
    ];
    for (const [px, py] of pebbles) {
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tall shore reeds on north-west and south-east edges
    const drawReeds = (rx: number, ry: number) => {
      drawLeafBlade(ctx, rx, ry, -6, 20, '#3d822a');
      drawLeafBlade(ctx, rx + 5, ry + 2, 2, 24, '#4ea337');
      drawLeafBlade(ctx, rx + 10, ry + 1, 8, 18, '#3d822a');
      ctx.fillStyle = '#6f4222';
      ctx.fillRect(rx + 4, ry - 25, 3.5, 8);
    };
    drawReeds(54, 88);
    drawReeds(290, 174);
  });

  // Winter Frozen Lake (360x240)
  makeCanvas(scene, 'lake-winter', 360, 240, (ctx) => {
    const cx = 180;
    const cy = 120;

    // Frosty snow rim
    const snowRim = ctx.createRadialGradient(cx, cy, 90, cx, cy, 174);
    snowRim.addColorStop(0, 'rgba(226, 238, 248, 0.95)');
    snowRim.addColorStop(0.84, 'rgba(203, 224, 240, 0.85)');
    snowRim.addColorStop(1, 'rgba(203, 224, 240, 0)');
    ctx.fillStyle = snowRim;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 174, 114, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ice sheet
    const iceGrad = ctx.createRadialGradient(cx - 24, cy - 18, 20, cx, cy, 152);
    iceGrad.addColorStop(0, '#e0f2fe');
    iceGrad.addColorStop(0.55, '#bae6fd');
    iceGrad.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 146, 94, 0, 0, Math.PI * 2);
    ctx.fill();

    // Diagonal glossy ice reflections
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 144, 92, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy + 60);
    ctx.lineTo(cx - 20, cy - 90);
    ctx.lineTo(cx + 15, cy - 90);
    ctx.lineTo(cx - 75, cy + 60);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cx + 25, cy + 80);
    ctx.lineTo(cx + 115, cy - 70);
    ctx.lineTo(cx + 135, cy - 70);
    ctx.lineTo(cx + 45, cy + 80);
    ctx.closePath();
    ctx.fill();

    // Crystalline frost cracks
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy - 20);
    ctx.lineTo(cx - 12, cy + 6);
    ctx.lineTo(cx + 38, cy - 16);
    ctx.moveTo(cx - 12, cy + 6);
    ctx.lineTo(cx - 4, cy + 44);
    ctx.stroke();
    ctx.restore();
  });

  // Autumn Lake (360x240): golden-brown shore, cool slate-teal water, amber reeds
  makeCanvas(scene, 'lake-autumn', 360, 240, (ctx) => {
    const cx = 180;
    const cy = 120;

    const shoreGrad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 174);
    shoreGrad.addColorStop(0, 'rgba(164, 128, 66, 0.95)');
    shoreGrad.addColorStop(0.84, 'rgba(148, 114, 58, 0.85)');
    shoreGrad.addColorStop(1, 'rgba(148, 114, 58, 0)');
    ctx.fillStyle = shoreGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 174, 114, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawPondPath = (scale = 1) => {
      ctx.beginPath();
      ctx.moveTo(cx - 144 * scale, cy);
      ctx.bezierCurveTo(
        cx - 148 * scale,
        cy - 86 * scale,
        cx - 46 * scale,
        cy - 102 * scale,
        cx + 18 * scale,
        cy - 92 * scale
      );
      ctx.bezierCurveTo(
        cx + 104 * scale,
        cy - 98 * scale,
        cx + 154 * scale,
        cy - 54 * scale,
        cx + 148 * scale,
        cy + 8 * scale
      );
      ctx.bezierCurveTo(
        cx + 144 * scale,
        cy + 78 * scale,
        cx + 58 * scale,
        cy + 102 * scale,
        cx - 22 * scale,
        cy + 94 * scale
      );
      ctx.bezierCurveTo(
        cx - 104 * scale,
        cy + 98 * scale,
        cx - 142 * scale,
        cy + 58 * scale,
        cx - 144 * scale,
        cy
      );
      ctx.closePath();
    };

    const waterGrad = ctx.createRadialGradient(cx - 18, cy - 12, 16, cx, cy, 152);
    waterGrad.addColorStop(0, '#0c4a6e');
    waterGrad.addColorStop(0.5, '#0284c7');
    waterGrad.addColorStop(0.85, '#38bdf8');
    waterGrad.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = waterGrad;
    drawPondPath(1);
    ctx.fill();

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
    ctx.lineWidth = 4;
    drawPondPath(0.95);
    ctx.stroke();

    // Floating autumn leaves on water
    const leaves = [
      [cx - 46, cy - 22, '#f97316'],
      [cx + 38, cy + 28, '#eab308'],
      [cx - 82, cy + 16, '#dc2626'],
      [cx + 12, cy - 42, '#f59e0b']
    ] as const;
    for (const [lx, ly, col] of leaves) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5.2, 2.8, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Amber autumn reeds
    const drawReeds = (rx: number, ry: number) => {
      drawLeafBlade(ctx, rx, ry, -6, 20, '#b45309');
      drawLeafBlade(ctx, rx + 5, ry + 2, 2, 24, '#d97706');
      drawLeafBlade(ctx, rx + 10, ry + 1, 8, 18, '#b45309');
      ctx.fillStyle = '#5c3419';
      ctx.fillRect(rx + 4, ry - 25, 3.5, 8);
    };
    drawReeds(54, 88);
    drawReeds(290, 174);
  });

  // Ancestral Stone Memorial Cairn / Totem (84x96)
  makeCanvas(scene, 'memorial-totem', 84, 96, (ctx) => {
    const cx = 42;
    const baseY = 78;

    // Ground cast shadow
    const sh = ctx.createRadialGradient(cx + 5, baseY + 2, 6, cx + 5, baseY + 2, 32);
    sh.addColorStop(0, 'rgba(15, 25, 10, 0.45)');
    sh.addColorStop(1, 'rgba(15, 25, 10, 0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx + 5, baseY + 2, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upright sculpted granite monolith
    const stoneGrad = ctx.createLinearGradient(cx - 16, baseY - 58, cx + 16, baseY);
    stoneGrad.addColorStop(0, '#cbd5e1');
    stoneGrad.addColorStop(0.5, '#94a3b8');
    stoneGrad.addColorStop(1, '#475569');
    ctx.fillStyle = stoneGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 17, baseY - 2);
    ctx.lineTo(cx - 13, baseY - 54);
    ctx.quadraticCurveTo(cx, baseY - 66, cx + 13, baseY - 52);
    ctx.lineTo(cx + 17, baseY - 2);
    ctx.closePath();
    ctx.fill();

    // Engraved tribal spirit glyph
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, baseY - 38, 6.5, 0, Math.PI * 1.65);
    ctx.moveTo(cx, baseY - 28);
    ctx.lineTo(cx, baseY - 14);
    ctx.moveTo(cx - 6, baseY - 21);
    ctx.lineTo(cx + 6, baseY - 21);
    ctx.stroke();

    // Base cairn stones + small mossy tufts
    const stones = [
      [cx - 18, baseY - 1, 9, 6, '#64748b'],
      [cx + 18, baseY - 1, 9, 6, '#64748b'],
      [cx - 6, baseY + 4, 11, 7, '#94a3b8'],
      [cx + 8, baseY + 4, 10, 6.5, '#78716c']
    ] as const;
    for (const [sx, sy, rx, ry, col] of stones) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Water ripple shimmer
  makeCanvas(scene, 'lake-ripple', 64, 24, (ctx) => {
    ctx.strokeStyle = 'rgba(224, 247, 255, 0.72)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.quadraticCurveTo(32, 6, 56, 14);
    ctx.stroke();
  });

  // Floating lily pad with pink lotus blossom
  makeCanvas(scene, 'lily-pad', 36, 28, (ctx) => {
    ctx.fillStyle = 'rgba(8, 47, 73, 0.25)';
    ctx.beginPath();
    ctx.ellipse(19, 16, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3ba847';
    ctx.beginPath();
    ctx.moveTo(18, 14);
    ctx.ellipse(18, 14, 13, 9, 0, 0.35, Math.PI * 2 - 0.35);
    ctx.closePath();
    ctx.fill();

    // Small pink flower
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(14, 11, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(14, 11, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Splash droplet particle
  makeCanvas(scene, 'particle-splash', 14, 14, (ctx) => {
    const g = ctx.createRadialGradient(6, 5, 1, 7, 7, 6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#7dd3fc');
    g.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(7, 7, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createUiAndRingTextures(scene: Phaser.Scene): void {
  // Icon wood
  makeCanvas(scene, 'icon-wood', 36, 36, (ctx) => {
    ctx.fillStyle = '#7c4b27';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 4, 10, 28, 16, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9e653a';
    drawRoundedRect(ctx, 6, 12, 20, 6, 3);
    ctx.fill();

    ctx.fillStyle = '#e6c29f';
    ctx.beginPath();
    ctx.ellipse(28, 18, 4.5, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Icon stone
  makeCanvas(scene, 'icon-stone', 36, 36, (ctx) => {
    const grad = ctx.createLinearGradient(8, 8, 28, 28);
    grad.addColorStop(0, '#c4cbd4');
    grad.addColorStop(1, '#68707c');
    ctx.fillStyle = grad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.lineTo(10, 10);
    ctx.lineTo(20, 7);
    ctx.lineTo(30, 16);
    ctx.lineTo(27, 27);
    ctx.lineTo(12, 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(15, 13, 4.5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Icon food
  makeCanvas(scene, 'icon-food', 36, 36, (ctx) => {
    ctx.fillStyle = '#3ba847';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(18, 10, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const berries = [
      { x: 13, y: 20, c: '#d90429' },
      { x: 23, y: 20, c: '#ef233c' },
      { x: 18, y: 25, c: '#d90429' }
    ];
    for (const b of berries) {
      ctx.fillStyle = b.c;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Icon tools (hammer & flint axe)
  makeCanvas(scene, 'icon-tools', 36, 36, (ctx) => {
    ctx.strokeStyle = '#9e653a';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 28);
    ctx.lineTo(25, 11);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(24, 11, 8, 5, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(12, 12, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Icon knowledge (teal glowing rune spark)
  makeCanvas(scene, 'icon-knowledge', 36, 36, (ctx) => {
    const glow = ctx.createRadialGradient(18, 18, 2, 18, 18, 16);
    glow.addColorStop(0, '#a5f3fc');
    glow.addColorStop(0.55, '#06b6d4');
    glow.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(18, 18, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 10, 6, 16, 24, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(18, 15, 4.2, 0, Math.PI * 1.65);
    ctx.moveTo(18, 21);
    ctx.lineTo(18, 26);
    ctx.stroke();
  });

  // Selection ring
  makeCanvas(scene, 'selection-ring', 60, 32, (ctx) => {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(30, 16, 22, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(30, 16, 25, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Target ring
  makeCanvas(scene, 'target-ring', 64, 34, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(32, 17, 23, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Chat/emotion bubble background
  makeCanvas(scene, 'bubble-bg', 42, 34, (ctx) => {
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 3, 2, 36, 24, 9);
    ctx.fill();
    ctx.stroke();

    // Pointer tail
    ctx.beginPath();
    ctx.moveTo(16, 25);
    ctx.lineTo(20, 32);
    ctx.lineTo(24, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cover inner seam of tail
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(15, 22, 10, 4);
  });
}

function createHutTextures(scene: Phaser.Scene): void {
  const w = 168;
  const h = 160;
  const cx = 84;
  const baseY = 132;

  const drawFoundationPad = (ctx: CanvasRenderingContext2D) => {
    const sh = ctx.createRadialGradient(cx + 8, baseY, 18, cx + 8, baseY, 74);
    sh.addColorStop(0, 'rgba(20, 36, 14, 0.4)');
    sh.addColorStop(1, 'rgba(20, 36, 14, 0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx + 8, baseY + 2, 74, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    const dirt = ctx.createRadialGradient(cx, baseY, 12, cx, baseY, 64);
    dirt.addColorStop(0, 'rgba(138, 102, 58, 0.92)');
    dirt.addColorStop(0.72, 'rgba(154, 116, 68, 0.65)');
    dirt.addColorStop(1, 'rgba(154, 116, 68, 0)');
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 64, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawStoneBaseRing = (ctx: CanvasRenderingContext2D) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.sin(a) > 0.65 && Math.abs(Math.cos(a)) < 0.42) continue; // doorway gap
      const sx = cx + Math.cos(a) * 52;
      const sy = baseY + Math.sin(a) * 20;
      const sg = ctx.createLinearGradient(sx - 8, sy - 6, sx + 8, sy + 6);
      sg.addColorStop(0, '#a8b0bc');
      sg.addColorStop(1, '#585f6a');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 9.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Stage 0: Foundation, stones, stakes, and logs
  makeCanvas(scene, 'hut-stage-0', w, h, (ctx) => {
    drawFoundationPad(ctx);
    drawStoneBaseRing(ctx);

    const stakes = [
      { x: cx - 44, y: baseY - 4 },
      { x: cx + 44, y: baseY - 4 },
      { x: cx - 28, y: baseY - 14 },
      { x: cx + 28, y: baseY - 14 },
      { x: cx - 20, y: baseY + 12 },
      { x: cx + 20, y: baseY + 12 }
    ];
    for (const st of stakes) {
      ctx.fillStyle = '#734424';
      drawRoundedRect(ctx, st.x - 3.5, st.y - 26, 7, 26, 3);
      ctx.fill();
    }

    // Scattered logs ready on ground
    ctx.fillStyle = '#8b5730';
    drawRoundedRect(ctx, cx - 22, baseY - 2, 42, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#e6c29f';
    ctx.beginPath();
    ctx.arc(cx + 18, baseY + 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Stage 1: Tied wooden pole dome skeleton
  makeCanvas(scene, 'hut-stage-1', w, h, (ctx) => {
    drawFoundationPad(ctx);
    drawStoneBaseRing(ctx);

    const poleCoords = [-46, -24, 0, 24, 46];
    for (const px of poleCoords) {
      const grad = ctx.createLinearGradient(cx + px, baseY, cx, baseY - 94);
      grad.addColorStop(0, '#6e4222');
      grad.addColorStop(1, '#9c6236');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + px, baseY + (Math.abs(px) < 30 ? 8 : -2));
      ctx.quadraticCurveTo(cx + px * 0.72, baseY - 62, cx, baseY - 92);
      ctx.stroke();
    }

    // Horizontal lashed branch ribs
    ctx.strokeStyle = '#85532b';
    ctx.lineWidth = 4.5;
    for (const ry of [baseY - 28, baseY - 54]) {
      const rw = ry === baseY - 28 ? 44 : 29;
      ctx.beginPath();
      ctx.moveTo(cx - rw, ry);
      ctx.quadraticCurveTo(cx, ry + 10, cx + rw, ry);
      ctx.stroke();
    }

    // Top leather lashing
    ctx.fillStyle = '#d9b589';
    drawRoundedRect(ctx, cx - 7, baseY - 96, 14, 8, 3);
    ctx.fill();
  });

  // Stage 2: Stretched rough hides & branches covering frame
  makeCanvas(scene, 'hut-stage-2', w, h, (ctx) => {
    drawFoundationPad(ctx);
    drawStoneBaseRing(ctx);

    // Partial dome hides
    const domeGrad = ctx.createRadialGradient(cx - 18, baseY - 58, 10, cx + 8, baseY - 26, 68);
    domeGrad.addColorStop(0, '#c78a4e');
    domeGrad.addColorStop(0.55, '#965e2e');
    domeGrad.addColorStop(1, '#583316');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 50, baseY - 2);
    ctx.quadraticCurveTo(cx - 46, baseY - 82, cx, baseY - 94);
    ctx.quadraticCurveTo(cx + 46, baseY - 82, cx + 50, baseY - 2);
    ctx.quadraticCurveTo(cx, baseY + 14, cx - 50, baseY - 2);
    ctx.fill();

    // Exposed top timber poles
    ctx.strokeStyle = '#734424';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    for (const px of [-24, 0, 24]) {
      ctx.beginPath();
      ctx.moveTo(cx + px * 0.65, baseY - 70);
      ctx.lineTo(cx, baseY - 100);
      ctx.stroke();
    }

    // Forming dark doorway
    ctx.fillStyle = '#24140a';
    ctx.beginPath();
    ctx.moveTo(cx - 16, baseY + 6);
    ctx.quadraticCurveTo(cx - 14, baseY - 30, cx, baseY - 32);
    ctx.quadraticCurveTo(cx + 14, baseY - 30, cx + 16, baseY + 6);
    ctx.closePath();
    ctx.fill();
  });

  // Stage 3: Completed cozy 3D prehistoric Small Hut
  makeCanvas(scene, 'hut-stage-3', w, h, (ctx) => {
    drawFoundationPad(ctx);
    drawStoneBaseRing(ctx);

    // Lower mud-and-timber wall ring
    const wallGrad = ctx.createLinearGradient(cx - 50, baseY - 26, cx + 50, baseY + 6);
    wallGrad.addColorStop(0, '#a66b3a');
    wallGrad.addColorStop(0.6, '#7a4a24');
    wallGrad.addColorStop(1, '#472811');
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 52, baseY - 4);
    ctx.lineTo(cx - 46, baseY - 32);
    ctx.lineTo(cx + 46, baseY - 32);
    ctx.lineTo(cx + 52, baseY - 4);
    ctx.quadraticCurveTo(cx, baseY + 16, cx - 52, baseY - 4);
    ctx.fill();

    // Volumetric 3D domed hide & thatch roof (top-left sunlit -> bottom-right warm shadow)
    const roofGrad = ctx.createRadialGradient(cx - 22, baseY - 72, 12, cx + 12, baseY - 36, 76);
    roofGrad.addColorStop(0, '#ebc078');
    roofGrad.addColorStop(0.35, '#cc8e46');
    roofGrad.addColorStop(0.75, '#8f5522');
    roofGrad.addColorStop(1, '#522c0f');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 58, baseY - 22);
    ctx.bezierCurveTo(cx - 54, baseY - 82, cx - 18, baseY - 102, cx, baseY - 102);
    ctx.bezierCurveTo(cx + 18, baseY - 102, cx + 54, baseY - 82, cx + 58, baseY - 22);
    ctx.quadraticCurveTo(cx, baseY + 2, cx - 58, baseY - 22);
    ctx.fill();

    // Patched animal pelt panels & stitched seams on roof
    ctx.fillStyle = 'rgba(130, 72, 32, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx + 18, baseY - 52, 16, 13, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(248, 224, 180, 0.52)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 12, baseY - 90);
    ctx.quadraticCurveTo(cx - 22, baseY - 54, cx - 26, baseY - 22);
    ctx.moveTo(cx + 12, baseY - 88);
    ctx.quadraticCurveTo(cx + 20, baseY - 54, cx + 26, baseY - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Roof apex timber poles & antler/bone ornament
    ctx.strokeStyle = '#5e3618';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 14, baseY - 114);
    ctx.lineTo(cx + 8, baseY - 94);
    ctx.moveTo(cx + 14, baseY - 114);
    ctx.lineTo(cx - 8, baseY - 94);
    ctx.stroke();

    // Doorway wooden frame + deep cozy interior
    ctx.fillStyle = '#633818';
    ctx.beginPath();
    ctx.moveTo(cx - 22, baseY + 7);
    ctx.quadraticCurveTo(cx - 20, baseY - 38, cx, baseY - 40);
    ctx.quadraticCurveTo(cx + 20, baseY - 38, cx + 22, baseY + 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1b0f07';
    ctx.beginPath();
    ctx.moveTo(cx - 16, baseY + 7);
    ctx.quadraticCurveTo(cx - 14, baseY - 30, cx, baseY - 32);
    ctx.quadraticCurveTo(cx + 14, baseY - 30, cx + 16, baseY + 7);
    ctx.closePath();
    ctx.fill();

    // Rolled fur doorway curtain + bone trophy above arch
    ctx.fillStyle = '#e8c49a';
    drawRoundedRect(ctx, cx - 12, baseY - 42, 24, 7, 3.5);
    ctx.fill();
  });

  // Stage 3 Winter: Completed 3D Hut dusted with thick volumetric snow
  makeCanvas(scene, 'hut-stage-3-winter', w, h, (ctx) => {
    drawFoundationPad(ctx);
    drawStoneBaseRing(ctx);

    const wallGrad = ctx.createLinearGradient(cx - 50, baseY - 26, cx + 50, baseY + 6);
    wallGrad.addColorStop(0, '#966138');
    wallGrad.addColorStop(0.6, '#6b401f');
    wallGrad.addColorStop(1, '#3b200d');
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 52, baseY - 4);
    ctx.lineTo(cx - 46, baseY - 32);
    ctx.lineTo(cx + 46, baseY - 32);
    ctx.lineTo(cx + 52, baseY - 4);
    ctx.quadraticCurveTo(cx, baseY + 16, cx - 52, baseY - 4);
    ctx.fill();

    // Base domed hide & thatch roof
    const roofGrad = ctx.createRadialGradient(cx - 22, baseY - 72, 12, cx + 12, baseY - 36, 76);
    roofGrad.addColorStop(0, '#d8b474');
    roofGrad.addColorStop(0.35, '#b87f3c');
    roofGrad.addColorStop(0.75, '#7c481c');
    roofGrad.addColorStop(1, '#47250c');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 58, baseY - 22);
    ctx.bezierCurveTo(cx - 54, baseY - 82, cx - 18, baseY - 102, cx, baseY - 102);
    ctx.bezierCurveTo(cx + 18, baseY - 102, cx + 54, baseY - 82, cx + 58, baseY - 22);
    ctx.quadraticCurveTo(cx, baseY + 2, cx - 58, baseY - 22);
    ctx.fill();

    // Thick sculpted winter snow blanket across upper dome
    const snowGrad = ctx.createRadialGradient(cx - 18, baseY - 84, 10, cx + 8, baseY - 56, 66);
    snowGrad.addColorStop(0, '#ffffff');
    snowGrad.addColorStop(0.65, '#e0f2fe');
    snowGrad.addColorStop(1, '#93c5fd');
    ctx.fillStyle = snowGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 53, baseY - 46);
    ctx.bezierCurveTo(cx - 46, baseY - 88, cx - 16, baseY - 103, cx, baseY - 103);
    ctx.bezierCurveTo(cx + 16, baseY - 103, cx + 46, baseY - 88, cx + 53, baseY - 46);
    ctx.quadraticCurveTo(cx + 26, baseY - 34, cx, baseY - 42);
    ctx.quadraticCurveTo(cx - 26, baseY - 34, cx - 53, baseY - 46);
    ctx.fill();

    // Roof apex timber poles
    ctx.strokeStyle = '#5e3618';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 14, baseY - 114);
    ctx.lineTo(cx + 8, baseY - 94);
    ctx.moveTo(cx + 14, baseY - 114);
    ctx.lineTo(cx - 8, baseY - 94);
    ctx.stroke();

    // Doorway wooden frame + warm glowing interior
    ctx.fillStyle = '#633818';
    ctx.beginPath();
    ctx.moveTo(cx - 22, baseY + 7);
    ctx.quadraticCurveTo(cx - 20, baseY - 38, cx, baseY - 40);
    ctx.quadraticCurveTo(cx + 20, baseY - 38, cx + 22, baseY + 7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2a1407';
    ctx.beginPath();
    ctx.moveTo(cx - 16, baseY + 7);
    ctx.quadraticCurveTo(cx - 14, baseY - 30, cx, baseY - 32);
    ctx.quadraticCurveTo(cx + 14, baseY - 30, cx + 16, baseY + 7);
    ctx.closePath();
    ctx.fill();

    // Warm inner hearth hint + fur curtain
    const warm = ctx.createRadialGradient(cx, baseY - 4, 2, cx, baseY - 4, 14);
    warm.addColorStop(0, 'rgba(251, 146, 60, 0.52)');
    warm.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.arc(cx, baseY - 4, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8c49a';
    drawRoundedRect(ctx, cx - 12, baseY - 42, 24, 7, 3.5);
    ctx.fill();
  });

  // Miniature Hut Icon for bottom Build Menu (44x44)
  makeCanvas(scene, 'icon-hut', 44, 44, (ctx) => {
    const cx = 22;
    const baseY = 36;
    const roofGrad = ctx.createRadialGradient(16, 16, 3, 22, 22, 20);
    roofGrad.addColorStop(0, '#f0c780');
    roofGrad.addColorStop(0.55, '#c4833d');
    roofGrad.addColorStop(1, '#6f3e19');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(5, baseY - 4);
    ctx.quadraticCurveTo(8, 10, cx, 8);
    ctx.quadraticCurveTo(36, 10, 39, baseY - 4);
    ctx.quadraticCurveTo(cx, baseY + 4, 5, baseY - 4);
    ctx.fill();

    ctx.fillStyle = '#24140a';
    ctx.beginPath();
    ctx.moveTo(cx - 6, baseY);
    ctx.quadraticCurveTo(cx - 5, 22, cx, 21);
    ctx.quadraticCurveTo(cx + 5, 22, cx + 6, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#6f3e19';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 5);
    ctx.lineTo(25, 11);
    ctx.moveTo(26, 5);
    ctx.lineTo(19, 11);
    ctx.stroke();
  });
}

function createAnimalTextures(scene: Phaser.Scene): void {
  // Wild Boar Legs
  makeCanvas(scene, 'animal-boar-leg', 20, 28, (ctx) => {
    const g = ctx.createLinearGradient(5, 2, 15, 22);
    g.addColorStop(0, '#7c4a2d');
    g.addColorStop(1, '#3e2213');
    ctx.fillStyle = g;
    drawRoundedRect(ctx, 6, 2, 8, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#1f140e';
    drawRoundedRect(ctx, 6, 18, 8.5, 5, 2);
    ctx.fill();
  });

  // Wild Boar Body (facing right)
  makeCanvas(scene, 'animal-boar-body', 96, 64, (ctx) => {
    const cx = 46;
    const cy = 36;

    // Dorsal bristle mane
    ctx.fillStyle = '#3b1e0e';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 16, 22, 7, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Muscular furry 3D body
    const bodyGrad = ctx.createRadialGradient(cx - 8, cy - 10, 4, cx + 2, cy, 34);
    bodyGrad.addColorStop(0, '#a1623b');
    bodyGrad.addColorStop(0.55, '#6b3e22');
    bodyGrad.addColorStop(1, '#3b1e0e');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 29, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curly tail
    ctx.strokeStyle = '#3b1e0e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx - 31, cy - 2, 4.5, 0.2, Math.PI * 1.6);
    ctx.stroke();

    // Head & snout
    const headGrad = ctx.createRadialGradient(cx + 22, cy - 6, 2, cx + 24, cy, 18);
    headGrad.addColorStop(0, '#a8673e');
    headGrad.addColorStop(1, '#4a2612');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(cx + 24, cy + 2, 15, 13, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ear
    ctx.fillStyle = '#5c3119';
    ctx.beginPath();
    ctx.ellipse(cx + 15, cy - 10, 5, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Flat pig snout
    ctx.fillStyle = '#f4a29e';
    ctx.beginPath();
    ctx.ellipse(cx + 38, cy + 5, 5.5, 6.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved ivory tusks
    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + 32, cy + 8);
    ctx.quadraticCurveTo(cx + 41, cy + 10, cx + 41, cy - 1);
    ctx.quadraticCurveTo(cx + 36, cy + 4, cx + 31, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fierce dark eye + white glint
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx + 27, cy - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + 26.2, cy - 3.8, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Woodland Deer Legs
  makeCanvas(scene, 'animal-deer-leg', 18, 36, (ctx) => {
    const g = ctx.createLinearGradient(5, 2, 13, 28);
    g.addColorStop(0, '#d98c4a');
    g.addColorStop(1, '#8c4e22');
    ctx.fillStyle = g;
    drawRoundedRect(ctx, 6, 2, 6, 25, 3);
    ctx.fill();
    ctx.fillStyle = '#291a10';
    drawRoundedRect(ctx, 6, 25, 6.5, 5, 2);
    ctx.fill();
  });

  // Woodland Deer Body (facing right)
  makeCanvas(scene, 'animal-deer-body', 104, 82, (ctx) => {
    const cx = 46;
    const cy = 50;

    // White puff tail
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx - 28, cy - 6, 6, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sleek 3D torso
    const bodyGrad = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, 32);
    bodyGrad.addColorStop(0, '#f4b06b');
    bodyGrad.addColorStop(0.55, '#c97838');
    bodyGrad.addColorStop(1, '#7c3f18');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 27, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cream underbelly & fawn spots
    ctx.fillStyle = 'rgba(255, 244, 214, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 9, 17, 5, 0, 0, Math.PI);
    ctx.fill();
    for (const [sx, sy] of [
      [cx - 10, cy - 6],
      [cx - 2, cy - 9],
      [cx + 6, cy - 5]
    ]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Neck & poised head
    ctx.fillStyle = '#c97838';
    ctx.beginPath();
    ctx.moveTo(cx + 15, cy + 2);
    ctx.lineTo(cx + 22, cy - 22);
    ctx.lineTo(cx + 31, cy - 19);
    ctx.lineTo(cx + 26, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Antlers
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 24, cy - 26);
    ctx.quadraticCurveTo(cx + 18, cy - 42, cx + 10, cy - 46);
    ctx.moveTo(cx + 20, cy - 36);
    ctx.lineTo(cx + 25, cy - 44);
    ctx.moveTo(cx + 28, cy - 26);
    ctx.quadraticCurveTo(cx + 33, cy - 41, cx + 26, cy - 46);
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#b4622a';
    ctx.beginPath();
    ctx.ellipse(cx + 20, cy - 24, 3.8, 6.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head
    const hGrad = ctx.createRadialGradient(cx + 28, cy - 23, 2, cx + 31, cy - 19, 13);
    hGrad.addColorStop(0, '#f4b06b');
    hGrad.addColorStop(1, '#9a4f20');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.ellipse(cx + 31, cy - 20, 12, 8.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Nose & gentle eye
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(cx + 42, cy - 18, 2.4, 0, Math.PI * 2);
    ctx.arc(cx + 31, cy - 22, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + 30.2, cy - 22.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createTribeBuildingTextures(scene: Phaser.Scene): void {
  const w = 168;
  const h = 160;
  const cx = 84;
  const baseY = 132;

  const drawPad = (ctx: CanvasRenderingContext2D) => {
    const sh = ctx.createRadialGradient(cx + 6, baseY, 16, cx + 6, baseY, 72);
    sh.addColorStop(0, 'rgba(20, 36, 14, 0.42)');
    sh.addColorStop(1, 'rgba(20, 36, 14, 0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx + 6, baseY + 2, 72, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    const dirt = ctx.createRadialGradient(cx, baseY, 10, cx, baseY, 62);
    dirt.addColorStop(0, 'rgba(138, 102, 58, 0.92)');
    dirt.addColorStop(0.72, 'rgba(154, 116, 68, 0.62)');
    dirt.addColorStop(1, 'rgba(154, 116, 68, 0)');
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 62, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- 1. WORKSHOP (Майстерня) ---
  makeCanvas(scene, 'building-workshop-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#734424';
    for (const px of [cx - 44, cx + 44, cx - 22, cx + 22]) {
      drawRoundedRect(ctx, px - 3.5, baseY - 26, 7, 26, 3);
      ctx.fill();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 4, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'building-workshop-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 44, baseY - 58, 8, 58, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx + 36, baseY - 58, 8, 58, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx - 48, baseY - 62, 96, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    drawRoundedRect(ctx, cx - 16, baseY - 20, 32, 18, 5);
    ctx.fill();
  });

  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'building-workshop-2-winter' : 'building-workshop-2', w, h, (ctx) => {
      drawPad(ctx);
      // Support posts
      ctx.fillStyle = '#6f4222';
      for (const px of [cx - 44, cx + 36]) {
        drawRoundedRect(ctx, px, baseY - 62, 9, 62, 3);
        ctx.fill();
      }
      // Stone anvil workbench inside
      const anvil = ctx.createLinearGradient(cx - 22, baseY - 26, cx + 18, baseY);
      anvil.addColorStop(0, '#cbd5e1');
      anvil.addColorStop(1, '#475569');
      ctx.fillStyle = anvil;
      drawRoundedRect(ctx, cx - 22, baseY - 26, 40, 22, 6);
      ctx.fill();
      // Leaning spears & tools rack
      ctx.strokeStyle = '#9e653a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx + 24, baseY);
      ctx.lineTo(cx + 34, baseY - 46);
      ctx.moveTo(cx + 32, baseY);
      ctx.lineTo(cx + 42, baseY - 42);
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(cx + 35, baseY - 48, 3.8, 0, Math.PI * 2);
      ctx.arc(cx + 43, baseY - 44, 3.8, 0, Math.PI * 2);
      ctx.fill();

      // Sloped timber & hide workshop awning roof
      const roofGrad = ctx.createLinearGradient(cx - 56, baseY - 94, cx + 56, baseY - 46);
      roofGrad.addColorStop(0, '#d99b52');
      roofGrad.addColorStop(0.55, '#a8642c');
      roofGrad.addColorStop(1, '#5e3212');
      ctx.fillStyle = roofGrad;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - 56, baseY - 52);
      ctx.lineTo(cx - 44, baseY - 92);
      ctx.lineTo(cx + 44, baseY - 92);
      ctx.lineTo(cx + 56, baseY - 52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (winter) {
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        ctx.moveTo(cx - 52, baseY - 58);
        ctx.lineTo(cx - 42, baseY - 91);
        ctx.lineTo(cx + 42, baseY - 91);
        ctx.lineTo(cx + 52, baseY - 58);
        ctx.quadraticCurveTo(cx, baseY - 52, cx - 52, baseY - 58);
        ctx.fill();
      }
    });
  }

  makeCanvas(scene, 'icon-workshop', 44, 44, (ctx) => {
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 34);
    ctx.lineTo(29, 14);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 18, 6, 18, 12, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(22, 30, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // --- 2. GRANARY (Комора) ---
  makeCanvas(scene, 'building-granary-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#6f4222';
    for (const px of [cx - 34, cx + 34, cx]) {
      drawRoundedRect(ctx, px - 5, baseY - 20, 10, 22, 3);
      ctx.fill();
    }
    drawRoundedRect(ctx, cx - 42, baseY - 22, 84, 8, 3);
    ctx.fill();
  });

  makeCanvas(scene, 'building-granary-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#85532b';
    drawRoundedRect(ctx, cx - 40, baseY - 54, 80, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#633818';
    drawRoundedRect(ctx, cx - 34, baseY - 18, 10, 20, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx + 24, baseY - 18, 10, 20, 3);
    ctx.fill();
  });

  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'building-granary-2-winter' : 'building-granary-2', w, h, (ctx) => {
      drawPad(ctx);
      // Stilts + woven timber granary silo
      ctx.fillStyle = '#5c3419';
      drawRoundedRect(ctx, cx - 34, baseY - 16, 10, 18, 3);
      ctx.fill();
      drawRoundedRect(ctx, cx + 24, baseY - 16, 10, 18, 3);
      ctx.fill();

      const bodyGrad = ctx.createLinearGradient(cx - 44, baseY - 58, cx + 44, baseY - 12);
      bodyGrad.addColorStop(0, '#c88d4f');
      bodyGrad.addColorStop(0.55, '#965d28');
      bodyGrad.addColorStop(1, '#583211');
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      drawRoundedRect(ctx, cx - 44, baseY - 58, 88, 46, 12);
      ctx.fill();
      ctx.stroke();

      // Doorway shutter
      ctx.fillStyle = '#381e0b';
      drawRoundedRect(ctx, cx - 12, baseY - 46, 24, 28, 4);
      ctx.fill();

      // Tall conical golden thatch roof
      const thatch = ctx.createRadialGradient(cx - 12, baseY - 88, 6, cx + 4, baseY - 62, 62);
      thatch.addColorStop(0, '#fde047');
      thatch.addColorStop(0.5, '#d97706');
      thatch.addColorStop(1, '#78350f');
      ctx.fillStyle = thatch;
      ctx.beginPath();
      ctx.moveTo(cx - 52, baseY - 52);
      ctx.quadraticCurveTo(cx - 24, baseY - 94, cx, baseY - 114);
      ctx.quadraticCurveTo(cx + 24, baseY - 94, cx + 52, baseY - 52);
      ctx.quadraticCurveTo(cx, baseY - 42, cx - 52, baseY - 52);
      ctx.fill();
      ctx.stroke();

      if (winter) {
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        ctx.moveTo(cx - 38, baseY - 68);
        ctx.quadraticCurveTo(cx - 16, baseY - 98, cx, baseY - 114);
        ctx.quadraticCurveTo(cx + 16, baseY - 98, cx + 38, baseY - 68);
        ctx.quadraticCurveTo(cx, baseY - 60, cx - 38, baseY - 68);
        ctx.fill();
      }
    });
  }

  makeCanvas(scene, 'icon-granary', 44, 44, (ctx) => {
    ctx.fillStyle = '#965d28';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 10, 20, 24, 17, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.lineTo(22, 6);
    ctx.lineTo(38, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // --- 3. TOTEM (Тотем Знань) ---
  makeCanvas(scene, 'building-totem-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 30, baseY + Math.sin(a) * 12, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  makeCanvas(scene, 'building-totem-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 12, baseY - 66, 24, 66, 6);
    ctx.fill();
  });

  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'building-totem-2-winter' : 'building-totem-2', w, h, (ctx) => {
      drawPad(ctx);
      // Sacred base stones
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = winter && i % 2 === 0 ? '#e0f2fe' : '#64748b';
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 34, baseY + Math.sin(a) * 14, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Carved pillar
      const wood = ctx.createLinearGradient(cx - 16, baseY - 122, cx + 16, baseY);
      wood.addColorStop(0, '#9c6236');
      wood.addColorStop(0.6, '#6e4222');
      wood.addColorStop(1, '#3b200d');
      ctx.fillStyle = wood;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      drawRoundedRect(ctx, cx - 15, baseY - 118, 30, 116, 7);
      ctx.fill();
      ctx.stroke();

      // Carved spirit wings at apex
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(cx - 42, baseY - 104);
      ctx.quadraticCurveTo(cx - 22, baseY - 118, cx, baseY - 102);
      ctx.quadraticCurveTo(cx + 22, baseY - 118, cx + 42, baseY - 104);
      ctx.lineTo(cx + 26, baseY - 88);
      ctx.lineTo(cx - 26, baseY - 88);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing turquoise runes down center
      const aura = ctx.createRadialGradient(cx, baseY - 64, 4, cx, baseY - 64, 34);
      aura.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
      aura.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, baseY - 64, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, baseY - 76, 6, 0, Math.PI * 1.7);
      ctx.arc(cx, baseY - 48, 5, 0, Math.PI * 2);
      ctx.moveTo(cx, baseY - 38);
      ctx.lineTo(cx, baseY - 18);
      ctx.stroke();

      if (winter) {
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        ctx.ellipse(cx - 24, baseY - 106, 14, 5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(cx + 24, baseY - 106, 14, 5, 0.2, 0, Math.PI * 2);
        ctx.ellipse(cx, baseY - 117, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  makeCanvas(scene, 'icon-totem', 44, 44, (ctx) => {
    ctx.fillStyle = '#7c4b27';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 16, 8, 12, 30, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b45309';
    drawRoundedRect(ctx, 7, 11, 30, 7, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.arc(22, 22, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- 4. BURIAL MOUND (Курган Предків) ---
  makeCanvas(scene, 'building-burial_mound-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#64748b';
    for (const [sx, sy] of [
      [cx - 42, baseY - 4],
      [cx + 42, baseY - 4],
      [cx - 24, baseY - 16],
      [cx + 24, baseY - 16]
    ]) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  makeCanvas(scene, 'building-burial_mound-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#78716c';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cx - 24, baseY - 46, 14, 46, 4);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, cx + 10, baseY - 46, 14, 46, 4);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, cx - 28, baseY - 56, 56, 14, 5);
    ctx.fill();
    ctx.stroke();
  });

  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-burial_mound-2-winter' : 'building-burial_mound-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx);
        // Earthen/mossy grassy or snowy barrow hill
        const mound = ctx.createRadialGradient(
          cx - 18,
          baseY - 62,
          10,
          cx + 4,
          baseY - 26,
          68
        );
        if (winter) {
          mound.addColorStop(0, '#ffffff');
          mound.addColorStop(0.55, '#dbeafe');
          mound.addColorStop(1, '#64748b');
        } else {
          mound.addColorStop(0, '#78b856');
          mound.addColorStop(0.55, '#4b8234');
          mound.addColorStop(1, '#294a1c');
        }
        ctx.fillStyle = mound;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 58, baseY - 2);
        ctx.bezierCurveTo(cx - 52, baseY - 76, cx - 20, baseY - 90, cx, baseY - 90);
        ctx.bezierCurveTo(cx + 20, baseY - 90, cx + 52, baseY - 76, cx + 58, baseY - 2);
        ctx.quadraticCurveTo(cx, baseY + 14, cx - 58, baseY - 2);
        ctx.fill();
        ctx.stroke();

        // Megalithic stone arch entrance + eternal memorial spirit glow
        const stone = ctx.createLinearGradient(cx - 26, baseY - 50, cx + 26, baseY + 4);
        stone.addColorStop(0, '#cbd5e1');
        stone.addColorStop(1, '#475569');
        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.moveTo(cx - 26, baseY + 6);
        ctx.lineTo(cx - 22, baseY - 40);
        ctx.quadraticCurveTo(cx, baseY - 54, cx + 22, baseY - 40);
        ctx.lineTo(cx + 26, baseY + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(cx - 14, baseY + 6);
        ctx.lineTo(cx - 12, baseY - 30);
        ctx.quadraticCurveTo(cx, baseY - 40, cx + 12, baseY - 30);
        ctx.lineTo(cx + 14, baseY + 6);
        ctx.closePath();
        ctx.fill();

        // Warm memorial brazier ember inside stone threshold
        const glow = ctx.createRadialGradient(cx, baseY - 6, 2, cx, baseY - 6, 16);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.85)');
        glow.addColorStop(0.5, 'rgba(249, 115, 22, 0.4)');
        glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, baseY - 6, 16, 0, Math.PI * 2);
        ctx.fill();

        // Top standing ancestor rune stone
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(cx - 9, baseY - 84);
        ctx.lineTo(cx - 6, baseY - 108);
        ctx.lineTo(cx, baseY - 114);
        ctx.lineTo(cx + 6, baseY - 108);
        ctx.lineTo(cx + 9, baseY - 84);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    );
  }

  makeCanvas(scene, 'icon-burial_mound', 44, 44, (ctx) => {
    ctx.fillStyle = '#568d3e';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(22, 28, 17, 11, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    drawRoundedRect(ctx, 13, 19, 18, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(22, 29, 3.6, 0, Math.PI * 2);
    ctx.fill();
  });
}
