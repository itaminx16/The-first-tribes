import Phaser from 'phaser';

const OUTLINE = '#2b1e14';

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): void {
  if (scene.textures.exists(key)) return;
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

function drawBonePiece(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  angle: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-len / 2, -4, len / 2, 4);
  g.addColorStop(0, '#fefce8');
  g.addColorStop(0.55, '#ede0c8');
  g.addColorStop(1, '#c7b8a1');
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  drawRoundedRect(ctx, -len / 2, -3, len, 6, 2.5);
  ctx.fill();
  ctx.stroke();

  for (const sx of [-len / 2, len / 2]) {
    ctx.beginPath();
    ctx.arc(sx, -2.6, 3.2, 0, Math.PI * 2);
    ctx.arc(sx, 2.6, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFoldedHide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const g = ctx.createRadialGradient(-4, -3, 2, 0, 0, 18);
  g.addColorStop(0, '#d99b66');
  g.addColorStop(0.6, '#9c5a2c');
  g.addColorStop(1, '#5e3114');
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-14, -7);
  ctx.quadraticCurveTo(0, -10, 14, -6);
  ctx.quadraticCurveTo(17, 2, 11, 8);
  ctx.quadraticCurveTo(0, 11, -13, 7);
  ctx.quadraticCurveTo(-17, 0, -14, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 224, 178, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-2, -1, 7, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function generateExpandedTextures(scene: Phaser.Scene): void {
  createBoneAndHideStorages(scene);
  createCombatGearTextures(scene);
  createExpandedUiIcons(scene);
  createPredatorsAndCarcasses(scene);
  createExpandedBuildings(scene);
}

function createBoneAndHideStorages(scene: Phaser.Scene): void {
  for (let stage = 0; stage <= 4; stage++) {
    makeCanvas(scene, `storage-bone-${stage}`, 112, 96, (ctx) => {
      ctx.fillStyle = 'rgba(130, 108, 84, 0.56)';
      ctx.beginPath();
      ctx.ellipse(56, 62, 46, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(235, 222, 195, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(56, 62, 38, 18, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (stage >= 1) {
        drawBonePiece(ctx, 44, 62, 24, -0.25);
        drawBonePiece(ctx, 64, 63, 22, 0.3);
      }
      if (stage >= 2) {
        drawBonePiece(ctx, 54, 54, 24, 0.08);
        drawBonePiece(ctx, 36, 56, 18, -0.6);
      }
      if (stage >= 3) {
        drawBonePiece(ctx, 66, 50, 22, -0.35);
        drawBonePiece(ctx, 48, 46, 20, 0.45);
      }
      if (stage >= 4) {
        // Horned skull crowning top of bone pile
        ctx.fillStyle = '#fefce8';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(56, 39, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(48, 35);
        ctx.quadraticCurveTo(38, 28, 42, 21);
        ctx.moveTo(64, 35);
        ctx.quadraticCurveTo(74, 28, 70, 21);
        ctx.stroke();
      }
    });

    makeCanvas(scene, `storage-hide-${stage}`, 112, 96, (ctx) => {
      ctx.fillStyle = 'rgba(126, 92, 54, 0.52)';
      ctx.beginPath();
      ctx.ellipse(56, 62, 46, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Timber drying rack frame
      ctx.strokeStyle = '#6f4222';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(26, 68);
      ctx.lineTo(30, 34);
      ctx.moveTo(86, 68);
      ctx.lineTo(82, 34);
      ctx.moveTo(24, 36);
      ctx.lineTo(88, 36);
      ctx.stroke();

      if (stage >= 1) drawFoldedHide(ctx, 44, 60, 0.88);
      if (stage >= 2) drawFoldedHide(ctx, 68, 61, 0.85);
      if (stage >= 3) drawFoldedHide(ctx, 44, 46, 0.82);
      if (stage >= 4) drawFoldedHide(ctx, 68, 46, 0.84);
    });
  }

  for (let count = 1; count <= 5; count++) {
    makeCanvas(scene, `carry-bone-${count}`, 88, 72, (ctx) => {
      const offsets = [
        { x: 40, y: 46, a: -0.2 },
        { x: 48, y: 38, a: 0.14 },
        { x: 39, y: 29, a: -0.12 },
        { x: 49, y: 22, a: 0.22 },
        { x: 44, y: 15, a: -0.05 }
      ];
      for (let i = 0; i < count; i++) {
        drawBonePiece(ctx, offsets[i].x, offsets[i].y, 34, offsets[i].a);
      }
    });

    makeCanvas(scene, `carry-hide-${count}`, 88, 72, (ctx) => {
      for (let i = 0; i < count; i++) {
        drawFoldedHide(ctx, 44 + (i % 2 === 0 ? -3 : 3), 48 - i * 7.5, 0.9);
      }
    });
  }
}

function createCombatGearTextures(scene: Phaser.Scene): void {
  // Prehistoric Curved Bow (held in frontArmGroup at 0.5 scale)
  makeCanvas(scene, 'tool-bow', 56, 68, (ctx) => {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 8);
    ctx.quadraticCurveTo(44, 34, 20, 60);
    ctx.stroke();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.quadraticCurveTo(41, 34, 20, 58);
    ctx.stroke();

    ctx.strokeStyle = '#f5ebe0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(20, 9);
    ctx.lineTo(20, 59);
    ctx.stroke();
  });

  // Heavy Spiked Bone War Club
  makeCanvas(scene, 'tool-bone-club', 52, 66, (ctx) => {
    const wood = ctx.createLinearGradient(22, 10, 30, 60);
    wood.addColorStop(0, '#9c6236');
    wood.addColorStop(1, '#583116');
    ctx.fillStyle = wood;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 58);
    ctx.lineTo(19, 20);
    ctx.quadraticCurveTo(26, 8, 33, 20);
    ctx.lineTo(28, 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bone spikes / heavy jawbone head
    ctx.fillStyle = '#fefce8';
    for (const [sx, sy, rot] of [
      [16, 20, -0.5],
      [36, 20, 0.5],
      [26, 12, 0]
    ]) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4, 5);
      ctx.lineTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  // Arrow Projectile
  makeCanvas(scene, 'projectile-arrow', 34, 12, (ctx) => {
    ctx.strokeStyle = '#9e653a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(4, 6);
    ctx.lineTo(24, 6);
    ctx.stroke();

    // Fletching
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 3);
    ctx.lineTo(7, 6);
    ctx.lineTo(2, 9);
    ctx.stroke();

    // Flint arrowhead
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(23, 2);
    ctx.lineTo(32, 6);
    ctx.lineTo(23, 10);
    ctx.closePath();
    ctx.fill();
  });

  // Hide Armor Overlay (torso-sized at 0.5 scale)
  makeCanvas(scene, 'armor-hide-overlay', 72, 72, (ctx) => {
    const g = ctx.createLinearGradient(16, 16, 56, 56);
    g.addColorStop(0, '#c07a44');
    g.addColorStop(0.55, '#8a4c22');
    g.addColorStop(1, '#582e12');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 22);
    ctx.quadraticCurveTo(36, 15, 57, 22);
    ctx.lineTo(52, 54);
    ctx.quadraticCurveTo(36, 59, 20, 54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fur shoulder trim
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.ellipse(20, 22, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.ellipse(52, 22, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Leather lacing across chest
    ctx.strokeStyle = '#381e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(27, 30);
    ctx.lineTo(45, 42);
    ctx.moveTo(45, 30);
    ctx.lineTo(27, 42);
    ctx.stroke();
  });

  // Bone Armor Overlay (rib-plate chestguard + bone pauldrons)
  makeCanvas(scene, 'armor-bone-overlay', 72, 72, (ctx) => {
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 18, 22, 36, 33, 8);
    ctx.fill();
    ctx.stroke();

    // Rib plates
    ctx.fillStyle = '#fefce8';
    for (let i = 0; i < 3; i++) {
      const y = 27 + i * 8;
      drawRoundedRect(ctx, 21, y, 13, 5.5, 2.5);
      ctx.fill();
      ctx.stroke();
      drawRoundedRect(ctx, 38, y, 13, 5.5, 2.5);
      ctx.fill();
      ctx.stroke();
    }

    // Bone shoulder pauldrons
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(16, 22, 7, 5, -0.35, 0, Math.PI * 2);
    ctx.ellipse(56, 22, 7, 5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function createExpandedUiIcons(scene: Phaser.Scene): void {
  makeCanvas(scene, 'icon-bone', 36, 36, (ctx) => {
    drawBonePiece(ctx, 18, 18, 22, -0.6);
  });

  makeCanvas(scene, 'icon-hide', 36, 36, (ctx) => {
    drawFoldedHide(ctx, 18, 18, 0.85);
  });

  makeCanvas(scene, 'icon-weapon', 36, 36, (ctx) => {
    ctx.strokeStyle = '#9e653a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(8, 28);
    ctx.lineTo(25, 11);
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(21, 9);
    ctx.lineTo(31, 5);
    ctx.lineTo(27, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'icon-armor', 36, 36, (ctx) => {
    ctx.fillStyle = '#fefce8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(28, 10);
    ctx.lineTo(25, 24);
    ctx.lineTo(18, 30);
    ctx.lineTo(11, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'icon-chief-skull', 36, 36, (ctx) => {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(11, 16);
    ctx.quadraticCurveTo(3, 12, 6, 4);
    ctx.moveTo(25, 16);
    ctx.quadraticCurveTo(33, 12, 30, 4);
    ctx.stroke();
    ctx.fillStyle = '#fefce8';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(18, 20, 9, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e1b18';
    ctx.beginPath();
    ctx.arc(14.5, 19, 2.2, 0, Math.PI * 2);
    ctx.arc(21.5, 19, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createPredatorsAndCarcasses(scene: Phaser.Scene): void {
  // Carcasses
  const carcassTypes = [
    { key: 'carcass-boar', pelt: '#7c4a2d', belly: '#dc2626' },
    { key: 'carcass-deer', pelt: '#c97838', belly: '#dc2626' },
    { key: 'carcass-predator', pelt: '#52525b', belly: '#b91c1c' }
  ];
  for (const c of carcassTypes) {
    makeCanvas(scene, c.key, 96, 64, (ctx) => {
      ctx.fillStyle = 'rgba(20, 32, 14, 0.32)';
      ctx.beginPath();
      ctx.ellipse(48, 42, 38, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.pelt;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(46, 36, 31, 15, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Meat + protruding rib bones
      ctx.fillStyle = c.belly;
      ctx.beginPath();
      ctx.ellipse(46, 34, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fefce8';
      ctx.lineWidth = 2.6;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(46 + i * 6, 36);
        ctx.quadraticCurveTo(46 + i * 6 + 2, 23, 46 + i * 6 + 5, 22);
        ctx.stroke();
      }
      drawBonePiece(ctx, 20, 46, 18, 0.35);
    });
  }

  // Wolf Predator
  makeCanvas(scene, 'predator-wolf-leg', 18, 30, (ctx) => {
    ctx.fillStyle = '#475569';
    drawRoundedRect(ctx, 5, 2, 7, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    drawRoundedRect(ctx, 5, 19, 8, 5, 2);
    ctx.fill();
  });
  makeCanvas(scene, 'predator-wolf-body', 102, 68, (ctx) => {
    const cx = 44;
    const cy = 38;
    // Tail
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 2);
    ctx.lineTo(cx - 42, cy - 12);
    ctx.lineTo(cx - 34, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const g = ctx.createRadialGradient(cx - 4, cy - 8, 3, cx, cy, 32);
    g.addColorStop(0, '#94a3b8');
    g.addColorStop(0.55, '#475569');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 28, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wolf head & jaws
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(cx + 27, cy - 4, 15, 11, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy - 11);
    ctx.lineTo(cx + 21, cy - 24);
    ctx.lineTo(cx + 27, cy - 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fangs & amber eye
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(cx + 36, cy);
    ctx.lineTo(cx + 38, cy + 5);
    ctx.lineTo(cx + 40, cy);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Sabertooth Cat Predator
  makeCanvas(scene, 'predator-sabertooth-leg', 20, 32, (ctx) => {
    ctx.fillStyle = '#b45309';
    drawRoundedRect(ctx, 5, 2, 9, 22, 4);
    ctx.fill();
  });
  makeCanvas(scene, 'predator-sabertooth-body', 108, 72, (ctx) => {
    const cx = 46;
    const cy = 40;
    const g = ctx.createRadialGradient(cx - 4, cy - 8, 4, cx, cy, 34);
    g.addColorStop(0, '#fbbf24');
    g.addColorStop(0.55, '#d97706');
    g.addColorStop(1, '#78350f');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 29, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark stripes
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 2.4;
    for (const sx of [cx - 12, cx - 2, cx + 8]) {
      ctx.beginPath();
      ctx.moveTo(sx, cy - 12);
      ctx.lineTo(sx - 3, cy - 2);
      ctx.stroke();
    }

    // Head & long curved saber fangs
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + 27, cy - 4, 15, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.moveTo(cx + 35, cy + 2);
    ctx.lineTo(cx + 38, cy + 16);
    ctx.lineTo(cx + 41, cy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx + 31, cy - 7, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Cave Bear Predator
  makeCanvas(scene, 'predator-bear-leg', 24, 34, (ctx) => {
    ctx.fillStyle = '#451a03';
    drawRoundedRect(ctx, 5, 2, 12, 24, 5);
    ctx.fill();
  });
  makeCanvas(scene, 'predator-bear-body', 114, 80, (ctx) => {
    const cx = 48;
    const cy = 44;
    const g = ctx.createRadialGradient(cx - 6, cy - 10, 6, cx, cy, 38);
    g.addColorStop(0, '#92400e');
    g.addColorStop(0.55, '#5c2d12');
    g.addColorStop(1, '#29150a');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5c2d12';
    ctx.beginPath();
    ctx.ellipse(cx + 28, cy - 6, 17, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx + 33, cy - 9, 2.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createExpandedBuildings(scene: Phaser.Scene): void {
  const w = 168;
  const h = 160;
  const cx = 84;
  const baseY = 132;

  const drawPad = (ctx: CanvasRenderingContext2D, r = 60) => {
    const dirt = ctx.createRadialGradient(cx, baseY, 8, cx, baseY, r);
    dirt.addColorStop(0, 'rgba(138, 102, 58, 0.92)');
    dirt.addColorStop(0.7, 'rgba(154, 116, 68, 0.55)');
    dirt.addColorStop(1, 'rgba(154, 116, 68, 0)');
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- ARMORY (Зброярня) ---
  makeCanvas(scene, 'building-armory-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#6f4222';
    for (const px of [cx - 42, cx + 34]) {
      drawRoundedRect(ctx, px, baseY - 28, 8, 28, 3);
      ctx.fill();
    }
  });
  makeCanvas(scene, 'building-armory-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#78350f';
    drawRoundedRect(ctx, cx - 44, baseY - 58, 88, 56, 8);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'building-armory-2-winter' : 'building-armory-2', w, h, (ctx) => {
      drawPad(ctx);
      ctx.fillStyle = '#5c3419';
      drawRoundedRect(ctx, cx - 46, baseY - 62, 92, 60, 10);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Weapon display rack (spears + bow + shield)
      ctx.strokeStyle = '#d99b52';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 28, baseY - 12);
      ctx.lineTo(cx - 28, baseY - 50);
      ctx.moveTo(cx - 18, baseY - 12);
      ctx.lineTo(cx - 18, baseY - 52);
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(cx - 28, baseY - 52, 4, 0, Math.PI * 2);
      ctx.arc(cx - 18, baseY - 54, 4, 0, Math.PI * 2);
      ctx.fill();

      // Round hide/bone shield
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(cx + 22, baseY - 34, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fefce8';
      ctx.beginPath();
      ctx.arc(cx + 22, baseY - 34, 6, 0, Math.PI * 2);
      ctx.fill();

      // Roof
      ctx.fillStyle = winter ? '#e2effa' : '#9a3412';
      ctx.beginPath();
      ctx.moveTo(cx - 56, baseY - 58);
      ctx.lineTo(cx, baseY - 102);
      ctx.lineTo(cx + 56, baseY - 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }
  makeCanvas(scene, 'icon-armory', 44, 44, (ctx) => {
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(22, 24, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fefce8';
    ctx.beginPath();
    ctx.arc(22, 24, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- BARRACKS (Казарма) ---
  makeCanvas(scene, 'building-barracks-0', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#6f4222';
    for (const px of [cx - 48, cx, cx + 48]) {
      drawRoundedRect(ctx, px - 4, baseY - 30, 8, 30, 3);
      ctx.fill();
    }
  });
  makeCanvas(scene, 'building-barracks-1', w, h, (ctx) => {
    drawPad(ctx);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 50, baseY - 56, 100, 56, 8);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-barracks-2-winter' : 'building-barracks-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx);
        ctx.fillStyle = '#6b3e22';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx - 50, baseY - 58, 100, 58, 9);
        ctx.fill();
        ctx.stroke();

        // Dark war archway + war banners
        ctx.fillStyle = '#1e140c';
        drawRoundedRect(ctx, cx - 14, baseY - 36, 28, 36, 8);
        ctx.fill();

        ctx.fillStyle = '#b91c1c';
        drawRoundedRect(ctx, cx - 38, baseY - 46, 16, 28, 3);
        ctx.fill();
        ctx.stroke();
        drawRoundedRect(ctx, cx + 22, baseY - 46, 16, 28, 3);
        ctx.fill();
        ctx.stroke();

        // Crossed spears over entrance + peaked longhouse roof
        ctx.fillStyle = winter ? '#e2effa' : '#8b5a2b';
        ctx.beginPath();
        ctx.moveTo(cx - 58, baseY - 54);
        ctx.lineTo(cx, baseY - 108);
        ctx.lineTo(cx + 58, baseY - 54);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 18, baseY - 62);
        ctx.lineTo(cx + 18, baseY - 90);
        ctx.moveTo(cx + 18, baseY - 62);
        ctx.lineTo(cx - 18, baseY - 90);
        ctx.stroke();
      }
    );
  }
  makeCanvas(scene, 'icon-barracks', 44, 44, (ctx) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(9, 35);
    ctx.lineTo(35, 9);
    ctx.moveTo(35, 35);
    ctx.lineTo(9, 9);
    ctx.stroke();
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(22, 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- WATCHTOWER (Сторожова вежа) ---
  makeCanvas(scene, 'building-watchtower-0', w, h, (ctx) => {
    drawPad(ctx, 44);
    ctx.fillStyle = '#6f4222';
    drawRoundedRect(ctx, cx - 22, baseY - 38, 8, 38, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx + 14, baseY - 38, 8, 38, 3);
    ctx.fill();
  });
  makeCanvas(scene, 'building-watchtower-1', w, h, (ctx) => {
    drawPad(ctx, 44);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 22, baseY - 82, 8, 82, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx + 14, baseY - 82, 8, 82, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx - 28, baseY - 86, 56, 10, 3);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-watchtower-2-winter' : 'building-watchtower-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx, 46);
        ctx.fillStyle = '#6f4222';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx - 24, baseY - 86, 9, 86, 3);
        ctx.fill();
        ctx.stroke();
        drawRoundedRect(ctx, cx + 15, baseY - 86, 9, 86, 3);
        ctx.fill();
        ctx.stroke();

        // Cross bracing
        ctx.strokeStyle = '#9e653a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 20, baseY - 12);
        ctx.lineTo(cx + 20, baseY - 70);
        ctx.moveTo(cx + 20, baseY - 12);
        ctx.lineTo(cx - 20, baseY - 70);
        ctx.stroke();

        // Lookout basket deck
        ctx.fillStyle = '#85532b';
        drawRoundedRect(ctx, cx - 32, baseY - 102, 64, 24, 5);
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Thatch lookout canopy
        ctx.fillStyle = winter ? '#f0f9ff' : '#d97706';
        ctx.beginPath();
        ctx.moveTo(cx - 38, baseY - 102);
        ctx.lineTo(cx, baseY - 134);
        ctx.lineTo(cx + 38, baseY - 102);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    );
  }
  makeCanvas(scene, 'icon-watchtower', 44, 44, (ctx) => {
    ctx.fillStyle = '#7c4a27';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 14, 18, 16, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(9, 18);
    ctx.lineTo(22, 5);
    ctx.lineTo(35, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // --- SMOKEHOUSE (Коптильня) ---
  makeCanvas(scene, 'building-smokehouse-0', w, h, (ctx) => {
    drawPad(ctx, 50);
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(cx, baseY - 14, 26, Math.PI, Math.PI * 2);
    ctx.fill();
  });
  makeCanvas(scene, 'building-smokehouse-1', w, h, (ctx) => {
    drawPad(ctx, 52);
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.arc(cx, baseY - 2, 34, Math.PI, Math.PI * 2);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-smokehouse-2-winter' : 'building-smokehouse-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx, 54);
        // Clay-stone smoking dome + meat rack
        const clay = ctx.createRadialGradient(cx - 10, baseY - 38, 6, cx, baseY - 20, 44);
        clay.addColorStop(0, winter ? '#e2e8f0' : '#d6b48c');
        clay.addColorStop(1, '#6b4c35');
        ctx.fillStyle = clay;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, baseY - 4, 38, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Warm ember doorway
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(cx - 4, baseY - 4, 12, Math.PI, Math.PI * 2);
        ctx.fill();

        // Chimney vent
        ctx.fillStyle = '#57534e';
        drawRoundedRect(ctx, cx - 7, baseY - 56, 14, 18, 3);
        ctx.fill();
        ctx.stroke();

        // Hanging rack beside dome
        ctx.strokeStyle = '#6f4222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 30, baseY);
        ctx.lineTo(cx + 30, baseY - 38);
        ctx.moveTo(cx + 52, baseY);
        ctx.lineTo(cx + 52, baseY - 38);
        ctx.moveTo(cx + 26, baseY - 36);
        ctx.lineTo(cx + 56, baseY - 36);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(cx + 38, baseY - 24, 5, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 48, baseY - 24, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    );
  }
  makeCanvas(scene, 'icon-smokehouse', 44, 44, (ctx) => {
    ctx.fillStyle = '#b48a64';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(22, 34, 14, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(22, 34, 5, Math.PI, Math.PI * 2);
    ctx.fill();
  });

  // --- PALISADE (Частокіл) ---
  makeCanvas(scene, 'building-palisade-0', w, h, (ctx) => {
    drawPad(ctx, 42);
    ctx.fillStyle = '#6f4222';
    for (let i = -2; i <= 2; i++) {
      drawRoundedRect(ctx, cx + i * 14 - 4, baseY - 26, 8, 26, 2);
      ctx.fill();
    }
  });
  makeCanvas(scene, 'building-palisade-1', w, h, (ctx) => {
    drawPad(ctx, 44);
    ctx.fillStyle = '#7c4a27';
    for (let i = -3; i <= 3; i++) {
      drawRoundedRect(ctx, cx + i * 11 - 4, baseY - 46, 9, 46, 2);
      ctx.fill();
    }
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-palisade-2-winter' : 'building-palisade-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx, 46);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        for (let i = -3; i <= 3; i++) {
          const lx = cx + i * 11;
          ctx.fillStyle = i % 2 === 0 ? '#7c4a27' : '#633818';
          ctx.beginPath();
          ctx.moveTo(lx - 5, baseY);
          ctx.lineTo(lx - 5, baseY - 56);
          ctx.lineTo(lx, baseY - 68);
          ctx.lineTo(lx + 5, baseY - 56);
          ctx.lineTo(lx + 5, baseY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#9e653a';
        drawRoundedRect(ctx, cx - 38, baseY - 38, 76, 8, 3);
        ctx.fill();
        ctx.stroke();
        if (winter) {
          ctx.fillStyle = '#f0f9ff';
          drawRoundedRect(ctx, cx - 36, baseY - 42, 72, 4, 2);
          ctx.fill();
        }
      }
    );
  }
  makeCanvas(scene, 'icon-palisade', 44, 44, (ctx) => {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const x = 9 + i * 8;
      ctx.fillStyle = i % 2 === 0 ? '#8b5a2b' : '#6f4222';
      ctx.beginPath();
      ctx.moveTo(x - 3, 36);
      ctx.lineTo(x - 3, 14);
      ctx.lineTo(x, 7);
      ctx.lineTo(x + 3, 14);
      ctx.lineTo(x + 3, 36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });

  // --- RIVAL BANNER & RIVAL TENT ---
  makeCanvas(scene, 'rival-banner', 72, 128, (ctx) => {
    ctx.fillStyle = '#5c3419';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 32, 18, 8, 102, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(40, 24);
    ctx.lineTo(66, 36);
    ctx.lineTo(40, 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Skull crest at top
    ctx.fillStyle = '#fefce8';
    ctx.beginPath();
    ctx.arc(36, 15, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'rival-hut', 136, 124, (ctx) => {
    ctx.fillStyle = 'rgba(20, 32, 14, 0.35)';
    ctx.beginPath();
    ctx.ellipse(68, 104, 52, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createLinearGradient(22, 28, 114, 104);
    g.addColorStop(0, '#9c6644');
    g.addColorStop(1, '#4a2b18');
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(16, 102);
    ctx.lineTo(58, 22);
    ctx.lineTo(78, 22);
    ctx.lineTo(120, 102);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1a110a';
    drawRoundedRect(ctx, 56, 66, 24, 36, 8);
    ctx.fill();
  });

  // --- LARGE HUT (Велика хатина) ---
  makeCanvas(scene, 'building-large_hut-0', w, h, (ctx) => {
    drawPad(ctx, 68);
    ctx.fillStyle = '#6f4222';
    for (const px of [cx - 56, cx - 22, cx + 22, cx + 56]) {
      drawRoundedRect(ctx, px - 4, baseY - 30, 8, 30, 3);
      ctx.fill();
    }
  });
  makeCanvas(scene, 'building-large_hut-1', w, h, (ctx) => {
    drawPad(ctx, 68);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 58, baseY - 64, 116, 62, 14);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-large_hut-2-winter' : 'building-large_hut-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx, 70);
        // Wide tribal double-dome longhouse
        const g = ctx.createRadialGradient(cx - 16, baseY - 72, 12, cx, baseY - 36, 74);
        g.addColorStop(0, '#e0a96d');
        g.addColorStop(0.55, '#a8642c');
        g.addColorStop(1, '#582f11');
        ctx.fillStyle = g;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx - 66, baseY - 2);
        ctx.bezierCurveTo(cx - 66, baseY - 94, cx - 24, baseY - 114, cx, baseY - 110);
        ctx.bezierCurveTo(cx + 24, baseY - 114, cx + 66, baseY - 94, cx + 66, baseY - 2);
        ctx.quadraticCurveTo(cx, baseY + 12, cx - 66, baseY - 2);
        ctx.fill();
        ctx.stroke();

        // Hide seam bands & horns over entrance
        ctx.strokeStyle = '#3b1e0e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 32, baseY - 96);
        ctx.quadraticCurveTo(cx - 36, baseY - 46, cx - 34, baseY);
        ctx.moveTo(cx + 32, baseY - 96);
        ctx.quadraticCurveTo(cx + 36, baseY - 46, cx + 34, baseY);
        ctx.stroke();

        // Double arched warm doorway
        ctx.fillStyle = '#23140b';
        drawRoundedRect(ctx, cx - 20, baseY - 42, 40, 42, 14);
        ctx.fill();
        ctx.stroke();

        // Horned skull crest above door
        ctx.fillStyle = '#fefce8';
        ctx.beginPath();
        ctx.arc(cx, baseY - 52, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (winter) {
          ctx.fillStyle = '#f0f9ff';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - 98, 42, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    );
  }
  makeCanvas(scene, 'icon-large_hut', 44, 44, (ctx) => {
    ctx.fillStyle = '#c88d4f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(22, 30, 18, 14, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    drawRoundedRect(ctx, 17, 21, 10, 10, 3);
    ctx.fill();
  });

  // --- NURSERY (Ясла) ---
  makeCanvas(scene, 'building-nursery-0', w, h, (ctx) => {
    drawPad(ctx, 56);
    ctx.fillStyle = '#85532b';
    for (let i = -2; i <= 2; i++) {
      drawRoundedRect(ctx, cx + i * 20 - 3, baseY - 22, 6, 22, 2);
      ctx.fill();
    }
  });
  makeCanvas(scene, 'building-nursery-1', w, h, (ctx) => {
    drawPad(ctx, 58);
    ctx.fillStyle = '#a8642c';
    drawRoundedRect(ctx, cx - 46, baseY - 48, 92, 46, 12);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'building-nursery-2-winter' : 'building-nursery-2', w, h, (ctx) => {
      drawPad(ctx, 58);
      // Warm fenced play yard + cozy canopy
      ctx.fillStyle = '#c88d4f';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, cx - 46, baseY - 52, 92, 50, 14);
      ctx.fill();
      ctx.stroke();

      // Soft woven mat & doorway
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(cx, baseY - 6, 30, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#381e0b';
      drawRoundedRect(ctx, cx - 14, baseY - 38, 28, 32, 10);
      ctx.fill();

      // Canopy roof decorated with painted tribal sun & feathers
      ctx.fillStyle = winter ? '#e2effa' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(cx - 54, baseY - 48);
      ctx.quadraticCurveTo(cx, baseY - 104, cx + 54, baseY - 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(cx - 18, baseY - 62, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx + 18, baseY - 62, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  makeCanvas(scene, 'icon-nursery', 44, 44, (ctx) => {
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 8, 16, 28, 20, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.arc(22, 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // --- GATHERER HUT (Хатина збирача) ---
  makeCanvas(scene, 'building-gatherer_hut-0', w, h, (ctx) => {
    drawPad(ctx, 56);
    ctx.fillStyle = '#6f4222';
    drawRoundedRect(ctx, cx - 38, baseY - 26, 7, 26, 3);
    ctx.fill();
    drawRoundedRect(ctx, cx + 31, baseY - 26, 7, 26, 3);
    ctx.fill();
  });
  makeCanvas(scene, 'building-gatherer_hut-1', w, h, (ctx) => {
    drawPad(ctx, 58);
    ctx.fillStyle = '#7c4a27';
    drawRoundedRect(ctx, cx - 42, baseY - 54, 84, 52, 10);
    ctx.fill();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-gatherer_hut-2-winter' : 'building-gatherer_hut-2',
      w,
      h,
      (ctx) => {
        drawPad(ctx, 60);
        ctx.fillStyle = '#85532b';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, cx - 44, baseY - 56, 88, 54, 10);
        ctx.fill();
        ctx.stroke();

        // Leafy green or snowy roof with baskets beside entrance
        ctx.fillStyle = winter ? '#e2effa' : '#3aa845';
        ctx.beginPath();
        ctx.moveTo(cx - 54, baseY - 50);
        ctx.quadraticCurveTo(cx, baseY - 106, cx + 54, baseY - 50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Woven berry & wood baskets out front
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(cx - 26, baseY - 8, 10, 0, Math.PI * 2);
        ctx.arc(cx + 26, baseY - 8, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef233c';
        ctx.beginPath();
        ctx.arc(cx - 26, baseY - 10, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    );
  }
  makeCanvas(scene, 'icon-gatherer_hut', 44, 44, (ctx) => {
    ctx.fillStyle = '#3aa845';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(7, 24);
    ctx.lineTo(22, 8);
    ctx.lineTo(37, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d97706';
    drawRoundedRect(ctx, 12, 24, 20, 13, 4);
    ctx.fill();
    ctx.stroke();
  });

  // --- BRIDGE (Міст через річку) ---
  // Drawn spanning horizontally along X (180x120) so rotation = crossAngle aligns cleanly across any river bank!
  makeCanvas(scene, 'building-bridge-0', 180, 120, (ctx) => {
    // Bank pilings & taut guide ropes
    ctx.fillStyle = '#6f4222';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const px of [24, 148]) {
      for (const py of [32, 74]) {
        drawRoundedRect(ctx, px, py, 9, 18, 3);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#d9b07a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(28, 36);
    ctx.lineTo(152, 36);
    ctx.moveTo(28, 78);
    ctx.lineTo(152, 78);
    ctx.stroke();
  });

  makeCanvas(scene, 'building-bridge-1', 180, 120, (ctx) => {
    // Main stringer logs & partial planks
    ctx.fillStyle = '#6f4222';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 16, 40, 148, 8, 3);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, 16, 72, 148, 8, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9c6236';
    for (let x = 24; x <= 96; x += 14) {
      drawRoundedRect(ctx, x, 36, 10, 48, 2);
      ctx.fill();
      ctx.stroke();
    }
  });

  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-bridge-2-winter' : 'building-bridge-2',
      180,
      120,
      (ctx) => {
        // Subtle water shadow underneath deck
        ctx.fillStyle = 'rgba(10, 26, 42, 0.34)';
        drawRoundedRect(ctx, 14, 40, 152, 54, 8);
        ctx.fill();

        // Stone/earth riverbank abutments at left & right ends
        ctx.fillStyle = winter ? '#cbd5e1' : '#948673';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, 8, 32, 22, 56, 6);
        ctx.fill();
        ctx.stroke();
        drawRoundedRect(ctx, 150, 32, 22, 56, 6);
        ctx.fill();
        ctx.stroke();

        // Twin longitudinal stringer beams
        ctx.fillStyle = '#583116';
        drawRoundedRect(ctx, 18, 36, 144, 48, 5);
        ctx.fill();
        ctx.stroke();

        // Individual lashed wooden planks
        for (let i = 0; i < 11; i++) {
          const px = 22 + i * 12.5;
          ctx.fillStyle = i % 2 === 0 ? '#a97142' : '#925b30';
          drawRoundedRect(ctx, px, 35, 11, 50, 2.5);
          ctx.fill();
          ctx.stroke();
          if (winter) {
            ctx.fillStyle = 'rgba(241, 248, 255, 0.72)';
            drawRoundedRect(ctx, px + 1, 37, 9, 10, 2);
            ctx.fill();
          }
        }

        // Top & bottom log handrails + corner posts + rope lashings
        for (const railY of [31, 83]) {
          ctx.fillStyle = winter ? '#e2effa' : '#78350f';
          drawRoundedRect(ctx, 18, railY, 144, 6, 3);
          ctx.fill();
          ctx.stroke();
        }
        for (const postX of [20, 62, 110, 150]) {
          for (const postY of [26, 78]) {
            ctx.fillStyle = '#5c3419';
            drawRoundedRect(ctx, postX, postY, 8, 12, 3);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    );
  }

  makeCanvas(scene, 'icon-bridge', 44, 44, (ctx) => {
    ctx.fillStyle = '#0ea5e9';
    drawRoundedRect(ctx, 4, 22, 36, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#a97142';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4, 24);
    ctx.quadraticCurveTo(22, 8, 40, 24);
    ctx.lineTo(40, 31);
    ctx.quadraticCurveTo(22, 15, 4, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 20);
    ctx.quadraticCurveTo(22, 5, 38, 20);
    ctx.stroke();
  });

  // --- INFINITE ROCK CLIFF QUARRY (Вічна скеля) & SAPLINGS & BIOME TILES ---
  for (const winter of [false, true]) {
    makeCanvas(scene, winter ? 'rock-quarry-winter' : 'rock-quarry', 156, 124, (ctx) => {
      ctx.fillStyle = 'rgba(22, 28, 36, 0.36)';
      ctx.beginPath();
      ctx.ellipse(78, 98, 68, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createLinearGradient(20, 14, 136, 104);
      g.addColorStop(0, winter ? '#f1f5f9' : '#cbd5e1');
      g.addColorStop(0.5, '#64748b');
      g.addColorStop(1, '#334155');
      ctx.fillStyle = g;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(14, 96);
      ctx.lineTo(26, 38);
      ctx.lineTo(58, 14);
      ctx.lineTo(104, 18);
      ctx.lineTo(138, 46);
      ctx.lineTo(144, 96);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sparkling quartz / flint veins
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(48, 42);
      ctx.lineTo(66, 56);
      ctx.lineTo(58, 76);
      ctx.moveTo(96, 36);
      ctx.lineTo(110, 62);
      ctx.stroke();
    });
  }

  makeCanvas(scene, 'tree-sapling', 56, 64, (ctx) => {
    ctx.strokeStyle = '#7c4a27';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(28, 56);
    ctx.quadraticCurveTo(26, 38, 28, 24);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(21, 24, 9, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(35, 22, 9, 5, 0.4, 0, Math.PI * 2);
    ctx.ellipse(28, 15, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'bush-sapling', 48, 44, (ctx) => {
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(20, 28, 8, 0, Math.PI * 2);
    ctx.arc(29, 28, 7, 0, Math.PI * 2);
    ctx.arc(24, 21, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Desert sand & Permafrost terrain tiles
  for (let v = 0; v < 2; v++) {
    makeCanvas(scene, `terrain-sand-${v}`, 256, 256, (ctx) => {
      ctx.fillStyle = v === 0 ? '#e6c27a' : '#dfb970';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255, 238, 194, 0.35)';
      ctx.beginPath();
      ctx.ellipse(90 + v * 40, 80, 70, 22, 0.15, 0, Math.PI * 2);
      ctx.ellipse(170 - v * 35, 185, 65, 20, -0.1, 0, Math.PI * 2);
      ctx.fill();
    });

    makeCanvas(scene, `terrain-permafrost-${v}`, 256, 256, (ctx) => {
      ctx.fillStyle = v === 0 ? '#cbdce8' : '#c2d5e3';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.beginPath();
      ctx.arc(85 + v * 50, 95, 48, 0, Math.PI * 2);
      ctx.arc(175 - v * 40, 175, 44, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- MAMMOTH (Giant herd beast) ---
  makeCanvas(scene, 'animal-mammoth-leg', 24, 34, (ctx) => {
    ctx.fillStyle = '#5c3a21';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 5, 2, 14, 28, 5);
    ctx.fill();
    ctx.stroke();
  });

  makeCanvas(scene, 'animal-mammoth-body', 134, 108, (ctx) => {
    // Shaggy wool body
    const furGrad = ctx.createRadialGradient(54, 48, 8, 58, 52, 54);
    furGrad.addColorStop(0, '#9a5b32');
    furGrad.addColorStop(0.65, '#6b3e1f');
    furGrad.addColorStop(1, '#432512');
    ctx.fillStyle = furGrad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(54, 58, 44, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // High shaggy crown / head dome
    ctx.beginPath();
    ctx.ellipse(90, 42, 24, 24, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ear
    ctx.fillStyle = '#573118';
    ctx.beginPath();
    ctx.ellipse(76, 46, 8, 13, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Long curved trunk
    ctx.fillStyle = '#6b3e1f';
    ctx.beginPath();
    ctx.moveTo(106, 44);
    ctx.quadraticCurveTo(126, 62, 118, 92);
    ctx.quadraticCurveTo(114, 98, 108, 93);
    ctx.quadraticCurveTo(112, 70, 96, 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Giant curved ivory tusks
    ctx.fillStyle = '#fef9c3';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, 54);
    ctx.quadraticCurveTo(128, 66, 130, 36);
    ctx.quadraticCurveTo(122, 56, 94, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(98, 36, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, 'carcass-mammoth', 106, 76, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(53, 56, 44, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b3e1f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(46, 42, 34, 20, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.moveTo(68, 44);
    ctx.quadraticCurveTo(96, 52, 98, 28);
    ctx.quadraticCurveTo(90, 44, 68, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // --- CHIEF HUT (Хатина Вождя) ---
  makeCanvas(scene, 'building-chief_hut-0', 160, 140, (ctx) => {
    ctx.fillStyle = '#5c3a21';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const px of [44, 80, 116]) {
      drawRoundedRect(ctx, px - 4, 86, 8, 36, 3);
      ctx.fill();
      ctx.stroke();
    }
  });
  makeCanvas(scene, 'building-chief_hut-1', 160, 140, (ctx) => {
    ctx.fillStyle = '#7c4d2b';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 34, 64, 92, 60, 10);
    ctx.fill();
    ctx.stroke();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-chief_hut-2-winter' : 'building-chief_hut-2',
      160,
      140,
      (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(80, 124, 58, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Grand wooden hall
        ctx.fillStyle = '#7c4d2b';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        drawRoundedRect(ctx, 34, 66, 92, 56, 8);
        ctx.fill();
        ctx.stroke();

        // Doorway
        ctx.fillStyle = '#29170b';
        drawRoundedRect(ctx, 68, 86, 24, 36, 10);
        ctx.fill();
        ctx.stroke();

        // Ornate peaked roof + chief horns
        ctx.fillStyle = winter ? '#e2effa' : '#b45309';
        ctx.beginPath();
        ctx.moveTo(22, 72);
        ctx.lineTo(80, 20);
        ctx.lineTo(138, 72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Golden tribal crest & twin horns
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(80, 44, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.moveTo(72, 24);
        ctx.quadraticCurveTo(56, 10, 60, 4);
        ctx.quadraticCurveTo(64, 14, 77, 20);
        ctx.moveTo(88, 24);
        ctx.quadraticCurveTo(104, 10, 100, 4);
        ctx.quadraticCurveTo(96, 14, 83, 20);
        ctx.fill();
        ctx.stroke();
      }
    );
  }
  makeCanvas(scene, 'icon-chief_hut', 44, 44, (ctx) => {
    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(6, 26);
    ctx.lineTo(22, 9);
    ctx.lineTo(38, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7c4d2b';
    drawRoundedRect(ctx, 11, 26, 22, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(22, 18, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- TRAINING GROUND / GYM (Спортзал, велика арена для до 3 осіб) ---
  makeCanvas(scene, 'building-training_ground-0', 208, 160, (ctx) => {
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 36, 98, 136, 38, 8);
    ctx.fill();
    ctx.stroke();
  });
  makeCanvas(scene, 'building-training_ground-1', 208, 160, (ctx) => {
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 28, 84, 152, 52, 12);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, 52, 54, 12, 58, 3);
    ctx.fill();
    ctx.stroke();
    drawRoundedRect(ctx, 146, 62, 12, 50, 3);
    ctx.fill();
    ctx.stroke();
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-training_ground-2-winter' : 'building-training_ground-2',
      208,
      160,
      (ctx) => {
        // Wide sand/snow training ring
        ctx.fillStyle = winter ? '#cbd5e1' : '#a16207';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(104, 114, 86, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Wooden fence posts around back edge
        for (const px of [34, 70, 138, 174]) {
          ctx.fillStyle = '#5c3419';
          drawRoundedRect(ctx, px - 4, 74, 8, 28, 2);
          ctx.fill();
          ctx.stroke();
        }

        // Left: Heavy training dummy post & crossbar
        ctx.fillStyle = '#78350f';
        drawRoundedRect(ctx, 48, 52, 14, 62, 3);
        ctx.fill();
        ctx.stroke();
        drawRoundedRect(ctx, 36, 64, 38, 9, 3);
        ctx.fill();
        ctx.stroke();

        // Center: Heavy lifting log & stone weights
        ctx.fillStyle = '#6b4226';
        drawRoundedRect(ctx, 84, 98, 40, 12, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(82, 104, 8, 0, Math.PI * 2);
        ctx.arc(126, 104, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right: Archery straw target
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(152, 78, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(152, 78, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7c2d12';
        drawRoundedRect(ctx, 148, 98, 8, 24, 2);
        ctx.fill();
        ctx.stroke();
      }
    );
  }
  makeCanvas(scene, 'icon-training_ground', 44, 44, (ctx) => {
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(24, 21, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(24, 21, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    drawRoundedRect(ctx, 10, 12, 6, 24, 2);
    ctx.fill();
    ctx.stroke();
  });

  // --- ANIMAL PEN (Загін звірів) ---
  makeCanvas(scene, 'building-animal_pen-0', 160, 140, (ctx) => {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 72, 92, 46);
  });
  makeCanvas(scene, 'building-animal_pen-1', 160, 140, (ctx) => {
    ctx.fillStyle = '#7c5338';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const px of [34, 64, 96, 126]) {
      drawRoundedRect(ctx, px - 4, 68, 8, 48, 3);
      ctx.fill();
      ctx.stroke();
    }
  });
  for (const winter of [false, true]) {
    makeCanvas(
      scene,
      winter ? 'building-animal_pen-2-winter' : 'building-animal_pen-2',
      160,
      140,
      (ctx) => {
        // Mud / grass pen floor
        ctx.fillStyle = winter ? '#cbd5e1' : '#854d0e';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, 26, 64, 108, 56, 12);
        ctx.fill();
        ctx.stroke();

        // Tame boar inside pen
        ctx.fillStyle = '#573118';
        ctx.beginPath();
        ctx.ellipse(66, 92, 16, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9a6b4c';
        ctx.beginPath();
        ctx.ellipse(100, 95, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Wooden fence rails & posts
        ctx.fillStyle = winter ? '#e2effa' : '#78350f';
        drawRoundedRect(ctx, 24, 112, 112, 6, 2);
        ctx.fill();
        ctx.stroke();
        for (const px of [28, 62, 98, 130]) {
          ctx.fillStyle = '#5c3419';
          drawRoundedRect(ctx, px - 4, 98, 8, 24, 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    );
  }
  makeCanvas(scene, 'icon-animal_pen', 44, 44, (ctx) => {
    ctx.fillStyle = '#854d0e';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    drawRoundedRect(ctx, 6, 12, 32, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5c3419';
    ctx.beginPath();
    ctx.ellipse(22, 24, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}
