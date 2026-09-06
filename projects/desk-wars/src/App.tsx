import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/Game';
import { store, type Settings } from './game/store';
import { GameOverScreen, Hud, LoadingScreen, PauseMenu, SettingsPanel, TitleScreen, UpgradeScreen } from './ui/components';

let gameSingleton: Game | null = null;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [showSettings, setShowSettings] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (gameSingleton) {
      gameRef.current = gameSingleton;
      return;
    }
    try {
      const g = new Game(canvasRef.current);
      gameSingleton = g;
      gameRef.current = g;
      g.init().catch((err) => {
        console.error(err);
        setWebglError(String(err?.message || err));
      });
    } catch (err) {
      setWebglError(String((err as Error)?.message || err));
    }
  }, []);

  const game = () => gameRef.current!;

  const changeSettings = (partial: Partial<Settings>) => {
    store.setSettings(partial);
    game().applySettings(store.snapshot.settings);
  };

  const phase = snap.phase;

  return (
    <>
      <canvas id="game" ref={canvasRef} tabIndex={0} />

      {webglError && (
        <div className="ui-layer interactive flex items-center justify-center bg-black/80 p-6">
          <div className="panel p-8 max-w-md">
            <div className="font-display text-2xl font-bold uppercase tracking-[0.2em] mb-3">WebGL unavailable</div>
            <div className="text-white/60 text-sm">Desk Wars needs a WebGL2-capable browser with hardware acceleration enabled.</div>
            <div className="text-white/30 text-xs mt-3 font-mono break-all">{webglError}</div>
          </div>
        </div>
      )}

      {phase === 'loading' && !webglError && <LoadingScreen progress={snap.loadProgress} stage={snap.loadStage} />}

      {phase === 'title' && !showSettings && <TitleScreen snap={snap} onPlay={() => game().start()} onSettings={() => setShowSettings(true)} />}

      {phase === 'playing' && <Hud snap={snap} />}

      {phase === 'playing' && snap.pointerLockFailed && (
        <div className="ui-layer">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 text-[11px] font-display tracking-[0.2em] uppercase text-white/50 bg-black/50 px-3 py-1">
            Pointer lock unavailable — keep the cursor inside the window
          </div>
        </div>
      )}

      {phase === 'paused' && !showSettings && (
        <PauseMenu
          onResume={() => game().resume()}
          onSettings={() => setShowSettings(true)}
          onQuit={() => {
            game().quitToTitle();
          }}
        />
      )}

      {phase === 'upgrade' && <UpgradeScreen choices={snap.upgradeChoices} owned={snap.ownedUpgrades} wave={snap.hud.wave} onPick={(id) => game().chooseUpgrade(id)} />}

      {phase === 'dead' && <GameOverScreen snap={snap} onRetry={() => game().start()} onTitle={() => game().quitToTitle()} />}

      {showSettings && (phase === 'title' || phase === 'paused') && (
        <div className="ui-layer interactive flex items-center justify-center bg-black/55 backdrop-blur-[3px]">
          <SettingsPanel settings={snap.settings} onChange={changeSettings} onClose={() => setShowSettings(false)} />
        </div>
      )}
    </>
  );
}
