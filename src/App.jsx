import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, X, Network, BookOpen, Layers, Heart, Hash, Lightbulb, AlertTriangle, Globe, Loader2, AlertCircle, ArrowRight, LogIn, LogOut, User, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Netlify Identity helpers ──────────────────────────────────────────────────
// The widget is loaded via a <script> tag in index.html. We reference it via
// the global `netlifyIdentity` object it exposes.
function getIdentity() {
    return window.netlifyIdentity;
}

// ─── Dynamic Category Colors ───────────────────────────────────────────────────
const COLOR_PALETTE = [
    'bg-rose-100 text-rose-700',
    'bg-pink-100 text-pink-700',
    'bg-fuchsia-100 text-fuchsia-700',
    'bg-purple-100 text-purple-700',
    'bg-violet-100 text-violet-700',
    'bg-indigo-100 text-indigo-700',
    'bg-blue-100 text-blue-700',
    'bg-sky-100 text-sky-700',
    'bg-cyan-100 text-cyan-700',
    'bg-teal-100 text-teal-700',
    'bg-emerald-100 text-emerald-700',
    'bg-green-100 text-green-700',
    'bg-lime-100 text-lime-700',
    'bg-amber-100 text-amber-700',
    'bg-orange-100 text-orange-700',
];

const categoryColorCache = {};
let colorIndex = 0;

function getCategoryStyle(category) {
    if (!categoryColorCache[category]) {
        categoryColorCache[category] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
    }
    return categoryColorCache[category];
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="p-5 rounded-2xl border border-neutral-200 bg-white animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="h-4 w-20 bg-neutral-200 rounded-full" />
                <div className="h-4 w-4 bg-neutral-200 rounded-full" />
            </div>
            <div className="h-5 w-3/4 bg-neutral-200 rounded mb-2" />
            <div className="space-y-1">
                <div className="h-3 w-full bg-neutral-100 rounded" />
                <div className="h-3 w-5/6 bg-neutral-100 rounded" />
            </div>
        </div>
    );
}

