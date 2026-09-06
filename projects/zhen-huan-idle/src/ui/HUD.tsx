import { useEffect, useRef, useState } from 'react';
import { useGame, favorPerSec, silverPerSec, schemePerSec, clickPower, canPromote, flipChance, bribeCost, playerTitle, playerName, isBuffed, buffMult, rivalActive } from '../game/store';
import { RANKS, MAX_RANK, SHICHEN, FLIP_TIME, DAY_LENGTH, RIVAL_MAP, RIVALS } from '../game/data';
import { fmt, fmtRate, cnNum } from '../game/format';
import { useUI } from './uiStore';

// 以固定频率刷新，避免对每次 tick 的 store 变更做全量订阅
function useNow(ms = 500) {
  const [, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

function Resource({ label, value, rate, accent }: { label: string; value: number; rate?: string; accent?: string }) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (value > prev.current * 1.08 + 1) setPulse((p) => p + 1);
    prev.current = value;
  }, [value]);
  return (
    <div className="res">
      <span className="res-label">{label}</span>
      <span key={pulse} className={`res-value num ${pulse ? 'pulse-gold' : ''}`} style={{ color: accent }}>{fmt(value)}</span>
      {rate !== undefined && <span className="res-rate num">{rate}</span>}
    </div>
  );
}

export function TopBar() {
  useNow(400);
  const s = useGame();
  const fps = favorPerSec(s);
  const sps = silverPerSec(s);
  const cps = schemePerSec(s);
  const hour = SHICHEN[Math.floor(s.dayTime * 12) % 12];
  const buffed = isBuffed(s);
  const pc = useGame((st) => st.prestigeCount);
  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="lacquer mx-3 mt-3 px-5 py-2.5 flex items-center gap-6 pointer-events-auto">
        <div className="flex items-baseline gap-3 pr-4 border-r hairline">
          <span className="brush text-2xl gold-text">甄嬛传</span>
          <span className="text-[0.66rem] tracking-[0.35em] text-mist">六宫 · 增量</span>
        </div>
        <Resource label="恩宠" value={s.favor} rate={`${fmtRate(fps)}/秒${buffed ? ` · 承恩×${buffMult(s)}` : ''}`} accent={buffed ? '#ffe08a' : undefined} />
        <Resource label="银两" value={s.silver} rate={`${fmtRate(sps)}/秒`} />
        <Resource label="心计" value={s.scheme} rate={cps > 0 ? `${fmtRate(cps)}/秒` : '需结交槿汐'} />
        {(s.totalEnlightenment > 0 || pc > 0) && <Resource label="佛心" value={s.enlightenment} rate={`累计 ${s.totalEnlightenment}`} accent="#c9b5e8" />}
        {s.eraCount > 0 && <Resource label="凤印" value={s.eraCount} rate={`恩宠 ×${Math.pow(3, s.eraCount)}`} accent="#f0d48a" />}
        <div className="flex-1" />
        <div className="text-right leading-tight">
          <div className="text-sm tracking-[0.2em]">{s.eraCount > 0 ? `新朝第${cnNum(s.eraCount + 1)}世 · ` : '雍正 · '}第 {s.day} 日</div>
          <div className="text-[0.7rem] text-mist tracking-widest">
            {hour}时 · {s.flipDoneToday ? '已翻牌' : `距翻牌 ${Math.max(0, Math.ceil((FLIP_TIME - s.dayTime) * DAY_LENGTH))} 秒`}
          </div>
        </div>
        <DayDial t={s.dayTime} />
        <div className="hidden xl:flex gap-1.5 pl-3 border-l hairline">
          <SettingsButtons />
        </div>
      </div>
    </div>
  );
}

export function SettingsButtons() {
  const settings = useGame((st) => st.settings);
  const toggleMute = useGame((st) => st.toggleMute);
  const setQuality = useGame((st) => st.setQuality);
  const toggleRotate = useGame((st) => st.toggleRotate);
  return (
    <>
      <button className="btn btn-ghost btn-xs" title="音效开关" onClick={toggleMute}>{settings.muted ? '静音中' : '音效开'}</button>
      <button className="btn btn-ghost btn-xs" title="切换画质（低画质关闭阴影与抗锯齿）" onClick={() => setQuality(settings.quality === 'high' ? 'low' : 'high')}>{settings.quality === 'high' ? '高画质' : '低画质'}</button>
      <button className="btn btn-ghost btn-xs" title="镜头自动环绕" onClick={toggleRotate}>{settings.autoRotate ? '环绕中' : '定镜'}</button>
    </>
  );
}

