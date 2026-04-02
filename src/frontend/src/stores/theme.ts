import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  dark: localStorage.getItem("theme") === "dark",
  toggle: () => {
    const next = !get().dark;
    set({ dark: next });
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  },
}));

// Apply on load
if (
  localStorage.getItem("theme") === "dark" ||
  (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
  useTheme.setState({ dark: true });
}
