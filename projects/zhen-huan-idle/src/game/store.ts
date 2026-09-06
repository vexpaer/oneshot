import { create } from 'zustand';
import type { GameState, RivalState, Effect, Choice, LogEntry, Ceremony } from './types';
import {
  RANKS, MAX_RANK, PRODUCERS, PRODUCER_MAP, UPGRADE_TIERS, UPGRADE_COST_MULT, CLICK_UPGRADE_COSTS,
  ALLIES, ALLY_MAP, ITEMS, ITEM_MAP, RIVALS, RIVAL_MAP, MEDITATIONS, MEDITATION_MAP, ACHIEVEMENTS,
  EVENTS, EVENT_MAP, DAY_LENGTH, FLIP_TIME, OFFLINE_CAP, OFFLINE_RATE,
} from './data';
import { fmt } from './format';
import { sfx, setMuted } from './audio';

const SAVE_KEY = 'zhenhuan-idle-save-v1';
const VERSION = 1; // 存档版本：结构变化时递增并在 load 中迁移

// ───────────────────────── 初始状态 ─────────────────────────
function initialRivals(): Record<string, RivalState> {
  const r: Record<string, RivalState> = {};
  RIVALS.forEach((d) => (r[d.id] = { power: d.power, fallen: false }));
  return r;
}

export function newState(): GameState {
  return {
    version: VERSION,
    lastSaved: Date.now(),
    startedAt: Date.now(),
    favor: 0, silver: 0, scheme: 0, lifeFavor: 0, totalFavor: 0, totalSilver: 0, clicks: 0,
    rank: 0, producers: {}, upgrades: [], clickUpgrades: 0, allies: [], items: [], rivals: initialRivals(),
    dayTime: 0.3, day: 1, flipDoneToday: false, bribedTonight: false, lastFlip: null, favorBuffUntil: 0, beddings: 0,
    eventTimer: 45, activeEvent: null, eventResult: null, seenEvents: [], log: [],
    enlightenment: 0, totalEnlightenment: 0, meditations: {}, prestigeCount: 0, eraCount: 0, achievements: [],
    combo: 0, comboTimer: 0, comboBursts: 0,
    fxId: 0, fx: null, ceremony: null, banner: null, offlineReport: null, logId: 0, autoBuyTimer: 0, achTimer: 0,
    settings: { muted: false, quality: 'high', autoRotate: true },
  };
}

// ───────────────────────── 计算 ─────────────────────────
export const hasAlly = (s: GameState, id: string) => s.allies.includes(id);
export const hasItem = (s: GameState, id: string) => s.items.includes(id);
export const medLvl = (s: GameState, id: string) => s.meditations[id] ?? 0;
export const playerName = (s: GameState) => (s.prestigeCount > 0 ? '钮祜禄·甄嬛' : '甄嬛');
export const playerTitle = (s: GameState) => RANKS[s.rank].titles[s.prestigeCount > 0 ? 1 : 0];
export const isBuffed = (s: GameState, now = Date.now()) => s.favorBuffUntil > now;
export const buffMult = (s: GameState) => 2 + 0.5 * medLvl(s, 'changxiang');

export function favorMult(s: GameState, now = Date.now()): number {
  let m = Math.pow(1.5, s.rank);
  for (const id of s.allies) m *= ALLY_MAP[id]?.favor ?? 1;
  for (const id of s.items) m *= ITEM_MAP[id]?.favor ?? 1;
  for (const r of RIVALS) if (s.rivals[r.id]?.fallen && r.favor) m *= r.favor;
  m *= 1 + 0.25 * medLvl(s, 'jingxin');
  m *= 1 + 0.02 * s.totalEnlightenment;
  m *= Math.pow(3, s.eraCount);
  m *= 1 + 0.03 * s.achievements.length;
  if (isBuffed(s, now)) m *= buffMult(s);
  return m;
}

export function producerRate(s: GameState, id: string): number {
  const def = PRODUCER_MAP[id];
  let tiers = 0;
  for (let t = 0; t < UPGRADE_TIERS.length; t++) if (s.upgrades.includes(`${id}:${t}`)) tiers++;
  return def.rate * Math.pow(2, tiers);
}

export function rawProduction(s: GameState): number {
  let sum = 0;
  for (const p of PRODUCERS) {
    const c = s.producers[p.id] ?? 0;
    if (c > 0) sum += c * producerRate(s, p.id);
  }
  return sum;
}

export const favorPerSec = (s: GameState, now = Date.now()) => rawProduction(s) * favorMult(s, now);

export function clickPower(s: GameState, now = Date.now()): number {
  let base = Math.pow(2, s.clickUpgrades);
  for (const id of s.allies) base *= ALLY_MAP[id]?.click ?? 1;
  return base * favorMult(s, now) + favorPerSec(s, now) * 0.03;
}

