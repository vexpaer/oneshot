// ─────────────────────────────────────────────────────────────
//  《紫禁春秋》· 甄嬛传增量游戏 · 静态数据
// ─────────────────────────────────────────────────────────────

export interface RankDef {
  id: string;
  name: string;      // 位分
  title: string;     // 称号（如 莞常在）
  cost: number;      // 晋封所需恩宠
  share: number;     // 圣心份额要求 0-1
  needReturn?: boolean; // 需经甘露寺回宫
  palace: string;    // 居所
  desc: string;
}

export const RANKS: RankDef[] = [
  { id: 'xiunv', name: '秀女', title: '甄氏', cost: 0, share: 0, palace: '甄府', desc: '殿选之日，杏花微雨。' },
  { id: 'daying', name: '答应', title: '莞答应', cost: 60, share: 0, palace: '碎玉轩', desc: '愿得一心人，白首不相离。' },
  { id: 'changzai', name: '常在', title: '莞常在', cost: 600, share: 0.06, palace: '碎玉轩', desc: '一双玉臂千人枕，半点朱唇万客尝。' },
  { id: 'guiren', name: '贵人', title: '莞贵人', cost: 6_000, share: 0.1, palace: '碎玉轩', desc: '嬛嬛一袅楚宫腰。' },
  { id: 'pin', name: '嫔', title: '莞嫔', cost: 60_000, share: 0.15, palace: '碎玉轩', desc: '正是虹销雨霁，彩彻区明。' },
  { id: 'fei', name: '妃', title: '莞妃', cost: 900_000, share: 0.25, palace: '碎玉轩', desc: '莞莞类卿。' },
  { id: 'guifei', name: '贵妃', title: '熹贵妃', cost: 20_000_000, share: 0.33, needReturn: true, palace: '永寿宫', desc: '臣妾要这天下都知道，谁才是笑到最后的人。' },
  { id: 'huangguifei', name: '皇贵妃', title: '熹皇贵妃', cost: 500_000_000, share: 0.45, needReturn: true, palace: '永寿宫', desc: '这后宫，从今日起不同了。' },
  { id: 'huanghou', name: '皇后', title: '中宫', cost: 15_000_000_000, share: 0.6, needReturn: true, palace: '景仁宫', desc: '臣妾做不到——那便由我来做。' },
  { id: 'taihou', name: '太后', title: '圣母皇太后', cost: 800_000_000_000, share: 0.8, needReturn: true, palace: '寿康宫', desc: '这紫禁城的风，终于停了。' },
];

export interface ProducerDef {
  id: string; name: string; baseCost: number; baseRate: number; unlockRank: number; needReturn?: boolean; desc: string; icon: string;
}

export const PRODUCERS: ProducerDef[] = [
  { id: 'gongnv', name: '宫女', baseCost: 15, baseRate: 0.12, unlockRank: 0, desc: '梳妆、递话、守夜。碎玉轩里最先醒的人。', icon: '簪' },
  { id: 'taijian', name: '小太监', baseCost: 100, baseRate: 1, unlockRank: 0, desc: '跑腿传信，宫里的消息比风还快。', icon: '拂' },
  { id: 'chufang', name: '小厨房', baseCost: 1_100, baseRate: 8, unlockRank: 1, desc: '藕粉桂花糖糕——皇上路过总要多坐一刻。', icon: '糕' },
  { id: 'caiyi', name: '琴案舞衣', baseCost: 12_000, baseRate: 47, unlockRank: 2, desc: '长相思、惊鸿舞。恩宠，多半是从才艺里长出来的。', icon: '琴' },
  { id: 'xiufang', name: '绣房', baseCost: 130_000, baseRate: 260, unlockRank: 3, desc: '一针一线绣的都是心思。', icon: '绣' },
  { id: 'jingshifang', name: '敬事房', baseCost: 1_400_000, baseRate: 1_400, unlockRank: 3, desc: '翻牌子的规矩，总要有人替你打点。', icon: '牌' },
  { id: 'yuhuayuan', name: '御花园偶遇', baseCost: 20_000_000, baseRate: 7_800, unlockRank: 4, desc: '每一次「偶遇」，都是算好的时辰。', icon: '杏' },
  { id: 'neiwufu', name: '内务府', baseCost: 330_000_000, baseRate: 44_000, unlockRank: 5, desc: '份例、用度、赏赐——皆出于此。', icon: '库' },
  { id: 'taiyiyuan', name: '太医院', baseCost: 5_100_000_000, baseRate: 260_000, unlockRank: 6, needReturn: true, desc: '脉案上写什么，很多时候由你说了算。', icon: '医' },
  { id: 'junjichu', name: '军机处', baseCost: 75_000_000_000, baseRate: 1_600_000, unlockRank: 7, needReturn: true, desc: '前朝与后宫，从来不是两件事。', icon: '印' },
  { id: 'yuanmingyuan', name: '圆明园', baseCost: 1_000_000_000_000, baseRate: 10_000_000, unlockRank: 8, needReturn: true, desc: '万园之园，亦是你的园。', icon: '园' },
];

export interface UpgradeDef {
  id: string; name: string; cost: number; desc: string;
  type: 'producer' | 'click' | 'global' | 'scheming' | 'power';
  target?: string; mult: number;
  req: { producer?: string; count?: number; rank?: number; clicks?: number; };
}

