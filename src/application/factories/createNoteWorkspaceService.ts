import { NoteWorkspaceService } from "@/application/services/NoteWorkspaceService";
import { FileSystemNoteRepository } from "@/data/repositories/FileSystemNoteRepository";
import { GitSyncService } from "@/data/services/GitSyncService";
import { TauriWorkspaceShellService } from "@/data/services/TauriWorkspaceShellService";

let workspaceService: NoteWorkspaceService | null = null;

export const createNoteWorkspaceService = () => {
  if (!workspaceService) {
    workspaceService = new NoteWorkspaceService(
      new FileSystemNoteRepository(),
      new GitSyncService(),
      new TauriWorkspaceShellService(),
    );
  }

  return workspaceService;
};
