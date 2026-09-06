import type { ReactNode } from 'react';
import type { GameSnapshot, Settings, UpgradeDef } from '../game/store';
import { audio } from '../game/audio';
import { UPGRADES } from '../game/upgrades';

// ---------------------------------------------------------------- helpers
export function Button({
  children,
  onClick,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  className?: string;
}) {
  return (
    <button
      className={`btn ${variant === 'primary' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : ''} ${className}`}
      onMouseEnter={() => audio.uiHover()}
      onClick={() => {
        audio.uiClick();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="flex justify-between text-[11px] tracking-[0.2em] uppercase text-white/60 mb-2 font-display font-semibold">
        <span>{label}</span>
        <span className="text-white/90">{format ? format(value) : Math.round(value * 100) + '%'}</span>
      </div>
      <input type="range" className="slider" style={{ ['--pct' as string]: pct + '%' }} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

// ---------------------------------------------------------------- Logo
export function Logo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const big = size === 'lg';
  return (
    <div className="text-center select-none">
      <div className={`font-display font-bold uppercase leading-none title-glow ${big ? 'text-[64px] sm:text-[96px] md:text-[120px]' : 'text-[40px]'}`} style={{ letterSpacing: '0.08em' }}>
        <span className="text-white">DESK</span>
        <span className="text-[var(--accent)]">WARS</span>
      </div>
      {big && (
        <div className="font-display tracking-[0.5em] text-[12px] sm:text-[14px] uppercase text-white/50 -mt-1">
          a very small war on a very big desk
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Loading
export function LoadingScreen({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="ui-layer interactive flex items-center justify-center bg-[#07080c]">
      <div className="w-[min(520px,86vw)] fade-in">
        <Logo />
        <div className="mt-12 progress">
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-[11px] font-display tracking-[0.25em] uppercase text-white/50">
          <span>{stage}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Settings
export function SettingsPanel({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Partial<Settings>) => void; onClose: () => void }) {
  return (
    <div className="panel p-7 w-[min(460px,92vw)] fade-in">
      <div className="font-display text-2xl font-bold tracking-[0.2em] uppercase mb-6">Settings</div>
      <div className="space-y-5">
        <Slider label="Master volume" value={settings.master} min={0} max={1} step={0.01} onChange={(v) => onChange({ master: v })} />
        <Slider label="Effects" value={settings.sfx} min={0} max={1} step={0.01} onChange={(v) => onChange({ sfx: v })} />
        <Slider label="Music" value={settings.music} min={0} max={1} step={0.01} onChange={(v) => onChange({ music: v })} />
        <Slider label="Mouse sensitivity" value={settings.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => onChange({ sensitivity: v })} format={(v) => v.toFixed(2) + 'x'} />
        <Slider label="Field of view" value={settings.fov} min={60} max={110} step={1} onChange={(v) => onChange({ fov: v })} format={(v) => v + '°'} />
        <div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-white/60 mb-2 font-display font-semibold">Graphics quality</div>
          <div className="seg">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button key={q} className={settings.quality === q ? 'on' : ''} onClick={() => onChange({ quality: q })}>
                {q}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-white/40 mt-2">
            {settings.quality === 'high' && 'Soft shadows, bloom, depth of field, MSAA.'}
            {settings.quality === 'medium' && 'Shadows and bloom. Good balance.'}
            {settings.quality === 'low' && 'No shadows or post effects. Best for laptops.'}
          </div>
        </div>
      </div>
      <div className="mt-7 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Title
export function TitleScreen({ snap, onPlay, onSettings }: { snap: GameSnapshot; onPlay: () => void; onSettings: () => void }) {
  return (
    <div className="ui-layer interactive scanlines">
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="fade-in">
          <Logo />
        </div>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 fade-in" style={{ animationDelay: '0.15s' }}>
          <Button variant="primary" onClick={onPlay} className="px-12 py-4 text-base">
            Deploy
          </Button>
          <Button onClick={onSettings}>Settings</Button>
        </div>
        {snap.highScore > 0 && (
          <div className="mt-6 font-display tracking-[0.3em] uppercase text-[12px] text-white/50">
            Best score <span className="text-[var(--accent)] font-bold ml-2">{snap.highScore.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-6 left-0 right-0 px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-white/50 fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center">
          <span>
            <span className="kbd">W</span>
            <span className="kbd">A</span>
            <span className="kbd">S</span>
            <span className="kbd">D</span> move
          </span>
          <span>
            <span className="kbd">Shift</span> sprint
          </span>
          <span>
            <span className="kbd">Space</span> jump
          </span>
          <span>
            <span className="kbd">E</span> / <span className="kbd">RMB</span> dash
          </span>
          <span>
            <span className="kbd">R</span> reload
          </span>
          <span>
            <span className="kbd">LMB</span> fire
          </span>
          <span>
            <span className="kbd">Esc</span> pause
          </span>
        </div>
        <div className="font-display tracking-[0.25em] uppercase text-white/30">Desk Wars · WebGL</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- HUD
export function Hud({ snap }: { snap: GameSnapshot }) {
  const h = snap.hud;
  // HUD re-renders at the store's 20Hz tick; time-based flourishes are CSS animations keyed by timestamps.
  const now = performance.now();
  const hitAge = now - h.hitMarker;
  const killAge = now - h.killMarker;
  const dmgAge = now - h.damageFlash;
  const bannerAge = now - h.bannerTime;
  const hpPct = (h.hp / h.maxHp) * 100;
  const spreadPx = 6 + (h.reloading >= 0 ? 6 : 0);
  const ownedList = Object.entries(snap.ownedUpgrades).filter(([, n]) => n > 0);

  return (
    <div className="ui-layer">
      <div className="vignette" />
      <div className={`damage-flash ${dmgAge < 120 ? 'on' : ''}`} />
      {h.lowHp && <div className="lowhp" />}

      {/* crosshair */}
      <div className="crosshair">
        <span className="dot" />
        <span className="arm t" style={{ transform: `translateY(${-spreadPx}px)` }} />
        <span className="arm b" style={{ transform: `translateY(${spreadPx}px)` }} />
        <span className="arm l" style={{ transform: `translateX(${-spreadPx}px)` }} />
        <span className="arm r" style={{ transform: `translateX(${spreadPx}px)` }} />
      </div>
      <div key={h.hitMarker} className={`hitmark ${h.hitMarker > 0 && hitAge < 400 ? 'show' : ''} ${killAge < 400 && killAge <= hitAge + 20 ? 'kill' : ''}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
      {/* dash ring */}
      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="64" height="64" viewBox="0 0 64 64" style={{ opacity: h.dashCd < 1 ? 0.8 : 0 , transition: 'opacity 0.3s'}}>
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <circle cx="32" cy="32" r="28" fill="none" stroke="#4dd8ff" strokeWidth="2" strokeDasharray={`${2 * Math.PI * 28}`} strokeDashoffset={`${2 * Math.PI * 28 * (1 - h.dashCd)}`} transform="rotate(-90 32 32)" strokeLinecap="round" />
      </svg>
      {/* reload arc */}
      {h.reloading >= 0 && (
        <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[28px] w-[70px]">
          <div className="hud-bar" style={{ height: 3 }}>
            <div style={{ width: `${h.reloading * 100}%`, background: '#ffd08a' }} />
          </div>
          <div className="text-center font-display text-[10px] tracking-[0.3em] uppercase text-white/70 mt-1">Reloading</div>
        </div>
      )}

      {/* top center: wave */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center">
        <div className="font-display font-bold tracking-[0.3em] uppercase text-[12px] text-white/50">Wave</div>
        <div className="font-display font-bold text-4xl leading-none text-white">{h.wave}</div>
        <div className="font-display tracking-[0.2em] uppercase text-[11px] text-[var(--accent)] mt-1">{h.enemiesLeft} hostile{h.enemiesLeft === 1 ? '' : 's'}</div>
      </div>

      {/* top right: score */}
      <div className="absolute top-5 right-6 text-right">
        <div className="font-display font-bold tracking-[0.3em] uppercase text-[12px] text-white/50">Score</div>
        <div className="font-display font-bold text-4xl leading-none ammo-num">{h.score.toLocaleString()}</div>
        {h.combo > 1 && <div className="font-display font-bold text-[var(--accent-2)] tracking-[0.2em] text-sm mt-1">×{h.combo} COMBO</div>}
      </div>

      {/* top left: fps + upgrades */}
      <div className="absolute top-5 left-6">
        <div className="font-display tracking-[0.2em] text-[11px] text-white/30 uppercase">{h.fps} fps</div>
        <div className="flex flex-wrap gap-1 mt-2 max-w-[220px]">
          {ownedList.map(([id, n]) => {
            const u = UPGRADES.find((x) => x.id === id);
            return (
              <div key={id} className="px-1.5 py-0.5 text-[11px] bg-white/8 border border-white/10 flex items-center gap-1" title={u?.name}>
                <span>{u?.icon}</span>
                <span className="text-white/60 font-display font-bold">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* bottom left: health */}
      <div className="absolute bottom-6 left-6 w-[min(320px,40vw)]">
        <div className="flex items-end justify-between mb-2">
          <span className="font-display font-bold tracking-[0.3em] uppercase text-[12px] text-white/50">Integrity</span>
          <span className={`font-display font-bold text-3xl leading-none ammo-num ${h.lowHp ? 'text-[var(--danger)]' : 'text-white'}`}>
            {h.hp}
            <span className="text-white/30 text-base">/{h.maxHp}</span>
          </span>
        </div>
        <div className="hud-bar">
          <div className="ghost" style={{ width: `${hpPct}%` }} />
          <div style={{ width: `${hpPct}%`, background: h.lowHp ? 'linear-gradient(90deg,#ff3b4a,#ff7a6a)' : 'linear-gradient(90deg,#4dff88,#b8ffd0)', position: 'relative' }} />
        </div>
      </div>

      {/* bottom right: ammo */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="font-display font-bold tracking-[0.3em] uppercase text-[12px] text-white/50 mb-1">Blaster</div>
        <div className="flex items-end justify-end gap-2">
          <span className={`font-display font-bold text-6xl leading-none ammo-num ${h.mag === 0 ? 'text-[var(--danger)]' : h.mag <= Math.ceil(h.magSize * 0.25) ? 'text-[var(--accent)]' : 'text-white'}`}>{h.mag}</span>
          <span className="font-display font-bold text-2xl leading-none text-white/40 ammo-num mb-1">/ {h.reserve}</span>
        </div>
        <div className="flex justify-end gap-[3px] mt-2 flex-wrap max-w-[220px]">
          {Array.from({ length: h.magSize }).map((_, i) => (
            <span key={i} className="inline-block w-[5px] h-[14px]" style={{ background: i < h.mag ? 'linear-gradient(#ffd08a,#ff7a1a)' : 'rgba(255,255,255,0.12)', clipPath: 'polygon(0 20%,100% 0,100% 100%,0 100%)' }} />
          ))}
        </div>
      </div>

      {/* banner */}
      {bannerAge < 2400 && h.banner && (
        <div key={h.bannerTime} className="absolute left-0 right-0 top-[30%] text-center banner">
          <div className="font-display font-bold text-5xl sm:text-7xl uppercase text-white title-glow" style={{ letterSpacing: '0.3em' }}>
            {h.banner}
          </div>
          <div className="mx-auto mt-3 h-[2px] w-40 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Pause
export function PauseMenu({ onResume, onSettings, onQuit }: { onResume: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <div className="ui-layer interactive flex items-center justify-center bg-black/55 backdrop-blur-[3px]">
      <div className="panel p-9 w-[min(380px,92vw)] fade-in">
        <div className="font-display text-3xl font-bold tracking-[0.3em] uppercase mb-1">Paused</div>
        <div className="text-[12px] text-white/40 mb-7">Systems idle. The desk waits.</div>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={onResume}>
            Resume
          </Button>
          <Button onClick={onSettings}>Settings</Button>
          <Button variant="ghost" onClick={onQuit}>
            Abandon run
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Upgrades
export function UpgradeScreen({ choices, owned, wave, onPick }: { choices: UpgradeDef[]; owned: Record<string, number>; wave: number; onPick: (id: string) => void }) {
  return (
    <div className="ui-layer interactive flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-[min(980px,94vw)] fade-in">
        <div className="text-center mb-8">
          <div className="font-display tracking-[0.4em] uppercase text-[12px] text-[var(--accent)]">Wave {wave} cleared</div>
          <div className="font-display font-bold text-4xl sm:text-5xl uppercase tracking-[0.15em] mt-1">Choose an upgrade</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {choices.map((u, i) => (
            <div key={u.id} className="panel upgrade-card p-6 fade-in" style={{ animationDelay: `${i * 0.08}s` }} onMouseEnter={() => audio.uiHover()} onClick={() => onPick(u.id)}>
              <div className="text-4xl mb-4">{u.icon}</div>
              <div className="font-display font-bold text-xl tracking-[0.1em] uppercase">{u.name}</div>
              <div className="text-white/60 text-sm mt-2 leading-relaxed">{u.desc}</div>
              <div className="mt-5 flex items-center gap-1">
                {Array.from({ length: u.max }).map((_, k) => (
                  <span key={k} className="h-[4px] w-5" style={{ background: k < (owned[u.id] || 0) ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }} />
                ))}
                <span className="text-[11px] text-white/40 ml-2 font-display tracking-[0.2em]">
                  LV {(owned[u.id] || 0) + 1}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-6 text-[12px] text-white/40 font-display tracking-[0.25em] uppercase">Ammo resupplied · +20 integrity</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Game over
export function GameOverScreen({ snap, onRetry, onTitle }: { snap: GameSnapshot; onRetry: () => void; onTitle: () => void }) {
  const s = snap.finalStats;
  const isBest = s.score >= snap.highScore && s.score > 0;
  const mm = Math.floor(s.time / 60);
  const ss = Math.floor(s.time % 60)
    .toString()
    .padStart(2, '0');
  return (
    <div className="ui-layer interactive flex items-center justify-center bg-gradient-to-b from-[#3a0a0f]/70 to-black/80">
      <div className="panel p-9 w-[min(520px,92vw)] fade-in" style={{ animationDelay: '0.8s' }}>
        <div className="font-display tracking-[0.4em] uppercase text-[12px] text-[var(--danger)]">Chassis destroyed</div>
        <div className="font-display font-bold text-5xl uppercase tracking-[0.15em] mt-1 mb-6">Game over</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Stat label="Score" value={s.score.toLocaleString()} big accent={isBest} />
          <Stat label="Wave reached" value={String(s.wave)} big />
          <Stat label="Kills" value={String(s.kills)} />
          <Stat label="Accuracy" value={Math.round(s.accuracy * 100) + '%'} />
          <Stat label="Survived" value={`${mm}:${ss}`} />
          <Stat label="Best" value={snap.highScore.toLocaleString()} />
        </div>
        {isBest && <div className="mt-4 font-display tracking-[0.3em] uppercase text-[12px] text-[var(--accent)]">★ New personal best</div>}
        <div className="mt-8 flex gap-3">
          <Button variant="primary" onClick={onRetry} className="flex-1">
            Redeploy
          </Button>
          <Button variant="ghost" onClick={onTitle}>
            Title
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="font-display tracking-[0.25em] uppercase text-[11px] text-white/45">{label}</div>
      <div className={`font-display font-bold ammo-num ${big ? 'text-3xl' : 'text-xl'} ${accent ? 'text-[var(--accent)]' : ''}`}>{value}</div>
    </div>
  );
}
