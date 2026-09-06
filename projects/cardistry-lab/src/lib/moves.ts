import * as THREE from 'three';
import { L_FAN, L_MECH, L_REST, L_TIP, MoveBuilder, R_BIDDLE, R_REST, RELAXED, centerOf, flat, mergeHand, moved, pivotAt, rotTo, squared, th } from './builder';
import type { HandPose, Move, PacketDef, PacketPose, Vec3 } from './types';

const PI = Math.PI;
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/** world position of a local point on a packet */
function worldPoint(p: PacketPose, local: Vec3): Vec3 {
  const c = centerOf(p);
  _e.set(p.rot[0], p.rot[1], p.rot[2], 'XYZ');
  _v.set(local[0], local[1], local[2]).applyEuler(_e);
  return [c[0] + _v.x, c[1] + _v.y, c[2] + _v.z];
}

/** right hand biddle grip over a packet whose deck-frame is rotated by ry around Y */
function R_BIDDLE_ROT(c: Vec3, ry: number, opts: { open?: boolean; lift?: number } = {}): HandPose {
  const base = R_BIDDLE([0, 0, 0], opts);
  const ox = base.pos[0], oz = base.pos[2];
  const x = ox * Math.cos(ry) + oz * Math.sin(ry);
  const z = -ox * Math.sin(ry) + oz * Math.cos(ry);
  return { ...base, pos: [c[0] + x, c[1] + base.pos[1], c[2] + z], rot: [0, 0.3 + ry, PI] };
}

const L_RECV: HandPose = mergeHand(L_MECH, { fingers: { thumb: [0.5, 0.05, 0.05, 0.05], index: [0.02, 0.5, 0.8, 0.4] } });
const L_TIP_OPEN_THUMB: HandPose = mergeHand(L_TIP, { fingers: { thumb: [-0.45, 0.55, 0.3, 0.2] } });