function DayDial({ t }: { t: number }) {
  const ang = t * 360;
  const night = Math.cos(t * Math.PI * 2) > 0.1;
  return (
    <div className="relative w-11 h-11 rounded-full border hairline flex items-center justify-center" style={{ background: night ? 'radial-gradient(circle, #1b2140, #0a0d1c)' : 'radial-gradient(circle, #ffe9b0, #c9774a)' }}>
      <div className="absolute inset-0" style={{ transform: `rotate(${ang}deg)` }}>
        <div className="absolute left-1/2 top-0.5 w-1.5 h-1.5 -ml-[3px] rounded-full bg-gold-2 shadow-[0_0_6px_#f0d48a]" />
      </div>
      <span className="text-[0.6rem] tracking-widest" style={{ color: night ? '#c9d3f0' : '#4a2a10' }}>{night ? '夜' : '昼'}</span>
    </div>
  );
}

function nextGoal(s: ReturnType<typeof useGame.getState>): string {
  const owned = Object.values(s.producers).reduce((a, b) => a + b, 0);
  if (owned === 0) return '攒够 15 恩宠，置办第一位宫女，让恩宠自己生长。';
  if (s.rank === 0 && s.favor < 120) return '攒够 120 恩宠，便可晋为答应。';
  if (!s.allies.includes('jinxi')) return `结交崔槿汐（80 银两）才能开始积攒心计——宫斗离不开她。`;
  if (s.rank >= 2 && !s.rivals.xiadongchun.fallen) return '攒够约 45 心计，一击扳倒夏冬春，方可晋贵人。';
  if (s.rank >= 3 && s.rank < 5 && !s.rivals.huafei.fallen) return `华妃势力 ${fmt(s.rivals.huafei.power)}。想晋妃位，必须先让翊坤宫的欢宜香熄灭。`;
  if (s.rank >= 4 && s.prestigeCount === 0 && s.enlightenment === 0) return '嫔位之上风波渐起。「修行」一页里，甘露寺的门已半开。';
  if (s.rank >= 7 && !s.rivals.huanghou.fallen) return `皇后势力 ${fmt(s.rivals.huanghou.power)}。景仁宫不倒，太后之位无从谈起。`;
  if (s.rank < MAX_RANK) return `距晋${RANKS[s.rank + 1].name}还差 ${fmt(Math.max(0, RANKS[s.rank + 1].cost - s.favor))} 恩宠。`;
  return '已至极位。开启新朝，或继续积攒佛心。';
}

