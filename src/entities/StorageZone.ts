import Phaser from 'phaser';
import { MAX_STORAGE, ResourceType } from '../types/game';

export class StorageZone extends Phaser.GameObjects.Container {
  public readonly resourceType: ResourceType;
  public readonly labelUk: string;
  private amount = 0;
  private maxCapacity = MAX_STORAGE;

  private hoverGlow: Phaser.GameObjects.Ellipse;
  private pileSprite: Phaser.GameObjects.Image;
  private countText: Phaser.GameObjects.Text;
  private tooltipContainer: Phaser.GameObjects.Container;
  private tooltipText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resourceType: ResourceType,
    labelUk: string
  ) {
    super(scene, x, y);
    this.resourceType = resourceType;
    this.labelUk = labelUk;

    this.hoverGlow = scene.add.ellipse(0, 12, 98, 52, 0xffe066, 0.2);
    this.hoverGlow.setStrokeStyle(2, 0xffe066, 0.85);
    this.hoverGlow.setVisible(false);

    this.pileSprite = scene.add.image(0, 0, `storage-${resourceType}-0`);
    this.pileSprite.setOrigin(0.5, 0.65);

    // Compact badge pill at the front edge of the depot
    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(0x23170e, 0.9);
    badgeBg.fillRoundedRect(-39, 20, 78, 20, 8);
    badgeBg.lineStyle(1.5, 0xc98a4b, 0.95);
    badgeBg.strokeRoundedRect(-39, 20, 78, 20, 8);

    const badgeIcon = scene.add.image(-26, 30, `icon-${resourceType}`).setScale(0.42);
    this.countText = scene.add
      .text(8, 30, `0/${MAX_STORAGE}`, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff8e7'
      })
      .setOrigin(0.5);

    // Hover tooltip above pile
    this.tooltipContainer = scene.add.container(0, -48);
    const tipBg = scene.add.graphics();
    tipBg.fillStyle(0x1f140c, 0.94);
    tipBg.fillRoundedRect(-73, -14, 146, 24, 7);
    tipBg.lineStyle(1.5, 0xffe066, 0.9);
    tipBg.strokeRoundedRect(-73, -14, 146, 24, 7);

    this.tooltipText = scene.add
      .text(0, -2, `${labelUk}: 0/${MAX_STORAGE}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066'
      })
      .setOrigin(0.5);
    this.tooltipContainer.add([tipBg, this.tooltipText]);
    this.tooltipContainer.setVisible(false);

    this.add([
      this.hoverGlow,
      this.pileSprite,
      badgeBg,
      badgeIcon,
      this.countText,
      this.tooltipContainer
    ]);
    this.setSize(104, 88);
    this.setDepth(y);

    const hitCircle = new Phaser.Geom.Circle(0, 6, 52);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = 'pointer';
    }

    this.on('pointerover', () => {
      this.hoverGlow.setVisible(true);
      this.tooltipContainer.setVisible(true);
    });
    this.on('pointerout', () => {
      this.hoverGlow.setVisible(false);
      this.tooltipContainer.setVisible(false);
    });

    scene.add.existing(this);
  }

  public getDropPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y + 18 };
  }

  public getAmount(): number {
    return this.amount;
  }

  public isFull(): boolean {
    return this.amount >= this.maxCapacity;
  }

  public setMaxCapacity(cap: number): void {
    this.maxCapacity = Math.max(MAX_STORAGE, cap);
    this.countText.setText(`${this.amount}/${this.maxCapacity}`);
    this.countText.setColor(this.amount >= this.maxCapacity ? '#fbbf24' : '#fff8e7');
    this.tooltipText.setText(`${this.labelUk}: ${this.amount}/${this.maxCapacity}`);
  }

  public setAmount(newAmount: number): void {
    const clamped = Phaser.Math.Clamp(newAmount, 0, this.maxCapacity);
    const changed = clamped !== this.amount;
    this.amount = clamped;
    this.countText.setText(`${this.amount}/${this.maxCapacity}`);
    this.countText.setColor(this.amount >= this.maxCapacity ? '#fbbf24' : '#fff8e7');
    this.tooltipText.setText(`${this.labelUk}: ${this.amount}/${this.maxCapacity}`);

    const stage = this.computeStage(this.amount);
    this.pileSprite.setTexture(`storage-${this.resourceType}-${stage}`);

    if (changed && this.scene) {
      this.scene.tweens.killTweensOf(this.pileSprite);
      this.pileSprite.setScale(1, 1);
      this.scene.tweens.add({
        targets: this.pileSprite,
        scaleX: 1.1,
        scaleY: 0.9,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut'
      });
    }
  }

  private computeStage(val: number): number {
    if (val <= 0) return 0;
    if (val <= 15) return 1;
    if (val <= 40) return 2;
    if (val <= 75) return 3;
    return 4;
  }
}