const pu = (id: string, name: string, target: string, count: number, cost: number, desc: string): UpgradeDef =>
  ({ id, name, cost, desc, type: 'producer', target, mult: 2, req: { producer: target, count } });

export const UPGRADES: UpgradeDef[] = [
  pu('u_gongnv1', '贴身丫鬟', 'gongnv', 5, 200, '流朱与浣碧总是先一步替你想到。宫女效率翻倍。'),
  pu('u_gongnv2', '梳头娘子', 'gongnv', 25, 5_000, '一头青丝梳得皇上挪不开眼。宫女效率翻倍。'),
  pu('u_gongnv3', '掌事姑姑', 'gongnv', 50, 200_000, '崔槿汐执掌碎玉轩，井井有条。宫女效率翻倍。'),
  pu('u_taijian1', '小允子', 'taijian', 5, 1_500, '剪纸小像的手艺，也能剪出人心。小太监效率翻倍。'),
  pu('u_taijian2', '耳报神', 'taijian', 25, 40_000, '六宫哪儿咳嗽一声你都知道。小太监效率翻倍。'),
  pu('u_taijian3', '苏公公的面子', 'taijian', 50, 1_500_000, '御前的人也肯替你说话。小太监效率翻倍。'),
  pu('u_chufang1', '藕粉桂花糖糕', 'chufang', 5, 15_000, '皇上尝了一口，又坐了半个时辰。小厨房效率翻倍。'),
  pu('u_chufang2', '鹅梨帐中香', 'chufang', 25, 400_000, '烟气袅袅，寝殿留人。小厨房效率翻倍。'),
  pu('u_caiyi1', '惊鸿舞', 'caiyi', 5, 180_000, '翩若惊鸿，婉若游龙。琴案舞衣效率翻倍。'),
  pu('u_caiyi2', '长相守', 'caiyi', 25, 4_000_000, '琴名长相思，君以长相守。琴案舞衣效率翻倍。'),
  pu('u_xiufang1', '蜀锦玉鞋', 'xiufang', 5, 2_000_000, '一双鞋，穿去了皇上的心。绣房效率翻倍。'),
  pu('u_xiufang2', '合欢花帕', 'xiufang', 25, 45_000_000, '合欢花开，绣在帕角。绣房效率翻倍。'),
  pu('u_jingshifang1', '绿头牌摆前头', 'jingshifang', 5, 20_000_000, '每晚翻牌子之前，先看到你。敬事房效率翻倍。'),
  pu('u_yuhuayuan1', '倚梅园的梅', 'yuhuayuan', 5, 300_000_000, '逆风如解意，容易莫摧残。御花园效率翻倍。'),
  pu('u_neiwufu1', '宫权在握', 'neiwufu', 5, 5_000_000_000, '六宫用度尽由你批。内务府效率翻倍。'),
  pu('u_taiyiyuan1', '温太医的脉案', 'taiyiyuan', 5, 80_000_000_000, '太医院效率翻倍。'),
  pu('u_junjichu1', '张廷玉的折子', 'junjichu', 5, 1_000_000_000_000, '军机处效率翻倍。'),
  { id: 'u_click1', name: '请安的分寸', cost: 100, desc: '每一次跪拜都恰到好处。请安效果翻倍。', type: 'click', mult: 2, req: { clicks: 20 } },
  { id: 'u_click2', name: '姣梨妆', cost: 5_000, desc: '眉心一点，皇上说像极了一个人。请安效果翻倍。', type: 'click', mult: 2, req: { clicks: 150, rank: 2 } },
  { id: 'u_click3', name: '杏花微雨', cost: 250_000, desc: '那日的秋千架下，是他先来找你的。请安效果翻倍。', type: 'click', mult: 2, req: { clicks: 500, rank: 3 } },
  { id: 'u_click4', name: '嬛嬛一袅楚宫腰', cost: 20_000_000, desc: '请安效果翻倍。', type: 'click', mult: 2, req: { clicks: 1500, rank: 5 } },
  { id: 'u_click5', name: '钮祜禄氏的仪态', cost: 2_000_000_000, desc: '回宫之后，连行礼都不必弯太深。请安效果翻倍。', type: 'click', mult: 2, req: { clicks: 3000, rank: 6 } },
  { id: 'u_global1', name: '莞莞', cost: 3_000, desc: '皇上赐名「莞」。全部恩宠 +25%。', type: 'global', mult: 1.25, req: { rank: 1 } },
  { id: 'u_global2', name: '椒房之宠', cost: 300_000, desc: '满殿花椒，寓意多子。全部恩宠 +30%。', type: 'global', mult: 1.3, req: { rank: 4 } },
  { id: 'u_global3', name: '协理六宫', cost: 30_000_000, desc: '全部恩宠 +40%。', type: 'global', mult: 1.4, req: { rank: 5 } },
  { id: 'u_global4', name: '双生龙凤', cost: 3_000_000_000, desc: '弘曕与灵犀。全部恩宠 +50%。', type: 'global', mult: 1.5, req: { rank: 6 } },
  { id: 'u_global5', name: '垂帘', cost: 200_000_000_000, desc: '全部恩宠 +100%。', type: 'global', mult: 2, req: { rank: 8 } },
  { id: 'u_sch1', name: '静观其变', cost: 20_000, desc: '你开始学会在饭桌上听话外之音。心机产出 +50%。', type: 'scheming', mult: 1.5, req: { rank: 2 } },
  { id: 'u_sch2', name: '以退为进', cost: 2_000_000, desc: '心机产出 +50%。', type: 'scheming', mult: 1.5, req: { rank: 4 } },
  { id: 'u_sch3', name: '甘露寺的静夜', cost: 100_000_000, desc: '心机产出 +100%。', type: 'scheming', mult: 2, req: { rank: 6 } },
  { id: 'u_pow1', name: '甄家门第', cost: 30_000, desc: '父亲擢升大理寺少卿。你的势力 +20%。', type: 'power', mult: 1.2, req: { rank: 3 } },
  { id: 'u_pow2', name: '协理宫务', cost: 5_000_000, desc: '你的势力 +30%。', type: 'power', mult: 1.3, req: { rank: 5 } },
  { id: 'u_pow3', name: '母凭子贵', cost: 500_000_000, desc: '你的势力 +40%。', type: 'power', mult: 1.4, req: { rank: 6 } },
];

