import type { UpgradeDef } from './store';

export interface PlayerStats {
  damage: number;
  fireRate: number;
  magSize: number;
  reloadTime: number;
  maxHp: number;
  speedMul: number;
  dashCd: number;
  pellets: number;
  lifesteal: number;
  regen: number;
  pierce: number;
  crit: number;
  spread: number;
}

export const BASE_STATS: PlayerStats = {
  damage: 12,
  fireRate: 7.5,
  magSize: 18,
  reloadTime: 1.45,
  maxHp: 100,
  speedMul: 1,
  dashCd: 1.7,
  pellets: 1,
  lifesteal: 0,
  regen: 0,
  pierce: 0,
  crit: 0,
  spread: 1,
};

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage', name: 'Overclocked Coils', desc: '+22% damage per shot', icon: '⚡', max: 6 },
  { id: 'firerate', name: 'Rapid Cycler', desc: '+18% fire rate', icon: '🔥', max: 5 },
  { id: 'mag', name: 'Extended Cell', desc: '+6 magazine capacity', icon: '🔋', max: 5 },
  { id: 'reload', name: 'Quick Swap', desc: '-22% reload time', icon: '⏱', max: 4 },
  { id: 'hp', name: 'Reinforced Chassis', desc: '+30 max HP and heal 30', icon: '🛡', max: 6 },
  { id: 'speed', name: 'Servo Boost', desc: '+12% movement speed', icon: '👟', max: 4 },
  { id: 'dash', name: 'Dash Capacitor', desc: '-30% dash cooldown', icon: '💨', max: 3 },
  { id: 'twin', name: 'Twin Barrel', desc: '+1 projectile per shot (wider spread)', icon: '🔱', max: 3 },
  { id: 'siphon', name: 'Siphon Circuit', desc: 'Heal 4 HP on every kill', icon: '💚', max: 3 },
  { id: 'regen', name: 'Nano-Repair', desc: 'Regenerate 2 HP/s after 4s without damage', icon: '🧬', max: 3 },
  { id: 'pierce', name: 'Rail Rounds', desc: 'Shots pierce through +1 enemy', icon: '🎯', max: 2 },
  { id: 'crit', name: 'Critical Chip', desc: '+15% chance for 2.5x critical hits', icon: '💥', max: 4 },
  { id: 'focus', name: 'Gyro Stabilizer', desc: '-35% weapon spread', icon: '🎚', max: 2 },
];

export function applyUpgrades(owned: Record<string, number>): PlayerStats {
  const s = { ...BASE_STATS };
  const n = (id: string) => owned[id] || 0;
  s.damage *= Math.pow(1.22, n('damage'));
  s.fireRate *= Math.pow(1.18, n('firerate'));
  s.magSize += 6 * n('mag');
  s.reloadTime *= Math.pow(0.78, n('reload'));
  s.maxHp += 30 * n('hp');
  s.speedMul *= Math.pow(1.12, n('speed'));
  s.dashCd *= Math.pow(0.7, n('dash'));
  s.pellets += n('twin');
  s.lifesteal = 4 * n('siphon');
  s.regen = 2 * n('regen');
  s.pierce = n('pierce');
  s.crit = 0.15 * n('crit');
  s.spread *= Math.pow(0.65, n('focus'));
  return s;
}

export function rollUpgrades(owned: Record<string, number>, count = 3): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => (owned[u.id] || 0) < u.max);
  const out: UpgradeDef[] = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
