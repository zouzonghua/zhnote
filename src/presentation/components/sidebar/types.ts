import { Note } from "@/domain/entities/Note";

export type TreeItemMeta = Pick<Note, "path" | "title" | "isFolder">;

export type RenameHandler = (item: TreeItemMeta, name: string) => Promise<string>;
export type MoveHandler = (item: TreeItemMeta, targetFolderPath: string) => Promise<string | undefined>;
export type ExportHandler = (item: TreeItemMeta) => Promise<void>;
