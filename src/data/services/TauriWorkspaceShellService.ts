import { invoke } from "@tauri-apps/api/core";
import { WorkspaceShellService } from "@/domain/services/WorkspaceShellService";

export class TauriWorkspaceShellService implements WorkspaceShellService {
  async openInTerminal(rootPath: string): Promise<void> {
    await invoke("open_in_terminal", { rootPath });
  }
}
