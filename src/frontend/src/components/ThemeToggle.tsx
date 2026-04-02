import { Sun, Moon } from "lucide-react";
import { useTheme } from "../stores/theme";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
      title={dark ? "라이트 모드" : "다크 모드"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
