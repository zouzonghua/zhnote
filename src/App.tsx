import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { useNotes } from "@/presentation/hooks/useNotes";
import { useTheme } from "@/presentation/hooks/useTheme";
import { NoteEditor } from "@/presentation/components/NoteEditor";
import { Sidebar } from "@/presentation/components/sidebar/Sidebar";
import { SystemSettingsDialog } from "@/presentation/components/settings/SystemSettingsDialog";
import { isDescendantPath, isSameOrDescendant } from "@/presentation/components/sidebar/pathUtils";
import { TreeItemMeta } from "@/presentation/components/sidebar/types";
import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import "./App.css";

function App() {
  const {
    notes,
    loading,
    selectRootFolder,
    loadFolderChildren,
    loadContent,
    updateNote,
    createNote,
    createFolder,
    deleteItem,
    renameItem,
    moveItem,
    exportItem,
  } = useNotes();
  const { theme, setTheme } = useTheme();

  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activePath, setActivePath] = useState<string | undefined>(undefined);
  const [pendingFocusPath, setPendingFocusPath] = useState<string | null>(null);
  const [renamePath, setRenamePath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedDraft, setUnsavedDraft] = useState<Note | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarFocusToken, setSidebarFocusToken] = useState(0);
  const [editorFocusToken, setEditorFocusToken] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleRenameDone = useCallback((path: string) => {
    setRenamePath((current) => (current === path ? null : current));
  }, []);

  const handleFocusHandled = useCallback((path: string) => {
    setPendingFocusPath((current) => (current === path ? null : current));
  }, []);

  const handleSelectNote = useCallback(async (note: Note) => {
    if (note.isFolder) return;
    if (activePath && activePath !== note.path && hasUnsavedChanges) {
      const confirmed = window.confirm("当前文件有未保存修改。点击“确定”将先保存当前文件再切换。");
      if (!confirmed) return;
      if (unsavedDraft) {
        await updateNote(unsavedDraft);
        setActiveNote(unsavedDraft);
      }
      setHasUnsavedChanges(false);
      setUnsavedDraft(null);
    }
    const content = await loadContent(note.path);
    setActivePath(note.path);
    setActiveNote({ ...note, content });
  }, [activePath, hasUnsavedChanges, loadContent, unsavedDraft, updateNote]);

  const handleCreateFile = useCallback(async (parentPath: string) => {
    const newPath = await createNote(parentPath);
    if (newPath) {
      setActivePath(newPath);
      setPendingFocusPath(newPath);
    }
    return newPath;
  }, [createNote]);

  const handleCreateFolder = useCallback(async (parentPath: string) => {
    const newPath = await createFolder(parentPath);
    if (newPath) {
      setActivePath(newPath);
      setPendingFocusPath(newPath);
    }
    return newPath;
  }, [createFolder]);

  const handleCreateRootFile = useCallback(async () => {
    const newPath = await createNote();
    if (newPath) {
      setActivePath(newPath);
      setPendingFocusPath(newPath);
    }
  }, [createNote]);

  const handleDeleteItem = useCallback(async (item: TreeItemMeta) => {
    await deleteItem(item.path);

    setActiveNote((current) => {
      if (!current) return current;
      return isSameOrDescendant(current.path, item.path) ? null : current;
    });
    setActivePath((current) => (isSameOrDescendant(current, item.path) ? undefined : current));
    setRenamePath((current) => (isSameOrDescendant(current, item.path) ? null : current));
    setPendingFocusPath((current) => (isSameOrDescendant(current, item.path) ? null : current));
  }, [deleteItem]);

  const handleRenameItem = useCallback(async (item: TreeItemMeta, nextName: string) => {
    const normalized = item.isFolder ? nextName.trim() : nextName.trim().replace(/\.md$/, "");
    const newPath = await renameItem(item.path, normalized, item.isFolder);
    if (!newPath || newPath === item.path) return newPath;

    const remapPath = (value: string) =>
      value === item.path
        ? newPath
        : isDescendantPath(value, item.path)
          ? `${newPath}${value.slice(item.path.length)}`
          : value;

    setActivePath((current) => (current ? remapPath(current) : current));
    setRenamePath((current) => (current ? remapPath(current) : current));
    setPendingFocusPath((current) => (current ? remapPath(current) : current));
    setActiveNote((current) => {
      if (!current || !isSameOrDescendant(current.path, item.path)) return current;
      const mappedPath = remapPath(current.path);
      return {
        ...current,
        id: mappedPath,
        path: mappedPath,
        title: current.path === item.path ? normalized : current.title,
      };
    });

    return newPath;
  }, [renameItem]);

  const handleMoveItem = useCallback(async (item: TreeItemMeta, targetFolderPath: string) => {
    if (item.path === targetFolderPath) return item.path;
    if (item.isFolder && isDescendantPath(targetFolderPath, item.path)) return item.path;

    const newPath = await moveItem(item.path, targetFolderPath, item.isFolder);
    if (!newPath || newPath === item.path) return newPath;

    const remapPath = (value: string) =>
      value === item.path
        ? newPath
        : isDescendantPath(value, item.path)
          ? `${newPath}${value.slice(item.path.length)}`
          : value;

    setActivePath((current) => (current ? remapPath(current) : current));
    setRenamePath((current) => (current ? remapPath(current) : current));
    setPendingFocusPath(newPath);
    setActiveNote((current) => {
      if (!current || !isSameOrDescendant(current.path, item.path)) return current;
      const mappedPath = remapPath(current.path);
      return {
        ...current,
        id: mappedPath,
        path: mappedPath,
      };
    });

    return newPath;
  }, [moveItem]);

  const handleExportItem = useCallback(async (item: TreeItemMeta) => {
    await exportItem(item.path, item.isFolder);
  }, [exportItem]);

  const handleDraftChange = useCallback((note: Note, dirty: boolean) => {
    setHasUnsavedChanges(dirty);
    setUnsavedDraft(dirty ? note : null);
  }, []);

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  }, [hasUnsavedChanges]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      if (next) {
        setEditorFocusToken((token) => token + 1);
      } else {
        setSidebarFocusToken((token) => token + 1);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleToggleSidebarShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b";
      if (!hotkey) return;
      event.preventDefault();
      toggleSidebar();
    };

    window.addEventListener("keydown", handleToggleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleToggleSidebarShortcut);
  }, [toggleSidebar]);

  useEffect(() => {
    const handleSettingsShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.key === ",";
      if (!hotkey) return;
      event.preventDefault();
      setSettingsOpen(true);
    };

    window.addEventListener("keydown", handleSettingsShortcut);
    return () => window.removeEventListener("keydown", handleSettingsShortcut);
  }, []);

  const handleSaveActiveNote = useCallback(async (updated: Note) => {
    setActiveNote(updated);
    await updateNote(updated);
    setHasUnsavedChanges(false);
    setUnsavedDraft(null);
  }, [updateNote]);

  return (
    <div className="h-full flex bg-background text-foreground font-sans">
      <div className="macos-drag-region" />
      <button
        type="button"
        className={`titlebar-sidebar-toggle group ${sidebarCollapsed ? "is-collapsed" : ""}`}
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
        title="Toggle sidebar (Cmd/Ctrl+B)"
      >
        <ChevronLeft className={`size-3.5 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`} />
      </button>

      {!sidebarCollapsed && (
        <Sidebar
          notes={notes}
          loading={loading}
          activePath={activePath}
          focusPath={pendingFocusPath}
          renamePath={renamePath}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onOpenFolder={selectRootFolder}
          onOpenSettings={() => setSettingsOpen(true)}
          onCreateRootFile={handleCreateRootFile}
          onSelect={handleSelectNote}
          onActivate={setActivePath}
          onDelete={handleDeleteItem}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onLoadChildren={loadFolderChildren}
          onRequestRename={setRenamePath}
          onRename={handleRenameItem}
          onMove={handleMoveItem}
          onExport={handleExportItem}
          onRenameDone={handleRenameDone}
          onFocusHandled={handleFocusHandled}
          focusToken={sidebarFocusToken}
        />
      )}

      <main className="flex-1 flex flex-col bg-background min-w-0">
        {activeNote ? (
          <NoteEditor
            note={activeNote}
            onChange={handleSaveActiveNote}
            onDirtyChange={handleDraftChange}
            focusToken={editorFocusToken}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 select-none">
            <FileText className="size-16 mb-4" />
            <p className="text-sm font-medium tracking-widest uppercase">Select a note to start writing</p>
            <Button variant="link" size="sm" onClick={selectRootFolder} className="mt-2">
              Open a folder (Vault)
            </Button>
          </div>
        )}
      </main>

      <SystemSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
}

export default App;
