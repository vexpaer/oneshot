import { useEffect, useRef, useState } from "react";
import { useStore, type Season, type LocationId } from "../world/store";
import { LOCATIONS } from "../world/content";
import { world } from "../world/world";
import { audio } from "../world/audio";

const SEASON_LABELS: Record<Season, [string, string]> = {
  spring: ["Spring", "春"],
  summer: ["Summer", "夏"],
  autumn: ["Autumn", "秋"],
  winter: ["Winter", "冬"],
};
const PLACES: { id: LocationId | "overview"; label: string; cn: string }[] = [
  { id: "overview", label: "Valley", cn: "山谷" },
  { id: "about", label: "About", cn: "古树" },
  { id: "projects", label: "Projects", cn: "石碑" },
  { id: "notes", label: "Notes", cn: "树屋" },
  { id: "gallery", label: "Gallery", cn: "湖" },
  { id: "experiments", label: "Experiments", cn: "洞穴" },
  { id: "contact", label: "Contact", cn: "观景台" },
  { id: "flower", label: "Micro", cn: "微观" },
];

function timeLabel(t: number) {
  const h = Math.floor(t * 24);
  const m = Math.floor((t * 24 - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function Overlay() {
  const entered = useStore((s) => s.entered);
  const enter = useStore((s) => s.enter);
  const season = useStore((s) => s.season);
  const setSeason = useStore((s) => s.setSeason);
  const near = useStore((s) => s.nearLocation);
  const scale = useStore((s) => s.scale);
  const fade = useStore((s) => s.fade);
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const flyTo = useStore((s) => s.flyTo);
  const hovered = useStore((s) => s.hovered);
  const timeAuto = useStore((s) => s.timeAuto);
  const setTimeAuto = useStore((s) => s.setTimeAuto);
  const helpOpen = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const [time, setTime] = useState(world.time);
  const dragging = useRef(false);
  const [hideIntro, setHideIntro] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!dragging.current) setTime(world.time);
    }, 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
  }, [hovered]);

  const onEnter = () => {
    audio.start();
    enter();
    setTimeout(() => setHideIntro(true), 1600);
  };

  const place = near === "micro" ? { name: "Inside the bloom", cn: "花之内" } : near ? LOCATIONS.find((l) => l.id === near)! : { name: "The Valley", cn: "山谷" };
  const isNight = world.dayFactor < 0.5;

  return (
    <>
      {/* scale transition fade */}
      <div className={`fade ${fade ? "fade-on" : ""}`} />

      {/* intro */}
      {!hideIntro && (
        <div className={`intro ${entered ? "intro-out" : ""}`}>
          <div className="intro-inner">
            <div className="eyebrow">NATURE EXPLORER · 自然探索之境</div>
            <h1>Enter the wild.</h1>
            <p>A small living valley. Drag to look, scroll to move closer, click a place to travel.</p>
            <button onClick={onEnter}>Enter · 进入</button>
            <div className="intro-hint">Best with sound on · 建议开启声音</div>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className={`hud ${entered ? "hud-on" : ""}`}>
        <div className="hud-tl">
          <span className="brand">NATURE EXPLORER</span>
        </div>

        <div className="hud-bl">
          <div className="place">
            <b>{place.name}</b>
            <em>{place.cn}</em>
          </div>
          <div className="seasons">
            {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
              <button key={s} className={season === s ? "on" : ""} onClick={() => setSeason(s)} title={SEASON_LABELS[s][0]}>
                <i className={`dot dot-${s}`} />
                <span>{SEASON_LABELS[s][1]}</span>
              </button>
            ))}
          </div>
          <div className="timebar">
            <button className="icon" onClick={() => setTimeAuto(!timeAuto)} title={timeAuto ? "Pause time" : "Resume time"}>
              {isNight ? "☾" : "☼"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={time}
              onPointerDown={() => (dragging.current = true)}
              onPointerUp={() => (dragging.current = false)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                world.time = v;
                setTime(v);
              }}
            />
            <span className="clock">{timeLabel(time)}</span>
            <button className="icon" onClick={toggleMute} title="Sound">
              {muted ? "♪̸" : "♪"}
            </button>
            <button className="icon" onClick={() => setHelpOpen(!helpOpen)} title="Help">
              ?
            </button>
          </div>
          {helpOpen && (
            <div className="help">
              <div>Drag · look around　滚轮 · 推进/拉远</div>
              <div>Click ground · walk there　点击地面 · 走过去</div>
              <div>W A S D · roam　Shift · run</div>
              <div>Click a landmark · travel　靠近即可展开内容</div>
              <div>Scroll into the flower · micro world　Esc · return</div>
            </div>
          )}
        </div>

        <div className="hud-br">
          {scale === "micro" ? (
            <button className="back" onClick={() => flyTo("macro")}>
              ← Back to the valley · 回到山谷
            </button>
          ) : (
            <nav className="places">
              {PLACES.map((p) => (
                <button key={p.id} className={near === p.id ? "on" : ""} onClick={() => flyTo(p.id)}>
                  <span>{p.label}</span>
                  <em>{p.cn}</em>
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
