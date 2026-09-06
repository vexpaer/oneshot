// 校园布局数据：所有坐标由俯视图像素 (2352x1568) 换算而来
// 世界坐标：x 向东，z 向南，单位约等于米。 world = px/5 - 235, pz/5 - 157
export const MAP_W = 470;
export const MAP_D = 314;

export const px = (p: number) => p / 5 - 235;
export const pz = (p: number) => p / 5 - 157;

export type RoofType = "flat" | "gable" | "solar" | "dome" | "vents";

export interface BuildingDef {
  kind: "box" | "cyl" | "arc";
  name: string;
  x: number;
  z: number;
  w?: number; // 宽 (x)
  d?: number; // 深 (z)
  r?: number; // 圆柱半径
  ri?: number; // 弧形楼内半径
  a0?: number; // 弧起始角
  a1?: number; // 弧结束角
  h: number;
  y0?: number; // 离地抬升（天桥）
  rot?: number;
  color?: string;
  roof?: string;
  roofType?: RoofType;
  windows?: boolean;
  context?: boolean; // 校外背景建筑
  noPad?: boolean;
}

// 像素中心 + 像素尺寸 → 建筑
const B = (
  name: string,
  cx: number,
  cy: number,
  wpx: number,
  dpx: number,
  h: number,
  extra: Partial<BuildingDef> = {}
): BuildingDef => ({
  kind: "box",
  name,
  x: px(cx),
  z: pz(cy),
  w: wpx / 5,
  d: dpx / 5,
  h,
  windows: true,
  ...extra,
});

