
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Book, ThemeType, Highlight, UserNote, DrawingStroke, Annotation } from '../types';
import { THEMES } from '../constants';
import { ChevronLeft, List, ChevronRight, Copy, Highlighter, PenLine, Share2, Search, X, Pencil, Eraser, Trash2, ScrollText, BookOpen } from 'lucide-react';
import { storageAdapter } from '../storageAdapter';

interface ReaderProps {
    book: Book;
    onClose: () => void;
    onSaveNote: (note: UserNote) => void;
}

type ReaderMode = 'paged' | 'scroll';

export const Reader: React.FC<ReaderProps> = ({ book, onClose, onSaveNote }) => {
    // Basic State
    const [theme, setTheme] = useState<ThemeType>(ThemeType.Gray);
    const [fontSize, setFontSize] = useState(18);
    const [currentPage, setCurrentPage] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [readerMode, setReaderMode] = useState<ReaderMode>('paged');
    
    // Data State
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [drawings, setDrawings] = useState<DrawingStroke[]>([]);
    const [canvasHeight, setCanvasHeight] = useState(2000);
    const [contentWidth, setContentWidth] = useState(800); // Track content width for arrows
    
    // Interaction Mode State
    const [isPencilMode, setIsPencilMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
    
    // Selection Menu State
    const [selectionRect, setSelectionRect] = useState<{top: number, left: number, height: number} | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [currentRange, setCurrentRange] = useState<Range | null>(null);

    // Menu for existing highlight (Click to edit/delete)
    const [highlightMenuRect, setHighlightMenuRect] = useState<{top: number, left: number} | null>(null);

    // Refs
    const contentRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const highlightMenuRef = useRef<HTMLDivElement>(null);
    const rightCanvasRef = useRef<HTMLCanvasElement>(null);
    const [rightDrawings, setRightDrawings] = useState<DrawingStroke[]>([]);
    const [isErasing, setIsErasing] = useState(false);
    const [eraserMode, setEraserMode] = useState<'region' | 'stroke'>('region');
    const [isTablet, setIsTablet] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [notebookDraft, setNotebookDraft] = useState('');
    const [notebookMode, setNotebookMode] = useState<'type' | 'draw'>('type');
    
    const [notebookSize, setNotebookSize] = useState({ width: 0, height: 0 });
    const rightNotebookContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isTablet && isLandscape && isPencilMode && rightNotebookContainerRef.current) {
            const updateSize = () => {
                if (rightNotebookContainerRef.current) {
                    const { clientWidth, clientHeight } = rightNotebookContainerRef.current;
                    setNotebookSize({ width: clientWidth, height: clientHeight });
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, [isTablet, isLandscape, isPencilMode]);

    const themes = THEMES[theme];
    const paragraphsPerPage = 3;
    const totalPages = Math.ceil(book.content.length / paragraphsPerPage);

    // Update canvas height and width based on content
    useEffect(() => {
        if (contentRef.current) {
            setCanvasHeight(contentRef.current.scrollHeight + 500);
            setContentWidth(contentRef.current.offsetWidth);
        }
    }, [book.content, fontSize, readerMode, currentPage]);

    useEffect(() => {
        const hs = storageAdapter.loadHighlights(book.id);
        const as = storageAdapter.loadAnnotations(book.id);
        const p = storageAdapter.loadProgress(book.id);
        const draft = storageAdapter.loadNotebookDraft(book.id);
        const nbStrokes = storageAdapter.loadNotebookStrokes(book.id);
        setHighlights(hs);
        setAnnotations(as);
        setNotebookDraft(draft);
        setRightDrawings(nbStrokes);
        const pageFromProgress = Math.round((p / 100) * totalPages);
        if (!isNaN(pageFromProgress) && pageFromProgress >= 0 && pageFromProgress < totalPages) {
            setCurrentPage(pageFromProgress);
        }
    }, [book.id]);

    useEffect(() => {
        storageAdapter.saveNotebookStrokes(book.id, rightDrawings);
    }, [book.id, rightDrawings]);

    // Reset scroll when changing pages in paged mode
    useEffect(() => {
        if (readerMode === 'paged' && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [currentPage, readerMode]);
    
    useEffect(() => {
        const detect = () => {
            const touch = navigator.maxTouchPoints > 0;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const tablet = touch && Math.min(w, h) >= 600 && Math.max(w, h) <= 1366;
            const landscape = w > h;
            setIsTablet(tablet);
            setIsLandscape(landscape);
        };
        detect();
        window.addEventListener('resize', detect);
        window.addEventListener('orientationchange', detect as any);
        return () => {
            window.removeEventListener('resize', detect);
            window.removeEventListener('orientationchange', detect as any);
        };
    }, []);

    // --- Helpers (Same logic as before) ---
    const getParagraphOffset = (node: Node, offset: number, paragraphNode: HTMLElement): number => {
        try {
            const range = document.createRange();
            range.setStart(paragraphNode, 0);
            range.setEnd(node, offset);
            return range.toString().length;
        } catch (e) {
            return 0;
        }
    };

    const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isPencilMode) return;
        setIsDrawing(true);
        const { x, y } = getCoordinates(e);
        setDrawings(prev => [...prev, { points: [{x, y}], color: 'rgba(239, 68, 68, 0.6)' }]); 
    };

    const draw = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDrawing || !isPencilMode) return;
        const { x, y } = getCoordinates(e);
        setDrawings(prev => {
            const lastStroke = prev[prev.length - 1];
            const newPoints = [...lastStroke.points, {x, y}];
            const newStroke = { ...lastStroke, points: newPoints };
            return [...prev.slice(0, -1), newStroke];
        });
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const endDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.beginPath(); 
    };

    const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const getCoordinatesRight = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = rightCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const eraseRightAt = (x: number, y: number) => {
        const radius = 16;
        setRightDrawings(prev => {
            const next = prev.map(stroke => {
                if (eraserMode === 'stroke') {
                    if (stroke.points.some(p => Math.hypot(p.x - x, p.y - y) < radius)) return null as any;
                    return stroke;
                } else {
                    const pts = stroke.points.filter(p => Math.hypot(p.x - x, p.y - y) >= radius);
                    if (pts.length < 2) return null as any;
                    return { ...stroke, points: pts };
                }
            }).filter(Boolean) as DrawingStroke[];
            return next;
        });
    };
    useEffect(() => {
        const canvas = rightCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            rightDrawings.forEach(stroke => {
                if (stroke.points.length < 2) return;
                ctx.beginPath();
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = stroke.color;
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            });
        }
    }, [rightDrawings, notebookSize, isTablet, isLandscape]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawings.forEach(stroke => {
                if (stroke.points.length < 2) return;
                ctx.beginPath();
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = stroke.color;
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            });
        }
    }, [drawings, currentPage, fontSize, readerMode, canvasHeight]);

    // NEW: Handle selection end (MouseUp / TouchEnd) to prevent flickering
    const handleSelection = () => {
        if (isPencilMode && !(isTablet && isLandscape)) return;
        
        // Small delay to ensure selection is finalized by browser and to allow click events to process
        setTimeout(() => {
            const selection = window.getSelection();
            
            // If no selection or collapsed, return (handleContentClick will clear menus if it was a click)
            if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) return;

            // --- Boundary Logic ---
            const MENU_WIDTH = 280;
            const MENU_HEIGHT = 70;
            const MARGIN = 32;
            const HEADER_HEIGHT = 80;
            const containerRect = contentRef.current?.getBoundingClientRect();
            const viewportLeft = containerRect ? containerRect.left : 0;
            const viewportRight = containerRect ? containerRect.right : window.innerWidth;

            // 1. Horizontal Positioning (Center then Clamp)
            let left = rect.left + (rect.width / 2) - (MENU_WIDTH / 2); 
            
            // Clamp Left
            if (left < viewportLeft + MARGIN) {
                left = viewportLeft + MARGIN;
            }
            // Clamp Right
            else if (left + MENU_WIDTH > viewportRight - MARGIN) {
                left = viewportRight - MENU_WIDTH - MARGIN;
            }

            // 2. Vertical Positioning (Top default, Bottom fallback)
            let top = rect.top - MENU_HEIGHT - 10;
            
            // Check if it hits the top edge or header
            if (top < HEADER_HEIGHT) {
                // Flip to below
                top = rect.bottom + 15;
            }

            setSelectionRect({ top, left, height: rect.height });
            setSelectedText(selection.toString());
            setCurrentRange(range);
            
            // Clear other menus
            setActiveHighlightId(null);
            setHighlightMenuRect(null);
        }, 10);
    };

    const handleContentClick = (e: React.MouseEvent) => {
        if (isPencilMode && !(isTablet && isLandscape)) return; 
        if ((e.target as HTMLElement).closest('.interactive-area')) return;

        const target = e.target as HTMLElement;
        const highlightId = target.dataset.highlightId;

        if (highlightId) {
            e.stopPropagation();
            setActiveHighlightId(highlightId);
            setSelectionRect(null); 
            
            const rect = target.getBoundingClientRect();
            const h = highlights.find(h => h.id === highlightId);
            const MENU_WIDTH = h?.noteId ? 320 : 280; 
            const MARGIN = 32;
            const containerRect = contentRef.current?.getBoundingClientRect();
            const viewportLeft = containerRect ? containerRect.left : 0;
            const viewportRight = containerRect ? containerRect.right : window.innerWidth;
            
            // 1. Horizontal Positioning (Center)
            let left = rect.left + (rect.width / 2) - (MENU_WIDTH / 2); 
            
            // 2. Clamp to Screen Edges
            if (left < viewportLeft + MARGIN) left = viewportLeft + MARGIN;
            if (left + MENU_WIDTH > viewportRight - MARGIN) {
                left = viewportRight - MENU_WIDTH - MARGIN;
            }

            let top = rect.top - 85;
            if (top < 80) top = rect.bottom + 10;

            setHighlightMenuRect({ top, left });
            return;
        }
        
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        
        setActiveHighlightId(null);
        setHighlightMenuRect(null);
        setSelectionRect(null);
        
        if (!highlightId && !activeHighlightId) {
            const width = window.innerWidth;
            const x = e.clientX;
            if (readerMode === 'paged') {
                if (isTablet && isLandscape && isPencilMode) {
                    const contentRect = contentRef.current?.getBoundingClientRect();
                    if (contentRect) {
                        const withinX = x >= contentRect.left && x <= contentRect.right;
                        const withinY = e.clientY >= contentRect.top && e.clientY <= contentRect.bottom;
                        if (!withinX || !withinY) return;
                        const relX = x - contentRect.left;
                        const relW = contentRect.width;
                        if (relX < relW * 0.3) { prevPage(); return; }
                        else if (relX > relW * 0.7) { nextPage(); return; }
                    }
                } else {
                    if (x < width * 0.3) { prevPage(); return; }
                    else if (x > width * 0.7) { nextPage(); return; }
                }
            }
            setShowControls(!showControls);
            setShowSettings(false);
        }
    };

    const handleAction = (action: 'copy' | 'share' | 'search') => {
        if (action === 'copy') { navigator.clipboard.writeText(selectedText); }
        else if (action === 'search') { window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, '_blank'); }
        setSelectionRect(null);
        window.getSelection()?.removeAllRanges();
    };

    const resolveOverlaps = (existingHighlights: Highlight[], pIndex: number, newStart: number, newEnd: number): Highlight[] => {
        let updated = [...existingHighlights];
        const result: Highlight[] = [];
        for (const h of updated) {
            if (h.paragraphIndex !== pIndex) { result.push(h); continue; }
            const hStart = h.startOffset; const hEnd = h.startOffset + h.text.length;
            if (hEnd <= newStart || hStart >= newEnd) { result.push(h); continue; }
            if (newStart <= hStart && newEnd >= hEnd) { continue; }
            if (hStart < newStart && hEnd > newEnd) {
                result.push({ ...h, id: h.id + '_L', text: h.text.substring(0, newStart - hStart), rangeStr: h.text.substring(0, newStart - hStart) });
                result.push({ ...h, id: h.id + '_R', text: h.text.substring(newEnd - hStart), rangeStr: h.text.substring(newEnd - hStart), startOffset: newEnd });
                continue;
            }
            if (hStart < newStart && hEnd > newStart) { result.push({ ...h, text: h.text.substring(0, newStart - hStart), rangeStr: h.text.substring(0, newStart - hStart) }); continue; }
            if (hStart < newEnd && hEnd > newEnd) { result.push({ ...h, id: h.id + '_T', startOffset: newEnd, text: h.text.substring(newEnd - hStart), rangeStr: h.text.substring(newEnd - hStart) }); continue; }
        }
        return result;
    };

    const calculateHighlightsForRange = (range: Range, color: Highlight['color']) => {
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const startP = startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentElement?.closest('p') : (startContainer as HTMLElement).closest('p');
        const endP = endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentElement?.closest('p') : (endContainer as HTMLElement).closest('p');
        if (!startP || !endP) return null;
        const startIdx = parseInt(startP.dataset.index || '-1');
        const endIdx = parseInt(endP.dataset.index || '-1');
        if (startIdx === -1 || endIdx === -1) return null;
        let currentHighlights = [...highlights];
        const newCreatedHighlights: Highlight[] = [];
        const remappedAnnotations: { annotationId: string, newHighlightId: string }[] = [];

        for (let i = startIdx; i <= endIdx; i++) {
            const pEl = contentRef.current?.querySelector(`p[data-index="${i}"]`) as HTMLElement;
            if (!pEl) continue;
            const fullText = book.content[i];
            let pStart = 0; let pEnd = fullText.length;
            if (i === startIdx) { pStart = getParagraphOffset(range.startContainer, range.startOffset, pEl); }
            if (i === endIdx) { pEnd = getParagraphOffset(range.endContainer, range.endOffset, pEl); }
            if (pEnd <= pStart) continue;

            // Preserve notes that are about to be swallowed by the new highlight
            const existingNotesInScope = currentHighlights.filter(h => 
                h.paragraphIndex === i && 
                h.noteId && 
                Math.max(h.startOffset, pStart) < Math.min(h.startOffset + h.text.length, pEnd)
            );
            
            let noteIdToPreserve: string | undefined = undefined;
            if (existingNotesInScope.length > 0) {
                noteIdToPreserve = existingNotesInScope[0].noteId;
            }

            currentHighlights = resolveOverlaps(currentHighlights, i, pStart, pEnd);
            
            const textChunk = fullText.substring(pStart, pEnd);
            const newH: Highlight = { 
                id: Date.now().toString() + '_' + i + '_' + Math.random().toString(36).substr(2, 5), 
                text: textChunk, 
                rangeStr: textChunk, 
                paragraphIndex: i, 
                startOffset: pStart, 
                color: color, 
                style: 'background',
                noteId: noteIdToPreserve
            };
            
            if (noteIdToPreserve) {
                remappedAnnotations.push({ annotationId: noteIdToPreserve, newHighlightId: newH.id });
            }

            currentHighlights.push(newH);
            newCreatedHighlights.push(newH);
        }
        return { all: currentHighlights, created: newCreatedHighlights, remappedAnnotations };
    };

    const handleHighlight = (color: Highlight['color']) => {
        if (!currentRange) return;
        const result = calculateHighlightsForRange(currentRange, color);
        if (result) { 
            setHighlights(result.all);
            storageAdapter.saveHighlightsBulk(book.id, result.all);
            
            // Update annotations mapping if notes were transferred to new highlights
            if (result.remappedAnnotations.length > 0) {
                 setAnnotations(prev => prev.map(a => {
                     const mapping = result.remappedAnnotations.find(m => m.annotationId === a.id);
                     if (mapping) {
                         return { ...a, highlightId: mapping.newHighlightId };
                     }
                     return a;
                 }));
                 const updated = result.remappedAnnotations.length > 0 ? annotations.map(a => {
                    const mapping = result.remappedAnnotations.find(m => m.annotationId === a.id);
                    if (mapping) return { ...a, highlightId: mapping.newHighlightId };
                    return a;
                 }) : annotations;
                 storageAdapter.saveAnnotationsBulk(book.id, updated);
            }
            
            setSelectionRect(null); 
            window.getSelection()?.removeAllRanges(); 
        }
    };

    const handleCreateNote = () => {
        if (!currentRange) return;
        const result = calculateHighlightsForRange(currentRange, 'yellow');
        if (!result || result.created.length === 0) return;
        let { all: updatedHighlights, created } = result;
        const mainHighlight = created[0];
        const annotationId = `note-${mainHighlight.id}`;
        // Set style to 'underline' to differentiate from normal highlights
        updatedHighlights = updatedHighlights.map(h => h.id === mainHighlight.id ? { ...h, noteId: annotationId, style: 'underline' } : h);
        
        const rect = currentRange.getBoundingClientRect();
        const containerRect = contentRef.current?.getBoundingClientRect();
        const relativeTop = containerRect ? rect.top - containerRect.top : 0;
        // Calculate X position relative to container for the arrow origin
        const pointX = containerRect ? (rect.left - containerRect.left) + (rect.width / 2) : 20;

        const newAnnotation: Annotation = { 
            id: annotationId, 
            highlightId: mainHighlight.id, 
            text: '', 
            top: relativeTop, 
            pointX: pointX,
            color: '#FEF3C7' 
        };
        setHighlights(updatedHighlights);
        storageAdapter.saveHighlightsBulk(book.id, updatedHighlights);
        setAnnotations(prev => [...prev, newAnnotation]);
        storageAdapter.saveAnnotation(book.id, newAnnotation);
        setSelectionRect(null);
        window.getSelection()?.removeAllRanges();
        setActiveHighlightId(mainHighlight.id);
    };

    const handleUpdateHighlightColor = (color: Highlight['color']) => {
        if (!activeHighlightId) return;
        setHighlights(prev => {
            const next = prev.map(h => {
                if (h.id !== activeHighlightId) return h;
                // When a note exists, keep underline (via noteId) and enable background color
                return { ...h, color, style: 'background' };
            });
            storageAdapter.saveHighlightsBulk(book.id, next);
            return next;
        });
        setHighlightMenuRect(null); setActiveHighlightId(null);
    };

    const handleDeleteHighlight = () => {
        if (!activeHighlightId) return;
        setHighlights(prev => {
            const next = prev.filter(h => h.id !== activeHighlightId);
            storageAdapter.saveHighlightsBulk(book.id, next);
            return next;
        });
        const h = highlights.find(h => h.id === activeHighlightId);
        if (h && h.noteId) { setAnnotations(prev => {
            const next = prev.filter(a => a.id !== h.noteId);
            storageAdapter.saveAnnotationsBulk(book.id, next);
            return next;
        }); }
        setActiveHighlightId(null); setHighlightMenuRect(null);
    };
    
    const removeColor = () => {
        if (!activeHighlightId) return;
        setHighlights(prev => {
            const next = prev.map(h => h.id === activeHighlightId ? { ...h, style: 'underline' } : h);
            storageAdapter.saveHighlightsBulk(book.id, next);
            return next;
        });
        setHighlightMenuRect(null);
        setActiveHighlightId(null);
    };
    
    const removeNoteFromHighlight = () => {
        if (!activeHighlightId) return;
        const h = highlights.find(x => x.id === activeHighlightId);
        if (!h || !h.noteId) { setHighlightMenuRect(null); setActiveHighlightId(null); return; }
        deleteAnnotation(h.noteId);
        setHighlights(prev => {
            const next = prev.map(x => x.id === activeHighlightId ? { ...x, noteId: undefined, style: 'background' } : x);
            storageAdapter.saveHighlightsBulk(book.id, next);
            return next;
        });
        setHighlightMenuRect(null);
        setActiveHighlightId(null);
    };
    
    const updateAnnotation = (id: string, text: string) => { 
        setAnnotations(prev => {
            const next = prev.map(a => a.id === id ? { ...a, text } : a);
            storageAdapter.updateAnnotationText(book.id, id, text);
            const anno = next.find(a => a.id === id);
            if (anno) {
                const hl = highlights.find(h => h.id === anno.highlightId);
                const note: UserNote = { id, bookId: book.id, quote: hl ? hl.text : '', thought: text, date: new Date().toISOString().slice(0,10) };
                storageAdapter.upsertUserNote(note);
                queueMicrotask(() => onSaveNote(note));
            }
            return next;
        });
    };
    const deleteAnnotation = (id: string) => { 
        setAnnotations(prev => {
            const next = prev.filter(a => a.id !== id);
            storageAdapter.deleteAnnotation(book.id, id);
            return next;
        }); 
        setHighlights(prev => {
            const next = prev.map(h => h.noteId === id ? { ...h, noteId: undefined } : h);
            storageAdapter.saveHighlightsBulk(book.id, next);
            return next;
        }); 
    };

    const nextPage = () => { if (currentPage < totalPages - 1) { setCurrentPage(prev => { const n = prev + 1; const percent = (n / totalPages) * 100; storageAdapter.saveProgress(book.id, percent); return n; }); setDrawings([]); setAnnotations([]); setActiveHighlightId(null); setHighlightMenuRect(null); } };
    const prevPage = () => { if (currentPage > 0) { setCurrentPage(prev => { const n = prev - 1; const percent = (n / totalPages) * 100; storageAdapter.saveProgress(book.id, percent); return n; }); setDrawings([]); setAnnotations([]); setActiveHighlightId(null); setHighlightMenuRect(null); } };

    // --- Rendering Content ---
    const renderedContent = useMemo(() => {
        const isPaged = readerMode === 'paged';
        const startGlobalIndex = isPaged ? currentPage * paragraphsPerPage : 0;
        const visibleParagraphs = isPaged ? book.content.slice(startGlobalIndex, startGlobalIndex + paragraphsPerPage) : book.content;

        return visibleParagraphs.map((para, idx) => {
            const globalIndex = startGlobalIndex + idx;
            const phs = highlights.filter(h => h.paragraphIndex === globalIndex);
            phs.sort((a, b) => a.startOffset - b.startOffset);

            let lastIndex = 0;
            let htmlParts: string[] = [];
            
            phs.forEach(h => {
                const start = h.startOffset;
                const end = start + h.text.length;
                if (start < lastIndex || start > para.length) return;
                htmlParts.push(para.slice(lastIndex, start));
                
                let styleClass = '';
                
                // 1. Background Color
                if (h.style === 'background') {
                    switch (h.color) {
                        case 'yellow': styleClass = 'bg-amber-200/50'; break;
                        case 'blue': styleClass = 'bg-blue-200'; break;
                        case 'red': styleClass = 'bg-red-200'; break;
                        case 'purple': styleClass = 'bg-purple-200'; break;
                    }
                }

                // 2. Note Underline (if explicit underline style OR has linked note)
                if (h.style === 'underline' || h.noteId) {
                    styleClass += ' border-b-2 border-amber-400';
                }

                htmlParts.push(`<span class="rounded-sm px-0.5 ${styleClass} cursor-pointer text-current transition-colors hover:brightness-95" data-highlight-id="${h.id}">${para.slice(start, end)}</span>`);
                lastIndex = end;
            });

            htmlParts.push(para.slice(lastIndex));
            return (
                <p key={globalIndex} data-index={globalIndex} className="mb-8 leading-loose text-justify pointer-events-auto select-text relative" style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: htmlParts.join('') }} />
            );
        });
    }, [book.content, currentPage, highlights, fontSize, readerMode]);

    const activeHighlight = useMemo(() => highlights.find(h => h.id === activeHighlightId) || null, [highlights, activeHighlightId]);
    useEffect(() => {
        if (!highlightMenuRect) return;
        const el = highlightMenuRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const MARGIN = 32;
        let left = highlightMenuRect.left;
        let top = highlightMenuRect.top;
        if (left + r.width > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - r.width;
        if (left < MARGIN) left = MARGIN;
        const HEADER_HEIGHT = 80;
        if (top < HEADER_HEIGHT) top = HEADER_HEIGHT;
        if (top + r.height > window.innerHeight - MARGIN) top = Math.max(HEADER_HEIGHT, window.innerHeight - MARGIN - r.height);
        if (left !== highlightMenuRect.left || top !== highlightMenuRect.top) {
            setHighlightMenuRect({ top, left });
        }
    }, [highlightMenuRect]);

    return (
        <div className={`fixed inset-0 z-50 flex flex-col h-full w-full transition-colors duration-500 font-rounded ${themes.bg} ${themes.text}`}>
            
            {/* Top Bar - More Compact */}
            <div className={`fixed top-4 left-4 right-4 h-14 px-5 flex items-center justify-between z-40 transition-all duration-300 glass-tabbar ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'}`}>
                <button onClick={onClose} className="p-2.5 interactive-area rounded-full hover:bg-black/5 text-current transition-colors -ml-2">
                    <ChevronLeft size={24} />
                </button>
                <span className="text-sm font-bold truncate max-w-[180px]">{book.title}</span>
                <div className="flex gap-1 interactive-area -mr-2">
                    <button 
                        onClick={() => setIsPencilMode(!isPencilMode)}
                        className={`p-2.5 rounded-full transition-all ${isPencilMode ? 'bg-[var(--text-main)] text-[var(--text-inverse)] shadow-xl' : 'hover:bg-black/5 text-current'}`}
                    >
                        <Pencil size={20} />
                    </button>
                    <button className="p-2.5 rounded-full hover:bg-black/5 text-current">
                        <List size={20} />
                    </button>
                </div>
            </div>

            {/* Reading Area / Tablet Split */}
            <div className="flex-1 overflow-hidden relative" onClick={handleContentClick} onMouseUp={handleSelection} onTouchEnd={handleSelection}>
                {isTablet && isLandscape && isPencilMode ? (
                    <div className="h-full w-full flex flex-row">
                        <div className="flex-[0.6] min-w-[520px] relative">
                            <div ref={scrollContainerRef} className="h-full w-full flex flex-col overflow-y-auto no-scrollbar relative scroll-smooth">
                                <div ref={contentRef} className="p-6 pt-24 pb-32 max-w-2xl mx-auto min-h-full relative">
                                     {renderedContent}
                                </div>
                                <canvas 
                                    ref={canvasRef}
                                    width={window.innerWidth}
                                    height={canvasHeight}
                                    className={`absolute inset-0 z-10 ${isPencilMode && !(isTablet && isLandscape) ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={endDrawing}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={endDrawing}
                                />
                            </div>
                        </div>
                        <div className="flex-[0.4] min-w-[360px] border-l border-white/20 glass-card-sm relative flex flex-col">
                            <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 28px)' }} />
                            
                            {/* Header Module - Buttons */}
                            <div className="relative z-30 p-4 pt-24 flex justify-end shrink-0 interactive-area">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsPencilMode(false); }} 
                                        onTouchStart={(e) => { e.stopPropagation(); setIsPencilMode(false); }} 
                                        className="w-9 h-9 glass-btn rounded-full flex items-center justify-center text-current"
                                        title="退出"
                                        aria-label="退出"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setNotebookMode(m => m === 'type' ? 'draw' : 'type'); }} 
                                        onTouchStart={(e) => { e.stopPropagation(); setNotebookMode(m => m === 'type' ? 'draw' : 'type'); }} 
                                        className={`w-9 h-9 glass-btn rounded-full flex items-center justify-center text-current ${notebookMode === 'draw' ? 'ring-2 ring-black/10' : ''}`}
                                        title={notebookMode === 'draw' ? '手写输入' : '打字输入'}
                                        aria-label={notebookMode === 'draw' ? '手写输入' : '打字输入'}
                                    >
                                        {notebookMode === 'draw' ? <Pencil size={18} /> : <ScrollText size={18} />}
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsErasing(true); setEraserMode(m => m === 'region' ? 'stroke' : 'region'); }} 
                                        onTouchStart={(e) => { e.stopPropagation(); setIsErasing(true); setEraserMode(m => m === 'region' ? 'stroke' : 'region'); }} 
                                        className="w-9 h-9 glass-btn rounded-full flex items-center justify-center text-current"
                                        title={eraserMode === 'region' ? '触碰区域擦除' : '整笔擦除'}
                                        aria-label={eraserMode === 'region' ? '触碰区域擦除' : '整笔擦除'}
                                    >
                                        <Eraser size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Content Module - Textarea & Canvas */}
                            <div ref={rightNotebookContainerRef} className="relative flex-1 w-full overflow-hidden">
                                <div className="absolute inset-0 p-6 interactive-area z-10">
                                    <textarea
                                        value={notebookDraft}
                                        onChange={(e) => { const t = e.target.value; setNotebookDraft(t); storageAdapter.saveNotebookDraft(book.id, t); }}
                                        readOnly={notebookMode === 'draw'}
                                        className={`w-full h-full bg-transparent outline-none text-sm leading-7 ${notebookMode === 'draw' ? 'pointer-events-none opacity-90' : ''}`}
                                        placeholder="在此记录你的想法…"
                                    />
                                </div>
                                <canvas
                                    ref={rightCanvasRef}
                                    width={notebookSize.width}
                                    height={notebookSize.height}
                                    className={`absolute inset-0 z-20 ${isPencilMode && isTablet && isLandscape && notebookMode === 'draw' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                                    onTouchStart={(e) => { 
                                        e.stopPropagation(); 
                                        if (!isPencilMode || !(isTablet && isLandscape)) return; 
                                        const { x, y } = getCoordinatesRight(e); 
                                        if (isErasing) { eraseRightAt(x, y); return; } 
                                        setIsDrawing(true); 
                                        setRightDrawings(prev => [...prev, { points: [{x, y}], color: 'rgba(239, 68, 68, 0.6)' }]); 
                                    }}
                                    onTouchMove={(e) => { 
                                        e.stopPropagation(); 
                                        if (!isPencilMode || !(isTablet && isLandscape)) return; 
                                        const { x, y } = getCoordinatesRight(e); 
                                        if (isErasing) { eraseRightAt(x, y); return; } 
                                        if (!isDrawing) return; 
                                        const ctx = rightCanvasRef.current?.getContext('2d'); 
                                        setRightDrawings(prev => { 
                                            const last = prev[prev.length - 1]; 
                                            const pts = [...last.points, {x, y}]; 
                                            const stroke = { ...last, points: pts }; 
                                            return [...prev.slice(0, -1), stroke]; 
                                        }); 
                                        if (ctx) { 
                                            ctx.lineWidth = 3; 
                                            ctx.lineCap = 'round'; 
                                            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; 
                                            ctx.lineTo(x, y); 
                                            ctx.stroke(); 
                                            ctx.beginPath(); 
                                            ctx.moveTo(x, y); 
                                        } 
                                    }}
                                    onTouchEnd={(e) => { e.stopPropagation(); setIsDrawing(false); const ctx = rightCanvasRef.current?.getContext('2d'); ctx?.beginPath(); }}
                                    onMouseDown={(e) => { 
                                        e.stopPropagation(); 
                                        if (!isPencilMode || !(isTablet && isLandscape)) return; 
                                        const { x, y } = getCoordinatesRight(e); 
                                        if (isErasing) { eraseRightAt(x, y); return; } 
                                        setIsDrawing(true); 
                                        setRightDrawings(prev => [...prev, { points: [{x, y}], color: 'rgba(239, 68, 68, 0.6)' }]); 
                                    }}
                                    onMouseMove={(e) => { 
                                        e.stopPropagation(); 
                                        if (!isPencilMode || !(isTablet && isLandscape)) return; 
                                        const { x, y } = getCoordinatesRight(e); 
                                        if (isErasing) { eraseRightAt(x, y); return; } 
                                        if (!isDrawing) return; 
                                        const ctx = rightCanvasRef.current?.getContext('2d'); 
                                        setRightDrawings(prev => { 
                                            const last = prev[prev.length - 1]; 
                                            const pts = [...last.points, {x, y}]; 
                                            const stroke = { ...last, points: pts }; 
                                            return [...prev.slice(0, -1), stroke]; 
                                        }); 
                                        if (ctx) { 
                                            ctx.lineWidth = 3; 
                                            ctx.lineCap = 'round'; 
                                            ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; 
                                            ctx.lineTo(x, y); 
                                            ctx.stroke(); 
                                            ctx.beginPath(); 
                                            ctx.moveTo(x, y); 
                                        } 
                                    }}
                                    onMouseUp={(e) => { e.stopPropagation(); setIsDrawing(false); const ctx = rightCanvasRef.current?.getContext('2d'); ctx?.beginPath(); }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div ref={scrollContainerRef} className="h-full w-full flex flex-col overflow-y-auto no-scrollbar relative scroll-smooth">
                        <div ref={contentRef} className="p-6 pt-24 pb-32 max-w-2xl mx-auto min-h-full relative">
                             {renderedContent}
                             
                            {annotations.map(anno => {
                                const startX = anno.pointX ?? 20;
                                const endX = contentWidth - 215;
                                return (
                                    <div key={anno.id} className={`absolute w-full transition-all duration-300 ${anno.highlightId === activeHighlightId ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-2'}`} style={{ top: anno.top }}>
                                        <svg className="absolute left-0 top-0 overflow-visible w-full h-32 pointer-events-none opacity-80" style={{ transform: 'translateY(10px)' }}>
                                            <path d={`M ${startX} 10 C ${startX} 10, ${endX - 30} 10, ${endX} 40`} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4,4" className="drop-shadow-sm"/>
                                            <circle cx={startX} cy="10" r="4" fill="#F59E0B" />
                                        </svg>
                                        <StickyNote 
                                            text={anno.text} 
                                            onChange={(val) => updateAnnotation(anno.id, val)}
                                            onDelete={() => deleteAnnotation(anno.id)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <canvas
                            ref={canvasRef}
                            width={window.innerWidth}
                            height={canvasHeight}
                            className={`absolute inset-0 z-10 ${isPencilMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={endDrawing}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={endDrawing}
                        />
                    </div>
                )}
            </div>

            {/* Selection Popup - Liquid Glass Style - Added select-none */}
            {selectionRect && (
                <div 
                    className="fixed z-50 flex flex-col items-center glass-modal p-2 animate-fade-in-up min-w-[260px] select-none"
                    style={{ top: selectionRect.top, left: selectionRect.left }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center w-full justify-between px-2 mb-2">
                         <MenuButton icon={<Copy size={18} />} label="Copy" onClick={() => handleAction('copy')} />
                         <MenuButton icon={<PenLine size={18} />} label="Note" onClick={handleCreateNote} />
                         <MenuButton icon={<Search size={18} />} label="Search" onClick={() => handleAction('search')} />
                    </div>
                    
                    {/* Divider with liquid feel */}
                    <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-black/10 to-transparent my-1"></div>
                    
                    <div className="flex items-center gap-3 px-2 pt-2 justify-center">
                        <ColorDot color="bg-amber-400" onClick={() => handleHighlight('yellow')} /> {/* Updated color class */}
                        <ColorDot color="bg-blue-400" onClick={() => handleHighlight('blue')} />
                        <ColorDot color="bg-red-400" onClick={() => handleHighlight('red')} />
                        <ColorDot color="bg-purple-400" onClick={() => handleHighlight('purple')} />
                    </div>
                </div>
            )}

            {/* Highlight Edit Popup */}
            {highlightMenuRect && (
                <div 
                    className="fixed z-50 flex flex-col items-center glass-modal p-3 animate-fade-in-up select-none"
                    style={{ top: highlightMenuRect.top, left: highlightMenuRect.left }}
                    ref={highlightMenuRef}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-3 justify-center">
                        <ColorDot color="bg-amber-400" onClick={() => handleUpdateHighlightColor('yellow')} />
                        <ColorDot color="bg-blue-400" onClick={() => handleUpdateHighlightColor('blue')} />
                        <ColorDot color="bg-red-400" onClick={() => handleUpdateHighlightColor('red')} />
                        <ColorDot color="bg-purple-400" onClick={() => handleUpdateHighlightColor('purple')} />
                        <div className="w-[1px] h-6 bg-black/10 mx-1"></div>
                        <button onClick={removeColor} className="text-current p-2 hover:bg-black/5 rounded-full transition-colors" title="取消涂色">
                            <Eraser size={18} />
                        </button>
                        {activeHighlight?.noteId && (
                            <button onClick={removeNoteFromHighlight} className="text-amber-500 hover:text-amber-600 p-2 hover:bg-black/5 rounded-full transition-colors" title="删除便签">
                                <X size={18} />
                            </button>
                        )}
                        <div className="w-[1px] h-6 bg-black/10 mx-1"></div>
                        <button onClick={handleDeleteHighlight} className="text-red-400 hover:text-red-600 p-2 hover:bg-black/5 rounded-full transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Controls - Liquid Glass Capsule */}
            <div 
                className={`fixed bottom-6 left-5 right-5 z-40 transition-all duration-300 glass-tabbar ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'}`}
                style={{ borderRadius: showSettings ? '20px' : undefined }}
            >
                {showSettings ? (
                    <div className="p-5 space-y-4 interactive-area w-full">
                        <div className="flex items-center justify-between p-2 bg-black/5 rounded-2xl border border-white/20">
                            <div className="flex items-center gap-2 text-[var(--text-sec)] pl-2">
                                {readerMode === 'paged' ? <BookOpen size={18} /> : <ScrollText size={18} />}
                                <span className="text-xs font-bold">Mode</span>
                            </div>
                            <div className="flex bg-black/5 p-1 rounded-xl">
                                <button onClick={() => setReaderMode('paged')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${readerMode === 'paged' ? 'bg-[var(--text-main)] text-[var(--text-inverse)] shadow-sm' : 'text-[var(--text-sec)] hover:text-current'}`}>Paged</button>
                                <button onClick={() => setReaderMode('scroll')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${readerMode === 'scroll' ? 'bg-[var(--text-main)] text-[var(--text-inverse)] shadow-sm' : 'text-[var(--text-sec)] hover:text-current'}`}>Scroll</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 px-2">
                            <span className="text-xs font-bold text-[var(--text-sec)]">A</span>
                            <div className="liquid-progress-container h-6 flex-1 bg-black/5">
                                <div className="liquid-progress-fill w-1/2 bg-[var(--text-main)]"></div>
                                <input type="range" min="14" max="32" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            </div>
                            <span className="text-lg font-bold text-[var(--text-main)]">A</span>
                        </div>
                        <div className="flex justify-between items-center px-2">
                            <ThemeBtn type={ThemeType.Light} current={theme} onClick={setTheme} color="bg-white border-gray-200" />
                            <ThemeBtn type={ThemeType.Gray} current={theme} onClick={setTheme} color="bg-[#e5e5ea] border-transparent" />
                            <ThemeBtn type={ThemeType.Dark} current={theme} onClick={setTheme} color="bg-[#1a1a1a] border-transparent" />
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-3 flex justify-between items-center interactive-area h-full w-full">
                         {readerMode === 'paged' ? (
                             <>
                                <div className="text-[10px] font-bold opacity-40 w-10">{(currentPage / totalPages * 100).toFixed(0)}%</div>
                                <div className="flex gap-6">
                                    <button onClick={() => { prevPage(); }} className="text-xs font-bold opacity-60 hover:opacity-100 hover:scale-110 transition-all">Prev</button>
                                    <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 group"><span className="text-xs font-black bg-black/5 px-3 py-1.5 rounded-full group-hover:bg-[var(--text-main)] group-hover:text-[var(--text-inverse)] transition-all border border-black/5">Aa</span></button>
                                    <button onClick={() => { nextPage(); }} className="text-xs font-bold opacity-60 hover:opacity-100 hover:scale-110 transition-all">Next</button>
                                </div>
                             </>
                         ) : (
                             <>
                                <div className="text-[10px] font-bold opacity-40 w-10">Scroll</div>
                                <div className="flex justify-center flex-1">
                                    <button onClick={() => setShowSettings(true)} className="flex flex-col items-center gap-1 group"><span className="text-xs font-black bg-black/5 px-3 py-1.5 rounded-full group-hover:bg-[var(--text-main)] group-hover:text-[var(--text-inverse)] transition-all border border-black/5">Aa</span></button>
                                </div>
                             </>
                         )}
                         <button 
                            className="opacity-40 w-10 flex justify-end hover:opacity-100 transition-colors" 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isTablet && isLandscape && isPencilMode) { 
                                    setRightDrawings([]); 
                                } else { 
                                    setDrawings([]); 
                                } 
                            }}
                         >
                            <Eraser size={20} />
                         </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub Components ---

const ColorDot: React.FC<{color: string, onClick: () => void}> = ({color, onClick}) => (
    <button onClick={onClick} className={`w-8 h-8 rounded-full ${color} shadow-lg border-2 border-white hover:scale-110 active:scale-95 transition-all`} />
);

const MenuButton: React.FC<{icon: React.ReactNode, label: string, onClick: () => void}> = ({ icon, label, onClick }) => (
    <button className="flex flex-col items-center gap-1.5 px-4 py-2 hover:bg-black/5 rounded-2xl transition-all group active:scale-95" onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="opacity-60 group-hover:opacity-100 transition-colors drop-shadow-sm">{icon}</div>
        <span className="text-[10px] opacity-40 font-bold tracking-wide group-hover:opacity-80">{label}</span>
    </button>
);

const ThemeBtn: React.FC<{ type: ThemeType, current: ThemeType, onClick: (t: ThemeType) => void, color: string }> = ({ type, current, onClick, color }) => (
    <button onClick={() => onClick(type)} className={`w-10 h-10 rounded-full shadow-sm border ${color} ${current === type ? 'ring-4 ring-black/10 scale-110' : 'border-gray-200 opacity-70 hover:opacity-100 hover:scale-105'} transition-all`} />
);

const StickyNote: React.FC<{text: string, onChange: (t: string) => void, onDelete: () => void}> = ({text, onChange, onDelete}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    return (
        <div className={`absolute right-0 top-4 w-52 p-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] rotate-1 interactive-area bg-gradient-to-b from-amber-50/95 to-amber-100/90 backdrop-blur-xl border border-amber-200/60 text-amber-950`} style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}>
            <div className="absolute top-2 right-2 z-10">
                <button 
                    onClick={onDelete} 
                    className="p-1.5 text-amber-900/20 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors"
                    title="Delete Note"
                >
                    <X size={14} strokeWidth={2.5} />
                </button>
            </div>
            <textarea
                ref={textareaRef}
                className="w-full bg-transparent resize-none outline-none text-sm leading-snug min-h-[6rem] overflow-hidden placeholder-amber-900/40 p-1 pr-6"
                placeholder="Write your thought..."
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={1}
            />
        </div>
    );
};
