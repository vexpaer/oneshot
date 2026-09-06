import { create } from "zustand";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type LocationId =
  | "about"
  | "projects"
  | "notes"
  | "gallery"
  | "experiments"
  | "contact"
  | "flower";

export type FlyTarget = LocationId | "overview" | "micro" | "macro";

interface WorldState {
  entered: boolean;
  enter: () => void;
  season: Season;
  setSeason: (s: Season) => void;
  flyRequest: { target: FlyTarget; nonce: number } | null;
  flyTo: (target: FlyTarget) => void;
  nearLocation: LocationId | "micro" | null;
  setNear: (id: LocationId | "micro" | null) => void;
  scale: "macro" | "micro";
  setScale: (s: "macro" | "micro") => void;
  fade: boolean;
  setFade: (f: boolean) => void;
  muted: boolean;
  toggleMute: () => void;
  hovered: string | null;
  setHovered: (h: string | null) => void;
  focusItem: string | null;
  setFocusItem: (id: string | null) => void;
  quality: "low" | "high";
  timeAuto: boolean;
  setTimeAuto: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
}

const isMobile =
  typeof navigator !== "undefined" &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency || 8) <= 4);

export const useStore = create<WorldState>((set) => ({
  entered: false,
  enter: () => set({ entered: true }),
  season: "summer",
  setSeason: (season) => set({ season }),
  flyRequest: null,
  flyTo: (target) => set({ flyRequest: { target, nonce: Date.now() + Math.random() } }),
  nearLocation: null,
  setNear: (nearLocation) => set({ nearLocation }),
  scale: "macro",
  setScale: (scale) => set({ scale }),
  fade: false,
  setFade: (fade) => set({ fade }),
  muted: false,
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  hovered: null,
  setHovered: (hovered) => set({ hovered }),
  focusItem: null,
  setFocusItem: (focusItem) => set({ focusItem }),
  quality: isMobile ? "low" : "high",
  timeAuto: true,
  setTimeAuto: (timeAuto) => set({ timeAuto }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));

export const IS_MOBILE = isMobile;
