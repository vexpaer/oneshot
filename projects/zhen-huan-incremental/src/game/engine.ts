import { create } from 'zustand';
import {
  RANKS, PRODUCERS, UPGRADES, RIVALS, SCHEMES, ALLIES, ITEMS, PRESTIGE_UPGRADES, EVENTS, RANK_STORIES,
  type EventDef,
} from './data';

export const SAVE_KEY = 'zijin-chunqiu-save-v3';
const VERSION = 3;

export interface RivalState { power: number; defeated: boolean; }
export interface LogEntry { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'story'; }
export interface Ceremony { kind: 'rank' | 'defeat' | 'return' | 'exposed' | 'story'; title: string; sub?: string; lines: string[]; accent?: string; }

export interface GameState {
  version: number;
  favor: number; lifetimeFavor: number; runFavor: number;
  scheming: number; suspicion: number; rank: number;
  producers: Record<string, number>;
  upgrades: string[];
  allies: Record<string, number>;
  rivals: Record<string, RivalState>;
  items: string[];
  eventsSeen: string[];
  activeEvent: string | null;
  nextEventIn: number;
  buffs: Record<string, number>;
  prestige: { count: number; dao: number; totalDao: number; upgrades: string[] };
  stats: { clicks: number; schemes: number; playtime: number; rivalsDefeated: number; maxRank: number; runTime: number };
  log: LogEntry[];
  flags: Record<string, boolean>;
  ceremony: Ceremony | null;
  ceremonyQueue: Ceremony[];
  autoBuyTimer: number;
  lastTick: number;
  offlineReport: { seconds: number; favor: number; scheming: number } | null;
  fx: { clickPulse: number; rankPulse: number; defeatPulse: number; defeatId: string | null; exposedPulse: number; returnPulse: number; buyPulse: number };
  intro: boolean;
}

export interface Derived {
  fps: number; click: number; sps: number; share: number; myPower: number; rivalPower: number;
  globalMult: number; clickMult: number; schemingMult: number; decayRate: number; suspicionRate: number; dmgMult: number;
  prodRate: Record<string, number>; prodCost: Record<string, number>;
  daoGain: number; canReturn: boolean; autoClick: number; autoBuy: number;
  rankNext: { ok: boolean; reasons: string[] } | null;
  suspicionGen: number; returned: boolean;
}

let logId = 1;

function freshRivals(prev?: GameState): Record<string, RivalState> {
  const out: Record<string, RivalState> = {};
  for (const r of RIVALS) {
    let power = r.basePower;
    if (prev && prev.prestige.upgrades.includes('p_rivals') && prev.flags['ever_' + r.id]) power *= 0.5;
    out[r.id] = { power, defeated: false };
  }
  return out;
}

export function initialState(): GameState {
  return {
    version: VERSION,
    favor: 0, lifetimeFavor: 0, runFavor: 0, scheming: 0, suspicion: 0, rank: 0,
    producers: {}, upgrades: [], allies: {}, rivals: freshRivals(), items: [], eventsSeen: [],
    activeEvent: null, nextEventIn: 40, buffs: {},
    prestige: { count: 0, dao: 0, totalDao: 0, upgrades: [] },
    stats: { clicks: 0, schemes: 0, playtime: 0, rivalsDefeated: 0, maxRank: 0, runTime: 0 },
    log: [{ id: logId++, text: '雍正元年，殿选。你随一众秀女立在太和殿外，杏花正落。', kind: 'story' }],
    flags: {}, ceremony: null, ceremonyQueue: [], autoBuyTimer: 0, lastTick: Date.now(), offlineReport: null,
    fx: { clickPulse: 0, rankPulse: 0, defeatPulse: 0, defeatId: null, exposedPulse: 0, returnPulse: 0, buyPulse: 0 },
    intro: true,
  };
}

// ── 派生数值 ──────────────────────────────────────────────
function itemMult(s: GameState, type: string): number {
  let m = 1;
  for (const id of s.items) { const it = ITEMS.find(i => i.id === id); if (it && it.bonus.type === type) m *= it.bonus.value; }
  return m;
}
function upMult(s: GameState, type: string, target?: string): number {
  let m = 1;
  for (const id of s.upgrades) { const u = UPGRADES.find(x => x.id === id); if (u && u.type === type && (!target || u.target === target)) m *= u.mult; }
  return m;
}
const lv = (s: GameState, id: string) => s.allies[id] || 0;
const hasP = (s: GameState, id: string) => s.prestige.upgrades.includes(id);

