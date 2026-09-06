import { useCallback, useEffect, useRef, useState } from "react";
import { Game, UIState } from "./game/Game";
import { PROP_CATALOG } from "./game/props";
import { WEAPONS } from "./game/weapons";
import { ENEMY_DEFS } from "./game/enemies";
import { MAP_D, MAP_W } from "./game/layout";
import { isMuted, setMuted } from "./game/sfx";
import { cn } from "./utils/cn";

function Minimap({ game, ui }: { game: Game; ui: UIState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const size = c.width;
    const win = 110; // 世界单位窗口
    const scale = size / win;
    const gc = game.groundCanvas;
    const px = gc.width / MAP_W;
    const cx = (ui.posX + MAP_W / 2) * px, cz = (ui.posZ + MAP_D / 2) * px;
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#1e293b";
    g.fillRect(0, 0, size, size);
    g.drawImage(gc, cx - (win / 2) * px, cz - (win / 2) * px, win * px, win * px, 0, 0, size, size);
    // 敌人
    for (const [ex, ez, boss] of game.getEnemyPositions()) {
      const dx = (ex - ui.posX) * scale + size / 2, dz = (ez - ui.posZ) * scale + size / 2;
      g.fillStyle = boss ? "#f97316" : "#ef4444";
      g.beginPath();
      g.arc(dx, dz, boss ? 5 : 3, 0, Math.PI * 2);
      g.fill();
    }
    // 玩家
    g.translate(size / 2, size / 2);
    g.rotate(-ui.yaw);
    g.fillStyle = "#38bdf8";
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(0, 3);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    g.stroke();
  }, [game, ui.posX, ui.posZ, ui.yaw]);
  return <canvas ref={ref} width={176} height={176} className="rounded-full shadow-lg shadow-black/40" />;
}

