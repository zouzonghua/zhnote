import { useState, useEffect, useMemo, useRef, useId, useCallback } from "react";
import { memo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import MDEditor from "@uiw/react-md-editor";
import mermaid from "mermaid";
import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import { Columns2, BookOpen, PenLine, Save } from "lucide-react";
import { useTheme } from "@/presentation/hooks/useTheme";

// Standard Mermaid initialization
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
});

// Helper to extract plain text from React children (handles strings, arrays, and nested VNodes)
const extractText = (children: any): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children?.props?.children) return extractText(children.props.children);
  return "";
};

const Mermaid = ({ chart }: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let isMounted = true;
    
    const render = async () => {
      if (!containerRef.current || !chart || typeof chart !== "string") return;
      try {
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

  return <div ref={containerRef} className="mermaid-container flex justify-center my-4 overflow-hidden w-full" />;
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

export function NoteEditor({ note, onChange, onDirtyChange, focusToken = 0 }: NoteEditorProps) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [mode, setMode] = useState<"edit" | "live" | "preview">("live");
  const editorViewRef = useRef<EditorView | null>(null);

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
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" || (theme === "system" && rootIsDark) ? "dark" : "default",
    });
  }, [theme]);

  useEffect(() => {
    if (focusToken === 0 || mode === "preview") return;
    const id = requestAnimationFrame(() => {
      editorViewRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusToken, mode]);

  const isDirty = title !== note.title || content !== note.content;
  const draft = useMemo(() => ({ ...note, title, content, updatedAt: Date.now() }), [note, title, content]);

  const saveDraft = useCallback(async () => {
    if (!isDirty) return;
    await onChange(draft);
  }, [draft, isDirty, onChange]);

  useEffect(() => {
    onDirtyChange?.(draft, isDirty);
  }, [draft, isDirty, onDirtyChange]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (!hotkey) return;
      event.preventDefault();
      void saveDraft();
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [saveDraft]);

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
  ], []);

  const components = useMemo(() => ({
    code: ({ inline, className, children, ...props }: any) => {
      const isMermaid = (className || "").includes("language-mermaid");
      if (!inline && isMermaid) {
        const chartContent = extractText(children);
        return <Mermaid chart={chartContent.trim()} />;
      }
      return <code className={className} {...props}>{children}</code>;
    }
  }), []);

  const wordCount = useMemo(() => {
    const normalized = content.trim();
    if (!normalized) return 0;
    return normalized.split(/\s+/u).length;
  }, [content]);

  const charCount = useMemo(() => content.length, [content]);

  return (
    <div className="note-editor-shell relative flex-1 flex flex-col min-h-0 bg-background">
      <header className="flex items-center justify-end px-5 h-12 gap-1 pt-8 sm:pt-0">
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
          <input
            type="text"
            value={title}
            onInput={(e: any) => setTitle(e.target.value)}
            className="text-4xl font-semibold tracking-tight bg-transparent border-none outline-none mb-8 w-full placeholder:opacity-20"
            placeholder="Untitled"
          />
          
          <div className="min-h-[500px]">
            {mode === "preview" ? (
              <MDEditor.Markdown source={content} className="wmde-markdown" components={components} />
            ) : mode === "live" ? (
              <div className="grid grid-cols-2 gap-10">
                <div className="pr-2">
                  <EditorContainer
                    content={content}
                    onChange={setContent}
                    extensions={extensions}
                    onCreateEditor={(view: EditorView) => {
                      editorViewRef.current = view;
                    }}
                  />
                </div>
                <div className="min-w-0 pl-2">
                  <MDEditor.Markdown source={content} className="wmde-markdown" components={components} />
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
      <div className="pointer-events-none absolute right-4 bottom-3 z-20 rounded-md border bg-background/90 px-3 py-1.5 text-[13px] text-muted-foreground/85 backdrop-blur-sm flex items-center gap-4">
        <span>{wordCount.toLocaleString()} 个词</span>
        <span>{charCount.toLocaleString()} 个字符</span>
      </div>
    </div>
  );
}

interface NoteEditorProps {
  note: Note;
  onChange: (note: Note) => Promise<void> | void;
  onDirtyChange?: (note: Note, dirty: boolean) => void;
  focusToken?: number;
}