export function silverPerSec(s: GameState): number {
  let m = RANKS[s.rank].stipend;
  for (const id of s.allies) m *= ALLY_MAP[id]?.silver ?? 1;
  for (const id of s.items) m *= ITEM_MAP[id]?.silver ?? 1;
  for (const r of RIVALS) if (s.rivals[r.id]?.fallen && r.silver) m *= r.silver;
  if (medLvl(s, 'pingfan')) m *= 3;
  m *= Math.pow(2, s.eraCount);
  return m;
}

export function schemePerSec(s: GameState): number {
  let base = 0.02 * s.rank;
  for (const id of s.allies) base += ALLY_MAP[id]?.schemeBase ?? 0;
  if (base <= 0) return 0;
  base += 0.01 * (s.producers.taijian ?? 0); // 太监：内廷耳目
  let m = Math.pow(1.45, s.rank);
  for (const id of s.allies) m *= ALLY_MAP[id]?.schemeMult ?? 1;
  for (const id of s.items) m *= ITEM_MAP[id]?.schemeMult ?? 1;
  for (const r of RIVALS) if (s.rivals[r.id]?.fallen && r.schemeMult) m *= r.schemeMult;
  m *= 1 + 0.4 * medLvl(s, 'huigen');
  m *= 1 + 0.02 * s.totalEnlightenment;
  m *= Math.pow(2, s.eraCount);
  return base * m;
}

export function producerCost(s: GameState, id: string, qty = 1): number {
  const def = PRODUCER_MAP[id];
  const owned = s.producers[id] ?? 0;
  const r = 1.15;
  return def.cost * Math.pow(r, owned) * ((Math.pow(r, qty) - 1) / (r - 1));
}

export function maxAffordable(s: GameState, id: string): number {
  const def = PRODUCER_MAP[id];
  const owned = s.producers[id] ?? 0;
  const r = 1.15;
  const first = def.cost * Math.pow(r, owned);
  if (s.favor < first) return 0;
  return Math.floor(Math.log((s.favor * (r - 1)) / first + 1) / Math.log(r));
}

export function nextUpgrade(s: GameState, id: string): { tier: number; cost: number } | null {
  const owned = s.producers[id] ?? 0;
  for (let t = 0; t < UPGRADE_TIERS.length; t++) {
    if (s.upgrades.includes(`${id}:${t}`)) continue;
    if (owned >= UPGRADE_TIERS[t]) return { tier: t, cost: PRODUCER_MAP[id].cost * UPGRADE_COST_MULT[t] };
    return null;
  }
  return null;
}

export function playerFlipWeight(s: GameState): number {
  let w = 2 + s.rank * 1.5;
  for (const id of s.allies) w *= ALLY_MAP[id]?.flip ?? 1;
  for (const id of s.items) w *= ITEM_MAP[id]?.flip ?? 1;
  for (const r of RIVALS) if (s.rivals[r.id]?.fallen && r.flip) w *= r.flip;
  w *= 1 + 0.3 * medLvl(s, 'fozhu');
  if (s.bribedTonight) w *= 2.2;
  return w;
}

export const rivalActive = (s: GameState, id: string) => !s.rivals[id].fallen && s.rank >= RIVAL_MAP[id].appearRank;

export function rivalFlipWeightTotal(s: GameState): number {
  let w = 0;
  for (const r of RIVALS) if (rivalActive(s, r.id)) w += r.flipWeight * Math.min(2, Math.max(0.3, s.rivals[r.id].power / r.power));
  return w;
}

export const flipChance = (s: GameState) => {
  const p = playerFlipWeight(s);
  return p / (p + rivalFlipWeightTotal(s));
};

export const bribeCost = (s: GameState) => Math.ceil(silverPerSec(s) * 40);

export function prestigeGain(s: GameState): number {
  return Math.floor(5 * Math.sqrt(s.lifeFavor / 1e7) * Math.pow(2, s.eraCount));
}

export function prestigeUnlocked(s: GameState): boolean {
  if (s.prestigeCount > 0) return s.rank >= 4;
  return s.rank >= 5 || s.seenEvents.includes('chunyuan');
}

export function canPromote(s: GameState): { ok: boolean; reason: string; cost: number } {
  if (s.rank >= MAX_RANK) return { ok: false, reason: '已是极位', cost: 0 };
  const next = RANKS[s.rank + 1];
  if (next.requireFallen && !s.rivals[next.requireFallen].fallen) return { ok: false, reason: `需先扳倒${RIVAL_MAP[next.requireFallen].name}`, cost: next.cost };
  if (s.favor < next.cost) return { ok: false, reason: `需要 ${fmt(next.cost)} 恩宠`, cost: next.cost };
  return { ok: true, reason: '', cost: next.cost };
}