export function compute(s: GameState): Derived {
  const returned = s.prestige.count > 0;
  const rankMult = Math.pow(1.5, s.rank);
  // 势力与圣心
  let myPower = 10 * Math.pow(1.7, s.rank) * upMult(s, 'power') * itemMult(s, 'power') * Math.pow(1.12, lv(s, 'jingfei'));
  if (hasP(s, 'p_power')) myPower *= 1.6;
  if ((s.buffs.power || 0) > 0) myPower *= 1.5;
  let rivalPower = 0;
  for (const r of RIVALS) {
    const st = s.rivals[r.id];
    if (!st || st.defeated || !isRivalActive(s, r.id)) continue;
    rivalPower += st.power;
  }
  const share = myPower / (myPower + rivalPower);

  let rivalReward = 1;
  for (const r of RIVALS) if (s.rivals[r.id]?.defeated && r.reward.favorMult) rivalReward *= r.reward.favorMult;

  const daoPer = hasP(s, 'p_dao2') ? 0.15 : 0.10;
  let globalMult = rankMult * (1 + 2 * share) * (1 + daoPer * s.prestige.dao) * upMult(s, 'global') * itemMult(s, 'global')
    * Math.pow(1.15, lv(s, 'meizhuang')) * Math.pow(1.6, lv(s, 'guojunwang')) * rivalReward;
  if (hasP(s, 'p_xi')) globalMult *= 1.5;
  if ((s.buffs.jinghong || 0) > 0) globalMult *= 3;

  const prodRate: Record<string, number> = {}, prodCost: Record<string, number> = {};
  let fps = 0;
  for (const p of PRODUCERS) {
    const n = s.producers[p.id] || 0;
    const rate = p.baseRate * upMult(s, 'producer', p.id) * globalMult;
    prodRate[p.id] = rate;
    prodCost[p.id] = Math.ceil(p.baseCost * Math.pow(1.15, n));
    fps += n * rate;
  }
  const clickMult = upMult(s, 'click') * itemMult(s, 'click') * Math.pow(1.3, lv(s, 'liuzhu'));
  const click = (1 + s.rank * 0.6 + fps * 0.03) * clickMult * Math.sqrt(rankMult);

  const schemingMult = upMult(s, 'scheming') * itemMult(s, 'scheming') * (hasP(s, 'p_scheming') ? 2 : 1);
  const sps = s.rank >= 2 ? (0.8 * Math.pow(1.5, s.rank - 2) + 0.3 * lv(s, 'jinxi')) * schemingMult : 0;

  const decayRate = 0.12 * (1 + 0.3 * lv(s, 'wen')) * itemMult(s, 'decay') * (hasP(s, 'p_puti') ? 1.5 : 1);
  const suspicionRate = Math.pow(0.9, lv(s, 'su')) * itemMult(s, 'suspicionRate');
  const suspicionGen = 0.04 * lv(s, 'guojunwang');
  const dmgMult = 1 + 0.15 * lv(s, 'duanfei') + 0.35 * lv(s, 'ye');

  const daoGain = Math.floor(Math.sqrt(s.runFavor / 5e5) * 1.5);
  const canReturn = s.rank >= 5;
  const autoClick = hasP(s, 'p_auto_click') ? 3 : lv(s, 'jinxi') >= 3 ? 2 : 0;
  const autoBuy = hasP(s, 'p_auto_buy') ? 5 : lv(s, 'su') >= 3 ? 8 : 0;

  let rankNext: Derived['rankNext'] = null;
  if (s.rank < RANKS.length - 1) {
    const nr = RANKS[s.rank + 1];
    const reasons: string[] = [];
    if (nr.needReturn && !returned) reasons.push('需先往甘露寺修行，再回宫');
    if (nr.id === 'taihou' && !hasP(s, 'p_final')) reasons.push('需修行「圣母皇太后」');
    if (nr.id === 'taihou' && !s.rivals.hou?.defeated) reasons.push('需皇后倒台');
    if (share < nr.share) reasons.push(`圣心需达 ${(nr.share * 100).toFixed(0)}%（现 ${(share * 100).toFixed(1)}%）`);
    if (s.favor < nr.cost) reasons.push('恩宠不足');
    rankNext = { ok: reasons.length === 0, reasons };
  }

  return { fps, click, sps, share, myPower, rivalPower, globalMult, clickMult, schemingMult, decayRate, suspicionRate, dmgMult, prodRate, prodCost, daoGain, canReturn, autoClick, autoBuy, rankNext, suspicionGen, returned };
}

