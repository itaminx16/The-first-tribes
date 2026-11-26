import Phaser from 'phaser';
import { CARCASS_YIELD, MAMMOTH_CARCASS_YIELD, ResourceType } from '../types/game';
import { CURSORS } from '../utils/Cursors';

export type CarcassKind = 'boar' | 'deer' | 'predator' | 'mammoth';

export class AnimalCarcass extends Phaser.GameObjects.Container {
  public readonly kind: CarcassKind;
  public readonly arrivalRadius = 40;
  public readonly interactRadius = 56;

  private amounts: Record<'food' | 'bone' | 'hide', number>;

  private hoverRing: Phaser.GameObjects.Ellipse;
  private sprite: Phaser.GameObjects.Image;
  private pillBg: Phaser.GameObjects.Graphics;
  private pillText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: CarcassKind) {
    super(scene, x, y);
    this.kind = kind;
    const baseYield = kind === 'mammoth' ? MAMMOTH_CARCASS_YIELD : CARCASS_YIELD;
    this.amounts = {
      food: baseYield.food,
      bone: baseYield.bone,
      hide: baseYield.hide
    };

    this.hoverRing = scene.add.ellipse(0, 6, kind === 'mammoth' ? 106 : 78, kind === 'mammoth' ? 46 : 34, 0xffe066, 0.2);
    this.hoverRing.setStrokeStyle(2.2, 0xffe066, 0.92);
    this.hoverRing.setVisible(false);

    this.sprite = scene.add
      .image(0, 0, `carcass-${kind}`)
      .setScale(kind === 'mammoth' ? 0.92 : 0.75);

    this.pillBg = scene.add.graphics();
    this.pillText = scene.add
      .text(0, 26, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fff8e7'
      })
      .setOrigin(0.5);

    this.add([this.hoverRing, this.sprite, this.pillBg, this.pillText]);
    this.setSize(82, 62);
    this.setDepth(y);

    const hitCircle = new Phaser.Geom.Circle(0, 0, 42);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.food;
    }

    this.on('pointerover', () => {
      if (!this.isEmpty()) this.hoverRing.setVisible(true);
    });
    this.on('pointerout', () => {
      this.hoverRing.setVisible(false);
    });

    this.refreshPill();
    scene.add.existing(this);
  }

  public isEmpty(): boolean {
    return this.amounts.food <= 0 && this.amounts.bone <= 0 && this.amounts.hide <= 0;
  }

  public isPointInsideClickArea(wx: number, wy: number): boolean {
    return !this.isEmpty() && Phaser.Math.Distance.Between(wx, wy, this.x, this.y) <= 44;
  }

  public getAmount(type: 'food' | 'bone' | 'hide'): number {
    return this.amounts[type];
  }

  public getNextAvailableType(
    isStorageFull: (type: ResourceType) => boolean
  ): 'food' | 'bone' | 'hide' | null {
    const order: Array<'food' | 'bone' | 'hide'> = ['food', 'bone', 'hide'];
    for (const t of order) {
      if (this.amounts[t] > 0 && !isStorageFull(t)) {
        return t;
      }
    }
    return null;
  }

  public harvest(type: 'food' | 'bone' | 'hide', maxCount = 1): number {
    if (this.amounts[type] <= 0) return 0;
    const taken = Math.min(maxCount, this.amounts[type]);
    this.amounts[type] -= taken;
    this.refreshPill();

    if (this.isEmpty()) {
      this.hoverRing.setVisible(false);
      this.disableInteractive();
      this.scene?.tweens.add({
        targets: this,
        alpha: 0,
        duration: 420,
        onComplete: () => this.destroy()
      });
    }
    return taken;
  }

  public spawnHarvestChips(): void {
    if (!this.scene) return;
    for (let i = 0; i < 4; i++) {
      const p = this.scene.add.circle(
        this.x + Phaser.Math.Between(-10, 10),
        this.y + Phaser.Math.Between(-6, 6),
        2.6,
        i % 2 === 0 ? 0xfef08a : 0xef4444,
        0.9
      );
      p.setDepth(this.y + 30);
      this.scene.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-18, 18),
        y: p.y - Phaser.Math.Between(12, 24),
        alpha: 0,
        duration: 340,
        onComplete: () => p.destroy()
      });
    }
  }

  private refreshPill(): void {
    const parts: string[] = [];
    if (this.amounts.food > 0) parts.push(`🍖${this.amounts.food}`);
    if (this.amounts.bone > 0) parts.push(`🦴${this.amounts.bone}`);
    if (this.amounts.hide > 0) parts.push(`🧥${this.amounts.hide}`);
    const label = parts.join(' ');
    this.pillText.setText(label);
    const w = Math.max(46, this.pillText.width + 14);
    this.pillBg.clear();
    if (parts.length > 0) {
      this.pillBg.fillStyle(0x23170e, 0.88);
      this.pillBg.fillRoundedRect(-w / 2, 16, w, 19, 7);
      this.pillBg.lineStyle(1.3, 0xc98a4b, 0.9);
      this.pillBg.strokeRoundedRect(-w / 2, 16, w, 19, 7);
    }
  }
}
