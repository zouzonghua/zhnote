import { Note } from "@/domain/entities/Note";
import { NoteRepository } from "@/domain/repositories/NoteRepository";

const STORAGE_KEY = "notes_data";

export class LocalNoteRepository implements NoteRepository {
    async getNotes(): Promise<Note[]> {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            // Seed initial mock data
            const welcomeNote: Note = {
                id: "welcome-note",
                title: "Welcome to zhNote 🚀",
                content: "# Getting Started\n\nzhNote is a high-performance minimalist Markdown editor.\n\n## Mermaid Support\n\n### Flowchart\n```mermaid\nflowchart TD\n    A[Start] --> B{Is it working?}\n    B -- Yes --> C[Enjoy zhNote!]\n    B -- No --> D[Check console]\n```\n\n### Sequence Diagram\n```mermaid\nsequenceDiagram\n    User->>App: Write Markdown\n    App->>Mermaid: Parse code\n    Mermaid-->>App: Render SVG\n    App-->>User: Visual Chart\n```",
                path: "welcome-note.md",
                isFolder: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            const initialData = [welcomeNote];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
            return initialData;
        }
        return JSON.parse(data);
    }

    async getNote(id: string): Promise<Note | undefined> {
        const notes = await this.getNotes();
        return notes.find((n) => n.id === id);
    }

    async saveNote(note: Note): Promise<void> {
        const notes = await this.getNotes();
        const index = notes.findIndex((n) => n.id === note.id);
        if (index >= 0) {
            notes[index] = note;
        } else {
            notes.push(note);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }

    async deleteNote(id: string): Promise<void> {
        const notes = await this.getNotes();
        const filtered = notes.filter((n) => n.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
}
