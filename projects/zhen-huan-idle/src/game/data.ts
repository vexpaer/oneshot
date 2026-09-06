import type { GameEvent } from './types';

// ───────────────────────── 位分 ─────────────────────────
export interface RankDef {
  name: string;
  titles: [string, string]; // [甄氏时期, 钮祜禄氏时期]
  palace: string;
  cost: number;
  stipend: number; // 银两 / 秒
  tier: number; // 3D 宫殿规模
  requireFallen?: string;
  edict: string;
}

export const RANKS: RankDef[] = [
  { name: '秀女', titles: ['甄氏', '钮祜禄氏'], palace: '储秀宫偏殿', cost: 0, stipend: 0.25, tier: 0, edict: '殿选之上，皇上说：「嬛嬛一袅楚宫腰。」' },
  { name: '答应', titles: ['甄答应', '熹答应'], palace: '碎玉轩', cost: 120, stipend: 0.6, tier: 1, edict: '着封为答应，赐居碎玉轩。' },
  { name: '常在', titles: ['莞常在', '熹常在'], palace: '碎玉轩', cost: 1800, stipend: 1.5, tier: 1, edict: '赐封号「莞」。莞莞，柔顺美好之意。' },
  { name: '贵人', titles: ['莞贵人', '熹贵人'], palace: '碎玉轩', cost: 25000, stipend: 4, tier: 2, requireFallen: 'xiadongchun', edict: '晋为贵人，六宫侧目。' },
  { name: '嫔', titles: ['莞嫔', '熹嫔'], palace: '碎玉轩正殿', cost: 350000, stipend: 12, tier: 2, edict: '册封为嫔，行册封礼，位列一宫主位。' },
  { name: '妃', titles: ['莞妃', '熹妃'], palace: '永寿宫', cost: 6e6, stipend: 35, tier: 3, requireFallen: 'huafei', edict: '晋封妃位，移居永寿宫。' },
  { name: '贵妃', titles: ['莞贵妃', '熹贵妃'], palace: '永寿宫', cost: 1.1e8, stipend: 100, tier: 3, edict: '晋贵妃，抬入镶黄旗。' },
  { name: '皇贵妃', titles: ['莞皇贵妃', '熹皇贵妃'], palace: '永寿宫·协理六宫', cost: 2.2e9, stipend: 300, tier: 4, edict: '晋皇贵妃，摄六宫事，凤印在手。' },
  { name: '太后', titles: ['圣母皇太后', '圣母皇太后'], palace: '寿康宫', cost: 6e10, stipend: 1000, tier: 5, requireFallen: 'huanghou', edict: '新帝登基，尊为圣母皇太后，移居寿康宫。' },
];

export const MAX_RANK = RANKS.length - 1;

// ───────────────────────── 宫人 / 产出 ─────────────────────────
export interface ProducerDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  rate: number;
  rank: number;
  color: string;
}

export const PRODUCERS: ProducerDef[] = [
  { id: 'gongnv', name: '宫女', desc: '伺候起居的宫女。人多手脚勤，圣心也看得见。', cost: 15, rate: 0.15, rank: 0, color: '#c7a6b8' },
  { id: 'taijian', name: '太监', desc: '内廷消息，都是从太监嘴里传出去的。', cost: 100, rate: 1, rank: 0, color: '#7f8ba0' },
  { id: 'xiaochufang', name: '小厨房', desc: '御膳之外另开小灶。一碗藕粉桂花糖糕，也能留住圣驾。', cost: 1100, rate: 8, rank: 1, color: '#c98a4e' },
  { id: 'qinyi', name: '琴棋书画', desc: '长相思、惊鸿舞。才情，是宫里最锋利的刀。', cost: 12000, rate: 47, rank: 2, color: '#6f9c8c' },
  { id: 'shujin', name: '蜀锦华服', desc: '一件蜀锦，抵得上寻常人家一年嚼用。穿在身上，就是恩宠。', cost: 130000, rate: 260, rank: 3, color: '#b04a5a' },
  { id: 'meiyuan', name: '倚梅园', desc: '「逆风如解意，容易莫摧残。」梅园之约，年年如新。', cost: 1.4e6, rate: 1400, rank: 4, color: '#e0a0b0' },
  { id: 'huangsi', name: '皇嗣', desc: '母凭子贵。龙凤呈祥，六宫无人能出其右。', cost: 2e7, rate: 7800, rank: 5, color: '#e8c86a' },
  { id: 'mujia', name: '钮祜禄氏', desc: '抬旗入上三旗，母家势力今非昔比。', cost: 3.3e8, rate: 44000, rank: 6, color: '#8a6fb8' },
  { id: 'fengyin', name: '凤印', desc: '协理六宫，凤印在手。后宫的规矩，由你来定。', cost: 5.1e9, rate: 260000, rank: 7, color: '#d8b04a' },
];