// ── 对手 ─────────────────────────────────────────────────────
export interface RivalDef {
  id: string; name: string; title: string; basePower: number; growth: number; // 每分钟增长比例
  unlockRank: number; needReturn?: boolean; color: string; desc: string;
  killer: { name: string; cost: number; suspicion: number; threshold: number; req: string; reqText: string; text: string };
  reward: { item?: string; favorMult?: number; scheming?: number; text: string };
}

export const RIVALS: RivalDef[] = [
  {
    id: 'xia', name: '夏冬春', title: '夏常在', basePower: 6, growth: 0.002, unlockRank: 0, color: '#8fb37a',
    desc: '包衣佐领之女，仗着一点家世便在御花园里骄横跋扈。',
    killer: { name: '借华妃之手', cost: 30, suspicion: 4, threshold: 0.6, req: 'none', reqText: '无', text: '你只需在华妃面前提一句——「夏常在对娘娘颇有微词」。剩下的，华妃自会赏她一丈红。' },
    reward: { item: 'yizhanghong', text: '夏冬春被赏一丈红。你得到了一份沉默的警告。' },
  },
  {
    id: 'yu', name: '余莺儿', title: '余答应', basePower: 14, growth: 0.003, unlockRank: 1, color: '#a48fb3',
    desc: '倚梅园的宫女，冒领了你的「逆风如解意」，一夜之间成了答应。',
    killer: { name: '一句诗的真相', cost: 80, suspicion: 10, threshold: 0.5, req: 'ally:meizhuang', reqText: '需沈眉庄 Lv1', text: '让皇上亲耳听见她背不出下一句。剩下的，是白绫三尺。' },
    reward: { item: 'meizhi', text: '余莺儿被赐白绫。倚梅园的梅，重新是你的了。' },
  },
  {
    id: 'cao', name: '曹琴默', title: '曹贵人', basePower: 40, growth: 0.004, unlockRank: 2, color: '#b3a07a',
    desc: '华妃身边最会出主意的人。所有阴毒的招，多半出自她口。',
    killer: { name: '反间', cost: 300, suspicion: 15, threshold: 0.5, req: 'ally:duanfei', reqText: '需端妃 Lv1', text: '曹琴默爱女心切。只要让她知道，温宜公主在你这边更安全。' },
    reward: { item: 'wenyi', scheming: 200, text: '曹贵人倒戈，华妃失去了她的军师。' },
  },
  {
    id: 'hua', name: '年世兰', title: '华妃', basePower: 160, growth: 0.005, unlockRank: 0, color: '#d9534f',
    desc: '年羹尧之妹。翊坤宫的欢宜香日夜不熄，皇上却从不肯让她有孩子。',
    killer: { name: '欢宜香的秘密', cost: 1_200, suspicion: 30, threshold: 0.4, req: 'item:huanyixiang', reqText: '需获得「欢宜香」的真相', text: '「皇上从来没有真心待过你。」一句话，翊坤宫的墙就塌了。' },
    reward: { item: 'huanyi_ash', favorMult: 1.5, text: '华妃撞墙而亡。翊坤宫的灯，灭了。恩宠永久 +50%。' },
  },
  {
    id: 'an', name: '安陵容', title: '安贵人', basePower: 90, growth: 0.008, unlockRank: 3, color: '#7aa0b3',
    desc: '曾与你姐妹相称。她的香，她的歌，她的苦杏仁。',
    killer: { name: '苦杏仁', cost: 3_000, suspicion: 25, threshold: 0.4, req: 'item:shexiang', reqText: '需获得「麝香证据」', text: '「我一辈子活在别人的影子里。」她没有再说下去。' },
    reward: { item: 'kuxingren', scheming: 1000, text: '安陵容吞苦杏仁而亡。你没有哭。' },
  },
  {
    id: 'qi', name: '瓜尔佳·文鸳', title: '祺贵人', basePower: 1_200, growth: 0.006, unlockRank: 6, needReturn: true, color: '#c98fb3',
    desc: '皇后的新棋子。她攥着滴血验亲这张牌，等一个机会。',
    killer: { name: '滴血验亲·反制', cost: 12_000, suspicion: 20, threshold: 0.5, req: 'ally:wen:3', reqText: '需温实初 Lv3', text: '白矾入水，血自相融。你当着六宫的面，让她自己的证据翻了案。' },
    reward: { item: 'yinzhen', favorMult: 1.3, text: '祺贵人被褫夺封号，乱棍打死。皇后失去了最锋利的刀。' },
  },
  {
    id: 'hou', name: '乌拉那拉·宜修', title: '皇后', basePower: 6_000, growth: 0.004, unlockRank: 7, needReturn: true, color: '#e0b84a',
    desc: '所有事情的尽头，都站着她。她害死的人，比这后宫的宫灯还多。',
    killer: { name: '死生不复相见', cost: 60_000, suspicion: 40, threshold: 0.35, req: 'item:chunyuan', reqText: '需获得「纯元皇后的秘密」', text: '皇上没有废后。他只说了一句：「死生不复相见。」' },
    reward: { item: 'fenghuan', favorMult: 2, text: '皇后被禁足景仁宫，至死不得再见皇上。这后宫，再没有人能压在你头上。' },
  },
];

