import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "../lib/cn";
import { Play, RotateCcw } from "lucide-react";

export default function TerminalPanel({ className }: { className?: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);

  // Actually open terminal + WS after DOM is ready
  useEffect(() => {
    if (!started || !terminalRef.current) return;

    // Cleanup previous
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

    // WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
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
      term.write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
    };

    ws.onerror = () => setConnected(false);

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
  }, [started]);

  const reconnect = useCallback(() => {
    // Force re-mount by toggling started
    setStarted(false);
    setTimeout(() => setStarted(true), 50);
  }, []);

  return (
    <div className={cn("flex flex-col bg-[#1a1b26]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Claude Code</span>
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

      {/* Terminal or start button */}
      {!started ? (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => setStarted(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <Play size={16} />
            Claude Code 세션 시작
          </button>
        </div>
      ) : (
        <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
      )}
    </div>
  );
}