export function choiceCost(s: GameState, c: Choice): { scheme: number; silver: number } {
  const sps = schemePerSec(s);
  const scheme = c.costSchemeMin ? Math.max(5, Math.ceil(sps * 60 * c.costSchemeMin)) : 0;
  const silver = c.costSilverMin ? Math.max(10, Math.ceil(silverPerSec(s) * 60 * c.costSilverMin)) : 0;
  return { scheme, silver };
}

export function choiceAvailable(s: GameState, c: Choice): { ok: boolean; why: string } {
  if (c.requireAlly && !hasAlly(s, c.requireAlly)) return { ok: false, why: `需要盟友：${ALLY_MAP[c.requireAlly].name}` };
  if (c.requireProducer && !(s.producers[c.requireProducer] ?? 0)) return { ok: false, why: `需要：${PRODUCER_MAP[c.requireProducer].name}` };
  const cost = choiceCost(s, c);
  if (cost.scheme > s.scheme) return { ok: false, why: `心计不足（需 ${fmt(cost.scheme)}）` };
  if (cost.silver > s.silver) return { ok: false, why: `银两不足（需 ${fmt(cost.silver)}）` };
  return { ok: true, why: '' };
}

// ───────────────────────── 存档 ─────────────────────────
const TRANSIENT: (keyof GameState)[] = ['fx', 'ceremony', 'banner', 'offlineReport', 'activeEvent', 'eventResult'];

function serialize(s: GameState): string {
  const copy: Partial<GameState> = { ...s };
  for (const k of TRANSIENT) delete copy[k];
  copy.lastSaved = Date.now();
  return JSON.stringify(copy);
}

function load(): { state: GameState; fresh: boolean } {
  const base = newState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: base, fresh: true };
    const saved = JSON.parse(raw) as Partial<GameState>;
    const s: GameState = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings ?? {}) }, rivals: { ...initialRivals(), ...(saved.rivals ?? {}) } };
    s.fx = null; s.ceremony = null; s.banner = null; s.offlineReport = null; s.activeEvent = null; s.eventResult = null;
    s.eventTimer = Math.max(s.eventTimer, 15);
    s.combo = 0; s.comboTimer = 0;
    // 离线收益
    const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - (saved.lastSaved ?? Date.now())) / 1000));
    if (away > 60) {
      const f = favorPerSec(s, 0) * away * OFFLINE_RATE;
      const si = silverPerSec(s) * away * OFFLINE_RATE;
      const sc = schemePerSec(s) * away * OFFLINE_RATE;
      s.favor += f; s.lifeFavor += f; s.totalFavor += f; s.silver += si; s.totalSilver += si; s.scheme += sc;
      s.offlineReport = { seconds: away, favor: f, silver: si, scheme: sc };
      s.eventTimer = Math.max(s.eventTimer, 20);
    }
    return { state: s, fresh: false };
  } catch (e) {
    console.warn('存档读取失败，使用新档', e);
    return { state: base, fresh: true };
  }
}

// ───────────────────────── Store ─────────────────────────
interface Actions {
  tick: (dt: number) => void;
  click: () => { value: number; combo: number; burst: boolean };
  buyProducer: (id: string, qty: number | 'max') => boolean;
  buyUpgrade: (id: string) => void;
  buyClickUpgrade: () => void;
  recruitAlly: (id: string) => void;
  buyItem: (id: string) => void;
  promote: () => void;
  strike: (id: string, fraction: number) => void;
  bribe: () => void;
  chooseEvent: (idx: number) => void;
  closeEventResult: () => void;
  prestige: () => void;
  buyMeditation: (id: string) => void;
  newEra: () => void;
  closeCeremony: () => void;
  dismissOffline: () => void;
  clearBanner: (id: number) => void;
  toggleMute: () => void;
  setQuality: (q: 'high' | 'low') => void;
  toggleRotate: () => void;
  save: () => void;
  hardReset: () => void;
}

export type Store = GameState & Actions;

const loaded = load();

function pushLog(s: GameState, text: string, kind: LogEntry['kind'] = 'info'): { log: LogEntry[]; logId: number } {
  const entry: LogEntry = { id: s.logId + 1, day: s.day, text, kind };
  return { log: [entry, ...s.log].slice(0, 80), logId: s.logId + 1 };
}

function withFx(s: GameState, kind: 'gold' | 'petal' | 'red', target = 'player') {
  return { fxId: s.fxId + 1, fx: { id: s.fxId + 1, kind, target } };
}

function withBanner(s: GameState, title: string, text: string, kind: 'gold' | 'red' | 'ink' = 'gold') {
  return { banner: { id: (s.banner?.id ?? 0) + 1 + Math.floor(Math.random() * 1000), title, text, kind } };
}

