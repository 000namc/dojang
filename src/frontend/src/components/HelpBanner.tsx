import { useState } from "react";
import { Info, X } from "lucide-react";
import { cn } from "../lib/cn";

interface HelpBannerProps {
  /** localStorage 키의 suffix. dojang.help.{storageKey}.dismissed 로 저장됨 */
  storageKey: string;
  className?: string;
  children: React.ReactNode;
}

/** 탭 상단에 한 번 뜨고 X 로 닫으면 localStorage 에 영속되어 다시 안 뜨는 안내 밴드. */
export default function HelpBanner({ storageKey, className, children }: HelpBannerProps) {
  const fullKey = `dojang.help.${storageKey}.dismissed`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(fullKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(fullKey, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-gray-200/80 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-400 backdrop-blur-sm",
        className,
      )}
    >
      <Info size={13} className="mt-[2px] shrink-0 text-gray-400 dark:text-gray-500" />
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 transition-colors"
        title="닫기"
        aria-label="도움말 닫기"
      >
        <X size={12} />
      </button>
    </div>
  );
}
