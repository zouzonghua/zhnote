import { Note } from "@/domain/entities/Note";
import { NoteRepository } from "@/domain/repositories/NoteRepository";
import { GitChangeStatus, GitRepoInfo, GitService, GitSyncResult } from "@/domain/services/GitService";
import { WorkspaceShellService } from "@/domain/services/WorkspaceShellService";

export class NoteWorkspaceService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly gitService: GitService,
    private readonly shellService: WorkspaceShellService,
  ) {}

  async selectRootPath(path: string): Promise<void> {
    await this.noteRepository.setRootPath(path);
  }

  async getRootPath(): Promise<string> {
    return this.noteRepository.getRootPath();
  }

  async listNotes(dirPath?: string): Promise<Note[]> {
    return this.noteRepository.getNotes(dirPath);
  }

  async loadNoteContent(path: string): Promise<string> {
    return this.noteRepository.loadNoteContent(path);
  }

  async saveNote(note: Note): Promise<void> {
    await this.noteRepository.saveNote(note);
  }

  async createNote(parentPath?: string, name = "Untitled Note"): Promise<string> {
    const resolvedParent = parentPath || await this.noteRepository.getRootPath();
    return this.noteRepository.createFile(resolvedParent, name);
  }

  async createFolder(parentPath?: string, name = "New Folder"): Promise<string> {
    const resolvedParent = parentPath || await this.noteRepository.getRootPath();
    return this.noteRepository.createFolder(resolvedParent, name);
  }

  async deleteItem(path: string): Promise<void> {
    await this.noteRepository.deleteItem(path);
  }

  async renameItem(path: string, name: string, isFolder: boolean): Promise<string> {
    return this.noteRepository.renameItem(path, name, isFolder);
  }

  async moveItem(path: string, targetFolderPath: string, isFolder: boolean): Promise<string> {
    return this.noteRepository.moveItem(path, targetFolderPath, isFolder);
  }

  async exportItem(path: string, isFolder: boolean, targetFolderPath: string): Promise<string> {
    return this.noteRepository.exportItem(path, isFolder, targetFolderPath);
  }

  async getGitRepoInfo(): Promise<GitRepoInfo> {
    const rootPath = await this.noteRepository.getRootPath();
    return this.gitService.getRepoInfo(rootPath);
  }

  async initGitRepo(): Promise<GitRepoInfo> {
    const rootPath = await this.noteRepository.getRootPath();
    return this.gitService.initRepo(rootPath);
  }

  async setGitRemote(remoteUrl: string): Promise<GitRepoInfo> {
    const rootPath = await this.noteRepository.getRootPath();
    return this.gitService.setRemote(rootPath, remoteUrl);
  }

  async syncGitNotes(commitMessage?: string): Promise<GitSyncResult> {
    const rootPath = await this.noteRepository.getRootPath();
    return this.gitService.sync(rootPath, commitMessage);
  }

  async getGitChangeStatus(): Promise<GitChangeStatus> {
    const rootPath = await this.noteRepository.getRootPath();
    return this.gitService.getChangeStatus(rootPath);
  }

  async openRootInTerminal(): Promise<void> {
    const rootPath = await this.noteRepository.getRootPath();
    await this.shellService.openInTerminal(rootPath);
  }
}
