import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  durationMs?: number;
}

export interface UiState {
  isSidebarCollapsed: boolean;
  activeTheme: 'dark' | 'light';
  toasts: ToastMessage[];
  isCommandPaletteOpen: boolean;
}

const initialState: UiState = {
  isSidebarCollapsed: false,
  activeTheme: 'dark',
  toasts: [],
  isCommandPaletteOpen: false
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload;
    },
    toggleCommandPalette: (state) => {
      state.isCommandPaletteOpen = !state.isCommandPaletteOpen;
    },
    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.isCommandPaletteOpen = action.payload;
    },
    addToast: (state, action: PayloadAction<Omit<ToastMessage, 'id'>>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      state.toasts.push({ ...action.payload, id });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    }
  }
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleCommandPalette,
  setCommandPaletteOpen,
  addToast,
  removeToast
} = uiSlice.actions;
export default uiSlice.reducer;