export interface SchemeDef { id: string; name: string; cost: number; damage: number; suspicion: number; req?: string; reqText?: string; desc: string; }
export const SCHEMES: SchemeDef[] = [
  { id: 'tiaobo', name: '挑拨', cost: 15, damage: 0.08, suspicion: 5, desc: '一句闲话，一次冷笑。削弱对手 8% 势力。' },
  { id: 'gouxian', name: '构陷', cost: 80, damage: 0.2, suspicion: 14, req: 'rank:3', reqText: '需贵人', desc: '证据是可以准备的。削弱对手 20% 势力。' },
  { id: 'jiedao', name: '借刀杀人', cost: 300, damage: 0.4, suspicion: 28, req: 'ally:meizhuang:2', reqText: '需沈眉庄 Lv2', desc: '让别人替你出手。削弱对手 40% 势力。' },
];

// ── 盟友 ─────────────────────────────────────────────────────
export interface AllyDef {
  id: string; name: string; role: string; unlockRank: number; needReturn?: boolean; maxLevel: number;
  baseCost: number; costGrowth: number; costType: 'scheming' | 'favor';
  effect: string; color: string; quote: string;
}
export const ALLIES: AllyDef[] = [
  { id: 'liuzhu', name: '流朱 · 浣碧', role: '陪嫁丫鬟', unlockRank: 0, maxLevel: 5, baseCost: 80, costGrowth: 3, costType: 'favor', effect: '请安效果 +30% / 级', color: '#c9a86a', quote: '小姐，奴婢替你去。' },
  { id: 'meizhuang', name: '沈眉庄', role: '闺中密友', unlockRank: 1, maxLevel: 5, baseCost: 30, costGrowth: 2.6, costType: 'scheming', effect: '全部恩宠 +15% / 级；Lv2 解锁「借刀杀人」', color: '#d98c8c', quote: '嬛儿，我只信你。' },
  { id: 'wen', name: '温实初', role: '太医', unlockRank: 1, maxLevel: 5, baseCost: 45, costGrowth: 2.6, costType: 'scheming', effect: '嫌疑消散 +30% / 级；Lv3 解锁「滴血验亲·反制」', color: '#8cb3a0', quote: '嬛妹妹，凡事有我。' },
  { id: 'jinxi', name: '崔槿汐', role: '掌事宫女', unlockRank: 2, maxLevel: 5, baseCost: 100, costGrowth: 2.5, costType: 'scheming', effect: '心机 +0.3/秒 / 级；Lv3 每秒自动请安 2 次', color: '#a0a0c0', quote: '小主，宫里的事，急不得。' },
  { id: 'duanfei', name: '端妃', role: '翊坤宫旧怨', unlockRank: 3, maxLevel: 3, baseCost: 400, costGrowth: 3, costType: 'scheming', effect: '计谋伤害 +15% / 级；Lv1 揭示「欢宜香」', color: '#9c8cb3', quote: '华妃欠我一个孩子。' },
  { id: 'su', name: '苏培盛', role: '御前总管', unlockRank: 4, maxLevel: 5, baseCost: 1_500, costGrowth: 2.5, costType: 'scheming', effect: '计谋嫌疑 -10% / 级；Lv3 每 8 秒自动打点最便宜的宫务', color: '#c0b090', quote: '小主，皇上今晚，往这边来了。' },
  { id: 'jingfei', name: '敬妃', role: '掌管宫务', unlockRank: 4, maxLevel: 5, baseCost: 3_000, costGrowth: 2.5, costType: 'scheming', effect: '你的势力 +12% / 级', color: '#8cb3b3', quote: '我数过，这宫里一共三百二十六块砖。' },
  { id: 'guojunwang', name: '果郡王', role: '清河王', unlockRank: 6, needReturn: true, maxLevel: 5, baseCost: 20_000, costGrowth: 3, costType: 'scheming', effect: '全部恩宠 +60% / 级；但每级持续生成嫌疑 +0.04/秒', color: '#e0c060', quote: '愿逆风如解意，容易莫摧残。' },
  { id: 'ye', name: '叶澜依', role: '驯马女', unlockRank: 6, needReturn: true, maxLevel: 3, baseCost: 50_000, costGrowth: 3, costType: 'scheming', effect: '计谋伤害 +35% / 级；Lv3 解锁「纯元皇后的秘密」', color: '#b37a9c', quote: '我这条命，是王爷给的。' },
];