function applyEffect(s: GameState, eff: Effect, now: number): Partial<GameState> {
  const fps = favorPerSec(s, now);
  const cp = clickPower(s, now);
  let favor = s.favor, life = s.lifeFavor, total = s.totalFavor;
  let silver = s.silver, totalSilver = s.totalSilver, scheme = s.scheme;
  let enlightenment = s.enlightenment, totalEnl = s.totalEnlightenment;
  let favorBuffUntil = s.favorBuffUntil;
  const rivals = { ...s.rivals };
  if (eff.favorSec) {
    const g = Math.max(fps * eff.favorSec, cp * eff.favorSec * 0.5);
    favor += g; life += g; total += g;
  }
  if (eff.favorFlat) { favor += eff.favorFlat; if (eff.favorFlat > 0) { life += eff.favorFlat; total += eff.favorFlat; } }
  if (eff.favorPct) {
    let pct = eff.favorPct;
    if (pct < 0) {
      if (hasAlly(s, 'wenshichu')) pct *= 0.5;
      if (medLvl(s, 'liuren')) pct *= 0.5;
    }
    favor = Math.max(0, favor + (favor * pct) / 100);
  }
  if (eff.silverMin) {
    const g = Math.max(5, silverPerSec(s) * 60) * eff.silverMin;
    silver = Math.max(0, silver + g);
    if (g > 0) totalSilver += g;
  }
  if (eff.schemeMin) scheme += Math.max(3, schemePerSec(s) * 60 * eff.schemeMin);
  if (eff.schemeFlat) scheme += eff.schemeFlat * (1 + s.rank * 0.5) * Math.pow(2, s.eraCount);
  if (eff.rivalPower) {
    for (const rp of eff.rivalPower) {
      const def = RIVAL_MAP[rp.id];
      const r = rivals[rp.id];
      if (!r || r.fallen) continue;
      rivals[rp.id] = { ...r, power: Math.max(1, Math.min(def.power * 1.6, r.power + (def.power * rp.pct) / 100)) };
    }
  }
  if (eff.buffSec) {
    const dur = eff.buffSec * 1000 * (hasItem(s, 'tangquan') ? 2 : 1);
    favorBuffUntil = Math.max(favorBuffUntil, now) + dur;
  }
  if (eff.enlightenment) { enlightenment += eff.enlightenment; totalEnl += eff.enlightenment; }
  return { favor, lifeFavor: life, totalFavor: total, silver, totalSilver, scheme, enlightenment, totalEnlightenment: totalEnl, favorBuffUntil, rivals };
}

function pickEvent(s: GameState): string | null {
  const pool: { id: string; w: number }[] = [];
  for (const e of EVENTS) {
    if (e.once && s.seenEvents.includes(e.id)) continue;
    if (e.minRank !== undefined && s.rank < e.minRank) continue;
    if (e.maxRank !== undefined && s.rank > e.maxRank) continue;
    if (e.rivalAlive && s.rivals[e.rivalAlive].fallen) continue;
    if (e.rivalAppeared && s.rank < RIVAL_MAP[e.rivalAppeared].appearRank) continue;
    if (e.requirePrestige !== undefined && s.prestigeCount < e.requirePrestige) continue;
    if (e.maxPrestige !== undefined && s.prestigeCount > e.maxPrestige) continue;
    pool.push({ id: e.id, w: e.weight ?? (e.once ? 4 : 1) });
  }
  if (!pool.length) return null;
  const total = pool.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.id; }
  return pool[pool.length - 1].id;
}

function checkAchievements(s: GameState): string[] {
  const out: string[] = [];
  const has = (id: string) => s.achievements.includes(id) || out.includes(id);
  const add = (id: string, cond: boolean) => { if (cond && !has(id)) out.push(id); };
  add('a_first', s.clicks >= 1);
  add('a_click100', s.clicks >= 200);
  add('a_combo', s.comboBursts >= 1);
  add('a_bed', s.beddings >= 1);
  add('a_bed10', s.beddings >= 10);
  add('a_guiren', s.rank >= 3);
  add('a_yizhanghong', s.rivals.xiadongchun.fallen);
  add('a_huafei', s.rivals.huafei.fallen);
  add('a_meiyuan', (s.producers.meiyuan ?? 0) >= 1);
  add('a_ganlu', s.prestigeCount >= 1);
  add('a_xifei', s.prestigeCount >= 1 && s.rank >= 5);
  add('a_twins', (s.producers.huangsi ?? 0) >= 2);
  add('a_huanghou', s.rivals.huanghou.fallen);
  add('a_taihou', s.rank >= MAX_RANK);
  add('a_silver', s.totalSilver >= 1e5);
  add('a_favor', s.totalFavor >= 1e8);
  add('a_allies', ALLIES.every((a) => s.allies.includes(a.id)));
  add('a_era', s.eraCount >= 1);
  return out;
}

