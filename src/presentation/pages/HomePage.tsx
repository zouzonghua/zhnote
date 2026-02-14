import { Note } from "@/domain/entities/Note";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface HomePageProps {
    notes: Note[];
    onCreate: () => void;
    onSelect: (note: Note) => void;
    onDelete: (id: string) => void;
}

export function HomePage({ notes, onCreate, onSelect, onDelete }: HomePageProps) {
    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">myNotes</h1>
                <Button onClick={onCreate} className="gap-2">
                    <Plus className="size-4" />
                    New Note
                </Button>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {notes.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-10">
                        No notes yet. Create one to get started!
                    </div>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.id}
                            onClick={() => onSelect(note)}
                            className="bg-card text-card-foreground p-5 rounded-xl shadow-sm hover:shadow-md border border-border cursor-pointer transition-all hover:-translate-y-1 group relative"
                        >
                            <h3 className="font-semibold text-lg mb-2 truncate">
                                {note.title || "Untitled"}
                            </h3>
                            <p className="text-muted-foreground text-sm line-clamp-3 mb-4 h-12">
                                {note.content || "No content"}
                            </p>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                        e.stopPropagation();
                                        onDelete(note.id);
                                    }}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
