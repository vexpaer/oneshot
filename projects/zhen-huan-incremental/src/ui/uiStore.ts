import { create } from 'zustand';

export type Tab = 'gongwu' | 'jimou' | 'renmai' | 'cangpin' | 'xiuxing';

interface UIStore {
  tab: Tab;
  setTab: (t: Tab) => void;
  selectedRival: string | null;
  selectRival: (id: string | null) => void;
  hover: string | null;
  setHover: (id: string | null) => void;
  buyMode: 1 | 10 | 'max';
  setBuyMode: (m: 1 | 10 | 'max') => void;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
}

export const useUI = create<UIStore>((set) => ({
  tab: 'gongwu',
  setTab: (tab) => set({ tab }),
  selectedRival: null,
  selectRival: (id) => set((st) => ({ selectedRival: id, tab: id ? 'jimou' : st.tab, drawer: id ? true : st.drawer })),
  hover: null,
  setHover: (hover) => set({ hover }),
  buyMode: 1,
  setBuyMode: (buyMode) => set({ buyMode }),
  drawer: false,
  setDrawer: (drawer) => set({ drawer }),
}));
