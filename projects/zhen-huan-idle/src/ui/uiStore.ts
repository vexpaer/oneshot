import { create } from 'zustand';

export type Tab = 'court' | 'allies' | 'intrigue' | 'cultivate' | 'annals';

interface UIState {
  tab: Tab;
  selectedRival: string | null;
  buyQty: 1 | 10 | 'max';
  panelOpen: boolean;
  setTab: (t: Tab) => void;
  selectRival: (id: string | null) => void;
  setBuyQty: (q: 1 | 10 | 'max') => void;
  togglePanel: () => void;
}

export const useUI = create<UIState>((set) => ({
  tab: 'court',
  selectedRival: null,
  buyQty: 1,
  panelOpen: true,
  setTab: (tab) => set({ tab, panelOpen: true }),
  selectRival: (id) => set({ selectedRival: id, tab: 'intrigue', panelOpen: true }),
  setBuyQty: (buyQty) => set({ buyQty }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));
