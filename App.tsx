
import React, { useState, useEffect } from 'react';
import { Book, Tab, UserNote } from './types';
import { MOCK_BOOKS } from './constants';
import { Reader } from './components/Reader';
import { BookOpen, Compass, User, Library as LibraryIcon, Search, Plus, MoreHorizontal, Share, Settings, Sparkles, TrendingUp, Heart, Play, Moon, Sun, Smartphone } from 'lucide-react';
import { storageAdapter } from './storageAdapter';

type AppTheme = 'white' | 'gray' | 'dark';

export default function App() {
    const [activeTab, setActiveTab] = useState<Tab>('Shelf');
    const [readingBook, setReadingBook] = useState<Book | null>(null);
    const [notes, setNotes] = useState<UserNote[]>([]);
    const [theme, setTheme] = useState<AppTheme>('white');

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
                {activeTab === 'Shelf' && <Bookshelf books={MOCK_BOOKS} onOpen={handleBookClick} />}
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
        </div>
    );
}

// --- Sub-Components for Views ---

const Bookshelf: React.FC<{ books: Book[], onOpen: (b: Book) => void }> = ({ books, onOpen }) => (
    <div className="animate-fade-in-up space-y-6">
        <header className="flex justify-between items-center mt-1">
            <h1 className="text-3xl font-extrabold tracking-tight">Library</h1>
            <div className="flex gap-3">
                <button className="w-10 h-10 glass-btn rounded-full flex items-center justify-center">
                    <Search size={20} />
                </button>
                <button className="w-10 h-10 glass-btn primary rounded-full flex items-center justify-center">
                    <Plus size={20} strokeWidth={3} />
                </button>
            </div>
        </header>

        {/* Recently Read */}
        <div>
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">Continue</h2>
            <div 
                className="glass-card p-0 flex flex-col cursor-pointer group relative overflow-hidden h-[250px]"
                onClick={() => onOpen(books[0])}
            >
                {/* Sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent z-0 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full p-5">
                    <div className="flex gap-5 flex-1 items-start">
                        <div className={`w-28 h-40 rounded-xl shadow-xl ${books[0].coverColor} shrink-0 transform group-hover:scale-105 transition-transform duration-500 ease-out rotate-1 group-hover:rotate-0 border border-white/10`}></div>
                        <div className="pt-2">
                             <h3 className="font-bold text-xl leading-tight mb-1 line-clamp-2">{books[0].title}</h3>
                             <p className="text-sm opacity-60 font-medium">{books[0].author}</p>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <div className="flex justify-between items-end mb-2">
                             <span className="text-2xl font-bold">{books[0].progress}%</span>
                             <div className="w-9 h-9 rounded-full bg-[var(--text-main)] flex items-center justify-center text-[var(--text-inverse)] shadow-lg group-hover:scale-110 transition-transform">
                                 <Play size={16} fill="currentColor" />
                             </div>
                        </div>
                        <div className="liquid-progress-container h-6 w-full">
                            <div className="liquid-progress-fill" style={{ width: `${books[0].progress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div>
            <h2 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-3 pl-1">Shelf</h2>
            <div className="grid grid-cols-2 gap-3">
                {books.map(book => (
                    <div key={book.id} className="glass-card-sm p-4 cursor-pointer group flex flex-col items-center text-center gap-3" onClick={() => onOpen(book)}>
                        <div className={`w-20 h-28 rounded-lg shadow-lg ${book.coverColor} group-hover:-translate-y-2 transition-transform duration-300 border border-white/10`}></div>
                        <div>
                             <h4 className="font-bold text-sm leading-tight line-clamp-1">{book.title}</h4>
                             <p className="text-[10px] opacity-60 mt-0.5">{book.author}</p>
                        </div>
                    </div>
                ))}
                {/* Add New Tile */}
                <div className="glass-card-sm p-4 cursor-pointer group flex flex-col items-center justify-center text-center gap-2 min-h-[160px] border-dashed border-2 border-[var(--text-sec)]/20 bg-transparent hover:bg-[var(--glass-highlight)]">
                    <div className="w-12 h-12 rounded-full bg-[var(--glass-highlight)] flex items-center justify-center opacity-60 group-hover:opacity-100 transition-colors shadow-sm">
                        <Plus size={24} />
                    </div>
                    <span className="text-xs font-bold opacity-40 group-hover:opacity-100">Add Book</span>
                </div>
            </div>
        </div>
    </div>
);

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
