import { useState, useEffect, useCallback } from "react";
import { Note } from "@/domain/entities/Note";
import { FileSystemNoteRepository } from "@/data/repositories/FileSystemNoteRepository";
import { open } from "@tauri-apps/plugin-dialog";

const repository = new FileSystemNoteRepository();

export function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [rootPath, setRootPath] = useState<string | null>(null);

    const refreshNotes = useCallback(async () => {
        setLoading(true);
        try {
            const fetchedNotes = await repository.getNotes();
            setNotes(fetchedNotes);
        } catch (error) {
            console.error("Failed to load notes:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshNotes();
    }, [refreshNotes]);

    const selectRootFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });
            if (selected && typeof selected === "string") {
                await repository.setRootPath(selected);
                setRootPath(selected);
                refreshNotes();
            }
        } catch (error) {
            console.error("Folder picker error:", error);
        }
    };

    const loadFolderChildren = async (path: string): Promise<Note[]> => {
        return await repository.getNotes(path);
    };

    const loadContent = async (path: string) => {
        try {
            return await repository.loadNoteContent(path);
        } catch (error) {
            console.error("Load content error:", error);
            return "";
        }
    };

    const updateNote = async (note: Note) => {
        await repository.saveNote(note);
    };

    const createNote = async (parentPath?: string) => {
        const path = parentPath || await repository.getRootPath();
        const newPath = await repository.createFile(path, "Untitled Note");
        await refreshNotes();
        return newPath;
    };

    const createFolder = async (parentPath?: string) => {
        const path = parentPath || await repository.getRootPath();
        const newPath = await repository.createFolder(path, "New Folder");
        await refreshNotes();
        return newPath;
    };

    const deleteItem = async (path: string) => {
        await repository.deleteItem(path);
        await refreshNotes();
    };

    const renameItem = async (path: string, name: string, isFolder: boolean) => {
        const newPath = await repository.renameItem(path, name, isFolder);
        await refreshNotes();
        return newPath;
    };

    const moveItem = async (path: string, targetFolderPath: string, isFolder: boolean) => {
        const newPath = await repository.moveItem(path, targetFolderPath, isFolder);
        await refreshNotes();
        return newPath;
    };

    const exportItem = async (path: string, isFolder: boolean) => {
        const selected = await open({
            directory: true,
            multiple: false,
            title: "选择导出目录",
        });

        if (!selected || typeof selected !== "string") return;
        return await repository.exportItem(path, isFolder, selected);
    };

    return {
        notes,
        loading,
        rootPath,
        refreshNotes,
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
    };
}
