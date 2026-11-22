import { MusicTrackId } from '../types/game';

class SoundFXManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private activeMusicNodes: AudioScheduledSourceNode[] = [];
  private muted = false;
  private musicTrack: MusicTrackId = 0;
  private ambientEnabled = true;
  private musicStep = 0;
  private musicIntervalId: number | null = null;

  public unlock(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (!this.musicGain && this.ctx) {
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(
          this.muted || this.musicTrack === 0 ? 0 : 1,
          this.ctx.currentTime
        );
        this.musicGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.musicTrack !== 0 && !this.muted) {
        this.ensureMusicLoop();
      }
    } catch {
      // Ignore audio errors in restricted environments
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncMusicMasterGain();
    return this.muted;
  }

  public getMusicTrack(): MusicTrackId {
    return this.musicTrack;
  }

  public setMusicTrack(track: MusicTrackId): void {
    this.musicTrack = track;
    this.musicStep = 0;
    this.syncMusicMasterGain();
    if (track === 0) {
      if (this.musicIntervalId !== null) {
        window.clearInterval(this.musicIntervalId);
        this.musicIntervalId = null;
      }
      for (const node of this.activeMusicNodes) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Ignore already stopped
        }
      }
      this.activeMusicNodes = [];
    } else {
      this.ensureMusicLoop();
    }
  }

  private syncMusicMasterGain(): void {
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setValueAtTime(
        this.muted || this.musicTrack === 0 ? 0 : 1,
        this.ctx.currentTime
      );
    }
  }

  public isAmbientEnabled(): boolean {
    return this.ambientEnabled;
  }

  public setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
  }

  private ensureMusicLoop(): void {
    if (this.musicIntervalId !== null) return;
    this.musicIntervalId = window.setInterval(() => {
      this.stepBackgroundMusic();
    }, 520);
  }

  private stepBackgroundMusic(): void {
    if (this.muted || this.musicTrack === 0) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const musicOut = this.musicGain ?? ctx.destination;
      const now = ctx.currentTime;
      const step = this.musicStep++;

      if (this.musicTrack === 1) {
        // Track 1: Fire of Ancestors (soft pentatonic bone flute + low drum pulse)
        const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3];
        const note = scale[(step * 3 + (step % 4)) % scale.length];
        if (step % 2 === 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note, now);
          gain.gain.setValueAtTime(0.022, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.44);
          osc.connect(gain);
          gain.connect(musicOut);
          osc.start(now);
          osc.stop(now + 0.46);
          this.activeMusicNodes.push(osc);
        }
        if (step % 4 === 0) {
          const drum = ctx.createOscillator();
          const dGain = ctx.createGain();
          drum.type = 'triangle';
          drum.frequency.setValueAtTime(110, now);
          drum.frequency.exponentialRampToValueAtTime(52, now + 0.14);
          dGain.gain.setValueAtTime(0.032, now);
          dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          drum.connect(dGain);
          dGain.connect(musicOut);
          drum.start(now);
          drum.stop(now + 0.16);
          this.activeMusicNodes.push(drum);
        }
      } else if (this.musicTrack === 2) {
        // Track 2: Forest Wind Harp (gentle arpeggio)
        const scale = [220.0, 261.6, 329.6, 392.0, 493.9, 587.3];
        const note = scale[step % scale.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now);
        gain.gain.setValueAtTime(0.018, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);
        osc.connect(gain);
        gain.connect(musicOut);
        osc.start(now);
        osc.stop(now + 0.44);
        this.activeMusicNodes.push(osc);
      } else if (this.musicTrack === 3) {
        // Track 3: Tribal Rhythm (ritual tom-toms & drone)
        const freq = step % 4 === 0 ? 130.8 : step % 2 === 0 ? 164.8 : 196.0;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.16);
        gain.gain.setValueAtTime(0.028, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(musicOut);
        osc.start(now);
        osc.stop(now + 0.19);
        this.activeMusicNodes.push(osc);
      }
      if (this.activeMusicNodes.length > 16) {
        this.activeMusicNodes = this.activeMusicNodes.slice(-8);
      }
    } catch {
      // Ignore
    }
  }

  public playChop(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Woody low-mid thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.085);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);

      // Crisp bark crackle (short filtered noise)
      this.playNoiseBurst(ctx, now, 0.045, 950, 0.08);
    } catch {
      // Ignore
    }
  }

  public playMine(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Stony/metallic pickaxe ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1280, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.075);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);

      // Crisp chip click
      this.playNoiseBurst(ctx, now, 0.03, 2200, 0.07);
    } catch {
      // Ignore
    }
  }

  public playForage(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Soft leaf rustle
      this.playNoiseBurst(ctx, now, 0.07, 1500, 0.055);

      // Light berry pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.075);

      gain.gain.setValueAtTime(0.06, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.02);
      osc.stop(now + 0.085);
    } catch {
      // Ignore
    }
  }

  public playDeposit(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const notes = [330, 440];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch {
      // Ignore
    }
  }

  public playOrder(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.055);

      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Ignore
    }
  }

  public playSelect(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.045);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {
      // Ignore
    }
  }

  public playEat(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.07);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);

      this.playNoiseBurst(ctx, now + 0.01, 0.04, 1100, 0.045);
    } catch {
      // Ignore
    }
  }

  public playSplash(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.09);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);

      this.playNoiseBurst(ctx, now + 0.015, 0.11, 1400, 0.075);
    } catch {
      // Ignore
    }
  }

  public playBlocked(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [220, 175].forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.055, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.07);
      });
    } catch {
      // Ignore
    }
  }

  public playHammer(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(92, now + 0.065);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);

      this.playNoiseBurst(ctx, now, 0.035, 1300, 0.06);
    } catch {
      // Ignore
    }
  }

  public playBuildComplete(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [392, 494, 587].forEach((freq, idx) => {
        const start = now + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.17);
      });
    } catch {
      // Ignore
    }
  }

  public playBirth(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523, 659, 784, 1046].forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch {
      // Ignore
    }
  }

  public playFanfare(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [440, 554, 659, 880].forEach((freq, idx) => {
        const start = now + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(idx === 3 ? 0.12 : 0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === 3 ? 0.34 : 0.17));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + (idx === 3 ? 0.35 : 0.18));
      });
    } catch {
      // Ignore
    }
  }

  public playMemorial(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [262, 196].forEach((freq, idx) => {
        const start = now + idx * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.44);
      });
    } catch {
      // Ignore
    }
  }

  public playThrow(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      this.playNoiseBurst(ctx, now, 0.09, 950, 0.08);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.14);
      gain.gain.setValueAtTime(0.09, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.06);
      osc.stop(now + 0.16);
    } catch {
      // Ignore
    }
  }

  public playCraft(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [1480, 1920].forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.72, start + 0.06);
        gain.gain.setValueAtTime(0.085, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.065);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.07);
      });
    } catch {
      // Ignore
    }
  }

  public playLevelUp(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523, 659, 987].forEach((freq, idx) => {
        const start = now + idx * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.19);
      });
    } catch {
      // Ignore
    }
  }

  public playAlarmHorn(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [155, 210].forEach((freq, idx) => {
        const start = now + idx * 0.19;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.linearRampToValueAtTime(freq * 1.18, start + 0.16);
        gain.gain.setValueAtTime(0.11, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  public playPredatorRoar(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(64, now + 0.28);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
      this.playNoiseBurst(ctx, now, 0.22, 320, 0.08);
    } catch {
      // Ignore
    }
  }

  public playBowShot(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.09);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
      this.playNoiseBurst(ctx, now, 0.05, 1900, 0.05);
    } catch {
      // Ignore
    }
  }

  public playCombatHit(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(62, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);
      this.playNoiseBurst(ctx, now, 0.045, 760, 0.07);
    } catch {
      // Ignore
    }
  }

  public playTechUnlock(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523, 659, 784, 1175].forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  public playBirdChirp(): void {
    if (this.muted || !this.ambientEnabled) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [1650, 2100].forEach((f, i) => {
        const start = now + i * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * 1.25, start + 0.065);
        gain.gain.setValueAtTime(0.025, start);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.075);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      });
    } catch {
      // Ignore
    }
  }

  public playBoarGrunt(): void {
    if (this.muted || !this.ambientEnabled) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(98, now);
      osc.frequency.exponentialRampToValueAtTime(64, now + 0.16);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch {
      // Ignore
    }
  }

  public playShamanChant(): void {
    if (this.muted) return;
    try {
      const ctx = this.getReadyContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [293.7, 440.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      });
    } catch {
      // Ignore
    }
  }

  private getReadyContext(): AudioContext | null {
    if (!this.ctx) {
      this.unlock();
    }
    if (!this.ctx || this.ctx.state !== 'running') {
      return null;
    }
    return this.ctx;
  }

  private playNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    filterFreq: number,
    volume: number
  ): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(startTime);
    src.stop(startTime + duration);
  }
}

export const SoundFX = new SoundFXManager();