export const BUILDINGS: BuildingDef[] = [
  // ===== 核心教学区 =====
  { kind: "cyl", name: "图书馆", x: px(800), z: pz(690), r: 14, h: 18, color: "#f0efe9", roof: "#8a8d90" },
  { kind: "cyl", name: "图书馆裙楼", x: px(800), z: pz(690), r: 19, h: 9, color: "#e6e4dc", roof: "#a3a6a8", noPad: true },
  { kind: "cyl", name: "报告厅", x: px(760), z: pz(640), r: 9, h: 13, color: "#eceae3", roof: "#95989b", roofType: "dome" },
  B("教学主楼", 818, 815, 80, 110, 42, { rot: -0.22, color: "#f4f3ee", roof: "#7c7f83" }),
  B("实验楼", 1030, 772, 300, 55, 20, { color: "#e4ded0", roof: "#5c5f63", roofType: "solar" }),
  B("红色天桥", 1240, 778, 120, 34, 5, { y0: 9, color: "#c8372d", roof: "#d9483c", windows: false, noPad: true }),
  B("东教学楼", 1337, 770, 75, 60, 20, { color: "#e8e3d6", roof: "#63666a" }),
  B("行政楼", 1390, 920, 60, 260, 26, { color: "#ece9e0", roof: "#6a6d71" }),
  B("综合楼", 1062, 975, 155, 170, 16, { color: "#dcd7cb", roof: "#5a5d61" }),
  B("综合楼中庭", 1090, 950, 50, 50, 20, { color: "#c33a2f", roof: "#d7443a", windows: false, noPad: true }),
  B("艺术楼", 960, 950, 80, 200, 14, { color: "#cfd0cc", roof: "#55585c" }),
  B("礼堂", 1345, 1140, 150, 120, 12, { color: "#d9d2c4", roof: "#b8372c", roofType: "gable" }),
  { kind: "arc", name: "弧形教学楼", x: px(765), z: pz(1140), r: 13.5, ri: 7.5, a0: Math.PI * 0.3, a1: Math.PI * 1.7, h: 14, color: "#e9e7df", roof: "#6c6f73" },
  B("科技楼", 920, 1095, 120, 70, 12, { color: "#e3e0d8", roof: "#5f6266" }),
  B("信息楼", 870, 1205, 60, 110, 16, { color: "#efeee8", roof: "#66696d" }),
  { kind: "cyl", name: "天文台", x: px(855), z: pz(1035), r: 3, h: 4, color: "#f6f6f2", roof: "#d0d0d0", roofType: "dome", noPad: true },
  { kind: "cyl", name: "天文台2", x: px(925), z: pz(1035), r: 2.5, h: 3.5, color: "#f6f6f2", roof: "#d0d0d0", roofType: "dome", noPad: true },
  // ===== 体育区 =====
  B("体育馆", 1335, 585, 170, 150, 16, { color: "#cfd3d6", roof: "#2f3438", roofType: "vents" }),
  B("看台", 1450, 560, 40, 160, 6, { color: "#c9c2b4", roof: "#c93a2e", windows: false }),
  B("器材室", 1135, 500, 40, 40, 4, { color: "#d8d3c6", roof: "#7a7d80", windows: false, noPad: true }),
  // ===== 宿舍区（西侧山坡）=====
  B("1号宿舍", 620, 867, 200, 75, 15, { rot: -0.08, color: "#e0dcd1", roof: "#4e5155" }),
  B("2号宿舍", 450, 925, 160, 65, 15, { rot: -0.08, color: "#e0dcd1", roof: "#4e5155" }),
  B("3号宿舍", 670, 950, 100, 70, 13, { color: "#dcd8cc", roof: "#53565a" }),
  B("4号宿舍", 665, 1040, 110, 80, 13, { color: "#dcd8cc", roof: "#53565a" }),
  B("食堂", 500, 1090, 120, 100, 12, { color: "#d9cfbd", roof: "#4a4d51", roofType: "vents" }),
  B("5号宿舍", 640, 1225, 240, 90, 16, { color: "#f1f0ea", roof: "#8c8f93", roofType: "vents" }),
  B("6号宿舍", 360, 1210, 110, 150, 16, { rot: -0.42, color: "#f3f2ec", roof: "#8a8d91" }),
  B("7号宿舍", 300, 1000, 70, 160, 16, { rot: -0.45, color: "#f3f2ec", roof: "#8a8d91" }),
  B("8号宿舍", 380, 1050, 65, 150, 16, { rot: -0.45, color: "#f3f2ec", roof: "#8a8d91" }),
  B("9号宿舍", 230, 1120, 65, 140, 16, { rot: -0.45, color: "#f3f2ec", roof: "#8a8d91" }),
  // ===== 校外背景建筑 =====
  B("住宅塔楼A", 1090, 140, 150, 150, 70, { color: "#e9e6de", roof: "#7d8083", context: true }),
  B("住宅塔楼B", 1320, 140, 150, 150, 70, { color: "#e9e6de", roof: "#7d8083", context: true }),
  B("住宅塔楼C", 1520, 140, 120, 150, 66, { color: "#e9e6de", roof: "#7d8083", context: true }),
  B("住宅塔楼D", 1250, 40, 150, 100, 60, { color: "#e9e6de", roof: "#7d8083", context: true }),
  B("在建大楼", 1700, 130, 130, 230, 30, { color: "#d8c9a8", roof: "#b9a988", context: true }),
  B("商厦", 1370, 1470, 70, 100, 20, { color: "#e2ded4", roof: "#6d7074", context: true }),
];

// 东侧红顶住宅群 + 南侧住宅
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 9; j++) {
    const x = 160 + i * 25;
    const z = -145 + j * 26;
    if (x > 175 && z > 40) continue; // 留给东南操场
    if ((i * 7 + j * 3) % 5 === 0) continue;
    BUILDINGS.push({
      kind: "box",
      name: "住宅",
      x,
      z,
      w: 17,
      d: 11,
      h: 17,
      color: "#efe6d6",
      roof: "#b74a3a",
      roofType: "gable",
      windows: true,
      context: true,
    });
  }
}
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < 2; j++) {
    BUILDINGS.push({
      kind: "box",
      name: "住宅",
      x: -40 + i * 20,
      z: 118 + j * 22,
      w: 15,
      d: 11,
      h: 18,
      color: "#efe6d6",
      roof: "#b74a3a",
      roofType: "gable",
      windows: true,
      context: true,
    });
  }
}
// 西南村落小屋
{
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    BUILDINGS.push({
      kind: "box",
      name: "民房",
      x: -135 + rnd() * 85,
      z: 108 + rnd() * 40,
      w: 5 + rnd() * 3,
      d: 5 + rnd() * 3,
      h: 3.5 + rnd() * 2,
      rot: rnd() * 0.6 - 0.3,
      color: "#d9cbb3",
      roof: rnd() > 0.5 ? "#b04a3a" : "#8a8f96",
      roofType: "gable",
      windows: false,
      context: true,
    });
  }
}

