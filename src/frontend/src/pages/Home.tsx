import { useState, useRef, useEffect } from "react";
import { Send, GraduationCap, Compass, Sparkles, Layers, MessageSquare } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import { useSketches } from "../stores/sketches";

interface HomeProps {
  className?: string;
  onSelectTopic?: (topicId: number) => void;
  onNavigate?: (view: string) => void;
}

const GREETINGS = [
  "무엇을 배워볼까요?",
  "오늘은 뭘 공부해볼까요?",
  "어떤 걸 알고 싶으세요?",
  "새로운 걸 배워볼까요?",
  "궁금한 게 있으신가요?",
  "오늘의 학습을 시작해볼까요?",
  "어떤 주제가 끌리세요?",
  "함께 배워봐요!",
];

export default function Home({ className, onNavigate }: HomeProps) {
  const { topics, currentTopic, loadTopics, selectTopic } = useStore();
  const { create: createSketch } = useSketches();
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadTopics(); }, []);

  useEffect(() => {
    if (!currentTopic && topics.length > 0) {
      selectTopic(topics[0].id);
    }
  }, [topics, currentTopic]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const initial = `# ${input.trim()}\n\n`;
    setInput("");
    await createSketch({ content: initial });
    onNavigate?.("sketch");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-gray-900", className)}>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {greeting}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          AI 튜터와 대화하며 학습을 시작하세요
        </p>

        {/* Input */}
        <div className="w-full max-w-2xl mb-6">
          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border shadow-sm",
              "border-gray-200 dark:border-gray-700",
              "bg-gray-50 dark:bg-gray-800",
              "p-2",
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="질문하거나 커리큘럼을 만들어보세요..."
              className={cn(
                "flex-1 resize-none bg-transparent px-2 py-1.5 text-sm",
                "text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500",
                "focus:outline-none",
              )}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                "shrink-0 rounded-lg p-2 transition-colors",
                input.trim()
                  ? "bg-primary-500 text-white hover:bg-primary-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400",
              )}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-start justify-center gap-4">
          {[
            { icon: GraduationCap, label: "학습\n이어하기", color: "text-green-400 bg-green-500/10 border-green-500/30", action: () => onNavigate?.("learn") },
            { icon: Layers, label: "Topic\n관리", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", action: () => onNavigate?.("subjects") },
            { icon: Compass, label: "탐색하기\n", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", action: () => onNavigate?.("explore") },
          ].map(({ icon: Icon, label, color, action }) => (
            <button key={label} onClick={action} className="flex flex-col items-center gap-2 group w-20">
              <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
                <Icon size={22} />
              </div>
              <span className="text-[11px] h-7 flex items-start justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-300 transition-colors text-center whitespace-pre-line leading-tight">{label.trim()}</span>
            </button>
          ))}

          <div className="w-px h-20 bg-gray-200 dark:bg-gray-700 mx-1 mt-0" />

          {[
            { icon: MessageSquare, label: "뭘 모르는지\n알아보기", color: "text-purple-400 bg-purple-500/10 border-purple-500/30", prompt: "내가 뭘 모르는지 같이 알아봐줘" },
            { icon: Sparkles, label: "커리큘럼\n생성", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", prompt: "새로운 커리큘럼을 만들어줘" },
            { icon: Compass, label: "다음 공부\n추천", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", prompt: "내가 지금까지 공부한 내용을 바탕으로, 다음에 뭘 공부하면 좋을지 추천해줘" },
          ].map(({ icon: Icon, label, color, prompt }) => (
            <button key={label} onClick={() => setInput(prompt)} className="flex flex-col items-center gap-2 group w-20">
              <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
                <Icon size={22} />
              </div>
              <span className="text-[11px] h-7 flex items-start justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-300 transition-colors text-center whitespace-pre-line leading-tight">{label.trim()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