// ── 藏品 ─────────────────────────────────────────────────────
export interface ItemDef { id: string; name: string; desc: string; effect: string; bonus: { type: 'global' | 'click' | 'scheming' | 'suspicionRate' | 'power' | 'decay'; value: number }; icon: string; }
export const ITEMS: ItemDef[] = [
  { id: 'yizhanghong', name: '一丈红', desc: '两寸厚五尺长的板子，打在腰以下。', effect: '你的势力 +10%', bonus: { type: 'power', value: 1.1 }, icon: '杖' },
  { id: 'meizhi', name: '倚梅园梅枝', desc: '逆风如解意，容易莫摧残。', effect: '请安 +20%', bonus: { type: 'click', value: 1.2 }, icon: '梅' },
  { id: 'wenyi', name: '温宜公主的长命锁', desc: '曹琴默唯一的软肋。', effect: '心机 +15%', bonus: { type: 'scheming', value: 1.15 }, icon: '锁' },
  { id: 'huanyixiang', name: '欢宜香', desc: '麝香为主料，年年月月，皇上亲赐。', effect: '解锁华妃杀招；计谋嫌疑 -10%', bonus: { type: 'suspicionRate', value: 0.9 }, icon: '香' },
  { id: 'huanyi_ash', name: '翊坤宫的灰', desc: '华妃死后，欢宜香的余烬。', effect: '全部恩宠 +15%', bonus: { type: 'global', value: 1.15 }, icon: '烬' },
  { id: 'shuhenjiao', name: '舒痕胶', desc: '安陵容亲手调的，说是去疤。', effect: '嫌疑消散 +20%', bonus: { type: 'decay', value: 1.2 }, icon: '膏' },
  { id: 'shexiang', name: '麝香证据', desc: '舒痕胶里验出的东西。', effect: '解锁安陵容杀招；计谋嫌疑 -10%', bonus: { type: 'suspicionRate', value: 0.9 }, icon: '证' },
  { id: 'kuxingren', name: '苦杏仁', desc: '她最后吃的东西。', effect: '心机 +25%', bonus: { type: 'scheming', value: 1.25 }, icon: '杏' },
  { id: 'luozidai', name: '螺子黛', desc: '皇上只赏了三个人。', effect: '请安 +25%', bonus: { type: 'click', value: 1.25 }, icon: '黛' },
  { id: 'shujin', name: '蜀锦', desc: '整匹蜀锦，只为做一双鞋。', effect: '全部恩宠 +10%', bonus: { type: 'global', value: 1.1 }, icon: '锦' },
  { id: 'ejiao', name: '东阿阿胶', desc: '太后赏的，补气血。', effect: '嫌疑消散 +15%', bonus: { type: 'decay', value: 1.15 }, icon: '胶' },
  { id: 'xiaoxiang', name: '小像', desc: '果郡王贴身收着的那一张。', effect: '全部恩宠 +20%', bonus: { type: 'global', value: 1.2 }, icon: '像' },
  { id: 'hehuan', name: '合欢花', desc: '合欢花开，长相守。', effect: '心机 +30%', bonus: { type: 'scheming', value: 1.3 }, icon: '花' },
  { id: 'yinzhen', name: '滴血验亲的银针', desc: '水里加了白矾。', effect: '你的势力 +15%', bonus: { type: 'power', value: 1.15 }, icon: '针' },
  { id: 'chunyuan', name: '纯元皇后的秘密', desc: '那件故衣，那碗安胎药，那个姐姐。', effect: '解锁皇后杀招；计谋嫌疑 -15%', bonus: { type: 'suspicionRate', value: 0.85 }, icon: '密' },
  { id: 'fenghuan', name: '凤鸾春恩车', desc: '从此不必再等翻牌子。', effect: '全部恩宠 +30%', bonus: { type: 'global', value: 1.3 }, icon: '凤' },
  { id: 'nianzhu', name: '甘露寺念珠', desc: '修行时日夜捻着的。', effect: '嫌疑消散 +25%', bonus: { type: 'decay', value: 1.25 }, icon: '珠' },
  { id: 'jiaxiang', name: '姣梨妆花钿', desc: '眉心一点红。', effect: '请安 +15%', bonus: { type: 'click', value: 1.15 }, icon: '钿' },
];

