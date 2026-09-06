export type GamePhase = 'loading' | 'title' | 'playing' | 'paused' | 'upgrade' | 'dead';
export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  quality: Quality;
  sensitivity: number;
  fov: number;
}

export interface HudState {
  hp: number;
  maxHp: number;
  mag: number;
  magSize: number;
  reserve: number;
  reloading: number; // 0..1 progress, -1 when not reloading
  score: number;
  wave: number;
  enemiesLeft: number;
  combo: number;
  dashCd: number; // 0..1 (1 = ready)
  hitMarker: number; // timestamp of last hit
  killMarker: number;
  damageFlash: number; // timestamp of last damage
  lowHp: boolean;
  banner: string;
  bannerTime: number;
  fps: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  loadProgress: number;
  loadStage: string;
  hud: HudState;
  settings: Settings;
  highScore: number;
  upgradeChoices: UpgradeDef[];
  ownedUpgrades: Record<string, number>;
  finalStats: { score: number; wave: number; kills: number; accuracy: number; time: number };
  pointerLockFailed: boolean;
}

const SETTINGS_KEY = 'deskwars.settings.v1';
const HS_KEY = 'deskwars.highscore.v1';

function loadSettings(): Settings {
  const base: Settings = { master: 0.8, sfx: 0.9, music: 0.5, quality: 'high', sensitivity: 1, fov: 80 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  // pick default quality by device
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) base.quality = 'low';
  return base;
}

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HS_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

type Listener = () => void;

class Store {
  private listeners = new Set<Listener>();
  snapshot: GameSnapshot = {
    phase: 'loading',
    loadProgress: 0,
    loadStage: 'Booting',
    hud: {
      hp: 100,
      maxHp: 100,
      mag: 18,
      magSize: 18,
      reserve: 90,
      reloading: -1,
      score: 0,
      wave: 0,
      enemiesLeft: 0,
      combo: 0,
      dashCd: 1,
      hitMarker: 0,
      killMarker: 0,
      damageFlash: 0,
      lowHp: false,
      banner: '',
      bannerTime: 0,
      fps: 60,
    },
    settings: loadSettings(),
    highScore: loadHighScore(),
    upgradeChoices: [],
    ownedUpgrades: {},
    finalStats: { score: 0, wave: 0, kills: 0, accuracy: 0, time: 0 },
    pointerLockFailed: false,
  };

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = () => this.snapshot;

  set(partial: Partial<GameSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  setHud(hud: HudState) {
    this.snapshot = { ...this.snapshot, hud: { ...hud } };
    this.emit();
  }

  setSettings(partial: Partial<Settings>) {
    const settings = { ...this.snapshot.settings, ...partial };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    this.set({ settings });
  }

  setHighScore(score: number) {
    if (score > this.snapshot.highScore) {
      try {
        localStorage.setItem(HS_KEY, String(score));
      } catch {
        /* ignore */
      }
      this.set({ highScore: score });
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const store = new Store();
