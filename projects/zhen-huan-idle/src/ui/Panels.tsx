import { useEffect, useState, type ReactNode } from 'react';
import {
  useGame, producerCost, maxAffordable, producerRate, nextUpgrade, favorMult, prestigeGain, prestigeUnlocked, hasAlly, hasItem, medLvl, rivalActive, schemePerSec, favorPerSec,
} from '../game/store';
import {
  PRODUCERS, UPGRADE_TIERS, UPGRADE_NAMES, CLICK_UPGRADE_COSTS, CLICK_UPGRADE_NAMES, ALLIES, ITEMS, RIVALS, MEDITATIONS, ACHIEVEMENTS, RANKS, MAX_RANK,
} from '../game/data';
import { fmt, fmtRate, fmtTime } from '../game/format';
import { useUI, type Tab } from './uiStore';
import { SettingsButtons } from './HUD';

function useTick(ms = 300) {
  const [, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'court', label: '宫人' },
  { id: 'allies', label: '人脉' },
  { id: 'intrigue', label: '宫斗' },
  { id: 'cultivate', label: '修行' },
  { id: 'annals', label: '宫史' },
];

export function RightPanel() {
  const tab = useUI((u) => u.tab);
  const setTab = useUI((u) => u.setTab);
  const open = useUI((u) => u.panelOpen);
  const toggle = useUI((u) => u.togglePanel);
  const s = useGame();
  const unlockedPrestige = prestigeUnlocked(s);
  const badges: Partial<Record<Tab, boolean>> = {
    court: PRODUCERS.some((p) => s.rank >= p.rank && producerCost(s, p.id) <= s.favor) || PRODUCERS.some((p) => { const u = nextUpgrade(s, p.id); return u && u.cost <= s.favor; }),
    allies: ALLIES.some((a) => !hasAlly(s, a.id) && s.rank >= a.rank && a.cost <= s.silver) || ITEMS.some((i) => !hasItem(s, i.id) && s.rank >= i.rank && i.cost <= s.silver),
    intrigue: RIVALS.some((r) => rivalActive(s, r.id) && s.rank >= r.challengeRank && s.scheme >= s.rivals[r.id].power),
    cultivate: unlockedPrestige && prestigeGain(s) > 0 || MEDITATIONS.some((m) => medLvl(s, m.id) < m.max && m.cost(medLvl(s, m.id)) <= s.enlightenment),
  };
  return (
    <div className={`absolute right-3 top-[5.2rem] bottom-3 z-20 flex flex-col transition-all duration-300 ${open ? 'w-[24rem]' : 'w-10'}`}>
      <div className="lacquer flex-1 flex flex-col min-h-0">
        {open ? (
          <>
            <div className="flex border-b hairline px-2">
              {TABS.map((t) => (
                <div key={t.id} className={`tab relative ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                  {badges[t.id] && tab !== t.id && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-gold-2 shadow-[0_0_6px_#f0d48a]" />}
                </div>
              ))}
              <button className="text-mist hover:text-paper px-2 text-xs" onClick={toggle} title="收起">»</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {tab === 'court' && <CourtTab />}
              {tab === 'allies' && <AlliesTab />}
              {tab === 'intrigue' && <IntrigueTab />}
              {tab === 'cultivate' && <CultivateTab />}
              {tab === 'annals' && <AnnalsTab />}
            </div>
          </>
        ) : (
          <button className="flex-1 flex flex-col items-center justify-center gap-3 text-mist hover:text-gold-2" onClick={toggle} title="展开">
            <span className="text-xs">«</span>
            {TABS.map((t) => <span key={t.id} className="text-xs tracking-widest [writing-mode:vertical-rl]">{t.label}</span>)}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-1 pb-1">
      <div className="text-[0.68rem] tracking-[0.35em] text-gold">{children}</div>
      {right}
    </div>
  );
}

// ───────────────────────── 宫人 ─────────────────────────
function CourtTab() {
  useTick();
  const s = useGame();
  const qty = useUI((u) => u.buyQty);
  const setQty = useUI((u) => u.setBuyQty);
  const mult = favorMult(s);
  const clickCost = CLICK_UPGRADE_COSTS[s.clickUpgrades];
  const visible = PRODUCERS.filter((p, i) => s.rank >= p.rank || (i > 0 && s.rank >= PRODUCERS[i - 1].rank && (s.producers[PRODUCERS[i - 1].id] ?? 0) > 0));
  return (
    <>
      <SectionTitle right={
        <div className="flex gap-1">
          {([1, 10, 'max'] as const).map((q) => (
            <button key={q} className={`btn btn-xs ${qty === q ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setQty(q)}>{q === 'max' ? '最多' : `×${q}`}</button>
          ))}
        </div>
      }>置办宫人 · 总加成 ×{mult.toFixed(2)}</SectionTitle>

      {visible.map((p) => {
        const owned = s.producers[p.id] ?? 0;
        const locked = s.rank < p.rank;
        const n = qty === 'max' ? Math.max(1, maxAffordable(s, p.id)) : qty;
        const cost = producerCost(s, p.id, n);
        const can = !locked && cost <= s.favor && (qty !== 'max' || maxAffordable(s, p.id) > 0);
        const rate = producerRate(s, p.id) * mult;
        const up = nextUpgrade(s, p.id);
        const nextTier = UPGRADE_TIERS.find((t, i) => !s.upgrades.includes(`${p.id}:${i}`) && owned < t);
        return (
          <div key={p.id} className={`row ${locked ? 'locked' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-1 self-stretch" style={{ background: p.color, opacity: locked ? 0.3 : 1 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm tracking-widest">{p.name} <span className="text-mist text-xs num">×{owned}</span></div>
                  <div className="text-[0.68rem] text-jade num">{owned > 0 ? `${fmtRate(rate * owned)}/秒` : `${fmtRate(rate)}/秒`}</div>
                </div>
                <div className="tip mt-0.5 truncate">{locked ? `需位分：${RANKS[p.rank].name}` : p.desc}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button className={`btn btn-xs flex-1 ${can ? 'btn-vermilion' : ''}`} disabled={!can} onClick={() => s.buyProducer(p.id, qty)}>
                    置办 ×{n} · <span className="num">{fmt(cost)}</span>
                  </button>
                  {up ? (
                    <button className="btn btn-xs btn-gold" disabled={up.cost > s.favor} onClick={() => s.buyUpgrade(p.id)} title={`${UPGRADE_NAMES[p.id][up.tier]}：${p.name}产出 ×2`}>
                      {UPGRADE_NAMES[p.id][up.tier]} · {fmt(up.cost)}
                    </button>
                  ) : nextTier ? (
                    <span className="tip num">{owned}/{nextTier} 解锁强化</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <SectionTitle>请安修养</SectionTitle>
      <div className="row">
        <div className="flex items-baseline justify-between">
          <div className="text-sm tracking-widest">{clickCost !== undefined ? CLICK_UPGRADE_NAMES[s.clickUpgrades] : '莞莞类卿'}</div>
          <div className="text-[0.68rem] text-mist">已修 {s.clickUpgrades} 层</div>
        </div>
        <div className="tip mt-0.5">每层请安基础效果 ×2。请安另含 3% 每秒产出。</div>
        <button className="btn btn-xs w-full mt-1.5" disabled={clickCost === undefined || clickCost > s.favor} onClick={s.buyClickUpgrade}>
          {clickCost === undefined ? '已至圆满' : <>修习 · <span className="num">{fmt(clickCost)}</span></>}
        </button>
      </div>
    </>
  );
}

// ───────────────────────── 人脉 ─────────────────────────
function AlliesTab() {
  useTick();
  const s = useGame();
  return (
    <>
      <SectionTitle>盟友 · 银两结交（出宫亦不散）</SectionTitle>
      {ALLIES.map((a) => {
        const has = hasAlly(s, a.id);
        const locked = s.rank < a.rank;
        const can = !has && !locked && s.silver >= a.cost;
        return (
          <div key={a.id} className={`row ${locked && !has ? 'locked' : ''} ${has ? 'done' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 flex items-center justify-center text-sm border" style={{ borderColor: a.color, color: a.color, background: has ? a.color + '22' : 'transparent' }}>{a.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm tracking-widest">{a.name} <span className="text-mist text-[0.66rem]">{a.role}</span></div>
                  <div className="text-[0.68rem] text-gold-2">{a.effect}</div>
                </div>
                <div className="tip mt-0.5">{locked && !has ? `需位分：${RANKS[a.rank].name}` : a.desc}</div>
                {!has && (
                  <button className={`btn btn-xs w-full mt-1.5 ${can ? 'btn-vermilion' : ''}`} disabled={!can} onClick={() => s.recruitAlly(a.id)}>
                    结交 · <span className="num">{fmt(a.cost)} 银</span>
                  </button>
                )}
                {has && <div className="text-[0.68rem] text-jade mt-1 tracking-widest">已是盟友</div>}
              </div>
            </div>
          </div>
        );
      })}
      <SectionTitle>珍玩 · 置办</SectionTitle>
      {ITEMS.map((it) => {
        const has = hasItem(s, it.id);
        const locked = s.rank < it.rank;
        const can = !has && !locked && s.silver >= it.cost;
        return (
          <div key={it.id} className={`row ${locked && !has ? 'locked' : ''} ${has ? 'done' : ''}`}>
            <div className="flex items-baseline justify-between">
              <div className="text-sm tracking-widest">{it.name}</div>
              <div className="text-[0.68rem] text-gold-2">{it.effect}</div>
            </div>
            <div className="tip mt-0.5">{locked && !has ? `需位分：${RANKS[it.rank].name}` : it.desc}</div>
            {!has ? (
              <button className={`btn btn-xs w-full mt-1.5 ${can ? 'btn-vermilion' : ''}`} disabled={!can} onClick={() => s.buyItem(it.id)}>置办 · <span className="num">{fmt(it.cost)} 银</span></button>
            ) : <div className="text-[0.68rem] text-jade mt-1 tracking-widest">已置办</div>}
          </div>
        );
      })}
    </>
  );
}

// ───────────────────────── 宫斗 ─────────────────────────
function IntrigueTab() {
  useTick(200);
  const s = useGame();
  const selected = useUI((u) => u.selectedRival);
  const select = useUI((u) => u.selectRival);
  const cps = schemePerSec(s);
  const list = RIVALS.filter((r) => rivalActive(s, r.id) || s.rivals[r.id].fallen);
  const upcoming = RIVALS.filter((r) => !rivalActive(s, r.id) && !s.rivals[r.id].fallen);
  return (
    <>
      <div className="row">
        <div className="text-sm tracking-widest">心计 <span className="num gold-text">{fmt(s.scheme)}</span> <span className="tip">（{fmtRate(cps)}/秒）</span></div>
        <div className="tip mt-0.5">
          对手会分走翻牌子的机会，并不时陷害你。积攒心计后「落子」削其势力，势力归零即倒台，永久获得加成。对手势力会缓慢恢复——一击致命才是上策。
          {cps === 0 && <span className="text-vermilion-2"> 先在「人脉」结交崔槿汐。</span>}
        </div>
      </div>
      {list.map((r) => {
        const st = s.rivals[r.id];
        const pct = Math.min(100, (st.power / r.power) * 100);
        const canChallenge = s.rank >= r.challengeRank;
        const isSel = selected === r.id;
        const gate = RANKS.find((rk) => rk.requireFallen === r.id);
        return (
          <div key={r.id} className={`row ${st.fallen ? 'done' : ''} ${isSel ? 'border-gold!' : ''}`} onClick={() => !st.fallen && select(r.id)} style={{ cursor: st.fallen ? 'default' : 'pointer' }}>
            <div className="flex items-baseline justify-between">
              <div className="text-sm tracking-widest" style={{ color: st.fallen ? '#7d7068' : r.color }}>{r.title} <span className="text-mist text-[0.66rem]">{r.name}</span></div>
              <div className="text-[0.68rem] text-gold-2">{r.perk}{gate ? ` · 晋${gate.name}必经` : ''}</div>
            </div>
            {st.fallen ? (
              <div className="tip mt-1 line-clamp-2">{r.fallText}</div>
            ) : (
              <>
                <div className="tip mt-0.5 italic">{r.quote}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="bar bar-red flex-1"><div style={{ width: `${pct}%` }} /></div>
                  <div className="text-[0.68rem] num text-paper-2">{fmt(st.power)} / {fmt(r.power)}</div>
                </div>
                {canChallenge ? (
                  <div className="flex gap-1.5 mt-1.5">
                    {[0.25, 0.5, 1].map((f) => {
                      const spend = s.scheme * f;
                      const lethal = spend * 0.85 >= st.power;
                      return (
                        <button key={f} className={`btn btn-xs flex-1 ${lethal ? 'btn-gold' : f === 1 ? 'btn-vermilion' : ''}`} disabled={spend < 1} onClick={(e) => { e.stopPropagation(); s.strike(r.id, f); }}>
                          {f === 1 ? '倾力一击' : f === 0.5 ? '出手' : '试探'} · <span className="num">{fmt(spend)}</span>{lethal ? ' ☠' : ''}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tip mt-1.5 text-vermilion-2">位分至{RANKS[r.challengeRank].name}方可对其落子</div>
                )}
              </>
            )}
          </div>
        );
      })}
      {upcoming.length > 0 && (
        <div className="tip pt-1 px-1">尚未登场：{upcoming.map((r) => `${r.name}（${RANKS[r.appearRank].name}）`).join('、')}</div>
      )}
    </>
  );
}

// ───────────────────────── 修行 ─────────────────────────
function CultivateTab() {
  useTick(500);
  const s = useGame();
  const unlocked = prestigeUnlocked(s);
  const gain = prestigeGain(s);
  const [confirm, setConfirm] = useState<'prestige' | 'era' | null>(null);
  const nextGainAt = Math.pow((gain + 1) / 5 / Math.pow(2, s.eraCount), 2) * 1e7;
  return (
    <>
      <div className="row">
        <div className="brush text-xl gold-text">甘露寺 · 出宫修行</div>
        <div className="tip mt-1 leading-relaxed">
          出宫修行会重置恩宠、银两、心计、宫人与位分，换取<span className="text-gold-2">佛心</span>。佛心每点永久 +2% 恩宠，且可在此修习永久法门。盟友、已倒台的对手、成就均会保留。
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-sm">可得佛心 <span className="num gold-text text-lg">{gain}</span></div>
          <div className="tip num">此生累计恩宠 {fmt(s.lifeFavor)} · 下一点需 {fmt(nextGainAt)}</div>
        </div>
        {!unlocked && <div className="tip mt-1 text-vermilion-2">{s.prestigeCount === 0 ? '晋至嫔位后，「纯元故衣」之事将至；或晋至妃位。' : '回宫后需再至嫔位方可再度出宫。'}</div>}
        {confirm === 'prestige' ? (
          <div className="mt-2 flex gap-2">
            <button className="btn btn-gold flex-1" onClick={() => { setConfirm(null); s.prestige(); }}>确认出宫（得 {gain} 佛心）</button>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>再想想</button>
          </div>
        ) : (
          <button className="btn btn-vermilion w-full mt-2" disabled={!unlocked || gain < 1} onClick={() => setConfirm('prestige')}>
            {unlocked ? (gain < 1 ? '恩宠尚浅，佛心未生' : '自请出宫') : '尚未解锁'}
          </button>
        )}
      </div>

      <SectionTitle>法门 · 佛心 {s.enlightenment}</SectionTitle>
      {MEDITATIONS.map((m) => {
        const lvl = medLvl(s, m.id);
        const maxed = lvl >= m.max;
        const cost = maxed ? 0 : m.cost(lvl);
        const can = !maxed && s.enlightenment >= cost;
        return (
          <div key={m.id} className={`row ${maxed ? 'done' : ''}`}>
            <div className="flex items-baseline justify-between">
              <div className="text-sm tracking-widest">{m.name} <span className="text-mist text-[0.66rem] num">{lvl}/{m.max}</span></div>
              <div className="text-[0.68rem] text-gold-2">{m.effect(Math.max(1, lvl))}{lvl > 0 && !maxed ? ` → ${m.effect(lvl + 1)}` : ''}</div>
            </div>
            <div className="tip mt-0.5">{m.desc}</div>
            <button className={`btn btn-xs w-full mt-1.5 ${can ? 'btn-gold' : ''}`} disabled={!can} onClick={() => s.buyMeditation(m.id)}>
              {maxed ? '圆满' : <>修习 · <span className="num">{cost} 佛心</span></>}
            </button>
          </div>
        );
      })}

      <SectionTitle>新朝 · 凤印传承</SectionTitle>
      <div className="row">
        <div className="tip leading-relaxed">登上太后之位后，可开启新朝。<span className="text-vermilion-2">一切归零</span>（含佛心、法门、盟友与对手），换取永久凤印：恩宠 ×3、银两与心计 ×2、佛心获得 ×2，逐世叠加。当前凤印 {s.eraCount}。</div>
        {confirm === 'era' ? (
          <div className="mt-2 flex gap-2">
            <button className="btn btn-gold flex-1" onClick={() => { setConfirm(null); s.newEra(); }}>确认开启新朝</button>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>再想想</button>
          </div>
        ) : (
          <button className="btn w-full mt-2" disabled={s.rank < MAX_RANK} onClick={() => setConfirm('era')}>{s.rank < MAX_RANK ? `需位至${RANKS[MAX_RANK].name}` : '新帝登基 · 开启新朝'}</button>
        )}
      </div>
    </>
  );
}

// ───────────────────────── 宫史 ─────────────────────────
function AnnalsTab() {
  useTick(1000);
  const s = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const played = (Date.now() - s.startedAt) / 1000;
  return (
    <>
      <SectionTitle>起居注</SectionTitle>
      <div className="row max-h-64 overflow-y-auto space-y-1.5">
        {s.log.length === 0 && <div className="tip">尚无记载。</div>}
        {s.log.map((l) => (
          <div key={l.id} className="text-[0.72rem] leading-relaxed flex gap-2">
            <span className="text-mist shrink-0 num">第{l.day}日</span>
            <span style={{ color: l.kind === 'gold' ? '#f0d48a' : l.kind === 'bad' ? '#e8837a' : l.kind === 'good' ? '#bfe0c8' : '#d9c9a8' }}>{l.text}</span>
          </div>
        ))}
      </div>
      <SectionTitle>成就 · {s.achievements.length}/{ACHIEVEMENTS.length}（各 +3% 恩宠）</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5">
        {ACHIEVEMENTS.map((a) => {
          const got = s.achievements.includes(a.id);
          return (
            <div key={a.id} className={`row ${got ? 'done' : 'locked'}`}>
              <div className="text-xs tracking-widest" style={{ color: got ? '#f0d48a' : '#8a7d6e' }}>{a.name}</div>
              <div className="tip">{a.desc}</div>
            </div>
          );
        })}
      </div>
      <SectionTitle>统计</SectionTitle>
      <div className="row grid grid-cols-2 gap-x-4 gap-y-1 text-[0.72rem]">
        <span className="text-mist">累计恩宠</span><span className="num text-right">{fmt(s.totalFavor)}</span>
        <span className="text-mist">每秒恩宠</span><span className="num text-right">{fmtRate(favorPerSec(s))}</span>
        <span className="text-mist">请安次数</span><span className="num text-right">{s.clicks}</span>
        <span className="text-mist">侍寝次数</span><span className="num text-right">{s.beddings}</span>
        <span className="text-mist">出宫次数</span><span className="num text-right">{s.prestigeCount}</span>
        <span className="text-mist">在宫时长</span><span className="num text-right">{fmtTime(played)}</span>
      </div>
      <SectionTitle>设置</SectionTitle>
      <div className="row flex items-center gap-1.5 flex-wrap">
        <SettingsButtons />
        <span className="tip ml-auto">空格键亦可请安 · 拖动旋转镜头 · 滚轮缩放</span>
      </div>
      <div className="row flex items-center justify-between">
        <div className="tip">存档自动写入本地，每 10 秒一次。</div>
        <div className="flex gap-1.5">
          <button className="btn btn-xs btn-ghost" onClick={s.save}>立即存档</button>
          {confirmReset ? (
            <>
              <button className="btn btn-xs btn-vermilion" onClick={() => { setConfirmReset(false); s.hardReset(); }}>确认清档</button>
              <button className="btn btn-xs btn-ghost" onClick={() => setConfirmReset(false)}>取消</button>
            </>
          ) : (
            <button className="btn btn-xs btn-ghost" onClick={() => setConfirmReset(true)}>清空存档</button>
          )}
        </div>
      </div>
    </>
  );
}