// ---------------------------------------------------------------------------
// 1. Charlier Cut
// ---------------------------------------------------------------------------
function charlier(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A · 上包', count: 26 },
    { id: 'B', label: 'B · 下包', count: 26 },
  ];
  const ROT: Vec3 = [0, PI / 2, 0];
  const init = squared(defs, ['B', 'A'], [0, 0, 0], ROT);
  const b = new MoveBuilder(
    { id: 'charlier', name: 'Charlier Cut', cn: '查理切牌', tagline: '最经典的单手切牌：下半包被食指顶起、上半包落下、下半包合拢。', difficulty: 1, category: 'cut', packets: defs },
    init,
    L_TIP,
    R_REST,
  );
  const farEdgeB: Vec3 = [th(26) * 0 + 1.25, -th(26) / 2, 0];
  const farEdgeA: Vec3 = [1.25, -th(26) / 2, 0];

  b.at(0.8);
  // B drops onto the base of the fingers
  const B1 = rotTo(pivotAt(init.B, farEdgeB), [0.5, PI / 2, 0]);
  b.at(2.0, { packets: { B: B1 }, left: L_TIP_OPEN_THUMB });
  // index pushes B up past vertical
  const B2 = rotTo(B1, [-1.4, PI / 2, 0]);
  b.at(3.4, { packets: { B: B2 }, left: { fingers: { index: [0.05, 0.95, 0.45, 0.2] } } });
  // A drops
  const A1 = rotTo(pivotAt(init.A, farEdgeA), [0.5, PI / 2, 0]);
  const B3 = rotTo(B2, [-1.55, PI / 2, 0]);
  b.at(4.4, { packets: { A: A1, B: B3 }, left: { fingers: { thumb: [-0.5, 0.4, 0.25, 0.15], index: [0.05, 0.8, 0.4, 0.2] } } });
  // B falls on top of A
  const topFarA = worldPoint(A1, [1.25, th(26) / 2, 0]);
  const B4: PacketPose = { pivot: topFarA, local: [1.25, -th(26) / 2, 0], rot: [0.5, PI / 2, 0] };
  b.at(5.6, { packets: { B: B4 }, left: { fingers: { index: [0.05, 0.45, 0.4, 0.2] } } });
  // square up: A bottom, B top
  const fin = squared(defs, ['A', 'B'], [0, 0, 0], ROT);
  b.at(6.6, { packets: fin, left: L_TIP });
  b.at(7.4);

  b.step('Fingertip Grip', '指尖握牌', '拇指压住近侧长边，中指/无名指/小指托住远侧长边，食指在牌底待命。', 0, 0.8, { fingers: ['L.thumb', 'L.middle', 'L.ring', 'L.pinky'] })
    .step('Release', '拇指放开下包', '拇指松开下半包 B，B 以远侧边为轴落到手指根部。', 0.8, 2.0, { fingers: ['L.thumb'], packets: ['B'] })
    .step('Index Push', '食指顶起', '食指从下方把 B 顶起，B 绕指尖翻转到接近竖直。', 2.0, 3.4, { fingers: ['L.index'], packets: ['B'] })
    .step('Top Drops', '上包落下', '拇指放开 A，A 落到手指根部，位于 B 下方。', 3.4, 4.4, { fingers: ['L.thumb', 'L.index'], packets: ['A'] })
    .step('Close', 'B 合拢', 'B 倒下压在 A 上，两包位置互换。', 4.4, 5.6, { fingers: ['L.index', 'L.thumb'], packets: ['B'] })
    .step('Square', '整理方牌', '拇指压回，整副牌方正——切牌完成。', 5.6, 7.4, { fingers: ['L.thumb'], packets: ['A', 'B'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 2. Revolution Cut
// ---------------------------------------------------------------------------
function revolution(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A · 上包', count: 26 },
    { id: 'B', label: 'B · 下包', count: 26 },
  ];
  const ROT: Vec3 = [0, PI / 2, 0];
  const init = squared(defs, ['B', 'A'], [0, 0, 0], ROT);
  const b = new MoveBuilder(
    { id: 'revolution', name: 'Revolution Cut', cn: '旋转切牌', tagline: '下半包绕着食指做一整圈“车轮式”翻转后落回顶部。', difficulty: 3, category: 'cut', packets: defs },
    init,
    L_TIP,
    R_REST,
  );
  b.at(0.8);
  const y = th(26) / 2;
  b.at(1.8, { packets: { B: flat([0, -0.25, -0.8], [-0.5, PI / 2, 0]) }, left: mergeHand(L_TIP_OPEN_THUMB, { fingers: { index: [0.05, 0.9, 0.4, 0.2] } }) });
  b.at(2.6, { packets: { B: flat([0, 0.75, -1.65], [-1.6, PI / 2, 0]), A: flat([0, -y, 0], ROT) }, left: { fingers: { index: [0.05, 1.1, 0.5, 0.25] } } });
  b.at(3.4, { packets: { B: flat([0, 1.95, -0.7], [-2.9, PI / 2, 0]) }, left: { fingers: { index: [0.05, 0.8, 0.5, 0.25] } } });
  b.at(4.2, { packets: { B: flat([0, 1.6, 0.7], [-4.3, PI / 2, 0]) } });
  b.at(5.0, { packets: { B: flat([0, 0.6, 0.55], [-5.6, PI / 2, 0]) } });
  b.at(5.8, { packets: { B: flat([0, y, 0], [-2 * PI, PI / 2, 0]) }, left: { fingers: { index: [0.05, 0.3, 0.35, 0.2] } } });
  b.at(6.6, { left: L_TIP });
  b.at(7.4);

  b.step('Fingertip Grip', '指尖握牌', '与 Charlier 相同的指尖握法，食指在牌底。', 0, 0.8, { fingers: ['L.thumb', 'L.middle', 'L.ring'] })
    .step('Kick Out', '食指踢出下包', '拇指放开 B，食指把 B 向外推出并抬起近侧边。', 0.8, 1.8, { fingers: ['L.thumb', 'L.index'], packets: ['B'] })
    .step('Revolve ↑', '翻转上升', 'B 绕食指外侧竖起、越过顶点，牌面朝外。', 1.8, 3.4, { fingers: ['L.index'], packets: ['B'] })
    .step('Revolve ↓', '翻转回落', 'B 继续旋转一整圈，从近侧回落。', 3.4, 5.0, { fingers: ['L.index', 'L.thumb'], packets: ['B'] })
    .step('Land', '落回顶部', 'B 完成 360° 后压在 A 上方。', 5.0, 5.8, { fingers: ['L.index'], packets: ['B'] })
    .step('Square', '整理方牌', '拇指压回合拢。', 5.8, 7.4, { fingers: ['L.thumb'], packets: ['A', 'B'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 3. Swing Cut
// ---------------------------------------------------------------------------
function swing(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A · 上包', count: 26 },
    { id: 'B', label: 'B · 下包', count: 26 },
  ];
  const init = squared(defs, ['B', 'A']);
  const b = new MoveBuilder(
    { id: 'swing', name: 'Swing Cut', cn: '摆动切牌', tagline: '右手食指勾起上半包，以远端为轴摆入左手，再把下半包盖上。', difficulty: 1, category: 'cut', packets: defs },
    init,
    L_MECH,
    R_REST,
  );
  const C1: Vec3 = [2.4, 0.9, -0.3];
  b.at(1.0, { right: R_BIDDLE([0, 0, 0]) });
  const lifted = squared(defs, ['B', 'A'], C1);
  b.at(2.0, { packets: lifted, right: R_BIDDLE(C1), left: L_RECV });
  const Aup = flat([C1[0], C1[1] + th(26) / 2 + 0.14, C1[2]]);
  b.at(2.6, { packets: { A: Aup }, right: { fingers: { index: [0.12, 0.5, 0.45, 0.2] } } });
  const Asw = rotTo(pivotAt(Aup, [-1.25, 0, -1.75]), [0, -1.05, 0]);
  b.at(3.6, { packets: { A: Asw }, left: mergeHand(L_RECV, { fingers: { thumb: [0.55, 0.0, 0.0, 0.0] } }) });
  b.at(4.5, { packets: { A: flat([0, -th(26) / 2, 0], [0, -0.05, 0]) }, left: L_MECH });
  b.at(5.4, { packets: { B: flat([0, th(26) / 2, 0]) }, right: R_BIDDLE([0, th(26) / 2, 0]) });
  b.at(6.2, { packets: squared(defs, ['A', 'B']), right: R_BIDDLE([0, 0, 0], { open: true, lift: 1.2 }) });
  b.at(7.0, { right: R_REST });

  b.step('Biddle Grip', '右手上握', '右手从上方以拇指（近端）与中指/无名指（远端）夹住整副牌。', 0, 2.0, { fingers: ['R.thumb', 'R.middle', 'R.ring'], packets: ['A', 'B'] })
    .step('Index Lift', '食指勾起', '右手食指在远端左角把上半包 A 挑起一条缝。', 2.0, 2.6, { fingers: ['R.index'], packets: ['A'] })
    .step('Swing', '摆出', 'A 以远端左角（食指）为轴向左摆出，近端进入左手虎口。', 2.6, 3.6, { fingers: ['R.index', 'L.thumb'], packets: ['A'] })
    .step('Receive', '左手接牌', '左手拇指夹住 A，A 在左手中归位。', 3.6, 4.5, { fingers: ['L.thumb', 'L.index'], packets: ['A'] })
    .step('Cover', '下包盖上', '右手把 B 放到 A 上方。', 4.5, 5.4, { fingers: ['R.thumb', 'R.middle'], packets: ['B'] })
    .step('Square', '方牌', '右手离开，切牌完成。', 5.4, 7.0, { fingers: ['L.thumb'], packets: ['A', 'B'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 4. Thumb (Kick) Cut
// ---------------------------------------------------------------------------
function thumbCut(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A · 上包', count: 26 },
    { id: 'B', label: 'B · 下包', count: 26 },
  ];
  const init = squared(defs, ['B', 'A']);
  const b = new MoveBuilder(
    { id: 'thumb', name: 'Thumb Cut', cn: '拇指踢切', tagline: '左拇指把上半包向右“踢”出，右手接住后送到底部。', difficulty: 2, category: 'cut', packets: defs },
    init,
    L_MECH,
    R_REST,
  );
  b.at(0.8);
  const Ak = rotTo(pivotAt(flat([0, th(26) / 2 + 0.05, 0]), [1.25, 0, -1.75]), [0, 1.15, 0]);
  b.at(2.0, { packets: { A: Ak }, left: { fingers: { thumb: [1.0, 0.15, 0.1, 0.05] } }, right: moved(R_REST, [-1.2, 0.8, -0.6]) });
  const Akc = centerOf(Ak);
  b.at(3.0, { right: R_BIDDLE_ROT(Akc, 1.15) });
  const Aout = flat([3.4, 0.7, 0.4]);
  const Blift = rotTo(pivotAt(init.B, [-1.25, -th(26) / 2, 0]), [0, 0, 0.32]);
  b.at(4.0, { packets: { A: Aout, B: Blift }, right: R_BIDDLE(centerOf(Aout)), left: { fingers: { thumb: [0.55, 0.2, 0.1, 0.05], index: [0, 0.9, 1.1, 0.5] } } });
  const Aunder = flat([0.3, -0.62, 0.1]);
  b.at(5.0, { packets: { A: Aunder }, right: R_BIDDLE(centerOf(Aunder)) });
  b.at(5.9, { packets: squared(defs, ['A', 'B']), right: R_BIDDLE([0, 0, 0], { open: true, lift: 1.1 }), left: L_MECH });
  b.at(6.8, { right: R_REST });

  b.step("Mechanic's Grip", '机械师握法', '牌放在左掌，中指/无名指/小指扣住右侧长边，食指在远端，拇指在牌顶。', 0, 0.8, { fingers: ['L.thumb', 'L.index', 'L.middle'] })
    .step('Thumb Kick', '拇指踢出', '左拇指向右推上半包 A，A 以食指所在的远端右角为轴向右摆出。', 0.8, 2.0, { fingers: ['L.thumb', 'L.index'], packets: ['A'] })
    .step('Right Takes', '右手接住', '右手从上方夹住摆出的 A。', 2.0, 3.0, { fingers: ['R.thumb', 'R.middle'], packets: ['A'] })
    .step('Open Space', '腾出底部', '右手把 A 带出，左手食指把 B 的右侧翘起腾出空间。', 3.0, 4.0, { fingers: ['L.index', 'R.thumb'], packets: ['A', 'B'] })
    .step('Under', '送到底部', 'A 从右侧滑入 B 下方。', 4.0, 5.0, { fingers: ['R.thumb', 'R.middle'], packets: ['A'] })
    .step('Square', '方牌', 'B 落下压住 A，右手离开。', 5.0, 6.8, { fingers: ['L.thumb'], packets: ['A', 'B'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 5. Sybil – Five Faces basic display
// ---------------------------------------------------------------------------
function sybil(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A', count: 13 },
    { id: 'B', label: 'B', count: 13 },
    { id: 'C', label: 'C', count: 13 },
    { id: 'D', label: 'D', count: 13 },
  ];
  const init = squared(defs, ['D', 'C', 'B', 'A']);
  const b = new MoveBuilder(
    { id: 'sybil', name: 'Sybil · Five Faces', cn: '西比尔 · 五面展示', tagline: '四包牌依次被摆出、旋出、垂下，形成经典的四包空间展示。', difficulty: 4, category: 'display', packets: defs },
    init,
    L_MECH,
    R_REST,
  );
  const C1: Vec3 = [1.8, 0.9, -0.2];
  b.at(1.0, { right: R_BIDDLE([0, 0, 0]) });
  const lifted = squared(defs, ['D', 'C', 'B', 'A'], C1);
  b.at(2.0, { packets: lifted, right: R_BIDDLE(C1), left: moved(L_RECV, [-2.0, 0, 0.4]) });
  const Aup = flat([C1[0], C1[1] + 0.225 + 0.14, C1[2]]);
  b.at(2.5, { packets: { A: Aup }, right: { fingers: { index: [0.12, 0.5, 0.45, 0.2] } } });
  b.at(3.2, { packets: { A: rotTo(pivotAt(Aup, [-1.25, 0, -1.75]), [0, -1.05, 0]) } });
  const CL: Vec3 = [-2.0, -0.225, 0.4];
  b.at(3.9, { packets: { A: flat(CL) }, left: moved(L_MECH, [-2.0, 0, 0.4]) });
  // B pivots out to the right around its far-right corner
  const Bp = rotTo(pivotAt(lifted.B, [1.25, 0, -1.75]), [0, 1.4, 0]);
  b.at(4.9, { packets: { B: Bp }, right: { fingers: { pinky: [-0.3, 0.9, 0.9, 0.4], ring: [-0.15, 0.85, 0.85, 0.4] } } });
  // C hangs down from its near edge
  const Cp = rotTo(pivotAt(lifted.C, [0, 0, 1.75]), [-1.45, 0, 0]);
  b.at(5.9, { packets: { C: Cp }, right: { fingers: { thumb: [0.3, 1.1, 0.7, 0.4], index: [0.2, 0.5, 0.4, 0.2] } } });
  // D tilts for display
  b.at(6.6, { packets: { D: rotTo(lifted.D, [0.2, 0, 0.15]) } });
  b.at(7.6);
  // close: C under D, B on top -> stack [C, D, B] at C1
  const restack = squared(defs, ['C', 'D', 'B'], C1);
  b.at(8.7, { packets: restack, right: R_BIDDLE(C1) });
  const fin = squared(defs, ['A', 'C', 'D', 'B'], [-2.0, 0, 0.4]);
  b.at(9.7, { packets: fin, right: R_BIDDLE([-2.0, 0, 0.4], { open: true, lift: 0.9 }) });
  b.at(10.5, { right: R_REST });

  b.step('Biddle Grip', '右手上握', '右手从上方拿起整副牌，左手在左侧准备接牌。', 0, 2.0, { fingers: ['R.thumb', 'R.middle'], packets: ['A', 'B', 'C', 'D'] })
    .step('Swing A', '摆出 A', '右手食指挑起顶部 1/4（A），向左摆入左手。', 2.0, 3.9, { fingers: ['R.index', 'L.thumb'], packets: ['A'] })
    .step('Pivot B', '旋出 B', '右手小指/无名指把 B 以远端右角为轴向右旋出 90°。', 3.9, 4.9, { fingers: ['R.pinky', 'R.ring'], packets: ['B'] })
    .step('Drop C', '垂下 C', '右手拇指夹住 C 的近端，让 C 向下翻转垂直悬挂。', 4.9, 5.9, { fingers: ['R.thumb', 'R.index'], packets: ['C'] })
    .step('Five Faces', '五面展示', '四包牌分别处于左手、右侧水平、下方垂直、右手顶部——定格展示。', 5.9, 7.6, { fingers: ['L.thumb', 'R.thumb', 'R.pinky'], packets: ['A', 'B', 'C', 'D'] })
    .step('Collapse', '收拢', 'C 收到 D 下方、B 盖到顶部，最后整叠放回左手 A 之上。', 7.6, 10.5, { fingers: ['R.thumb', 'R.middle', 'L.thumb'], packets: ['B', 'C', 'D'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 6. WERM style
// ---------------------------------------------------------------------------
function werm(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A', count: 18 },
    { id: 'B', label: 'B', count: 17 },
    { id: 'C', label: 'C', count: 17 },
  ];
  const init = squared(defs, ['C', 'B', 'A']);
  const b = new MoveBuilder(
    { id: 'werm', name: 'WERM (basic)', cn: 'WERM 蠕动结构', tagline: '三包牌以长边为轴依次翻转，像蠕虫一样展开再卷回，顺序被重排。', difficulty: 4, category: 'display', packets: defs },
    init,
    L_MECH,
    R_REST,
  );
  b.at(1.0, { right: R_BIDDLE([0, 0, 0]) });
  // A flips 180° to the right around its right long edge
  const Ar = pivotAt(init.A, [1.25, -th(18) / 2, 0]);
  b.at(2.0, { packets: { A: rotTo(Ar, [0, 0, -PI / 2]) }, right: mergeHand(R_BIDDLE([1.4, 1.0, 0]), { rot: [0, 0.3, PI - 0.9] }) });
  b.at(3.0, { packets: { A: rotTo(Ar, [0, 0, -PI]) }, right: mergeHand(R_BIDDLE([2.5, 0.2, 0]), { rot: [0, 0.3, PI - 1.4] }) });
  // B flips 180° to the left around its left long edge (left thumb)
  const Bl = pivotAt(init.B, [-1.25, -th(17) / 2, 0]);
  b.at(4.0, { packets: { B: rotTo(Bl, [0, 0, PI / 2]) }, left: { fingers: { thumb: [0.1, 0.1, 0.1, 0.05] } } });
  b.at(5.0, { packets: { B: rotTo(Bl, [0, 0, PI]) }, left: { fingers: { thumb: [-0.3, 0.05, 0.05, 0.05] } } });
  // C lifted & turned by the right hand
  b.at(6.0, { packets: { C: flat([0, 1.4, 0], [0, PI, 0]) }, right: R_BIDDLE_ROT([0, 1.4, 0], PI) });
  b.at(6.8);
  // roll back: A returns (continues rolling), B on top of A, C on top
  b.at(7.8, { packets: { A: rotTo(Ar, [0, 0, -2 * PI]) } });
  const Bback: PacketPose = { pivot: [-1.25, -0.3 + th(18), 0], local: [-1.25, -th(17) / 2, 0], rot: [0, 0, 2 * PI] };
  b.at(8.8, { packets: { B: Bback }, left: { fingers: { thumb: [0.5, 0.3, 0.2, 0.1] } } });
  const fin = squared(defs, ['A', 'B', 'C']);
  b.at(9.8, { packets: { C: { ...fin.C, rot: [0, PI, 0] } }, right: R_BIDDLE_ROT([0, 0.2, 0], PI, { open: true, lift: 0.9 }) });
  b.at(10.6, { right: R_REST });

  b.step('Grip', '双手就位', '左手机械师握法，右手从上方夹住牌。', 0, 1.0, { fingers: ['L.thumb', 'R.thumb', 'R.middle'] })
    .step('A Flips Right', 'A 向右翻', '右手以 A 的右侧长边为轴，把 A 向右翻转 180°，牌面朝上落在右侧。', 1.0, 3.0, { fingers: ['R.thumb', 'R.index', 'R.middle'], packets: ['A'] })
    .step('B Flips Left', 'B 向左翻', '左手拇指把 B 以左侧长边为轴向左翻转 180°。', 3.0, 5.0, { fingers: ['L.thumb'], packets: ['B'] })
    .step('C Turns', 'C 提起旋转', '右手把中间的 C 提起并水平旋转 180°——三包呈“蠕虫”展开。', 5.0, 6.8, { fingers: ['R.thumb', 'R.middle', 'R.ring'], packets: ['C'] })
    .step('Roll Back', '卷回', 'A、B 沿原轴继续翻回中央，B 叠在 A 上。', 6.8, 8.8, { fingers: ['R.index', 'L.thumb'], packets: ['A', 'B'] })
    .step('Close', '合拢', 'C 放回顶部：新顺序 A / B / C。', 8.8, 10.6, { fingers: ['R.thumb', 'L.thumb'], packets: ['C'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 7. Fans – Thumb fan & Pressure fan
// ---------------------------------------------------------------------------
function fans(): Move {
  const defs: PacketDef[] = [{ id: 'A', label: '全副 52 张', count: 52 }];
  const init = { A: flat([0, 0, 0]) };
  const b = new MoveBuilder(
    { id: 'fans', name: 'Thumb Fan / Pressure Fan', cn: '扇形展开', tagline: '以近端左角为轴，右拇指扫过牌顶把 52 张牌展开成圆弧；再演示压力扇。', difficulty: 2, category: 'fan', packets: defs },
    init,
    L_FAN,
    R_REST,
  );
  const P: Vec3 = [-1.25, 0.3, 1.75];
  const R_SWEEP = (theta: number, lift = 0): HandPose => {
    const cx = P[0] - 2.6 * Math.sin(theta);
    const cz = P[2] - 2.6 * Math.cos(theta);
    return {
      pos: [cx + 1.0, P[1] + 1.75 + lift, cz + 1.4],
      rot: [0.25, 0.2, PI],
      fingers: {
        thumb: [0.15, 0.55, 0.3, 0.2],
        index: [0.05, 1.15, 1.25, 0.8],
        middle: [0, 1.25, 1.3, 0.8],
        ring: [0, 1.3, 1.3, 0.8],
        pinky: [-0.05, 1.3, 1.3, 0.8],
      },
    };
  };
  b.at(1.0, { right: R_SWEEP(0) });
  b.at(2.0, { packets: { A: flat([0, 0, 0], [0, 0, 0], { fan: -1.1 }) }, right: R_SWEEP(-1.1) });
  b.at(3.0, { packets: { A: flat([0, 0, 0], [0, 0, 0], { fan: -2.2 }) }, right: R_SWEEP(-2.2) });
  b.at(4.0, { packets: { A: flat([0, 0, 0], [0, 0, 0], { fan: -3.2 }) }, right: R_SWEEP(-3.2) });
  b.at(5.0, { right: R_SWEEP(-3.2, 1.6) });
  b.at(5.8);
  b.at(6.8, { packets: { A: flat([0, 0, 0]) }, right: R_SWEEP(0) });
  // pressure fan
  b.at(7.6, { right: mergeHand(R_BIDDLE([0.3, 0, -0.2]), { rot: [0.1, 0.3, PI] }) });
  b.at(8.4, { packets: { A: flat([0, 0, 0], [0, 0, 0], { bend: 0.55 }) }, right: mergeHand(R_BIDDLE([0.3, -0.25, -0.2]), { rot: [0.35, 0.3, PI] }) });
  b.at(9.3, { packets: { A: flat([0, 0, 0], [0, 0, 0], { fan: -3.0, bend: 0 }) }, right: R_SWEEP(-3.0, 0.6) });
  b.at(10.3, { right: R_SWEEP(-3.0, 1.6) });
  b.at(11.3, { packets: { A: flat([0, 0, 0]) }, right: R_SWEEP(0, 0.6) });
  b.at(12.0, { right: R_REST });

  b.step('Corner Grip', '角点握持', '左拇指压住近端左角（扇轴），食指在角下方顶住。', 0, 1.0, { fingers: ['L.thumb', 'L.index'], packets: ['A'] })
    .step('Thumb Sweep', '拇指扫牌', '右拇指压在牌顶，绕扇轴顺时针画弧，牌一张张被带出。', 1.0, 4.0, { fingers: ['R.thumb', 'L.thumb'], packets: ['A'] })
    .step('Full Fan', '完整扇形', '扇面超过 180°，右手离开展示。', 4.0, 5.8, { fingers: ['L.thumb', 'L.index'], packets: ['A'] })
    .step('Close', '合扇', '右手反向扫回，扇面收拢。', 5.8, 6.8, { fingers: ['R.thumb'], packets: ['A'] })
    .step('Pressure', '压力弯曲', '右手中指/无名指压住远端，把整副牌向下弯出弧度。', 6.8, 8.4, { fingers: ['R.middle', 'R.ring', 'L.thumb'], packets: ['A'] })
    .step('Pressure Fan', '压力扇', '右手绕轴带动，牌在张力下逐张弹出，形成压力扇。', 8.4, 10.3, { fingers: ['R.middle', 'L.thumb'], packets: ['A'] })
    .step('Close', '收扇', '扫回合拢。', 10.3, 12.0, { fingers: ['R.thumb'], packets: ['A'] });
  return b.build();
}

// ---------------------------------------------------------------------------
// 8. Packet Display (three-packet)
// ---------------------------------------------------------------------------
function display(): Move {
  const defs: PacketDef[] = [
    { id: 'A', label: 'A', count: 17 },
    { id: 'B', label: 'B', count: 18 },
    { id: 'C', label: 'C', count: 17 },
  ];
  const init = squared(defs, ['C', 'B', 'A']);
  const b = new MoveBuilder(
    { id: 'display', name: 'Packet Display', cn: '三包牌展示', tagline: '把整副牌分成三包，分别竖立、侧立、平放，展示牌包的空间层次。', difficulty: 2, category: 'display', packets: defs },
    init,
    L_MECH,
    R_REST,
  );
  const C1: Vec3 = [0.4, 1.0, -0.3];
  b.at(1.0, { right: R_BIDDLE([0, 0, 0]) });
  const up = squared(defs, ['B', 'A'], C1);
  b.at(2.0, { packets: up, right: R_BIDDLE(C1) });
  const Av = rotTo(pivotAt(up.A, [0, -th(17) / 2, -1.75]), [-1.5, 0, 0]);
  b.at(3.0, { packets: { A: Av }, right: { fingers: { index: [0.1, 0.45, 0.3, 0.15], middle: [0, 0.5, 0.4, 0.2] } } });
  const Bs = rotTo(pivotAt(up.B, [1.25, -th(18) / 2, 0]), [0, 0, -1.3]);
  b.at(4.0, { packets: { B: Bs }, right: { rot: [0, 0.3, PI - 0.5], pos: [C1[0] + 1.3, C1[1] + 2.2, C1[2] + 2.2] } });
  b.at(4.6, { packets: { C: rotTo(init.C, [0.3, 0, 0]) }, left: moved(L_MECH, [0, 0.05, 0], [0.3, 0, 0]) });
  b.at(5.8);
  b.at(6.8, { packets: { A: up.A, B: up.B, C: init.C }, right: R_BIDDLE(C1), left: L_MECH });
  b.at(7.8, { packets: squared(defs, ['C', 'B', 'A']), right: R_BIDDLE([0, 0, 0], { open: true, lift: 1.0 }) });
  b.at(8.6, { right: R_REST });

  b.step('Grip', '双手就位', '左手托牌，右手从上方夹住上面两包。', 0, 1.0, { fingers: ['L.thumb', 'R.thumb', 'R.middle'] })
    .step('Lift', '提起上两包', '右手提起 A+B，C 留在左手。', 1.0, 2.0, { fingers: ['R.thumb', 'R.middle'], packets: ['A', 'B'] })
    .step('A Stands', 'A 竖立', '右手食指/中指把 A 以远端为轴竖起，牌面朝向观众。', 2.0, 3.0, { fingers: ['R.index', 'R.middle'], packets: ['A'] })
    .step('B Tilts', 'B 侧立', 'B 以右侧长边为轴向右侧立起。', 3.0, 4.0, { fingers: ['R.thumb', 'R.ring'], packets: ['B'] })
    .step('Display', '定格展示', '左手 C 向观众倾斜——三包形成 竖 / 侧 / 平 三个方向。', 4.0, 5.8, { fingers: ['L.thumb', 'R.thumb', 'R.index'], packets: ['A', 'B', 'C'] })
    .step('Collapse', '收拢', '依次放平并合回一叠。', 5.8, 8.6, { fingers: ['R.thumb', 'L.thumb'], packets: ['A', 'B', 'C'] });
  return b.build();
}

export const MOVES: Move[] = [charlier(), revolution(), swing(), thumbCut(), sybil(), werm(), fans(), display()];
export const MOVE_MAP: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]));

export { L_REST, RELAXED };
