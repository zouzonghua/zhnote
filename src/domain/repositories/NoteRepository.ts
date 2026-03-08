import { Note } from "@/domain/entities/Note";

export interface NoteRepository {
    setRootPath(path: string): Promise<void>;
    getRootPath(): Promise<string>;
    getNotes(dirPath?: string): Promise<Note[]>;
    loadNoteContent(path: string): Promise<string>;
    saveNote(note: Note): Promise<void>;
    createFolder(parentPath: string, name: string): Promise<string>;
    createFile(parentPath: string, name: string): Promise<string>;
    renameItem(path: string, name: string, isFolder: boolean): Promise<string>;
    moveItem(path: string, targetFolderPath: string, isFolder: boolean): Promise<string>;
    exportItem(path: string, isFolder: boolean, targetFolderPath: string): Promise<string>;
    deleteItem(path: string): Promise<void>;
}
