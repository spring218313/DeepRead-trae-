
export enum ThemeType {
    Light = 'Light',
    Gray = 'Gray',
    Dark = 'Dark'
}

export interface Highlight {
    id: string;
    text: string;
    paragraphIndex: number; // Index in book.content
    startOffset: number; // Start character index in the plain text
    rangeStr: string; 
    color: 'blue' | 'yellow' | 'red' | 'purple';
    style: 'underline' | 'background';
    noteId?: string; // Link to an annotation
}

export interface DrawingStroke {
    points: {x: number, y: number}[];
    color: string;
}

export interface Annotation {
    id: string;
    highlightId: string;
    text: string;
    top: number; // Y position relative to content
    pointX?: number; // X position relative to content (for arrow alignment)
    color: string;
}

export interface Book {
    id: string;
    title: string;
    author: string;
    coverColor: string;
    progress: number;
    totalParams: number;
    content: string[]; 
}

export interface BookChapter {
    id: string;
    bookId: string;
    title: string;
    startParagraphIndex: number;
}

export interface UserNote {
    id: string;
    bookId: string;
    quote: string;
    thought: string;
    date: string;
}

export type Tab = 'Discover' | 'Shelf' | 'Stories' | 'Profile';
