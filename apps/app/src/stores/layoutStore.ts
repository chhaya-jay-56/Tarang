import { create } from "zustand";

type LayoutStore = {
  isSidebarOpen: boolean;
  isCollapsed: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  toggleCollapse: () => void;
};

export const useLayoutStore = create<LayoutStore>((set) => ({
  isSidebarOpen: false,
  isCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
}));
