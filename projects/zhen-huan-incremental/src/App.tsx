import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { startLoop, useGame } from '@/game/engine';
import { TopBar, HeartBar, LeftPanel } from '@/ui/HUD';
import { RightPanel } from '@/ui/Panels';
import { Intro, CeremonyOverlay, EventModal, OfflineModal, FloatingNumbers, LogTicker, SceneLabels } from '@/ui/Overlays';
import { useUI } from '@/ui/uiStore';
import { hasWebGL } from '@/three/webgl';

const Scene = lazy(() => import('@/three/Scene'));

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.warn('3D 场景加载失败，已降级为静态背景。', err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** 无 WebGL 时的静态降级背景 */
function FallbackBackdrop() {
  const rank = useGame(s => s.s.rank);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 70%, #3a2620 0%, #1c1311 45%, #0e0908 100%)' }}>
      <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2">
        <div className="mx-auto" style={{ width: 200 + rank * 20, height: 0, borderBottom: '70px solid #8e2a22', borderLeft: '40px solid transparent', borderRight: '40px solid transparent', filter: 'drop-shadow(0 20px 40px #000)' }} />
        <div className="mx-auto bg-[#c9971f]" style={{ width: 240 + rank * 20, height: 14, marginTop: -84 }} />
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] text-paper-2/60">当前浏览器不支持 WebGL，已切换为简化画面。游戏功能不受影响。</div>
    </div>
  );
}

export default function App() {
  const labelRoot = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(hasWebGL);
  const drawer = useUI(u => u.drawer);
  const setDrawer = useUI(u => u.setDrawer);
  const onFail = useCallback(() => setWebgl(false), []);
  useEffect(() => { startLoop(); }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-lacquer text-paper">
      {/* 3D 世界 */}
      {webgl ? (
        <SceneBoundary fallback={<FallbackBackdrop />}>
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.5em] text-gold/70">宫 门 将 启</div>}>
            <Scene labelRoot={labelRoot} onFail={onFail} />
          </Suspense>
        </SceneBoundary>
      ) : <FallbackBackdrop />}
      <div className="vignette" />
      {webgl && <SceneLabels ref={labelRoot} />}

      {/* HUD */}
      <TopBar />
      <HeartBar />

      {/* 桌面：左右栏 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[130px] z-20 hidden gap-4 px-4 pb-4 md:flex md:px-6">
        <div className="flex h-full flex-col justify-between">
          <LeftPanel />
          <div className="mt-3 pointer-events-none"><LogTicker /></div>
        </div>
        <div className="flex-1" />
        <div className="h-full"><RightPanel /></div>
      </div>

      {/* 移动端：底部操作 + 抽屉 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-3 md:hidden">
        <div className="pointer-events-none"><LogTicker /></div>
        <LeftPanel />
        <button className="btn btn-gold pointer-events-auto w-full tracking-[0.3em]" onClick={() => setDrawer(true)}>宫务 · 计谋 · 人脉 · 藏品 · 修行</button>
      </div>
      {drawer && (
        <div className="absolute inset-0 z-30 flex flex-col bg-lacquer/70 md:hidden" onClick={() => setDrawer(false)}>
          <div className="flex-1" />
          <div className="h-[78vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end px-3 pb-1"><button className="btn pointer-events-auto px-3 py-1 text-[11px]" onClick={() => setDrawer(false)}>收起</button></div>
            <div className="h-[calc(100%-32px)] px-2 pb-2"><RightPanel /></div>
          </div>
        </div>
      )}

      {/* 叠加层 */}
      <FloatingNumbers />
      <EventModal />
      <OfflineModal />
      <CeremonyOverlay />
      <Intro />
    </div>
  );
}
