import * as THREE from "three";
import { terrainHeight } from "./world";
import type { LocationId } from "./store";

export interface Location {
  id: LocationId;
  name: string;
  cn: string;
  anchor: THREE.Vector3; // ground anchor
  camOffset: THREE.Vector3; // camera position relative to anchor
  lookOffset: THREE.Vector3; // look target relative to anchor
  radius: number; // reveal radius
}

function loc(
  id: LocationId,
  name: string,
  cn: string,
  x: number,
  z: number,
  camOffset: [number, number, number],
  lookOffset: [number, number, number],
  radius: number,
  yOffset = 0
): Location {
  return {
    id,
    name,
    cn,
    anchor: new THREE.Vector3(x, terrainHeight(x, z) + yOffset, z),
    camOffset: new THREE.Vector3(...camOffset),
    lookOffset: new THREE.Vector3(...lookOffset),
    radius,
  };
}

export const LOCATIONS: Location[] = [
  loc("about", "The Elder Tree", "古树", -16, -6, [7, 4.5, 11], [0, 5, 0], 14),
  loc("projects", "Valley Stones", "山谷石碑", 18, 14, [-1, 3.8, 9.5], [0, 1.4, 0], 12),
  loc("notes", "The Treehouse", "树屋", 14, -18, [-6.5, 8.5, 7], [0, 7.2, 0], 12),
  loc("gallery", "Lake of Lights", "光之湖", 0, 10, [0, 3.2, 13], [0, 0.4, 0], 13, 0),
  loc("experiments", "Crystal Cave", "晶石洞穴", -27, 23, [8.5, 2.6, -3.9], [0, 1.8, 0], 11),
  loc("contact", "Sky Lookout", "山顶观景台", 30, -8, [-5.5, 3.2, 5.5], [0, 1.9, 0], 10),
  loc("flower", "A Wild Flower", "野花", -5, -3, [1.6, 1.4, 2.2], [0, 1.1, 0], 4),
];

// gallery anchor sits at water level
LOCATIONS.find((l) => l.id === "gallery")!.anchor.y = -1.4;

export const OVERVIEW = {
  pos: new THREE.Vector3(-9, 7.5, 36),
  look: new THREE.Vector3(0, 2, 6),
};
export const INTRO = {
  pos: new THREE.Vector3(10, 42, 90),
  look: new THREE.Vector3(0, 2, 8),
};
export const MICRO_ORIGIN = new THREE.Vector3(0, -300, 0);

export const CONTENT = {
  about: {
    title: "About · 关于",
    lines: [
      "I build living things out of code — landscapes, light, and small systems that breathe.",
      "我是一名创意开发者，痴迷于自然、生成艺术与实时 3D。这个山谷是我的作品集，也是我练习“慢下来观察”的地方。",
      "Tools I grow with: Three.js · WebGL/GLSL · React · Procedural generation · Sound design.",
    ],
    rings: ["2019 · first shader", "2021 · generative forests", "2023 · sound + space", "now · this valley"],
  },
  projects: [
    { id: "p1", title: "Windfield", cn: "风场", desc: "Real-time wind simulation driving 200k grass blades.", tags: ["GLSL", "instancing"] },
    { id: "p2", title: "Tidewriter", cn: "潮书", desc: "Poems that appear and dissolve with a procedural tide.", tags: ["WebGL", "typography"] },
    { id: "p3", title: "Mycelium", cn: "菌丝", desc: "Slime-mould inspired network growth on GPU.", tags: ["compute", "bio-art"] },
    { id: "p4", title: "Lantern Map", cn: "灯笼地图", desc: "A city night map where every light hums a note.", tags: ["data", "audio"] },
    { id: "p5", title: "Moss Atlas", cn: "苔藓志", desc: "Macro photography archive with a 3D moss viewer.", tags: ["photo", "3D"] },
  ],
  notes: [
    { date: "Spring", title: "On slowness", text: "A scene is finished when it has room to be quiet." },
    { date: "Summer", title: "Noise is a garden", text: "Layer octaves like soil: coarse below, fine on top." },
    { date: "Autumn", title: "Light is the material", text: "Most 'realism' is just correct shadows and restraint." },
    { date: "Winter", title: "Empty branches", text: "Silhouettes teach you what a tree really is." },
  ],
  gallery: [
    { src: "./images/g1.jpg", title: "Morning Mist", cn: "晨雾" },
    { src: "./images/g2.jpg", title: "Fern Light", cn: "蕨光" },
    { src: "./images/g3.jpg", title: "Still Water", cn: "静水" },
    { src: "./images/g4.jpg", title: "First Frost", cn: "初霜" },
  ],
  experiments: [
    { id: "e1", title: "Volumetric mist", cn: "体积雾", note: "Layered sprites + depth fade", color: "#7fd8e8" },
    { id: "e2", title: "GPU fireflies", cn: "GPU 萤火", note: "Pointer-repelled, all in vertex shader", color: "#c6f07a" },
    { id: "e3", title: "Seasonal blend", cn: "季节混合", note: "One vec4 drives every material", color: "#e9a3ff" },
    { id: "e4", title: "Procedural bark", cn: "程序树皮", note: "Lathe + fbm ridges", color: "#ffd27a" },
    { id: "e5", title: "Analytic ground ray", cn: "解析地面射线", note: "Ray-march the heightfield, no raycaster", color: "#8fb6ff" },
  ],
  contact: [
    { label: "Email", value: "hello@nature-explorer.dev", href: "mailto:hello@nature-explorer.dev" },
    { label: "GitHub", value: "github.com/nature-explorer", href: "https://github.com" },
    { label: "Instagram", value: "@nature.explorer", href: "https://instagram.com" },
    { label: "Read.cv", value: "read.cv/explorer", href: "https://read.cv" },
  ],
};
