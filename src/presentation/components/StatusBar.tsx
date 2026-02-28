type StatusTone = "info" | "success" | "error";

type StatusBarProps = {
  message: string;
  tone?: StatusTone;
  shortcut?: string | null;
  stats?: { words: number; chars: number } | null;
};

export function StatusBar({ message, tone = "info", shortcut, stats }: StatusBarProps) {
  const toneClass =
    tone === "error"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";

  return (
    <footer className="h-7 border-t bg-background/95 px-3 text-xs backdrop-blur-sm flex items-center justify-between gap-3">
      <p className={`truncate ${toneClass}`} title={message}>{message}</p>
      <div className="shrink-0 flex items-center gap-4 text-muted-foreground/90">
        {shortcut ? <span>{shortcut}</span> : null}
        {stats ? (
          <span>{stats.words.toLocaleString()} 词 {stats.chars.toLocaleString()} 字符</span>
        ) : null}
      </div>
    </footer>
  );
}
