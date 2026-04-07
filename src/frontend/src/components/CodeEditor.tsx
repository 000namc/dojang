import Editor, { type OnMount } from "@monaco-editor/react";
import { useStore } from "../stores/store";
import { useTheme } from "../stores/theme";

export default function CodeEditor({ className }: { className?: string }) {
  const { editorCode, setEditorCode, currentTopic, runCode } = useStore();
  const { dark } = useTheme();

  const language = currentTopic?.name === "SQL" ? "sql" : "shell";

  const handleMount: OnMount = (editor, monaco) => {
    editor.addAction({
      id: "run-code",
      label: "Run Code",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        runCode();
      },
    });
  };

  return (
    <div className={className}>
      <Editor
        height="100%"
        language={language}
        theme={dark ? "vs-dark" : "light"}
        value={editorCode}
        onChange={(value) => setEditorCode(value || "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
