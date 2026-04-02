import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { cn } from "../lib/cn";
import { RotateCcw } from "lucide-react";

export default function TerminalPanel({ className }: { className?: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = () => {
    // Cleanup previous
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (termRef.current) {
      termRef.current.dispose();
    }

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
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    // WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send initial size
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => {
          term.write(new Uint8Array(buf));
        });
      } else {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      term.write("\r\n\x1b[90m[세션 종료]\x1b[0m\r\n");
    };

    ws.onerror = () => {
      setConnected(false);
    };

    // Send terminal input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  };

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  return (
    <div className={cn("flex flex-col bg-[#1a1b26]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Claude Code</span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-green-400" : "bg-gray-500",
            )}
          />
        </div>
        <button
          onClick={connect}
          className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
          title="새 세션"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
