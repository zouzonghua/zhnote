import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { useNotes } from "@/presentation/hooks/useNotes";
import { useTheme } from "@/presentation/hooks/useTheme";
import { Sidebar } from "@/presentation/components/sidebar/Sidebar";
import { StatusBar } from "@/presentation/components/StatusBar";
import { isDescendantPath, isSameOrDescendant } from "@/presentation/components/sidebar/pathUtils";
import { TreeItemMeta } from "@/presentation/components/sidebar/types";
import { Note } from "@/domain/entities/Note";
import { GitSyncResult } from "@/domain/services/GitService";
import { Button } from "@/components/ui/button";
import "./App.css";

const NoteEditor = lazy(async () => {
  const module = await import("@/presentation/components/NoteEditor");
  return { default: module.NoteEditor };
});

const SystemSettingsDialog = lazy(async () => {
  const module = await import("@/presentation/components/settings/SystemSettingsDialog");
  return { default: module.SystemSettingsDialog };
});

function App() {
  const {
    notes,
    loading,
    rootPath,
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
    getGitRepoInfo,
    initGitRepo,
    setGitRemote,
    syncGitNotes,
    getGitChangeStatus,
    openRootInTerminal,
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
  const [gitSyncing, setGitSyncing] = useState(false);
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [editorStats, setEditorStats] = useState<{ words: number; chars: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [statusShortcut, setStatusShortcut] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  const pushStatus = useCallback((
    message: string,
    tone: "info" | "success" | "error" = "info",
    shortcut?: string,
    ttlMs = 2800,
  ) => {
    setStatusMessage(message);
    setStatusTone(tone);
    setStatusShortcut(shortcut ?? null);
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    if (ttlMs > 0) {
      statusTimerRef.current = window.setTimeout(() => {
        setStatusMessage("Ready");
        setStatusTone("info");
        setStatusShortcut(null);
        statusTimerRef.current = null;
      }, ttlMs);
    }
  }, []);

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

  const handleEditorStatsChange = useCallback((words: number, chars: number) => {
    setEditorStats((current) => {
      if (current && current.words === words && current.chars === chars) {
        return current;
      }
      return { words, chars };
    });
  }, []);

  useEffect(() => {
    if (!activeNote) {
      setEditorStats(null);
    }
  }, [activeNote]);

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
      if (event.shiftKey) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b";
      if (!hotkey) return;
      event.preventDefault();
      pushStatus("Shortcut triggered.", "info", "Cmd/Ctrl+B");
      toggleSidebar();
    };

    window.addEventListener("keydown", handleToggleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleToggleSidebarShortcut);
  }, [pushStatus, toggleSidebar]);

  useEffect(() => {
    const handleToggleStatusBarShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "b";
      if (!hotkey) return;
      event.preventDefault();
      setStatusBarVisible((current) => {
        const next = !current;
        if (next) {
          pushStatus("Status bar shown.", "info", "Cmd/Ctrl+Shift+B");
        }
        return next;
      });
    };

    window.addEventListener("keydown", handleToggleStatusBarShortcut);
    return () => window.removeEventListener("keydown", handleToggleStatusBarShortcut);
  }, [pushStatus]);

  useEffect(() => {
    const handleSettingsShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.key === ",";
      if (!hotkey) return;
      event.preventDefault();
      pushStatus("Shortcut triggered.", "info", "Cmd/Ctrl+,");
      setSettingsOpen(true);
    };

    window.addEventListener("keydown", handleSettingsShortcut);
    return () => window.removeEventListener("keydown", handleSettingsShortcut);
  }, [pushStatus]);

  useEffect(() => {
    const handleOpenTerminalShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "t";
      if (!hotkey) return;
      event.preventDefault();
      pushStatus("Shortcut triggered.", "info", "Cmd/Ctrl+T");
      void openRootInTerminal().then(
        () => pushStatus("Opened current vault in Terminal.", "success"),
        (error) => pushStatus(`Open Terminal failed: ${String(error)}`, "error"),
      );
    };

    window.addEventListener("keydown", handleOpenTerminalShortcut);
    return () => window.removeEventListener("keydown", handleOpenTerminalShortcut);
  }, [openRootInTerminal, pushStatus]);

  const handleSaveActiveNote = useCallback(async (updated: Note) => {
    setActiveNote(updated);
    await updateNote(updated);
    setHasUnsavedChanges(false);
    setUnsavedDraft(null);
  }, [updateNote]);

  const handleSyncNotes = useCallback(async (commitMessage?: string): Promise<GitSyncResult> => {
    if (gitSyncing) {
      throw new Error("Sync is already in progress.");
    }
    pushStatus("Syncing notes...", "info", undefined, 0);
    setGitSyncing(true);
    try {
      const result = await syncGitNotes(commitMessage);
      pushStatus(result.committed ? "Sync complete: changes pushed." : "Sync complete.", "success");
      return result;
    } finally {
      setGitSyncing(false);
    }
  }, [gitSyncing, pushStatus, syncGitNotes]);

  const handleSidebarSync = useCallback(async () => {
    pushStatus("Checking local changes...", "info", undefined, 0);
    try {
      const status = await getGitChangeStatus();
      if (!status.isRepo) {
        pushStatus("Current vault is not a Git repository.", "error");
        return;
      }
      if (!status.hasRemote) {
        pushStatus("Remote origin is not configured.", "error");
        return;
      }
      if (!status.hasChanges) {
        pushStatus("No local changes to sync.", "success");
        return;
      }

      await handleSyncNotes();
    } catch (error) {
      pushStatus(`Sync failed: ${String(error)}`, "error");
    }
  }, [getGitChangeStatus, handleSyncNotes, pushStatus]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden flex bg-background text-foreground font-sans">
        <div className="macos-drag-region" />
        <button
          type="button"
          className={`titlebar-sidebar-toggle group ${sidebarCollapsed ? "is-collapsed" : ""}`}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          title="Toggle sidebar (Cmd/Ctrl+B)"
        >
          <ChevronLeft strokeWidth={2.75} className={`size-5 transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`} />
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
            onSync={handleSidebarSync}
            syncInProgress={gitSyncing}
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

        <main className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col bg-background">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeNote ? (
              <Suspense
                fallback={(
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Loading editor...
                  </div>
                )}
              >
                <NoteEditor
                  note={activeNote}
                  onChange={handleSaveActiveNote}
                  onDirtyChange={handleDraftChange}
                  focusToken={editorFocusToken}
                  onStatus={pushStatus}
                  onStatsChange={handleEditorStatsChange}
                  showFloatingStats={!statusBarVisible}
                  reserveTrafficLightSpace={sidebarCollapsed}
                />
              </Suspense>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-40 select-none">
                <FileText className="size-16 mb-4" />
                <p className="text-sm font-medium tracking-widest uppercase">Select a note to start writing</p>
                <Button variant="link" size="sm" onClick={selectRootFolder} className="mt-2">
                  Open a folder (Vault)
                </Button>
              </div>
            )}
          </div>
          {statusBarVisible && <StatusBar message={statusMessage} tone={statusTone} shortcut={statusShortcut} stats={editorStats} />}
        </main>
        <Suspense fallback={null}>
          <SystemSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            rootPath={rootPath}
            theme={theme}
            setTheme={setTheme}
            onGetGitRepoInfo={getGitRepoInfo}
            onInitGitRepo={initGitRepo}
            onSetGitRemote={setGitRemote}
            onSyncGitNotes={handleSyncNotes}
            syncInProgress={gitSyncing}
          />
        </Suspense>
    </div>
  );
}

export default App;
