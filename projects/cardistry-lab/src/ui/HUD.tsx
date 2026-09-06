import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MOVES, MOVE_MAP } from '../lib/moves';
import { stepAt } from '../lib/anim';
import { FINGERS, FINGER_CN } from '../lib/types';
import { useLab, type Mode, type View } from '../store';
import { cn } from '../utils/cn';

const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: 'free', label: '自由观看', sub: 'Watch' },
  { id: 'teach', label: '教学模式', sub: 'Teach' },
  { id: 'steps', label: '分解模式', sub: 'Steps' },
];
const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: '正视' },
  { id: 'audience', label: '观众' },
  { id: 'side', label: '侧视' },
  { id: 'top', label: '顶视' },
  { id: 'finger', label: '手指特写' },
  { id: 'orbit', label: '自由旋转' },
];

const chip = 'rounded-md border px-2 py-1 text-[11px] leading-none tracking-wide transition-colors select-none';
const chipOff = 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/30 hover:text-white';
const chipOn = 'border-sky-300/60 bg-sky-400/15 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.25)]';

export function HUD() {
  const hidden = useLab((s) => s.hudHidden);
  const toggleFlag = useLab((s) => s.toggleFlag);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 font-sans text-white">
      <button
        onClick={() => toggleFlag('hudHidden')}
        className="pointer-events-auto absolute right-3 top-3 z-30 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/60 backdrop-blur-md hover:text-white md:hidden"
      >
        {hidden ? '显示界面' : '隐藏界面'}
      </button>
      <div className={cn('absolute inset-0 transition-opacity', hidden && 'pointer-events-none opacity-0')}>
        <TopBar />
        <MovePanel />
        <Controls />
      </div>
    </div>
  );
}

function TopBar() {
  const mode = useLab((s) => s.mode);
  const setMode = useLab((s) => s.setMode);
  const view = useLab((s) => s.view);
  const setView = useLab((s) => s.setView);
  const flags = useLab(useShallow((s) => ({ ghost: s.ghost, explode: s.explode, transparent: s.transparent, wire: s.wire, compare: s.compare })));
  const toggleFlag = useLab((s) => s.toggleFlag);
  const setFocusFinger = useLab((s) => s.setFocusFinger);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 md:flex-row md:items-start md:justify-between md:p-5">
      {/* brand + modes */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-[0.35em] text-white/90">CARDISTRY LAB</h1>
          <span className="text-[11px] tracking-[0.3em] text-white/40">花切实验室</span>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} className={cn('rounded-md px-2.5 py-1 text-left transition-colors', mode === m.id ? 'bg-white/12 text-white' : 'text-white/50 hover:text-white')}>
              <div className="text-[11px] leading-tight">{m.label}</div>
              <div className="text-[9px] uppercase tracking-widest opacity-50">{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* views + assists */}
      <div className="pointer-events-auto flex flex-col items-start gap-1.5 md:items-end">
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <span className="self-center px-1.5 text-[9px] uppercase tracking-widest text-white/35">View</span>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setView(v.id);
                if (v.id !== 'finger') setFocusFinger(null);
              }}
              className={cn(chip, view === v.id ? chipOn : chipOff)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <span className="self-center px-1.5 text-[9px] uppercase tracking-widest text-white/35">Assist</span>
          <button onClick={() => toggleFlag('ghost')} className={cn(chip, flags.ghost ? chipOn : chipOff)}>幽灵残影</button>
          <button onClick={() => toggleFlag('explode')} className={cn(chip, flags.explode ? chipOn : chipOff)}>结构爆炸</button>
          <button onClick={() => toggleFlag('transparent')} className={cn(chip, flags.transparent ? chipOn : chipOff)}>透明牌</button>
          <button onClick={() => toggleFlag('wire')} className={cn(chip, flags.wire ? chipOn : chipOff)}>线框 / 骨架</button>
          <button onClick={() => toggleFlag('compare')} className={cn(chip, flags.compare ? 'border-violet-300/60 bg-violet-400/15 text-violet-100' : chipOff)}>对比模式</button>
        </div>
      </div>
    </div>
  );
}

function Difficulty({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={cn('h-1 w-3 rounded-full', i < n ? 'bg-sky-300' : 'bg-white/15')} />
      ))}
    </div>
  );
}