// ===== 场地区域（平整地块）=====
export interface ZoneDef {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  lower?: number; // 相对基准高度的下沉
}
export const ZONES: ZoneDef[] = [
  { id: "football", x0: -63, z0: -108, x1: -35, z1: -88 },
  { id: "basketball", x0: -81, z0: -88, x1: -33, z1: -39 },
  { id: "tennis", x0: -33, z0: -89, x1: -8, z1: -48 },
  { id: "courts2", x0: -33, z0: -47, x1: -6, z1: -21 },
  { id: "track", x0: 52, z0: -100, x1: 128, z1: 0 },
  { id: "plaza", x0: -7, z0: 7, x1: 37, z1: 53 },
  { id: "parking", x0: 15, z0: -25, x1: 49, z1: -13 },
  { id: "pond", x0: -12, z0: 53, x1: 16, z1: 88, lower: 1.6 },
  { id: "gate", x0: 60, z0: 10, x1: 88, z1: 36 },
];

export const TRACK = { cx: 90, cz: -50, r: 35, hs: 12, lanes: 8, laneW: 1.22 };

// 水塘多边形（世界坐标）
export const POND: [number, number][] = [
  [1130, 1060],
  [1250, 1055],
  [1255, 1130],
  [1235, 1200],
  [1165, 1225],
  [1120, 1185],
  [1108, 1105],
].map(([a, b]) => [px(a), pz(b)]);

// ===== 道路 =====
export interface RoadDef {
  pts: [number, number][];
  w: number;
  kind: "campus" | "highway" | "dirt" | "path";
}
const R = (kind: RoadDef["kind"], w: number, pts: [number, number][]): RoadDef => ({
  kind,
  w,
  pts: pts.map(([a, b]) => [px(a), pz(b)]),
});
export const ROADS: RoadDef[] = [
  R("campus", 7, [[700, 560], [760, 600], [900, 640], [1050, 690], [1200, 720], [1300, 720], [1420, 715], [1470, 750], [1500, 830], [1640, 830]]),
  R("campus", 7, [[700, 560], [720, 700], [760, 850], [790, 950], [830, 1050], [850, 1150], [870, 1250], [1000, 1275], [1200, 1275], [1400, 1260], [1480, 1200], [1520, 1080], [1560, 960], [1640, 830]]),
  R("campus", 6, [[770, 870], [600, 885], [430, 905], [300, 950], [200, 1010]]),
  R("campus", 5, [[830, 1050], [760, 1075], [720, 1100], [560, 1150], [420, 1170]]),
  R("path", 4, [[1180, 800], [1180, 720]]),
  R("path", 4, [[1450, 760], [1450, 840], [1470, 1000], [1440, 1080]]),
  R("path", 3, [[1240, 300], [1240, 470], [1210, 560], [1180, 700]]),
  R("dirt", 5, [[700, 560], [600, 545], [480, 470], [380, 400], [300, 300], [260, 180]]),
  R("dirt", 4, [[720, 700], [640, 720], [520, 760], [420, 780]]),
  R("highway", 34, [[1900, -40], [1830, 400], [1760, 800], [1660, 1200], [1590, 1620]]),
  R("highway", 14, [[980, 245], [1900, 258]]),
  R("highway", 12, [[985, -20], [985, 250]]),
  R("highway", 12, [[1550, 1000], [2400, 960]]),
  R("campus", 8, [[1640, 830], [1720, 815]]),
];

// 校园围墙（像素）
export const FENCE: [number, number][] = [
  [700, 240], [1440, 240], [1450, 290], [1830, 300], [1830, 780], [1700, 820],
  [1660, 900], [1580, 1000], [1500, 1220], [1330, 1300], [800, 1300], [620, 1340],
  [430, 1300], [200, 1190], [150, 1000], [270, 830], [400, 720], [560, 620], [700, 560],
].map(([a, b]) => [px(a), pz(b)]);

// 战斗模式刷怪点
export const SPAWN_POINTS: [number, number][] = [
  [-55, -65], [90, -50], [15, 30], [0, -18], [-110, 40], [-40, 100], [60, 80],
  [-70, -45], [125, 20], [-140, -60], [-20, -75], [70, -95], [40, 100], [-95, 5],
  [-160, 20], [20, -40], [95, 30], [-30, 65],
];

export const PLAYER_START = { x: 15, z: 44, yaw: 0 };
