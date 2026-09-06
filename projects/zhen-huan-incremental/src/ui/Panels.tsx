import { useState } from 'react';
import { useGame, actions, bulkCost, maxAffordable, allyCost, rivalCostMult, reqMet, isRivalActive } from '@/game/engine';
import { PRODUCERS, UPGRADES, RIVALS, SCHEMES, ALLIES, ITEMS, PRESTIGE_UPGRADES, RANKS } from '@/game/data';
import { fmt, fmtRate, pct } from '@/game/format';
import { useUI, type Tab } from './uiStore';

const TABS: { id: Tab; name: string; minRank: number }[] = [
  { id: 'gongwu', name: '宫务', minRank: 0 },
  { id: 'jimou', name: '计谋', minRank: 2 },
  { id: 'renmai', name: '人脉', minRank: 0 },
  { id: 'cangpin', name: '藏品', minRank: 2 },
  { id: 'xiuxing', name: '修行', minRank: 4 },
];

export function RightPanel() {
  const rawTab = useUI(u => u.tab);
  const setTab = useUI(u => u.setTab);
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const hasUpgrade = UPGRADES.some(u => !s.upgrades.includes(u.id) && upgradeVisible(s.rank, s.stats.clicks, s.producers, u) && s.favor >= u.cost);
  const hasAlly = ALLIES.some(a => allyVisible(a, s.rank, d.returned) && (s.allies[a.id] || 0) < a.maxLevel && !s.flags['gone_' + a.id] && (a.costType === 'scheming' ? s.scheming : s.favor) >= allyCost(a.id, s.allies[a.id] || 0));
  const canReturn = d.canReturn && d.daoGain > 0;
  const visibleTabs = TABS.filter(t => s.rank >= t.minRank || (t.id === 'xiuxing' && s.prestige.count > 0) || (t.id === 'cangpin' && s.items.length > 0));
  const tab = visibleTabs.some(t => t.id === rawTab) ? rawTab : 'gongwu';
  return (
    <div className="panel pointer-events-auto flex h-full w-full flex-col md:w-[380px]">
      <div className="flex border-b border-gold/25">
        {visibleTabs.map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.name}
            {t.id === 'gongwu' && hasUpgrade && <span className="dot" />}
            {t.id === 'renmai' && hasAlly && <span className="dot" />}
            {t.id === 'xiuxing' && canReturn && <span className="dot" />}
          </div>
        ))}
      </div>
      <div className="scroll min-h-0 flex-1 p-3">
        {tab === 'gongwu' && <GongwuTab />}
        {tab === 'jimou' && <JimouTab />}
        {tab === 'renmai' && <RenmaiTab />}
        {tab === 'cangpin' && <CangpinTab />}
        {tab === 'xiuxing' && <XiuxingTab />}
      </div>
    </div>
  );
}

function upgradeVisible(rank: number, clicks: number, producers: Record<string, number>, u: typeof UPGRADES[number]) {
  const r = u.req;
  if (r.rank !== undefined && rank < r.rank) return false;
  if (r.clicks !== undefined && clicks < r.clicks) return false;
  if (r.producer && (producers[r.producer] || 0) < (r.count || 0)) return false;
  return true;
}

