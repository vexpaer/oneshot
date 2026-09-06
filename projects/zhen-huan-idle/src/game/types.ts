export interface RivalState {
  power: number;
  fallen: boolean;
}

export interface LogEntry {
  id: number;
  day: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'gold';
}

export type CeremonyType = 'promotion' | 'prestige' | 'era' | 'rivalFallen' | 'bedding' | 'intro';

export interface Ceremony {
  type: CeremonyType;
  title: string;
  subtitle?: string;
  body: string;
  detail?: string;
}

export interface OfflineReport {
  seconds: number;
  favor: number;
  silver: number;
  scheme: number;
}

export interface GameState {
  version: number;
  lastSaved: number;
  startedAt: number;

  favor: number;
  silver: number;
  scheme: number;
  lifeFavor: number; // favor earned this life (since last 甘露寺)
  totalFavor: number; // favor earned across all lives
  totalSilver: number;
  clicks: number;

  rank: number;
  producers: Record<string, number>;
  upgrades: string[];
  clickUpgrades: number;
  allies: string[];
  items: string[];
  rivals: Record<string, RivalState>;

  dayTime: number; // 0..1
  day: number;
  flipDoneToday: boolean;
  bribedTonight: boolean;
  lastFlip: { winner: string; day: number } | null;
  favorBuffUntil: number;
  beddings: number;

  eventTimer: number;
  activeEvent: string | null;
  eventResult: { title: string; text: string } | null;
  seenEvents: string[];
  log: LogEntry[];

  enlightenment: number;
  totalEnlightenment: number;
  meditations: Record<string, number>;
  prestigeCount: number;
  eraCount: number;
  achievements: string[];

  combo: number;
  comboTimer: number;
  comboBursts: number;

  fxId: number;
  fx: { id: number; kind: 'gold' | 'petal' | 'red'; target: string } | null;
  ceremony: Ceremony | null;
  banner: { id: number; title: string; text: string; kind: 'gold' | 'red' | 'ink' } | null;
  offlineReport: OfflineReport | null;
  logId: number;
  autoBuyTimer: number;
  achTimer: number;

  settings: { muted: boolean; quality: 'high' | 'low'; autoRotate: boolean };
}

export interface Effect {
  text: string;
  favorSec?: number; // × favor per second
  favorPct?: number; // % of current favor (negative = loss)
  favorFlat?: number;
  silverMin?: number; // × stipend per second × 60
  schemeMin?: number; // × scheme per second × 60 (min 3)
  schemeFlat?: number;
  rivalPower?: { id: string; pct: number }[];
  buffSec?: number;
  enlightenment?: number;
  unlockPrestige?: boolean;
}

export interface Choice {
  label: string;
  hint?: string;
  requireAlly?: string;
  requireProducer?: string;
  costSchemeMin?: number; // cost in minutes of scheme income (min 5)
  costSilverMin?: number; // cost in minutes of stipend
  chance?: number;
  success?: Effect;
  fail?: Effect;
  effect?: Effect;
}

export interface GameEvent {
  id: string;
  title: string;
  speaker?: string;
  text: string;
  once?: boolean;
  weight?: number;
  minRank?: number;
  maxRank?: number;
  rivalAlive?: string;
  rivalAppeared?: string;
  requirePrestige?: number;
  maxPrestige?: number;
  choices: Choice[];
}