export const useGame = create<Store>()((set, get) => ({
  ...loaded.state,
  ceremony: loaded.fresh
    ? { type: 'intro', title: '入宫', subtitle: '雍正元年 · 殿选', body: '「嬛嬛一袅楚宫腰。」\n\n殿选之上，皇上只看了你一眼，留了牌子。\n\n从今日起，你是这紫禁城里千万人中的一个。往上走，是妃、是后、是太后；往下看，是冷宫、是一丈红。\n\n六宫的路，从一次请安开始。', detail: '点击宫殿或「请安」积攒恩宠 · 置办宫人自动生产 · 结交盟友 · 扳倒对手 · 步步高升' }
    : null,

  tick: (dt) => {
    const s = get();
    const now = Date.now();
    const fps = favorPerSec(s, now);
    const sps = silverPerSec(s);
    const cps = schemePerSec(s);
    let favor = s.favor + fps * dt;
    let life = s.lifeFavor + fps * dt;
    let total = s.totalFavor + fps * dt;
    let silver = s.silver + sps * dt;
    let totalSilver = s.totalSilver + sps * dt;
    let scheme = s.scheme + cps * dt;
    if (medLvl(s, 'yinlu')) {
      const g = clickPower(s, now) * 4 * dt;
      favor += g; life += g; total += g;
    }
    let combo = s.combo, comboTimer = s.comboTimer;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { comboTimer = 0; combo = 0; } }

    // 对手势力恢复
    const rivals = { ...s.rivals };
    for (const r of RIVALS) {
      const st = rivals[r.id];
      if (st.fallen || st.power >= r.power) continue;
      rivals[r.id] = { ...st, power: Math.min(r.power, st.power + r.power * 0.002 * dt) };
    }

    // 时辰与翻牌
    let dayTime = s.dayTime + dt / DAY_LENGTH;
    let day = s.day, flipDone = s.flipDoneToday, bribed = s.bribedTonight, lastFlip = s.lastFlip;
    let favorBuffUntil = s.favorBuffUntil, beddings = s.beddings;
    let logPatch: Partial<GameState> = {};
    let fxPatch: Partial<GameState> = {};
    let bannerPatch: Partial<GameState> = {};
    let sound: (() => void) | null = null;
    if (!flipDone && dayTime >= FLIP_TIME) {
      flipDone = true;
      const pw = playerFlipWeight(s);
      const entries: { id: string; w: number }[] = [{ id: 'player', w: pw }];
      for (const r of RIVALS) if (rivalActive(s, r.id)) entries.push({ id: r.id, w: r.flipWeight * Math.min(2, Math.max(0.3, s.rivals[r.id].power / r.power)) });
      const tw = entries.reduce((a, b) => a + b.w, 0);
      let roll = Math.random() * tw;
      let winner = 'player';
      for (const e of entries) { roll -= e.w; if (roll <= 0) { winner = e.id; break; } }
      lastFlip = { winner, day };
      if (winner === 'player') {
        const gain = Math.max(fps * 90, clickPower(s, now) * 40);
        const sg = sps * 120 + 5;
        favor += gain; life += gain; total += gain; silver += sg; totalSilver += sg; beddings += 1;
        const dur = 45 * 1000 * (hasItem(s, 'tangquan') ? 2 : 1);
        favorBuffUntil = Math.max(favorBuffUntil, now) + dur;
        logPatch = pushLog(s, `今夜皇上翻了你的牌子。得恩宠 ${fmt(gain)}、赏银 ${fmt(sg)}，承恩加成 ×${buffMult(s)}。`, 'gold');
        fxPatch = withFx(s, 'gold', 'player');
        bannerPatch = withBanner(s, '翻牌子 · 侍寝', `恩宠 +${fmt(gain)} · 银两 +${fmt(sg)} · 承恩 ×${buffMult(s)}`, 'gold');
        sound = sfx.chime;
      } else {
        const def = RIVAL_MAP[winner];
        const st = rivals[winner];
        rivals[winner] = { ...st, power: Math.min(def.power * 1.6, st.power * 1.04) };
        logPatch = pushLog(s, `今夜皇上翻了${def.title}的牌子。${def.name}势力渐盛。`, 'bad');
        fxPatch = withFx(s, 'red', winner);
        bannerPatch = withBanner(s, `今夜 · ${def.title}侍寝`, `${def.name}势力 +4%`, 'red');
      }
    }
    if (dayTime >= 1) { dayTime -= 1; day += 1; flipDone = false; bribed = false; }

    // 事件
    let eventTimer = s.eventTimer - dt;
    let activeEvent = s.activeEvent;
    if (eventTimer <= 0 && !activeEvent && !s.ceremony && !s.eventResult && !s.offlineReport) {
      const id = pickEvent(s);
      eventTimer = 70 + Math.random() * 50;
      if (id) { activeEvent = id; sfx.event(); }
    }

    // 自动购置
    let autoBuyTimer = s.autoBuyTimer + dt;
    const producers = { ...s.producers };
    if (medLvl(s, 'liugong') && autoBuyTimer >= 1) {
      autoBuyTimer = 0;
      let best: { id: string; ratio: number; cost: number } | null = null;
      for (const p of PRODUCERS) {
        if (s.rank < p.rank) continue;
        const cost = PRODUCER_MAP[p.id].cost * Math.pow(1.15, producers[p.id] ?? 0);
        if (cost > favor) continue;
        const ratio = producerRate(s, p.id) / cost;
        if (!best || ratio > best.ratio) best = { id: p.id, ratio, cost };
      }
      if (best) { favor -= best.cost; producers[best.id] = (producers[best.id] ?? 0) + 1; }
    }

    // 成就
    let achTimer = s.achTimer + dt;
    let achievements = s.achievements;
    if (achTimer >= 1) {
      achTimer = 0;
      const probe = { ...s, favor, totalFavor: total, totalSilver, clicks: s.clicks, rivals, beddings, producers } as GameState;
      const got = checkAchievements(probe);
      if (got.length) {
        achievements = [...achievements, ...got];
        const names = got.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).join('、');
        logPatch = pushLog({ ...s, ...logPatch } as GameState, `达成成就：${names}（恩宠 +3%）`, 'good');
        if (!bannerPatch.banner) bannerPatch = withBanner(s, '成就达成', names, 'ink');
      }
    }

    set({
      favor, lifeFavor: life, totalFavor: total, silver, totalSilver, scheme, combo, comboTimer, rivals,
      dayTime, day, flipDoneToday: flipDone, bribedTonight: bribed, lastFlip, favorBuffUntil, beddings,
      eventTimer, activeEvent, autoBuyTimer, producers, achTimer, achievements, ...logPatch, ...fxPatch, ...bannerPatch,
    });
    if (sound) sound();
  },

  click: () => {
    const s = get();
    const now = Date.now();
    let value = clickPower(s, now);
    let combo = s.combo + 1;
    let burst = false;
    let extra: Partial<GameState> = {};
    if (combo >= 30) {
      burst = true;
      const bonus = clickPower(s, now) * 40 + favorPerSec(s, now) * 12;
      value += bonus;
      combo = 0;
      extra = { ...pushLog(s, `连击圆满，圣心大悦！额外恩宠 +${fmt(bonus)}`, 'gold'), ...withFx(s, 'gold', 'player'), comboBursts: s.comboBursts + 1 };
      sfx.combo();
    } else {
      sfx.click(combo);
    }
    set({ favor: s.favor + value, lifeFavor: s.lifeFavor + value, totalFavor: s.totalFavor + value, clicks: s.clicks + 1, combo, comboTimer: 1.1, ...extra });
    return { value, combo, burst };
  },

  buyProducer: (id, qty) => {
    const s = get();
    const def = PRODUCER_MAP[id];
    if (s.rank < def.rank) return false;
    const n = qty === 'max' ? maxAffordable(s, id) : qty;
    if (n <= 0) { sfx.deny(); return false; }
    const cost = producerCost(s, id, n);
    if (cost > s.favor) { sfx.deny(); return false; }
    sfx.buy();
    set({ favor: s.favor - cost, producers: { ...s.producers, [id]: (s.producers[id] ?? 0) + n } });
    return true;
  },

  buyUpgrade: (id) => {
    const s = get();
    const up = nextUpgrade(s, id);
    if (!up || up.cost > s.favor) { sfx.deny(); return; }
    sfx.buy();
    set({ favor: s.favor - up.cost, upgrades: [...s.upgrades, `${id}:${up.tier}`], ...pushLog(s, `${PRODUCER_MAP[id].name}产出翻倍。`, 'good') });
  },

  buyClickUpgrade: () => {
    const s = get();
    const cost = CLICK_UPGRADE_COSTS[s.clickUpgrades];
    if (cost === undefined || cost > s.favor) { sfx.deny(); return; }
    sfx.buy();
    set({ favor: s.favor - cost, clickUpgrades: s.clickUpgrades + 1 });
  },

  recruitAlly: (id) => {
    const s = get();
    const def = ALLY_MAP[id];
    if (hasAlly(s, id) || s.rank < def.rank || s.silver < def.cost) { sfx.deny(); return; }
    sfx.chime();
    set({ silver: s.silver - def.cost, allies: [...s.allies, id], ...pushLog(s, `${def.name}成为你的盟友：${def.effect}。`, 'good'), ...withFx(s, 'petal', 'player'), ...withBanner(s, `结交 · ${def.name}`, def.effect, 'ink') });
  },

  buyItem: (id) => {
    const s = get();
    const def = ITEM_MAP[id];
    if (hasItem(s, id) || s.rank < def.rank || s.silver < def.cost) { sfx.deny(); return; }
    sfx.buy();
    set({ silver: s.silver - def.cost, items: [...s.items, id], ...pushLog(s, `置办${def.name}：${def.effect}。`, 'good') });
  },

  promote: () => {
    const s = get();
    const c = canPromote(s);
    if (!c.ok) { sfx.deny(); return; }
    const nr = s.rank + 1;
    const def = RANKS[nr];
    const reward = def.stipend * 100;
    sfx.ceremony();
    const title = def.titles[s.prestigeCount > 0 ? 1 : 0];
    set({
      favor: s.favor - c.cost, rank: nr, silver: s.silver + reward, totalSilver: s.totalSilver + reward,
      ...pushLog(s, `晋封${def.name}。${def.edict}`, 'gold'), ...withFx(s, 'gold', 'player'),
      ceremony: { type: 'promotion', title: `册封 · ${title}`, subtitle: `${def.palace}`, body: def.edict, detail: `恩宠产出 ×1.5 · 月例 ${fmt(def.stipend)}/秒 · 赏银 ${fmt(reward)}${nr === MAX_RANK ? '\n\n你走到了这条路的尽头。可在「修行」中开启新朝。' : ''}` },
    });
  },

  strike: (id, fraction) => {
    const s = get();
    const def = RIVAL_MAP[id];
    const st = s.rivals[id];
    if (st.fallen || s.rank < def.challengeRank) { sfx.deny(); return; }
    const spend = Math.min(s.scheme, fraction >= 1 ? s.scheme : s.scheme * fraction);
    if (spend < 1) { sfx.deny(); return; }
    const dmg = spend * (0.85 + Math.random() * 0.3);
    const power = st.power - dmg;
    const rivals = { ...s.rivals };
    if (power <= 0) {
      rivals[id] = { power: 0, fallen: true };
      sfx.drum();
      set({
        scheme: s.scheme - spend, rivals,
        ...pushLog(s, def.fallText, 'gold'), ...withFx(s, 'red', id),
        ceremony: { type: 'rivalFallen', title: `${def.name} · 倒台`, subtitle: def.quote, body: def.fallText, detail: `永久加成：${def.perk} · 翻牌之夜少了一个对手` },
      });
    } else {
      rivals[id] = { ...st, power };
      sfx.scheme();
      set({ scheme: s.scheme - spend, rivals, ...withFx(s, 'red', id) });
    }
  },

  bribe: () => {
    const s = get();
    const cost = bribeCost(s);
    if (s.bribedTonight || s.flipDoneToday || s.silver < cost) { sfx.deny(); return; }
    sfx.buy();
    set({ silver: s.silver - cost, bribedTonight: true, ...pushLog(s, `打点敬事房，今夜翻牌权重 ×2.2。`, 'info') });
  },

  chooseEvent: (idx) => {
    const s = get();
    if (!s.activeEvent) return;
    const ev = EVENT_MAP[s.activeEvent];
    const ch = ev.choices[idx];
    if (!ch || !choiceAvailable(s, ch).ok) { sfx.deny(); return; }
    const cost = choiceCost(s, ch);
    const now = Date.now();
    const base: GameState = { ...s, scheme: s.scheme - cost.scheme, silver: s.silver - cost.silver };
    let eff: Effect;
    if (ch.chance !== undefined && ch.success && ch.fail) eff = Math.random() < ch.chance ? ch.success : ch.fail;
    else eff = ch.effect!;
    const patch = applyEffect(base, eff, now);
    const isBad = (eff.favorPct ?? 0) < 0;
    if (isBad) sfx.bad(); else sfx.chime();
    set({
      ...base, ...patch, activeEvent: null, seenEvents: s.seenEvents.includes(ev.id) ? s.seenEvents : [...s.seenEvents, ev.id],
      eventResult: { title: ev.title, text: eff.text },
      ...pushLog(s, `${ev.title}：${eff.text}`, isBad ? 'bad' : 'good'),
      ...(isBad ? {} : withFx(s, 'petal', 'player')),
    });
  },

  closeEventResult: () => set({ eventResult: null }),

  prestige: () => {
    const s = get();
    if (!prestigeUnlocked(s)) { sfx.deny(); return; }
    const gain = prestigeGain(s);
    const fresh = newState();
    const startRank = Math.min(4, medLvl(s, 'huigong'));
    sfx.ceremony();
    const kept: Partial<GameState> = {
      allies: s.allies, rivals: s.rivals, meditations: s.meditations, achievements: s.achievements,
      totalFavor: s.totalFavor, totalSilver: s.totalSilver, clicks: s.clicks, beddings: s.beddings, comboBursts: s.comboBursts,
      seenEvents: s.seenEvents, day: s.day + 30, log: s.log, logId: s.logId, settings: s.settings, startedAt: s.startedAt, eraCount: s.eraCount,
      enlightenment: s.enlightenment + gain, totalEnlightenment: s.totalEnlightenment + gain, prestigeCount: s.prestigeCount + 1, rank: startRank,
      fxId: s.fxId,
    };
    const ns: GameState = { ...fresh, ...kept } as GameState;
    set({
      ...ns,
      ...pushLog(ns, `你在甘露寺修行了一段时日，得佛心 ${gain}。回宫之日，皇上亲赐姓钮祜禄氏。`, 'gold'),
      ceremony: { type: 'prestige', title: '甘露寺 · 修行', subtitle: '凡所有相，皆是虚妄', body: `青灯古佛，寒来暑往。你在甘露寺住了很久，久到以为自己会在这里老去。\n\n直到那个雪夜，有人再一次说：「逆风如解意。」\n\n你回宫了。这一次，你姓钮祜禄。`, detail: `获得佛心 ${gain}（累计 ${ns.totalEnlightenment}）· 每点佛心永久 +2% 恩宠 · 盟友与已倒台对手得以保留 · 回宫起始位分：${RANKS[startRank].name}` },
    });
  },

  buyMeditation: (id) => {
    const s = get();
    const def = MEDITATION_MAP[id];
    const lvl = medLvl(s, id);
    if (lvl >= def.max) { sfx.deny(); return; }
    const cost = def.cost(lvl);
    if (s.enlightenment < cost) { sfx.deny(); return; }
    sfx.chime();
    set({ enlightenment: s.enlightenment - cost, meditations: { ...s.meditations, [id]: lvl + 1 }, ...pushLog(s, `修行「${def.name}」：${def.effect(lvl + 1)}。`, 'good') });
  },

  newEra: () => {
    const s = get();
    if (s.rank < MAX_RANK) { sfx.deny(); return; }
    const fresh = newState();
    sfx.ceremony();
    const ns: GameState = {
      ...fresh, eraCount: s.eraCount + 1, achievements: s.achievements, totalFavor: s.totalFavor, totalSilver: s.totalSilver,
      clicks: s.clicks, beddings: s.beddings, comboBursts: s.comboBursts, settings: s.settings, startedAt: s.startedAt, log: s.log, logId: s.logId,
      allies: ['jinxi'], day: 1, fxId: s.fxId,
    };
    set({
      ...ns,
      ...pushLog(ns, `新朝开启。凤印传承 ×${s.eraCount + 1}，一切从头，却已不同。`, 'gold'),
      ceremony: { type: 'era', title: '新朝 · 凤印传承', subtitle: `第 ${s.eraCount + 2} 世`, body: '太后崩逝，谥号「孝圣宪皇后」。\n\n又一个女子踏进了这座紫禁城。她还不知道自己会走到哪里——但这一次，有人在暗中替她铺好了路。', detail: `凤印 ×${s.eraCount + 1}：恩宠 ×3、银两与心计 ×2、佛心获得 ×2（永久叠加）· 槿汐自始随侍` },
    });
  },

  closeCeremony: () => {
    const s = get();
    set({ ceremony: null, startedAt: s.ceremony?.type === 'intro' ? Date.now() : s.startedAt });
  },
  dismissOffline: () => set({ offlineReport: null }),
  clearBanner: (id) => { if (get().banner?.id === id) set({ banner: null }); },
  toggleMute: () => { const m = !get().settings.muted; setMuted(m); set({ settings: { ...get().settings, muted: m } }); },
  setQuality: (q) => set({ settings: { ...get().settings, quality: q } }),
  toggleRotate: () => set({ settings: { ...get().settings, autoRotate: !get().settings.autoRotate } }),
  save: () => {
    try { localStorage.setItem(SAVE_KEY, serialize(get())); set({ lastSaved: Date.now() }); } catch (e) { console.warn('存档失败', e); }
  },
  hardReset: () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    const fresh = newState();
    set({ ...fresh, ceremony: { type: 'intro', title: '入宫', subtitle: '雍正元年 · 殿选', body: '「嬛嬛一袅楚宫腰。」\n\n殿选之上，皇上只看了你一眼，留了牌子。\n\n六宫的路，从一次请安开始。', detail: '点击宫殿或「请安」积攒恩宠 · 置办宫人自动生产 · 结交盟友 · 扳倒对手 · 步步高升' } });
  },
}));

setMuted(loaded.state.settings.muted);

// 供 UI 直接引用的定义
export { RANKS, PRODUCERS, ALLIES, ITEMS, RIVALS, MEDITATIONS, ACHIEVEMENTS };
export type { Ceremony };
