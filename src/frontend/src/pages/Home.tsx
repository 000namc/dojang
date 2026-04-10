import { useState, useRef, useEffect } from "react";
import { Send, GraduationCap, Compass, Sparkles, Layers, MessageSquare, PenLine, BookOpen, Microscope } from "lucide-react";
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
        <div className="w-full max-w-5xl mb-6">
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

        {/* Actions — 입력창과 동일한 max-w-5xl 컨테이너 안에서 두 개의 flex-1
            반쪽으로 나눠 디바이더가 채팅창의 정중앙에 정확히 떨어지도록 배치.
            왼쪽 반쪽은 justify-end, 오른쪽 반쪽은 justify-start 라서 아이콘들이
            디바이더 쪽으로 모이고, 5개 vs 4개 비대칭은 디바이더 양옆으로
            자연스럽게 부채꼴로 펼쳐진다. */}
        <div className="w-full max-w-5xl flex items-start">
          <div className="flex-1 flex justify-end items-start gap-4">
            {[
              { icon: PenLine, label: "스케치\n", color: "text-pink-400 bg-pink-500/10 border-pink-500/30", action: () => onNavigate?.("sketch") },
              { icon: GraduationCap, label: "학습\n이어하기", color: "text-green-400 bg-green-500/10 border-green-500/30", action: () => onNavigate?.("learn") },
              { icon: Layers, label: "Topic\n관리", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", action: () => onNavigate?.("subjects") },
              { icon: Compass, label: "탐색하기\n", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", action: () => onNavigate?.("explore") },
              { icon: BookOpen, label: "가이드\n", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30", action: () => onNavigate?.("guide") },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} className="flex flex-col items-center gap-2 group w-20">
                <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
                  <Icon size={22} />
                </div>
                <span className="text-[11px] h-7 flex items-start justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-300 transition-colors text-center whitespace-pre-line leading-tight">{label.trim()}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-20 bg-gray-200 dark:bg-gray-700 mx-3 shrink-0" />

          <div className="flex-1 flex justify-start items-start gap-4">
            {[
              { icon: MessageSquare, label: "뭘 모르는지\n알아보기", color: "text-purple-400 bg-purple-500/10 border-purple-500/30", prompt: "내가 뭘 모르는지 같이 알아봐줘" },
              { icon: Sparkles, label: "커리큘럼\n생성", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", prompt: "새로운 커리큘럼을 만들어줘" },
              { icon: Microscope, label: "코드 해부\n학습 플랜", color: "text-rose-400 bg-rose-500/10 border-rose-500/30", prompt: "GitHub repo 를 분석해서 학습 플랜을 짜줘.\n\n진행 순서:\n1. 먼저 분석할 GitHub repo URL 을 나에게 물어봐.\n2. URL 을 받으면 `gh repo clone <owner/repo> /tmp/dojang-analysis/<repo-name>` 로 clone 해. (gh 는 컨테이너에 이미 인증돼 있어서 private repo 도 동작.)\n3. clone 된 디렉토리에서 tree 로 구조를 훑고, README / 엔트리포인트 / 핵심 모듈 / 설정 파일을 먼저 읽어서 전체 그림을 잡아.\n4. 그 다음 나한테 소크라테스식으로 질문해줘 — \"이 코드에서 가장 낯설어 보이는 부분이 어디야?\", \"이 함수가 무슨 일을 하는지 한 번 짐작해볼래?\" 같이.\n5. 내가 모른다고 답한 개념 / 패턴 / 라이브러리 / 언어 기능을 모아 학습 플랜을 정리해줘. 각 항목마다 \"왜 이걸 모르면 이 코드가 안 읽히는지\" 를 짧게 짚어주고, 난이도 순서로 배치.\n6. 학습 플랜이 합의되면 `create_curriculum` + `add_subject` 로 실제 커리큘럼화 할지 나에게 물어봐." },
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
    </div>
  );
}
