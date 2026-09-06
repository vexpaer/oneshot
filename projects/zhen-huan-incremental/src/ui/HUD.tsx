import { useEffect, useRef, useState } from 'react';
import { useGame, actions, rankTitle, isRivalActive } from '@/game/engine';
import { RANKS, RIVALS } from '@/game/data';
import { fmt, fmtRate, pct } from '@/game/format';
import { useUI } from './uiStore';

function useTick(value: number) {
  const [k, setK] = useState(0);
  const prev = useRef(value);
  useEffect(() => { if (value !== prev.current) { prev.current = value; setK(x => x + 1); } }, [value]);
  return k;
}

export function TopBar() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const rank = RANKS[s.rank];
  const title = rankTitle(s);
  const rankKey = useTick(s.rank);
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-3 md:px-6">
      {/* 左：游戏名 */}
      <div className="hidden md:block">
        <div className="title-brush text-2xl leading-none text-gold-2" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>紫禁春秋</div>
        <div className="mt-1 text-[10px] tracking-[0.35em] text-paper-2/80">甄嬛传 · 增量</div>
      </div>
      {/* 中：位分 */}
      <div key={rankKey} className="rise-in flex flex-col items-center text-center">
        <div className="text-[10px] tracking-[0.5em] text-gold/80">{d.returned ? '钮祜禄氏' : '甄氏'} · {rank.palace}</div>
        <div className="title-brush shimmer-text mt-0.5 text-3xl leading-none md:text-4xl">{title}</div>
        <div className="mt-1 text-[11px] italic text-paper-2/70">「{rank.desc}」</div>
      </div>
      {/* 右：资源 */}
      <div className="pointer-events-auto flex flex-col items-end gap-1">
        <Resource label="恩宠" value={s.favor} rate={d.fps} color="text-gold-2" />
        {s.rank >= 2 && <Resource label="心机" value={s.scheming} rate={d.sps} color="text-jade" />}
        {s.prestige.count > 0 && <div className="flex items-baseline gap-2 text-xs text-paper-2"><span className="tracking-widest">道行</span><span className="num text-base text-paper">{s.prestige.dao}</span></div>}
      </div>
    </div>
  );
}

function Hint() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const totalProducers = Object.values(s.producers).reduce((a, b) => a + b, 0);
  let text: string | null = null;
  if (s.suspicion >= 70) text = '嫌疑逼近顶点。暂缓用计，等它消散——或去结交温实初。';
  else if (s.rank === 0) text = '点击「请安」或宫殿积攒恩宠。攒够 60，便可晋封答应。';
  else if (totalProducers === 0) text = '在右侧「宫务」打点宫女与太监，他们会替你持续积攒恩宠。';
  else if (s.rank === 1 && s.upgrades.length === 0) text = '「宫务」下方的「机缘」是一次性的强力加成，别忘了留意。';
  else if (s.rank === 2 && s.stats.schemes === 0) text = '你已是常在，心机开始积累。去「计谋」页——或直接点击 3D 场景中的对手宫殿。';
  else if (s.rank === 3 && d.rankNext && !d.rankNext.ok && d.share < 0.15) text = '晋嫔需圣心 15%。削弱夏冬春、余莺儿或华妃，你的份额便会上升。';
  else if (s.rank >= 3 && Object.keys(s.allies).filter(k => s.allies[k] > 0).length < 2) text = '「人脉」页的盟友会改变局势：眉庄加恩宠，温实初消嫌疑，槿汐生心机。';
  else if (s.rank === 5 && s.prestige.count === 0) text = '甘露寺已开。在「修行」页出宫可换取道行；回宫后方能晋封贵妃及以上。';
  else if (s.rank >= 6 && s.prestige.count > 0 && !s.rivals.qi?.defeated && d.rankNext && !d.rankNext.ok) text = '祺贵人握着滴血验亲。温实初 Lv3 后，可以反制。';
  if (!text) return null;
  return <div className="border-l-2 border-gold/60 bg-lacquer-2/80 px-3 py-2 text-[11.5px] leading-snug text-paper-2">{text}</div>;
}

function Resource({ label, value, rate, color }: { label: string; value: number; rate: number; color: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] tracking-[0.3em] text-paper-2/80">{label}</span>
      <span className={`num text-xl font-semibold leading-none md:text-2xl ${color}`} style={{ textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>{fmt(value)}</span>
      <span className="num text-[11px] text-paper-2/70">+{fmtRate(rate)}/秒</span>
    </div>
  );
}

export function HeartBar() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const select = useUI(u => u.selectRival);
  const total = d.myPower + d.rivalPower;
  const rivals = RIVALS.filter(r => isRivalActive(s, r.id) && !s.rivals[r.id].defeated);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[86px] z-20 w-[min(560px,60vw)] -translate-x-1/2 md:top-[92px]">
      <div className="mb-1 flex items-end justify-between text-[10px] tracking-[0.3em] text-paper-2/80">
        <span>圣 心</span>
        <span className="num text-gold-2">你 {pct(d.share, 1)} <span className="text-paper-2/60">· 恩宠 ×{(1 + 2 * d.share).toFixed(2)}</span></span>
      </div>
      <div className="flex h-[10px] w-full overflow-hidden border border-gold/40 bg-black/60 shadow-[0_0_20px_-4px_rgba(212,168,75,0.4)]">
        <div className="h-full transition-all duration-500" style={{ width: pct(d.myPower / total, 2), background: 'linear-gradient(90deg,#8a6b2a,#d4a84b,#efd9a0)', boxShadow: '0 0 10px #d4a84b' }} title="你" />
        {rivals.map(r => (
          <div key={r.id} onClick={() => select(r.id)} className="h-full cursor-pointer opacity-80 transition-all duration-500 hover:opacity-100" style={{ width: pct(s.rivals[r.id].power / total, 2), background: r.color }} title={`${r.title}${r.name} ${pct(s.rivals[r.id].power / total, 1)}`} />
        ))}
      </div>
    </div>
  );
}