const KEY = ({ k }: { k: string }) => (
  <kbd className="px-1.5 py-0.5 rounded bg-white/15 border border-white/20 text-[11px] font-mono text-white">{k}</kbd>
);

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UIState | null>(null);
  const [ready, setReady] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportOpts, setExportOpts] = useState({ terrain: true, buildings: true, vegetation: true, decor: true, props: true });
  const [exporting, setExporting] = useState<string>("");
  const [muted, setMutedState] = useState(isMuted());
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let game: Game | null = null;
    const t = setTimeout(() => {
      game = new Game(host, (s) => setUi(s));
      gameRef.current = game;
      setReady(true);
    }, 30);
    return () => {
      clearTimeout(t);
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  // 用于让提示/受伤闪烁动画随时间衰减
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 120);
    return () => clearInterval(id);
  }, []);

  const game = gameRef.current;
  const now = performance.now();
  const doExport = useCallback(() => {
    if (!game) return;
    setExporting("正在导出 GLB，请稍候…");
    setTimeout(() => {
      game.exportGLB(exportOpts, (ok, size) => {
        setExporting(ok ? `导出成功：${((size ?? 0) / 1024 / 1024).toFixed(1)} MB（已开始下载 .glb）` : "导出失败，请查看控制台");
      });
    }, 50);
  }, [game, exportOpts]);

  const inGame = ui && ui.mode !== "menu";
  const paused = inGame && !ui.locked && !ui.gameOver;
  const dmgAlpha = ui ? Math.max(0, 1 - (now - ui.dmgT) / 600) : 0;
  const hitAlpha = ui ? Math.max(0, 1 - (now - ui.hitT) / 250) : 0;
  const msgAlpha = ui ? Math.max(0, Math.min(1, (4200 - (now - ui.msgT)) / 600)) : 0;
  void tick;

  return (
    <div className="fixed inset-0 bg-slate-900 text-white select-none overflow-hidden font-sans">
      <div ref={hostRef} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50">
          <div className="text-4xl font-black tracking-widest mb-4">山城校园</div>
          <div className="text-slate-400 animate-pulse">正在生成地形与建筑…</div>
        </div>
      )}

      {/* ===== 主菜单 ===== */}
      {ui && ui.mode === "menu" && (
        <div className="absolute inset-0 z-30 flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-900/30 to-slate-950/80 pointer-events-none" />
          <div className="relative flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-center mb-10">
              <div className="text-xs tracking-[0.6em] text-sky-300 mb-3">HILLSIDE CAMPUS · 3D</div>
              <h1 className="text-6xl md:text-7xl font-black tracking-wider drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">山城校园</h1>
              <p className="mt-4 text-slate-300 max-w-xl mx-auto leading-relaxed">
                依据校园俯视图 1:1 还原：西侧山体上的宿舍群、环形图书馆、红色天桥、篮球/网球场、标准跑道与体育馆、中央广场与水塘。
                漫步其间、自由建造，或用放大版文具与暴走课本大战。
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
              <button
                onClick={() => game?.setMode("creative")}
                className="group text-left rounded-2xl p-6 bg-white/10 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-400/60 backdrop-blur transition-all hover:-translate-y-1 shadow-xl"
              >
                <div className="text-4xl mb-3">🌳🪨💡</div>
                <div className="text-2xl font-bold mb-1">创造模式</div>
                <div className="text-slate-300 text-sm leading-relaxed">
                  在校园中自由漫步，放置 {PROP_CATALOG.length} 种模型（石头、树木、灌木、木箱、路灯、垃圾桶、长椅、雕像…），调整大小与朝向，并将整个世界导出为 GLB 3D 模型。
                </div>
                <div className="mt-4 text-emerald-300 text-sm font-semibold group-hover:translate-x-1 transition-transform">开始建造 →</div>
              </button>
              <button
                onClick={() => game?.setMode("combat")}
                className="group text-left rounded-2xl p-6 bg-white/10 hover:bg-rose-500/20 border border-white/15 hover:border-rose-400/60 backdrop-blur transition-all hover:-translate-y-1 shadow-xl"
              >
                <div className="text-4xl mb-3">✏️📏🧽</div>
                <div className="text-2xl font-bold mb-1">战斗模式</div>
                <div className="text-slate-300 text-sm leading-relaxed">
                  用巨型铅笔、钢尺、投掷橡皮与连发订书机迎战一波波暴走课本、作业狂人、粉笔幽灵、墨水史莱姆与自爆闹钟。每 5 波将出现 Boss：巨型字典。
                </div>
                <div className="mt-4 text-rose-300 text-sm font-semibold group-hover:translate-x-1 transition-transform">开始战斗 →</div>
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-slate-400">
              <span><KEY k="W A S D" /> 移动</span>
              <span><KEY k="Shift" /> 冲刺</span>
              <span><KEY k="空格" /> 跳跃</span>
              <span><KEY k="V" /> 飞行模式</span>
              <span><KEY k="鼠标" /> 视角</span>
              <span><KEY k="Esc" /> 菜单 / 面板</span>
              {ui.bestScore > 0 && <span className="text-amber-300">🏆 最高分 {ui.bestScore}</span>}
            </div>
          </div>
          <div className="relative text-center text-[11px] text-slate-500 pb-3">Three.js · React · Vite · 纯前端，可直接部署于 GitHub Pages</div>
        </div>
      )}

      {/* ===== 游戏内 HUD ===== */}
      {inGame && ui && (
        <>
          {/* 受伤红晕 */}
          {dmgAlpha > 0 && (
            <div className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: `inset 0 0 160px rgba(220,38,38,${dmgAlpha * 0.9})` }} />
          )}
          {/* 准星 */}
          {ui.locked && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
              {ui.mode === "combat" ? (
                <div className="relative w-8 h-8">
                  <div className="absolute left-1/2 top-0 w-0.5 h-2.5 -translate-x-1/2 bg-white/90" style={{ transform: `translate(-50%, ${-hitAlpha * 4}px)` }} />
                  <div className="absolute left-1/2 bottom-0 w-0.5 h-2.5 -translate-x-1/2 bg-white/90" style={{ transform: `translate(-50%, ${hitAlpha * 4}px)` }} />
                  <div className="absolute top-1/2 left-0 h-0.5 w-2.5 -translate-y-1/2 bg-white/90" style={{ transform: `translate(${-hitAlpha * 4}px, -50%)` }} />
                  <div className="absolute top-1/2 right-0 h-0.5 w-2.5 -translate-y-1/2 bg-white/90" style={{ transform: `translate(${hitAlpha * 4}px, -50%)` }} />
                  {hitAlpha > 0 && <div className="absolute inset-0 rotate-45 border-2 border-red-400 rounded-sm" style={{ opacity: hitAlpha }} />}
                </div>
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-emerald-300/90 bg-emerald-400/30" />
              )}
            </div>
          )}
          {/* 顶部信息 */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-lg bg-black/45 backdrop-blur text-sm flex items-center gap-3">
              <span className={cn("font-bold", ui.mode === "creative" ? "text-emerald-300" : "text-rose-300")}>{ui.mode === "creative" ? "创造模式" : "战斗模式"}</span>
              <span className="text-slate-300 text-xs">{ui.fps} FPS</span>
              <span className="text-slate-400 text-xs font-mono">
                {ui.posX.toFixed(0)}, {ui.posZ.toFixed(0)}
              </span>
              {ui.fly && <span className="text-sky-300 text-xs">✈ 飞行</span>}
            </div>
            {ui.mode === "combat" && (
              <div className="px-3 py-2 rounded-lg bg-black/45 backdrop-blur w-72">
                <div className="flex justify-between text-xs mb-1">
                  <span>生命值</span>
                  <span className="font-mono">
                    {Math.ceil(ui.hp)} / {ui.maxHp}
                  </span>
                </div>
                <div className="h-3 rounded bg-white/10 overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-200", ui.hp / ui.maxHp > 0.5 ? "bg-emerald-400" : ui.hp / ui.maxHp > 0.25 ? "bg-amber-400" : "bg-red-500")}
                    style={{ width: `${(ui.hp / ui.maxHp) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-300">
                  <span>
                    第 <b className="text-white text-base">{ui.wave}</b> 波
                  </span>
                  <span>剩余敌人 <b className="text-white">{ui.enemiesLeft}</b></span>
                  <span>击杀 <b className="text-white">{ui.kills}</b></span>
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-300">
                  <span>得分 <b className="text-amber-300 text-base">{ui.score}</b></span>
                  <span>最高 {Math.max(ui.bestScore, ui.score)}</span>
                </div>
              </div>
            )}
            {ui.mode === "creative" && (
              <div className="px-3 py-2 rounded-lg bg-black/45 backdrop-blur text-xs text-slate-200 space-y-1 w-72">
                <div>
                  当前：<b className="text-emerald-300">{PROP_CATALOG[ui.propIndex].icon} {PROP_CATALOG[ui.propIndex].name}</b>
                  <span className="ml-2 text-slate-400">缩放 ×{ui.propScale.toFixed(2)}</span>
                </div>
                <div className="text-slate-400">已放置 {ui.placed} 个道具</div>
                <div className="text-slate-400 leading-5">
                  <KEY k="左键" /> 放置 <KEY k="右键" /> 删除 <KEY k="滚轮" /> 切换 <KEY k="Q/E" /> 旋转 <KEY k="R/F" /> 缩放 <KEY k="Z" /> 撤销
                </div>
              </div>
            )}
          </div>
          {/* 小地图 */}
          {game && (
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
              <Minimap game={game} ui={ui} />
            </div>
          )}
          {/* 波次倒计时 / Boss 血条 */}
          {ui.mode === "combat" && ui.waveCountdown > 0 && !ui.gameOver && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
              <div className="text-sm text-slate-300">下一波倒计时</div>
              <div className="text-5xl font-black text-amber-300 drop-shadow">{Math.ceil(ui.waveCountdown)}</div>
            </div>
          )}
          {ui.mode === "combat" && ui.bossName && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[420px] max-w-[70vw]">
              <div className="text-center text-sm font-bold text-orange-300 mb-1">☠ {ui.bossName}</div>
              <div className="h-3 rounded bg-black/50 border border-orange-400/50 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all" style={{ width: `${ui.bossHp * 100}%` }} />
              </div>
            </div>
          )}
          {/* 提示消息 */}
          {msgAlpha > 0 && ui.msg && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ opacity: msgAlpha }}>
              <div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur text-sm border border-white/10 whitespace-nowrap">{ui.msg}</div>
            </div>
          )}
          {/* 底部热键栏 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            {ui.mode === "creative" ? (
              <div className="flex gap-1.5 px-2 py-2 rounded-xl bg-black/50 backdrop-blur border border-white/10 max-w-[92vw] overflow-hidden">
                {PROP_CATALOG.map((p, i) => {
                  const dist = Math.abs(i - ui.propIndex);
                  if (dist > 5) return null;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "w-14 h-14 rounded-lg flex flex-col items-center justify-center text-[10px] transition-all",
                        i === ui.propIndex ? "bg-emerald-500/40 border-2 border-emerald-300 scale-110" : "bg-white/5 border border-white/10 text-slate-300"
                      )}
                    >
                      <div className="text-xl leading-none">{p.icon}</div>
                      <div className="mt-1 truncate w-full text-center px-1">{p.name}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-2 px-2 py-2 rounded-xl bg-black/50 backdrop-blur border border-white/10">
                {WEAPONS.map((w, i) => (
                  <div
                    key={w.id}
                    className={cn(
                      "w-20 h-16 rounded-lg flex flex-col items-center justify-center text-[11px] transition-all relative",
                      i === ui.weapon ? "bg-rose-500/40 border-2 border-rose-300 scale-105" : "bg-white/5 border border-white/10 text-slate-300"
                    )}
                  >
                    <span className="absolute top-0.5 left-1.5 text-[10px] text-slate-400">{i + 1}</span>
                    <div className="text-2xl leading-none">{w.icon}</div>
                    <div className="mt-1">{w.name}</div>
                    {w.ammoMax ? (
                      <div className="text-[10px] text-amber-300 font-mono">
                        {i === ui.weapon ? ui.ammo : "•"}/{w.ammoMax}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">近战</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== 暂停 / 面板 ===== */}
          {paused && (
            <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-900/90 border border-white/10 shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <div className="text-2xl font-black">{ui.mode === "creative" ? "创造模式 · 面板" : "战斗模式 · 已暂停"}</div>
                    <div className="text-slate-400 text-sm">点击「继续」或画面锁定鼠标即可回到游戏（Esc 再次打开）</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => game?.lock()} className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 font-bold">▶ 继续</button>
                    <button
                      onClick={() => {
                        setMuted(!muted);
                        setMutedState(!muted);
                      }}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                    >
                      {muted ? "🔇" : "🔊"}
                    </button>
                    <button onClick={() => game?.setMode("menu")} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">主菜单</button>
                  </div>
                </div>

                {ui.mode === "creative" && game && (
                  <>
                    <div className="text-sm font-bold text-emerald-300 mb-2">道具库（点击选择）</div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-5">
                      {PROP_CATALOG.map((p, i) => (
                        <button
                          key={p.id}
                          onClick={() => game.selectProp(i)}
                          className={cn(
                            "rounded-lg p-2 flex flex-col items-center text-xs border transition",
                            i === ui.propIndex ? "bg-emerald-500/30 border-emerald-300" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <span className="text-2xl">{p.icon}</span>
                          <span className="mt-1">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="font-bold mb-2">世界存档</div>
                        <div className="text-xs text-slate-400 mb-3">已放置 {ui.placed} 个道具。存档保存在浏览器，也可以下载为 JSON 分享。</div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => game.saveLayout()} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">💾 保存</button>
                          <button onClick={() => game.loadLayout()} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm">📂 载入</button>
                          <button onClick={() => game.downloadText(game.getLayoutJSON(), "campus-layout.json")} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm">⬇ 下载 JSON</button>
                          <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm">⬆ 导入 JSON</button>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              f.text().then((t) => game.toast(game.loadLayoutJSON(t) ? "导入成功" : "导入失败：文件格式不正确"));
                              e.target.value = "";
                            }}
                          />
                          <button
                            onClick={() => {
                              if (confirm("确定清空所有已放置的道具？")) game.clearProps();
                            }}
                            className="px-3 py-1.5 rounded bg-red-600/70 hover:bg-red-500 text-sm"
                          >
                            🗑 清空
                          </button>
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <div className="font-bold mb-2">导出 3D 模型 (.glb)</div>
                        <div className="text-xs text-slate-400 mb-3">将当前世界（含你放置的道具）导出为标准 glTF 二进制文件，可在 Blender、Unity、Three.js 等中打开。</div>
                        <button onClick={() => setShowExport(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 font-bold text-sm">📦 导出 GLB…</button>
                      </div>
                    </div>
                  </>
                )}

                {ui.mode === "combat" && game && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="font-bold mb-2">武器</div>
                      <div className="space-y-2">
                        {WEAPONS.map((w, i) => (
                          <button key={w.id} onClick={() => game.selectWeapon(i)} className={cn("w-full text-left rounded-lg px-3 py-2 border text-sm flex items-center gap-3", i === ui.weapon ? "bg-rose-500/30 border-rose-300" : "bg-white/5 border-white/10 hover:bg-white/10")}>
                            <span className="text-2xl">{w.icon}</span>
                            <span>
                              <b>{w.name}</b> <span className="text-slate-400">({i + 1})</span>
                              <div className="text-xs text-slate-400">{w.desc} · 伤害 {w.damage}{w.ammoMax ? ` · 弹药 ${w.ammoMax}` : ""}</div>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="font-bold mb-2">敌人图鉴</div>
                      <div className="space-y-1.5 text-sm">
                        {Object.values(ENEMY_DEFS).map((d) => (
                          <div key={d.id} className="flex justify-between border-b border-white/5 pb-1">
                            <span>{d.name}</span>
                            <span className="text-xs text-slate-400">HP {d.hp} · 伤害 {d.damage} · {d.score} 分</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-slate-400 mt-3">击败敌人有概率掉落 🥛 牛奶（+30 HP）与 ✏️ 文具盒（弹药全满）。</div>
                      <button onClick={() => game.startCombat()} className="mt-3 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm">↻ 重新开始</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 游戏结束 ===== */}
          {ui.gameOver && (
            <div className="absolute inset-0 z-20 bg-red-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="text-center rounded-2xl bg-slate-900/90 border border-red-400/30 p-10 shadow-2xl max-w-md w-full">
                <div className="text-5xl mb-2">📚💥</div>
                <div className="text-4xl font-black mb-2">被课本淹没了</div>
                <div className="text-slate-300 mb-6">
                  坚持到第 <b className="text-white">{ui.wave}</b> 波 · 击杀 <b className="text-white">{ui.kills}</b> · 得分 <b className="text-amber-300">{ui.score}</b>
                  {ui.score >= ui.bestScore && ui.score > 0 && <div className="text-amber-300 text-sm mt-1">🏆 新纪录！</div>}
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { game?.startCombat(); game?.lock(); }} className="px-6 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 font-bold">再来一局 (R)</button>
                  <button onClick={() => game?.setMode("menu")} className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20">主菜单</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== 导出对话框 ===== */}
      {showExport && game && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => !exporting.startsWith("正在") && setShowExport(false)}>
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-black mb-1">导出为 GLB 3D 模型</div>
            <div className="text-xs text-slate-400 mb-4">选择要包含的内容。完整导出约 5–20 MB，可能需要几秒。</div>
            <div className="space-y-2 mb-4">
              {(
                [
                  ["terrain", "地形与水面（含俯视贴图）"],
                  ["buildings", "校园建筑"],
                  ["vegetation", "树木与岩石（GPU 实例化）"],
                  ["decor", "路灯、篮球架等原有装饰"],
                  ["props", "我放置的道具"],
                ] as [keyof typeof exportOpts, string][]
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={exportOpts[k]} onChange={(e) => setExportOpts({ ...exportOpts, [k]: e.target.checked })} className="w-4 h-4 accent-sky-500" />
                  {label}
                </label>
              ))}
            </div>
            {exporting && <div className={cn("text-sm mb-3", exporting.startsWith("导出成功") ? "text-emerald-300" : exporting.startsWith("导出失败") ? "text-red-300" : "text-sky-300 animate-pulse")}>{exporting}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowExport(false); setExporting(""); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">关闭</button>
              <button onClick={doExport} disabled={exporting.startsWith("正在")} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 font-bold text-sm">开始导出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
