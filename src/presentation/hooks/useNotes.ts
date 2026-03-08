import { useState, useEffect, useCallback } from "react";
import { Note } from "@/domain/entities/Note";
import { createNoteWorkspaceService } from "@/application/factories/createNoteWorkspaceService";
import { GitChangeStatus, GitRepoInfo, GitSyncResult } from "@/domain/services/GitService";
import { open } from "@tauri-apps/plugin-dialog";

const workspaceService = createNoteWorkspaceService();

export function useNotes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [rootPath, setRootPath] = useState<string | null>(null);

    const refreshNotes = useCallback(async () => {
        setLoading(true);
        try {
            const currentRoot = await workspaceService.getRootPath();
            setRootPath(currentRoot);
            const fetchedNotes = await workspaceService.listNotes();
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
                await workspaceService.selectRootPath(selected);
                setRootPath(selected);
                await refreshNotes();
            }
        } catch (error) {
            console.error("Folder picker error:", error);
        }
    };

    const loadFolderChildren = async (path: string): Promise<Note[]> => {
        return await workspaceService.listNotes(path);
    };

    const loadContent = async (path: string) => {
        try {
            return await workspaceService.loadNoteContent(path);
        } catch (error) {
            console.error("Load content error:", error);
            return "";
        }
    };

    const updateNote = async (note: Note) => {
        await workspaceService.saveNote(note);
    };

    const createNote = async (parentPath?: string) => {
        const newPath = await workspaceService.createNote(parentPath);
        await refreshNotes();
        return newPath;
    };

    const createFolder = async (parentPath?: string) => {
        const newPath = await workspaceService.createFolder(parentPath);
        await refreshNotes();
        return newPath;
    };

    const deleteItem = async (path: string) => {
        await workspaceService.deleteItem(path);
        await refreshNotes();
    };

    const renameItem = async (path: string, name: string, isFolder: boolean) => {
        const newPath = await workspaceService.renameItem(path, name, isFolder);
        await refreshNotes();
        return newPath;
    };

    const moveItem = async (path: string, targetFolderPath: string, isFolder: boolean) => {
        const newPath = await workspaceService.moveItem(path, targetFolderPath, isFolder);
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
        return await workspaceService.exportItem(path, isFolder, selected);
    };

    const getGitRepoInfo = useCallback(async (): Promise<GitRepoInfo> => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        return await workspaceService.getGitRepoInfo();
    }, []);

    const initGitRepo = useCallback(async (): Promise<GitRepoInfo> => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        return await workspaceService.initGitRepo();
    }, []);

    const setGitRemote = useCallback(async (remoteUrl: string): Promise<GitRepoInfo> => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        return await workspaceService.setGitRemote(remoteUrl);
    }, []);

    const syncGitNotes = useCallback(async (commitMessage?: string): Promise<GitSyncResult> => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        const result = await workspaceService.syncGitNotes(commitMessage);
        await refreshNotes();
        return result;
    }, [refreshNotes]);

    const getGitChangeStatus = useCallback(async (): Promise<GitChangeStatus> => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        return await workspaceService.getGitChangeStatus();
    }, []);

    const openRootInTerminal = useCallback(async () => {
        const path = await workspaceService.getRootPath();
        setRootPath(path);
        await workspaceService.openRootInTerminal();
    }, []);

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
        getGitRepoInfo,
        initGitRepo,
        setGitRemote,
        syncGitNotes,
        getGitChangeStatus,
        openRootInTerminal,
    };
}
