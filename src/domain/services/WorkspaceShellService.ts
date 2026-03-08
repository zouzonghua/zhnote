export interface WorkspaceShellService {
  openInTerminal(rootPath: string): Promise<void>;
}