export function LeftPanel() {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const [pressed, setPressed] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const next = s.rank < RANKS.length - 1 ? RANKS[s.rank + 1] : null;
  const progress = next ? Math.min(1, s.favor / next.cost) : 1;

  const onClick = (e: React.MouseEvent) => {
    const v = actions.click();
    window.dispatchEvent(new CustomEvent('favor-float', { detail: { x: e.clientX, y: e.clientY, v } }));
    setPressed(true); setTimeout(() => setPressed(false), 90);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        const r = btn.current?.getBoundingClientRect();
        const v = actions.click();
        window.dispatchEvent(new CustomEvent('favor-float', { detail: { x: (r?.left || 0) + (r?.width || 0) / 2, y: (r?.top || 0), v } }));
        setPressed(true); setTimeout(() => setPressed(false), 90);
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const buffs = Object.entries(s.buffs).filter(([, v]) => v > 0);
  const susp = s.suspicion;
  const suspColor = susp > 75 ? '#ff6a55' : susp > 45 ? '#d4a84b' : '#6fa39a';

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-3 md:w-[300px]">
      {/* 请安 */}
      <div className="panel p-4">
        <button ref={btn} onClick={onClick}
          className={`btn btn-seal relative h-[86px] w-full overflow-hidden text-lg tracking-[0.5em] transition-transform ${pressed ? 'scale-[0.97]' : ''}`}>
          <span className="title-brush text-3xl">请 安</span>
          <span className="absolute bottom-1.5 right-2 text-[10px] tracking-normal opacity-80">空格</span>
        </button>
        <div className="mt-2 flex items-center justify-between text-xs text-paper-2">
          <span>每次 <span className="num text-gold-2">+{fmt(d.click)}</span> 恩宠</span>
          {d.autoClick > 0 && <span className="text-jade">槿汐代为请安 {d.autoClick}/秒</span>}
        </div>
        <div className="mt-1 text-[11px] text-paper-2/60">也可直接点击 3D 场景中的宫殿</div>
      </div>

      {/* 晋封 */}
      {next && (
        <div className={`panel p-4 ${d.rankNext?.ok ? 'glow' : ''}`}>
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] tracking-[0.4em] text-gold/80">晋 封</div>
            <div className="text-xs text-paper-2">{RANKS[s.rank].name} → <span className="text-gold-2">{next.name}</span></div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="num text-sm text-paper">{fmt(Math.min(s.favor, next.cost))} <span className="text-paper-2/60">/ {fmt(next.cost)}</span></span>
            <span className="num text-xs text-paper-2">{pct(progress)}</span>
          </div>
          <div className="bar mt-1"><i style={{ width: pct(progress) }} /></div>
          {next.share > 0 && (
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-paper-2/80">圣心需 ≥ {pct(next.share)}</span>
              <span className={`num ${d.share >= next.share ? 'text-jade' : 'text-blood'}`}>{pct(d.share, 1)}</span>
            </div>
          )}
          {d.rankNext && d.rankNext.reasons.filter(r => r !== '恩宠不足' && !r.startsWith('圣心')).map(r => (
            <div key={r} className="mt-1 text-[11px] text-blood/90">· {r}</div>
          ))}
          <button className="btn btn-gold mt-3 w-full tracking-[0.3em]" disabled={!d.rankNext?.ok} onClick={actions.rankUp}>
            晋封为{d.returned && s.rank + 1 <= 5 ? '熹' + next.name : next.title}
          </button>
        </div>
      )}
      {!next && (
        <div className="panel p-4 text-center">
          <div className="title-brush text-2xl text-gold-2">圣母皇太后</div>
          <div className="mt-1 text-xs text-paper-2">这紫禁城的风，终于停了。</div>
          <div className="mt-2 text-[11px] text-paper-2/70">游戏时长 {Math.floor(s.stats.playtime / 60)} 分 · 轮回 {s.prestige.count} 次 · 道行 {s.prestige.totalDao}</div>
        </div>
      )}

      {/* 嫌疑 */}
      {s.rank >= 2 && (
        <div className="panel p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.4em] text-gold/80">嫌 疑</span>
            <span className={`num text-xs ${susp > 75 ? 'pulse-red' : ''}`} style={{ color: suspColor }}>{susp.toFixed(0)} / 100</span>
          </div>
          <div className="bar blood mt-1.5"><i style={{ width: pct(susp / 100) }} /></div>
          <div className="mt-1.5 flex justify-between text-[10px] text-paper-2/70">
            <span>消散 {(d.decayRate * 60).toFixed(1)}/分{d.suspicionGen > 0 ? ` · 果郡王 +${(d.suspicionGen * 60).toFixed(1)}/分` : ''}</span>
            <span>满则事发：降位、恩宠折半</span>
          </div>
        </div>
      )}

      <Hint />

      {buffs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {buffs.map(([k, v]) => (
            <div key={k} className="border border-gold/50 bg-lacquer-2/90 px-2 py-1 text-[11px] text-gold-2">
              {k === 'jinghong' ? '惊鸿舞 · 恩宠 ×3' : '六宫称颂 · 势力 ×1.5'} <span className="num text-paper-2">{Math.ceil(v)}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