export const PRODUCER_MAP = Object.fromEntries(PRODUCERS.map((p) => [p.id, p]));
export const UPGRADE_TIERS = [10, 25, 50, 100, 200];
export const UPGRADE_COST_MULT = [12, 120, 1500, 20000, 300000];
export const UPGRADE_NAMES: Record<string, string[]> = {
  gongnv: ['宫女识字', '槿汐调教', '掌事姑姑', '心腹宫女', '六宫耳目'],
  taijian: ['小太监跑腿', '敬事房有人', '总管太监', '御前近侍', '苏培盛之友'],
  xiaochufang: ['桂花糖糕', '鸭子汤', '冰镇酸梅汤', '御厨改良', '玉盘珍馐'],
  qinyi: ['长相思', '惊鸿舞', '杏花微雨', '清平调', '琴瑟和鸣'],
  shujin: ['蜀锦新样', '螺子黛', '东珠首饰', '御赐朝服', '凤纹金线'],
  meiyuan: ['剪纸小像', '梅香入帐', '雪夜赏梅', '梅坞题诗', '梅开二度'],
  huangsi: ['胧月公主', '双生子', '灵犀', '皇子进学', '嗣位之望'],
  mujia: ['抬旗', '甄远道平反', '亲族入仕', '母家封赏', '钮祜禄氏满门'],
  fengyin: ['协理六宫', '整肃内务府', '裁撤冗员', '定六宫规矩', '独掌凤印'],
};

export const CLICK_UPGRADE_COSTS = [60, 600, 6000, 6e4, 6e5, 6e6, 6e7, 6e8, 6e9, 6e10];
export const CLICK_UPGRADE_NAMES = ['学会请安', '一颦一笑', '巧言令色', '善解人意', '知书达理', '心有灵犀', '金风玉露', '朝夕相伴', '情深不寿', '莞莞类卿'];

// ───────────────────────── 盟友 ─────────────────────────
export interface AllyDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  cost: number;
  rank: number;
  effect: string;
  color: string;
  favor?: number;
  click?: number;
  silver?: number;
  schemeBase?: number;
  schemeMult?: number;
  flip?: number;
  defense?: number;
}

export const ALLIES: AllyDef[] = [
  { id: 'liuzhu', name: '流朱', role: '贴身丫鬟', desc: '「小姐，奴婢帮您。」活泼忠心，陪嫁入宫。', cost: 30, rank: 0, effect: '请安效果 ×2', click: 2, color: '#d47a7a' },
  { id: 'jinxi', name: '崔槿汐', role: '掌事姑姑', desc: '宫中沉浮多年，知道每一道门后站着谁。', cost: 80, rank: 0, effect: '开始积攒心计 +0.25/秒', schemeBase: 0.25, color: '#7a8a9a' },
  { id: 'huanbi', name: '浣碧', role: '陪嫁丫鬟', desc: '心思细密，也有自己的算盘。', cost: 200, rank: 1, effect: '请安 ×1.5，银两 +10%', click: 1.5, silver: 1.1, color: '#9ab07a' },
  { id: 'meizhuang', name: '沈眉庄', role: '闺中密友', desc: '「我与你，情同姐妹，绝无二心。」', cost: 500, rank: 1, effect: '恩宠 +25%', favor: 1.25, color: '#c9a86a' },
  { id: 'wenshichu', name: '温实初', role: '太医', desc: '宫中的每一碗药，都该先经他的手。', cost: 1200, rank: 2, effect: '陷害损失减半，心计 +0.1/秒', defense: 0.5, schemeBase: 0.1, color: '#6a9ab0' },
  { id: 'supeisheng', name: '苏培盛', role: '御前总管', desc: '皇上翻哪块牌子，他离得最近。', cost: 3500, rank: 3, effect: '翻牌权重 +60%', flip: 1.6, color: '#8f7f6f' },
  { id: 'duanfei', name: '端妃', role: '深宫旧人', desc: '「这宫里，我看得比谁都久。」', cost: 8000, rank: 3, effect: '心计 ×1.5', schemeMult: 1.5, color: '#9a7fa0' },
  { id: 'jingfei', name: '敬妃', role: '一宫主位', desc: '数过永寿宫三百二十六块砖，也数得清六宫账目。', cost: 15000, rank: 4, effect: '银两 ×1.5', silver: 1.5, color: '#7f9aa8' },
  { id: 'guojunwang', name: '果郡王', role: '闲散王爷', desc: '「愿得一心人。」他的名字不能提，他的心意却在。', cost: 40000, rank: 4, effect: '恩宠 +50%', favor: 1.5, color: '#5f8f7f' },
  { id: 'yelanyi', name: '叶澜依', role: '驯马女', desc: '她恨华妃，也不爱皇上。她只帮你。', cost: 120000, rank: 5, effect: '心计 ×2', schemeMult: 2, color: '#a05060' },
  { id: 'zhenyuandao', name: '甄远道', role: '父亲', desc: '「女儿，家里一切都好。」宁古塔的风雪，他一字不提。', cost: 300000, rank: 5, effect: '银两 ×2，恩宠 +20%', silver: 2, favor: 1.2, color: '#6f6f8f' },
];
export const ALLY_MAP = Object.fromEntries(ALLIES.map((a) => [a.id, a]));

