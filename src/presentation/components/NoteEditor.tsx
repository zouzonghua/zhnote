import { useState, useEffect, useMemo, useRef, useId, useCallback } from "react";
import { memo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import { Columns2, BookOpen, PenLine, Save, FileDown, ImageDown, Loader2 } from "lucide-react";
import { useTheme } from "@/presentation/hooks/useTheme";

let mermaidPromise: Promise<(typeof import("mermaid"))["default"]> | null = null;
let exportServicePromise: Promise<typeof import("@/presentation/services/exportService")> | null = null;
let markdownRendererPromise: Promise<any> | null = null;
let preferredMermaidTheme: "default" | "dark" = "default";

const loadMermaid = async () => {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((module) => {
      module.default.initialize({
        startOnLoad: false,
        theme: preferredMermaidTheme,
      });
      return module.default;
    });
  }
  return mermaidPromise;
};

const loadExportService = async () => {
  if (!exportServicePromise) {
    exportServicePromise = import("@/presentation/services/exportService");
  }
  return exportServicePromise;
};

const loadMarkdownRenderer = async () => {
  if (!markdownRendererPromise) {
    markdownRendererPromise = import("@uiw/react-md-editor").then((module) => module.default.Markdown);
  }
  return markdownRendererPromise;
};

// Helper to extract plain text from React children (handles strings, arrays, and nested VNodes)
const extractText = (children: any): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children?.props?.children) return extractText(children.props.children);
  return "";
};

type TaskLine = {
  lineIndex: number;
  checked: boolean;
};

const collectTaskLines = (markdownContent: string): TaskLine[] => {
  const lines = markdownContent.split("\n");
  const tasks: TaskLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      tasks.push({ lineIndex: i, checked: /\[(x|X)\]/.test(line) });
    }
  }
  return tasks;
};

const Mermaid = ({ chart, onExport }: { chart: string; onExport?: (svgElement: SVGSVGElement) => void | Promise<void> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let isMounted = true;
    
    const render = async () => {
      if (!containerRef.current || !chart || typeof chart !== "string") return;
      try {
        const mermaid = await loadMermaid();
        const renderId = `mermaid-${id}`;
        // Clean container before render
        if (containerRef.current) containerRef.current.innerHTML = "";
        
        const { svg } = await mermaid.render(renderId, chart);
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Mermaid render failed:", error);
      }
    };

    const timer = setTimeout(render, 50);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [chart, id]);

  return (
    <div className="mermaid-container group relative my-4 w-full overflow-hidden">
      <div ref={containerRef} className="flex w-full justify-center" />
      {onExport && (
        <button
          type="button"
          className="mermaid-export-btn absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground opacity-0 backdrop-blur transition-all duration-150 group-hover:opacity-100 hover:text-foreground"
          title="Export Mermaid image"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const svg = containerRef.current?.querySelector("svg");
            if (!svg) return;
            void onExport(svg);
          }}
        >
          <ImageDown className="size-3.5" />
        </button>
      )}
    </div>
  );
};

const EditorContainer = memo(({ content, onChange, extensions, onCreateEditor }: any) => (
  <CodeMirror
    value={content}
    minHeight="100%"
    theme="none"
    extensions={extensions}
    onChange={onChange}
    onCreateEditor={onCreateEditor}
    basicSetup={{
      lineNumbers: false,
      foldGutter: false,
      highlightActiveLine: false,
    }}
    className="cm-editor-obsidian h-full"
  />
));

