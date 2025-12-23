
import React, { useState, useEffect, useRef } from 'react';
import { Book, Tab, UserNote, Folder } from './types';
import { Reader } from './components/Reader';
import { BookOpen, Compass, User, Library as LibraryIcon, Search, Plus, MoreHorizontal, Share, Settings, Sparkles, TrendingUp, Heart, Play, Moon, Sun, Smartphone } from 'lucide-react';
import { storageAdapter } from './storageAdapter';
import { importBookFromFile, listImportedBooks, ImportProgress, deleteImportedBook, patchImportedBook, listFolders, createFolder } from './bookImport';

type AppTheme = 'white' | 'gray' | 'dark';

export default function App() {
    const [activeTab, setActiveTab] = useState<Tab>('Shelf');
    const [readingBook, setReadingBook] = useState<Book | null>(null);
    const [notes, setNotes] = useState<UserNote[]>([]);
    const [theme, setTheme] = useState<AppTheme>('white');
    const [books, setBooks] = useState<Book[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [manageBook, setManageBook] = useState<Book | null>(null);
    const [showBookManage, setShowBookManage] = useState(false);
    const [showCoverManage, setShowCoverManage] = useState(false);
    const [showMoveManage, setShowMoveManage] = useState(false);
    const [showFolderCreate, setShowFolderCreate] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [folderDraftName, setFolderDraftName] = useState('');
    const [folderDraftParentId, setFolderDraftParentId] = useState<string | null>(null);
    const [coverDraftHex, setCoverDraftHex] = useState<string>('#3b82f6');
    const [coverDraftImage, setCoverDraftImage] = useState<string | null>(null);
    const [manageError, setManageError] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverFileInputRef = useRef<HTMLInputElement>(null);

    // Apply theme to body
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        const list = storageAdapter.listUserNotes();
        setNotes(list);
    }, []);
    useEffect(() => {
        const handler = () => {
            const list = storageAdapter.listUserNotes();
            setNotes(list);
        };
        window.addEventListener('deepread-imported', handler);
        return () => window.removeEventListener('deepread-imported', handler);
    }, []);

    const handleBookClick = (book: Book) => {
        setReadingBook(book);
    };

    const reloadLibrary = () => {
        let cancelled = false;
        Promise.all([listImportedBooks(), listFolders()]).then(([imported, fs]) => {
            if (cancelled) return;
            setBooks(imported);
            setFolders(fs);
        }).catch(() => {});
        return () => { cancelled = true; };
    };

    useEffect(() => {
        const cancel = reloadLibrary();
        const handler = () => reloadLibrary();
        window.addEventListener('deepread-imported', handler);
        return () => {
            cancel();
            window.removeEventListener('deepread-imported', handler);
        };
    }, []);

    const startImport = () => {
        setImportError(null);
        setImportProgress({ phase: 'select', percent: 0, message: '选择文件' });
        setShowImport(true);
        queueMicrotask(() => fileInputRef.current?.click());
    };

    const handleImportFile = async (file: File) => {
        setImportError(null);
        try {
            const book = await importBookFromFile(file, setImportProgress);
            setBooks(prev => {
                const map = new Map<string, Book>();
                [book, ...prev].forEach(b => map.set(b.id, b));
                return Array.from(map.values());
            });
            setShowImport(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : '导入失败'
            setImportError(msg);
        }
    };

    const handleSaveNote = (note: UserNote) => {
        setNotes(prev => {
            const idx = prev.findIndex(n => n.id === note.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = note;
                return next;
            }
            return [note, ...prev];
        });
    };

    if (readingBook) {
        return (
            <Reader 
                book={readingBook} 
                onClose={() => setReadingBook(null)} 
                onSaveNote={handleSaveNote}
            />
        );
    }

    return (
        <div className="h-full w-full flex flex-col font-rounded text-[var(--text-main)] transition-colors duration-500">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto pb-28 no-scrollbar px-5 pt-4">
                {activeTab === 'Shelf' && (
                    <Bookshelf
                        books={books}
                        folders={folders}
                        activeFolderId={activeFolderId}
                        onSetActiveFolder={setActiveFolderId}
                        onOpen={handleBookClick}
                        onImport={startImport}
                        onManage={(b) => {
                            setManageError(null);
                            setManageBook(b);
                            setShowBookManage(true);
                            setShowCoverManage(false);
                            setShowMoveManage(false);
                            setShowFolderCreate(false);
                            setShowDeleteConfirm(false);
                            setCoverDraftHex(b.coverHex ?? '#3b82f6');
                            setCoverDraftImage(b.coverImage ?? null);
                        }}
                    />
                )}
                {activeTab === 'Discover' && <DiscoverView />}
                {activeTab === 'Stories' && <StoriesView notes={notes} />}
                {activeTab === 'Profile' && <ProfileView notesCount={notes.length} theme={theme} onThemeChange={setTheme} />}
            </div>

            {/* Bottom Tab Bar */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 glass-tabbar flex items-center justify-between z-30 px-5 py-3 gap-6 w-[90%] max-w-[360px]">
                <TabItem active={activeTab === 'Discover'} icon={<Compass size={24} strokeWidth={activeTab === 'Discover' ? 2.8 : 2} />} onClick={() => setActiveTab('Discover')} />
                <TabItem active={activeTab === 'Shelf'} icon={<LibraryIcon size={24} strokeWidth={activeTab === 'Shelf' ? 2.8 : 2} />} onClick={() => setActiveTab('Shelf')} />
                <TabItem active={activeTab === 'Stories'} icon={<BookOpen size={24} strokeWidth={activeTab === 'Stories' ? 2.8 : 2} />} onClick={() => setActiveTab('Stories')} />
                <TabItem active={activeTab === 'Profile'} icon={<User size={24} strokeWidth={activeTab === 'Profile' ? 2.8 : 2} />} onClick={() => setActiveTab('Profile')} />
            </div>

            {showImport && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowImport(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-5 animate-fade-in-up">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-extrabold tracking-tight">Import Book</h2>
                            <button className="w-9 h-9 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowImport(false)}>
                                ✕
                            </button>
                        </div>
                        <p className="text-xs opacity-60 mb-4">支持 `EPUB` / `PDF` / `TXT`，导入后离线可用。</p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".epub,.pdf,.txt,application/epub+zip,application/pdf,text/plain"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                void handleImportFile(file);
                                e.target.value = '';
                            }}
                        />

                        <div className="flex items-center gap-3">
                            <button className="glass-btn primary px-5 py-2 text-xs font-bold" onClick={() => fileInputRef.current?.click()}>
                                Choose File
                            </button>
                            <button className="glass-btn px-5 py-2 text-xs font-bold" onClick={() => setShowImport(false)}>
                                Cancel
                            </button>
                        </div>

                        {importProgress && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2 text-xs opacity-70">
                                    <span>{importProgress.message ?? 'Importing'}</span>
                                    <span>{importProgress.percent}%</span>
                                </div>
                                <div className="liquid-progress-container h-3 w-full">
                                    <div className="liquid-progress-fill" style={{ width: `${importProgress.percent}%` }} />
                                </div>
                            </div>
                        )}

                        {importError && (
                            <div className="mt-4 text-xs text-red-500">
                                {importError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showBookManage && manageBook && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowBookManage(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-5 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-extrabold tracking-tight truncate max-w-[260px]">{manageBook.title}</h2>
                            <button className="w-9 h-9 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowBookManage(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold"
                                onClick={() => { setShowCoverManage(true); setShowMoveManage(false); setShowFolderCreate(false); setShowDeleteConfirm(false); }}
                            >
                                Cover
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold"
                                onClick={() => { setShowMoveManage(true); setShowCoverManage(false); setShowFolderCreate(false); setShowDeleteConfirm(false); }}
                            >
                                Move
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold text-red-600"
                                onClick={() => { setShowDeleteConfirm(true); setShowCoverManage(false); setShowMoveManage(false); setShowFolderCreate(false); }}
                            >
                                Delete
                            </button>
                        </div>

                        {manageError && (
                            <div className="mt-4 text-xs text-red-500">{manageError}</div>
                        )}

                        {showCoverManage && (
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold opacity-60">Cover Image</div>
                                    <button className="glass-btn px-3 py-1.5 text-xs font-bold" onClick={() => coverFileInputRef.current?.click()}>
                                        Upload
                                    </button>
                                </div>
                                <input
                                    ref={coverFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                            const res = typeof reader.result === 'string' ? reader.result : null;
                                            setCoverDraftImage(res);
                                        };
                                        reader.onerror = () => setManageError('封面图片读取失败');
                                        reader.readAsDataURL(file);
                                        e.target.value = '';
                                    }}
                                />
                                {coverDraftImage && (
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs opacity-60 truncate">已选择封面图片</div>
                                        <button className="glass-btn px-3 py-1.5 text-xs font-bold" onClick={() => setCoverDraftImage(null)}>
                                            Remove
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold opacity-60">Cover Color</div>
                                    <input
                                        type="color"
                                        value={coverDraftHex}
                                        onChange={(e) => setCoverDraftHex(e.target.value)}
                                        className="w-12 h-8 rounded-lg border border-white/30 bg-transparent"
                                    />
                                </div>
                                <button
                                    className="glass-btn primary w-full py-3 text-xs font-bold"
                                    onClick={async () => {
                                        setManageError(null);
                                        try {
                                            const updated = await patchImportedBook(manageBook.id, {
                                                coverHex: coverDraftHex,
                                                coverImage: coverDraftImage ?? undefined
                                            });
                                            if (!updated) throw new Error('保存失败');
                                            setManageBook(updated);
                                        } catch (e) {
                                            setManageError(e instanceof Error ? e.message : '封面保存失败');
                                        }
                                    }}
                                >
                                    Save Cover
                                </button>
                            </div>
                        )}

                        {showMoveManage && (
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold opacity-60">Folder</div>
                                    <button
                                        className="glass-btn px-3 py-1.5 text-xs font-bold"
                                        onClick={() => { setShowFolderCreate(true); setFolderDraftName(''); setFolderDraftParentId(null); }}
                                    >
                                        New Folder
                                    </button>
                                </div>
                                <select
                                    className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none"
                                    value={manageBook.folderId ?? ''}
                                    onChange={async (e) => {
                                        setManageError(null);
                                        const nextFolderId = e.target.value || null;
                                        try {
                                            const updated = await patchImportedBook(manageBook.id, { folderId: nextFolderId });
                                            if (!updated) throw new Error('移动失败');
                                            setManageBook(updated);
                                        } catch (err) {
                                            setManageError(err instanceof Error ? err.message : '移动失败');
                                        }
                                    }}
                                >
                                    <option value="">(No Folder)</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>

                                {showFolderCreate && (
                                    <div className="space-y-2">
                                        <input
                                            value={folderDraftName}
                                            onChange={(e) => setFolderDraftName(e.target.value)}
                                            placeholder="Folder name"
                                            className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none"
                                        />
                                        <select
                                            className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none"
                                            value={folderDraftParentId ?? ''}
                                            onChange={(e) => setFolderDraftParentId(e.target.value || null)}
                                        >
                                            <option value="">(Root)</option>
                                            {folders.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="glass-btn primary w-full py-3 text-xs font-bold"
                                            onClick={async () => {
                                                setManageError(null);
                                                try {
                                                    const folder = await createFolder(folderDraftName, folderDraftParentId);
                                                    setFolders(prev => [folder, ...prev]);
                                                    setShowFolderCreate(false);
                                                } catch (e) {
                                                    setManageError(e instanceof Error ? e.message : '创建文件夹失败');
                                                }
                                            }}
                                        >
                                            Create
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {showDeleteConfirm && (
                            <div className="mt-4 space-y-3">
                                <div className="text-xs opacity-70">
                                    删除将移除书籍、封面与阅读数据（进度/标注/章节）。此操作不可撤销。
                                </div>
                                <button
                                    className="glass-btn primary w-full py-3 text-xs font-bold bg-red-500/90"
                                    onClick={async () => {
                                        setManageError(null);
                                        try {
                                            await deleteImportedBook(manageBook.id);
                                            storageAdapter.deleteBookData(manageBook.id);
                                            setBooks(prev => prev.filter(b => b.id !== manageBook.id));
                                            setShowBookManage(false);
                                        } catch (e) {
                                            setManageError(e instanceof Error ? e.message : '删除失败');
                                        }
                                    }}
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Sub-Components for Views ---

const Bookshelf: React.FC<{
    books: Book[];
    folders: Folder[];
    activeFolderId: string | null;
    onSetActiveFolder: (id: string | null) => void;
    onOpen: (b: Book) => void;
    onImport: () => void;
    onManage: (b: Book) => void;
}> = ({ books, folders, activeFolderId, onSetActiveFolder, onOpen, onImport, onManage }) => {
    const collectDescendants = (folderId: string): Set<string> => {
        const set = new Set<string>([folderId]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const f of folders) {
                const pid = f.parentId ?? null;
                if (pid && set.has(pid) && !set.has(f.id)) {
                    set.add(f.id);
                    changed = true;
                }
            }
        }
        return set;
    };

    const visibleBooks = (() => {
        if (!activeFolderId) return books;
        const allowed = collectDescendants(activeFolderId);
        return books.filter(b => b.folderId && allowed.has(b.folderId));
    })();

    const continueBook = visibleBooks[0] ?? null;
    const continueProgress = continueBook ? (storageAdapter.loadProgress(continueBook.id) || continueBook.progress) : 0;

    const coverStyle = (book: Book): React.CSSProperties | undefined => {
        if (book.coverImage) {
            return {
                backgroundImage: `url(${book.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            };
        }
        if (book.coverHex) {
            return { background: book.coverHex, backgroundImage: 'none' };
        }
        return undefined;
    };
    return (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">Library</h1>
            <div className="flex gap-3">
                <button className="w-10 h-10 glass-btn rounded-full flex items-center justify-center">
                    <Search size={20} />
                </button>
                <button className="w-10 h-10 glass-btn primary rounded-full flex items-center justify-center" onClick={onImport} aria-label="Import book">
                    <Plus size={20} strokeWidth={3} />
                </button>
            </div>
        </header>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
                className={`glass-btn px-4 py-2 text-[10px] font-bold whitespace-nowrap ${activeFolderId === null ? 'bg-[var(--text-main)] text-[var(--text-inverse)]' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => onSetActiveFolder(null)}
            >
                All
            </button>
            {folders.filter(f => !f.parentId).map(f => (
                <button
                    key={f.id}
                    className={`glass-btn px-4 py-2 text-[10px] font-bold whitespace-nowrap ${activeFolderId === f.id ? 'bg-[var(--text-main)] text-[var(--text-inverse)]' : 'opacity-70 hover:opacity-100'}`}
                    onClick={() => onSetActiveFolder(f.id)}
                >
                    {f.name}
                </button>
            ))}
        </div>

        {/* Recently Read */}
        {continueBook && (
        <div>
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">Continue</h2>
            <div 
                className="glass-card p-0 flex flex-col cursor-pointer group relative overflow-hidden h-[250px]"
                onClick={() => onOpen(continueBook)}
            >
                {/* Sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent z-0 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full p-5">
                    <div className="flex gap-5 flex-1 items-start">
                        <div
                            className={`w-28 h-40 rounded-xl shadow-xl ${continueBook.coverColor} shrink-0 transform group-hover:scale-105 transition-transform duration-500 ease-out rotate-1 group-hover:rotate-0 border border-white/10`}
                            style={coverStyle(continueBook)}
                        />
                        <div className="pt-2">
                             <h3 className="font-bold text-xl leading-tight mb-1 line-clamp-2">{continueBook.title}</h3>
                             <p className="text-sm opacity-60 font-medium">{continueBook.author}</p>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <div className="flex justify-between items-end mb-2">
                             <span className="text-2xl font-bold">{continueProgress}%</span>
                             <div className="w-9 h-9 rounded-full bg-[var(--text-main)] flex items-center justify-center text-[var(--text-inverse)] shadow-lg group-hover:scale-110 transition-transform">
                                 <Play size={16} fill="currentColor" />
                             </div>
                        </div>
                        <div className="liquid-progress-container h-6 w-full">
                            <div className="liquid-progress-fill" style={{ width: `${continueProgress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        )}

        <div>
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">Shelf</h2>
            <div className="grid grid-cols-2 gap-3">
                {visibleBooks.map(book => (
                    <div key={book.id} className="glass-card-sm p-4 cursor-pointer group flex flex-col items-center text-center gap-3 relative" onClick={() => onOpen(book)}>
                        <button
                            className="absolute top-2 right-2 w-8 h-8 glass-btn rounded-full flex items-center justify-center opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); onManage(book); }}
                            aria-label="Manage book"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        <div className={`w-20 h-28 rounded-lg shadow-lg ${book.coverColor} group-hover:-translate-y-2 transition-transform duration-300 border border-white/10`} style={coverStyle(book)}></div>
                        <div>
                             <h4 className="font-bold text-sm leading-tight line-clamp-1">{book.title}</h4>
                             <p className="text-[10px] opacity-60 mt-0.5">{book.author}</p>
                        </div>
                    </div>
                ))}
                {/* Add New Tile */}
                <div className="glass-card-sm p-4 cursor-pointer group flex flex-col items-center justify-center text-center gap-2 min-h-[160px] border-dashed border-2 border-[var(--text-sec)]/20 bg-transparent hover:bg-[var(--glass-highlight)]" onClick={onImport}>
                    <div className="w-12 h-12 rounded-full bg-[var(--glass-highlight)] flex items-center justify-center opacity-60 group-hover:opacity-100 transition-colors shadow-sm">
                        <Plus size={24} />
                    </div>
                    <span className="text-xs font-bold opacity-40 group-hover:opacity-100">Add Book</span>
                </div>
            </div>
        </div>
    </div>
    );
};

const StoriesView: React.FC<{ notes: UserNote[] }> = ({ notes }) => (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">Thoughts</h1>
            <div className="flex gap-2">
            <button className="glass-btn px-5 py-2 text-xs font-bold" onClick={() => {
                const data = storageAdapter.exportAll();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'deepread-backup.json';
                a.click();
                URL.revokeObjectURL(url);
            }}>Export</button>
            <button className="glass-btn px-5 py-2 text-xs font-bold" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    storageAdapter.importAll(text);
                    const list = storageAdapter.listUserNotes();
                    const event = new Event('deepread-imported');
                    window.dispatchEvent(event);
                };
                input.click();
            }}>Import</button>
            </div>
        </header>

        {notes.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center py-16 opacity-60 min-h-[300px]">
                <div className="w-20 h-20 bg-gradient-to-br from-white/50 to-transparent rounded-2xl flex items-center justify-center mb-5 shadow-sm transform rotate-12 border border-white/20">
                    <BookOpen size={28} />
                </div>
                <p className="font-bold text-base">Your mind is clear.</p>
                <p className="text-xs opacity-60 mt-1">Highlights will appear here.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-3">
                {notes.map(note => (
                    <div key={note.id} className="glass-card-sm p-5 hover:scale-[1.01] transition-transform">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold text-[var(--text-inverse)] bg-[var(--text-main)] px-2 py-0.5 rounded-full shadow-md">{note.date}</span>
                            <button className="opacity-40 hover:opacity-100"><MoreHorizontal size={18} /></button>
                        </div>
                        <p className="font-semibold mb-4 text-lg leading-relaxed">"{note.thought}"</p>
                        <div className="bg-[var(--glass-highlight)] p-3 rounded-xl border border-white/20">
                            <p className="text-xs opacity-60 italic font-medium leading-relaxed">{note.quote}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const DiscoverView = () => (
    <div className="animate-fade-in-up space-y-6">
         <header className="mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">Discover</h1>
        </header>
        
        <div className="glass-card p-6 relative overflow-hidden group min-h-[340px] flex flex-col justify-end">
            {/* Subtle light leak instead of colored blob */}
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-white rounded-full blur-[60px] opacity-40 pointer-events-none"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <span className="bg-[var(--glass-highlight)] backdrop-blur-md text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/20">Featured</span>
                </div>
                <h2 className="text-3xl font-extrabold mb-2 leading-tight drop-shadow-sm">The Psychology<br/>of Money</h2>
                <p className="opacity-70 text-sm mb-6 max-w-[90%] font-medium">Timeless lessons on wealth, greed, and happiness.</p>
                <button className="glass-btn primary px-6 py-3 text-sm font-bold shadow-xl w-full flex justify-between items-center group-active:scale-95 transition-transform">
                    <span>Read Now</span>
                    <Play size={18} fill="currentColor" />
                </button>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="glass-card-sm p-4 flex flex-col justify-between h-32 bg-gradient-to-br from-white/20 to-transparent border border-white/20">
                <div className="w-8 h-8 rounded-full bg-[var(--glass-highlight)] flex items-center justify-center shadow-sm border border-white/20">
                    <TrendingUp size={16} className="text-blue-500" />
                </div>
                <div>
                    <div className="text-xl font-bold">24</div>
                    <div className="text-[10px] font-bold opacity-50 uppercase">Trending</div>
                </div>
            </div>
             <div className="glass-card-sm p-4 flex flex-col justify-between h-32 bg-gradient-to-br from-white/20 to-transparent border border-white/20">
                <div className="w-8 h-8 rounded-full bg-[var(--glass-highlight)] flex items-center justify-center shadow-sm border border-white/20">
                    <Sparkles size={16} className="text-yellow-500" />
                </div>
                <div>
                    <div className="text-xl font-bold">New</div>
                    <div className="text-[10px] font-bold opacity-50 uppercase">Arrivals</div>
                </div>
            </div>
        </div>
    </div>
);

const ProfileView: React.FC<{ notesCount: number, theme: AppTheme, onThemeChange: (t: AppTheme) => void }> = ({ notesCount, theme, onThemeChange }) => (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
             <h1 className="text-3xl font-extrabold tracking-tight">Profile</h1>
             <button className="w-10 h-10 glass-btn rounded-full flex items-center justify-center"><Settings size={20} /></button>
        </header>
        
        <div className="glass-card p-5 flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-2xl font-bold shadow-inner border border-white/20">
                JS
            </div>
            <div>
                <h2 className="text-xl font-bold">John Smith</h2>
                <p className="text-sm opacity-50 font-medium">Bibliophile</p>
                <div className="mt-2 inline-block bg-[var(--text-main)] border border-white/10 text-[var(--text-inverse)] px-2 py-0.5 rounded-full text-[10px] font-bold">
                    Level 12
                </div>
            </div>
        </div>

        {/* --- Theme Selector Card --- */}
        <div className="glass-card p-5">
            <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-4">Appearance</h3>
            <div className="flex gap-4">
                <ThemeOption 
                    active={theme === 'white'} 
                    label="White" 
                    icon={<Sun size={18} />} 
                    onClick={() => onThemeChange('white')}
                    bg="bg-white text-black"
                />
                <ThemeOption 
                    active={theme === 'gray'} 
                    label="Gray" 
                    icon={<Smartphone size={18} />} 
                    onClick={() => onThemeChange('gray')}
                    bg="bg-gray-200 text-gray-800"
                />
                <ThemeOption 
                    active={theme === 'dark'} 
                    label="Dark" 
                    icon={<Moon size={18} />} 
                    onClick={() => onThemeChange('dark')}
                    bg="bg-gray-900 text-white"
                />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
            <StatsCard value="142" label="Hours" />
            <StatsCard value="12" label="Books" />
            <StatsCard value={notesCount.toString()} label="Thoughts" />
        </div>

        <div className="space-y-2">
            <ProfileMenuItem icon={<LibraryIcon size={20} />} label="Reading Goals" />
            <ProfileMenuItem icon={<Share size={20} />} label="Share Profile" />
            <ProfileMenuItem icon={<Heart size={20} />} label="Favorites" />
        </div>
    </div>
);

const ThemeOption: React.FC<{ active: boolean, label: string, icon: React.ReactNode, onClick: () => void, bg: string }> = ({ active, label, icon, onClick, bg }) => (
    <button 
        onClick={onClick}
        className={`flex-1 p-3 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${active ? 'border-[var(--text-main)] scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
    >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${bg}`}>
            {icon}
        </div>
        <span className="text-xs font-bold">{label}</span>
    </button>
);

const StatsCard: React.FC<{value: string, label: string}> = ({value, label}) => (
    <div className="glass-card-sm p-3 text-center flex flex-col justify-center h-24">
        <div className="text-2xl font-black mb-0.5">{value}</div>
        <div className="text-[9px] uppercase tracking-wider opacity-50 font-bold">{label}</div>
    </div>
);

const ProfileMenuItem: React.FC<{ icon: React.ReactNode, label: string }> = ({ icon, label }) => (
    <div className="flex items-center justify-between p-4 glass-card-sm cursor-pointer hover:bg-[var(--glass-highlight)] active:scale-98 transition-all group">
        <div className="flex items-center gap-4 opacity-60 group-hover:opacity-100">
            {icon}
            <span className="font-bold text-sm">{label}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-[var(--glass-highlight)] flex items-center justify-center opacity-40 text-xs shadow-sm">›</div>
    </div>
);

const TabItem: React.FC<{ active: boolean, icon: React.ReactNode, onClick: () => void }> = ({ active, icon, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${active ? 'bg-[var(--text-main)] text-[var(--text-inverse)] shadow-xl transform -translate-y-2' : 'opacity-40 hover:opacity-100 hover:bg-[var(--glass-highlight)]'}`}
    >
        {icon}
    </button>
);