export function LeftPanel() {
  useNow(250);
  const s = useGame();
  const rank = RANKS[s.rank];
  const promo = canPromote(s);
  const next = s.rank < MAX_RANK ? RANKS[s.rank + 1] : null;
  const chance = flipChance(s);
  const bribe = bribeCost(s);
  const cp = clickPower(s);
  const comboPct = (s.combo / 30) * 100;
  const [pressed, setPressed] = useState(false);
  const setTab = useUI((u) => u.setTab);
  const activeRivals = RIVALS.filter((r) => rivalActive(s, r.id));

  const doClick = () => {
    s.click();
    setPressed(true);
    setTimeout(() => setPressed(false), 80);
  };

  return (
    <div className="absolute left-3 top-[5.2rem] bottom-3 z-20 w-[19rem] flex flex-col gap-3 pointer-events-none">
      <div className={`lacquer p-4 pointer-events-auto ${isBuffed(s) ? 'buff-glow' : ''}`}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[0.66rem] tracking-[0.3em] text-mist">{playerName(s)} · {rank.palace}</div>
            <div className="brush text-3xl gold-text mt-0.5">{playerTitle(s)}</div>
          </div>
          <div className="text-right text-[0.68rem] text-mist leading-relaxed">
            <div>位分 {cnNum(s.rank + 1)} / {cnNum(MAX_RANK + 1)}</div>
            <div>产出 ×{Math.pow(1.5, s.rank).toFixed(1)}</div>
          </div>
        </div>

        <button className={`seal-btn mt-4 ${pressed ? 'scale-[0.97]' : ''}`} onClick={doClick}>
          <div className="brush">请安</div>
          <div className="text-[0.7rem] tracking-[0.3em] mt-1.5 opacity-90 num">+{fmt(cp)} 恩宠</div>
        </button>
        <div className="mt-2.5">
          <div className="flex justify-between text-[0.66rem] text-mist tracking-widest mb-1">
            <span>殷勤连击</span><span className="num">{s.combo} / 30</span>
          </div>
          <div className="bar bar-gold"><div style={{ width: `${comboPct}%`, transition: 'width 0.1s' }} /></div>
          <div className="tip mt-1">连续请安至圆满可触发「圣心大悦」。点击 3D 宫殿或按空格亦可请安。</div>
        </div>
        <div className="mt-3 pt-2.5 border-t hairline">
          <div className="text-[0.62rem] tracking-[0.35em] text-gold">眼下要紧</div>
          <div className="text-[0.76rem] leading-relaxed text-paper-2 mt-0.5">{nextGoal(s)}</div>
        </div>
      </div>

      <div className="lacquer p-4 pointer-events-auto">
        <div className="flex items-baseline justify-between">
          <div className="text-[0.66rem] tracking-[0.3em] text-mist">今夜翻牌</div>
          <div className="text-[0.66rem] text-mist">{s.flipDoneToday ? (s.lastFlip?.winner === 'player' ? <span className="gold-text">皇上宿在你宫中</span> : `皇上宿在${RIVAL_MAP[s.lastFlip?.winner ?? '']?.title ?? ''}处`) : `${activeRivals.length} 位对手在册`}</div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="text-2xl num gold-text">{(chance * 100).toFixed(0)}<span className="text-sm">%</span></div>
          <div className="flex-1">
            <div className="bar"><div style={{ width: `${chance * 100}%` }} /></div>
            <div className="tip mt-1">被翻牌可得 90 秒产出、赏银与承恩 ×{buffMult(s)}</div>
          </div>
        </div>
        <button className="btn w-full mt-2.5" disabled={s.bribedTonight || s.flipDoneToday || s.silver < bribe} onClick={s.bribe}>
          {s.bribedTonight ? '今夜已打点敬事房' : <>打点敬事房 · 权重 ×2.2 <span className="num opacity-80">（{fmt(bribe)} 银）</span></>}
        </button>
      </div>

      <div className="lacquer p-4 pointer-events-auto">
        {next ? (
          <>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.66rem] tracking-[0.3em] text-mist">晋封</div>
              <div className="text-sm">{next.name} · {next.titles[s.prestigeCount > 0 ? 1 : 0]}</div>
            </div>
            <div className="bar mt-2"><div style={{ width: `${Math.min(100, (s.favor / next.cost) * 100)}%` }} /></div>
            <div className="flex justify-between tip mt-1">
              <span className="num">{fmt(s.favor)} / {fmt(next.cost)}</span>
              {next.requireFallen && !s.rivals[next.requireFallen].fallen && (
                <button className="text-vermilion-2 underline underline-offset-2" onClick={() => setTab('intrigue')}>需扳倒{RIVAL_MAP[next.requireFallen].name}</button>
              )}
            </div>
            <button className="btn btn-gold w-full mt-2.5" disabled={!promo.ok} onClick={s.promote}>
              {promo.ok ? `接旨 · 晋封${next.name}` : promo.reason}
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="brush text-xl gold-text">圣母皇太后</div>
            <div className="tip mt-1">已至极位。可在「修行」开启新朝。</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Banner() {
  const banner = useGame((s) => s.banner);
  const clear = useGame((s) => s.clearBanner);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => clear(banner.id), 4300);
    return () => clearTimeout(t);
  }, [banner, clear]);
  if (!banner) return null;
  const color = banner.kind === 'gold' ? '#f0d48a' : banner.kind === 'red' ? '#e8837a' : '#d9e6d8';
  return (
    <div key={banner.id} className="banner">
      <div className="lacquer px-8 py-3 text-center min-w-[22rem]">
        <div className="brush text-2xl" style={{ color }}>{banner.title}</div>
        <div className="text-xs tracking-widest text-paper-2 mt-1">{banner.text}</div>
      </div>
    </div>
  );
}
