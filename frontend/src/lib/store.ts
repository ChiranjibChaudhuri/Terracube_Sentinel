import { create } from 'zustand'

interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  apiEndpoint: string
  setApiEndpoint: (url: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  apiEndpoint: '/graphql',
  setApiEndpoint: (url: string) => set({ apiEndpoint: url }),
}))