// ─── AuthButton ────────────────────────────────────────────────────────────────
function AuthButton({ user, onSignIn, onSignOut }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!user) {
        return (
            <button
                id="sign-in-btn"
                onClick={onSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full transition-colors shadow-sm"
            >
                <LogIn className="w-4 h-4" />
                Sign in
            </button>
        );
    }

    const email = user.email || '';
    const name = user.user_metadata?.full_name || email.split('@')[0] || 'User';
    const initials = name.slice(0, 2).toUpperCase();

    return (
        <div className="relative" ref={menuRef}>
            <button
                id="user-menu-btn"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-neutral-100 transition-colors text-sm"
            >
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {initials}
                </div>
                <span className="text-neutral-700 font-medium hidden sm:block max-w-32 truncate">{name}</span>
            </button>
            {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30">
                    <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-100 truncate">{email}</div>
                    <button
                        id="sign-out-btn"
                        onClick={() => { setMenuOpen(false); onSignOut(); }}
                        className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
                    >
                        <LogOut className="w-4 h-4 text-neutral-400" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [likes, setLikes] = useState(new Set());
    const [showSavedOnly, setShowSavedOnly] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Lock body scroll when bottom sheet is open on mobile
    useEffect(() => {
        if (selectedId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedId]);

    // Auth state
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [saveSyncing, setSaveSyncing] = useState(false);

    // Sign-in tooltip state (for guest clicking heart)
    const [showSignInHint, setShowSignInHint] = useState(false);
    const hintTimerRef = useRef(null);

    // ─── Netlify Identity init ────────────────────────────────────────────────
    useEffect(() => {
        const ni = getIdentity();
        if (!ni) {
            console.warn('Netlify Identity widget not loaded');
            setAuthLoading(false);
            return;
        }

        ni.on('init', (u) => {
            setUser(u || null);
            setAuthLoading(false);
        });

        ni.on('login', (u) => {
            setUser(u);
            // After login, redirect back (closes modal automatically)
            ni.close();
        });

        ni.on('logout', () => {
            setUser(null);
            setLikes(new Set());
        });

        ni.init();
    }, []);

    // ─── Load user saves after login ─────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        fetchUserSaves(user);
    }, [user]);

    async function fetchUserSaves(u) {
        try {
            const token = u?.token?.access_token;
            if (!token) return;
            const res = await fetch('/.netlify/functions/saves', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const { saves } = await res.json();
            if (Array.isArray(saves)) {
                setLikes(new Set(saves));
            }
        } catch (err) {
            console.warn('Could not fetch saves:', err);
        }
    }

    // ─── Debounced save sync ──────────────────────────────────────────────────
    const syncTimerRef = useRef(null);

    function scheduleSaveSync(nextLikes) {
        if (!user) return;
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            syncSaves(nextLikes);
        }, 800);
    }

    async function syncSaves(likesSet) {
        const token = user?.token?.access_token;
        if (!token) return;
        setSaveSyncing(true);
        try {
            await fetch('/.netlify/functions/saves', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ saves: Array.from(likesSet) }),
            });
        } catch (err) {
            console.warn('Save sync failed:', err);
        } finally {
            setSaveSyncing(false);
        }
    }

    // ─── Fetch models from Netlify Function ───────────────────────────────────
    useEffect(() => {
        const fetchModels = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch('/.netlify/functions/models');
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || `Request failed: ${res.status}`);
                }
                const data = await res.json();
                setModels(data);
            } catch (err) {
                console.error('Failed to load models:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchModels();
    }, []);

    // ─── Derived data ─────────────────────────────────────────────────────────
    const allCategories = useMemo(() => {
        const cats = new Set();
        models.forEach(m => m.categories.forEach(c => cats.add(c)));
        return Array.from(cats).sort();
    }, [models]);

    const filteredModels = useMemo(() => {
        return models.filter(model => {
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch = !q ||
                model.title.toLowerCase().includes(q) ||
                model.definition.toLowerCase().includes(q) ||
                model.categories.some(c => c.toLowerCase().includes(q));
            const matchesCategory = !selectedCategory || model.categories.includes(selectedCategory);
            const matchesSaved = !showSavedOnly || likes.has(model.id);
            return matchesSearch && matchesCategory && matchesSaved;
        });
    }, [searchQuery, selectedCategory, showSavedOnly, likes, models]);

    const selectedModel = useMemo(
        () => models.find(m => m.id === selectedId) || null,
        [selectedId, models]
    );

    const toggleLike = useCallback((e, id) => {
        e.stopPropagation();

        if (!user) {
            // Guest: show sign-in hint
            setShowSignInHint(true);
            clearTimeout(hintTimerRef.current);
            hintTimerRef.current = setTimeout(() => setShowSignInHint(false), 3000);
            return;
        }

        setLikes(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            scheduleSaveSync(next);
            return next;
        });
    }, [user]);

    const findRelated = useCallback(
        (id) => models.find(m => m.id === id),
        [models]
    );

    const handleSignIn = () => getIdentity()?.open();
    const handleSignOut = () => getIdentity()?.logout();

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-6 py-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
                            <Network className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-neutral-900 leading-none">Knowledge Garden</h1>
                            {!loading && !error && (
                                <p className="text-xs text-neutral-400 mt-0.5">{models.length} mental models</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <input
                                type="text"
                                id="search-input"
                                placeholder="Search concepts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-neutral-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>

                        {/* Sync indicator */}
                        {saveSyncing && (
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" title="Saving..." />
                        )}

                        {/* Auth */}
                        {!authLoading && (
                            <AuthButton user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
                        )}
                    </div>
                </div>
            </header>

            {/* Sign-in hint toast */}
            {showSignInHint && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-neutral-900 text-white text-sm px-5 py-3 rounded-full shadow-xl animate-fade-in">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span>Sign in to save models across devices</span>
                    <button
                        onClick={handleSignIn}
                        className="ml-1 text-indigo-300 hover:text-indigo-200 font-semibold underline underline-offset-2"
                    >
                        Sign in
                    </button>
                </div>
            )}

            <main className="max-w-7xl mx-auto p-6">
                {/* Error state */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-red-800 text-sm">Failed to load mental models</p>
                            <p className="text-red-600 text-sm mt-0.5">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-2 text-xs text-red-700 underline hover:text-red-900"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Mobile Filter Toggle ───────────────────────────────── */}
                {(() => {
                    const activeFilterLabel = showSavedOnly
                        ? `Saved (${likes.size})`
                        : selectedCategory || 'All Models';
                    return (
                        <div className="lg:hidden mb-4">
                            <button
                                id="mobile-filter-toggle"
                                onClick={() => setSidebarOpen(prev => !prev)}
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 shadow-sm hover:border-indigo-300 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
                                    <span className="text-neutral-500">Filter:</span>
                                    <span className="text-indigo-700 font-semibold">{activeFilterLabel}</span>
                                </span>
                                {sidebarOpen
                                    ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                                    : <ChevronDown className="w-4 h-4 text-neutral-400" />
                                }
                            </button>
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? 'max-h-[600px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                                <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-6">
                                    <nav className="space-y-1">
                                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-3 mb-2">View</h3>
                                        <button
                                            onClick={() => { setSelectedCategory(null); setShowSavedOnly(false); setSidebarOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${!selectedCategory && !showSavedOnly ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                        >
                                            <Layers className="w-4 h-4" /> All Models
                                        </button>
                                        <button
                                            onClick={() => { if (!user) { handleSignIn(); return; } setSelectedCategory(null); setShowSavedOnly(true); setSidebarOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${showSavedOnly ? 'bg-rose-50 text-rose-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                        >
                                            <Heart className={`w-4 h-4 ${showSavedOnly ? 'fill-current' : ''}`} />
                                            Saved ({likes.size})
                                        </button>
                                    </nav>
                                    {allCategories.length > 0 && (
                                        <nav className="space-y-1">
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-3 mb-2">Categories</h3>
                                            {allCategories.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => { setSelectedCategory(cat); setShowSavedOnly(false); setSidebarOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${selectedCategory === cat ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                                >
                                                    <Hash className="w-3.5 h-3.5 opacity-40" /> {cat}
                                                </button>
                                            ))}
                                        </nav>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* ── Desktop Sidebar ──────────────────────────────────── */}
                    <aside className="hidden lg:block lg:col-span-2 space-y-6">
                        <nav className="space-y-1">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-3 mb-2">View</h3>
                            <button
                                id="view-all-btn"
                                onClick={() => { setSelectedCategory(null); setShowSavedOnly(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${!selectedCategory && !showSavedOnly ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                            >
                                <Layers className="w-4 h-4" /> All Models
                            </button>
                            <button
                                id="view-saved-btn"
                                onClick={() => {
                                    if (!user) { handleSignIn(); return; }
                                    setSelectedCategory(null);
                                    setShowSavedOnly(true);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${showSavedOnly ? 'bg-rose-50 text-rose-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                            >
                                <Heart className={`w-4 h-4 ${showSavedOnly ? 'fill-current' : ''}`} />
                                Saved ({likes.size})
                            </button>
                        </nav>

                        {allCategories.length > 0 && (
                            <nav className="space-y-1">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-3 mb-2">Categories</h3>
                                {allCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => { setSelectedCategory(cat); setShowSavedOnly(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${selectedCategory === cat ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                    >
                                        <Hash className="w-3.5 h-3.5 opacity-40" /> {cat}
                                    </button>
                                ))}
                            </nav>
                        )}
                    </aside>

                    {/* Model Cards */}
                    <section className={`transition-all duration-300 ${selectedModel ? 'lg:col-span-4' : 'lg:col-span-10'}`}>
                        {loading ? (
                            <div className={`grid gap-4 ${selectedModel ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        ) : filteredModels.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Search className="w-5 h-5 text-neutral-400" />
                                </div>
                                <p className="font-semibold text-neutral-700">No models found</p>
                                <p className="text-sm text-neutral-400 mt-1">
                                    {showSavedOnly ? 'Save some models first' : 'Try a different search or category'}
                                </p>
                            </div>
                        ) : (
                            <div className={`grid gap-4 ${selectedModel ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                                {filteredModels.map(model => (
                                    <div
                                        key={model.id}
                                        id={`card-${model.id}`}
                                        onClick={() => setSelectedId(model.id)}
                                        className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 ${selectedId === model.id
                                            ? 'bg-indigo-900 border-indigo-900 shadow-xl'
                                            : 'bg-white border-neutral-200 hover:border-indigo-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedId === model.id ? 'bg-indigo-800 text-indigo-200' : getCategoryStyle(model.categories[0] || '')
                                                }`}>
                                                {model.categories[0] || 'Uncategorized'}
                                            </span>
                                            <button
                                                id={`like-${model.id}`}
                                                onClick={(e) => toggleLike(e, model.id)}
                                                className="p-0.5 rounded-full"
                                                aria-label={likes.has(model.id) ? 'Remove from saved' : 'Save'}
                                                title={!user ? 'Sign in to save' : undefined}
                                            >
                                                <Heart className={`w-4 h-4 transition-colors ${likes.has(model.id) ? 'text-rose-500 fill-current' : selectedId === model.id ? 'text-indigo-400' : 'text-neutral-300 hover:text-rose-400'
                                                    }`} />
                                            </button>
                                        </div>
                                        <h2 className={`font-bold mb-2 ${selectedId === model.id ? 'text-white' : 'text-neutral-900'}`}>
                                            {model.title}
                                        </h2>
                                        <p className={`text-xs leading-relaxed line-clamp-2 ${selectedId === model.id ? 'text-indigo-200' : 'text-neutral-500'}`}>
                                            {model.definition}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ── Desktop Detail Panel ─────────────────────────────── */}
                    {selectedModel && (
                        <aside className="hidden lg:block lg:col-span-6" id="detail-panel">
                            <div className="bg-white border border-neutral-200 rounded-2xl p-8 sticky top-24 shadow-2xl shadow-neutral-200/60 max-h-[calc(100vh-7rem)] overflow-y-auto">
                                <button
                                    id="close-detail-btn"
                                    onClick={() => setSelectedId(null)}
                                    className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-900 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Categories */}
                                <div className="flex flex-wrap gap-2 mb-6 pr-10">
                                    {selectedModel.categories.map(cat => (
                                        <span key={cat} className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getCategoryStyle(cat)}`}>{cat}</span>
                                    ))}
                                </div>

                                <h2 className="text-3xl font-black text-neutral-900 mb-6">{selectedModel.title}</h2>

                                <div className="space-y-8">
                                    {/* Definition */}
                                    {selectedModel.definition && (
                                        <div>
                                            <SectionHeading icon={<BookOpen className="w-3 h-3" />} color="text-indigo-600" label="Definition" />
                                            <p className="text-neutral-800 text-lg leading-relaxed">{selectedModel.definition}</p>
                                        </div>
                                    )}

                                    {/* Key Insight */}
                                    {selectedModel.insight && (
                                        <div>
                                            <SectionHeading icon={<Lightbulb className="w-3 h-3" />} color="text-emerald-600" label="Key Insight" />
                                            <p className="text-neutral-600 leading-relaxed">{selectedModel.insight}</p>
                                        </div>
                                    )}

                                    {/* How to Apply */}
                                    {selectedModel.application && (
                                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                                            <SectionHeading icon={<Layers className="w-3 h-3" />} color="text-amber-800" label="How to Apply" />
                                            <MarkdownText text={selectedModel.application} className="text-sm text-amber-900/80" />
                                        </div>
                                    )}

                                    {/* Real-World Example */}
                                    {selectedModel.example && (
                                        <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                                            <SectionHeading icon={<Globe className="w-3 h-3" />} color="text-sky-800" label="Real-World Example" />
                                            <p className="text-sm text-sky-900/80 leading-relaxed whitespace-pre-line">{selectedModel.example}</p>
                                        </div>
                                    )}

                                    {/* Common Pitfalls */}
                                    {selectedModel.pitfalls && (
                                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                                            <SectionHeading icon={<AlertTriangle className="w-3 h-3" />} color="text-rose-700" label="Common Pitfalls" />
                                            <MarkdownText text={selectedModel.pitfalls} className="text-sm text-rose-900/80" />
                                        </div>
                                    )}

                                    {/* Related Models */}
                                    {selectedModel.related && selectedModel.related.length > 0 && (
                                        <div>
                                            <SectionHeading icon={<Network className="w-3 h-3" />} color="text-purple-600" label="Related Models" />
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {selectedModel.related.map(relId => {
                                                    const rel = findRelated(relId);
                                                    return rel ? (
                                                        <button
                                                            key={relId}
                                                            id={`related-${relId}`}
                                                            onClick={() => setSelectedId(relId)}
                                                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                                                        >
                                                            {rel.title} <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    ) : (
                                                        <span key={relId} className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-500">
                                                            {relId}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </main>

            {/* ── Mobile Bottom Sheet ──────────────────────────────────────── */}
            {selectedModel && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
                        onClick={() => setSelectedId(null)}
                        aria-hidden="true"
                    />
                    {/* Sheet */}
                    <div
                        id="mobile-detail-sheet"
                        className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-2xl"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                            <div className="w-10 h-1 bg-neutral-200 rounded-full" />
                        </div>
                        <div className="overflow-y-auto px-6 pb-8 pt-2" style={{ maxHeight: 'calc(90vh - 24px)' }}>
                            <div className="relative">
                                <button
                                    id="close-detail-btn-mobile"
                                    onClick={() => setSelectedId(null)}
                                    className="absolute top-0 right-0 p-2 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-900 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex flex-wrap gap-2 mb-4 pr-10">
                                    {selectedModel.categories.map(cat => (
                                        <span key={cat} className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getCategoryStyle(cat)}`}>{cat}</span>
                                    ))}
                                </div>

                                <h2 className="text-2xl font-black text-neutral-900 mb-5">{selectedModel.title}</h2>

                                <div className="space-y-6">
                                    {selectedModel.definition && (
                                        <div>
                                            <SectionHeading icon={<BookOpen className="w-3 h-3" />} color="text-indigo-600" label="Definition" />
                                            <p className="text-neutral-800 leading-relaxed">{selectedModel.definition}</p>
                                        </div>
                                    )}
                                    {selectedModel.insight && (
                                        <div>
                                            <SectionHeading icon={<Lightbulb className="w-3 h-3" />} color="text-emerald-600" label="Key Insight" />
                                            <p className="text-neutral-600 leading-relaxed">{selectedModel.insight}</p>
                                        </div>
                                    )}
                                    {selectedModel.application && (
                                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                                            <SectionHeading icon={<Layers className="w-3 h-3" />} color="text-amber-800" label="How to Apply" />
                                            <MarkdownText text={selectedModel.application} className="text-sm text-amber-900/80" />
                                        </div>
                                    )}
                                    {selectedModel.example && (
                                        <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl">
                                            <SectionHeading icon={<Globe className="w-3 h-3" />} color="text-sky-800" label="Real-World Example" />
                                            <p className="text-sm text-sky-900/80 leading-relaxed whitespace-pre-line">{selectedModel.example}</p>
                                        </div>
                                    )}
                                    {selectedModel.pitfalls && (
                                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                                            <SectionHeading icon={<AlertTriangle className="w-3 h-3" />} color="text-rose-700" label="Common Pitfalls" />
                                            <MarkdownText text={selectedModel.pitfalls} className="text-sm text-rose-900/80" />
                                        </div>
                                    )}
                                    {selectedModel.related && selectedModel.related.length > 0 && (
                                        <div>
                                            <SectionHeading icon={<Network className="w-3 h-3" />} color="text-purple-600" label="Related Models" />
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {selectedModel.related.map(relId => {
                                                    const rel = findRelated(relId);
                                                    return rel ? (
                                                        <button
                                                            key={relId}
                                                            onClick={() => setSelectedId(relId)}
                                                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                                                        >
                                                            {rel.title} <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    ) : (
                                                        <span key={relId} className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-500">{relId}</span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function SectionHeading({ icon, color, label }) {
    return (
        <h4 className={`text-[10px] font-black uppercase tracking-tighter mb-2 flex items-center gap-1 ${color}`}>
            {icon} {label}
        </h4>
    );
}

/**
 * Renders markdown-ish bullet lists.
 * Lines starting with "- " become <li> items; everything else is a <p>.
 */
function MarkdownText({ text, className }) {
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={elements.length} className={`list-disc list-inside space-y-0.5 ${className}`}>
                    {listItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            );
            listItems = [];
        }
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
            listItems.push(trimmed.slice(2));
        } else {
            flushList();
            if (trimmed) {
                elements.push(<p key={i} className={`leading-relaxed ${className}`}>{trimmed}</p>);
            }
        }
    });
    flushList();

    return <div className="space-y-2">{elements}</div>;
}
