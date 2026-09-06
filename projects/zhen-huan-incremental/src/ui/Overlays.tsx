import { forwardRef, useEffect, useState } from 'react';
import { useGame, actions, choiceAvailable, isRivalActive, rankTitle } from '@/game/engine';
import { EVENTS, RIVALS } from '@/game/data';
import { fmt, fmtTime, pct } from '@/game/format';
import { useUI } from './uiStore';

// ── 开场 ───────────────────────────────────────────────
export function Intro() {
  const intro = useGame(s => s.s.intro);
  const [leaving, setLeaving] = useState(false);
  if (!intro) return null;
  return (
    <div className={`absolute inset-0 z-50 flex items-center justify-center bg-lacquer/70 backdrop-blur-[2px] transition-opacity duration-700 ${leaving ? 'opacity-0' : 'opacity-100'}`}>
      <div className="rise-in mx-4 flex max-w-[560px] flex-col items-center text-center">
        <div className="text-[11px] tracking-[0.6em] text-gold/80">雍 正 元 年</div>
        <h1 className="title-brush shimmer-text mt-3 text-7xl leading-none md:text-8xl">紫禁春秋</h1>
        <div className="mt-3 text-xs tracking-[0.5em] text-paper-2">甄嬛传 · 增量游戏</div>
        <div className="hairline my-6 w-64" />
        <p className="text-[13px] leading-loose text-paper/90">
          你是甄嬛，殿选之日的一名秀女。<br />
          这座紫禁城里，皇上的<span className="text-gold-2">圣心</span>只有一颗，六宫都在分它。<br />
          以<span className="text-gold-2">恩宠</span>晋位，以<span className="text-jade">心机</span>破局，在<span className="text-blood">嫌疑</span>满盈之前，站到最高处。<br />
          若走投无路——甘露寺的门永远为你敞开，而回来的人，将不再是从前的你。
        </p>
        <button className="btn btn-seal mt-8 px-10 py-3 text-base tracking-[0.5em]" onClick={() => { setLeaving(true); setTimeout(actions.finishIntro, 600); }}>
          <span className="title-brush text-2xl">入 宫</span>
        </button>
        <div className="mt-4 text-[10px] text-paper-2/50">拖动旋转视角 · 滚轮缩放 · 空格请安 · 进度自动保存于本机</div>
      </div>
    </div>
  );
}

