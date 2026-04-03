import { cn } from "../lib/cn";
import CurriculumSidebar from "./CurriculumSidebar";

export default function Sidebar({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      <CurriculumSidebar className="h-full" />
    </div>
  );
}
