export type GitRepoInfo = {
  isRepo: boolean;
  branch?: string | null;
  remoteUrl?: string | null;
};

export type GitSyncResult = {
  branch: string;
  committed: boolean;
  clean: boolean;
  pullOutput: string;
  pushOutput: string;
};

export type GitChangeStatus = {
  isRepo: boolean;
  hasRemote: boolean;
  hasChanges: boolean;
};

export interface GitService {
  getRepoInfo(rootPath: string): Promise<GitRepoInfo>;
  initRepo(rootPath: string): Promise<GitRepoInfo>;
  setRemote(rootPath: string, remoteUrl: string): Promise<GitRepoInfo>;
  sync(rootPath: string, commitMessage?: string): Promise<GitSyncResult>;
  getChangeStatus(rootPath: string): Promise<GitChangeStatus>;
}
