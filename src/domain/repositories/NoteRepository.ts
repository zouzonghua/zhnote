import { Note } from "@/domain/entities/Note";

export interface NoteRepository {
    getNotes(): Promise<Note[]>;
    getNote(id: string): Promise<Note | undefined>;
    saveNote(note: Note): Promise<void>;
    deleteNote(id: string): Promise<void>;
}