// ───────────────────────── 珍玩 ─────────────────────────
export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  rank: number;
  effect: string;
  favor?: number;
  flip?: number;
  buffDur?: number;
  schemeMult?: number;
  silver?: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'xiang', name: '鹅梨帐中香', desc: '甄嬛亲手调制，皇上闻之忘返。', cost: 400, rank: 1, effect: '翻牌权重 ×1.4', flip: 1.4 },
  { id: 'luozidai', name: '螺子黛', desc: '一年只进贡三斛，六宫只得其二。', cost: 2000, rank: 2, effect: '恩宠 +20%', favor: 1.2 },
  { id: 'jinlvxie', name: '蜀锦玉鞋', desc: '皇上亲赐，独一无二。', cost: 7000, rank: 3, effect: '银两 +30%', silver: 1.3 },
  { id: 'dongzhu', name: '东珠头面', desc: '只有皇后与贵妃才可佩戴的东珠。', cost: 30000, rank: 4, effect: '恩宠 +30%', favor: 1.3 },
  { id: 'tangquan', name: '汤泉行宫', desc: '「朕陪你去汤泉宫，只有你我。」', cost: 90000, rank: 4, effect: '承恩时长 ×2', buffDur: 2 },
  { id: 'hehuan', name: '合欢花', desc: '合欢一枝，寄的是不能说的心事。', cost: 400000, rank: 5, effect: '心计 ×1.5', schemeMult: 1.5 },
];
export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ───────────────────────── 对手 ─────────────────────────
export interface RivalDef {
  id: string;
  name: string;
  title: string;
  power: number;
  appearRank: number;
  challengeRank: number;
  flipWeight: number;
  perk: string;
  fallText: string;
  color: string;
  favor?: number;
  silver?: number;
  schemeMult?: number;
  flip?: number;
  quote: string;
}

