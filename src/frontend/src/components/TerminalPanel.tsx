import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "../lib/cn";
import { Play, RotateCcw, ChevronDown, X, Sparkles } from "lucide-react";
import { useStore } from "../stores/store";
import { useBypass } from "../stores/bypass";

type AgentId = "claude" | "opencode";

interface AgentInfo {
  id: AgentId;
  label: string;
  installed: boolean;
}

const FALLBACK_AGENTS: AgentInfo[] = [
  { id: "claude", label: "Claude Code", installed: true },
  { id: "opencode", label: "OpenCode", installed: false },
];

export default function TerminalPanel({
  className,
  sketchId,
  curriculumId,
  onActiveChange,
}: {
  className?: string;
  sketchId?: number | null;
  /** Learn 탭의 글로벌 dock 에서만 전달된다. 이 값이 바뀌면 useEffect deps 로
   *  인해 기존 WS/xterm 이 dispose 되고 새 curriculum 의 tmux 세션으로 재접속.
   *  sketchId 가 있으면 그쪽이 우선되고 curriculumId 는 무시됨. */
  curriculumId?: number | null;
  /** 부모에게 "WS 가 열렸고 claude 세션이 살아있다" 신호를 보낸다. Sketch /
   *  curriculum 전환 시 confirmation 다이얼로그 노출 조건으로 쓰인다. */
  onActiveChange?: (active: boolean) => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  const [agent, setAgent] = useState<AgentId>("claude");
  const [agents, setAgents] = useState<AgentInfo[]>(FALLBACK_AGENTS);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { contextRef, contextSnippets, removeContextSnippet, clearContextSnippets } = useStore();
  const bypass = useBypass((s) => s.bypass);

  // Fetch available agents
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: AgentInfo[]) => {
        setAgents(data);
        const installed = data.find((a) => a.installed);
        if (installed) setAgent(installed.id);
      })
      .catch(() => {});
  }, []);

  // Open terminal + WS
  useEffect(() => {
    if (!started || !terminalRef.current) return;

    cleanupRef.current?.();
    wsRef.current?.close();
    termRef.current?.dispose();

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      // Claude Code TUI 는 마우스 트래킹을 켜서 xterm 의 네이티브 드래그 선택을
      // 막아버린다. macOS 에서 Option 을 누르고 드래그하면 트래킹을 우회해서
      // 텍스트를 선택할 수 있게 — /login 때 뜨는 OAuth URL 복사에 필요.
      macOptionClickForcesSelection: true,
      rightClickSelectsWord: true,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
      },
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    termRef.current = term;

    term.open(terminalRef.current);
    fitAddon.fit();

    // tmux mouse off + Claude Code TUI 가 mouse tracking 을 안 쓰므로 xterm 이
    // wheel 을 처리하면 기본적으로 ANSI 화살표키를 PTY 로 보낸다 → claude 채팅
    // 히스토리 토글로 작동. 사용자 기대(=로컬 버퍼 스크롤) 와 달라서 capture
    // 단계에서 가로채 xterm scrollback 을 직접 움직인다.
    const onWheel = (ev: WheelEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      const step = ev.shiftKey ? 1 : 3;
      term.scrollLines(Math.sign(ev.deltaY) * step);
    };
    term.element?.addEventListener("wheel", onWheel, { capture: true, passive: false });

    // xterm 은 기본적으로 Enter / Shift+Enter 를 구분 못하고 둘 다 \r 을 보내지만,
    // Claude Code 는 \r 을 "제출", \x1b\r (ESC+CR) 을 "줄바꿈" 으로 해석한다.
    // (VS Code terminal-setup 이 Shift+Enter 에 바인딩하는 시퀀스와 동일)
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === "keydown" && ev.key === "Enter" && ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "input", data: "\x1b\r" }));
        }
        ev.preventDefault();
        return false;
      }
      // Cmd+C (macOS) / Ctrl+Shift+C (Linux/Win) 로 선택 영역 클립보드 복사.
      // xterm.js 는 기본적으로 이 바인딩이 없어서 Option+drag 로 선택해도
      // 클립보드에 안 들어간다. Claude Code 의 /login URL 같은 걸 뽑을 때 필수.
      if (ev.type === "keydown" && ev.key === "c") {
        const isCopyChord =
          (ev.metaKey && !ev.ctrlKey && !ev.altKey && !ev.shiftKey) ||
          (ev.ctrlKey && ev.shiftKey && !ev.altKey && !ev.metaKey);
        if (isCopyChord) {
          const sel = term.getSelection();
          if (sel) {
            navigator.clipboard.writeText(sel).catch(() => {});
            ev.preventDefault();
            return false;
          }
        }
      }
      return true;
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ agent });
    if (sketchId != null) params.set("sketch_id", String(sketchId));
    else if (curriculumId != null) params.set("curriculum_id", String(curriculumId));
    if (bypass && agent === "claude") params.set("bypass", "1");
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal?${params.toString()}`,
    );
    wsRef.current = ws;

    // 유효한 (유한 정수 + 양수) 치수만 백엔드로 보낸다. xterm 컨테이너가
    // display:none 으로 0×0 이 되면 proposeDimensions 가 NaN/Infinity 를
    //돌려줄 수 있는데, 그걸 그대로 보내면 백엔드의 struct.pack 이 터져서
    // WebSocket 이 강제로 닫히고 `[session ended]` 가 찍힌다.
    const sendResize = () => {
      const dims = fitAddon.proposeDimensions();
      if (!dims) return;
      const { cols, rows } = dims;
      if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
      if (cols <= 0 || rows <= 0) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({ type: "resize", cols: Math.floor(cols), rows: Math.floor(rows) }),
      );
    };

    ws.onopen = () => {
      setConnected(true);
      onActiveChange?.(true);
      sendResize();
      // 세션 시작하자마자 키 입력을 받을 수 있게 xterm 에 포커스. setTimeout 으로
      // 미루는 이유는 WS onopen 직후엔 아직 DOM 레이아웃이 안정화 안 된 경우가
      // 있어서 — 다음 task 에서 focus 하면 안정적으로 커서가 잡힌다.
      setTimeout(() => term.focus(), 0);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => term.write(new Uint8Array(buf)));
      } else {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onActiveChange?.(false);
      term.write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
    };

    ws.onerror = () => {
      setConnected(false);
      onActiveChange?.(false);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const handleResize = () => {
      // 탭 전환으로 터미널 컨테이너가 display:none 이 되는 순간 ResizeObserver 가
      // 0×0 으로 발화한다. 이 상태에서 fit() 을 돌리면 cellWidth 가 0 으로
      // 떨어지고 proposeDimensions 가 Infinity 를 반환 → 백엔드 크래시 루트.
      // 보이지 않는 크기에서는 아예 fit 을 건너뛰고, 다음에 다시 보일 때 기존
      // 치수 그대로 돌아간다.
      const el = terminalRef.current;
      if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) return;
      fitAddon.fit();
      sendResize();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    cleanupRef.current = () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [started, agent, sketchId, curriculumId, bypass]);

  const reconnect = useCallback(() => {
    setStarted(false);
    setTimeout(() => setStarted(true), 50);
  }, []);

  const switchAgent = (id: AgentId) => {
    setAgent(id);
    setDropdownOpen(false);
    if (started) {
      setStarted(false);
      setTimeout(() => setStarted(true), 50);
    }
  };

  // Sketch 탭 전용 "대화 정리" 매직 프롬프트. 현재 세션에 바로 주입해서
  // Claude 가 그간의 대화를 주제별로 묶어 `update_sketch` 로 저장하게 한다.
  // 끝에 \r 을 붙여 자동 제출. append 모드 기본값이라 사용자의 기존 노트를
  // 덮어쓰지 않는다.
  const summarizeToSketch = () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const prompt =
      "지금까지 이 세션에서 나눈 대화를 정리해서 `update_sketch` MCP 도구로 sketchpad 에 저장해줘. " +
      "정리 원칙: (1) 질문 시간순이 아니라 개념별로 `###` 섹션으로 묶기, " +
      "(2) '합의된 결론' 과 '열린 질문 / 더 파볼 거리' 를 분리해서 적기, " +
      "(3) 중요한 코드 스니펫 · 명령어 · 용어는 원문 그대로 유지, " +
      "(4) 내가 '아하' 했던 비유나 표현은 가급적 살려두기. " +
      "sketch_id 는 current_context.md 에서 자동 추론되니까 생략해도 돼. " +
      "mode 는 기본값 append 그대로.";
    wsRef.current.send(JSON.stringify({ type: "input", data: prompt + "\r" }));
  };

  const currentAgent = agents.find((a) => a.id === agent);
  const hasContext = contextRef || contextSnippets.length > 0;

  return (
    <div className={cn("flex flex-col bg-[#1a1b26]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {/* Agent selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
            >
              {currentAgent?.label ?? agent}
              <ChevronDown size={12} className={cn("transition-transform", dropdownOpen && "rotate-180")} />
            </button>
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-md border border-gray-700 bg-gray-800 py-1 shadow-lg">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => switchAgent(a.id)}
                      disabled={!a.installed}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-xs text-left",
                        a.installed
                          ? "text-gray-300 hover:bg-gray-700"
                          : "text-gray-600 cursor-not-allowed",
                        a.id === agent && "bg-gray-700/50",
                      )}
                    >
                      <span>{a.label}</span>
                      {!a.installed && (
                        <span className="text-[10px] text-gray-600">미설치</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {started && (
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "bg-green-400" : "bg-gray-500",
              )}
            />
          )}
          {bypass && agent === "claude" && (
            <span
              className="rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] font-medium text-red-300"
              title="Bypass permissions ON — Home 에서 설정 변경"
            >
              bypass
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {started && connected && sketchId != null && (
            <button
              onClick={summarizeToSketch}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-pink-300 hover:bg-pink-500/10 transition-colors"
              title="지금까지 대화를 주제별로 정리해서 sketchpad 에 저장"
            >
              <Sparkles size={12} />
              대화 정리
            </button>
          )}
          {started && (
            <button
              onClick={reconnect}
              className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
              title="새 세션"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Context chips */}
      {hasContext && (
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-700 px-3 py-1.5">
          {/* Doc reference */}
          {contextRef && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-900/30 border border-blue-800 px-1.5 py-0.5 text-[11px] text-blue-400 font-mono">
              @{contextRef.type}:{contextRef.title}
            </span>
          )}

          {/* Line snippets */}
          {contextSnippets.map((s) => (
            <span
              key={s.id}
              className="group inline-flex items-center gap-1 rounded bg-gray-800 border border-gray-700 px-1.5 py-0.5 text-[11px] text-gray-400 font-mono"
              title={s.text}
            >
              {(() => {
                const docLabel = contextRef ? `@${contextRef.type}` : "@doc";
                const linePart = s.lineStart != null
                  ? (s.lineEnd != null && s.lineEnd > s.lineStart ? `L${s.lineStart}:${s.lineEnd}` : `L${s.lineStart}`)
                  : null;
                return linePart ? `${docLabel} ${linePart}` : docLabel;
              })()}
              <button
                onClick={() => removeContextSnippet(s.id)}
                className="ml-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:text-gray-200 transition-opacity"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Clear all */}
          {contextSnippets.length > 1 && (
            <button
              onClick={clearContextSnippets}
              className="text-[10px] text-gray-600 hover:text-gray-400 ml-1"
            >
              모두 지우기
            </button>
          )}
        </div>
      )}

      {/* Terminal or start button */}
      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setStarted(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <Play size={16} />
            {currentAgent?.label ?? agent} 세션 시작
          </button>
        </div>
      ) : (
        <div ref={terminalRef} className="flex-1 min-h-0" />
      )}
    </div>
  );
}
