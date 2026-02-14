export interface Note {
    id: string;
    title: string;
    content: string;
    path: string;
    isFolder: boolean;
    createdAt: number;
    updatedAt: number;
    children?: Note[];
}