export const RIVALS: RivalDef[] = [
  { id: 'xiadongchun', name: '夏冬春', title: '夏常在', power: 40, appearRank: 0, challengeRank: 0, flipWeight: 1, perk: '恩宠 +5%', favor: 1.05, fallText: '夏冬春被赏了一丈红，再也没能站起来。', color: '#c07070', quote: '「你算什么东西，也配跟我说话？」' },
  { id: 'lipin', name: '丽嫔', title: '丽嫔', power: 140, appearRank: 1, challengeRank: 1, flipWeight: 1.5, perk: '恩宠 +10%', favor: 1.1, fallText: '丽嫔被吓疯了，废为庶人。', color: '#b08060', quote: '「本宫看你，就是个没规矩的。」' },
  { id: 'fucha', name: '富察贵人', title: '富察贵人', power: 350, appearRank: 2, challengeRank: 2, flipWeight: 2, perk: '银两 +25%', silver: 1.25, fallText: '富察贵人失子失宠，疯癫度日。', color: '#a08050', quote: '「我可是皇上的贵人，谁敢动我？」' },
  { id: 'caoguiren', name: '曹贵人', title: '曹贵人', power: 900, appearRank: 3, challengeRank: 3, flipWeight: 2, perk: '心计 +25%', schemeMult: 1.25, fallText: '曹琴默反咬华妃，却也没能全身而退。', color: '#8f7f60', quote: '「嫔妾只是替华妃娘娘说句公道话。」' },
  { id: 'qifei', name: '齐妃', title: '齐妃', power: 1800, appearRank: 3, challengeRank: 4, flipWeight: 2.5, perk: '翻牌权重 +20%', flip: 1.2, fallText: '齐妃自尽，三阿哥自此无依。', color: '#a09070', quote: '「本宫的三阿哥，可是长子。」' },
  { id: 'huafei', name: '华妃', title: '华妃', power: 4000, appearRank: 0, challengeRank: 3, flipWeight: 6, perk: '恩宠 ×1.5', favor: 1.5, fallText: '「皇上，你害得世兰好苦！」华妃撞墙而亡。翊坤宫的欢宜香，终于熄了。', color: '#c0303a', quote: '「贱人就是矫情。」' },
  { id: 'anlingrong', name: '安陵容', title: '安嫔', power: 25000, appearRank: 4, challengeRank: 5, flipWeight: 4, perk: '心计 ×1.5', schemeMult: 1.5, fallText: '「这条路是我自己选的。」安陵容吞苦杏仁而死。', color: '#8090b0', quote: '「姐姐，我只是想活着。」' },
  { id: 'qiguiren', name: '祺贵人', title: '祺贵人', power: 80000, appearRank: 5, challengeRank: 6, flipWeight: 4, perk: '翻牌权重 +50%', flip: 1.5, fallText: '祺贵人被废为庶人，乱棍打死于宫门外。', color: '#b06080', quote: '「熹贵妃与温太医私通，人证物证俱在！」' },
  { id: 'huanghou', name: '皇后', title: '皇后', power: 300000, appearRank: 2, challengeRank: 7, flipWeight: 5, perk: '恩宠 ×2', favor: 2, fallText: '「臣妾做不到啊！」皇后被禁足景仁宫，死生不复相见。', color: '#d4a030', quote: '「本宫，才是这后宫的主人。」' },
];
export const RIVAL_MAP = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

// ───────────────────────── 修行（佛心） ─────────────────────────
export interface MeditationDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
  effect: (lvl: number) => string;
}

export const MEDITATIONS: MeditationDef[] = [
  { id: 'jingxin', name: '静心', desc: '甘露寺的青灯，照见的是自己。', max: 25, cost: (l) => Math.ceil(1 * Math.pow(1.45, l)), effect: (l) => `恩宠 +${l * 25}%` },
  { id: 'huigen', name: '慧根', desc: '「凡所有相，皆是虚妄。」宫里的把戏，一眼看穿。', max: 12, cost: (l) => Math.ceil(2 * Math.pow(1.7, l)), effect: (l) => `心计 +${l * 40}%` },
  { id: 'huigong', name: '熹妃回宫', desc: '回宫时的位分，由皇上亲定。', max: 4, cost: (l) => [3, 8, 20, 50][l] ?? 999, effect: (l) => `回宫起始位分：${RANKS[Math.min(l, 4)].name}` },
  { id: 'fozhu', name: '菩提佛珠', desc: '腕上一串佛珠，皇上说：「像极了从前。」', max: 6, cost: (l) => Math.ceil(2 * Math.pow(2, l)), effect: (l) => `翻牌权重 +${l * 30}%` },
  { id: 'changxiang', name: '长相守', desc: '承恩之夜，比从前更长久。', max: 6, cost: (l) => Math.ceil(3 * Math.pow(2, l)), effect: (l) => `承恩加成 ×${(2 + l * 0.5).toFixed(1)}` },
  { id: 'yinlu', name: '苏培盛引路', desc: '有人替你日夜守在御前。', max: 1, cost: () => 5, effect: () => '自动请安 4 次/秒' },
  { id: 'liuren', name: '御前留人', desc: '「朕说了，谁也不许动她。」', max: 1, cost: () => 8, effect: () => '所有陷害损失减半' },
  { id: 'pingfan', name: '宁古塔平反', desc: '父亲回京，甄氏满门荣耀。', max: 1, cost: () => 10, effect: () => '银两 ×3' },
  { id: 'liugong', name: '六宫自理', desc: '六宫诸事，自有人替你打点。', max: 1, cost: () => 15, effect: () => '每秒自动购置最划算的宫人' },
];
export const MEDITATION_MAP = Object.fromEntries(MEDITATIONS.map((m) => [m.id, m]));