// ── 工具 ─────────────────────────────────────────────────
export function bulkCost(base: number, owned: number, n: number): number {
  return Math.ceil(base * Math.pow(1.15, owned) * (Math.pow(1.15, n) - 1) / 0.15);
}
export function maxAffordable(base: number, owned: number, favor: number): number {
  const n = Math.floor(Math.log(favor * 0.15 / (base * Math.pow(1.15, owned)) + 1) / Math.log(1.15));
  return Math.max(0, n);
}
export function allyCost(id: string, level: number): number {
  const a = ALLIES.find(x => x.id === id)!;
  return Math.ceil(a.baseCost * Math.pow(a.costGrowth, level));
}
export function rivalCostMult(rivalId: string): number {
  const r = RIVALS.find(x => x.id === rivalId)!;
  return Math.max(1, Math.sqrt(r.basePower) / 2.45);
}
export function reqMet(s: GameState, req?: string): boolean {
  if (!req || req === 'none') return true;
  const [t, id, n] = req.split(':');
  if (t === 'ally') return (s.allies[id] || 0) >= (n ? parseInt(n) : 1);
  if (t === 'item') return s.items.includes(id);
  if (t === 'rank') return s.rank >= parseInt(id);
  return true;
}
export function rankTitle(s: GameState): string {
  const r = RANKS[s.rank];
  if (s.prestige.count > 0 && s.rank <= 5) return s.rank === 0 ? '钮祜禄氏' : '熹' + r.name;
  return r.title;
}
export function isRivalActive(s: GameState, id: string): boolean {
  const r = RIVALS.find(x => x.id === id)!;
  if (r.needReturn && s.prestige.count === 0) return false;
  return s.rank >= r.unlockRank;
}
export function eventEligible(s: GameState, e: EventDef): boolean {
  const c = e.cond;
  if (e.once && s.eventsSeen.includes(e.id)) return false;
  if (c.rank !== undefined && s.rank < c.rank) return false;
  if (c.maxRank !== undefined && s.rank > c.maxRank) return false;
  if (c.needReturn && s.prestige.count === 0) return false;
  if (c.noReturn && s.prestige.count > 0) return false;
  if (c.ally && !(s.allies[c.ally] > 0)) return false;
  if (c.item && !s.items.includes(c.item)) return false;
  if (c.notItem && s.items.includes(c.notItem)) return false;
  if (c.rivalAlive && (!isRivalActive(s, c.rivalAlive) || s.rivals[c.rivalAlive]?.defeated)) return false;
  if (c.rivalDead && !s.rivals[c.rivalDead]?.defeated) return false;
  return true;
}
export function choiceAvailable(s: GameState, effect: string): boolean {
  for (const part of effect.split(';')) {
    if (part.startsWith('req:')) { if (!reqMet(s, part.slice(4))) return false; }
  }
  return true;
}

// ── Store ────────────────────────────────────────────────
interface Store { s: GameState; d: Derived; }

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === VERSION) {
        const base = initialState();
        const s: GameState = { ...base, ...parsed, fx: base.fx, ceremony: parsed.ceremony || null, ceremonyQueue: parsed.ceremonyQueue || [] };
        s.prestige = { ...base.prestige, ...parsed.prestige };
        s.stats = { ...base.stats, ...parsed.stats };
        for (const r of RIVALS) if (!s.rivals[r.id]) s.rivals[r.id] = { power: r.basePower, defeated: false };
        logId = Math.max(logId, ...s.log.map(l => l.id)) + 1;
        s.activeEvent = s.activeEvent && EVENTS.find(e => e.id === s.activeEvent) ? s.activeEvent : null;
        return s;
      }
    }
  } catch { /* ignore corrupt save */ }
  return initialState();
}

const startState = load();
export const useGame = create<Store>(() => ({ s: startState, d: compute(startState) }));

function commit(s: GameState) {
  useGame.setState({ s: { ...s }, d: compute(s) });
}
function S(): GameState { return useGame.getState().s; }
function D(): Derived { return useGame.getState().d; }

