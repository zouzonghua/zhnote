import { useState, useEffect, useRef, memo, useCallback, KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Download, FilePlus, FileText, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isDescendantPath } from "./pathUtils";
import { ExportHandler, MoveHandler, RenameHandler, TreeItemMeta } from "./types";

const DRAG_ITEM_MIME = "application/x-zhnote-tree-item";
const FOLDER_OPEN_STATE = new Map<string, boolean>();
const FOLDER_CHILDREN_CACHE = new Map<string, Note[]>();

const clearFolderCache = (folderPath: string) => {
  for (const key of Array.from(FOLDER_CHILDREN_CACHE.keys())) {
    if (key === folderPath || key.startsWith(`${folderPath}/`) || key.startsWith(`${folderPath}\\`)) {
      FOLDER_CHILDREN_CACHE.delete(key);
    }
  }
};

type FileTreeItemProps = {
  note: Note;
  activePath?: string;
  focusPath?: string | null;
  renamePath?: string | null;
  level?: number;
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
  treeVersion?: number;
};

const getDragItem = (event: React.DragEvent): TreeItemMeta | null => {
  const raw = event.dataTransfer.getData(DRAG_ITEM_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TreeItemMeta;
    if (!parsed?.path) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const FileTreeItem = memo(function FileTreeItem({
  note,
  activePath,
  focusPath,
  renamePath,
  level = 0,
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
  treeVersion = 0,
}: FileTreeItemProps) {
  const initialChildren = note.isFolder ? (FOLDER_CHILDREN_CACHE.get(note.path) ?? []) : [];
  const [isOpen, setIsOpen] = useState(() => (note.isFolder ? (FOLDER_OPEN_STATE.get(note.path) ?? false) : false));
  const [children, setChildren] = useState<Note[]>(initialChildren);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(() => initialChildren.length > 0);
  const [renameValue, setRenameValue] = useState(note.title);
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipBlurSubmitRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastSyncedTreeVersionRef = useRef(treeVersion);

  const isSelected = activePath === note.path;
  const isRenaming = renamePath === note.path;
  const itemMeta: TreeItemMeta = { path: note.path, title: note.title, isFolder: note.isFolder };

  const setOpenState = useCallback((next: boolean) => {
    setIsOpen(next);
    if (note.isFolder) {
      FOLDER_OPEN_STATE.set(note.path, next);
    }
  }, [note.isFolder, note.path]);

  const loadSubNotes = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const loaded = await onLoadChildren(note.path);
      setChildren(loaded);
      FOLDER_CHILDREN_CACHE.set(note.path, loaded);
      setOpenState(true);
    } finally {
      setHasLoadedChildren(true);
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [note.path, onLoadChildren, setOpenState]);

  const refreshChildrenIfOpen = useCallback(async () => {
    if (!isOpen) return;
    await loadSubNotes();
  }, [isOpen, loadSubNotes]);

  const handleCreateFileInside = useCallback(async () => {
    await onCreateFile(note.path);
    await refreshChildrenIfOpen();
  }, [note.path, onCreateFile, refreshChildrenIfOpen]);

  const handleCreateFolderInside = useCallback(async () => {
    await onCreateFolder(note.path);
    await refreshChildrenIfOpen();
  }, [note.path, onCreateFolder, refreshChildrenIfOpen]);

  useEffect(() => {
    if (!isRenaming) return;
    setRenameValue(note.title);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [isRenaming, note.title]);

  useEffect(() => {
    if (!focusPath) return;

    if (focusPath === note.path) {
      onActivate(note.path);
      onRequestRename(note.path);
      if (note.isFolder) {
        void loadSubNotes();
      } else {
        void onSelect(note);
      }
      onFocusHandled(note.path);
      return;
    }

    if (note.isFolder && isDescendantPath(focusPath, note.path) && !isOpen) {
      void loadSubNotes();
    }
  }, [focusPath, isOpen, loadSubNotes, note, onActivate, onFocusHandled, onRequestRename, onSelect]);

  useEffect(() => {
    if (!note.isFolder || !isOpen || hasLoadedChildren || isLoading) return;
    void loadSubNotes();
  }, [hasLoadedChildren, isLoading, isOpen, loadSubNotes, note.isFolder]);

  useEffect(() => {
    if (!note.isFolder || !isOpen || !hasLoadedChildren || isLoading) return;
    if (treeVersion === lastSyncedTreeVersionRef.current) return;
    lastSyncedTreeVersionRef.current = treeVersion;
    void loadSubNotes();
  }, [hasLoadedChildren, isLoading, isOpen, loadSubNotes, note.isFolder, treeVersion]);

  useEffect(() => {
    if (!note.isFolder) return;
    const cachedChildren = FOLDER_CHILDREN_CACHE.get(note.path);
    if (!cachedChildren || cachedChildren.length === 0) return;
    setChildren(cachedChildren);
    setHasLoadedChildren(true);
  }, [note.isFolder, note.path]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(note.path);
    if (isRenaming) return;
    if (!isOpen) {
      await loadSubNotes();
    } else {
      setOpenState(false);
    }
  };

  const handleDeleteChild = useCallback(async (item: TreeItemMeta) => {
    if (item.isFolder) {
      clearFolderCache(item.path);
    }
    await onDelete(item);
    await refreshChildrenIfOpen();
  }, [onDelete, refreshChildrenIfOpen]);

  const handleRenameChild = useCallback(async (item: TreeItemMeta, name: string) => {
    const renamed = await onRename(item, name);
    if (item.isFolder && renamed && renamed !== item.path) {
      const cached = FOLDER_CHILDREN_CACHE.get(item.path);
      clearFolderCache(item.path);
      if (cached) {
        FOLDER_CHILDREN_CACHE.set(renamed, cached);
      }
    }
    await refreshChildrenIfOpen();
    return renamed;
  }, [onRename, refreshChildrenIfOpen]);

  const handleMoveChild = useCallback(async (item: TreeItemMeta, targetFolderPath: string) => {
    const movedPath = await onMove(item, targetFolderPath);
    if (item.isFolder && movedPath && movedPath !== item.path) {
      const cached = FOLDER_CHILDREN_CACHE.get(item.path);
      clearFolderCache(item.path);
      if (cached) {
        FOLDER_CHILDREN_CACHE.set(movedPath, cached);
      }
    }
    await refreshChildrenIfOpen();
    return movedPath;
  }, [onMove, refreshChildrenIfOpen]);

  const submitRename = useCallback(async () => {
    const nextName = renameValue.trim();
    if (!nextName) {
      setRenameValue(note.title);
      onRenameDone(note.path);
      return;
    }

    const renamedPath = await onRename({ path: note.path, title: note.title, isFolder: note.isFolder }, nextName);
    onRenameDone(renamedPath || note.path);
  }, [note.isFolder, note.path, note.title, onRename, onRenameDone, renameValue]);

  const cancelRename = useCallback(() => {
    setRenameValue(note.title);
    onRenameDone(note.path);
  }, [note.path, note.title, onRenameDone]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate(note.path);
    setMenuOpen(true);
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (isRenaming) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_ITEM_MIME, JSON.stringify(itemMeta));
    onActivate(note.path);
  };

  const handleFolderDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const dragItem = getDragItem(event);
    if (!dragItem) return;
    if (dragItem.path === note.path) return;
    if (dragItem.isFolder && isDescendantPath(note.path, dragItem.path)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleFolderDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const dragItem = getDragItem(event);
    if (!dragItem) return;
    if (dragItem.path === note.path) return;
    if (dragItem.isFolder && isDescendantPath(note.path, dragItem.path)) return;

    await onMove(dragItem, note.path);
    await loadSubNotes();
  };

  const focusTreeItem = (element?: Element | null) => {
    if (!(element instanceof HTMLElement)) return;
    element.focus();
    const path = element.dataset.path;
    if (path) onActivate(path);
  };

  const getVisibleTreeItems = (event: KeyboardEvent<HTMLDivElement>) => {
    const tree = event.currentTarget.closest('[role="tree"]');
    if (!tree) return [];
    return Array.from(tree.querySelectorAll<HTMLElement>('[data-tree-node="true"]'));
  };

  const handleTreeKeyDown = async (event: KeyboardEvent<HTMLDivElement>) => {
    if (isRenaming) return;
    const items = getVisibleTreeItems(event);
    const current = event.currentTarget;
    const currentIndex = items.indexOf(current);
    if (currentIndex < 0) return;
    const emacsKey = event.ctrlKey ? event.key.toLowerCase() : "";
    const isUp = event.key === "ArrowUp" || emacsKey === "p";
    const isDown = event.key === "ArrowDown" || emacsKey === "n";
    const isRight = event.key === "ArrowRight" || emacsKey === "f";
    const isLeft = event.key === "ArrowLeft" || emacsKey === "b";

    if (isDown) {
      event.preventDefault();
      focusTreeItem(items[currentIndex + 1]);
      return;
    }

    if (isUp) {
      event.preventDefault();
      focusTreeItem(items[currentIndex - 1]);
      return;
    }

    if (isRight) {
      event.preventDefault();
      if (note.isFolder) {
        if (!isOpen) {
          await loadSubNotes();
          return;
        }
        const child = items[currentIndex + 1];
        if (child && Number(child.dataset.level) === level + 1) {
          focusTreeItem(child);
        }
      } else {
        void onSelect(note);
      }
      return;
    }

    if (isLeft) {
      event.preventDefault();
      if (note.isFolder && isOpen) {
        setOpenState(false);
        return;
      }
      const currentLevel = Number(current.dataset.level || level);
      for (let i = currentIndex - 1; i >= 0; i -= 1) {
        const candidate = items[i];
        const candidateLevel = Number(candidate.dataset.level || 0);
        if (candidateLevel < currentLevel) {
          focusTreeItem(candidate);
          return;
        }
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (note.isFolder) {
        if (isOpen) {
          setOpenState(false);
        } else {
          await loadSubNotes();
        }
      } else {
        await onSelect(note);
      }
    }
  };

  const renameInput = (
    <Input
      ref={renameInputRef}
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => {
        if (skipBlurSubmitRef.current) {
          skipBlurSubmitRef.current = false;
          return;
        }
        void submitRename();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          skipBlurSubmitRef.current = true;
          e.preventDefault();
          void submitRename();
          return;
        }
        if (e.key === "Escape") {
          skipBlurSubmitRef.current = true;
          e.preventDefault();
          cancelRename();
        }
      }}
      className="h-6 text-xs"
    />
  );

  const moreMenu = (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More actions"
          className={cn(
            "h-6 w-6 rounded-md opacity-0 transition-opacity text-muted-foreground hover:text-foreground hover:bg-accent/70 group-hover:opacity-100",
            menuOpen && "opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onActivate(note.path);
          }}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="rounded-2xl min-w-44 p-1.5 shadow-xl">
        <DropdownMenuItem onSelect={() => onRequestRename(note.path)}>
          <Pencil className="size-4" /> 重命名
        </DropdownMenuItem>
        {note.isFolder && (
          <>
            <DropdownMenuItem onSelect={() => void handleCreateFileInside()}>
              <FilePlus className="size-4" /> 新建文件
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void handleCreateFolderInside()}>
              <FolderPlus className="size-4" /> 新建文件夹
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => void onExport(itemMeta)}>
          <Download className="size-4" /> 导出
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void onDelete(itemMeta)}>
          <Trash2 className="size-4" /> 删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (note.isFolder) {
    return (
      <div className="flex flex-col" onContextMenu={handleContextMenu}>
        <div
          onClick={handleToggle}
          onDragOver={handleFolderDragOver}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => void handleFolderDrop(e)}
          draggable={!isRenaming}
          onDragStart={handleDragStart}
          onFocus={() => onActivate(note.path)}
          onKeyDown={(e) => void handleTreeKeyDown(e)}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent/50 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70",
            isSelected && "bg-accent text-accent-foreground",
            isDragOver && "bg-accent/70 ring-1 ring-border"
          )}
          tabIndex={isSelected ? 0 : -1}
          data-tree-node="true"
          data-level={level}
          data-path={note.path}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={isOpen}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <Folder className="size-4 shrink-0 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
          {isRenaming ? renameInput : <span className="truncate flex-1 font-medium">{note.title}</span>}
          {isRenaming ? null : moreMenu}
        </div>

        {isOpen && (
          <div className="flex flex-col">
            {isLoading ? (
              <div className="py-1 opacity-60 text-[11px]" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                Loading...
              </div>
            ) : children.length === 0 ? (
              <div className="py-1 opacity-45 text-[11px] italic" style={{ paddingLeft: `${(level + 1) * 12 + 24}px` }}>
                Empty
              </div>
            ) : (
              children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  note={child}
                  activePath={activePath}
                  focusPath={focusPath}
                  renamePath={renamePath}
                  level={level + 1}
                  onSelect={onSelect}
                  onActivate={onActivate}
                  onDelete={handleDeleteChild}
                  onCreateFile={onCreateFile}
                  onCreateFolder={onCreateFolder}
                  onLoadChildren={onLoadChildren}
                  onRequestRename={onRequestRename}
                  onRename={handleRenameChild}
                  onMove={handleMoveChild}
                  onExport={onExport}
                  onRenameDone={onRenameDone}
                  onFocusHandled={onFocusHandled}
                  treeVersion={treeVersion}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" onContextMenu={handleContextMenu}>
      <div
        onClick={() => {
          onActivate(note.path);
          void onSelect(note);
        }}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onFocus={() => onActivate(note.path)}
        onKeyDown={(e) => void handleTreeKeyDown(e)}
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors relative hover:bg-accent/50 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70",
          isSelected && "bg-accent text-accent-foreground"
        )}
        tabIndex={isSelected ? 0 : -1}
        data-tree-node="true"
        data-level={level}
        data-path={note.path}
        role="treeitem"
        aria-selected={isSelected}
        style={{ paddingLeft: `${level * 12 + 24}px` }}
      >
        <FileText className="size-4 shrink-0 opacity-70" />
        {isRenaming ? renameInput : <span className="truncate flex-1">{note.title}</span>}
        {isRenaming ? null : moreMenu}
      </div>
    </div>
  );
});
