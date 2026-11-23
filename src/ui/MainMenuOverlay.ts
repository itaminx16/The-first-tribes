import { MAX_SAVE_SLOTS, SaveSummary } from '../systems/SaveSystem';
import {
  DEFAULT_GAME_SETUP,
  DIFFICULTY_LABELS_UK,
  DifficultyLevel,
  GameMode,
  GameSetupConfig,
  MAP_PRESET_ORDER,
  MAP_PRESETS,
  MapPresetId,
  MusicTrackId,
  SEASON_ICONS
} from '../types/game';
import { pwaManager, PwaState } from '../utils/pwa';
import { SoundFX } from '../utils/SoundFX';

export type MenuView = 'home' | 'new-game' | 'saves' | 'settings';

export interface MenuBridgeCallbacks {
  onContinueGame(): void;
  onStartNewGame(config: GameSetupConfig): void;
  onSaveSlot(slotId: number): void;
  onLoadSlot(slotId: number): void;
  onDeleteSlot(slotId: number): void;
  onSetMusicTrack(track: MusicTrackId): void;
  onSetAmbientSounds(enabled: boolean): void;
  onToggleFog(): void;
  onToggleMute(): boolean;
  onClose(): void;
}

const BIOME_TAG_UK: Record<string, string> = {
  temperate: 'Помірна долина',
  permafrost: 'Вічна мерзлота',
  desert_split: 'Пустеля / Оазис',
  seaside: 'Морське узбережжя'
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class MainMenuOverlay {
  private readonly root: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly rotateHintEl: HTMLElement;
  private readonly callbacks: MenuBridgeCallbacks;

  private isOpen = false;
  private view: MenuView = 'home';
  private returnToGameOnBack = false;
  private isInitialBoot = true;
  private activeConfig: GameSetupConfig = { ...DEFAULT_GAME_SETUP };
  private draftConfig: GameSetupConfig = { ...DEFAULT_GAME_SETUP };
  private saves: Array<SaveSummary | null> = [];
  private pendingDeleteSlot: number | null = null;
  private installGuideOpen = false;
  private toastDismissed = false;
  private rotateDismissed = false;
  private pwaState: PwaState = pwaManager.getState();

  private unsubscribePwa: (() => void) | null = null;
  private readonly handleResize = (): void => {
    this.renderRotateHint();
  };

  constructor(callbacks: MenuBridgeCallbacks) {
    this.callbacks = callbacks;

    const menuRoot = document.getElementById('menu-overlay') ?? document.createElement('div');
    menuRoot.id = 'menu-overlay';
    if (!menuRoot.parentElement) document.body.appendChild(menuRoot);
    this.root = menuRoot;

    const toastRoot = document.getElementById('pwa-update-toast') ?? document.createElement('div');
    toastRoot.id = 'pwa-update-toast';
    if (!toastRoot.parentElement) document.body.appendChild(toastRoot);
    this.toastEl = toastRoot;

    const rotateRoot = document.getElementById('rotate-hint') ?? document.createElement('div');
    rotateRoot.id = 'rotate-hint';
    if (!rotateRoot.parentElement) document.body.appendChild(rotateRoot);
    this.rotateHintEl = rotateRoot;

    this.unsubscribePwa = pwaManager.subscribe((state) => {
      this.pwaState = state;
      this.renderUpdateToast();
      if (this.isOpen) {
        this.render();
      }
    });

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.renderUpdateToast();
    this.renderRotateHint();
  }

  public isMenuOpen(): boolean {
    return this.isOpen;
  }

  public syncConfig(cfg: GameSetupConfig): void {
    this.activeConfig = { ...cfg };
    if (!this.isOpen || this.view === 'home') {
      this.draftConfig = { ...cfg };
    } else {
      // Keep sound/fog flags synchronized live when changed in-game
      this.draftConfig.musicTrack = cfg.musicTrack;
      this.draftConfig.ambientSounds = cfg.ambientSounds;
      if (!this.isInitialBoot) {
        this.draftConfig.fogOfWar = cfg.fogOfWar;
      }
    }
    if (this.isOpen && this.view === 'settings') {
      this.render();
    }
  }

  public syncSaves(list: Array<SaveSummary | null>): void {
    this.saves = list;
    this.pendingDeleteSlot = null;
    if (this.isOpen && (this.view === 'home' || this.view === 'saves')) {
      this.render();
    }
  }

  public open(
    view: MenuView = 'home',
    opts?: { isInitialBoot?: boolean; returnToGameOnBack?: boolean }
  ): void {
    this.isOpen = true;
    this.view = view;
    this.pendingDeleteSlot = null;
    this.installGuideOpen = false;
    if (opts?.isInitialBoot !== undefined) {
      this.isInitialBoot = opts.isInitialBoot;
    }
    this.returnToGameOnBack = Boolean(opts?.returnToGameOnBack);
    this.draftConfig = { ...this.activeConfig };
    this.root.hidden = false;
    this.render();
    this.renderRotateHint();
  }

  public close(): void {
    this.isOpen = false;
    this.pendingDeleteSlot = null;
    this.installGuideOpen = false;
    this.root.hidden = true;
    this.renderRotateHint();
  }

  public destroy(): void {
    if (this.unsubscribePwa) {
      this.unsubscribePwa();
      this.unsubscribePwa = null;
    }
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  }

  private getLatestSave(): SaveSummary | null {
    let latest: SaveSummary | null = null;
    for (const s of this.saves) {
      if (!s) continue;
      if (!latest || s.savedAt > latest.savedAt) {
        latest = s;
      }
    }
    return latest;
  }

  private render(): void {
    if (!this.isOpen) return;

    const prevScroll = this.root.querySelector<HTMLElement>('.ft-scroll-body')?.scrollTop ?? 0;

    if (this.view === 'home') {
      this.renderHomeView();
    } else if (this.view === 'new-game') {
      this.renderNewGameView();
    } else if (this.view === 'saves') {
      this.renderSavesView();
    } else {
      this.renderSettingsView();
    }

    const nextScroll = this.root.querySelector<HTMLElement>('.ft-scroll-body');
    if (nextScroll && prevScroll > 0) {
      nextScroll.scrollTop = prevScroll;
    }
  }

  private renderHomeView(): void {
    const usedSlots = this.saves.filter(Boolean).length;
    const latestSave = this.getLatestSave();
    const version = pwaManager.getVersion();

    let continueButtonHtml = '';
    if (!this.isInitialBoot) {
      continueButtonHtml = `
        <button class="ft-btn ft-btn-primary ft-btn-continue" data-action="continue-game" type="button">
          <span>▶️ Продовжити гру</span>
          <span class="ft-btn-sub">Повернутися до активного племені</span>
        </button>
      `;
    } else if (latestSave) {
      continueButtonHtml = `
        <button class="ft-btn ft-btn-primary ft-btn-continue" data-action="load-latest" data-slot="${latestSave.slotId}" type="button">
          <span>▶️ Продовжити</span>
          <span class="ft-btn-sub">Слот #${latestSave.slotId} • ${escapeHtml(latestSave.mapNameUk)} • Рік ${latestSave.year}</span>
        </button>
      `;
    }

    const installBtnHtml = !this.pwaState.isInstalled
      ? `
        <button class="ft-btn ft-btn-install" data-action="install-app" type="button">
          <span>📲 Встановити на пристрій (Офлайн)</span>
        </button>
      `
      : '';

    const installGuideHtml =
      this.installGuideOpen && !this.pwaState.isInstalled
        ? `
          <div class="ft-install-guide">
            <strong>Як встановити на Android для гри офлайн:</strong>
            <ol>
              <li>Натисніть меню браузера <strong>⋮</strong> у правому верхньому куті Chrome.</li>
              <li>Оберіть <strong>«Встановити додаток»</strong> або <strong>«Додати на головний екран»</strong>.</li>
              <li>Відкривайте іконку з робочого столу — гра працюватиме на весь екран без інтернету й автоматично оновлюватиметься!</li>
            </ol>
          </div>
        `
        : '';

    const netPill = this.pwaState.isOffline
      ? '<span class="ft-status-pill offline">📴 Офлайн-режим</span>'
      : this.pwaState.offlineReady
      ? '<span class="ft-status-pill ready">✅ Офлайн готово</span>'
      : '<span class="ft-status-pill">📶 Онлайн</span>';

    const updateBtn = this.pwaState.updateAvailable
      ? '<button class="ft-toast-btn" data-action="apply-update" type="button">🔄 Оновити гру</button>'
      : '';

    this.root.innerHTML = `
      <div class="ft-home-wrap">
        <div class="ft-brand">
          <div class="ft-brand-icon-wrap">
            <img class="ft-brand-icon" src="./icons/icon-192.png" alt="Первісні Племена" />
            <span class="ft-brand-fallback" hidden>🔥</span>
          </div>
          <div>
            <h1 class="ft-brand-title">ПЕРВІСНІ ПЛЕМЕНА</h1>
            <p class="ft-brand-sub">Стратегія розвитку та виживання племені</p>
          </div>
        </div>

        <div class="ft-home-actions">
          ${continueButtonHtml}
          <button class="ft-btn ${continueButtonHtml ? '' : 'ft-btn-primary'}" data-nav="new-game" type="button">
            <span>⚔️ Нова гра</span>
          </button>
          <button class="ft-btn ft-btn-split" data-nav="saves" type="button">
            <span>💾 Збереження</span>
            <span class="ft-badge">${usedSlots}/${MAX_SAVE_SLOTS}</span>
          </button>
          <button class="ft-btn" data-nav="settings" type="button">
            <span>⚙️ Налаштування</span>
          </button>
          ${installBtnHtml}
        </div>

        ${installGuideHtml}

        <div class="ft-home-footer">
          <span>v${escapeHtml(version)}</span>
          ${netPill}
          ${updateBtn}
        </div>
      </div>
    `;

    const img = this.root.querySelector<HTMLImageElement>('.ft-brand-icon');
    const fallback = this.root.querySelector<HTMLElement>('.ft-brand-fallback');
    if (img && fallback) {
      img.addEventListener('error', () => {
        img.hidden = true;
        fallback.hidden = false;
      });
    }

    this.root.querySelector('[data-action="continue-game"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      this.close();
      this.callbacks.onContinueGame();
    });

    this.root.querySelector('[data-action="load-latest"]')?.addEventListener('click', (ev) => {
      const slot = Number((ev.currentTarget as HTMLElement).dataset.slot ?? '1');
      SoundFX.unlock();
      this.close();
      this.callbacks.onLoadSlot(slot);
    });

    this.root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => {
        SoundFX.unlock();
        this.view = el.dataset.nav as MenuView;
        this.pendingDeleteSlot = null;
        this.render();
      });
    });

    this.root.querySelector('[data-action="install-app"]')?.addEventListener('click', async () => {
      SoundFX.unlock();
      const outcome = await pwaManager.promptInstall();
      if (outcome === 'unavailable') {
        this.installGuideOpen = !this.installGuideOpen;
        this.render();
      }
    });

    this.root.querySelector('[data-action="apply-update"]')?.addEventListener('click', () => {
      pwaManager.applyUpdate();
    });
  }

  private renderNewGameView(): void {
    const selPreset = MAP_PRESETS[this.draftConfig.mapId] ?? MAP_PRESETS.river_valley;

    const mapCardsHtml = MAP_PRESET_ORDER.map((mapId) => {
      const p = MAP_PRESETS[mapId];
      const active = this.draftConfig.mapId === mapId;
      const biomeTag = BIOME_TAG_UK[p.biome] ?? p.biome;
      return `
        <button class="ft-map-card ${active ? 'active' : ''}" data-map="${mapId}" type="button">
          <div class="ft-map-card-name">${active ? '✅ ' : ''}${escapeHtml(p.nameUk)}</div>
          <div class="ft-map-card-tag">${escapeHtml(biomeTag)} • ${p.worldW}×${p.worldH}</div>
        </button>
      `;
    }).join('');

    const modes: Array<{ id: GameMode; title: string; desc: string }> = [
      { id: 'sandbox', title: '🏖️ Пісочниця', desc: 'Пропуск сезонів в 1 клік' },
      { id: 'survival', title: '🔥 Виживання', desc: 'Чесні 10-хвилинні сезони' }
    ];
    const modeHtml = modes
      .map(
        (m) => `
        <button class="ft-choice-card ${this.draftConfig.mode === m.id ? 'active' : ''}" data-mode="${m.id}" type="button">
          <strong>${m.title}</strong>
          <span>${m.desc}</span>
        </button>
      `
      )
      .join('');

    const diffs: DifficultyLevel[] = ['easy', 'normal', 'hard', 'primal'];
    const diffHtml = diffs
      .map(
        (d) => `
        <button class="ft-pill ${this.draftConfig.difficulty === d ? 'active' : ''}" data-diff="${d}" type="button">
          ${escapeHtml(DIFFICULTY_LABELS_UK[d])}
        </button>
      `
      )
      .join('');

    const rivals: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    const rivalHtml = rivals
      .map(
        (cnt) => `
        <button class="ft-pill ${this.draftConfig.rivalCount === cnt ? 'active-green' : ''}" data-rivals="${cnt}" type="button">
          ${cnt}
        </button>
      `
      )
      .join('');

    this.root.innerHTML = `
      <div class="ft-panel">
        <div class="ft-panel-header">
          <button class="ft-back-btn" data-action="back" type="button">← Назад</button>
          <h2 class="ft-panel-title">⚔️ Нова гра</h2>
          <div class="ft-header-spacer"></div>
        </div>

        <div class="ft-scroll-body">
          <section class="ft-section">
            <h3 class="ft-section-title">🗺️ Карта світу (10 локацій)</h3>
            <div class="ft-map-grid">
              ${mapCardsHtml}
            </div>
            <div class="ft-map-preview">
              <div class="ft-map-preview-title">📍 ${escapeHtml(selPreset.nameUk)}</div>
              <p class="ft-map-preview-desc">${escapeHtml(selPreset.descUk)}</p>
              <div class="ft-map-preview-meta">
                📐 Розмір: ${selPreset.worldW}×${selPreset.worldH} • 🪨 Вічних скель: ${selPreset.infiniteQuarries} • 🌳 Дерев: ~${selPreset.treeCount}
              </div>
            </div>
          </section>

          <section class="ft-section">
            <h3 class="ft-section-title">🎮 Режим та параметри світу</h3>
            <div class="ft-mode-grid">
              ${modeHtml}
            </div>

            <div>
              <div class="ft-label">⚔️ Складність</div>
              <div class="ft-pill-row">
                ${diffHtml}
              </div>
            </div>

            <div class="ft-two-col">
              <div>
                <div class="ft-label">🏴 Сусідні племена</div>
                <div class="ft-pill-row">
                  ${rivalHtml}
                </div>
              </div>
              <div>
                <div class="ft-label">🌫️ Туман війни</div>
                <div class="ft-pill-row">
                  <button class="ft-pill ${this.draftConfig.fogOfWar ? 'active-green' : ''}" data-action="toggle-draft-fog" type="button">
                    ${this.draftConfig.fogOfWar ? '🌫️ Увімкнено' : '☀️ Вимкнено'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="ft-panel-footer">
          <button class="ft-btn ft-btn-primary" data-action="start-new-game" type="button">
            ▶️ ПОЧАТИ ГРУ
          </button>
        </div>
      </div>
    `;

    this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.view = 'home';
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-map]').forEach((el) => {
      el.addEventListener('click', () => {
        SoundFX.unlock();
        this.draftConfig.mapId = el.dataset.map as MapPresetId;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((el) => {
      el.addEventListener('click', () => {
        SoundFX.unlock();
        this.draftConfig.mode = el.dataset.mode as GameMode;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-diff]').forEach((el) => {
      el.addEventListener('click', () => {
        SoundFX.unlock();
        this.draftConfig.difficulty = el.dataset.diff as DifficultyLevel;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-rivals]').forEach((el) => {
      el.addEventListener('click', () => {
        SoundFX.unlock();
        this.draftConfig.rivalCount = Number(el.dataset.rivals) as 0 | 1 | 2 | 3;
        this.render();
      });
    });

    this.root.querySelector('[data-action="toggle-draft-fog"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      this.draftConfig.fogOfWar = !this.draftConfig.fogOfWar;
      this.render();
    });

    this.root.querySelector('[data-action="start-new-game"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      const chosen = { ...this.draftConfig };
      this.isInitialBoot = false;
      this.close();
      this.callbacks.onStartNewGame(chosen);
    });
  }

  private renderSavesView(): void {
    const canSave = !this.isInitialBoot;
    const usedSlots = this.saves.filter(Boolean).length;

    const cardsHtml = Array.from({ length: MAX_SAVE_SLOTS }, (_, idx) => {
      const slot = idx + 1;
      const summary = this.saves[idx] ?? null;

      if (summary) {
        const confirmDel = this.pendingDeleteSlot === slot;
        const icon = SEASON_ICONS[summary.season] ?? '';
        const saveBtnHtml = canSave
          ? `<button class="ft-sm-btn save" data-save-slot="${slot}" type="button">💾 Перезапис</button>`
          : '';
        const delBtnsHtml = confirmDel
          ? `
            <button class="ft-sm-btn del-confirm" data-confirm-del="${slot}" type="button">Видалити?</button>
            <button class="ft-sm-btn neutral" data-cancel-del="${slot}" type="button">Скасувати</button>
          `
          : `<button class="ft-sm-btn del" data-ask-del="${slot}" type="button" aria-label="Видалити слот ${slot}">🗑️</button>`;

        return `
          <div class="ft-save-card">
            <div class="ft-save-info">
              <div class="ft-save-title">💾 Слот #${slot} — ${escapeHtml(summary.mapNameUk)}</div>
              <div class="ft-save-meta">
                Рік ${summary.year} • ${icon} ${escapeHtml(summary.seasonUk)} • 👥 ${summary.pop} • 🕒 ${escapeHtml(summary.dateStrUk)}
              </div>
            </div>
            <div class="ft-save-actions">
              <button class="ft-sm-btn load" data-load-slot="${slot}" type="button">📂 Завантажити</button>
              ${saveBtnHtml}
              ${delBtnsHtml}
            </div>
          </div>
        `;
      }

      const emptySaveHtml = canSave
        ? `<button class="ft-sm-btn save" data-save-slot="${slot}" type="button">💾 Зберегти сюди</button>`
        : '';

      return `
        <div class="ft-save-card">
          <div class="ft-save-info">
            <div class="ft-save-title empty">📁 Слот #${slot} — Порожній</div>
            <div class="ft-save-meta empty">
              ${canSave ? 'Вільне місце для збереження поточного племені' : 'Збережень у цьому слоті немає'}
            </div>
          </div>
          <div class="ft-save-actions">
            ${emptySaveHtml}
          </div>
        </div>
      `;
    }).join('');

    this.root.innerHTML = `
      <div class="ft-panel">
        <div class="ft-panel-header">
          <button class="ft-back-btn" data-action="back" type="button">← Назад</button>
          <h2 class="ft-panel-title">💾 Збереження (${usedSlots}/${MAX_SAVE_SLOTS})</h2>
          <div class="ft-header-spacer"></div>
        </div>

        <div class="ft-scroll-body">
          <div class="ft-save-list">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.pendingDeleteSlot = null;
      if (this.returnToGameOnBack) {
        this.close();
        this.callbacks.onClose();
      } else {
        this.view = 'home';
        this.render();
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-load-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = Number(el.dataset.loadSlot);
        SoundFX.unlock();
        this.isInitialBoot = false;
        this.close();
        this.callbacks.onLoadSlot(slot);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-save-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = Number(el.dataset.saveSlot);
        SoundFX.unlock();
        this.pendingDeleteSlot = null;
        this.callbacks.onSaveSlot(slot);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-ask-del]').forEach((el) => {
      el.addEventListener('click', () => {
        this.pendingDeleteSlot = Number(el.dataset.askDel);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cancel-del]').forEach((el) => {
      el.addEventListener('click', () => {
        this.pendingDeleteSlot = null;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-confirm-del]').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = Number(el.dataset.confirmDel);
        this.pendingDeleteSlot = null;
        this.callbacks.onDeleteSlot(slot);
      });
    });
  }

  private renderSettingsView(): void {
    const isMuted = SoundFX.isMuted();
    const version = pwaManager.getVersion();
    const musicTrack = this.activeConfig.musicTrack;
    const ambientOn = this.activeConfig.ambientSounds;
    const fogOn = this.activeConfig.fogOfWar;

    const musicOpts: Array<{ id: MusicTrackId; label: string }> = [
      { id: 0, label: '🔇 Вимк.' },
      { id: 1, label: '1. Вогонь' },
      { id: 2, label: '2. Вітер' },
      { id: 3, label: '3. Бубни' }
    ];

    const musicHtml = musicOpts
      .map(
        (m) => `
        <button class="ft-pill ${musicTrack === m.id ? 'active-blue' : ''}" data-music="${m.id}" type="button">
          ${m.label}
        </button>
      `
      )
      .join('');

    const offlineStatusText = this.pwaState.isInstalled
      ? 'Додаток встановлено на пристрій (автономний режим).'
      : this.pwaState.offlineReady
      ? 'Файли гри закешовані — гра працює навіть без інтернету.'
      : 'Готово до кешування після встановлення або відкриття в мережі.';

    const installBtnHtml = !this.pwaState.isInstalled
      ? `<button class="ft-sm-btn save" data-action="settings-install" type="button">📲 Встановити додаток</button>`
      : '';

    const updateBtnHtml = this.pwaState.updateAvailable
      ? `<button class="ft-sm-btn load" data-action="settings-apply-update" type="button">✨ Оновити зараз</button>`
      : '';

    const installGuideHtml =
      this.installGuideOpen && !this.pwaState.isInstalled
        ? `
          <div class="ft-install-guide">
            <strong>Ручне встановлення в Chrome на Android:</strong>
            <ol>
              <li>Натисніть <strong>⋮</strong> у правому верхньому куті браузера.</li>
              <li>Оберіть <strong>«Встановити додаток»</strong> або <strong>«Додати на головний екран»</strong>.</li>
            </ol>
          </div>
        `
        : '';

    this.root.innerHTML = `
      <div class="ft-panel">
        <div class="ft-panel-header">
          <button class="ft-back-btn" data-action="back" type="button">← Назад</button>
          <h2 class="ft-panel-title">⚙️ Налаштування</h2>
          <div class="ft-header-spacer"></div>
        </div>

        <div class="ft-scroll-body">
          <section class="ft-section">
            <h3 class="ft-section-title">🔊 Звук і музика</h3>
            <div class="ft-settings-card">
              <div class="ft-setting-row">
                <strong>Загальний звук</strong>
                <button class="ft-sm-btn ${isMuted ? 'del' : 'load'}" data-action="toggle-mute" type="button">
                  ${isMuted ? '🔇 Вимкнено' : '🔊 Увімкнено'}
                </button>
              </div>
              <div>
                <div class="ft-label">Фонова музика</div>
                <div class="ft-pill-row">
                  ${musicHtml}
                </div>
              </div>
              <div class="ft-setting-row">
                <strong>Звуки природи та тварин</strong>
                <button class="ft-sm-btn ${ambientOn ? 'load' : 'neutral'}" data-action="toggle-ambient" type="button">
                  ${ambientOn ? '🦌 Увімкнено' : '🔇 Вимкнено'}
                </button>
              </div>
            </div>
          </section>

          <section class="ft-section">
            <h3 class="ft-section-title">🗺️ Гра та екран</h3>
            <div class="ft-settings-card">
              <div class="ft-setting-row">
                <strong>Туман війни</strong>
                <button class="ft-sm-btn ${fogOn ? 'load' : 'neutral'}" data-action="toggle-fog" type="button">
                  ${fogOn ? '🌫️ Увімкнено' : '☀️ Вимкнено'}
                </button>
              </div>
              <div class="ft-setting-row">
                <strong>Повноекранний режим</strong>
                <button class="ft-sm-btn save" data-action="toggle-fullscreen" type="button">
                  ⛶ Повний екран
                </button>
              </div>
            </div>
          </section>

          <section class="ft-section">
            <h3 class="ft-section-title">📲 Додаток, Офлайн та Оновлення</h3>
            <div class="ft-settings-card">
              <div class="ft-setting-note">
                Версія: <strong>v${escapeHtml(version)}</strong> • ${escapeHtml(offlineStatusText)}
                ${this.pwaState.statusNoteUk ? `<br/><strong>${escapeHtml(this.pwaState.statusNoteUk)}</strong>` : ''}
              </div>
              <div class="ft-save-actions">
                ${installBtnHtml}
                <button class="ft-sm-btn neutral" data-action="check-updates" type="button" ${
                  this.pwaState.checkingUpdate ? 'disabled' : ''
                }>
                  ${this.pwaState.checkingUpdate ? '⏳ Перевіряємо...' : '🔄 Перевірити оновлення'}
                </button>
                ${updateBtnHtml}
              </div>
              ${installGuideHtml}
            </div>
          </section>

          <section class="ft-section">
            <h3 class="ft-section-title">🎮 Керування (Android та ПК)</h3>
            <div class="ft-settings-card">
              <ul class="ft-guide-list">
                <li><strong>Android (Сенсор):</strong> тягніть карту одним пальцем; зведення/розведення двома пальцями змінює масштаб (збільшення/зменшення).</li>
                <li><strong>Вибір і наказ на телефоні:</strong> тап по жителю — виділити; тап по ресурсу/будівлі/землі — наказ працювати або йти; кнопка <strong>🔲</strong> справа вмикає виділення рамкою.</li>
                <li><strong>Будівництво на телефоні:</strong> оберіть споруду, тапніть по карті для позиції та натисніть <strong>✅ Збудувати</strong>.</li>
                <li><strong>ПК (Миша / Клавіатура):</strong> ЛКМ/Рамка — виділення, ПКМ — наказ, WASD/Стрілки та коліщатко — камера.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    `;

    this.root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.view = 'home';
      this.render();
    });

    this.root.querySelector('[data-action="toggle-mute"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      this.callbacks.onToggleMute();
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-music]').forEach((el) => {
      el.addEventListener('click', () => {
        const track = Number(el.dataset.music) as MusicTrackId;
        SoundFX.unlock();
        this.activeConfig.musicTrack = track;
        this.draftConfig.musicTrack = track;
        this.callbacks.onSetMusicTrack(track);
        this.render();
      });
    });

    this.root.querySelector('[data-action="toggle-ambient"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      const next = !this.activeConfig.ambientSounds;
      this.activeConfig.ambientSounds = next;
      this.draftConfig.ambientSounds = next;
      this.callbacks.onSetAmbientSounds(next);
      this.render();
    });

    this.root.querySelector('[data-action="toggle-fog"]')?.addEventListener('click', () => {
      SoundFX.unlock();
      const next = !this.activeConfig.fogOfWar;
      this.activeConfig.fogOfWar = next;
      this.draftConfig.fogOfWar = next;
      if (!this.isInitialBoot) {
        this.callbacks.onToggleFog();
      }
      this.render();
    });

    this.root.querySelector('[data-action="toggle-fullscreen"]')?.addEventListener('click', () => {
      void pwaManager.toggleFullscreenLandscape();
    });

    this.root.querySelector('[data-action="settings-install"]')?.addEventListener('click', async () => {
      SoundFX.unlock();
      const outcome = await pwaManager.promptInstall();
      if (outcome === 'unavailable') {
        this.installGuideOpen = !this.installGuideOpen;
        this.render();
      }
    });

    this.root.querySelector('[data-action="check-updates"]')?.addEventListener('click', () => {
      void pwaManager.checkForUpdates();
    });

    this.root.querySelector('[data-action="settings-apply-update"]')?.addEventListener('click', () => {
      pwaManager.applyUpdate();
    });
  }

  private renderUpdateToast(): void {
    if (!this.pwaState.updateAvailable || this.toastDismissed) {
      this.toastEl.hidden = true;
      return;
    }

    this.toastEl.hidden = false;
    this.toastEl.innerHTML = `
      <span>✨ Доступне оновлення гри!</span>
      <button class="ft-toast-btn" data-toast-update type="button">Оновити</button>
      <button class="ft-toast-close" data-toast-close type="button" aria-label="Закрити">✕</button>
    `;

    this.toastEl.querySelector('[data-toast-update]')?.addEventListener('click', () => {
      pwaManager.applyUpdate();
    });
    this.toastEl.querySelector('[data-toast-close]')?.addEventListener('click', () => {
      this.toastDismissed = true;
      this.toastEl.hidden = true;
    });
  }

  private renderRotateHint(): void {
    const shouldShow =
      !this.isOpen &&
      !this.rotateDismissed &&
      window.innerWidth < 520 &&
      window.innerHeight > window.innerWidth;

    if (!shouldShow) {
      this.rotateHintEl.hidden = true;
      return;
    }

    this.rotateHintEl.hidden = false;
    this.rotateHintEl.innerHTML = `
      <span>📱 Поверніть телефон горизонтально для зручнішої гри</span>
      <button class="ft-toast-btn" data-rotate-fs type="button">⛶</button>
      <button class="ft-toast-close" data-rotate-close type="button" aria-label="Закрити">✕</button>
    `;

    this.rotateHintEl.querySelector('[data-rotate-fs]')?.addEventListener('click', () => {
      void pwaManager.toggleFullscreenLandscape();
    });
    this.rotateHintEl.querySelector('[data-rotate-close]')?.addEventListener('click', () => {
      this.rotateDismissed = true;
      this.rotateHintEl.hidden = true;
    });
  }
}