// ── 修行（转生升级）────────────────────────────────────────
export interface PrestigeUpgradeDef { id: string; name: string; cost: number; desc: string; req?: string; }
export const PRESTIGE_UPGRADES: PrestigeUpgradeDef[] = [
  { id: 'p_start', name: '钮祜禄氏', cost: 1, desc: '回宫时直接以「贵人」身份起步，并保留 300 恩宠。' },
  { id: 'p_xi', name: '熹', cost: 2, desc: '皇上赐封号「熹」。全部恩宠 +50%。' },
  { id: 'p_puti', name: '菩提心', cost: 2, desc: '甘露寺的清苦磨平了锋芒。嫌疑消散 +50%。' },
  { id: 'p_auto_click', name: '槿汐随侍', cost: 3, desc: '回宫即自动请安（每秒 3 次），不再需要槿汐 Lv3。' },
  { id: 'p_scheming', name: '凌云峰的夜', cost: 3, desc: '心机产出 +100%。' },
  { id: 'p_keep_allies', name: '故人不散', cost: 4, desc: '回宫时保留所有盟友等级的一半。' },
  { id: 'p_auto_buy', name: '苏培盛的默契', cost: 5, desc: '回宫即自动打点最便宜的宫务（每 5 秒一次）。' },
  { id: 'p_power', name: '母凭子贵', cost: 5, desc: '带着龙凤胎回宫。你的势力 +60%。', req: 'p_xi' },
  { id: 'p_rivals', name: '旧怨已了', cost: 6, desc: '回宫后，已倒台过的对手初始势力减半。', req: 'p_start' },
  { id: 'p_offline', name: '甘露寺的钟', cost: 4, desc: '离线收益上限提升至 24 小时，收益率提升至 100%。' },
  { id: 'p_dao2', name: '道行加深', cost: 8, desc: '每一点道行额外提供 +5% 恩宠（原 +10%）。', req: 'p_xi' },
  { id: 'p_final', name: '圣母皇太后', cost: 12, desc: '解锁最终位分「太后」的晋封资格。', req: 'p_power' },
];

