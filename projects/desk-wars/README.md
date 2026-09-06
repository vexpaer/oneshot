# Desk Wars

A browser-playable 3D wave shooter built with **Three.js + React + Vite**.
You are a few centimetres tall, fighting hostile desk machines across a giant workspace –
the keyboard is a fortress, the mug is a tower, the lamp is the sun.

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Sprint | `Shift` |
| Jump | `Space` |
| Dash | `E` / `Q` / Right mouse |
| Fire | Left mouse |
| Reload | `R` |
| Pause | `Esc` / `P` |

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build uses `vite-plugin-singlefile`, so `dist/index.html` is a **single self-contained file** –
all JS, CSS and textures are inlined. You can open it directly or host it anywhere.

## 部署到 GitHub Pages（Deploy to GitHub Pages）

仓库中已包含 `.github/workflows/deploy.yml`，推送后自动构建并部署。

1. 把项目推送到 GitHub（分支 `main` 或 `master`）。
2. 打开仓库 **Settings → Pages**，在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 每次推送到 `main` 会自动触发构建；完成后可在
   `https://<你的用户名>.github.io/<仓库名>/` 访问游戏。

> 由于构建产物是单个 `index.html`（资源全部内联），无论是用户主页仓库还是项目仓库都无需额外配置 `base` 路径。
> 工作流中使用了 `--base=./`，以确保相对路径在任何子目录下都能工作。

手动部署（不使用 Actions）也可以：运行 `npm run build -- --base=./`，然后把 `dist/` 目录的内容推送到 `gh-pages` 分支即可。

## Tech notes

- Custom AABB / cylinder collision world with step-up, used by the player, enemies and hitscan rays.
- All sound effects and music are synthesized at runtime with the Web Audio API – no audio assets.
- Procedural textures (wood grain, keycap legend atlas with backlit emissive legends, paper, sticky notes).
- Post-processing (high quality): MSAA, bloom, depth of field. Adjustable in Settings.
