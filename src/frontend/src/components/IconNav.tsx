import { Home, GraduationCap, Layers, Compass, Settings, Sun, Moon, User } from "lucide-react";
import { cn } from "../lib/cn";
import { useTheme } from "../stores/theme";

export type ViewType = "home" | "learn" | "subjects" | "community";

interface IconNavProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const navItems: { view: ViewType; icon: typeof Home; label: string }[] = [
  { view: "home", icon: Home, label: "Home" },
  { view: "learn", icon: GraduationCap, label: "Learn" },
  { view: "subjects", icon: Layers, label: "Topics" },
  { view: "community", icon: Compass, label: "Explore" },
];

export default function IconNav({ activeView, onViewChange, className }: IconNavProps) {
  const { dark, toggle } = useTheme();

  return (
    <div
      className={cn(
        "flex flex-col items-center w-[72px] shrink-0 py-3 gap-1",
        "bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800",
        className,
      )}
    >
      {navItems.map(({ view, icon: Icon, label }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors w-14",
            activeView === view
              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-600 dark:hover:text-gray-300",
          )}
        >
          <Icon size={22} />
          <span className="text-[10px] font-medium leading-none">{label}</span>
        </button>
      ))}

      <button
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors w-14",
          "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-600 dark:hover:text-gray-300",
        )}
      >
        <Settings size={22} />
        <span className="text-[10px] font-medium leading-none">Settings</span>
      </button>

      <div className="flex-1" />

      <button
        onClick={toggle}
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors w-14",
          "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-600 dark:hover:text-gray-300",
        )}
      >
        {dark ? <Sun size={22} /> : <Moon size={22} />}
        <span className="text-[10px] font-medium leading-none">{dark ? "Light" : "Dark"}</span>
      </button>

      <button
        className="mt-1 flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Sign in"
      >
        <User size={18} />
      </button>
    </div>
  );
}
