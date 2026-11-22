import Phaser from 'phaser';
import { RESOURCE_META, ResourceType, Season } from '../types/game';

export interface ResourceNodeOptions {
  isInfinite?: boolean;
  isSapling?: boolean;
  onDepleted?: (node: ResourceNode) => void;
}

export class ResourceNode extends Phaser.GameObjects.Container {
  public readonly resourceType: ResourceType;
  public maxAmount: number;
  public amount: number;
  public depleted = false;
  public isInfinite = false;
  public isStump = false;
  public isSapling = false;

  public interactRadius: number;
  public arrivalRadius: number;
  public collisionRadius: number;

  private sprite: Phaser.GameObjects.Image;
  private countBadge: Phaser.GameObjects.Text;
  private hoverRing: Phaser.GameObjects.Graphics;
  private currentSeason: Season = 'SPRING';
  private clickRadius: number;

  private readonly visualVariant: number;
  private saplingTimer = 0;
  private readonly saplingDurationMs = 22_000;
  private stumpDecayTimer = 75_000;
  private onDepleted?: (node: ResourceNode) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: ResourceType,
    amount?: number,
    options?: ResourceNodeOptions
  ) {
    super(scene, x, y);
    this.resourceType = type;
    this.isInfinite = options?.isInfinite ?? false;
    this.isSapling = options?.isSapling ?? false;
    this.onDepleted = options?.onDepleted;
    this.visualVariant = Math.abs(Math.round(x + y)) % 3;

    const defaultCap = this.isInfinite
      ? 9999
      : type === 'wood'
      ? 25
      : type === 'stone'
      ? 40
      : 10;
    this.maxAmount = amount ?? defaultCap;
    this.amount = this.maxAmount;

    this.interactRadius = this.isInfinite
      ? 76
      : type === 'wood'
      ? 60
      : type === 'stone'
      ? 58
      : 52;
    this.arrivalRadius = this.isInfinite
      ? 54
      : type === 'wood'
      ? 42
      : type === 'stone'
      ? 40
      : 36;
    this.collisionRadius = this.isInfinite
      ? 48
      : type === 'wood'
      ? 22
      : type === 'stone'
      ? 25
      : 14;
    this.clickRadius = this.isInfinite
      ? 74
      : type === 'wood'
      ? 50
      : type === 'stone'
      ? 44
      : 38;

    this.hoverRing = scene.add.graphics();
    this.add(this.hoverRing);

    const textureKey = this.getSeasonalTextureKey('SPRING');
    this.sprite = scene.add.image(0, 0, textureKey);
    if (this.isInfinite) {
      this.sprite.setOrigin(0.5, 0.65);
    } else if (type === 'wood') {
      this.sprite.setOrigin(0.5, 0.78);
    } else {
      this.sprite.setOrigin(0.5, 0.55);
    }
    this.add(this.sprite);

    const meta = RESOURCE_META[type];
    const badgeY = this.isInfinite ? -64 : type === 'wood' ? -84 : -38;
    const badgeText = this.isInfinite ? `${meta.emoji} ∞` : `${meta.emoji}${this.amount}`;
    this.countBadge = scene.add
      .text(0, badgeY, badgeText, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: this.isInfinite ? '#fde68a' : '#fff7e6',
        backgroundColor: 'rgba(24, 18, 12, 0.78)',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.countBadge);

    if (this.isSapling) {
      this.sprite.setScale(0.38);
      if (this.resourceType === 'wood' && scene.textures.exists('tree-sapling')) {
        this.sprite.setTexture('tree-sapling');
      } else if (this.resourceType === 'food' && scene.textures.exists('bush-sapling')) {
        this.sprite.setTexture('bush-sapling');
      }
    }

    this.setSize(this.clickRadius * 2, this.clickRadius * 2);
    this.setInteractive(
      new Phaser.Geom.Circle(this.clickRadius, this.clickRadius, this.clickRadius),
      Phaser.Geom.Circle.Contains
    );

    this.on('pointerover', () => {
      if (this.depleted) return;
      this.drawHoverRing(true);
      this.scene.input.setDefaultCursor('pointer');
    });

    this.on('pointerout', () => {
      this.drawHoverRing(false);
      this.scene.input.setDefaultCursor('default');
    });

    this.setDepth(y);
    scene.add.existing(this);
  }

  private updateBadgeLabel(): void {
    const meta = RESOURCE_META[this.resourceType];
    if (this.isInfinite) {
      this.countBadge.setText(`${meta.emoji} Вічна скеля (∞)`);
    } else if (this.isStump) {
      this.countBadge.setText(`🪵 Пень (${this.amount})`);
    } else if (this.isSapling) {
      this.countBadge.setText(`🌱 Паросток`);
    } else {
      this.countBadge.setText(`${meta.emoji}${this.amount}`);
    }
  }

  private getSeasonalTextureKey(season: Season): string {
    if (this.isStump) {
      return 'tree-stump';
    }
    if (this.isInfinite) {
      return season === 'WINTER' ? 'rock-quarry-winter' : 'rock-quarry';
    }
    if (this.isSapling) {
      if (this.resourceType === 'wood' && this.scene.textures.exists('tree-sapling')) {
        return 'tree-sapling';
      }
      if (this.resourceType === 'food' && this.scene.textures.exists('bush-sapling')) {
        return 'bush-sapling';
      }
    }
    if (this.resourceType === 'wood') {
      if (this.visualVariant === 0) {
        return season === 'WINTER' ? 'tree-pine-winter' : 'tree-pine';
      }
      if (season === 'WINTER') return 'tree-oak-winter';
      if (season === 'AUTUMN') return 'tree-oak-autumn';
      if (season === 'SUMMER') return 'tree-oak-summer';
      return 'tree-oak-spring';
    }
    if (this.resourceType === 'stone') {
      const rIdx = this.visualVariant % 2;
      return season === 'WINTER' ? `rock-${rIdx}-winter` : `rock-${rIdx}`;
    }
    if (season === 'WINTER') {
      return 'bush-winter';
    }
    return this.depleted || this.amount <= 0 ? 'bush-empty' : 'bush-berries';
  }

  public setSeason(season: Season, _springRipened = true): void {
    this.currentSeason = season;
    if (!this.active) return;

    this.sprite.setTexture(this.getSeasonalTextureKey(season));

    // In Spring, adult berry bushes replenish if slightly picked
    if (
      season === 'SPRING' &&
      this.resourceType === 'food' &&
      !this.depleted &&
      !this.isSapling &&
      this.amount < this.maxAmount
    ) {
      this.amount = this.maxAmount;
      this.updateBadgeLabel();
    }
  }

  public isSpringBuds(): boolean {
    return false;
  }

  public isPointInsideClickArea(wx: number, wy: number): boolean {
    if (this.depleted || !this.active) return false;
    return Phaser.Math.Distance.Between(wx, wy, this.x, this.y - 12) <= this.clickRadius;
  }

  public isHarvestableInSeason(season: Season): boolean {
    if (this.depleted || this.amount <= 0 || this.isSapling) return false;
    if (this.resourceType === 'food' && season === 'WINTER') {
      return false;
    }
    return true;
  }

  private drawHoverRing(visible: boolean): void {
    this.hoverRing.clear();
    if (!visible || this.depleted) return;

    const color = this.isInfinite
      ? 0x38bdf8
      : this.isStump
      ? 0xd97706
      : this.resourceType === 'wood'
      ? 0x8bc34a
      : this.resourceType === 'stone'
      ? 0x90caf9
      : 0xffab40;
    const rx = this.clickRadius;
    const ry = Math.round(this.clickRadius * 0.62);
    this.hoverRing.lineStyle(2.5, color, 0.9);
    this.hoverRing.fillStyle(color, 0.14);
    this.hoverRing.fillEllipse(0, 4, rx * 2, ry * 2);
    this.hoverRing.strokeEllipse(0, 4, rx * 2, ry * 2);
  }

  public isDepleted(): boolean {
    return this.depleted || this.amount <= 0;
  }

  public spawnHitParticles(): void {
    if (!this.scene || this.depleted) return;
    const key =
      this.resourceType === 'wood'
        ? 'particle-chip-wood'
        : this.resourceType === 'stone'
        ? 'particle-chip-stone'
        : 'particle-chip-wood';
    if (!this.scene.textures.exists(key)) return;
    for (let i = 0; i < 4; i++) {
      const chip = this.scene.add.image(
        this.x + Phaser.Math.Between(-16, 16),
        this.y - Phaser.Math.Between(10, 32),
        key
      );
      chip.setDepth(this.y + 30);
      this.scene.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-18, 18),
        y: chip.y - Phaser.Math.Between(8, 22),
        alpha: 0,
        duration: 280,
        onComplete: () => chip.destroy(),
      });
    }
  }

  public playHitShake(): void {
    if (!this.scene || this.depleted) return;
    const baseScale = this.isSapling ? 0.5 : 1;
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -5, to: 5 },
      scaleY: { from: baseScale * 0.94, to: baseScale },
      duration: 90,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (this.sprite && this.sprite.active) {
          this.sprite.setAngle(0);
          if (!this.isSapling) this.sprite.setScale(1);
        }
      },
    });
  }

  public harvest(requested = 1): number {
    if (this.depleted || this.amount <= 0 || this.isSapling) return 0;
    if (!this.isHarvestableInSeason(this.currentSeason)) return 0;

    if (this.isInfinite) {
      this.playHitShake();
      return requested;
    }

    const taken = Math.min(requested, this.amount);
    this.amount -= taken;
    this.updateBadgeLabel();
    this.playHitShake();

    if (this.amount <= 0) {
      if (this.resourceType === 'wood' && !this.isStump) {
        // Tree turns into an uprootable stump with 2 bonus wood!
        this.isStump = true;
        this.amount = 2;
        this.maxAmount = 2;
        this.collisionRadius = 12;
        this.sprite.setTexture('tree-stump');
        this.sprite.setOrigin(0.5, 0.72);
        this.countBadge.setY(-32);
        this.updateBadgeLabel();
      } else {
        this.finishAndDestroy();
      }
    }

    return taken;
  }

  /**
   * Immediately clears a stump, bush, or finite node (used by Gatherers or building placement).
   */
  public clearNode(): number {
    if (this.depleted || this.isInfinite) return 0;
    const bonusWood = this.isStump ? Math.max(1, this.amount) : 0;
    this.finishAndDestroy();
    return bonusWood;
  }

  private finishAndDestroy(): void {
    if (this.depleted) return;
    this.depleted = true;
    this.amount = 0;
    this.drawHoverRing(false);
    this.countBadge.setVisible(false);
    this.disableInteractive();

    const cb = this.onDepleted;
    this.onDepleted = undefined;
    cb?.(this);

    if (this.scene) {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scale: 0.65,
        duration: 320,
        onComplete: () => {
          this.destroy();
        },
      });
    } else {
      this.destroy();
    }
  }

  public update(delta: number): void {
    if (this.depleted || !this.active) return;

    if (this.isSapling) {
      this.saplingTimer += delta;
      const pct = Phaser.Math.Clamp(this.saplingTimer / this.saplingDurationMs, 0, 1);
      this.sprite.setScale(0.38 + pct * 0.62);
      if (pct >= 1) {
        this.isSapling = false;
        this.sprite.setScale(1);
        this.sprite.setTexture(this.getSeasonalTextureKey(this.currentSeason));
        this.updateBadgeLabel();
      }
    } else if (this.isStump) {
      this.stumpDecayTimer -= delta;
      if (this.stumpDecayTimer <= 0) {
        this.finishAndDestroy();
      }
    }
  }
}
