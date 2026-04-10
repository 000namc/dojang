import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "../lib/cn";
import { Play, RotateCcw, ChevronDown, X } from "lucide-react";
import { useStore } from "../stores/store";

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
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
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
      return true;
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ agent });
    if (sketchId != null) params.set("sketch_id", String(sketchId));
    else if (curriculumId != null) params.set("curriculum_id", String(curriculumId));
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal?${params.toString()}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      onActiveChange?.(true);
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
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
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
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
  }, [started, agent, sketchId, curriculumId]);

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
        </div>
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
        <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
      )}
    </div>
  );
}