function addLog(s: GameState, text: string, kind: LogEntry['kind'] = 'info') {
  s.log.push({ id: logId++, text, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}
function pushCeremony(s: GameState, c: Ceremony) {
  if (s.ceremony) s.ceremonyQueue.push(c); else s.ceremony = c;
}
function gainFavor(s: GameState, n: number) {
  s.favor += n; s.lifetimeFavor += n; s.runFavor += n;
}
function giveItem(s: GameState, id: string) {
  if (s.items.includes(id)) return;
  const it = ITEMS.find(i => i.id === id);
  if (!it) return;
  s.items.push(id);
  addLog(s, `获得藏品「${it.name}」：${it.effect}`, 'good');
}

export function save() {
  try {
    const s = S();
    s.lastTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch { /* storage full or unavailable */ }
}

// ── 动作 ─────────────────────────────────────────────────
export const actions = {
  finishIntro() { const s = S(); s.intro = false; commit(s); save(); },

  click() {
    const s = S(); const d = D();
    gainFavor(s, d.click);
    s.stats.clicks++;
    s.fx.clickPulse++;
    commit(s);
    return d.click;
  },

  buyProducer(id: string, mode: 1 | 10 | 'max') {
    const s = S();
    const p = PRODUCERS.find(x => x.id === id)!;
    const owned = s.producers[id] || 0;
    let n = mode === 'max' ? maxAffordable(p.baseCost, owned, s.favor) : mode;
    if (n <= 0) return;
    let cost = bulkCost(p.baseCost, owned, n);
    if (cost > s.favor) { n = maxAffordable(p.baseCost, owned, s.favor); if (n <= 0) return; cost = bulkCost(p.baseCost, owned, n); }
    s.favor -= cost;
    s.producers[id] = owned + n;
    s.fx.buyPulse++;
    commit(s);
  },

  buyUpgrade(id: string) {
    const s = S();
    const u = UPGRADES.find(x => x.id === id)!;
    if (s.upgrades.includes(id) || s.favor < u.cost) return;
    s.favor -= u.cost; s.upgrades.push(id);
    addLog(s, `${u.name}：${u.desc}`, 'good');
    s.fx.buyPulse++;
    commit(s);
  },

  buyAlly(id: string) {
    const s = S();
    const a = ALLIES.find(x => x.id === id)!;
    const level = s.allies[id] || 0;
    if (level >= a.maxLevel || s.flags['gone_' + id]) return;
    const cost = allyCost(id, level);
    if (a.costType === 'scheming') { if (s.scheming < cost) return; s.scheming -= cost; }
    else { if (s.favor < cost) return; s.favor -= cost; }
    s.allies[id] = level + 1;
    addLog(s, `${a.name}（${a.role}）——「${a.quote}」 关系升至 Lv${level + 1}`, 'good');
    commit(s);
  },

  scheme(rivalId: string, schemeId: string) {
    const s = S(); const d = D();
    const sc = SCHEMES.find(x => x.id === schemeId)!;
    const r = RIVALS.find(x => x.id === rivalId)!;
    const st = s.rivals[rivalId];
    if (!st || st.defeated || !reqMet(s, sc.req) || !isRivalActive(s, rivalId)) return;
    const cost = Math.ceil(sc.cost * rivalCostMult(rivalId));
    if (s.scheming < cost) return;
    s.scheming -= cost;
    s.stats.schemes++;
    const dmg = Math.min(0.95, sc.damage * d.dmgMult);
    st.power *= (1 - dmg);
    s.suspicion = Math.min(100, s.suspicion + sc.suspicion * d.suspicionRate);
    addLog(s, `你对${r.title}${r.name}用了「${sc.name}」，其势力削弱 ${(dmg * 100).toFixed(0)}%。`);
    checkRival(s, rivalId);
    checkSuspicion(s);
    commit(s);
  },

  killer(rivalId: string) {
    const s = S(); const d = D();
    const r = RIVALS.find(x => x.id === rivalId)!;
    const st = s.rivals[rivalId];
    if (!st || st.defeated || !reqMet(s, r.killer.req) || !isRivalActive(s, rivalId)) return;
    if (st.power > r.basePower * r.killer.threshold) return;
    if (s.scheming < r.killer.cost) return;
    s.scheming -= r.killer.cost;
    s.stats.schemes++;
    s.suspicion = Math.min(100, s.suspicion + r.killer.suspicion * d.suspicionRate);
    st.power = 0;
    addLog(s, r.killer.text, 'story');
    checkRival(s, rivalId, true);
    checkSuspicion(s);
    commit(s);
  },

  rankUp() {
    const s = S(); const d = D();
    if (!d.rankNext || !d.rankNext.ok) return;
    const nr = RANKS[s.rank + 1];
    s.favor -= nr.cost;
    s.rank++;
    s.stats.maxRank = Math.max(s.stats.maxRank, s.rank);
    s.fx.rankPulse++;
    const story = RANK_STORIES[s.rank];
    const title = rankTitle(s);
    addLog(s, `晋封：${title}。「${nr.desc}」`, 'story');
    pushCeremony(s, { kind: 'rank', title: `晋封 · ${title}`, sub: story?.title, lines: story?.lines || [nr.desc], accent: nr.desc });
    if (s.rank === 5 && s.prestige.count === 0) addLog(s, '甘露寺的门，已经为你开了。（修行 页可出宫）', 'story');
    commit(s); save();
  },

  chooseEvent(idx: number) {
    const s = S(); const d = D();
    const e = EVENTS.find(x => x.id === s.activeEvent);
    if (!e) { s.activeEvent = null; commit(s); return; }
    const ch = e.choices[idx];
    if (!ch || !choiceAvailable(s, ch.effect)) return;
    applyEffect(s, d, ch.effect);
    if (!s.eventsSeen.includes(e.id)) s.eventsSeen.push(e.id);
    addLog(s, `【${e.title}】${ch.label}`, 'story');
    s.activeEvent = null;
    s.nextEventIn = 75 + Math.random() * 70;
    checkSuspicion(s);
    commit(s); save();
  },

  dismissCeremony() {
    const s = S();
    s.ceremony = s.ceremonyQueue.shift() || null;
    commit(s);
  },

  dismissOffline() { const s = S(); s.offlineReport = null; commit(s); },

  goGanlusi() {
    const s = S(); const d = D();
    if (!d.canReturn) return;
    const gain = d.daoGain;
    const keep = s.prestige.upgrades.includes('p_keep_allies');
    const startRank = s.prestige.upgrades.includes('p_start') ? 3 : 0;
    const ns = initialState();
    ns.intro = false;
    ns.items = s.items;
    ns.prestige = { count: s.prestige.count + 1, dao: s.prestige.dao + gain, totalDao: s.prestige.totalDao + gain, upgrades: s.prestige.upgrades };
    ns.stats = { ...s.stats, runTime: 0 };
    ns.lifetimeFavor = s.lifetimeFavor;
    ns.flags = { ...s.flags };
    for (const r of RIVALS) if (s.rivals[r.id]?.defeated) ns.flags['ever_' + r.id] = true;
    ns.rivals = freshRivals({ ...s, flags: ns.flags, prestige: ns.prestige } as GameState);
    if (keep) for (const k of Object.keys(s.allies)) ns.allies[k] = Math.floor(s.allies[k] / 2);
    ns.rank = startRank;
    if (startRank > 0) ns.favor = 300;
    ns.stats.maxRank = Math.max(s.stats.maxRank, ns.rank);
    giveItem(ns, 'nianzhu');
    ns.log = [
      { id: logId++, text: `你在甘露寺修行了一世。道行 +${gain}（共 ${ns.prestige.dao}）。`, kind: 'story' },
      { id: logId++, text: '凤鸾春恩车停在寺外。皇上说：「朕给你抬旗，赐姓钮祜禄。」', kind: 'story' },
    ];
    ns.fx = { ...s.fx, returnPulse: s.fx.returnPulse + 1 };
    ns.ceremony = { kind: 'return', title: '甘露寺 · 修行', sub: `道行 +${gain}`, lines: ['青灯古佛，一年又一年。', '你剪去了三千烦恼丝，却剪不断凌云峰的风。', '直到那一日，凤鸾春恩车停在了寺外。', '「钮祜禄·甄嬛，回宫。」'] };
    commit(ns); save();
  },

  buyPrestige(id: string) {
    const s = S();
    const u = PRESTIGE_UPGRADES.find(x => x.id === id)!;
    if (s.prestige.upgrades.includes(id) || s.prestige.dao < u.cost) return;
    if (u.req && !s.prestige.upgrades.includes(u.req)) return;
    s.prestige.dao -= u.cost;
    s.prestige.upgrades.push(id);
    addLog(s, `修行：${u.name}。${u.desc}`, 'good');
    commit(s); save();
  },

  hardReset() {
    localStorage.removeItem(SAVE_KEY);
    const ns = initialState();
    commit(ns);
  },
};

function checkRival(s: GameState, id: string, byKiller = false) {
  const r = RIVALS.find(x => x.id === id)!;
  const st = s.rivals[id];
  if (st.defeated) return;
  if (st.power <= r.basePower * 0.05 || byKiller) {
    st.defeated = true; st.power = 0;
    s.stats.rivalsDefeated++;
    s.flags['ever_' + id] = true;
    s.fx.defeatPulse++; s.fx.defeatId = id;
    if (r.reward.item) giveItem(s, r.reward.item);
    if (r.reward.scheming) s.scheming += r.reward.scheming;
    addLog(s, r.reward.text, 'story');
    pushCeremony(s, { kind: 'defeat', title: `${r.title}${r.name} · 倒台`, sub: byKiller ? r.killer.name : '势力耗尽', lines: [byKiller ? r.killer.text : r.desc, r.reward.text], accent: r.color });
  }
}

function checkSuspicion(s: GameState) {
  if (s.suspicion < 100) return;
  s.suspicion = 35;
  const lostRank = s.rank > 1;
  if (lostRank) s.rank--;
  s.favor *= 0.5;
  s.fx.exposedPulse++;
  addLog(s, `事发！皇上震怒。${lostRank ? '你被降为' + rankTitle(s) + '，' : ''}恩宠折半。`, 'bad');
  pushCeremony(s, { kind: 'exposed', title: '事发', sub: '皇上震怒', lines: ['「朕待你不薄，你就是这样报答朕的？」', lostRank ? `你被降为${rankTitle(s)}，恩宠折半。` : '恩宠折半。', '碎玉轩的灯，暗了一半。'], accent: '#c0392b' });
}

function applyEffect(s: GameState, d: Derived, effect: string) {
  for (const part of effect.split(';')) {
    const [t, a, b] = part.split(':');
    switch (t) {
      case 'req': break;
      case 'favor': {
        const sec = parseFloat(a);
        const amt = Math.max(d.fps * sec, d.click * 25 * (sec / 60));
        gainFavor(s, amt); addLog(s, `恩宠 +${Math.floor(amt).toLocaleString()}`, 'good'); break;
      }
      case 'favorpct': { const p = parseFloat(a); s.favor = Math.max(0, s.favor * (1 + p)); addLog(s, `恩宠 ${p > 0 ? '+' : ''}${(p * 100).toFixed(0)}%`, p < 0 ? 'bad' : 'good'); break; }
      case 'scheming': {
        const amt = a.endsWith('s') ? Math.max(d.sps, 0.5) * parseFloat(a) : parseFloat(a);
        s.scheming += amt; addLog(s, `心机 +${Math.floor(amt)}`, 'good'); break;
      }
      case 'suspicion': { const v = parseFloat(a); s.suspicion = Math.max(0, Math.min(100, s.suspicion + v)); addLog(s, `嫌疑 ${v > 0 ? '+' : ''}${v}`, v > 0 ? 'bad' : 'good'); break; }
      case 'rival': {
        const st = s.rivals[a]; if (st && !st.defeated) { st.power *= (1 - parseFloat(b)); checkRival(s, a); }
        break;
      }
      case 'rivalsgrow': { for (const r of RIVALS) { const st = s.rivals[r.id]; if (st && !st.defeated) st.power *= 1 + parseFloat(a); } addLog(s, '新人入宫，六宫暗流涌动。', 'bad'); break; }
      case 'item': giveItem(s, a); break;
      case 'buff': { s.buffs[a] = parseFloat(b); addLog(s, a === 'jinghong' ? '惊鸿一舞，满座失声。恩宠 ×3，持续 90 秒。' : '六宫称颂。势力 ×1.5，持续 120 秒。', 'good'); break; }
      case 'allyup': { const cur = s.allies[a] || 0; const def = ALLIES.find(x => x.id === a)!; if (cur > 0 && cur < def.maxLevel) { s.allies[a] = cur + 1; addLog(s, `${def.name}关系 +1`, 'good'); } break; }
      case 'allyremove': { s.allies[a] = 0; s.flags['gone_' + a] = true; addLog(s, '桐花台上，他替你饮尽了那杯酒。', 'bad'); break; }
      case 'producer': { s.producers[a] = (s.producers[a] || 0) + parseInt(b); break; }
    }
  }
}

// ── Tick ─────────────────────────────────────────────────
function applyOffline(s: GameState, d: Derived, seconds: number) {
  const cap = s.prestige.upgrades.includes('p_offline') ? 24 * 3600 : 8 * 3600;
  const rate = s.prestige.upgrades.includes('p_offline') ? 1 : 0.5;
  const t = Math.min(seconds, cap);
  const favor = d.fps * t * rate;
  const scheming = d.sps * t * rate;
  gainFavor(s, favor); s.scheming += scheming;
  s.suspicion = Math.max(0, s.suspicion - d.decayRate * t);
  for (const k of Object.keys(s.buffs)) s.buffs[k] = Math.max(0, s.buffs[k] - t);
  if (favor > 0 || scheming > 0) s.offlineReport = { seconds: t, favor, scheming };
}

let autoClickAcc = 0;
export function tick(now: number) {
  const s = S();
  let d = D();
  let dt = (now - s.lastTick) / 1000;
  s.lastTick = now;
  if (dt <= 0) return;
  if (dt > 180) { applyOffline(s, d, dt); commit(s); return; }

  s.stats.playtime += dt; s.stats.runTime += dt;
  gainFavor(s, d.fps * dt);
  if (d.autoClick > 0) { autoClickAcc += d.autoClick * dt; if (autoClickAcc >= 1) { const n = Math.floor(autoClickAcc); autoClickAcc -= n; gainFavor(s, d.click * n); } }
  s.scheming += d.sps * dt;
  s.suspicion = Math.max(0, Math.min(100, s.suspicion - d.decayRate * dt + d.suspicionGen * dt));
  if (s.suspicion >= 100) checkSuspicion(s);

  for (const k of Object.keys(s.buffs)) { if (s.buffs[k] > 0) s.buffs[k] = Math.max(0, s.buffs[k] - dt); }

  // 对手成长
  for (const r of RIVALS) {
    const st = s.rivals[r.id];
    if (!st || st.defeated || !isRivalActive(s, r.id)) continue;
    const cap = r.basePower * 2.5;
    if (st.power < cap) st.power = Math.min(cap, st.power * (1 + r.growth * dt / 60));
  }

  // 自动打点
  if (d.autoBuy > 0) {
    s.autoBuyTimer += dt;
    if (s.autoBuyTimer >= d.autoBuy) {
      s.autoBuyTimer = 0;
      let best: { id: string; cost: number } | null = null;
      for (const p of PRODUCERS) {
        if (p.unlockRank > s.rank || (p.needReturn && s.prestige.count === 0)) continue;
        const c = d.prodCost[p.id];
        if (c <= s.favor && (!best || c < best.cost)) best = { id: p.id, cost: c };
      }
      if (best) { s.favor -= best.cost; s.producers[best.id] = (s.producers[best.id] || 0) + 1; }
    }
  }

  // 事件
  if (!s.activeEvent && !s.ceremony && s.rank >= 1 && !s.intro) {
    s.nextEventIn -= dt;
    if (s.nextEventIn <= 0) {
      const pool = EVENTS.filter(e => eventEligible(s, e));
      const prio = pool.filter(e => e.weight >= 4);
      const pick = prio.length ? prio : pool;
      if (pick.length) {
        const total = pick.reduce((a, e) => a + e.weight, 0);
        let r = Math.random() * total;
        for (const e of pick) { r -= e.weight; if (r <= 0) { s.activeEvent = e.id; break; } }
        if (!s.activeEvent) s.activeEvent = pick[pick.length - 1].id;
      } else s.nextEventIn = 60;
    }
  }
  commit(s);
}

let started = false;
export function startLoop() {
  if (started) return; started = true;
  const s = S();
  const now = Date.now();
  const away = (now - s.lastTick) / 1000;
  if (away > 180) { applyOffline(s, compute(s), away); }
  s.lastTick = now;
  commit(s);
  setInterval(() => tick(Date.now()), 100);
  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}
