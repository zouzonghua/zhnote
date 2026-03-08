import { readDir, readFile, writeFile, mkdir, exists, remove, rename } from "@tauri-apps/plugin-fs";
import { appDataDir, join, dirname, basename } from "@tauri-apps/api/path";
import { Note } from "@/domain/entities/Note";
import { NoteRepository } from "@/domain/repositories/NoteRepository";

export class FileSystemNoteRepository implements NoteRepository {
    private rootPath: string | null = null;
    private BLACKLIST = ["node_modules", ".git", "dist", "target", "build", ".husky", ".vscode"];

    async setRootPath(path: string) {
        this.rootPath = path;
    }

    async getRootPath(): Promise<string> {
        if (!this.rootPath) {
            this.rootPath = await appDataDir();
            if (!(await exists(this.rootPath))) {
                await mkdir(this.rootPath, { recursive: true });
            }
        }
        return this.rootPath;
    }

    // Shallow scan for a specific directory
    async getNotes(dirPath?: string): Promise<Note[]> {
        const root = dirPath || await this.getRootPath();
        const notes: Note[] = [];
        
        try {
            const entries = await readDir(root);
            for (const entry of entries) {
                if (entry.name.startsWith(".") || this.BLACKLIST.includes(entry.name)) continue;

                const fullPath = await join(root, entry.name);
                const isFolder = entry.isDirectory;
                
                if (isFolder) {
                    notes.push({
                        id: fullPath,
                        title: entry.name,
                        content: "",
                        path: fullPath,
                        isFolder: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        children: [] // Children will be loaded on demand
                    });
                } else if (entry.name.endsWith(".md")) {
                    notes.push({
                        id: fullPath,
                        title: entry.name.replace(".md", ""),
                        content: "",
                        path: fullPath,
                        isFolder: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to read directory ${root}:`, error);
        }

        return notes.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.title.localeCompare(b.title);
        });
    }

    async loadNoteContent(path: string): Promise<string> {
        const uint8array = await readFile(path);
        return new TextDecoder().decode(uint8array);
    }

    async saveNote(note: Note): Promise<void> {
        const content = new TextEncoder().encode(note.content);
        await writeFile(note.path, content);
    }

    async createFolder(parentPath: string, name: string): Promise<string> {
        let fullPath = await this.resolveUniquePath(parentPath, name, true);
        await mkdir(fullPath);
        return fullPath;
    }

    async createFile(parentPath: string, name: string): Promise<string> {
        const baseName = name.endsWith(".md") ? name.replace(".md", "") : name;
        let fullPath = await this.resolveUniquePath(parentPath, baseName, false);
        await writeFile(fullPath, new TextEncoder().encode(""));
        return fullPath;
    }

    async renameItem(path: string, name: string, isFolder: boolean): Promise<string> {
        const parentPath = await dirname(path);
        const cleanName = name.trim();
        const normalized = isFolder
            ? cleanName
            : (cleanName.endsWith(".md") ? cleanName.slice(0, -3) : cleanName);

        if (!normalized) return path;

        const currentBase = isFolder
            ? await basename(path)
            : await basename(path, ".md");

        if (currentBase === normalized) return path;

        let targetPath = await this.resolveUniquePath(parentPath, normalized, isFolder);

        await rename(path, targetPath);
        return targetPath;
    }

    async moveItem(path: string, targetFolderPath: string, isFolder: boolean): Promise<string> {
        if (path === targetFolderPath) return path;
        if (isFolder && (targetFolderPath.startsWith(`${path}/`) || targetFolderPath.startsWith(`${path}\\`))) {
            return path;
        }

        const baseName = isFolder ? await basename(path) : await basename(path, ".md");
        const targetPath = await this.resolveUniquePath(targetFolderPath, baseName, isFolder);
        await rename(path, targetPath);
        return targetPath;
    }

    async exportItem(path: string, isFolder: boolean, targetFolderPath: string): Promise<string> {
        const baseName = isFolder ? await basename(path) : await basename(path, ".md");
        const exportPath = await this.resolveUniquePath(targetFolderPath, baseName, isFolder);
        await this.copyItem(path, exportPath, isFolder);
        return exportPath;
    }

    private async copyItem(sourcePath: string, targetPath: string, isFolder: boolean): Promise<void> {
        if (isFolder) {
            await mkdir(targetPath, { recursive: true });
            const entries = await readDir(sourcePath);
            for (const entry of entries) {
                if (!entry.name) continue;
                const sourceChild = await join(sourcePath, entry.name);
                const targetChild = await join(targetPath, entry.name);
                if (entry.isDirectory) {
                    await this.copyItem(sourceChild, targetChild, true);
                } else {
                    const content = await readFile(sourceChild);
                    await writeFile(targetChild, content);
                }
            }
            return;
        }

        const content = await readFile(sourcePath);
        await writeFile(targetPath, content);
    }

    private async resolveUniquePath(parentPath: string, name: string, isFolder: boolean): Promise<string> {
        let fullPath = await join(parentPath, isFolder ? name : `${name}.md`);
        let counter = 1;
        while (await exists(fullPath)) {
            const candidateName = `${name} ${counter}`;
            fullPath = await join(parentPath, isFolder ? candidateName : `${candidateName}.md`);
            counter++;
        }
        return fullPath;
    }

    async deleteItem(path: string): Promise<void> {
        await remove(path, { recursive: true });
    }
}
