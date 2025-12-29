
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App as CapApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toPng } from 'html-to-image';
import { Book, Tab, UserNote, Folder } from './types';
import { Reader } from './components/Reader';
import { BookOpen, Compass, User, Library as LibraryIcon, Search, Plus, MoreHorizontal, Share, Settings, Sparkles, TrendingUp, Heart, Play, Moon, Sun, Smartphone, FolderPlus, Edit3, ArrowLeft, ChevronRight, Inbox, Folder as FolderIcon, Copy } from 'lucide-react';
import { storageAdapter } from './storageAdapter';
import { importBookFromFile, listImportedBooks, ImportProgress, deleteImportedBook, patchImportedBook, listFolders, createFolder, deleteFolder, renameFolder, upsertImportedBook } from './bookImport';
import { listUserNotes as listUserNoteRows, upsertUserNote as upsertUserNoteRow, deleteUserNote as deleteUserNoteRow } from './backend/services/userNotesDao';
import { createDB } from './backend/lib/db';

type AppTheme = 'white' | 'gray' | 'dark';
const DEFAULT_USER_ID = 'local';
const profileDb = createDB();

import { MOCK_BOOKS } from './constants';

function mapNoteRowToNote(row: { id: string; book_id: string; quote: string; thought: string; date: string }): UserNote {
    return { id: row.id, bookId: row.book_id, quote: row.quote, thought: row.thought, date: row.date };
}

type UserProfileRow = { 
    id: string; 
    name: string; 
    initials: string; 
    bio: string; 
    favorite_book_ids: string[]; 
    yearly_goal?: number;
    monthly_goal?: number;
    language?: string;
    updated_at: string;
};

async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
    const res = await profileDb.query<UserProfileRow>(
        'SELECT id,name,initials,bio,favorite_book_ids,yearly_goal,monthly_goal,language,updated_at FROM user_profiles WHERE id=$1 LIMIT 1',
        [userId]
    );
    const row = res.rows?.[0] as any;
    if (!row) return null;
    return {
        id: String(row.id ?? userId),
        name: String(row.name ?? ''),
        initials: String(row.initials ?? ''),
        bio: String(row.bio ?? ''),
        favorite_book_ids: Array.isArray(row.favorite_book_ids) ? row.favorite_book_ids.map(String) : [],
        yearly_goal: typeof row.yearly_goal === 'number' ? row.yearly_goal : 12,
        monthly_goal: typeof row.monthly_goal === 'number' ? row.monthly_goal : 2,
        language: String(row.language ?? 'zh'),
        updated_at: String(row.updated_at ?? '')
    };
}

async function upsertUserProfile(userId: string, patch: Partial<UserProfileRow>): Promise<UserProfileRow> {
    const current = (await getUserProfile(userId)) ?? {
        id: userId,
        name: '',
        initials: '',
        bio: '',
        favorite_book_ids: [] as string[],
        yearly_goal: 12,
        monthly_goal: 2,
        language: 'zh',
        updated_at: ''
    };
    const next: UserProfileRow = {
        ...current,
        ...patch,
        id: userId,
        updated_at: new Date().toISOString()
    };
    await profileDb.query(
        'INSERT INTO user_profiles(id,name,initials,bio,favorite_book_ids,yearly_goal,monthly_goal,language,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [next.id, next.name, next.initials, next.bio, next.favorite_book_ids, next.yearly_goal, next.monthly_goal, next.language, next.updated_at]
    );
    return next;
}