// ───────────────────────── 成就 ─────────────────────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first', name: '初入宫闱', desc: '第一次请安' },
  { id: 'a_click100', name: '一颦一笑', desc: '请安 200 次' },
  { id: 'a_combo', name: '圣心大悦', desc: '第一次触发连击圆满' },
  { id: 'a_bed', name: '侍寝', desc: '第一次被翻牌子' },
  { id: 'a_bed10', name: '专房之宠', desc: '侍寝 10 次' },
  { id: 'a_guiren', name: '莞贵人', desc: '晋升贵人' },
  { id: 'a_yizhanghong', name: '一丈红', desc: '扳倒夏冬春' },
  { id: 'a_huafei', name: '贱人就是矫情', desc: '扳倒华妃' },
  { id: 'a_meiyuan', name: '逆风如解意', desc: '拥有倚梅园' },
  { id: 'a_ganlu', name: '甘露寺', desc: '第一次出宫修行' },
  { id: 'a_xifei', name: '熹妃回宫', desc: '出宫后重回妃位' },
  { id: 'a_twins', name: '双生子', desc: '拥有 2 位皇嗣' },
  { id: 'a_huanghou', name: '臣妾做不到啊', desc: '扳倒皇后' },
  { id: 'a_taihou', name: '圣母皇太后', desc: '登上太后之位' },
  { id: 'a_silver', name: '富可敌国', desc: '累计获得 10 万银两' },
  { id: 'a_favor', name: '恩宠万千', desc: '累计获得 1 亿恩宠' },
  { id: 'a_allies', name: '众星捧月', desc: '结交全部盟友' },
  { id: 'a_era', name: '新朝', desc: '开启新的朝代' },
];

