import { invoke } from "@tauri-apps/api/core";
import { GitChangeStatus, GitRepoInfo, GitService, GitSyncResult } from "@/domain/services/GitService";

export class GitSyncService implements GitService {
  async getRepoInfo(rootPath: string): Promise<GitRepoInfo> {
    return invoke<GitRepoInfo>("git_get_repo_info", { rootPath });
  }

  async initRepo(rootPath: string): Promise<GitRepoInfo> {
    return invoke<GitRepoInfo>("git_init_repo", { rootPath });
  }

  async setRemote(rootPath: string, remoteUrl: string): Promise<GitRepoInfo> {
    return invoke<GitRepoInfo>("git_set_remote", { rootPath, remoteUrl });
  }

  async sync(rootPath: string, commitMessage?: string): Promise<GitSyncResult> {
    return invoke<GitSyncResult>("git_sync_notes", {
      rootPath,
      commitMessage: commitMessage?.trim() || null,
    });
  }

  async getChangeStatus(rootPath: string): Promise<GitChangeStatus> {
    return invoke<GitChangeStatus>("git_get_change_status", { rootPath });
  }
}