// ── 事件 ─────────────────────────────────────────────────────
export interface EventChoice { label: string; hint: string; effect: string; }
export interface EventDef {
  id: string; title: string; text: string; speaker?: string; once?: boolean; weight: number;
  cond: { rank?: number; maxRank?: number; needReturn?: boolean; noReturn?: boolean; ally?: string; item?: string; notItem?: string; rivalAlive?: string; rivalDead?: string; prestigeCount?: number };
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'e_xinghua', title: '杏花微雨', weight: 3, cond: { rank: 1, maxRank: 3 },
    text: '御花园的秋千架下，一位自称「果郡王」的男子驻足良久。他问你叫什么名字。', speaker: '御花园',
    choices: [
      { label: '「臣女莞莞。」', hint: '恩宠 +（相当于 120 秒产出）', effect: 'favor:120s' },
      { label: '福身告退', hint: '心机 +40', effect: 'scheming:40' },
    ],
  },
  {
    id: 'e_yushi', title: '余氏放肆', weight: 3, once: true, cond: { rank: 1, rivalAlive: 'yu' },
    text: '余答应在长街上拦住了你的轿子，要你的宫女给她跪着让路。', speaker: '长街',
    choices: [
      { label: '忍下这一口气', hint: '心机 +60', effect: 'scheming:60' },
      { label: '「你也配？」', hint: '余莺儿势力 -30%，嫌疑 +8', effect: 'rival:yu:0.3;suspicion:8' },
    ],
  },
  {
    id: 'e_huafei_feast', title: '华妃赐宴', weight: 3, cond: { rank: 1, rivalAlive: 'hua' },
    text: '翊坤宫设宴，华妃要你跪在日头下背《女则》。周宁海在一旁冷笑。', speaker: '翊坤宫',
    choices: [
      { label: '恭顺地跪', hint: '恩宠 -10%，嫌疑 -20', effect: 'favorpct:-0.1;suspicion:-20' },
      { label: '称病告退（需温实初）', hint: '恩宠 +（180 秒产出），需温实初 Lv1', effect: 'req:ally:wen;favor:180s' },
    ],
  },
  {
    id: 'e_jinghong', title: '惊鸿舞', weight: 2, cond: { rank: 2 },
    text: '中秋夜宴，皇后忽然点名要你起舞。华妃笑意盈盈。眉庄在一旁悄悄按住了琴弦。', speaker: '中秋夜宴',
    choices: [
      { label: '翩若惊鸿', hint: '恩宠产出 ×3，持续 90 秒', effect: 'buff:jinghong:90' },
      { label: '请眉庄抚琴伴舞', hint: '恩宠 +（240 秒产出），沈眉庄 +1 级（需已有）', effect: 'favor:240s;allyup:meizhuang' },
    ],
  },
  {
    id: 'e_luozidai', title: '螺子黛', weight: 2, once: true, cond: { rank: 2, notItem: 'luozidai' },
    text: '皇上从波斯得了三盒螺子黛。一盒给了皇后，一盒给了华妃，最后一盒，送到了碎玉轩。', speaker: '碎玉轩',
    choices: [
      { label: '谢恩收下', hint: '获得藏品「螺子黛」', effect: 'item:luozidai' },
      { label: '转赠安陵容', hint: '安陵容势力 -20%，嫌疑 -15', effect: 'rival:an:0.2;suspicion:-15' },
    ],
  },
  {
    id: 'e_shuhenjiao', title: '舒痕胶', weight: 2, once: true, cond: { rank: 3, notItem: 'shexiang' },
    text: '你被猫抓伤了脸。安陵容连夜调了一盒舒痕胶送来，说里面有珍珠粉。', speaker: '碎玉轩',
    choices: [
      { label: '感激地用了', hint: '获得藏品「舒痕胶」', effect: 'item:shuhenjiao' },
      { label: '先让温实初看看（需温实初）', hint: '获得藏品「麝香证据」，需温实初 Lv1', effect: 'req:ally:wen;item:shexiang' },
    ],
  },
  {
    id: 'e_huanyi', title: '欢宜香', weight: 4, once: true, cond: { rank: 3, ally: 'duanfei', notItem: 'huanyixiang' },
    text: '端妃在病榻上告诉你：翊坤宫日夜燃着的欢宜香，是皇上亲赐——里面全是麝香。', speaker: '延庆殿',
    choices: [
      { label: '「原来如此。」', hint: '获得藏品「欢宜香」，解锁华妃杀招', effect: 'item:huanyixiang' },
    ],
  },
  {
    id: 'e_mushufen', title: '木薯粉', weight: 2, once: true, cond: { rank: 3, rivalAlive: 'cao' },
    text: '温宜公主吃了碎玉轩送去的木薯粉，上吐下泻。曹贵人哭着跪在皇上面前。', speaker: '养心殿',
    choices: [
      { label: '当场驳斥，让人去查', hint: '心机 +150，曹贵人势力 -25%，嫌疑 +12', effect: 'scheming:150;rival:cao:0.25;suspicion:12' },
      { label: '跪下认罚', hint: '恩宠 -25%，嫌疑 -30', effect: 'favorpct:-0.25;suspicion:-30' },
    ],
  },
  {
    id: 'e_father', title: '父亲入狱', weight: 3, once: true, cond: { rank: 4, noReturn: true },
    text: '甄远道因言获罪，全家流放宁古塔。皇上正在气头上。', speaker: '养心殿外',
    choices: [
      { label: '跪求皇上开恩', hint: '恩宠 -40%，你的势力保住', effect: 'favorpct:-0.4' },
      { label: '沉默。把恨记下来', hint: '心机 +500，嫌疑 +10', effect: 'scheming:500;suspicion:10' },
    ],
  },
  {
    id: 'e_shujin', title: '蜀锦', weight: 2, once: true, cond: { rank: 3, notItem: 'shujin' },
    text: '皇上赏了整匹蜀锦。浣碧说，做几件衣裳能穿一年。', speaker: '碎玉轩',
    choices: [
      { label: '做一双玉鞋', hint: '获得藏品「蜀锦」', effect: 'item:shujin' },
      { label: '分给六宫', hint: '嫌疑 -25，你的势力临时 ×1.5（120 秒）', effect: 'suspicion:-25;buff:power:120' },
    ],
  },
  {
    id: 'e_taihou', title: '太后召见', weight: 2, cond: { rank: 3 },
    text: '寿康宫传话，太后要见你。竹息姑姑说，太后今日心情不错。', speaker: '寿康宫',
    choices: [
      { label: '规规矩矩地请安', hint: '获得「东阿阿胶」（首次）；嫌疑 -20', effect: 'item:ejiao;suspicion:-20' },
      { label: '与太后论佛', hint: '心机 +（相当于 300 秒产出）', effect: 'scheming:300s' },
    ],
  },
  {
    id: 'e_tangao', title: '藕粉桂花糖糕', weight: 3, cond: { rank: 1 },
    text: '夜半，苏培盛提着灯来了：「皇上说，想吃碎玉轩的糖糕。」', speaker: '碎玉轩',
    choices: [
      { label: '亲手做一碟', hint: '恩宠 +（150 秒产出）', effect: 'favor:150s' },
      { label: '「让小厨房去。」', hint: '小厨房 +2', effect: 'producer:chufang:2' },
    ],
  },
  {
    id: 'e_xuanxiu', title: '新一届选秀', weight: 2, cond: { rank: 2 },
    text: '又是三年。储秀宫里进了一批新人，一个个眉眼鲜嫩。', speaker: '储秀宫',
    choices: [
      { label: '静观其变', hint: '所有在世对手势力 +8%', effect: 'rivalsgrow:0.08' },
      { label: '花钱打点内务府', hint: '恩宠 -15%，新人被分去了别处', effect: 'favorpct:-0.15' },
    ],
  },
  {
    id: 'e_niangeng', title: '年羹尧', weight: 4, once: true, cond: { rank: 4, rivalAlive: 'hua' },
    text: '年羹尧在西北大捷后，进京时竟叫皇上「圣上」而不下跪。养心殿的灯亮到了四更天。', speaker: '养心殿',
    choices: [
      { label: '「臣妾听闻，年大将军家中有九十九间房。」', hint: '华妃势力 -40%，嫌疑 +20', effect: 'rival:hua:0.4;suspicion:20' },
      { label: '什么也不说', hint: '心机 +300', effect: 'scheming:300' },
    ],
  },
  {
    id: 'e_xiaoxiang', title: '小像', weight: 3, once: true, cond: { needReturn: true, ally: 'guojunwang', notItem: 'xiaoxiang' },
    text: '浣碧在宴席上「不小心」跌落了果郡王的荷包。里面有一张小像。皇上问：「这是谁？」', speaker: '御宴',
    choices: [
      { label: '浣碧跪下：「是奴婢。」', hint: '获得藏品「小像」，嫌疑 -30', effect: 'item:xiaoxiang;suspicion:-30' },
      { label: '沉默', hint: '嫌疑 +45，心机 +800', effect: 'suspicion:45;scheming:800' },
    ],
  },
  {
    id: 'e_dixue', title: '滴血验亲', weight: 5, once: true, cond: { needReturn: true, rank: 6, rivalAlive: 'qi' },
    text: '祺贵人当着六宫的面告发：「熹贵妃与温实初私通！」皇后端坐上首。一碗清水已经端上来了。', speaker: '景仁宫',
    choices: [
      { label: '「这水，有问题。」', hint: '祺贵人势力 -50%，嫌疑 -20（需温实初 Lv2）', effect: 'req:ally:wen:2;rival:qi:0.5;suspicion:-20' },
      { label: '「让皇上做主。」', hint: '嫌疑 +50，恩宠 -20%', effect: 'suspicion:50;favorpct:-0.2' },
    ],
  },
  {
    id: 'e_hehuan', title: '合欢花', weight: 3, once: true, cond: { needReturn: true, rank: 6, notItem: 'hehuan' },
    text: '凌云峰的合欢花开了。有人托浣碧带来一枝，没有署名。', speaker: '永寿宫',
    choices: [
      { label: '插在案头', hint: '获得藏品「合欢花」', effect: 'item:hehuan' },
      { label: '烧了', hint: '嫌疑 -40', effect: 'suspicion:-40' },
    ],
  },
  {
    id: 'e_guojunwang_end', title: '一杯毒酒', weight: 5, once: true, cond: { needReturn: true, rank: 7, ally: 'guojunwang', notItem: 'chunyuan' },
    text: '皇上要你亲手给果郡王送去一杯酒。桐花台上，他把杯子换了过去。', speaker: '桐花台',
    choices: [
      { label: '「从今往后，你我死生不复相见。」', hint: '果郡王离去；获得「纯元皇后的秘密」；心机 +5000', effect: 'allyremove:guojunwang;item:chunyuan;scheming:5000' },
    ],
  },
  {
    id: 'e_chunyuan_hint', title: '皇后的旧事', weight: 3, once: true, cond: { needReturn: true, rank: 7, ally: 'ye', notItem: 'chunyuan' },
    text: '叶澜依带来一个人：当年伺候纯元皇后的老宫女。她说，纯元难产那日，皇后送去了一碗安胎药。', speaker: '永寿宫',
    choices: [
      { label: '「把她藏好。」', hint: '获得「纯元皇后的秘密」（需叶澜依 Lv3）', effect: 'req:ally:ye:3;item:chunyuan' },
      { label: '「此事作罢。」', hint: '嫌疑 -30，心机 +2000', effect: 'suspicion:-30;scheming:2000' },
    ],
  },
  {
    id: 'e_jiaxiang', title: '姣梨妆', weight: 2, once: true, cond: { rank: 2, notItem: 'jiaxiang' },
    text: '安陵容替你在眉心点了一点红，说是「姣梨妆」。皇上看见你，愣了很久。', speaker: '碎玉轩',
    choices: [
      { label: '以后日日画', hint: '获得藏品「姣梨妆花钿」', effect: 'item:jiaxiang' },
      { label: '洗掉。不做别人的影子', hint: '心机 +200，你的势力临时 ×1.5（120 秒）', effect: 'scheming:200;buff:power:120' },
    ],
  },
];

