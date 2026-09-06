import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGame } from './game/store';
import { TopBar, LeftPanel, Banner } from './ui/HUD';
import { RightPanel } from './ui/Panels';
import { CeremonyModal, EventModal, EventResultModal, OfflineModal } from './ui/Modals';

const Scene = lazy(() => import('./scene/Scene')); // 3D 场景按需加载，失败时降级

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.warn('3D 场景初始化失败，已降级为 2D 背景。', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function FlatBackdrop() {
  const dayTime = useGame((s) => s.dayTime);
  const e = -Math.cos(dayTime * Math.PI * 2);
  const night = e < 0;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: night ? 'linear-gradient(180deg,#0a0d1c 0%,#1a1424 60%,#2a1a14 100%)' : 'linear-gradient(180deg,#c8d3d6 0%,#d9c2a2 60%,#8e857a 100%)', transition: 'background 2s' }}>
      <svg className="absolute bottom-0 left-0 w-full h-[55%]" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <g fill={night ? '#1a0f0c' : '#7a2a20'} opacity="0.9">
          <rect x="0" y="330" width="1200" height="70" />
          <polygon points="400,330 600,220 800,330" />
          <rect x="430" y="250" width="340" height="80" />
          <polygon points="470,250 600,180 730,250" />
          <polygon points="60,330 180,260 300,330" /><rect x="90" y="290" width="180" height="40" />
          <polygon points="900,330 1020,260 1140,330" /><rect x="930" y="290" width="180" height="40" />
        </g>
        {night && [520, 600, 680].map((x) => <circle key={x} cx={x} cy="290" r="6" fill="#ff7a4a" opacity="0.9" />)}
      </svg>
      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div className="brush text-6xl gold-text opacity-70">紫禁城</div>
        <div className="text-xs tracking-[0.5em] text-mist mt-3">此设备不支持 3D 渲染 · 已切换为平面模式 · 游戏功能不受影响</div>
      </div>
    </div>
  );
}

function Ticker() {
  const log = useGame((s) => s.log[0]);
  if (!log) return null;
  return (
    <div className="absolute bottom-3 left-[20rem] right-[25.5rem] z-10 pointer-events-none flex justify-center">
      <div key={log.id} className="lacquer px-5 py-2 text-[0.74rem] tracking-wider truncate max-w-full" style={{ animation: 'riseIn 0.5s ease', color: log.kind === 'gold' ? '#f0d48a' : log.kind === 'bad' ? '#e8837a' : '#d9c9a8' }}>
        <span className="text-mist mr-2">第{log.day}日</span>{log.text}
      </div>
    </div>
  );
}

function useGameLoop() {
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (dt <= 0) return;
      if (dt > 2) dt = 2;
      useGame.getState().tick(dt);
    }, 100);
    const saveId = setInterval(() => useGame.getState().save(), 10000);
    const onHide = () => { if (document.visibilityState === 'hidden') useGame.getState().save(); };
    const onUnload = () => useGame.getState().save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        const s = useGame.getState();
        if (!s.ceremony && !s.activeEvent && !s.eventResult && !s.offlineReport) {
          e.preventDefault();
          if (e.repeat) return;
          (document.activeElement as HTMLElement | null)?.blur?.();
          s.click();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id); clearInterval(saveId);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

export default function App() {
  useGameLoop();
  const webgl = useMemo(hasWebGL, []);
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const check = () => setSmall(window.innerWidth < 820 || window.innerHeight < 480);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="relative w-full h-full bg-lacquer overflow-hidden">
      {webgl ? (
        <SceneBoundary fallback={<FlatBackdrop />}>
          <Suspense fallback={<FlatBackdrop />}>
            <Scene />
          </Suspense>
        </SceneBoundary>
      ) : (
        <FlatBackdrop />
      )}
      {/* 暗角 */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(10,6,4,0.55) 100%)' }} />

      <TopBar />
      <LeftPanel />
      <RightPanel />
      <Ticker />
      <Banner />

      <OfflineModal />
      <CeremonyModal />
      <EventModal />
      <EventResultModal />

      {small && (
        <div className="absolute inset-0 z-[60] bg-lacquer/95 flex items-center justify-center p-8 text-center">
          <div>
            <div className="brush text-4xl gold-text">甄嬛传 · 六宫</div>
            <div className="text-sm text-paper-2 mt-4 leading-7">此作以桌面浏览器为主要体验目标。<br />请将窗口拓宽至 820px 以上，或于电脑端游玩。<br /><span className="tip">进度已自动保存，随时可回来。</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