export default function App() {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('Shelf');
    const [readingBook, setReadingBook] = useState<Book | null>(null);
    const [notes, setNotes] = useState<UserNote[]>([]);
    const [theme, setTheme] = useState<AppTheme>('white');
    const [books, setBooks] = useState<Book[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>('uncategorized');
    const [manageBook, setManageBook] = useState<Book | null>(null);
    const [showBookManage, setShowBookManage] = useState(false);
    const [showCoverManage, setShowCoverManage] = useState(false);
    const [showMoveManage, setShowMoveManage] = useState(false);
    const [showFolderCreate, setShowFolderCreate] = useState(false);
    const [showFolderDeleteConfirm, setShowFolderDeleteConfirm] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [showFolderRename, setShowFolderRename] = useState(false);
    const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [folderDraftName, setFolderDraftName] = useState('');
    const [renameDraftName, setRenameDraftName] = useState('');
    const [folderDraftParentId, setFolderDraftParentId] = useState<string | null>(null);

    // Handle Android Back Button
    useEffect(() => {
        const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
            if (readingBook) {
                setReadingBook(null);
            } else if (activeFolderId !== 'uncategorized' && activeFolderId !== null) {
                setActiveFolderId('uncategorized');
            } else {
                CapApp.exitApp();
            }
        });

        return () => {
            backHandler.then(h => h.remove());
        };
    }, [readingBook, activeFolderId]);
    const [coverDraftHex, setCoverDraftHex] = useState<string>('#3b82f6');
    const [coverDraftImage, setCoverDraftImage] = useState<string | null>(null);
    const [manageError, setManageError] = useState<string | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [manageNote, setManageNote] = useState<UserNote | null>(null);
    const [showNoteManage, setShowNoteManage] = useState(false);
    const [showNoteEdit, setShowNoteEdit] = useState(false);
    const [showNoteDeleteConfirm, setShowNoteDeleteConfirm] = useState(false);
    const [noteDraftThought, setNoteDraftThought] = useState('');
    const [noteDraftQuote, setNoteDraftQuote] = useState('');
    const [noteDraftDate, setNoteDraftDate] = useState('');
    const [noteError, setNoteError] = useState<string | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [userProfile, setUserProfile] = useState<{ 
        name: string; 
        initials: string; 
        bio: string; 
        favorite_book_ids: string[];
        yearly_goal: number;
        monthly_goal: number;
        language?: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverFileInputRef = useRef<HTMLInputElement>(null);

    // Apply theme to body
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        getUserProfile(DEFAULT_USER_ID).then(p => {
            if (p) {
                setUserProfile({ 
                    name: p.name, 
                    initials: p.initials, 
                    bio: p.bio, 
                    favorite_book_ids: p.favorite_book_ids || [],
                    yearly_goal: p.yearly_goal || 12,
                    monthly_goal: p.monthly_goal || 2,
                    language: p.language || 'zh'
                });
            } else {
                const initial = { 
                    name: t('common.loading'), 
                    initials: 'DR', 
                    bio: t('profile.default_bio'), 
                    favorite_book_ids: [], 
                    yearly_goal: 12, 
                    monthly_goal: 2, 
                    language: i18n.language || 'zh' 
                };
                setUserProfile(initial);
                void upsertUserProfile(DEFAULT_USER_ID, initial);
            }
        });
    }, []);

    const reloadNotes = () => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await listUserNoteRows(DEFAULT_USER_ID, 200);
                if (cancelled) return;
                if (rows.length === 0) {
                    const legacy = storageAdapter.listUserNotes();
                    if (legacy.length) {
                        legacy.forEach(n => storageAdapter.upsertUserNote(n));
                        const rows2 = await listUserNoteRows(DEFAULT_USER_ID, 200);
                        if (!cancelled) setNotes(rows2.map(mapNoteRowToNote));
                        return;
                    }
                }
                setNotes(rows.map(mapNoteRowToNote));
            } catch {
                if (!cancelled) setNotes(storageAdapter.listUserNotes());
            }
        })();
        return () => { cancelled = true; };
    };

    useEffect(() => reloadNotes(), []);
    useEffect(() => {
        const handler = () => { reloadNotes(); };
        window.addEventListener('deepread-imported', handler);
        return () => window.removeEventListener('deepread-imported', handler);
    }, []);

    const handleBookClick = (book: Book) => {
        if (!Array.isArray(book.content) || book.content.length === 0) {
            setManageError(null);
            setManageBook(book);
            setShowBookManage(true);
            setShowCoverManage(false);
            setShowMoveManage(false);
            setShowFolderCreate(false);
            setShowDeleteConfirm(false);
            setCoverDraftHex(book.coverHex ?? '#3b82f6');
            setCoverDraftImage(book.coverImage ?? null);
            return;
        }
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

    const startImport = (folderId?: string | null) => {
        setImportError(null);
        setImportProgress({ phase: 'select', percent: 0, message: t('import.select_phase') });
        setShowImport(true);
        queueMicrotask(() => {
            // If we are in "uncategorized" (Inbox), ensure folderId is null
            const targetFolderId = folderId === 'uncategorized' ? null : folderId;
            (fileInputRef.current as any).__deepreadFolderId = targetFolderId ?? null;
            fileInputRef.current?.click();
        });
    };

    const handleImportFile = async (file: File) => {
        setImportError(null);
        try {
            const folderId = (fileInputRef.current as any)?.__deepreadFolderId ?? null;
            const book = await importBookFromFile(file, (p) => {
                setImportProgress({ ...p, message: p.message === 'Importing' ? t('import.importing') : p.message });
            }, folderId);
            setBooks(prev => {
                const map = new Map<string, Book>();
                [book, ...prev].forEach(b => map.set(b.id, b));
                return Array.from(map.values());
            });
            setShowImport(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : t('import.failed')
            setImportError(msg);
        }
    };

    const handleImportSample = async (sample: Book) => {
        const book: Book = {
            ...sample,
            id: `sample_${Date.now()}_${sample.id}`,
            folderId: activeFolderId,
            progress: 0
        };
        await upsertImportedBook(book);
        setBooks(prev => [book, ...prev]);
    };

    const handleSaveNote = (note: UserNote) => {
        try {
            void upsertUserNoteRow(DEFAULT_USER_ID, {
                id: note.id,
                user_id: DEFAULT_USER_ID,
                book_id: note.bookId,
                quote: note.quote,
                thought: note.thought,
                date: note.date,
                updated_at: new Date().toISOString(),
                version: 1
            } as any);
        } catch {}
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

    const openNoteManage = (note: UserNote) => {
        setNoteError(null);
        setManageNote(note);
        setShowNoteManage(true);
        setShowNoteEdit(false);
        setShowNoteDeleteConfirm(false);
        setNoteDraftThought(note.thought);
        setNoteDraftQuote(note.quote);
        setNoteDraftDate(note.date);
    };

    const persistNote = async (note: UserNote) => {
        await upsertUserNoteRow(DEFAULT_USER_ID, {
            id: note.id,
            user_id: DEFAULT_USER_ID,
            book_id: note.bookId,
            quote: note.quote,
            thought: note.thought,
            date: note.date,
            updated_at: new Date().toISOString(),
            version: 1
        } as any);
        storageAdapter.upsertUserNote(note);
        setNotes(prev => {
            const idx = prev.findIndex(n => n.id === note.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = note;
                return next;
            }
            return [note, ...prev];
        });
        window.dispatchEvent(new Event('deepread-imported'));
    };

    const removeNote = async (noteId: string) => {
        await deleteUserNoteRow(DEFAULT_USER_ID, noteId);
        storageAdapter.deleteUserNote(noteId);
        setNotes(prev => prev.filter(n => n.id !== noteId));
        window.dispatchEvent(new Event('deepread-imported'));
    };

    const exportNotesTxt = () => {
        const bookTitleById = new Map<string, string>();
        books.forEach(b => bookTitleById.set(b.id, b.title));
        const blocks = notes
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .map(n => {
                const title = bookTitleById.get(n.bookId) ?? n.bookId;
                const head = `[${n.date}] ${title}`;
                const thought = (n.thought ?? '').trim();
                const quote = (n.quote ?? '').trim();
                const parts = [head];
                if (thought) parts.push(thought);
                if (quote) parts.push(`"${quote}"`);
                return parts.join('\n');
            });
        const txt = blocks.join('\n\n---\n\n') + (blocks.length ? '\n' : '');
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deepread-thoughts.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const openSearch = () => {
        setSearchQ('');
        setShowSearch(true);
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

    const handleDeleteFolder = async (folderId: string) => {
        try {
            await deleteFolder(folderId);
            setFolders(prev => prev.filter(f => f.id !== folderId));
            if (activeFolderId === folderId) setActiveFolderId('uncategorized');
        } catch (e) {
            console.error('Delete folder failed:', e);
        }
    };

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
                        onImport={() => startImport(activeFolderId)}
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
                        onCreateFolder={() => setShowFolderCreate(true)}
                        onDeleteFolder={handleDeleteFolder}
                        onRenameFolder={async (id, name) => {
                            await renameFolder(id, name);
                            setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
                        }}
                        onStartDeleteFolder={(f) => {
                            setFolderToDelete(f);
                            setShowFolderDeleteConfirm(true);
                        }}
                        onStartRenameFolder={(f) => {
                            setFolderToRename(f);
                            setRenameDraftName(f.name);
                            setShowFolderRename(true);
                        }}
                        onSearch={openSearch}
                        showFolderCreate={showFolderCreate && !showBookManage}
                        folderDraftName={folderDraftName}
                        setFolderDraftName={setFolderDraftName}
                        onConfirmCreateFolder={async () => {
                            if (!folderDraftName.trim()) return;
                            try {
                                const folder = await createFolder(folderDraftName, null);
                                setFolders(prev => [folder, ...prev]);
                                setShowFolderCreate(false);
                                setFolderDraftName('');
                            } catch (e) {
                                console.error('Create folder failed:', e);
                            }
                        }}
                        onCancelCreateFolder={() => setShowFolderCreate(false)}
                    />
                )}
                {activeTab === 'Discover' && <DiscoverView books={books} notes={notes} onOpen={handleBookClick} onImport={() => startImport(activeFolderId)} onSearch={openSearch} onSwitchTab={setActiveTab} />}
                {activeTab === 'Stories' && <StoriesView notes={notes} books={books} onManageNote={openNoteManage} onExport={exportNotesTxt} />}
                {activeTab === 'Profile' && (
                    <ProfileView 
                        books={books} 
                        notes={notes} 
                        profile={userProfile} 
                        theme={theme} 
                        onThemeChange={setTheme} 
                        onUpdateProfile={async (p) => {
                            const updated = await upsertUserProfile(DEFAULT_USER_ID, p);
                            setUserProfile({ 
                                name: updated.name, 
                                initials: updated.initials, 
                                bio: updated.bio,
                                favorite_book_ids: updated.favorite_book_ids || [],
                                yearly_goal: updated.yearly_goal || 12,
                                monthly_goal: updated.monthly_goal || 2,
                                language: updated.language || 'zh'
                            });
                        }}
                        onOpenBook={handleBookClick}
                    />
                )}
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
                            <h2 className="text-base font-extrabold tracking-tight">{t('import.title')}</h2>
                            <button className="w-9 h-9 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowImport(false)}>
                                ✕
                            </button>
                        </div>
                        <p className="text-xs opacity-60 mb-4">{t('import.description')}</p>

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
                                {t('import.choose_file')}
                            </button>
                            <button className="glass-btn px-5 py-2 text-xs font-bold" onClick={() => setShowImport(false)}>
                                {t('common.cancel')}
                            </button>
                        </div>

                        {importProgress && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2 text-xs opacity-70">
                                    <span>{importProgress.message ?? t('import.importing')}</span>
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

            {/* Folder Delete Confirmation Modal */}
            {showFolderDeleteConfirm && folderToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFolderDeleteConfirm(false)} />
                    <div className="relative glass-modal w-full max-w-[320px] p-6 animate-fade-in text-center">
                        <h2 className="text-lg font-black mb-2">{t('shelf.delete_folder')}</h2>
                        <p className="text-sm opacity-60 mb-6">
                            {t('shelf.delete_folder_confirm', { name: folderToDelete.name })}
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowFolderDeleteConfirm(false)}
                                className="flex-1 py-3 glass-btn text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                onClick={async () => {
                                    await handleDeleteFolder(folderToDelete.id);
                                    setShowFolderDeleteConfirm(false);
                                    setFolderToDelete(null);
                                }}
                                className="flex-1 py-3 glass-btn text-xs font-black uppercase tracking-widest text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20"
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Folder Rename Modal */}
            {showFolderRename && folderToRename && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFolderRename(false)} />
                    <div className="relative glass-modal w-full max-w-[320px] p-6 animate-fade-in">
                        <h2 className="text-lg font-black mb-4 text-center">{t('shelf.rename_folder')}</h2>
                        <input 
                            type="text"
                            value={renameDraftName}
                            onChange={(e) => setRenameDraftName(e.target.value)}
                            placeholder={t('shelf.folder_name')}
                            className="w-full bg-black/5 border-none rounded-xl px-4 py-3 text-sm font-bold mb-6 focus:ring-2 focus:ring-blue-500/20 outline-none text-[var(--text-main)]"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && renameDraftName.trim()) {
                                    (async () => {
                                        await renameFolder(folderToRename.id, renameDraftName.trim());
                                        setFolders(prev => prev.map(f => f.id === folderToRename.id ? { ...f, name: renameDraftName.trim() } : f));
                                        setShowFolderRename(false);
                                        setFolderToRename(null);
                                    })();
                                }
                            }}
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowFolderRename(false)}
                                className="flex-1 py-3 glass-btn text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!renameDraftName.trim()) return;
                                    await renameFolder(folderToRename.id, renameDraftName.trim());
                                    setFolders(prev => prev.map(f => f.id === folderToRename.id ? { ...f, name: renameDraftName.trim() } : f));
                                    setShowFolderRename(false);
                                    setFolderToRename(null);
                                }}
                                className="flex-1 py-3 glass-btn text-xs font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20"
                            >
                                {t('common.save')}
                            </button>
                        </div>
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
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <button
                                className={`glass-btn px-4 py-3 text-xs font-bold flex items-center justify-center gap-2 ${userProfile?.favorite_book_ids?.includes(manageBook.id) ? 'text-red-500' : ''}`}
                                onClick={async () => {
                                    if (!userProfile) return;
                                    const current = userProfile.favorite_book_ids || [];
                                    const next = current.includes(manageBook.id) 
                                        ? current.filter(id => id !== manageBook.id)
                                        : [...current, manageBook.id];
                                    const updated = await upsertUserProfile(DEFAULT_USER_ID, { ...userProfile, favorite_book_ids: next });
                                    setUserProfile({ 
                                        name: updated.name, 
                                        initials: updated.initials, 
                                        bio: updated.bio,
                                        favorite_book_ids: updated.favorite_book_ids || []
                                    });
                                }}
                            >
                                <Heart size={14} fill={userProfile?.favorite_book_ids?.includes(manageBook.id) ? 'currentColor' : 'none'} />
                                {userProfile?.favorite_book_ids?.includes(manageBook.id) ? t('shelf.unfavorite') : t('shelf.favorite')}
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold flex items-center justify-center gap-2"
                                onClick={() => {
                                    const text = t('shelf.share_text', { title: manageBook.title, author: manageBook.author });
                                    navigator.clipboard.writeText(text);
                                    setManageError(t('shelf.link_copied'));
                                    setTimeout(() => setManageError(null), 2000);
                                }}
                            >
                                <Share size={14} />
                                {t('common.share')}
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold"
                                onClick={() => { setShowCoverManage(true); setShowMoveManage(false); setShowFolderCreate(false); setShowDeleteConfirm(false); }}
                            >
                                {t('shelf.cover')}
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold"
                                onClick={() => { setShowMoveManage(true); setShowCoverManage(false); setShowFolderCreate(false); setShowDeleteConfirm(false); }}
                            >
                                {t('shelf.move')}
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold text-red-600"
                                onClick={() => { setShowDeleteConfirm(true); setShowCoverManage(false); setShowMoveManage(false); setShowFolderCreate(false); }}
                            >
                                {t('common.delete')}
                            </button>
                        </div>

                        {manageError && (
                            <div className="mt-4 text-xs text-red-500">{manageError}</div>
                        )}

                        {showCoverManage && (
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold opacity-60">{t('shelf.cover')}</div>
                                    <button className="glass-btn px-3 py-1.5 text-xs font-bold" onClick={() => coverFileInputRef.current?.click()}>
                                        {t('shelf.upload_cover')}
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
                                            const img = new Image();
                                            img.onload = () => {
                                                const canvas = document.createElement('canvas');
                                                let width = img.width;
                                                let height = img.height;
                                                
                                                // Max dimension for storage optimization, but allowing any size
                                                const MAX_DIM = 1200; 
                                                if (width > MAX_DIM || height > MAX_DIM) {
                                                    if (width > height) {
                                                        height = (height / width) * MAX_DIM;
                                                        width = MAX_DIM;
                                                    } else {
                                                        width = (width / height) * MAX_DIM;
                                                        height = MAX_DIM;
                                                    }
                                                }
                                                
                                                canvas.width = width;
                                                canvas.height = height;
                                                const ctx = canvas.getContext('2d');
                                                ctx?.drawImage(img, 0, 0, width, height);
                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                                setCoverDraftImage(dataUrl);
                                            };
                                            img.src = typeof reader.result === 'string' ? reader.result : '';
                                        };
                                        reader.onerror = () => setManageError(t('common.error'));
                                        reader.readAsDataURL(file);
                                        e.target.value = '';
                                    }}
                                />
                                {coverDraftImage && (
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs opacity-60 truncate">{t('shelf.cover')}</div>
                                        <button className="glass-btn px-3 py-1.5 text-xs font-bold" onClick={() => setCoverDraftImage(null)}>
                                            {t('shelf.remove_cover')}
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold opacity-60">{t('shelf.cover_color')}</div>
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
                                            if (!updated) throw new Error(t('common.error'));
                                            setManageBook(updated);
                                        } catch (e) {
                                            setManageError(e instanceof Error ? e.message : t('common.error'));
                                        }
                                    }}
                                >
                                    {t('shelf.save_cover')}
                                </button>
                            </div>
                        )}

                        {showMoveManage && (
                            <div className="mt-4 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">{t('shelf.move')}</div>
                                    <button
                                        className="glass-btn px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500"
                                        onClick={() => { setShowFolderCreate(true); setFolderDraftName(''); setFolderDraftParentId(null); }}
                                    >
                                        + {t('shelf.create_folder')}
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto no-scrollbar p-1">
                                    <button 
                                        className={`glass-card-sm p-4 text-left transition-all hover:scale-[1.02] flex items-center justify-between ${!manageBook.folderId ? 'bg-blue-500/10 border-blue-500/30' : 'opacity-70 hover:opacity-100 border-white/5'}`}
                                        onClick={async () => {
                                            try {
                                                const updated = await patchImportedBook(manageBook.id, { folderId: null });
                                                if (updated) setManageBook(updated);
                                            } catch (err) { setManageError(t('common.error')); }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!manageBook.folderId ? 'bg-blue-500 text-white' : 'bg-white/5'}`}>
                                                <Inbox size={14} />
                                            </div>
                                            <span className="text-xs font-bold">{t('shelf.uncategorized')}</span>
                                        </div>
                                        {!manageBook.folderId && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                    </button>
                                    
                                    {folders.map(f => (
                                        <button 
                                            key={f.id}
                                            className={`glass-card-sm p-4 text-left transition-all hover:scale-[1.02] flex items-center justify-between ${manageBook.folderId === f.id ? 'bg-blue-500/10 border-blue-500/30' : 'opacity-70 hover:opacity-100 border-white/5'}`}
                                            onClick={async () => {
                                                try {
                                                    const updated = await patchImportedBook(manageBook.id, { folderId: f.id });
                                                    if (updated) setManageBook(updated);
                                                } catch (err) { setManageError(t('common.error')); }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${manageBook.folderId === f.id ? 'bg-blue-500 text-white' : 'bg-white/5'}`}>
                                                    <FolderIcon size={14} />
                                                </div>
                                                <span className="text-xs font-bold">{f.name}</span>
                                            </div>
                                            {manageBook.folderId === f.id && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                        </button>
                                    ))}
                                </div>

                                {showFolderCreate && (
                                    <div className="space-y-3 p-4 glass-card-sm border-dashed border-2 border-blue-500/20 bg-blue-500/5 animate-fade-in-up">
                                        <div className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">{t('shelf.folder_name')}</div>
                                        <input
                                            value={folderDraftName}
                                            onChange={(e) => setFolderDraftName(e.target.value)}
                                            placeholder={t('shelf.folder_placeholder')}
                                            className="glass-card-sm w-full px-4 py-3 text-xs font-bold outline-none border-white/10 focus:border-blue-500/30 transition-colors"
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                className="glass-btn flex-1 py-3 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100"
                                                onClick={() => setShowFolderCreate(false)}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                            <button
                                                className="glass-btn primary flex-1 py-3 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                                                onClick={async () => {
                                                    if (!folderDraftName.trim()) return;
                                                    setManageError(null);
                                                    try {
                                                        const folder = await createFolder(folderDraftName, folderDraftParentId);
                                                        setFolders(prev => [folder, ...prev]);
                                                        setShowFolderCreate(false);
                                                    } catch (e) {
                                                        setManageError(e instanceof Error ? e.message : t('common.error'));
                                                    }
                                                }}
                                            >
                                                {t('common.confirm')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {showDeleteConfirm && (
                            <div className="mt-4 space-y-3">
                                <div className="text-xs opacity-70">
                                    {t('shelf.delete_book_confirm', { name: manageBook.title })}
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
                                            setManageError(e instanceof Error ? e.message : t('common.error'));
                                        }
                                    }}
                                >
                                    {t('common.confirm')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showNoteManage && manageNote && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowNoteManage(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-5 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-extrabold tracking-tight truncate max-w-[260px]">{t('stories.thought')}</h2>
                            <button className="w-9 h-9 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowNoteManage(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold"
                                onClick={() => { setShowNoteEdit(true); setShowNoteDeleteConfirm(false); }}
                            >
                                {t('common.edit')}
                            </button>
                            <button
                                className="glass-btn px-4 py-3 text-xs font-bold text-red-600"
                                onClick={() => { setShowNoteDeleteConfirm(true); setShowNoteEdit(false); }}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                        {noteError && (
                            <div className="mt-4 text-xs text-red-500">{noteError}</div>
                        )}
                        {showNoteEdit && (
                            <div className="mt-4 space-y-2">
                                <input
                                    value={noteDraftDate}
                                    onChange={(e) => setNoteDraftDate(e.target.value)}
                                    placeholder={t('stories.date_placeholder')}
                                    className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none"
                                />
                                <textarea
                                    value={noteDraftThought}
                                    onChange={(e) => setNoteDraftThought(e.target.value)}
                                    placeholder={t('stories.thought_placeholder')}
                                    className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none min-h-[110px]"
                                />
                                <textarea
                                    value={noteDraftQuote}
                                    onChange={(e) => setNoteDraftQuote(e.target.value)}
                                    placeholder={t('stories.quote_placeholder')}
                                    className="glass-card-sm w-full px-3 py-3 text-xs font-bold outline-none min-h-[90px]"
                                />
                                <button
                                    className="glass-btn primary w-full py-3 text-xs font-bold"
                                    onClick={async () => {
                                        if (!manageNote) return;
                                        setNoteError(null);
                                        try {
                                            const next: UserNote = {
                                                ...manageNote,
                                                thought: noteDraftThought,
                                                quote: noteDraftQuote,
                                                date: noteDraftDate || manageNote.date
                                            };
                                            await persistNote(next);
                                            setManageNote(next);
                                            setShowNoteManage(false);
                                        } catch (e) {
                                            setNoteError(e instanceof Error ? e.message : t('common.error'));
                                        }
                                    }}
                                >
                                    {t('common.save')}
                                </button>
                            </div>
                        )}
                        {showNoteDeleteConfirm && (
                            <div className="mt-4 space-y-3">
                                <div className="text-xs opacity-70">{t('stories.delete_confirm_extra')}</div>
                                <button
                                    className="glass-btn primary w-full py-3 text-xs font-bold bg-red-500/90"
                                    onClick={async () => {
                                        if (!manageNote) return;
                                        setNoteError(null);
                                        try {
                                            await removeNote(manageNote.id);
                                            setShowNoteManage(false);
                                        } catch (e) {
                                            setNoteError(e instanceof Error ? e.message : t('common.error'));
                                        }
                                    }}
                                >
                                    {t('stories.confirm_delete')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {showSearch && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-main)]/95 backdrop-blur-2xl animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-4 p-6 border-b border-white/5">
                        <button className="p-2 glass-btn rounded-full" onClick={() => { setShowSearch(false); setSearchQ(''); }}>
                            <ArrowLeft size={24} />
                        </button>
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold placeholder:opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder={t('common.search_placeholder')}
                                value={searchQ}
                                onChange={(e) => setSearchQ(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                        {searchQ.trim() ? (() => {
                            const q = searchQ.toLowerCase();
                            const filteredBooks = books.filter(b => 
                                (b.title ?? '').toLowerCase().includes(q) || 
                                (b.author ?? '').toLowerCase().includes(q)
                            );
                            const filteredNotes = notes.filter(n => 
                                (n.quote ?? '').toLowerCase().includes(q) || 
                                (n.thought ?? '').toLowerCase().includes(q)
                            );
                            
                            if (filteredBooks.length === 0 && filteredNotes.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                        <Search size={48} className="mb-4" />
                                        <p className="text-lg font-bold">{t('common.no_results', { query: searchQ })}</p>
                                    </div>
                                );
                            }
                            
                            return (
                                <div className="space-y-8">
                                    {filteredBooks.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-black opacity-40 uppercase tracking-widest mb-4 ml-1">{t('common.books')} ({filteredBooks.length})</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                {filteredBooks.map(b => (
                                                    <button 
                                                        key={b.id} 
                                                        className="glass-card-sm p-4 flex items-center gap-4 text-left group hover:bg-[var(--glass-highlight)] transition-all"
                                                        onClick={() => {
                                                            setReadingBook(b);
                                                            setShowSearch(false);
                                                            setSearchQ('');
                                                        }}
                                                    >
                                                        <div 
                                                            className={`w-12 h-16 rounded shadow-lg shrink-0 ${b.coverColor} opacity-80 group-hover:opacity-100 transition-all border border-white/10`}
                                                            style={b.coverImage ? { backgroundImage: `url(${b.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : b.coverHex ? { background: b.coverHex } : {}}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-sm truncate">{b.title}</div>
                                                            <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest mt-0.5">{b.author}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="opacity-20 group-hover:opacity-100 transition-all" />
                                                    </button>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                    
                                    {filteredNotes.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-black opacity-40 uppercase tracking-widest mb-4 ml-1">{t('common.thoughts')} ({filteredNotes.length})</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                {filteredNotes.map(n => {
                                                    const book = books.find(b => b.id === n.bookId);
                                                    return (
                                                        <button 
                                                            key={n.id} 
                                                            className="glass-card-sm p-5 text-left group hover:bg-[var(--glass-highlight)] transition-all border border-white/5"
                                                            onClick={() => {
                                                                if (book) {
                                                                    setReadingBook(book);
                                                                    setShowSearch(false);
                                                                    setSearchQ('');
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[8px] font-black">
                                                                    {book?.title?.charAt(0) || '?'}
                                                                </div>
                                                                <div className="text-[10px] font-black opacity-40 truncate">{book?.title ?? t('common.unknown_book')}</div>
                                                            </div>
                                                            <p className="text-xs leading-relaxed line-clamp-2 opacity-80 mb-2 italic">"{n.quote}"</p>
                                                            <p className="text-xs font-bold leading-relaxed line-clamp-2">{n.thought}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            );
                        })() : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <Search size={48} className="mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">{t('common.search_start')}</p>
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
    onCreateFolder: () => void;
    onDeleteFolder: (id: string) => void;
    onRenameFolder: (id: string, name: string) => void;
    onStartDeleteFolder: (folder: Folder) => void;
    onStartRenameFolder: (folder: Folder) => void;
    onSearch: () => void;
    onImportSample: (b: Book) => void;
    showFolderCreate?: boolean;
    folderDraftName?: string;
    setFolderDraftName?: (val: string) => void;
    onConfirmCreateFolder?: () => void;
    onCancelCreateFolder?: () => void;
}> = ({ books, folders, activeFolderId, onSetActiveFolder, onOpen, onImport, onManage, onCreateFolder, onDeleteFolder, onRenameFolder, onStartDeleteFolder, onStartRenameFolder, onSearch, onImportSample, showFolderCreate, folderDraftName, setFolderDraftName, onConfirmCreateFolder, onCancelCreateFolder }) => {
    const { t } = useTranslation();
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

    const uncategorizedBooks = books.filter(b => !b.folderId);

    const visibleBooks = (() => {
        if (activeFolderId === 'uncategorized') return uncategorizedBooks;
        if (!activeFolderId) return uncategorizedBooks; // Default to uncategorized if null
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
    
    const activeFolder = folders.find(f => f.id === activeFolderId);

    return (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{t('shelf.title')}</h1>
            <div className="flex gap-3">
                <button className="w-10 h-10 glass-btn rounded-full flex items-center justify-center" onClick={onSearch}>
                    <Search size={20} />
                </button>
                <button className="w-10 h-10 glass-btn primary rounded-full flex items-center justify-center" onClick={onImport} aria-label={t('shelf.import')}>
                    <Plus size={20} strokeWidth={3} />
                </button>
            </div>
        </header>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 items-center">
            <button
                className={`glass-btn px-4 py-2.5 flex items-center gap-2 shrink-0 transition-all ${showFolderCreate ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 scale-105 shadow-lg shadow-blue-500/10' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}
                onClick={onCreateFolder}
                aria-label={t('shelf.new_folder')}
            >
                <FolderPlus size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('shelf.new_folder')}</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
            
            <button
                className={`glass-btn px-5 py-2.5 text-[11px] font-bold whitespace-nowrap transition-all ${activeFolderId === 'uncategorized' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 scale-105 shadow-[0_8px_32px_rgba(59,130,246,0.2)] backdrop-blur-md ring-1 ring-blue-500/20' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => onSetActiveFolder('uncategorized')}
            >
                {t('shelf.inbox')} ({uncategorizedBooks.length})
            </button>

            {folders.filter(f => !f.parentId).map(f => (
                <button
                    key={f.id}
                    className={`glass-btn px-5 py-2.5 text-[11px] font-bold whitespace-nowrap transition-all ${activeFolderId === f.id ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 scale-105 shadow-[0_8px_32px_rgba(59,130,246,0.2)] backdrop-blur-md ring-1 ring-blue-500/20' : 'opacity-70 hover:opacity-100'}`}
                    onClick={() => onSetActiveFolder(f.id)}
                >
                    {f.name}
                </button>
            ))}
        </div>

        {activeFolder && (
            <div className="flex items-center justify-between px-1 -mb-2">
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">{t('shelf.folder_label')} {activeFolder.name}</div>
                    <button 
                        className="w-8 h-8 glass-btn flex items-center justify-center bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-lg shadow-blue-500/5 backdrop-blur-sm hover:bg-blue-500/20 transition-all"
                        onClick={() => onStartRenameFolder(activeFolder)}
                    >
                        <Edit3 size={12} />
                    </button>
                </div>
                <button 
                    className="glass-btn px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 border-red-500/30 shadow-[0_4px_16px_rgba(239,68,68,0.15)] backdrop-blur-md ring-1 ring-red-500/20 hover:bg-red-500/20 transition-all scale-100 hover:scale-105"
                    onClick={() => onStartDeleteFolder(activeFolder)}
                >
                    {t('shelf.delete_folder')}
                </button>
            </div>
        )}

        {showFolderCreate && setFolderDraftName && onConfirmCreateFolder && onCancelCreateFolder && (
            <div className="space-y-3 p-4 glass-card-sm border-dashed border-2 border-blue-500/20 bg-blue-500/5 animate-fade-in-up">
                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">{t('shelf.new_folder_name')}</div>
                <input
                    value={folderDraftName}
                    onChange={(e) => setFolderDraftName(e.target.value)}
                    placeholder={t('shelf.folder_placeholder')}
                    className="glass-card-sm w-full px-4 py-3 text-xs font-bold outline-none border-white/10 focus:border-blue-500/30 transition-colors bg-white/5"
                    autoFocus
                />
                <div className="flex gap-2">
                    <button
                        className="glass-btn flex-1 py-3 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100"
                        onClick={onCancelCreateFolder}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        className="glass-btn flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/20 hover:bg-blue-500/20 transition-all"
                        onClick={onConfirmCreateFolder}
                    >
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
        )}

        {/* Recently Read */}
        {continueBook && (
        <div>
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">{t('shelf.continue')}</h2>
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
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">{t('shelf.shelf_label')}</h2>
            <div className="grid grid-cols-2 gap-3">
                {visibleBooks.map(book => (
                    <div key={book.id} className="glass-card-sm p-4 cursor-pointer group flex flex-col items-center text-center gap-3 relative" onClick={() => onOpen(book)}>
                        <button
                            className="absolute top-2 right-2 w-8 h-8 glass-btn rounded-full flex items-center justify-center opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); onManage(book); }}
                            aria-label={t('shelf.manage_book')}
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
                    <span className="text-xs font-bold opacity-40 group-hover:opacity-100">{t('shelf.add_book')}</span>
                </div>
            </div>
        </div>

        {activeFolderId === 'uncategorized' && (
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 px-1">
                    <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest">{t('shelf.recommended_samples')}</h2>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">{t('shelf.unimported')}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {MOCK_BOOKS.map(sample => {
                        const isImported = books.some(b => b.title === sample.title);
                        if (isImported) return null;
                        return (
                            <div key={sample.id} className="glass-card-sm p-4 group flex flex-col items-center text-center gap-3 relative">
                                <div className={`w-20 h-28 rounded-lg shadow-lg ${sample.coverColor} opacity-80 group-hover:opacity-100 transition-all border border-white/10`} style={coverStyle(sample)}></div>
                                <div>
                                    <h4 className="font-bold text-sm leading-tight line-clamp-1">{sample.title}</h4>
                                    <p className="text-[10px] opacity-60 mt-0.5">{sample.author}</p>
                                </div>
                                <button 
                                    className="glass-btn px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 mt-1 hover:bg-blue-500 hover:text-white transition-all"
                                    onClick={() => onImportSample(sample)}
                                >
                                    {t('shelf.import_sample')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
    </div>
    );
};

const StoriesView: React.FC<{ notes: UserNote[]; books: Book[]; onManageNote: (n: UserNote) => void; onExport: () => void }> = ({ notes, books, onManageNote, onExport }) => {
    const { t } = useTranslation();
    return (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{t('stories.title')}</h1>
            <button className="glass-btn px-5 py-2 text-xs font-bold" onClick={onExport}>{t('stories.export_txt')}</button>
        </header>

        {notes.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center py-16 opacity-60 min-h-[300px]">
                <div className="w-20 h-20 bg-gradient-to-br from-white/50 to-transparent rounded-2xl flex items-center justify-center mb-5 shadow-sm transform rotate-12 border border-white/20">
                    <BookOpen size={28} />
                </div>
                <p className="font-bold text-base">{t('stories.no_notes')}</p>
                <p className="text-xs opacity-60 mt-1">{t('stories.no_notes_subtitle')}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-3">
                {notes.map(note => (
                    <div key={note.id} className="glass-card-sm p-5 hover:scale-[1.01] transition-transform">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-[var(--text-inverse)] bg-[var(--text-main)] px-2 py-0.5 rounded-full shadow-md shrink-0">{note.date}</span>
                                <span className="text-[10px] font-bold opacity-50 truncate">
                                    {books.find(b => b.id === note.bookId)?.title ?? note.bookId}
                                </span>
                            </div>
                            <button className="opacity-40 hover:opacity-100" onClick={() => onManageNote(note)} aria-label={t('stories.manage_thought')}>
                                <MoreHorizontal size={18} />
                            </button>
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
};

const DiscoverView: React.FC<{ 
    books: Book[]; 
    notes: UserNote[]; 
    onOpen: (b: Book) => void; 
    onImport: () => void; 
    onSearch: () => void;
    onSwitchTab: (tab: 'Shelf' | 'Stories' | 'Discover' | 'Profile') => void;
}> = ({ books, notes, onOpen, onImport, onSearch, onSwitchTab }) => {
    const { t } = useTranslation();
    const progressOf = (b: Book) => storageAdapter.loadProgress(b.id) || b.progress || 0;
    const featured = books.length ? [...books].sort((a, b) => progressOf(b) - progressOf(a))[0] : null;
    const recentNotes = [...notes].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
    
    const randomNote = React.useMemo(() => {
        if (notes.length === 0) return null;
        return notes[Math.floor(Math.random() * notes.length)];
    }, [notes.length]);

    const notes7d = notes.filter(n => {
        const d = new Date(n.date);
        if (Number.isNaN(d.getTime())) return false;
        return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    }).length;

    const recentBooks = [...books].sort((a, b) => {
        const pa = storageAdapter.loadProgress(a.id) || a.progress || 0;
        const pb = storageAdapter.loadProgress(b.id) || b.progress || 0;
        return pb - pa;
    }).slice(0, 6);

    const avgProgress = books.length > 0 
        ? Math.round(books.reduce((acc, b) => acc + progressOf(b), 0) / books.length) 
        : 0;

    return (
        <div className="animate-fade-in-up space-y-6 pb-20">
            <header className="mt-1 flex justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-extrabold tracking-tight">{t('tabs.discover')}</h1>
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{t('discover.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <button className="w-10 h-10 glass-btn rounded-full flex items-center justify-center" onClick={onSearch} aria-label={t('common.search')}>
                        <Search size={20} />
                    </button>
                    <button className="w-10 h-10 glass-btn primary rounded-full flex items-center justify-center" onClick={onImport} aria-label={t('shelf.import')}>
                        <Plus size={20} strokeWidth={3} />
                    </button>
                </div>
            </header>
            
            <div className="glass-card p-6 relative overflow-hidden group min-h-[340px] flex flex-col justify-end transition-all hover:shadow-2xl hover:shadow-white/5">
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-white rounded-full blur-[60px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity"></div>
                {featured?.coverImage ? (
                    <div className="absolute inset-0 z-0 opacity-20 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-30">
                        <img src={featured.coverImage} className="w-full h-full object-cover blur-sm" alt="" />
                    </div>
                ) : featured?.coverHex ? (
                    <div className="absolute inset-0 z-0 opacity-10 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-20" style={{ background: featured.coverHex }}></div>
                ) : null}
                
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-transparent to-transparent opacity-60 z-1"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-500/20 text-blue-400 backdrop-blur-md text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-500/20">{t('discover.featured_reading')}</span>
                    </div>
                    {featured ? (
                        <>
                            <h2 className="text-4xl font-black mb-3 leading-tight drop-shadow-xl line-clamp-2 tracking-tight">{featured.title}</h2>
                            <div className="flex items-center gap-3 mb-8">
                                <p className="opacity-70 text-sm font-bold truncate max-w-[200px]">{featured.author}</p>
                                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                <p className="text-xs font-black text-blue-400">{t('discover.percent_done', { percent: progressOf(featured) })}</p>
                            </div>
                            <button className="glass-btn primary px-6 py-4 text-sm font-bold shadow-xl w-full flex justify-between items-center group-active:scale-95 transition-all" onClick={() => onOpen(featured)}>
                                <span className="flex items-center gap-2">
                                    <Play size={16} fill="currentColor" />
                                    {t('discover.resume_reading')}
                                </span>
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white/20 bg-white/10 backdrop-blur-sm"></div>
                                    ))}
                                </div>
                            </button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-3xl font-extrabold mb-2 leading-tight drop-shadow-sm">{t('discover.start_journey')}</h2>
                            <p className="opacity-70 text-sm mb-6 max-w-[90%] font-medium">{t('import.description')}</p>
                            <button className="glass-btn primary px-6 py-3 text-sm font-bold shadow-xl w-full flex justify-between items-center group-active:scale-95 transition-transform" onClick={onImport}>
                                <span>{t('shelf.import')}</span>
                                <Plus size={18} strokeWidth={3} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    className="glass-card-sm p-5 flex flex-col justify-between h-36 relative overflow-hidden group transition-all active:scale-95"
                    onClick={() => onSwitchTab('Stories')}
                >
                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-inner border border-blue-500/10">
                        <TrendingUp size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-blue-500">{notes7d}</div>
                        <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.15em] mt-1">{t('discover.stats_7d')}</div>
                    </div>
                </button>
                <button 
                    className="glass-card-sm p-5 flex flex-col justify-between h-36 relative overflow-hidden group transition-all active:scale-95"
                    onClick={() => onSwitchTab('Shelf')}
                >
                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-colors"></div>
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shadow-inner border border-yellow-500/10">
                        <Sparkles size={20} className="text-yellow-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-yellow-500">{avgProgress}%</div>
                        <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.15em] mt-1">{t('discover.stats_avg')}</div>
                    </div>
                </button>
            </div>

            {randomNote && (
                <div className="glass-card p-6 bg-gradient-to-br from-[var(--glass-highlight)] to-transparent relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <BookOpen size={80} />
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <h3 className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">{t('discover.inspiration')}</h3>
                    </div>
                    <p className="text-lg font-bold leading-relaxed italic mb-4 line-clamp-3">"{randomNote.thought}"</p>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">
                                {books.find(b => b.id === randomNote.bookId)?.title?.charAt(0) || '?'}
                            </div>
                            <span className="text-[10px] font-bold opacity-60">
                                {books.find(b => b.id === randomNote.bookId)?.title || t('common.unknown_book')}
                            </span>
                        </div>
                        <button 
                            className="text-[10px] font-black text-blue-500 hover:underline"
                            onClick={() => {
                                const book = books.find(b => b.id === randomNote.bookId);
                                if (book) onOpen(book);
                            }}
                        >
                            {t('discover.open_book')}
                        </button>
                    </div>
                </div>
            )}

            {recentBooks.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.2em]">{t('discover.jump_back_in')}</h3>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            <span className="text-[10px] font-bold opacity-30">{books.length} {t('common.total')}</span>
                        </div>
                        <button className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:opacity-80 transition-opacity" onClick={() => onSwitchTab('Shelf')}>
                            {t('tabs.shelf')} ›
                        </button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1">
                        {recentBooks.map(b => (
                            <div 
                                key={b.id} 
                                className="flex flex-col gap-3 min-w-[120px] cursor-pointer group"
                                onClick={() => onOpen(b)}
                            >
                                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:scale-[1.05] group-hover:shadow-xl group-active:scale-95">
                                    <div 
                                        className={`absolute inset-0 ${b.coverColor} border border-white/10`}
                                        style={b.coverImage ? { backgroundImage: `url(${b.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : b.coverHex ? { background: b.coverHex } : {}}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-500 transition-all duration-1000" 
                                                style={{ width: `${progressOf(b)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-[11px] font-black truncate group-hover:text-blue-500 transition-colors">{b.title}</div>
                                    <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{t('discover.percent_done', { percent: progressOf(b) })}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass-card p-6 bg-gradient-to-b from-transparent to-[var(--glass-highlight)]/5">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                        <h3 className="text-sm font-black opacity-80 tracking-tight">{t('discover.recent_thoughts')}</h3>
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">{t('discover.recent_thoughts_subtitle')}</p>
                    </div>
                    <button className="glass-btn px-4 py-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:bg-[var(--glass-highlight)] transition-all" onClick={() => onSwitchTab('Stories')}>
                        {t('common.all')}
                    </button>
                </div>
                {recentNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40 border-2 border-dashed border-white/5 rounded-2xl">
                        <Edit3 size={32} className="mb-2" />
                        <p className="text-xs font-bold">{t('stories.no_notes')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {recentNotes.map(n => {
                            const book = books.find(b => b.id === n.bookId);
                            return (
                                <button 
                                    key={n.id} 
                                    className="glass-card-sm w-full text-left p-5 transition-all hover:bg-[var(--glass-highlight)] active:scale-[0.98] border border-white/5"
                                    onClick={() => {
                                        if (book) onOpen(book);
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[8px] font-black">
                                                {book?.title?.charAt(0) || '?'}
                                            </div>
                                            <div className="text-[10px] font-black opacity-40 truncate max-w-[150px]">{book?.title ?? n.bookId}</div>
                                        </div>
                                        <div className="text-[9px] font-bold opacity-30 uppercase tracking-tighter">{n.date}</div>
                                    </div>
                                    <div className="text-sm font-bold leading-relaxed line-clamp-2 opacity-90 group-hover:opacity-100">"{n.thought}"</div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const ProfileView: React.FC<{ 
    books: Book[], 
    notes: UserNote[], 
    profile: { 
        name: string; 
        initials: string; 
        bio: string; 
        favorite_book_ids: string[];
        yearly_goal: number;
        monthly_goal: number;
        language?: string;
    } | null,
    theme: AppTheme, 
    onThemeChange: (t: AppTheme) => void,
    onUpdateProfile: (p: { 
        name: string; 
        initials: string; 
        bio: string; 
        favorite_book_ids?: string[];
        yearly_goal?: number;
        monthly_goal?: number;
        language?: string;
    }) => Promise<void>,
    onOpenBook: (b: Book) => void
}> = ({ books, notes, profile, theme, onThemeChange, onUpdateProfile, onOpenBook }) => {
    const { t, i18n } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(profile?.name ?? '');
    const [editBio, setEditBio] = useState(profile?.bio ?? '');
    
    const [showGoals, setShowGoals] = useState(false);
    const [showFavorites, setShowFavorites] = useState(false);
    const [showShare, setShowShare] = useState(false);

    const [editYearlyGoal, setEditYearlyGoal] = useState(profile?.yearly_goal ?? 12);
    const [editMonthlyGoal, setEditMonthlyGoal] = useState(profile?.monthly_goal ?? 2);

    const shareCardRef = useRef<HTMLDivElement>(null);

    const handleSaveImage = async () => {
        if (!shareCardRef.current) return;
        
        try {
            const dataUrl = await toPng(shareCardRef.current, {
                cacheBust: true,
                backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
                style: {
                    borderRadius: '24px',
                    margin: '0',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                },
                pixelRatio: 3,
            });

            const fileName = `deepread-share-${Date.now()}.png`;

            // Check if we are in a native environment
            const isNative = (window as any).Capacitor?.isNativePlatform();

            if (isNative) {
                await Filesystem.writeFile({
                    path: fileName,
                    data: dataUrl.split(',')[1],
                    directory: Directory.Cache, // Use Cache for temporary storage before potential sharing
                });
                // In a real app we might want to use the Share plugin here
                // For now, let's try to save to Documents as requested
                try {
                    await Filesystem.writeFile({
                        path: fileName,
                        data: dataUrl.split(',')[1],
                        directory: Directory.Documents,
                    });
                    alert(t('profile.image_saved_to_documents'));
                } catch (err) {
                    console.error('Filesystem save failed', err);
                }
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }
            setShowShare(false);
        } catch (err) {
            console.error('Failed to save image:', err);
            alert(t('profile.save_image_failed'));
        }
    };

    const totalXP = books.reduce((acc, b) => {
        const progress = storageAdapter.loadProgress(b.id) || b.progress || 0;
        return acc + (progress * 10) + (progress >= 100 ? 500 : 0);
    }, 0) + (notes.length * 50);

    const getLevelInfo = (xp: number) => {
        const level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 500)) / 2) || 1;
        const currentLevelXP = 500 * level * (level - 1);
        const nextLevelXP = 500 * (level + 1) * level;
        const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
        return { level, progress, xp, nextLevelXP };
    };

    const levelInfo = getLevelInfo(totalXP);

    const getRankTitle = (level: number) => {
        if (level >= 10) return t('profile.rank_4');
        if (level >= 7) return t('profile.rank_3');
        if (level >= 4) return t('profile.rank_2');
        return t('profile.rank_1');
    };

    const totalProgress = books.reduce((acc, b) => acc + (storageAdapter.loadProgress(b.id) || b.progress || 0), 0);
    const estHours = Math.round(totalProgress / 10) || 0; 
    
    const favoriteBooks = books.filter(b => profile?.favorite_book_ids?.includes(b.id));

    const toggleFavorite = async (bookId: string) => {
        if (!profile) return;
        const current = profile.favorite_book_ids || [];
        const next = current.includes(bookId) 
            ? current.filter(id => id !== bookId)
            : [...current, bookId];
        await onUpdateProfile({ ...profile, favorite_book_ids: next });
    };

    const handleSaveGoals = async () => {
        if (!profile) return;
        await onUpdateProfile({ 
            ...profile, 
            yearly_goal: editYearlyGoal, 
            monthly_goal: editMonthlyGoal 
        });
        setShowGoals(false);
    };

    const changeLanguage = async (lng: string) => {
        i18n.changeLanguage(lng);
        if (profile) {
            await onUpdateProfile({ ...profile, language: lng });
        }
    };

    useEffect(() => {
        if (profile?.language && profile.language !== i18n.language) {
            i18n.changeLanguage(profile.language);
        }
    }, [profile?.language, i18n]);

    return (
        <div className="animate-fade-in-up space-y-6">
            <header className="flex justify-between items-center mt-1">
                 <h1 className="text-3xl font-extrabold tracking-tight">{t('profile.title')}</h1>
                 <button 
                    className={`w-10 h-10 glass-btn rounded-full flex items-center justify-center transition-colors ${isEditing ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : ''}`}
                    onClick={() => {
                        if (isEditing) {
                            onUpdateProfile({ 
                                ...profile,
                                name: editName, 
                                bio: editBio, 
                                initials: editName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
                            });
                        } else {
                            setEditName(profile?.name ?? '');
                            setEditBio(profile?.bio ?? '');
                        }
                        setIsEditing(!isEditing);
                    }}
                >
                    {isEditing ? <Sparkles size={20} /> : <Settings size={20} />}
                </button>
            </header>
            
            <div className="glass-card p-5 flex items-center gap-5">
                <div className="w-20 h-20 shrink-0 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-2xl font-bold shadow-inner border border-white/20">
                    {profile?.initials || '??'}
                </div>
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="space-y-2">
                            <input 
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="w-full bg-[var(--glass-highlight)] px-3 py-1.5 rounded-lg text-sm font-bold outline-none"
                                placeholder={t('profile.name')}
                            />
                            <input 
                                value={editBio}
                                onChange={e => setEditBio(e.target.value)}
                                className="w-full bg-[var(--glass-highlight)] px-3 py-1.5 rounded-lg text-xs font-medium outline-none"
                                placeholder={t('profile.bio')}
                            />
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold truncate">{profile?.name || t('common.loading')}</h2>
                            <p className="text-sm opacity-50 font-medium truncate">{profile?.bio || t('profile.default_bio')}</p>
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="bg-[var(--text-main)] border border-white/10 text-[var(--text-inverse)] px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        {t('profile.level')} {levelInfo.level}
                                    </div>
                                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">
                                        {getRankTitle(levelInfo.level)}
                                    </span>
                                </div>
                                <div className="w-full max-w-[160px]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{t('profile.xp')} {Math.floor(totalXP)}</span>
                                        <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{Math.floor(levelInfo.progress * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000" 
                                            style={{ width: `${levelInfo.progress * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* --- Theme & Language Card --- */}
            <div className="glass-card p-5 space-y-6">
                <div>
                    <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-4">{t('profile.appearance')}</h3>
                    <div className="flex gap-4">
                        <ThemeOption 
                            active={theme === 'white'} 
                            label={t('profile.white')} 
                            icon={<Sun size={18} />} 
                            onClick={() => onThemeChange('white')}
                            bg="bg-white text-black"
                        />
                        <ThemeOption 
                            active={theme === 'gray'} 
                            label={t('profile.gray')} 
                            icon={<Smartphone size={18} />} 
                            onClick={() => onThemeChange('gray')}
                            bg="bg-gray-200 text-gray-800"
                        />
                        <ThemeOption 
                            active={theme === 'dark'} 
                            label={t('profile.dark')} 
                            icon={<Moon size={18} />} 
                            onClick={() => onThemeChange('dark')}
                            bg="bg-gray-900 text-white"
                        />
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-4">{t('profile.language')}</h3>
                    <div className="flex gap-4">
                        <button 
                            className={`flex-1 py-3 glass-btn text-xs font-bold transition-all ${i18n.language === 'zh' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'opacity-60 hover:opacity-100'}`}
                            onClick={() => changeLanguage('zh')}
                        >
                            中文
                        </button>
                        <button 
                            className={`flex-1 py-3 glass-btn text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'opacity-60 hover:opacity-100'}`}
                            onClick={() => changeLanguage('en')}
                        >
                            English
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <StatsCard value={estHours.toString()} label={t('profile.stats_hours')} />
                <StatsCard value={books.length.toString()} label={t('profile.stats_books')} />
                <StatsCard value={notes.length.toString()} label={t('profile.stats_thoughts')} />
            </div>

            <div className="space-y-2">
                <ProfileMenuItem icon={<LibraryIcon size={20} />} label={t('profile.reading_goals')} onClick={() => {
                    setEditYearlyGoal(profile?.yearly_goal ?? 12);
                    setEditMonthlyGoal(profile?.monthly_goal ?? 2);
                    setShowGoals(true);
                }} />
                <ProfileMenuItem icon={<Share size={20} />} label={t('profile.share_profile')} onClick={() => setShowShare(true)} />
                <ProfileMenuItem icon={<Heart size={20} />} label={t('profile.favorites')} onClick={() => setShowFavorites(true)} />
            </div>

            {/* --- Reading Goals Modal --- */}
            {showGoals && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowGoals(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-6 animate-fade-in-up">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-extrabold">{t('profile.reading_goals')}</h2>
                            <button className="w-8 h-8 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowGoals(false)}>✕</button>
                        </div>
                        <div className="space-y-6">
                            <div className="glass-card-sm p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold opacity-60 uppercase">{t('profile.yearly_progress')}</span>
                                    <div className="flex items-center gap-3">
                                        <button className="w-6 h-6 glass-btn rounded-full flex items-center justify-center text-xs" onClick={() => setEditYearlyGoal(Math.max(1, editYearlyGoal - 1))}>-</button>
                                        <span className="text-sm font-black w-12 text-center">{books.length} / {editYearlyGoal}</span>
                                        <button className="w-6 h-6 glass-btn rounded-full flex items-center justify-center text-xs" onClick={() => setEditYearlyGoal(editYearlyGoal + 1)}>+</button>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, (books.length / editYearlyGoal) * 100)}%` }}></div>
                                </div>
                            </div>
                            <div className="glass-card-sm p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold opacity-60 uppercase">{t('profile.monthly_goal')}</span>
                                    <div className="flex items-center gap-3">
                                        <button className="w-6 h-6 glass-btn rounded-full flex items-center justify-center text-xs" onClick={() => setEditMonthlyGoal(Math.max(1, editMonthlyGoal - 1))}>-</button>
                                        <span className="text-sm font-black w-12 text-center">{editMonthlyGoal} {t('profile.books_unit')}</span>
                                        <button className="w-6 h-6 glass-btn rounded-full flex items-center justify-center text-xs" onClick={() => setEditMonthlyGoal(editMonthlyGoal + 1)}>+</button>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${Math.min(100, (totalProgress / (profile?.monthly_goal || 2)) * 100)}%` }}></div>
                                </div>
                            </div>
                            <button className="glass-btn primary w-full py-3 text-sm font-bold" onClick={handleSaveGoals}>{t('profile.save_goals')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Share Modal --- */}
            {showShare && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowShare(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-8 animate-fade-in-up">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tight">{t('profile.share_progress')}</h2>
                                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{t('profile.share_subtitle')}</p>
                            </div>
                            <button className="w-8 h-8 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowShare(false)}>✕</button>
                        </div>

                        <div ref={shareCardRef} className="glass-card p-6 mb-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-lg">
                                        {profile?.initials}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black">{profile?.name}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">Lv. {levelInfo.level}</span>
                                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{getRankTitle(levelInfo.level)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-xs font-black opacity-40 uppercase tracking-tighter">{t('profile.books_read')}</div>
                                        <div className="text-xl font-black">{books.length}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-black opacity-40 uppercase tracking-tighter">{t('profile.thoughts')}</div>
                                        <div className="text-xl font-black">{notes.length}</div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="text-[10px] font-bold opacity-60 italic leading-relaxed">
                                        {t('profile.share_quote')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                className="glass-btn primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20"
                                onClick={() => {
                                    const text = t('profile.share_copy_text', { count: books.length, notes: notes.length });
                                    navigator.clipboard.writeText(text);
                                    setShowShare(false);
                                }}
                            >
                                <Copy size={16} />
                                {t('profile.copy_summary')}
                            </button>
                            <button 
                                className="glass-btn w-full py-4 text-sm font-bold opacity-60 flex items-center justify-center gap-2"
                                onClick={handleSaveImage}
                            >
                                <Smartphone size={16} />
                                {t('profile.save_image')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Favorites Modal --- */}
            {showFavorites && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center p-5">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setShowFavorites(false)} />
                    <div className="relative glass-modal w-full max-w-[420px] p-8 animate-fade-in-up">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tight">{t('profile.favorites')}</h2>
                                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{t('profile.favorites_subtitle')}</p>
                            </div>
                            <button className="w-8 h-8 glass-btn rounded-full flex items-center justify-center" onClick={() => setShowFavorites(false)}>✕</button>
                        </div>
                        
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                            {favoriteBooks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 opacity-30 border-2 border-dashed border-white/5 rounded-3xl">
                                    <Heart size={40} className="mb-4" />
                                    <p className="text-sm font-black">{t('profile.no_favorites')}</p>
                                    <p className="text-[10px] font-bold mt-1 uppercase tracking-widest">{t('profile.add_from_library')}</p>
                                </div>
                            ) : (
                                favoriteBooks.map(b => (
                                    <div 
                                        key={b.id} 
                                        className="glass-card-sm w-full p-4 flex items-center gap-5 group relative overflow-hidden transition-all hover:bg-[var(--glass-highlight)] active:scale-[0.98]"
                                    >
                                        <div 
                                            className="flex-1 flex items-center gap-5 cursor-pointer min-w-0"
                                            onClick={() => {
                                                setShowFavorites(false);
                                                onOpenBook(b);
                                            }}
                                        >
                                            <div className="relative w-14 h-20 shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/10 group-hover:scale-105 transition-transform">
                                                <div 
                                                    className={`absolute inset-0 ${b.coverColor}`}
                                                    style={b.coverImage ? { backgroundImage: `url(${b.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : b.coverHex ? { background: b.coverHex } : {}}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-black truncate group-hover:text-blue-500 transition-colors">{b.title}</div>
                                                <div className="text-[10px] font-bold opacity-40 truncate mt-0.5">{b.author}</div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="h-1 w-16 bg-black/10 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500" 
                                                            style={{ width: `${storageAdapter.loadProgress(b.id) || b.progress || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[8px] font-black opacity-30">{storageAdapter.loadProgress(b.id) || b.progress || 0}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            className="w-10 h-10 glass-btn rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 text-red-500 shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(b.id);
                                            }}
                                            aria-label={t('profile.remove_favorite')}
                                        >
                                            <Heart size={16} fill="currentColor" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <button 
                            className="glass-btn w-full py-4 text-sm font-black mt-8 opacity-60 hover:opacity-100 transition-opacity uppercase tracking-widest"
                            onClick={() => setShowFavorites(false)}
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

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

const ProfileMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
    <div 
        className="flex items-center justify-between p-4 glass-card-sm cursor-pointer hover:bg-[var(--glass-highlight)] active:scale-98 transition-all group"
        onClick={onClick}
    >
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