// ── 宫务 ───────────────────────────────────────────────
function GongwuTab() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const mode = useUI(u => u.buyMode);
  const setMode = useUI(u => u.setBuyMode);
  const visible = PRODUCERS.filter(p => p.unlockRank <= s.rank && (!p.needReturn || d.returned));
  const nextLocked = PRODUCERS.find(p => !(p.unlockRank <= s.rank && (!p.needReturn || d.returned)));
  const ups = UPGRADES.filter(u => !s.upgrades.includes(u.id) && upgradeVisible(s.rank, s.stats.clicks, s.producers, u)).sort((a, b) => a.cost - b.cost);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.4em] text-gold/80">打 点</span>
        <div className="flex gap-1">
          {([1, 10, 'max'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`btn px-2 py-1 text-[11px] ${mode === m ? 'btn-gold' : ''}`}>{m === 'max' ? '最大' : `×${m}`}</button>
          ))}
        </div>
      </div>
      {visible.map(p => {
        const owned = s.producers[p.id] || 0;
        const n = mode === 'max' ? Math.max(1, maxAffordable(p.baseCost, owned, s.favor)) : mode;
        const cost = bulkCost(p.baseCost, owned, n);
        const can = s.favor >= cost;
        const rate = d.prodRate[p.id];
        return (
          <div key={p.id} className={`row flex items-center gap-3 p-2 ${can ? 'can' : ''}`} onClick={() => can && actions.buyProducer(p.id, mode)} title={p.desc}>
            <div className="glyph">{p.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-paper">{p.name}</span>
                <span className="num text-lg text-gold-2">{owned}</span>
              </div>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className={`num ${can ? 'text-gold-2' : 'text-blood/80'}`}>{fmt(cost)} 恩宠{n > 1 ? ` ×${n}` : ''}</span>
                <span className="num text-paper-2/70">每个 +{fmtRate(rate)}/秒</span>
              </div>
              {owned > 0 && <div className="mt-1 text-[10px] text-paper-2/60">合计 {fmtRate(owned * rate)}/秒 · {pct(d.fps > 0 ? owned * rate / d.fps : 0)}</div>}
            </div>
          </div>
        );
      })}
      {nextLocked && (
        <div className="row locked p-2 text-center text-[11px] text-paper-2">
          {nextLocked.needReturn && !d.returned ? '甘露寺回宫后' : `晋为${RANKS[nextLocked.unlockRank].name}后`}解锁「{nextLocked.name}」
        </div>
      )}
      {ups.length > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] tracking-[0.4em] text-gold/80">机 缘</span>
            <span className="text-[10px] text-paper-2/60">已得 {s.upgrades.length}</span>
          </div>
          {ups.map(u => {
            const can = s.favor >= u.cost;
            return (
              <div key={u.id} className={`row flex items-start gap-3 p-2 ${can ? 'can' : ''}`} onClick={() => can && actions.buyUpgrade(u.id)}>
                <div className="glyph" style={{ borderColor: 'rgba(111,163,154,0.6)' }}>缘</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-paper">{u.name}</span>
                    <span className={`num text-[11px] ${can ? 'text-gold-2' : 'text-blood/80'}`}>{fmt(u.cost)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-paper-2/80">{u.desc}</div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── 计谋 ───────────────────────────────────────────────
function JimouTab() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const selected = useUI(u => u.selectedRival);
  const select = useUI(u => u.selectRival);
  const active = RIVALS.filter(r => isRivalActive(s, r.id));
  const sel = selected && active.find(r => r.id === selected) ? selected : active.find(r => !s.rivals[r.id].defeated)?.id || active[0]?.id;
  const r = RIVALS.find(x => x.id === sel);
  const total = d.myPower + d.rivalPower;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] leading-relaxed text-paper-2/80">
        皇上的心只有一颗。削弱对手的势力，你的<span className="text-gold-2">圣心</span>份额便会上升——恩宠倍率随之而涨。但每一步都会留下<span className="text-blood">嫌疑</span>。
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {active.map(x => {
          const st = s.rivals[x.id];
          const on = x.id === sel;
          return (
            <div key={x.id} onClick={() => select(x.id)} className={`row flex cursor-pointer items-center gap-2 p-1.5 ${on ? 'can' : ''} ${st.defeated ? 'locked' : ''}`}>
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: st.defeated ? '#444' : x.color, boxShadow: st.defeated ? 'none' : `0 0 8px ${x.color}` }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-paper">{x.title} {x.name}</div>
                <div className="num text-[10px] text-paper-2/70">{st.defeated ? '已倒台' : `圣心 ${pct(st.power / total, 1)}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      {r && <RivalDetail id={r.id} />}
    </div>
  );
}

function RivalDetail({ id }: { id: string }) {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const r = RIVALS.find(x => x.id === id)!;
  const st = s.rivals[id];
  const ratio = st.power / r.basePower;
  const mult = rivalCostMult(id);
  const killerReady = ratio <= r.killer.threshold;
  const killerReq = reqMet(s, r.killer.req);
  return (
    <div className="panel mt-1 p-3" style={{ borderColor: r.color + '88' }}>
      <div className="flex items-baseline justify-between">
        <div><span className="title-brush text-xl" style={{ color: r.color }}>{r.name}</span><span className="ml-2 text-xs text-paper-2">{r.title}</span></div>
        {st.defeated && <span className="text-xs tracking-widest text-paper-2/60">倒 台</span>}
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-paper-2/80">{r.desc}</div>
      {!st.defeated && (
        <>
          <div className="mt-2 flex items-baseline justify-between text-[11px]">
            <span className="text-paper-2">势力</span>
            <span className="num text-paper">{fmt(st.power)} <span className="text-paper-2/60">/ {fmt(r.basePower)}（{pct(ratio)}）</span></span>
          </div>
          <div className="bar mt-1"><i style={{ width: pct(Math.min(1, ratio)), background: r.color }} /></div>
          <div className="mt-1 text-[10px] text-paper-2/60">势力每分钟自然回升 {(r.growth * 100).toFixed(1)}%（上限 250%）· 降至 5% 即倒台</div>
          <div className="mt-3 text-[10px] tracking-[0.4em] text-gold/80">计 谋</div>
          <div className="mt-1 flex flex-col gap-1.5">
            {SCHEMES.map(sc => {
              const cost = Math.ceil(sc.cost * mult);
              const ok = reqMet(s, sc.req);
              const can = ok && s.scheming >= cost;
              const dmg = Math.min(0.95, sc.damage * d.dmgMult);
              return (
                <button key={sc.id} disabled={!can} onClick={() => actions.scheme(id, sc.id)} className="btn btn-jade w-full justify-between px-3 py-2 text-left">
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-[13px]">{sc.name} <span className="text-[10px] text-paper-2/70">-{pct(dmg)} 势力</span></span>
                    <span className="text-[10px] tracking-normal text-paper-2/60">{ok ? sc.desc : sc.reqText}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="num text-jade">{fmt(cost)} 心机</span>
                    <span className="num text-[10px] text-blood/90">嫌疑 +{(sc.suspicion * d.suspicionRate).toFixed(1)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[10px] tracking-[0.4em] text-gold/80">杀 招</div>
          <div className={`row mt-1 p-2 ${killerReady && killerReq ? '' : 'locked'}`} style={{ borderColor: killerReady && killerReq ? r.color : undefined }}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-paper">{r.killer.name}</span>
              <span className="num text-[11px] text-jade">{fmt(r.killer.cost)} 心机 · <span className="text-blood/90">嫌疑 +{(r.killer.suspicion * d.suspicionRate).toFixed(0)}</span></span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-paper-2/80">{r.killer.text}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px]">
              <span className={killerReady ? 'text-jade' : 'text-blood/90'}>势力需 ≤ {pct(r.killer.threshold)}</span>
              <span className={killerReq ? 'text-jade' : 'text-blood/90'}>{r.killer.reqText}</span>
            </div>
            <button className="btn btn-seal mt-2 w-full tracking-[0.3em]" disabled={!(killerReady && killerReq && s.scheming >= r.killer.cost)} onClick={() => actions.killer(id)}>
              一击致命
            </button>
          </div>
        </>
      )}
      {st.defeated && <div className="mt-2 border-l-2 pl-2 text-[11px] leading-relaxed text-paper-2" style={{ borderColor: r.color }}>{r.reward.text}</div>}
    </div>
  );
}

// ── 人脉 ───────────────────────────────────────────────
function allyVisible(a: typeof ALLIES[number], rank: number, returned: boolean) {
  return a.unlockRank <= rank && (!a.needReturn || returned);
}
function RenmaiTab() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const list = ALLIES.filter(a => allyVisible(a, s.rank, d.returned));
  const next = ALLIES.find(a => !allyVisible(a, s.rank, d.returned));
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] leading-relaxed text-paper-2/80">宫里没有人能独活。每一位盟友都会改变你的处境——有的护你周全，有的替你出手，有的……让你身陷险境。</div>
      {list.map(a => {
        const lvl = s.allies[a.id] || 0;
        const gone = s.flags['gone_' + a.id];
        const max = lvl >= a.maxLevel;
        const cost = allyCost(a.id, lvl);
        const have = a.costType === 'scheming' ? s.scheming : s.favor;
        const can = !gone && !max && have >= cost;
        return (
          <div key={a.id} className={`row p-2.5 ${can ? 'can' : ''} ${gone ? 'locked' : ''}`} onClick={() => can && actions.buyAlly(a.id)}>
            <div className="flex items-start gap-3">
              <div className="glyph" style={{ borderColor: a.color, color: a.color }}>{a.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-paper">{a.name} <span className="text-[10px] text-paper-2/60">{a.role}</span></span>
                  <span className="flex gap-0.5">{Array.from({ length: a.maxLevel }).map((_, i) => <i key={i} className="block h-1.5 w-3" style={{ background: i < lvl ? a.color : 'rgba(255,255,255,0.1)' }} />)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-paper-2/80">{a.effect}</div>
                <div className="mt-1 flex items-baseline justify-between text-[11px]">
                  <span className="italic text-paper-2/50">「{a.quote}」</span>
                  {gone ? <span className="text-blood/80">已离去</span> : max ? <span className="text-gold-2">情谊已至</span> :
                    <span className={`num ${can ? 'text-gold-2' : 'text-blood/80'}`}>{fmt(cost)} {a.costType === 'scheming' ? '心机' : '恩宠'}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {next && <div className="row locked p-2 text-center text-[11px] text-paper-2">{next.needReturn && !d.returned ? '甘露寺回宫后' : `晋为${RANKS[next.unlockRank].name}后`}可结识「{next.name}」</div>}
    </div>
  );
}

// ── 藏品 ───────────────────────────────────────────────
function CangpinTab() {
  const s = useGame(st => st.s);
  const owned = ITEMS.filter(i => s.items.includes(i.id)).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-paper-2/80">藏品跨越轮回，永久保留。</span>
        <span className="num text-xs text-gold-2">{owned} / {ITEMS.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ITEMS.map(it => {
          const has = s.items.includes(it.id);
          return (
            <div key={it.id} className={`row flex items-start gap-2 p-2 ${has ? '' : 'locked'}`} title={has ? it.desc : '尚未得到'}>
              <div className="glyph" style={has ? { borderColor: '#d4a84b', background: 'radial-gradient(circle at 30% 30%, #5a3e1c, #1c1311)' } : { color: '#555' }}>{has ? it.icon : '？'}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-paper">{has ? it.name : '未得'}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-paper-2/70">{has ? it.effect : '……'}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] tracking-[0.4em] text-gold/80">记 事</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-paper-2">
        <span>请安次数</span><span className="num text-right text-paper">{s.stats.clicks.toLocaleString()}</span>
        <span>累计恩宠</span><span className="num text-right text-paper">{fmt(s.lifetimeFavor)}</span>
        <span>用计次数</span><span className="num text-right text-paper">{s.stats.schemes}</span>
        <span>倒台对手</span><span className="num text-right text-paper">{s.stats.rivalsDefeated}</span>
        <span>轮回</span><span className="num text-right text-paper">{s.prestige.count}</span>
        <span>在宫时长</span><span className="num text-right text-paper">{Math.floor(s.stats.playtime / 60)} 分</span>
      </div>
    </div>
  );
}

// ── 修行 ───────────────────────────────────────────────
function XiuxingTab() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const [confirm, setConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(0);
  const nextGainAt = Math.pow((d.daoGain + 1) / 1.5, 2) * 5e5;
  return (
    <div className="flex flex-col gap-2">
      <div className="paper relative p-4">
        <div className="seal absolute right-3 top-3 text-sm">甘露寺</div>
        <div className="title-brush text-2xl">出 宫 · 修 行</div>
        <div className="mt-2 text-[12px] leading-relaxed">
          「莞莞类卿」之后，你可以选择离开。位分、恩宠、宫务、盟友、对手都会归零——但你会带回<b>道行</b>。
          每一点道行永久提升恩宠 {s.prestige.upgrades.includes('p_dao2') ? '15' : '10'}%，并可在此修习秘法。藏品永久保留。
        </div>
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span>此行可得道行</span>
          <span className="num text-2xl font-semibold text-vermilion">+{d.daoGain}</span>
        </div>
        <div className="num mt-0.5 text-[10px] opacity-70">本世恩宠 {fmt(s.runFavor)} · 下一点需 {fmt(nextGainAt)}</div>
        {!d.canReturn && <div className="mt-2 text-[11px] text-vermilion">需晋至「妃」方可出宫。</div>}
        {!confirm ? (
          <button className="btn btn-seal mt-3 w-full tracking-[0.4em]" disabled={!d.canReturn} onClick={() => setConfirm(true)}>前往甘露寺</button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button className="btn btn-seal flex-1" onClick={() => { setConfirm(false); actions.goGanlusi(); }}>剪去青丝，出宫（+{d.daoGain} 道行）</button>
            <button className="btn flex-none" onClick={() => setConfirm(false)}>再想想</button>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.4em] text-gold/80">秘 法</span>
        <span className="num text-xs text-paper-2">道行 <span className="text-gold-2">{s.prestige.dao}</span> / 累计 {s.prestige.totalDao}</span>
      </div>
      {PRESTIGE_UPGRADES.map(u => {
        const has = s.prestige.upgrades.includes(u.id);
        const reqOk = !u.req || s.prestige.upgrades.includes(u.req);
        const can = !has && reqOk && s.prestige.dao >= u.cost;
        return (
          <div key={u.id} className={`row flex items-start gap-3 p-2 ${can ? 'can' : ''} ${has ? '' : reqOk ? '' : 'locked'}`} onClick={() => can && actions.buyPrestige(u.id)}>
            <div className="glyph" style={has ? { borderColor: '#d4a84b', color: '#d4a84b' } : {}}>{has ? '成' : '修'}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-paper">{u.name}</span>
                {has ? <span className="text-[11px] text-gold-2">已修成</span> : <span className={`num text-[11px] ${can ? 'text-gold-2' : 'text-blood/80'}`}>{u.cost} 道行</span>}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-paper-2/80">{u.desc}{u.req && !reqOk ? `（需先修「${PRESTIGE_UPGRADES.find(x => x.id === u.req)?.name}」）` : ''}</div>
            </div>
          </div>
        );
      })}

      <div className="mt-6 border-t border-gold/20 pt-3 text-center">
        {resetConfirm === 0 && <button className="btn text-[11px] opacity-60 hover:opacity-100" onClick={() => setResetConfirm(1)}>抹去一切，重新殿选</button>}
        {resetConfirm === 1 && <div className="flex justify-center gap-2"><button className="btn btn-seal text-[11px]" onClick={() => setResetConfirm(2)}>确定删除全部存档？</button><button className="btn text-[11px]" onClick={() => setResetConfirm(0)}>取消</button></div>}
        {resetConfirm === 2 && <div className="flex justify-center gap-2"><button className="btn btn-seal text-[11px]" onClick={() => { actions.hardReset(); setResetConfirm(0); }}>最后确认：删除</button><button className="btn text-[11px]" onClick={() => setResetConfirm(0)}>取消</button></div>}
      </div>
    </div>
  );
}
