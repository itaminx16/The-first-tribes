import Phaser from 'phaser';
import { Season } from '../types/game';

interface WeatherParticle {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  phase: number;
  swayAmp: number;
  rotSpeed: number;
}

const POOL_SIZE = 44;

export class WeatherSystem {
  private scene: Phaser.Scene;
  private season: Season;
  private particles: WeatherParticle[] = [];
  private tintOverlay: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, initialSeason: Season = 'SPRING') {
    this.scene = scene;
    this.season = initialSeason;

    this.tintOverlay = scene.add.rectangle(
      scene.scale.width * 0.5,
      scene.scale.height * 0.5,
      scene.scale.width + 64,
      scene.scale.height + 64,
      0x38bdf8,
      0.04
    );
    this.tintOverlay.setScrollFactor(0);
    this.tintOverlay.setDepth(2590);

    scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (!this.tintOverlay.scene) return;
      this.tintOverlay.setPosition(gameSize.width * 0.5, gameSize.height * 0.5);
      this.tintOverlay.setSize(gameSize.width + 64, gameSize.height + 64);
    });

    for (let i = 0; i < POOL_SIZE; i++) {
      const img = scene.add.image(0, 0, 'particle-rain');
      img.setDepth(2600);
      img.setAlpha(0.7);
      this.particles.push({
        sprite: img,
        vx: -40,
        vy: 300,
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
        swayAmp: 12,
        rotSpeed: 0
      });
    }

    this.applySeason(initialSeason);
  }

  public setSeason(season: Season): void {
    if (this.season === season) return;
    this.season = season;
    this.applySeason(season);
  }

  public update(simDelta: number): void {
    const cam = this.scene.cameras.main;
    const viewW = Math.max(400, cam.worldView.width || this.scene.scale.width / cam.zoom);
    const viewH = Math.max(300, cam.worldView.height || this.scene.scale.height / cam.zoom);
    const left = (cam.worldView.width ? cam.worldView.x : cam.scrollX) - 40;
    const top = (cam.worldView.height ? cam.worldView.y : cam.scrollY) - 40;
    const right = left + viewW + 80;
    const bottom = top + viewH + 80;

    const dt = simDelta / 1000;
    const nowSec = this.scene.time.now * 0.002;
    const activeCount = this.getActiveCount(this.season);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (i >= activeCount) {
        p.sprite.setVisible(false);
        continue;
      }
      p.sprite.setVisible(true);

      const sway = Math.sin(nowSec + p.phase) * p.swayAmp;
      p.sprite.x += (p.vx + sway) * dt;
      p.sprite.y += p.vy * dt;

      if (this.season === 'SUMMER') {
        // Gentle butterfly wing flutter + organic vertical bob
        p.sprite.y += Math.cos(nowSec * 1.6 + p.phase) * 18 * dt;
        const flap = 0.55 + Math.abs(Math.sin(nowSec * 6.5 + p.phase)) * 0.6;
        p.sprite.setScale(flap, 1);
      } else if (this.season === 'AUTUMN') {
        p.sprite.angle += p.rotSpeed * dt;
      }

      // Wrap around active camera viewport
      if (p.sprite.x < left) p.sprite.x = right - 4;
      else if (p.sprite.x > right) p.sprite.x = left + 4;

      if (p.sprite.y > bottom) {
        p.sprite.y = top + 4;
        p.sprite.x = Phaser.Math.FloatBetween(left, right);
      } else if (p.sprite.y < top) {
        p.sprite.y = bottom - 4;
        p.sprite.x = Phaser.Math.FloatBetween(left, right);
      }
    }
  }

  private getActiveCount(season: Season): number {
    switch (season) {
      case 'SPRING':
        return 34;
      case 'SUMMER':
        return 10;
      case 'AUTUMN':
        return 26;
      case 'WINTER':
        return 42;
    }
  }

  private applySeason(season: Season): void {
    if (season === 'SPRING') {
      this.tintOverlay.setFillStyle(0x38bdf8, 0.045);
    } else if (season === 'SUMMER') {
      this.tintOverlay.setFillStyle(0xfef08a, 0.045);
    } else if (season === 'AUTUMN') {
      this.tintOverlay.setFillStyle(0xf59e0b, 0.065);
    } else {
      this.tintOverlay.setFillStyle(0xbae6fd, 0.095);
    }

    const cam = this.scene.cameras.main;
    const viewW = Math.max(800, cam.worldView.width || 1280);
    const viewH = Math.max(600, cam.worldView.height || 720);
    const left = (cam.worldView.width ? cam.worldView.x : cam.scrollX) - 40;
    const top = (cam.worldView.height ? cam.worldView.y : cam.scrollY) - 40;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.sprite.setPosition(
        left + Phaser.Math.FloatBetween(0, viewW + 80),
        top + Phaser.Math.FloatBetween(0, viewH + 80)
      );
      p.sprite.setAngle(0);
      p.sprite.setScale(1, 1);

      if (season === 'SPRING') {
        p.sprite.setTexture('particle-rain');
        p.sprite.setAlpha(Phaser.Math.FloatBetween(0.45, 0.78));
        p.sprite.setScale(Phaser.Math.FloatBetween(0.85, 1.25));
        p.vx = Phaser.Math.FloatBetween(-65, -45);
        p.vy = Phaser.Math.FloatBetween(360, 480);
        p.swayAmp = 4;
        p.rotSpeed = 0;
      } else if (season === 'SUMMER') {
        p.sprite.setTexture(`particle-butterfly-${i % 2}`);
        p.sprite.setAlpha(0.9);
        p.vx = Phaser.Math.FloatBetween(-26, 26);
        p.vy = Phaser.Math.FloatBetween(-12, 12);
        p.swayAmp = 24;
        p.rotSpeed = 0;
      } else if (season === 'AUTUMN') {
        p.sprite.setTexture(`particle-leaf-${i % 2}`);
        p.sprite.setAlpha(Phaser.Math.FloatBetween(0.75, 0.95));
        p.sprite.setScale(Phaser.Math.FloatBetween(0.8, 1.2));
        p.vx = Phaser.Math.FloatBetween(14, 42);
        p.vy = Phaser.Math.FloatBetween(44, 76);
        p.swayAmp = 28;
        p.rotSpeed = Phaser.Math.FloatBetween(-120, 120);
      } else {
        p.sprite.setTexture('particle-snow');
        p.sprite.setAlpha(Phaser.Math.FloatBetween(0.65, 0.95));
        p.sprite.setScale(Phaser.Math.FloatBetween(0.7, 1.35));
        p.vx = Phaser.Math.FloatBetween(-18, 18);
        p.vy = Phaser.Math.FloatBetween(38, 72);
        p.swayAmp = 22;
        p.rotSpeed = 0;
      }
    }
  }
}