export function NoteEditor({
  note,
  onChange,
  onDirtyChange,
  focusToken = 0,
  onStatus,
  onStatsChange,
  showFloatingStats = true,
  reserveTrafficLightSpace = false,
}: NoteEditorProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<"edit" | "live" | "preview">("live");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pendingPdfExport, setPendingPdfExport] = useState(false);
  const [MarkdownRenderer, setMarkdownRenderer] = useState<any>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const pdfExportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (note.id) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note.id]);

  useEffect(() => {
    if (!note.id || mode === "preview") return;
    const id = requestAnimationFrame(() => {
      editorViewRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [note.id, mode]);

  useEffect(() => {
    const rootIsDark = document.documentElement.classList.contains("dark");
    preferredMermaidTheme = theme === "dark" || (theme === "system" && rootIsDark) ? "dark" : "default";
    if (!mermaidPromise) return;
    void mermaidPromise.then((mermaid) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: preferredMermaidTheme,
      });
    });
  }, [theme]);

  useEffect(() => {
    if (focusToken === 0 || mode === "preview") return;
    const id = requestAnimationFrame(() => {
      editorViewRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusToken, mode]);

  useEffect(() => {
    if (mode === "edit" && !pendingPdfExport) return;
    let cancelled = false;
    void loadMarkdownRenderer().then((renderer) => {
      if (!cancelled) {
        setMarkdownRenderer(() => renderer);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, pendingPdfExport]);

  const isDirty = title !== note.title || content !== note.content;
  const draft = useMemo(() => ({ ...note, title, content, updatedAt: Date.now() }), [note, title, content]);

  const saveDraft = useCallback(async () => {
    if (!isDirty) {
      onStatus?.("No changes to save.", "info");
      return;
    }
    await onChange(draft);
    onStatus?.("Saved.", "success");
  }, [draft, isDirty, onChange, onStatus]);

  const handleExportPdf = useCallback(async () => {
    if (exportingPdf || pendingPdfExport) return;
    console.log("[pdf-export] ui:click", {
      noteId: note.id,
      title: title.trim() || note.title || "Untitled",
    });
    setExportingPdf(true);
    setPendingPdfExport(true);
    onStatus?.("Exporting PDF to Downloads...", "info");
  }, [exportingPdf, note.id, note.title, onStatus, pendingPdfExport, title]);

  useEffect(() => {
    if (!pendingPdfExport || !pdfExportRef.current || !MarkdownRenderer) return;
    let cancelled = false;

    const runExport = async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        const { exportMarkdownToPdf } = await loadExportService();
        if (cancelled || !pdfExportRef.current) return;
        const result = await exportMarkdownToPdf({
          element: pdfExportRef.current,
          title: title.trim() || note.title || "Untitled",
        });
        if (cancelled) return;
        console.log("[pdf-export] ui:service-return", result);

        if (result.cancelled) {
          onStatus?.("PDF export cancelled.", "info");
          return;
      }

      console.info("[pdf-export] done", { path: result.path });
      onStatus?.(`PDF exported: ${result.path ?? "Downloads"}`, "success");
    } catch (error) {
      console.log("[pdf-export] ui:failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("[pdf-export] failed", error);
      onStatus?.(`PDF export failed: ${String(error)}`, "error");
    } finally {
        if (!cancelled) {
          setPendingPdfExport(false);
          setExportingPdf(false);
        }
      }
    };

    void runExport();

    return () => {
      cancelled = true;
    };
  }, [MarkdownRenderer, note.title, onStatus, pendingPdfExport, title]);

  const handleExportMermaid = useCallback(async (svgElement: SVGSVGElement) => {
    try {
      const { exportMermaidSvgToPng } = await loadExportService();
      console.log("[pdf-export] mermaid:ui:click", {
        noteId: note.id,
        title: title.trim() || note.title || "diagram",
      });
      const nameBase = title.trim() || note.title || "diagram";
      const result = await exportMermaidSvgToPng({
        svgElement,
        defaultFileName: `${nameBase}-mermaid.png`,
      });
      console.log("[pdf-export] mermaid:ui:service-return", result);

      if (result.cancelled) {
        onStatus?.("Mermaid export cancelled.", "info");
        return;
      }

      console.info("[pdf-export] mermaid-done", { path: result.path });
      onStatus?.("Mermaid exported successfully.", "success");
    } catch (error) {
      console.log("[pdf-export] mermaid:ui:failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("[mermaid-export] failed", error);
      onStatus?.(`Mermaid export failed: ${String(error)}`, "error");
    }
  }, [note.title, onStatus, title]);

  useEffect(() => {
    onDirtyChange?.(draft, isDirty);
  }, [draft, isDirty, onDirtyChange]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (!hotkey) return;
      event.preventDefault();
      onStatus?.("Shortcut triggered.", "info", "Cmd/Ctrl+S");
      void saveDraft();
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [onStatus, saveDraft]);

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
  ], []);

  const taskLines = useMemo(() => collectTaskLines(content), [content]);

  const toggleTaskByIndex = useCallback((taskIndex: number, nextChecked: boolean) => {
    setContent((previous) => {
      const task = collectTaskLines(previous)[taskIndex];
      if (!task) return previous;
      const lines = previous.split("\n");
      const targetLine = lines[task.lineIndex];
      if (!targetLine) return previous;
      if (!/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(targetLine)) return previous;
      lines[task.lineIndex] = targetLine.replace(/\[( |x|X)\]/, nextChecked ? "[x]" : "[ ]");
      return lines.join("\n");
    });
  }, []);

  const components = useMemo(() => ({
    code: ({ inline, className, children, ...props }: any) => {
      const isMermaid = (className || "").includes("language-mermaid");
      if (!inline && isMermaid) {
        const chartContent = extractText(children);
        return <Mermaid chart={chartContent.trim()} onExport={handleExportMermaid} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    input: ({ type, checked }: any) => {
      if (type !== "checkbox") {
        return <input type={type} defaultChecked={Boolean(checked)} readOnly />;
      }
      const interactive = mode === "live";

      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          data-task-checkbox="true"
          disabled={!interactive}
          onChange={(event) => {
            if (!interactive) return;
            const host = previewPaneRef.current;
            if (!host) return;
            const checkboxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-task-checkbox="true"]'));
            const taskIndex = checkboxes.indexOf(event.currentTarget);
            if (taskIndex < 0 || taskIndex >= taskLines.length) return;
            toggleTaskByIndex(taskIndex, event.currentTarget.checked);
          }}
        />
      );
    },
  }), [handleExportMermaid, mode, taskLines.length, toggleTaskByIndex]);

  const exportComponents = useMemo(() => ({
    code: ({ inline, className, children, ...props }: any) => {
      const isMermaid = (className || "").includes("language-mermaid");
      if (!inline && isMermaid) {
        const chartContent = extractText(children);
        return <Mermaid chart={chartContent.trim()} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    input: ({ type, checked }: any) => {
      if (type !== "checkbox") {
        return <input type={type} defaultChecked={Boolean(checked)} readOnly />;
      }
      return <input type="checkbox" checked={Boolean(checked)} readOnly />;
    },
  }), []);

  const wordCount = useMemo(() => {
    const normalized = content.trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/u).length;
  }, [content]);

  const charCount = useMemo(() => content.length, [content]);

  useEffect(() => {
    onStatsChange?.(wordCount, charCount);
  }, [charCount, onStatsChange, wordCount]);

  const previewLoadingFallback = (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      Loading preview...
    </div>
  );

  return (
    <div className="note-editor-shell relative h-full flex-1 flex flex-col min-h-0 bg-background">
      <header className={`flex items-center justify-between px-5 h-12 gap-3 pt-8 sm:pt-0 ${reserveTrafficLightSpace ? "pl-44" : ""}`}>
        <input
          type="text"
          value={title}
          onInput={(e: any) => setTitle(e.target.value)}
          className="h-8 flex-1 min-w-0 text-2xl font-semibold tracking-tight bg-transparent border-none outline-none placeholder:opacity-20"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1">
          {isDirty && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void saveDraft()}
              className="h-8 w-8 text-muted-foreground animate-in fade-in zoom-in-95 duration-200"
              title="Save (Ctrl/Cmd+S)"
            >
              <Save className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => void handleExportPdf()}
            title="Export PDF"
            disabled={exportingPdf}
          >
            {exportingPdf ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={mode === "edit" ? "text-foreground bg-accent/40" : "text-muted-foreground"}
            onClick={() => setMode("edit")}
            title="Edit mode"
          >
            <PenLine className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={mode === "live" ? "text-foreground bg-accent/40" : "text-muted-foreground"}
            onClick={() => setMode("live")}
            title="Live preview mode"
          >
            <Columns2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={mode === "preview" ? "text-foreground bg-accent/40" : "text-muted-foreground"}
            onClick={() => setMode("preview")}
            title="Preview mode"
          >
            <BookOpen className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className={mode === "live" ? "w-full px-8 py-6" : "max-w-5xl mx-auto px-10 py-8"}>
          <div className="min-h-[500px]">
            {mode === "preview" ? (
              MarkdownRenderer ? (
                <MarkdownRenderer source={content} className="wmde-markdown" components={components} />
              ) : previewLoadingFallback
            ) : mode === "live" ? (
              <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-6 items-stretch">
                <div className="pr-2 min-w-0">
                  <EditorContainer
                    content={content}
                    onChange={setContent}
                    extensions={extensions}
                    onCreateEditor={(view: EditorView) => {
                      editorViewRef.current = view;
                    }}
                  />
                </div>
                <div className="w-px bg-border/80 rounded-full" aria-hidden />
                <div className="min-w-0 pl-2">
                  <div ref={previewPaneRef}>
                    {MarkdownRenderer ? (
                      <MarkdownRenderer source={content} className="wmde-markdown" components={components} />
                    ) : previewLoadingFallback}
                  </div>
                </div>
              </div>
            ) : (
              <EditorContainer
                content={content}
                onChange={setContent}
                extensions={extensions}
                onCreateEditor={(view: EditorView) => {
                  editorViewRef.current = view;
                }}
              />
            )}
          </div>
        </div>
      </div>
      {MarkdownRenderer && (mode !== "edit" || pendingPdfExport) ? (
        <div className="pdf-export-root" aria-hidden>
          <div ref={pdfExportRef} className="pdf-export-content">
            <MarkdownRenderer source={content} className="wmde-markdown" components={exportComponents} />
          </div>
        </div>
      ) : null}
      {showFloatingStats && (
        <div className="pointer-events-none absolute right-4 bottom-3 z-20 rounded-md border bg-background/90 px-3 py-1.5 text-[13px] text-muted-foreground/85 backdrop-blur-sm flex items-center gap-4">
          <span>{wordCount.toLocaleString()} 个词</span>
          <span>{charCount.toLocaleString()} 个字符</span>
        </div>
      )}
    </div>
  );
}

interface NoteEditorProps {
  note: Note;
  onChange: (note: Note) => Promise<void> | void;
  onDirtyChange?: (note: Note, dirty: boolean) => void;
  focusToken?: number;
  onStatus?: (message: string, tone?: "info" | "success" | "error", shortcut?: string) => void;
  onStatsChange?: (words: number, chars: number) => void;
  showFloatingStats?: boolean;
  reserveTrafficLightSpace?: boolean;
}
