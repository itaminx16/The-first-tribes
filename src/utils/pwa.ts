export interface PwaState {
  canInstall: boolean;
  isInstalled: boolean;
  isNativeApk: boolean;
  isOffline: boolean;
  offlineReady: boolean;
  updateAvailable: boolean;
  checkingUpdate: boolean;
  buildId: string;
  apkUrl: string;
  statusNoteUk: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface RemoteVersionPayload {
  version?: string;
  buildId?: string;
  apkUrl?: string;
}

type PwaListener = (state: PwaState) => void;

const REMOTE_VERSION_URL = 'https://itaminx16.github.io/The-first-tribes/version.json';
const APK_DOWNLOAD_URL = 'https://itaminx16.github.io/The-first-tribes/FirstTribes.apk';

class PwaManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private listeners = new Set<PwaListener>();
  private initialized = false;
  private updateIntervalId: number | null = null;

  private state: PwaState = {
    canInstall: false,
    isInstalled: false,
    isNativeApk: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    offlineReady: false,
    updateAvailable: false,
    checkingUpdate: false,
    buildId: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev',
    apkUrl: APK_DOWNLOAD_URL,
    statusNoteUk: ''
  };

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const isNativeApk = this.detectNativeCapacitor();
    const isInstalled = isNativeApk || this.detectStandalone();

    this.state = {
      ...this.state,
      isNativeApk,
      isInstalled,
      offlineReady: isNativeApk,
      canInstall: false,
      buildId: this.getBuildId(),
      apkUrl: APK_DOWNLOAD_URL,
      isOffline: !navigator.onLine
    };

    window.addEventListener('online', () => {
      this.patchState({ isOffline: false });
      void this.silentBackgroundUpdateCheck();
    });

    window.addEventListener('offline', () => {
      this.patchState({ isOffline: true });
    });

    if (isNativeApk) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.checkRemoteApkVersion(true);
        }
      });
      this.updateIntervalId = window.setInterval(() => {
        void this.checkRemoteApkVersion(true);
      }, 600_000);
      void this.checkRemoteApkVersion(true);
      return;
    }

    window.addEventListener('beforeinstallprompt', (ev: Event) => {
      ev.preventDefault();
      this.deferredPrompt = ev as BeforeInstallPromptEvent;
      this.patchState({
        canInstall: !this.state.isInstalled
      });
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.patchState({
        isInstalled: true,
        canInstall: false,
        statusNoteUk: 'Додаток встановлено на пристрій!'
      });
    });

    if ('serviceWorker' in navigator) {
      if (import.meta.env.PROD) {
        void this.registerServiceWorker();
      } else {
        // Keep localhost Vite HMR clean from any stale production Service Worker
        void navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) {
            void reg.unregister();
          }
        });
      }
    }
  }

  public getState(): PwaState {
    return { ...this.state };
  }

  public getVersion(): string {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  }

  public getBuildId(): string {
    return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  }

  public subscribe(listener: PwaListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt || this.state.isNativeApk) {
      return 'unavailable';
    }
    try {
      const promptEv = this.deferredPrompt;
      await promptEv.prompt();
      const choice = await promptEv.userChoice;
      this.deferredPrompt = null;
      if (choice.outcome === 'accepted') {
        this.patchState({
          canInstall: false,
          isInstalled: true,
          statusNoteUk: 'Додаток встановлюється...'
        });
        return 'accepted';
      }
      this.patchState({ canInstall: false });
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }

  public async checkForUpdates(): Promise<'updated' | 'up-to-date' | 'offline' | 'unsupported'> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.patchState({ statusNoteUk: 'Немає інтернету для перевірки оновлень.' });
      return 'offline';
    }

    if (this.state.isNativeApk) {
      return this.checkRemoteApkVersion(false);
    }

    if (!('serviceWorker' in navigator) || !this.registration) {
      const note = import.meta.env.DEV
        ? 'Режим розробки — оновлення перевіряються у зібраній версії.'
        : 'Сервіс-воркер ще ініціалізується або не підтримується.';
      this.patchState({ statusNoteUk: note });
      return 'unsupported';
    }

    this.patchState({ checkingUpdate: true, statusNoteUk: 'Перевірка оновлень...' });
    try {
      await this.registration.update();
      await new Promise((resolve) => window.setTimeout(resolve, 450));

      const hasNew =
        this.state.updateAvailable ||
        Boolean(this.registration.waiting) ||
        Boolean(this.registration.installing);

      if (hasNew) {
        this.patchState({
          checkingUpdate: false,
          updateAvailable: true,
          statusNoteUk: 'Знайдено нову версію гри! Натисніть «Оновити».'
        });
        return 'updated';
      }

      this.patchState({
        checkingUpdate: false,
        statusNoteUk: 'У вас найновіша версія гри.'
      });
      return 'up-to-date';
    } catch {
      this.patchState({
        checkingUpdate: false,
        statusNoteUk: 'Не вдалося перевірити оновлення.'
      });
      return 'unsupported';
    }
  }

  public applyUpdate(): void {
    if (this.state.isNativeApk) {
      const link = document.createElement('a');
      link.href = this.state.apkUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    const waiting = this.registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  }

  public async toggleFullscreenLandscape(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        try {
          const orient = screen.orientation as ScreenOrientation & {
            lock?: (orientation: string) => Promise<void>;
          };
          await orient?.lock?.('landscape');
        } catch {
          // Many browsers block orientation lock outside standalone PWA
        }
        return true;
      }
      await document.exitFullscreen();
      return false;
    } catch {
      return Boolean(document.fullscreenElement);
    }
  }

  private detectNativeCapacitor(): boolean {
    if (typeof window === 'undefined') return false;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const standaloneNav = (navigator as Navigator & { standalone?: boolean }).standalone;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      Boolean(standaloneNav)
    );
  }

  private async checkRemoteApkVersion(
    silent: boolean
  ): Promise<'updated' | 'up-to-date' | 'offline' | 'unsupported'> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!silent) {
        this.patchState({ statusNoteUk: 'Немає інтернету для перевірки оновлень.' });
      }
      return 'offline';
    }

    if (!silent) {
      this.patchState({ checkingUpdate: true, statusNoteUk: 'Перевірка оновлень...' });
    }

    try {
      const res = await fetch(`${REMOTE_VERSION_URL}?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        if (!silent) {
          this.patchState({
            checkingUpdate: false,
            statusNoteUk: 'Не вдалося перевірити оновлення.'
          });
        }
        return 'unsupported';
      }

      const data = (await res.json()) as RemoteVersionPayload;
      const nextApkUrl =
        typeof data.apkUrl === 'string' && data.apkUrl.length > 0
          ? data.apkUrl
          : APK_DOWNLOAD_URL;
      const remoteBuild = typeof data.buildId === 'string' ? data.buildId : '';
      const hasUpdate = remoteBuild.startsWith('gh-') && remoteBuild !== this.getBuildId();

      if (hasUpdate) {
        this.patchState({
          checkingUpdate: false,
          updateAvailable: true,
          apkUrl: nextApkUrl,
          statusNoteUk: 'Вийшла нова версія APK! Натисніть «Оновити» для завантаження.'
        });
        return 'updated';
      }

      this.patchState({
        checkingUpdate: false,
        apkUrl: nextApkUrl,
        ...(silent ? {} : { statusNoteUk: 'У вас найновіша версія гри.' })
      });
      return 'up-to-date';
    } catch {
      if (!silent) {
        this.patchState({
          checkingUpdate: false,
          statusNoteUk: 'Не вдалося перевірити оновлення.'
        });
      }
      return 'unsupported';
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      let hadActiveController = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadActiveController) {
          this.patchState({
            updateAvailable: true,
            statusNoteUk: 'Доступне оновлення гри!'
          });
        } else {
          hadActiveController = true;
        }
      });

      const reg = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none'
      });
      this.registration = reg;

      if (reg.waiting && hadActiveController) {
        this.patchState({ updateAvailable: true });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller &&
            hadActiveController
          ) {
            this.patchState({
              updateAvailable: true,
              statusNoteUk: 'Завантажено нову версію гри!'
            });
          }
        });
      });

      void navigator.serviceWorker.ready.then(() => {
        this.patchState({ offlineReady: true });
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.silentBackgroundUpdateCheck();
        }
      });

      this.updateIntervalId = window.setInterval(() => {
        void this.silentBackgroundUpdateCheck();
      }, 600_000);
    } catch {
      // Ignore SW registration failure on unsupported origins
    }
  }

  private async silentBackgroundUpdateCheck(): Promise<void> {
    if (!navigator.onLine) return;
    if (this.state.isNativeApk) {
      await this.checkRemoteApkVersion(true);
      return;
    }
    if (!this.registration) return;
    try {
      await this.registration.update();
    } catch {
      // Ignore transient offline/network error
    }
  }

  private patchState(partial: Partial<PwaState>): void {
    this.state = { ...this.state, ...partial };
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public dispose(): void {
    if (this.updateIntervalId !== null) {
      window.clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }
}

export const pwaManager = new PwaManager();
