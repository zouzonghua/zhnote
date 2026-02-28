import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Theme } from "@/presentation/hooks/useTheme";
import { GitRepoInfo, GitSyncResult } from "@/data/services/GitSyncService";
import { useEffect, useState } from "react";

type SystemSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath: string | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onGetGitRepoInfo: () => Promise<GitRepoInfo>;
  onInitGitRepo: () => Promise<GitRepoInfo>;
  onSetGitRemote: (remoteUrl: string) => Promise<GitRepoInfo>;
  onSyncGitNotes: (commitMessage?: string) => Promise<GitSyncResult>;
  syncInProgress?: boolean;
};

const THEME_OPTIONS = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "system", icon: Monitor, label: "System" },
] as const;

export function SystemSettingsDialog({
  open,
  onOpenChange,
  rootPath,
  theme,
  setTheme,
  onGetGitRepoInfo,
  onInitGitRepo,
  onSetGitRemote,
  onSyncGitNotes,
  syncInProgress = false,
}: SystemSettingsDialogProps) {
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);
  const [remoteUrlInput, setRemoteUrlInput] = useState("");
  const [commitMessage, setCommitMessage] = useState("chore(notes): sync vault");
  const [gitLoading, setGitLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<string | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !rootPath) return;
    let disposed = false;
    setGitLoading(true);
    setGitError(null);
    setGitStatus(null);
    void onGetGitRepoInfo()
      .then((info) => {
        if (disposed) return;
        setGitInfo(info);
        setRemoteUrlInput(info.remoteUrl ?? "");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setGitError(String(error));
      })
      .finally(() => {
        if (disposed) return;
        setGitLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [open, rootPath, onGetGitRepoInfo]);

  const handleInitRepo = async () => {
    setGitLoading(true);
    setGitError(null);
    setGitStatus(null);
    try {
      const info = await onInitGitRepo();
      setGitInfo(info);
      setRemoteUrlInput(info.remoteUrl ?? "");
      setGitStatus("Git repository initialized.");
    } catch (error) {
      setGitError(String(error));
    } finally {
      setGitLoading(false);
    }
  };

  const handleSaveRemote = async () => {
    setGitLoading(true);
    setGitError(null);
    setGitStatus(null);
    try {
      const info = await onSetGitRemote(remoteUrlInput.trim());
      setGitInfo(info);
      setRemoteUrlInput(info.remoteUrl ?? remoteUrlInput.trim());
      setGitStatus("Remote origin saved.");
    } catch (error) {
      setGitError(String(error));
    } finally {
      setGitLoading(false);
    }
  };

  const handleSync = async () => {
    setGitLoading(true);
    setGitError(null);
    setGitStatus(null);
    try {
      const result = await onSyncGitNotes(commitMessage.trim());
      const committed = result.committed ? "Committed local changes. " : "No local changes to commit. ";
      setGitStatus(`${committed}Synced branch ${result.branch}.`);
      const info = await onGetGitRepoInfo();
      setGitInfo(info);
      setRemoteUrlInput(info.remoteUrl ?? "");
    } catch (error) {
      setGitError(String(error));
    } finally {
      setGitLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>System-level preferences for zhNote.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance">
          <TabsList className="mb-4 h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="appearance"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary"
            >
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary"
            >
              About
            </TabsTrigger>
            <TabsTrigger
              value="git"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary"
            >
              Git Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={theme === option.id ? "default" : "outline"}
                  className="h-20 flex-col gap-2"
                  onClick={() => setTheme(option.id)}
                >
                  <option.icon className="size-5" />
                  <span className="text-[11px] font-bold uppercase">{option.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Shortcut: Cmd/Ctrl + ,</p>
          </TabsContent>

          <TabsContent value="about" className="space-y-2 py-8 text-center">
            <h3 className="text-lg font-bold">zhNote</h3>
            <p className="text-xs italic text-muted-foreground">v0.1.0</p>
            <p className="mx-auto max-w-xs text-sm">Native high-performance minimalist Markdown editor.</p>
          </TabsContent>

          <TabsContent value="git" className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Vault path</p>
              <p className="truncate rounded-md border bg-muted/20 px-2 py-1.5 text-xs">{rootPath ?? "Not selected"}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Repository</p>
              <p className="text-sm">
                {gitInfo?.isRepo ? `Initialized (${gitInfo.branch ?? "unknown branch"})` : "Not initialized"}
              </p>
            </div>

            {!gitInfo?.isRepo && (
              <Button onClick={() => void handleInitRepo()} disabled={gitLoading || !rootPath}>
                Initialize Git Repository
              </Button>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Remote origin URL</p>
              <div className="flex gap-2">
                <Input
                  value={remoteUrlInput}
                  onChange={(event) => setRemoteUrlInput(event.target.value)}
                  placeholder="git@github.com:you/notes.git"
                  disabled={gitLoading || !gitInfo?.isRepo}
                />
                <Button
                  variant="outline"
                  onClick={() => void handleSaveRemote()}
                  disabled={gitLoading || !gitInfo?.isRepo || remoteUrlInput.trim().length === 0}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Commit message</p>
              <Input
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="chore(notes): sync vault"
                disabled={gitLoading || !gitInfo?.isRepo}
              />
            </div>

            <Button
              onClick={() => void handleSync()}
              disabled={gitLoading || syncInProgress || !gitInfo?.isRepo || !gitInfo.remoteUrl}
            >
              {(gitLoading || syncInProgress) && <Loader2 className="size-4 animate-spin" />}
              {gitLoading || syncInProgress ? "Syncing..." : "Sync Now"}
            </Button>

            {!gitInfo?.remoteUrl && gitInfo?.isRepo && (
              <p className="text-xs text-muted-foreground">Set remote origin before syncing.</p>
            )}
            {gitStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400">{gitStatus}</p>}
            {gitError && <p className="text-xs text-destructive">{gitError}</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