// ───────────────────────── 事件 ─────────────────────────
export const EVENTS: GameEvent[] = [
  {
    id: 'yimeiyuan', title: '倚梅园祈福', once: true, weight: 8, maxRank: 2,
    text: '除夕夜，你避开宴席，独自到倚梅园。雪落无声，你把剪纸小像挂在梅枝上，轻声许愿。远处似有人来。',
    choices: [
      { label: '「逆风如解意，容易莫摧残。」', hint: '大声念出心愿。有人会听见——是谁却说不准。', chance: 0.7,
        success: { text: '来人自称果郡王，其实是皇上。此后他念念不忘梅园里那个女子。', favorSec: 240, buffSec: 40 },
        fail: { text: '余莺儿冒认了你的诗句，得了赏。你只得默默记下这笔账。', schemeFlat: 6 } },
      { label: '悄悄祈愿，转身离去', hint: '稳妥。', effect: { text: '你许了愿：愿父母安康，愿在宫中平安终老。梅香满衣。', favorSec: 60 } },
    ],
  },
  {
    id: 'yuyinger', title: '御花园的余答应', once: true, minRank: 0, maxRank: 2,
    text: '余莺儿如今得了宠，在御花园拦住你的去路：「见了本主子，还不请安？」',
    choices: [
      { label: '恭敬请安', effect: { text: '你低头行礼。她得意离去，你记住了她的每一句话。', schemeFlat: 5 } },
      { label: '「余答应，你的规矩，是跟谁学的？」', costSchemeMin: 2, effect: { text: '你一句话把她问住了。此事传到皇上耳中，余氏很快失宠。', favorSec: 90 } },
    ],
  },
  {
    id: 'yuhuayuan', title: '御花园偶遇', minRank: 0,
    text: '午后，皇上在御花园漫步。你正好在池边。',
    choices: [
      { label: '上前请安', effect: { text: '皇上与你说了几句话，心情颇好。', favorSec: 45 } },
      { label: '在假山后吹一曲笛', requireProducer: 'qinyi', hint: '需要琴棋书画', effect: { text: '笛声悠扬，皇上循声而来，竟坐下听了一个时辰。', favorSec: 150, buffSec: 20 } },
      { label: '避开', effect: { text: '你远远看着，看清了跟在皇上身后的每一个人。', schemeFlat: 4 } },
    ],
  },
  {
    id: 'huanghou_qingan', title: '景仁宫请安', minRank: 1, rivalAlive: 'huanghou', rivalAppeared: 'huanghou',
    text: '每日请安，皇后借故留下你：「妹妹近来得宠，可要谨记本分。」',
    choices: [
      { label: '恭听教诲', effect: { text: '皇后满意地点头，赏了你两匹缎子。', silverMin: 8 } },
      { label: '巧言应对', chance: 0.6, success: { text: '你不卑不亢，皇后挑不出错处。众人对你刮目相看。', favorSec: 60 }, fail: { text: '一句话说错了。皇后微微一笑：「妹妹果然伶俐。」你知道这不是夸奖。', favorPct: -8 } },
    ],
  },
  {
    id: 'muxufen', title: '木薯粉之祸', once: true, minRank: 1, maxRank: 4, rivalAlive: 'huafei',
    text: '温宜公主突然呕吐。曹贵人指认：是你送去的木薯粉有毒。翊坤宫里，华妃的眼神像刀。',
    choices: [
      { label: '据理自辩', chance: 0.5, success: { text: '你当场以木薯粉为公主做了一碗糕点，亲自尝了。华妃无话可说。', favorSec: 80 }, fail: { text: '百口莫辩。你被罚俸禁足，碎玉轩冷清了许多。', favorPct: -20 } },
      { label: '请温太医验证', requireAlly: 'wenshichu', effect: { text: '温实初一验便知，木薯粉煮熟便无毒。反倒是曹贵人下不来台。', favorSec: 100, rivalPower: [{ id: 'caoguiren', pct: -20 }] } },
      { label: '认罚', effect: { text: '你跪下认罚。华妃冷笑：「算你识相。」', favorPct: -10, schemeFlat: 8 } },
    ],
  },
  {
    id: 'huafei_fagui', title: '翊坤宫罚跪', minRank: 1, rivalAlive: 'huafei',
    text: '华妃说你请安来迟，罚你跪在烈日下。「本宫倒要看看，皇上什么时候想起你。」',
    choices: [
      { label: '硬撑', effect: { text: '你跪到日落，回宫时双膝血肉模糊。你记下了这一天。', favorPct: -12, schemeFlat: 10 } },
      { label: '眉庄前来求情', requireAlly: 'meizhuang', effect: { text: '眉庄以皇上口谕为由把你带走。华妃气得摔了茶盏。', favorPct: -3 } },
      { label: '打点周宁海', costSilverMin: 15, effect: { text: '周宁海收了银子，在华妃面前说你身子弱，只跪了半个时辰。', favorPct: 0 } },
    ],
  },
  {
    id: 'jinghongwu', title: '惊鸿舞', once: true, minRank: 2, maxRank: 5, rivalAlive: 'huafei',
    text: '温宜公主生辰宴上，华妃当众逼你起舞：「莞贵人不是最会跳舞么？」满殿的眼睛都看着你。',
    choices: [
      { label: '一舞惊鸿', effect: { text: '「翩若惊鸿，婉若游龙。」你一舞惊四座，皇上目不转睛。华妃脸色铁青。', favorSec: 300, buffSec: 45, rivalPower: [{ id: 'huafei', pct: 8 }] } },
      { label: '请眉庄抚琴相和', requireAlly: 'meizhuang', effect: { text: '琴舞相和，惊鸿一舞成了宫中传奇。你与眉庄，情同姐妹。', favorSec: 420, buffSec: 45 } },
      { label: '推辞', effect: { text: '你以身子不适推辞。华妃冷笑，皇上也略显失望。', favorPct: -5 } },
    ],
  },
  {
    id: 'nian_dajie', title: '年羹尧大捷', minRank: 2, rivalAlive: 'huafei',
    text: '前朝传来消息：年羹尧西北大捷。华妃气焰更盛，六宫皆去翊坤宫道贺。',
    choices: [
      { label: '随众道贺', effect: { text: '你送去贺礼。华妃收下了，看都没看你一眼。', rivalPower: [{ id: 'huafei', pct: 10 }], silverMin: -5 } },
      { label: '向皇上进言：功高震主', costSchemeMin: 4, chance: 0.7, success: { text: '皇上沉默良久，说：「你说的，朕都知道。」年氏一族，从此埋下祸根。', rivalPower: [{ id: 'huafei', pct: -12 }], favorSec: 60 }, fail: { text: '皇上皱眉：「后宫不得干政。」你被斥退。', favorPct: -10 } },
    ],
  },
  {
    id: 'shuhenjiao', title: '舒痕胶', once: true, minRank: 3, rivalAppeared: 'anlingrong',
    text: '安陵容送来一盒舒痕胶，说是能去疤：「姐姐，这是我亲手调的。」',
    choices: [
      { label: '欣然收下，日日敷用', effect: { text: '疤痕淡了。但你不知道，里面掺了麝香。', favorSec: 50, rivalPower: [{ id: 'anlingrong', pct: 30 }] } },
      { label: '请温实初查验', requireAlly: 'wenshichu', effect: { text: '温实初一闻便变了脸色：「有麝香。」你握着那盒舒痕胶，久久无言。', rivalPower: [{ id: 'anlingrong', pct: -20 }], schemeFlat: 20 } },
      { label: '收下，束之高阁', effect: { text: '你谢了她，却没有用。有些东西，直觉比证据先到。', schemeFlat: 10 } },
    ],
  },
  {
    id: 'huanghou_shang', title: '景仁宫的赏赐', minRank: 2, rivalAlive: 'huanghou', rivalAppeared: 'huanghou',
    text: '皇后遣人送来一匣珠宝：「本宫向来赏罚分明。」',
    choices: [
      { label: '恭敬收下', effect: { text: '珠宝入库。皇后的人情，也一并记在了账上。', silverMin: 25, rivalPower: [{ id: 'huanghou', pct: 5 }] } },
      { label: '婉言谢绝', effect: { text: '皇后笑意更深了：「妹妹真是懂事。」', schemeFlat: 12 } },
    ],
  },
  {
    id: 'guojunwang_hehuan', title: '合欢花', once: true, minRank: 3,
    text: '有人托浣碧送来一枝合欢花，并无署名。你知道是谁。',
    choices: [
      { label: '插在案头', chance: 0.8, success: { text: '合欢开了三日。没有人问起。', schemeFlat: 25 }, fail: { text: '皇上偶然看见，问是谁送的。你答不上来。', favorPct: -10 } },
      { label: '焚毁', effect: { text: '花在火盆里蜷成灰。你对自己说：宫里没有合欢。', favorSec: 30 } },
    ],
  },
  {
    id: 'zhenfu', title: '父亲入狱', once: true, minRank: 3,
    text: '甄远道被人弹劾，下了大狱。有人劝你不要牵连其中。',
    choices: [
      { label: '跪求皇上', effect: { text: '皇上免了父亲死罪，改判流放宁古塔。你的恩宠，也因此打了折扣。', favorPct: -15 } },
      { label: '沉默', effect: { text: '你什么都没做。夜里，碎玉轩的灯亮到天明。', schemeMin: 6 } },
    ],
  },
  {
    id: 'chunyuan', title: '纯元故衣', once: true, weight: 100, minRank: 4, maxPrestige: 0,
    text: '册封礼上，你穿了皇后送来的吉服——那是纯元皇后的故衣。皇上震怒，把你推倒在地：「莞莞类卿，朕拿你当什么？」你终于明白，这些年的恩宠，从来不是给你的。',
    choices: [
      { label: '跪地求饶', effect: { text: '皇上拂袖而去。此后他再未踏进碎玉轩。', favorPct: -30, unlockPrestige: true } },
      { label: '「臣妾……愿出宫修行。」', effect: { text: '你自请出宫。碎玉轩的门关上时，你没有回头。（甘露寺修行已解锁）', favorPct: -50, enlightenment: 1, unlockPrestige: true } },
    ],
  },
  {
    id: 'anlingrong_song', title: '安陵容的歌声', minRank: 4, rivalAlive: 'anlingrong', rivalAppeared: 'anlingrong',
    text: '安陵容以歌声得宠，皇上连着数夜宿在延禧宫。',
    choices: [
      { label: '静观其变', effect: { text: '你什么都没说。宫里最不缺的，就是耐心。', schemeFlat: 8 } },
      { label: '送去一碟冰糖', costSilverMin: 10, effect: { text: '安陵容嗓子哑了。她盯着那碟冰糖看了很久。', rivalPower: [{ id: 'anlingrong', pct: -10 }] } },
    ],
  },
  {
    id: 'tangyao', title: '一碗安神汤', minRank: 2,
    text: '太医院送来一碗安神汤。端汤的宫女神色有些不对。',
    choices: [
      { label: '饮下', chance: 0.6, success: { text: '汤没有问题。你睡了个好觉。', favorSec: 50 }, fail: { text: '汤里有东西。你病了半月，皇上只来看过一次。', favorPct: -15 } },
      { label: '悄悄倒掉', effect: { text: '你把汤倒进了花盆。第二天，花死了。', schemeFlat: 6 } },
      { label: '请温实初查验', requireAlly: 'wenshichu', effect: { text: '温实初查出汤里有夹竹桃。你顺藤摸瓜，揪出了幕后之人。', favorSec: 80, schemeFlat: 15 } },
    ],
  },
  {
    id: 'qiguiren_tiaoxin', title: '祺贵人的挑衅', minRank: 5, rivalAlive: 'qiguiren', rivalAppeared: 'qiguiren',
    text: '祺贵人当众说：「有些人出宫又回宫，身子还干不干净，谁知道呢？」',
    choices: [
      { label: '一笑置之', effect: { text: '你笑而不语。她的话，众人也只当笑话听。', schemeFlat: 10 } },
      { label: '「祺贵人这话，是替谁问的？」', costSchemeMin: 3, effect: { text: '你一句话把皇后也牵扯进来。祺贵人吓得跪了下去。', rivalPower: [{ id: 'qiguiren', pct: -15 }], favorSec: 80 } },
    ],
  },
  {
    id: 'dixueyanqin', title: '滴血验亲', once: true, weight: 20, minRank: 5, requirePrestige: 1, rivalAlive: 'huanghou',
    text: '祺贵人告发你与温实初私通，人证物证「俱全」。皇后端坐上首：「那便滴血验亲吧。」满殿死寂。',
    choices: [
      { label: '泰然请验', chance: 0.7, success: { text: '血相融的那一刻，你说：「这水里有白矾。」一切反转。祺贵人被拖了出去。', favorSec: 400, rivalPower: [{ id: 'qiguiren', pct: -70 }, { id: 'huanghou', pct: -10 }] }, fail: { text: '你险些翻不过身。虽然保住了性命，皇上心里到底存了疑。', favorPct: -40 } },
      { label: '以心计破局', costSchemeMin: 8, effect: { text: '你早已布好每一步：静白、玢儿、白矾……皇后的局，反过来困住了皇后自己。', favorSec: 500, rivalPower: [{ id: 'qiguiren', pct: -90 }, { id: 'huanghou', pct: -15 }] } },
    ],
  },
  {
    id: 'huangshang_bing', title: '皇上病重', once: true, minRank: 7,
    text: '皇上病重，召你侍疾。他握着你的手，叫的却是另一个名字。',
    choices: [
      { label: '尽心侍奉', effect: { text: '你日夜守在榻前。他说：「嬛嬛，你是最像她的。」你说：「臣妾从来只是臣妾。」', favorSec: 600 } },
      { label: '「皇上，臣妾有话要说。」', effect: { text: '你把这些年的事，一件一件讲给他听。他听完，再没说过话。', schemeMin: 20, rivalPower: [{ id: 'huanghou', pct: -20 }] } },
    ],
  },
  {
    id: 'meizhuang_zi', title: '眉庄有孕', once: true, minRank: 4,
    text: '眉庄悄悄告诉你，她有孕了。孩子的父亲，不是皇上。',
    choices: [
      { label: '替她瞒下', costSchemeMin: 3, effect: { text: '你替她打点了太医院上下。这个秘密，你们带进了棺材。', favorSec: 60, schemeFlat: 20 } },
      { label: '劝她小心', effect: { text: '眉庄握着你的手：「我这一生，只信你一个。」', favorSec: 40 } },
    ],
  },
  {
    id: 'xuexia', title: '大雪封宫', minRank: 0,
    text: '大雪三日。碎玉轩的炭不够了，内务府推说无炭可拨。',
    choices: [
      { label: '花银子打点内务府', costSilverMin: 6, effect: { text: '炭送来了，还是上好的银霜炭。', favorSec: 30 } },
      { label: '忍着', effect: { text: '你与丫鬟们挤在一处取暖。这一夜，你把内务府总管的名字记住了。', schemeFlat: 5 } },
    ],
  },
];
export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// 常量
export const DAY_LENGTH = 48; // 秒
export const FLIP_TIME = 0.74; // 戌时
export const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const OFFLINE_CAP = 8 * 3600;
export const OFFLINE_RATE = 0.5;
