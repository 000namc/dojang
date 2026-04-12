import { create } from "zustand";

const STORAGE_KEY = "claude-bypass";

interface BypassState {
  bypass: boolean;
  toggle: () => void;
  set: (value: boolean) => void;
}

export const useBypass = create<BypassState>((set, get) => ({
  bypass: localStorage.getItem(STORAGE_KEY) === "1",
  toggle: () => {
    const next = !get().bypass;
    set({ bypass: next });
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  },
  set: (value: boolean) => {
    set({ bypass: value });
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  },
}));
