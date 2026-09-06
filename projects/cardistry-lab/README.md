# CARDISTRY LAB · 花切实验室

一个纯前端的 **3D 花切动作可视化与教学系统**。双手 3D 模型 + 程序化生成的 52 张扑克牌，在漂浮于黑暗空间中的“动作博物馆”里演示常见花切动作。

## 动作库

| 动作 | 类型 | 说明 |
| --- | --- | --- |
| Charlier Cut | 单手切牌 | 下包被食指顶起、上包落下、下包合拢 |
| Revolution Cut | 单手切牌 | 下包绕食指 360° 翻转 |
| Swing Cut | 双手切牌 | 食指勾起上包摆入左手 |
| Thumb Cut | 双手切牌 | 拇指踢出上包，右手送到底部 |
| Sybil · Five Faces | 四包展示 | 摆出 / 旋出 / 垂下 的四包空间展示 |
| WERM (basic) | 三包展示 | 以长边为轴依次翻转的蠕动结构 |
| Thumb Fan / Pressure Fan | 扇形 | 52 张牌逐张展开 + 压力扇 |
| Packet Display | 三包展示 | 竖 / 侧 / 平 三包定格 |

## 功能

- **三种模式**：自由观看 / 教学模式（高亮手指、牌包、运动路径、接触点、标签）/ 分解模式（逐步播放，每步配说明）
- **播放控制**：播放、暂停、上一步、下一步、重播、0.5x / 1x / 1.5x、时间轴拖动
- **六个视角**：正视、观众、侧视、顶视、手指特写（自动追踪活动手指）、自由旋转
- **辅助层**：幽灵残影、Packet 结构爆炸视图、透明牌、线框 / 骨架模式
- **Finger Focus**：点击 Thumb / Index / Middle / Ring / Pinky，追踪该手指并高亮
- **Compare Mode**：左右分屏同步对比两个动作（如 Charlier vs Revolution）

快捷键：`Space` 播放/暂停 · `←/→` 步骤 · `R` 重播 · `G/E/T/W` 残影/爆炸/透明/线框 · `1–6` 视角

## 技术

React 19 · Vite · Three.js（@react-three/fiber + drei）· Zustand · Tailwind CSS。
所有牌、手、纹理均为程序化生成，无外部资产；动画为关键帧插值系统（牌包支持任意局部枢轴旋转 / 扇形 / 弯曲）。

## 部署到 GitHub Pages

构建产物是**单个** `dist/index.html`（所有 JS/CSS 已内联），任何子路径都能直接运行。

1. 推送到 GitHub，在仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。
2. 自带的 `.github/workflows/deploy.yml` 会在 push 到 `main` 时自动构建并发布。

或手动：`npm run build` 后把 `dist/index.html` 上传到任意静态托管。