// ── 仪式（圣旨） ────────────────────────────────────────
export function CeremonyOverlay() {
  const c = useGame(s => s.s.ceremony);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(false); if (c) { const t = setTimeout(() => setReady(true), 900 + c.lines.length * 500); return () => clearTimeout(t); } }, [c]);
  if (!c) return null;
  const accent = c.kind === 'rank' ? '#d4a84b' : c.kind === 'exposed' ? '#c8382c' : c.kind === 'return' ? '#8a6b2a' : c.accent || '#d4a84b';
  const bg = c.kind === 'exposed' ? 'rgba(60,8,6,0.75)' : 'rgba(8,5,4,0.78)';
  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center" style={{ background: bg }} onClick={() => ready && actions.dismissCeremony()}>
      {c.kind === 'rank' && <div className="flash absolute inset-0 bg-gold-2/40" />}
      <div className="unroll relative mx-4 w-full max-w-[720px]" onClick={e => e.stopPropagation()}>
        <div className="absolute -left-3 top-0 h-full w-3 rounded-l-sm" style={{ background: `linear-gradient(90deg, #3a2618, ${accent})` }} />
        <div className="absolute -right-3 top-0 h-full w-3 rounded-r-sm" style={{ background: `linear-gradient(270deg, #3a2618, ${accent})` }} />
        <div className="paper relative px-10 py-8 md:px-14 md:py-10" style={{ background: c.kind === 'exposed' ? 'linear-gradient(180deg,#e8d6c0,#d9c2a4)' : undefined }}>
          <div className="pointer-events-none absolute inset-2 border" style={{ borderColor: accent + '66' }} />
          <div className="text-center text-[11px] tracking-[0.6em]" style={{ color: accent }}>
            {c.kind === 'rank' ? '奉 天 承 运 · 皇 帝 诏 曰' : c.kind === 'defeat' ? '六 宫 传 报' : c.kind === 'return' ? '凤 鸾 春 恩' : c.kind === 'exposed' ? '御 前 震 怒' : '记'}
          </div>
          <div className="title-brush mt-3 text-center text-4xl md:text-5xl" style={{ color: c.kind === 'exposed' ? '#8e2018' : '#2a1c18' }}>{c.title}</div>
          {c.sub && <div className="mt-1 text-center text-xs tracking-[0.3em] opacity-70">{c.sub}</div>}
          <div className="hairline my-5" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
          <div className="flex flex-col gap-2 text-center text-[14px] leading-relaxed md:text-[15px]">
            {c.lines.map((l, i) => <div key={i} className="line-in" style={{ animationDelay: `${600 + i * 500}ms` }}>{l}</div>)}
          </div>
          <div className="mt-7 flex justify-center">
            <button className={`btn btn-seal px-8 tracking-[0.5em] transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} onClick={actions.dismissCeremony}>
              {c.kind === 'rank' ? '领 旨' : c.kind === 'exposed' ? '叩 首' : '知 道 了'}
            </button>
          </div>
          <div className="seal absolute bottom-5 right-6 text-lg">{c.kind === 'exposed' ? '罚' : c.kind === 'return' ? '归' : '御'}</div>
        </div>
      </div>
    </div>
  );
}

// ── 事件（奏折） ─────────────────────────────────────────
export function EventModal() {
  const id = useGame(s => s.s.activeEvent);
  const s = useGame(st => st.s);
  const ceremony = useGame(st => st.s.ceremony);
  const e = EVENTS.find(x => x.id === id);
  if (!e || ceremony) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center pb-[120px] md:items-center md:pb-0">
      <div className="paper rise-in pointer-events-auto relative mx-4 w-full max-w-[520px] p-6">
        <div className="absolute inset-1.5 border border-vermilion/30" />
        <div className="flex items-baseline justify-between">
          <div className="title-brush text-3xl text-vermilion">{e.title}</div>
          {e.speaker && <div className="text-[11px] tracking-[0.3em] opacity-60">{e.speaker}</div>}
        </div>
        <div className="mt-3 text-[13.5px] leading-loose">{e.text}</div>
        <div className="mt-5 flex flex-col gap-2">
          {e.choices.map((ch, i) => {
            const ok = choiceAvailable(s, ch.effect);
            return (
              <button key={i} disabled={!ok} onClick={() => actions.chooseEvent(i)}
                className="group flex w-full items-center justify-between border border-vermilion/40 bg-white/30 px-4 py-2.5 text-left transition-all hover:border-vermilion hover:bg-vermilion/10 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]">
                <span className="text-[13.5px] text-lacquer-3">{ch.label}</span>
                <span className="ml-3 flex-none text-[10.5px] text-vermilion/80">{ch.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 离线报告 ────────────────────────────────────────────
export function OfflineModal() {
  const r = useGame(s => s.s.offlineReport);
  const intro = useGame(s => s.s.intro);
  if (!r || intro) return null;
  return (
    <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-lacquer/60" onClick={actions.dismissOffline}>
      <div className="paper rise-in relative mx-4 w-full max-w-[420px] p-6 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-[11px] tracking-[0.5em] opacity-60">离 宫 归 来</div>
        <div className="title-brush mt-2 text-3xl">你离开了 {fmtTime(r.seconds)}</div>
        <div className="mt-3 text-[13px] leading-relaxed">宫人们照旧当差。槿汐替你收着账。</div>
        <div className="mt-4 flex justify-center gap-8">
          <div><div className="num text-2xl font-semibold text-vermilion">+{fmt(r.favor)}</div><div className="text-[11px] opacity-70">恩宠</div></div>
          {r.scheming > 0 && <div><div className="num text-2xl font-semibold text-jade-2">+{fmt(r.scheming)}</div><div className="text-[11px] opacity-70">心机</div></div>}
        </div>
        <button className="btn btn-seal mt-5 px-8 tracking-[0.4em]" onClick={actions.dismissOffline}>收 下</button>
      </div>
    </div>
  );
}

// ── 浮动数字 ────────────────────────────────────────────
export function FloatingNumbers() {
  const [items, setItems] = useState<{ id: number; x: number; y: number; v: number }[]>([]);
  useEffect(() => {
    let n = 0;
    const h = (e: Event) => {
      const { x, y, v } = (e as CustomEvent).detail;
      const id = ++n;
      setItems(list => [...list.slice(-14), { id, x: x + (Math.random() - 0.5) * 30, y: y - 10, v }]);
      setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 1100);
    };
    window.addEventListener('favor-float', h); return () => window.removeEventListener('favor-float', h);
  }, []);
  return <>{items.map(i => <div key={i.id} className="float-num" style={{ left: i.x, top: i.y }}>+{fmt(i.v)}</div>)}</>;
}

// ── 记事 ────────────────────────────────────────────────
export function LogTicker() {
  const log = useGame(s => s.s.log);
  const last = log.slice(-4).reverse();
  return (
    <div className="pointer-events-none flex flex-col gap-1">
      {last.map((l, i) => (
        <div key={l.id} className={`${i === 0 ? 'rise-in' : ''} max-w-[520px] text-[11.5px] leading-snug`}
          style={{ opacity: 1 - i * 0.22, color: l.kind === 'story' ? '#efd9a0' : l.kind === 'good' ? '#bfe0da' : l.kind === 'bad' ? '#ff9a8a' : '#cbbba0', textShadow: '0 1px 6px rgba(0,0,0,0.95)' }}>
          {l.kind === 'story' ? '◆ ' : '· '}{l.text}
        </div>
      ))}
    </div>
  );
}

// ── 3D 标签 ─────────────────────────────────────────────
export const SceneLabels = forwardRef<HTMLDivElement>(function SceneLabels(_, ref) {
  const s = useGame(st => st.s);
  const d = useGame(st => st.d);
  const hover = useUI(u => u.hover);
  const selected = useUI(u => u.selectedRival);
  const total = d.myPower + d.rivalPower;
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div data-anchor="main" className="absolute left-0 top-0 flex flex-col items-center whitespace-nowrap transition-opacity" style={{ willChange: 'transform' }}>
        <div className={`title-brush text-xl text-gold-2 transition-transform ${hover === 'main' ? 'scale-110' : ''}`} style={{ textShadow: '0 0 14px rgba(212,168,75,0.8), 0 2px 4px #000' }}>{rankTitle(s)}</div>
        <div className="text-[10px] tracking-[0.3em] text-paper-2/80" style={{ textShadow: '0 1px 4px #000' }}>{hover === 'main' ? '点击请安' : pct(d.share, 1)}</div>
        <div className="mt-1 h-3 w-px bg-gold/60" />
      </div>
      {RIVALS.filter(r => isRivalActive(s, r.id)).map(r => {
        const st = s.rivals[r.id];
        const on = hover === r.id || selected === r.id;
        return (
          <div key={r.id} data-anchor={r.id} className="absolute left-0 top-0 flex flex-col items-center whitespace-nowrap" style={{ willChange: 'transform' }}>
            <div className={`text-[13px] transition-all ${on ? 'scale-110' : ''}`} style={{ color: st.defeated ? '#777' : r.color, textShadow: '0 1px 4px #000, 0 0 10px rgba(0,0,0,0.8)', textDecoration: st.defeated ? 'line-through' : 'none' }}>{r.title} {r.name}</div>
            <div className="num text-[10px] text-paper-2/80" style={{ textShadow: '0 1px 4px #000' }}>{st.defeated ? '倒台' : on ? '点击用计' : pct(st.power / total, 1)}</div>
            <div className="mt-0.5 h-2 w-px" style={{ background: st.defeated ? '#555' : r.color }} />
          </div>
        );
      })}
    </div>
  );
});