// 位分晋升时的故事事件（仪式）
export const RANK_STORIES: Record<number, { title: string; lines: string[] }> = {
  1: { title: '殿选', lines: ['「甄嬛，字嬛嬛？」', '「嬛嬛一袅楚宫腰。那正是臣女的闺名。」', '皇上把玉如意留在了你的手里。'] },
  2: { title: '倚梅园', lines: ['除夕夜，你在梅树下许愿：', '「逆风如解意，容易莫摧残。」', '树后有人应了一声。'] },
  3: { title: '碎玉轩的灯', lines: ['皇上说，碎玉轩的灯，从今日起要点到天明。', '华妃在翊坤宫摔了一只茶盏。'] },
  4: { title: '莞嫔', lines: ['册封礼在景仁宫举行。', '皇后亲手替你戴上嫔位的头面。', '她的手很冷。'] },
  5: { title: '莞莞类卿', lines: ['封妃当日，皇后送来一件旧衣。', '你穿上了。皇上看见你，脸色骤变。', '「莞莞类卿……你不过是替身罢了。」', '——甘露寺，已在等你。'] },
  6: { title: '熹贵妃', lines: ['回宫不过数月，你已是熹贵妃。', '皇后在景仁宫里，一件件数着你的赏赐。', '「这后宫，从今日起不同了。」'] },
  7: { title: '皇贵妃', lines: ['滴血验亲之后，六宫噤声。', '皇上册封你为皇贵妃，协理六宫。', '皇后在景仁宫里，一夜没有点灯。'] },
  8: { title: '中宫', lines: ['「死生不复相见。」', '这句话是皇上对皇后说的。', '而你，站在了她曾经站的地方。'] },
  9: { title: '太后', lines: ['新帝登基。', '你坐在寿康宫的窗前，看着满园的杏花。', '风终于停了。'] },
};
