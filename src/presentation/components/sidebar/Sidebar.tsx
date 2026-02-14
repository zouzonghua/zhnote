import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, FolderOpen, Settings } from "lucide-react";
import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileTreeItem } from "./FileTreeItem";
import { ExportHandler, MoveHandler, RenameHandler, TreeItemMeta } from "./types";

type SidebarProps = {
  notes: Note[];
  loading: boolean;
  activePath?: string;
  focusPath?: string | null;
  renamePath?: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onCreateRootFile: () => void;
  onSelect: (note: Note) => void | Promise<void>;
  onActivate: (path: string) => void;
  onDelete: (item: TreeItemMeta) => Promise<void>;
  onCreateFile: (parent: string) => Promise<string | undefined>;
  onCreateFolder: (parent: string) => Promise<string | undefined>;
  onLoadChildren: (path: string) => Promise<Note[]>;
  onRequestRename: (path: string) => void;
  onRename: RenameHandler;
  onMove: MoveHandler;
  onExport: ExportHandler;
  onRenameDone: (path: string) => void;
  onFocusHandled: (path: string) => void;
  focusToken?: number;
};

type DeleteRequest = {
  item: TreeItemMeta;
  resolve: () => void;
};

export function Sidebar({
  notes,
  loading,
  activePath,
  focusPath,
  renamePath,
  searchQuery,
  onSearchQueryChange,
  onOpenFolder,
  onOpenSettings,
  onCreateRootFile,
  onSelect,
  onActivate,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onLoadChildren,
  onRequestRename,
  onRename,
  onMove,
  onExport,
  onRenameDone,
  onFocusHandled,
  focusToken = 0,
}: SidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = localStorage.getItem("sidebar_width");
    if (!raw) return 256;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 256;
    return Math.max(220, Math.min(460, parsed));
  });
  const [pendingDeleteRequest, setPendingDeleteRequest] = useState<DeleteRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const resizingRef = useRef(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleNotes = useMemo(() => {
    if (!normalizedQuery) return notes;
    return notes.filter((note) => note.title.toLowerCase().includes(normalizedQuery));
  }, [notes, normalizedQuery]);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
    if (focusToken === 0) return;
    const id = requestAnimationFrame(() => {
      const selected = document.querySelector<HTMLElement>('nav[role="tree"] [data-tree-node="true"][aria-selected="true"]');
      if (selected) {
        selected.focus();
        return;
      }
      const firstItem = document.querySelector<HTMLElement>('nav[role="tree"] [data-tree-node="true"]');
      firstItem?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusToken]);

  const requestDelete = useCallback((item: TreeItemMeta) => {
    return new Promise<void>((resolve) => {
      setPendingDeleteRequest({ item, resolve });
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteRequest) return;
    setIsDeleting(true);
    try {
      await onDelete(pendingDeleteRequest.item);
      pendingDeleteRequest.resolve();
      setPendingDeleteRequest(null);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, pendingDeleteRequest]);

  const closeDeleteDialog = useCallback(() => {
    if (!pendingDeleteRequest) return;
    pendingDeleteRequest.resolve();
    setPendingDeleteRequest(null);
  }, [pendingDeleteRequest]);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open && !isDeleting) {
      closeDeleteDialog();
    }
  }, [closeDeleteDialog, isDeleting]);

  const handleResizeMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizingRef.current = true;
    let latestWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const nextWidth = Math.max(220, Math.min(460, moveEvent.clientX));
      latestWidth = nextWidth;
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      localStorage.setItem("sidebar_width", String(latestWidth));
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);

  return (
    <aside
      className="shrink-0 border-r bg-muted/20 flex flex-col sidebar-padding relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Vault</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open Folder" onClick={onOpenFolder}>
              <FolderOpen className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="New Note" onClick={onCreateRootFile}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-8 h-8 text-xs bg-muted/40 border-none focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
      </div>

      <Separator className="opacity-50" />

      <nav className="sidebar-scroll flex-1 overflow-y-auto p-2 space-y-0.5" role="tree" aria-label="Vault file tree">
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground animate-pulse">Loading vault...</div>
        ) : visibleNotes.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">No notes match search.</div>
        ) : (
          visibleNotes.map((note) => (
            <FileTreeItem
              key={note.path}
              note={note}
              activePath={activePath}
              focusPath={focusPath}
              renamePath={renamePath}
              onSelect={onSelect}
              onActivate={onActivate}
              onDelete={requestDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onLoadChildren={onLoadChildren}
              onRequestRename={onRequestRename}
              onRename={onRename}
              onMove={onMove}
              onExport={onExport}
              onRenameDone={onRenameDone}
              onFocusHandled={onFocusHandled}
            />
          ))
        )}
      </nav>

      <div className="p-2 mt-auto border-t">
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          title="Open settings (Cmd/Ctrl+,)"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          <span className="text-sm font-medium">Settings</span>
        </Button>
      </div>

      <Dialog open={!!pendingDeleteRequest} onOpenChange={handleDeleteDialogChange}>
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {pendingDeleteRequest
                ? `确定删除${pendingDeleteRequest.item.isFolder ? "文件夹" : "文件"}“${pendingDeleteRequest.item.title}”？此操作不可恢复。`
                : "此操作不可恢复。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-border/80 transition-colors"
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize sidebar"
      />
    </aside>
  );
}