function MovePanel() {
  const moveId = useLab((s) => s.moveId);
  const compare = useLab((s) => s.compare);
  const compareId = useLab((s) => s.compareId);
  const setCompareId = useLab((s) => s.setCompareId);
  const setMove = useLab((s) => s.setMove);
  const mode = useLab((s) => s.mode);
  const focusFinger = useLab((s) => s.focusFinger);
  const setFocusFinger = useLab((s) => s.setFocusFinger);
  const gotoStep = useLab((s) => s.gotoStep);
  const stepIndex = useLab((s) => stepAt(MOVE_MAP[s.moveId], s.t).index);
  const move = MOVE_MAP[moveId];
  const step = move.steps[stepIndex];

  return (
    <div className="pointer-events-auto absolute bottom-[10rem] left-3 flex max-w-[94vw] flex-col gap-2 md:bottom-5 md:left-5 md:max-w-sm">
      {compare && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-300/20 bg-black/50 p-2 text-[11px] backdrop-blur-md">
          <span className="text-violet-200/80">对比：</span>
          <select value={moveId} onChange={(e) => setMove(e.target.value)} className="rounded border border-white/10 bg-black/60 px-1.5 py-0.5 text-white">
            {MOVES.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <span className="text-white/40">vs</span>
          <select value={compareId} onChange={(e) => setCompareId(e.target.value)} className="rounded border border-white/10 bg-black/60 px-1.5 py-0.5 text-white">
            {MOVES.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-sky-300/70">{move.category === 'cut' ? 'Cut · 切牌' : move.category === 'fan' ? 'Fan · 扇形' : 'Display · 展示'}</div>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight md:text-xl">{move.name}</h2>
            <div className="text-xs text-white/55">{move.cn}</div>
          </div>
          <Difficulty n={move.difficulty} />
        </div>
        <p className="mt-2 hidden text-[11px] leading-relaxed text-white/55 md:block">{move.tagline}</p>

        {mode !== 'free' && step && (
          <div className="mt-3 rounded-lg border border-sky-300/20 bg-sky-400/[0.07] p-2.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-sky-200/70">
              <span className="rounded bg-sky-300/20 px-1.5 py-0.5 text-sky-100">Step {step.index + 1}/{move.steps.length}</span>
              <span>{step.title}</span>
            </div>
            <div className="mt-1 text-sm font-medium">{step.cn}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-white/65">{step.desc}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {step.fingers.map((f) => {
                const [h, name] = f.split('.');
                return (
                  <span key={f} className="rounded-full border border-sky-200/30 bg-black/30 px-1.5 py-0.5 text-[10px] text-sky-100">
                    {h === 'L' ? '左' : '右'}·{FINGER_CN[name as keyof typeof FINGER_CN]}
                  </span>
                );
              })}
              {step.packets.map((p) => (
                <span key={p} className="rounded-full border border-amber-200/30 bg-black/30 px-1.5 py-0.5 text-[10px] text-amber-100">
                  Packet {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === 'steps' && (
          <ol className="mt-2 hidden gap-1 md:flex md:flex-col">
            {move.steps.map((s) => (
              <li key={s.index}>
                <button
                  onClick={() => gotoStep(s.index)}
                  className={cn('flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[11px] transition-colors', s.index === step.index ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white')}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.index === step.index ? 'bg-sky-300' : s.index < step.index ? 'bg-white/40' : 'bg-white/15')} />
                  <span className="w-5 opacity-50">{s.index + 1}</span>
                  <span>{s.cn}</span>
                  <span className="ml-auto opacity-40">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        {/* Finger focus */}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[9px] uppercase tracking-widest text-white/35">Finger focus</span>
          {FINGERS.map((f) => (
            <button key={f} onClick={() => setFocusFinger(focusFinger === f ? null : f)} className={cn(chip, focusFinger === f ? 'border-amber-300/60 bg-amber-400/15 text-amber-100' : chipOff)}>
              {f[0].toUpperCase() + f.slice(1)} <span className="opacity-60">{FINGER_CN[f]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Controls() {
  const playing = useLab((s) => s.playing);
  const toggle = useLab((s) => s.toggle);
  const speed = useLab((s) => s.speed);
  const setSpeed = useLab((s) => s.setSpeed);
  const replay = useLab((s) => s.replay);
  const nextStep = useLab((s) => s.nextStep);
  const prevStep = useLab((s) => s.prevStep);
  const moveId = useLab((s) => s.moveId);
  const move = MOVE_MAP[moveId];

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 w-[min(92vw,22rem)] rounded-xl border border-white/10 bg-black/45 p-3 backdrop-blur-md md:bottom-5 md:right-5">
      <Timeline />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconBtn title="上一步" onClick={prevStep}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
          </IconBtn>
          <button onClick={toggle} title={playing ? '暂停' : '播放'} className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/90 text-black shadow-[0_0_20px_rgba(56,189,248,0.45)] transition hover:bg-sky-300">
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <IconBtn title="下一步" onClick={nextStep}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
          </IconBtn>
          <IconBtn title="重播" onClick={replay}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          </IconBtn>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
          {[0.5, 1, 1.5].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={cn('rounded px-2 py-1 text-[11px] tabular-nums transition-colors', speed === s ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white')}>
              {s}x
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-widest text-white/30">
        <span>{move.steps.length} steps · {move.duration.toFixed(1)}s</span>
        <span>space 播放 · ←→ 步骤</span>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-white/30 hover:text-white">
      {children}
    </button>
  );
}

function Timeline() {
  const t = useLab((s) => s.t);
  const moveId = useLab((s) => s.moveId);
  const setT = useLab((s) => s.setT);
  const pause = useLab((s) => s.pause);
  const move = MOVE_MAP[moveId];
  const stepIndex = stepAt(move, t).index;
  const segments = useMemo(() => move.steps.map((s) => ({ ...s, w: ((s.t1 - s.t0) / move.duration) * 100 })), [move]);
  const pct = Math.min(100, (t / move.duration) * 100);

  return (
    <div className="relative">
      <div className="relative flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s) => (
          <div key={s.index} style={{ width: `${s.w}%` }} className={cn('h-full', s.index === stepIndex ? 'bg-sky-400/30' : 'bg-white/10')} />
        ))}
        <div className="absolute left-0 top-0 h-full bg-sky-300/80" style={{ width: `${pct}%` }} />
      </div>
      <input
        type="range"
        min={0}
        max={move.duration}
        step={0.01}
        value={Math.min(t, move.duration)}
        onChange={(e) => {
          pause();
          setT(parseFloat(e.target.value));
        }}
        className="absolute inset-x-0 -top-1.5 h-5 w-full cursor-pointer appearance-none bg-transparent opacity-0"
        aria-label="timeline"
      />
      <div className="mt-1 flex justify-between text-[9px] tabular-nums text-white/35">
        <span>{t.toFixed(2)}s</span>
        <span>{move.steps[stepIndex].title}</span>
      </div>
    </div>
  );
}
