import Phaser from 'phaser';

export class Campfire extends Phaser.GameObjects.Container {
  private flame: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Arc;
  private sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private flameTimer = 0;
  private flameFrame = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.glow = scene.add.circle(0, 4, 108, 0xff9f1c, 0.18);
    const base = scene.add.image(0, 0, 'campfire-base');
    this.flame = scene.add.image(0, -28, 'flame-0');

    this.add([this.glow, base, this.flame]);
    this.setSize(150, 110);
    this.setDepth(y);

    // Rising glowing embers/sparks
    this.sparkEmitter = scene.add.particles(x, y - 18, 'particle-spark', {
      lifespan: { min: 700, max: 1300 },
      speedY: { min: -55, max: -28 },
      speedX: { min: -16, max: 16 },
      scale: { start: 0.9, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      frequency: 170,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD
    });
    this.sparkEmitter.setDepth(y + 12);

    // Soft curling smoke wisps
    this.smokeEmitter = scene.add.particles(x, y - 42, 'particle-smoke', {
      lifespan: { min: 1500, max: 2400 },
      speedY: { min: -34, max: -20 },
      speedX: { min: -10, max: 14 },
      scale: { start: 0.45, end: 1.55 },
      alpha: { start: 0.42, end: 0 },
      frequency: 260,
      quantity: 1
    });
    this.smokeEmitter.setDepth(y + 11);

    scene.add.existing(this);
  }

  public update(delta: number): void {
    this.flameTimer += delta;
    if (this.flameTimer >= 110) {
      this.flameTimer = 0;
      this.flameFrame = (this.flameFrame + 1) % 4;
      this.flame.setTexture(`flame-${this.flameFrame}`);
      const scale = 0.96 + Math.sin(this.scene.time.now * 0.012) * 0.07;
      this.flame.setScale(scale);
      this.glow.setAlpha(0.15 + Math.sin(this.scene.time.now * 0.008) * 0.04);
    }
  }
}
