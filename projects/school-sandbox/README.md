# 山城校园 3D · Hillside Campus

基于校园俯视图还原的可游玩 3D 山地校园（React + Vite + Three.js + Tailwind），纯前端、零后端，可直接部署到 GitHub Pages。

## 玩法

| 模式 | 说明 |
| --- | --- |
| 🌳 创造模式 | 第一人称漫步（可开飞行），放置 24 种模型（石头 / 树木 / 灌木 / 木箱 / 路灯 / 垃圾桶 / 长椅 / 花坛 / 雕像 / 篮球架 …），可旋转缩放、撤销、存档，并把整个世界 **导出为 GLB 3D 模型** |
| ✏️ 战斗模式 | 用巨型铅笔、钢尺、投掷橡皮、连发订书机对抗波次敌人：暴走课本、作业狂人、粉笔幽灵、墨水史莱姆、自爆闹钟，每 5 波出现 Boss「巨型字典」 |

### 操作

- `W A S D` 移动，`Shift` 冲刺，`空格` 跳跃，`V` 切换飞行（空格上升 / C 下降），`Esc` 打开面板
- 创造：`左键` 放置，`右键` 删除，`滚轮` / `1-9` 切换道具，`Q/E` 旋转，`R/F` 缩放，`Z` 撤销
- 战斗：`左键` 攻击（订书机可按住连发），`1-4` / `滚轮` 切换武器，`R` 重开

## 本地运行

```bash
npm install
npm run dev
```

## 部署到 GitHub Pages

项目使用 `vite-plugin-singlefile`，构建产物是**单个 `dist/index.html`**，不依赖任何相对路径资源，因此在任何子路径下都能运行。

### 方式一：GitHub Actions（推荐）

1. 把仓库推送到 GitHub（默认分支 `main` 或 `master`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 会在每次 push 后自动构建并发布，访问 `https://<用户名>.github.io/<仓库名>/`。

### 方式二：手动

```bash
npm run build
```

把 `dist/index.html` 上传到 `gh-pages` 分支根目录（或 `docs/` 目录并在 Pages 设置中选择它）即可。

## 技术要点

- 地形：程序化高度场（西北山体 + 台地平整）+ 2048px 俯视 Canvas 贴图（球场、跑道、道路、广场、水塘均按俯视图绘制）
- 建筑：按俯视图像素坐标换算的 40+ 栋建筑（圆形图书馆、弧形教学楼、红色天桥、坡顶礼堂、体育馆等），程序化立面贴图
- 植被 / 岩石：InstancedMesh 实例化渲染，上千棵树仅数次绘制调用
- 导出：`GLTFExporter` 二进制 GLB，包含实例化（EXT_mesh_gpu_instancing）与贴图
- 音效：WebAudio 实时合成，无外部资源
