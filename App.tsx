import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Camera, Shirt, Calendar as CalendarIcon, Shuffle, Trash2, 
  Plus, Search, Filter, Lock, Unlock, Check, X, RotateCcw, 
  MoreVertical, Upload, Save, AlertTriangle, Wand2, Loader2, Info, Share, Menu, Sparkles, Pencil,
  Cloud, CloudOff, LogOut, Settings, User as UserIcon, LogIn, ChevronRight
} from 'lucide-react';
import { 
  ClothingItem, CategoryL1, Season, DEFAULT_CATEGORIES, 
  CategoryStructure, COLORS, FilterState, Outfit 
} from './types';
import { analyzeClothingImage, removeBackground } from './services/geminiService';
import { 
    isFirebaseReady, getStoredFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig,
    subscribeToAuth, loginWithGoogle, loginWithEmail, logout,
    subscribeToItems, addItemToCloud, updateItemInCloud, syncLocalToCloud, isHardcodedConfig
} from './services/firebase';
import EraserTool from './components/EraserTool';

// --- STYLING HELPERS ---

const getRandomCardStyle = (id: string) => {
  const colors = [
    'bg-brand-orange', 
    'bg-brand-yellow', 
    'bg-brand-red', 
    'bg-brand-blue', 
    'bg-brand-green',
    'bg-paper-warm'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  const rot = Math.abs(hash) % 4; 
  const rotation = rot === 0 ? 'rotate-1' : rot === 1 ? '-rotate-1' : rot === 2 ? 'rotate-2' : '-rotate-2';
  return { color, rotation };
};

// --- SETTINGS / LOGIN COMPONENTS ---

const CloudSetupView: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
    const [configInput, setConfigInput] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        try {
            const config = JSON.parse(configInput);
            if (!config.apiKey || !config.projectId) throw new Error("Invalid Config Object");
            saveFirebaseConfig(config);
        } catch (e) {
            setError("Invalid JSON. Please copy the full config object from Firebase Console.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-bounce-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black">☁️ Connect Cloud</h2>
                    <button onClick={onCancel}><X size={24} /></button>
                </div>
                <textarea 
                    value={configInput}
                    onChange={(e) => setConfigInput(e.target.value)}
                    placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
                    className="w-full h-32 bg-gray-50 rounded-xl p-3 text-xs font-mono border border-gray-200 focus:border-brand-blue focus:outline-none mb-2"
                />
                {error && <p className="text-red-500 text-xs font-bold mb-2">{error}</p>}
                <button onClick={handleSave} className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg">
                    Connect & Reload
                </button>
            </div>
        </div>
    );
};

const ProfileView: React.FC<{ 
    user: any, 
    onClose: () => void, 
    itemCount: number,
    onSync: () => void
}> = ({ user, onClose, itemCount, onSync }) => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [isSignUp, setIsSignUp] = useState(false); // Default to login
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isCloudConfigured = isFirebaseReady();
    const isHardcoded = isHardcodedConfig();
    const [showConfig, setShowConfig] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await loginWithEmail(email, pass, isSignUp);
            onClose();
        } catch (e: any) {
            let msg = e.message;
            if (msg.includes('auth/invalid-credential')) msg = "Incorrect email or password.";
            if (msg.includes('auth/email-already-in-use')) msg = "Email already registered.";
            if (msg.includes('auth/weak-password')) msg = "Password should be at least 6 characters.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true); setError('');
        try {
            await loginWithGoogle();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    if (showConfig) return <CloudSetupView onCancel={() => setShowConfig(false)} />;

    return (
        <div className="fixed inset-0 z-50 bg-paper-warm flex flex-col items-center justify-center p-6 animate-fade-in">
             <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-sm"><X size={24}/></button>
             
             <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-brand-yellow rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-xl mb-4 relative">
                        {user ? (
                            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} className="w-full h-full rounded-full" />
                        ) : (
                            <UserIcon size={40} className="text-white" />
                        )}
                        {user && <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <h2 className="text-3xl font-black text-gray-900">{user ? 'Welcome Back!' : 'Get Started'}</h2>
                    <p className="text-gray-500 font-medium mt-1">
                        {user ? user.email : 'Create an account to save your closet forever.'}
                    </p>
                </div>

                {user ? (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <span className="font-bold text-gray-600">Total Items</span>
                            <span className="bg-gray-100 px-3 py-1 rounded-lg font-black">{itemCount}</span>
                        </div>
                        
                        <div className="bg-brand-blue/10 p-4 rounded-2xl border border-brand-blue/20">
                            <h4 className="font-bold text-brand-blue text-sm mb-1 flex items-center gap-2"><Info size={16}/> Sync Data</h4>
                            <p className="text-xs text-brand-blue/80 mb-3">
                                Have items you added while logged out? Move them to your account.
                            </p>
                            <button onClick={onSync} className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2">
                                <Upload size={18} /> Sync Guest Items
                            </button>
                        </div>

                        <button onClick={() => logout()} className="w-full py-4 bg-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-300">
                            <LogOut size={20} /> Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {!isCloudConfigured ? (
                             <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-brand-orange border-dashed text-center">
                                <CloudOff size={48} className="mx-auto text-brand-orange mb-3" />
                                <h3 className="font-bold text-lg mb-2">Cloud Not Connected</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    {isHardcoded ? "Config is incomplete or failed to load." : "Connect to Firebase to share with friends and never lose your data."}
                                </p>
                             </div>
                        ) : (
                            <>
                                <div className="flex bg-gray-200 p-1 rounded-2xl mb-6">
                                    <button 
                                        onClick={() => setIsSignUp(false)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${!isSignUp ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                    >
                                        Log In
                                    </button>
                                    <button 
                                        onClick={() => setIsSignUp(true)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${isSignUp ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                                    >
                                        Sign Up
                                    </button>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-3">
                                    <input 
                                        type="email" placeholder="Email" required
                                        className="w-full p-4 bg-white rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-blue outline-none"
                                        value={email} onChange={e => setEmail(e.target.value)}
                                    />
                                    <input 
                                        type="password" placeholder="Password" required
                                        className="w-full p-4 bg-white rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-blue outline-none"
                                        value={pass} onChange={e => setPass(e.target.value)}
                                    />
                                    {error && <p className="text-red-500 text-xs font-bold px-2">{error}</p>}
                                    <button type="submit" disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl hover:bg-black transition-colors">
                                        {loading ? <Loader2 className="animate-spin mx-auto"/> : (isSignUp ? 'Create Account' : 'Log In')}
                                    </button>
                                </form>

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="flex-shrink mx-4 text-gray-400 text-xs font-bold uppercase">Or</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>

                                <button onClick={handleGoogle} disabled={loading} className="w-full py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50">
                                     <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                     Continue with Google
                                </button>
                            </>
                        )}
                    </div>
                )}
             </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'closet' | 'add' | 'shuffle' | 'calendar' | 'trash'>('closet');
  const [showProfile, setShowProfile] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data State
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [categories, setCategories] = useState<CategoryStructure>(DEFAULT_CATEGORIES);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  
  // Persistence Safety: Prevents overwriting local storage with empty arrays on initial load
  const [dataLoaded, setDataLoaded] = useState(false);

  // --- DATA LOADING LOGIC ---

  // 1. Auth Listener
  useEffect(() => {
      const unsub = subscribeToAuth((u) => {
          setUser(u);
          setAuthLoading(false);
      });
      return () => unsub();
  }, []);

  // 2. Data Subscription (Cloud vs Local)
  useEffect(() => {
    // DO NOTHING until auth is settled. This prevents the "flash" of empty state.
    if (authLoading) return;

    if (user && isFirebaseReady()) {
        // --- CLOUD MODE ---
        const unsubItems = subscribeToItems(user.uid, (cloudItems) => {
            setItems(cloudItems);
            setDataLoaded(true); // Cloud data is authoritative
        });
        // Note: Outfits/Categories still local for now to keep MVP simple, 
        // but could be expanded to cloud similarly.
        return () => {
            unsubItems();
        }
    } else {
        // --- LOCAL GUEST MODE ---
        try {
            const loadedItems = localStorage.getItem('smartCloset_items');
            const loadedOutfits = localStorage.getItem('smartCloset_outfits');
            const loadedCats = localStorage.getItem('smartCloset_categories');
            
            // Only set if exists, otherwise keep defaults (which are empty arrays)
            if (loadedItems) setItems(JSON.parse(loadedItems));
            if (loadedOutfits) setOutfits(JSON.parse(loadedOutfits));
            if (loadedCats) setCategories(JSON.parse(loadedCats));
        } catch(e) {
            console.error("Failed to load local storage", e);
        } finally {
            // Signal that we have finished reading from local storage.
            // Even if storage was empty, we are "loaded" (with empty arrays).
            setDataLoaded(true);
        }
    }
  }, [user, authLoading]);

  // 3. Save to LocalStorage (Only if Guest AND data has been loaded)
  useEffect(() => {
    // CRITICAL: Prevent saving empty state over existing data during boot-up.
    if (!dataLoaded) return;

    // Only save to localStorage if we are in Guest Mode
    if (!user) {
        localStorage.setItem('smartCloset_items', JSON.stringify(items));
        localStorage.setItem('smartCloset_outfits', JSON.stringify(outfits));
        localStorage.setItem('smartCloset_categories', JSON.stringify(categories));
    }
  }, [items, outfits, categories, user, dataLoaded]);

  // --- ACTIONS ---
  
  const handleAddItem = async (item: ClothingItem) => {
    if (user && isFirebaseReady()) {
        await addItemToCloud(user.uid, item);
    } else {
        setItems(prev => [item, ...prev]);
    }
    setActiveTab('closet');
  };

  const handleUpdateItem = async (id: string, updates: Partial<ClothingItem>) => {
    if (user && isFirebaseReady()) {
        await updateItemInCloud(user.uid, id, updates);
    } else {
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }
    setEditingItem(null);
    setActiveTab('closet');
  };

  const deleteItem = (id: string) => {
    handleUpdateItem(id, { isDeleted: true, trashDate: Date.now() });
  };

  const restoreItem = (id: string) => {
    handleUpdateItem(id, { isDeleted: false, trashDate: undefined });
  };

  const permanentlyDelete = (id: string) => {
      if (!user) setItems(prev => prev.filter(i => i.id !== id));
      else handleUpdateItem(id, { isDeleted: true }); // Keep soft delete in cloud for now
  };

  const handleSync = async () => {
      if (!user) return;
      const localString = localStorage.getItem('smartCloset_items');
      if (localString) {
          const localItems = JSON.parse(localString);
          if (localItems.length === 0) {
              alert("No guest items found to sync.");
              return;
          }
          if (confirm(`Found ${localItems.length} items in guest storage. Upload them to your account?`)) {
              await syncLocalToCloud(user.uid, localItems);
              // Optional: Clear local after sync? For safety, maybe keep it but user can clear cache if they want.
              alert("Sync Complete! Your guest items are now in the cloud.");
          }
      } else {
          alert("No local items to sync.");
      }
  };

  // --- VIEWS ---

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden relative font-sans">
      
      {/* HEADER */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 pt-safe mt-4 flex justify-between items-center pointer-events-none">
        <div className="pointer-events-auto">
             <h1 className="text-3xl font-black tracking-tight text-gray-900 drop-shadow-sm flex items-center gap-2">
                {activeTab === 'closet' && 'My Closet'}
                {activeTab === 'add' && (editingItem ? 'Edit Item' : 'New Drop')}
                {activeTab === 'shuffle' && 'Mix & Match'}
                {activeTab === 'calendar' && 'OOTD'}
                {activeTab === 'trash' && 'Recycle'}
                {user && activeTab === 'closet' && <span className="text-xs bg-brand-blue text-white px-2 py-0.5 rounded-full font-bold shadow-sm">CLOUD</span>}
            </h1>
            <div className="h-1 w-12 bg-brand-orange rounded-full mt-1"></div>
        </div>
        
        {activeTab === 'add' ? (
           <button 
            onClick={() => { setActiveTab('closet'); setEditingItem(null); }}
            className="pointer-events-auto bg-white/80 backdrop-blur p-2 rounded-full shadow-lg border border-white/50 text-gray-900 hover:scale-110 transition-all"
           >
            <X size={24} />
           </button>
        ) : (
          <button 
            onClick={() => setShowProfile(true)}
            className={`pointer-events-auto backdrop-blur pl-2 pr-1 py-1 rounded-full shadow-lg border border-white/50 hover:scale-105 transition-all flex items-center gap-2 ${user ? 'bg-white/90' : 'bg-gray-900 text-white'}`}
          >
            {user ? (
                 <>
                    <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`} 
                        className="w-8 h-8 rounded-full border border-gray-200"
                        alt="Profile"
                    />
                 </>
            ) : (
                <>
                    <span className="text-xs font-bold pl-2">Login</span>
                    <div className="bg-white/20 p-1.5 rounded-full">
                        <UserIcon size={16} className="text-white" />
                    </div>
                </>
            )}
          </button>
        )}
      </header>

      {/* PROFILE / LOGIN MODAL */}
      {showProfile && (
          <ProfileView 
            user={user} 
            onClose={() => setShowProfile(false)} 
            itemCount={items.length} 
            onSync={handleSync}
          />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative pt-24 pb-32 px-2">
        {activeTab === 'closet' && (
            <ClosetView 
                items={items} 
                deleteItem={deleteItem} 
                editItem={(i) => { setEditingItem(i); setActiveTab('add'); }} 
                categories={categories} 
            />
        )}
        {activeTab === 'add' && (
          <AddView 
            categories={categories} 
            onAdd={handleAddItem} 
            onUpdate={handleUpdateItem}
            onAddCategory={(l1, l2) => setCategories(p => ({...p, [l1]: [...p[l1], l2]}))} 
            initialItem={editingItem}
          />
        )}
        {activeTab === 'shuffle' && <ShuffleView items={items} onSave={(o) => setOutfits(p => [o, ...p])} />}
        {activeTab === 'calendar' && <CalendarView outfits={outfits} items={items} />}
        {activeTab === 'trash' && <TrashView items={items} onRestore={restoreItem} onPermanentDelete={permanentlyDelete} />}
      </main>

      {/* BOTTOM NAVIGATION - Floating Dock - Only show when NOT adding/editing */}
      {activeTab !== 'add' && (
      <nav className="fixed bottom-6 left-4 right-4 z-40 pb-safe pointer-events-none">
        <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-2 flex justify-between items-center max-w-md mx-auto relative">
          
          <NavButton icon={Shirt} label="Closet" active={activeTab === 'closet'} onClick={() => setActiveTab('closet')} />
          <NavButton icon={Shuffle} label="Shuffle" active={activeTab === 'shuffle'} onClick={() => setActiveTab('shuffle')} />
          
          {/* Main Action Button (Floating above dock) */}
          <div className="relative -top-8 mx-2">
             <button 
                onClick={() => { setEditingItem(null); setActiveTab('add'); }}
                className="bg-gray-900 text-white w-16 h-16 rounded-full shadow-2xl shadow-gray-900/40 flex items-center justify-center transform transition-all hover:scale-110 active:scale-90 border-4 border-white/20"
             >
                <Plus size={32} strokeWidth={3} />
             </button>
          </div>
          
          <NavButton icon={CalendarIcon} label="OOTD" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
          <NavButton icon={Trash2} label="Trash" active={activeTab === 'trash'} onClick={() => setActiveTab('trash')} />
        </div>
      </nav>
      )}
    </div>
  );
};

// --- SUB-VIEWS ---

// 1. CLOSET VIEW - Collage Style
const ClosetView: React.FC<{ items: ClothingItem[], deleteItem: (id: string) => void, editItem: (item: ClothingItem) => void, categories: CategoryStructure }> = ({ items, deleteItem, editItem, categories }) => {
  const [filter, setFilter] = useState<FilterState>({
    categoryL1: 'All',
    season: 'All',
    color: 'All',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (item.isDeleted) return false;
      if (filter.categoryL1 !== 'All' && item.categoryL1 !== filter.categoryL1) return false;
      if (filter.season !== 'All' && item.season !== filter.season && item.season !== Season.ALL) return false;
      if (filter.color !== 'All' && item.color !== filter.color) return false;
      if (filter.search && !item.categoryL2.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter]);

  return (
    <div className="px-2">
      {/* SEARCH & FILTER */}
      <div className="flex gap-3 mb-6 sticky top-0 z-10 pt-2 pb-4 px-2 -mx-2 bg-gradient-to-b from-[#f7f7f7] to-transparent">
        <div className="relative flex-1 group">
          <div className="absolute inset-0 bg-white rounded-2xl shadow-sm transform transition-transform group-hover:scale-[1.02]"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Find something..." 
            className="relative w-full pl-12 pr-4 py-3 bg-transparent rounded-2xl font-medium focus:outline-none text-gray-800 placeholder-gray-400"
            value={filter.search}
            onChange={e => setFilter(prev => ({...prev, search: e.target.value}))}
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`relative px-4 rounded-2xl shadow-sm font-bold transition-all border-2 border-transparent active:scale-95 flex items-center justify-center ${
            showFilters ? 'bg-brand-orange text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={20} />
        </button>
      </div>

      {/* FILTER PANEL (Collapsible) */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${showFilters ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white shadow-sm space-y-5">
            {[
                { label: 'Category', options: ['All', ...Object.values(CategoryL1)], current: filter.categoryL1, setter: (v: any) => setFilter(p => ({...p, categoryL1: v})) },
                { label: 'Season', options: ['All', Season.WARM, Season.COLD], current: filter.season, setter: (v: any) => setFilter(p => ({...p, season: v})) },
                { label: 'Color', options: ['All', ...COLORS], current: filter.color, setter: (v: any) => setFilter(p => ({...p, color: v})) }
            ].map((group, idx) => (
                <div key={idx}>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{group.label}</h4>
                    <div className="flex flex-wrap gap-2">
                        {group.options.map((opt: any) => (
                            <FilterChip 
                                key={opt} 
                                label={opt === Season.WARM ? 'Warm' : opt === Season.COLD ? 'Cold' : opt} 
                                selected={group.current === opt} 
                                color={group.label === 'Color' && opt !== 'All' ? opt : undefined}
                                onClick={() => group.setter(opt)} 
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* GRID (Masonry-ish feel with random rotations) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-1 pb-24">
        {filteredItems.map((item, index) => (
          <StickerCard 
            key={item.id} 
            item={item} 
            onDelete={() => deleteItem(item.id)} 
            onEdit={() => editItem(item)}
            index={index}
          />
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
             <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                 <Shirt size={40} className="text-gray-400" />
             </div>
             <p className="font-bold text-gray-400">Your closet is empty.</p>
             <p className="text-sm text-gray-400 mt-1">Tap + to add some drip.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. ADD VIEW - Creative Studio Feel
const AddView: React.FC<{ 
  categories: CategoryStructure, 
  onAdd: (item: ClothingItem) => Promise<void> | void,
  onUpdate: (id: string, item: Partial<ClothingItem>) => Promise<void> | void,
  onAddCategory: (l1: CategoryL1, l2: string) => void,
  initialItem?: ClothingItem | null
}> = ({ categories, onAdd, onUpdate, onAddCategory, initialItem }) => {
  const [image, setImage] = useState<string | null>(initialItem?.imageData || null);
  const [analyzingTags, setAnalyzingTags] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [showEraser, setShowEraser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [categoryL1, setCategoryL1] = useState<CategoryL1>(initialItem?.categoryL1 || CategoryL1.TOP);
  const [categoryL2, setCategoryL2] = useState<string>(initialItem?.categoryL2 || '');
  const [customL2, setCustomL2] = useState('');
  const [isAddingL2, setIsAddingL2] = useState(false);
  const [color, setColor] = useState<string>(initialItem?.color || COLORS[0]);
  const [season, setSeason] = useState<Season>(initialItem?.season || Season.ALL);

  // Sync state with initialItem if it changes (e.g. clicking edit from another tab)
  useEffect(() => {
    if (initialItem) {
        setImage(initialItem.imageData);
        setCategoryL1(initialItem.categoryL1);
        setCategoryL2(initialItem.categoryL2);
        setColor(initialItem.color);
        setSeason(initialItem.season);
        setCustomL2('');
        setIsAddingL2(false);
    } else {
        // Reset defaults if in 'Add New' mode
        setImage(null);
        setCategoryL1(CategoryL1.TOP);
        setCategoryL2('');
        setColor(COLORS[0]);
        setSeason(Season.ALL);
    }
  }, [initialItem]);

  // Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) handleImageSelected(event.target.result as string);
          };
          if (blob) reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageSelected = async (base64: string) => {
    setImage(base64);
    setAnalyzingTags(true);
    setRemovingBg(true);

    analyzeClothingImage(base64).then(tags => {
        if (tags) {
            if (Object.values(CategoryL1).includes(tags.categoryL1 as any)) setCategoryL1(tags.categoryL1 as CategoryL1);
            setCategoryL2(tags.categoryL2 || ''); 
            if (COLORS.includes(tags.color)) setColor(tags.color);
            if (Object.values(Season).includes(tags.season as any)) setSeason(tags.season as Season);
        }
        setAnalyzingTags(false);
    });

    removeBackground(base64).then(newImageBytes => {
        if (newImageBytes) setImage(`data:image/png;base64,${newImageBytes}`);
        setRemovingBg(false);
    });
  };

  const handleManualBgRemoval = async () => {
    if (!image) return;
    setRemovingBg(true);
    const newImageBytes = await removeBackground(image);
    if (newImageBytes) setImage(`data:image/png;base64,${newImageBytes}`);
    setRemovingBg(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleImageSelected(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!image) return;
    setIsSaving(true);
    let finalL2 = categoryL2;
    if (isAddingL2 && customL2.trim()) {
      onAddCategory(categoryL1, customL2.trim());
      finalL2 = customL2.trim();
    } else if (!finalL2 && categories[categoryL1].length > 0) {
        finalL2 = categories[categoryL1][0];
    }

    if (initialItem) {
        // UPDATE MODE
        await onUpdate(initialItem.id, {
            imageData: image,
            categoryL1,
            categoryL2: finalL2,
            color,
            season
        });
    } else {
        // CREATE MODE
        const newItem: ClothingItem = {
            id: Date.now().toString(),
            imageData: image,
            categoryL1,
            categoryL2: finalL2,
            color,
            season,
            createdAt: Date.now(),
            isDeleted: false
        };
        await onAdd(newItem);
    }
    setIsSaving(false);
  };

  if (showEraser && image) {
    return <EraserTool 
      imageSrc={image} 
      onSave={(newImg) => { setImage(newImg); setShowEraser(false); }} 
      onCancel={() => setShowEraser(false)} 
    />;
  }

  return (
    <div className="flex flex-col items-center px-4 pb-32">
      {/* PREVIEW CARD */}
      <div className="w-full aspect-[4/5] max-h-[400px] bg-white rounded-3xl shadow-xl border-4 border-white relative overflow-hidden group transition-all transform hover:scale-[1.01]">
        <div className="absolute inset-0 texture-speckle opacity-50 pointer-events-none"></div>
        
        {image ? (
          <>
            <img src={image} className="h-full w-full object-contain p-8 sticker-effect z-10 relative" alt="Preview" />
            
            <button 
                onClick={() => setImage(null)}
                className="absolute top-4 right-4 z-20 bg-white p-2 rounded-full shadow-lg text-red-500 hover:scale-110 transition-transform"
            >
                <Trash2 size={20} />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-3 bg-black/80 backdrop-blur-md p-1.5 rounded-full pl-2">
               <button 
                  onClick={handleManualBgRemoval}
                  disabled={removingBg}
                  className={`p-2 rounded-full ${removingBg ? 'text-gray-500' : 'text-brand-yellow hover:text-white'}`}
                >
                  {removingBg ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                </button>
                <div className="w-px bg-white/20 my-1"></div>
                <button 
                  onClick={() => setShowEraser(true)}
                  className="p-2 rounded-full text-white hover:text-brand-blue pr-3"
                >
                  <EraserToolIcon />
                </button>
            </div>
            
            {analyzingTags && (
                <div className="absolute top-4 left-4 z-20 bg-brand-blue text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
                    <Loader2 size={12} className="animate-spin"/> AI Tagging
                </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4 animate-float">
              <Camera className="text-gray-400" size={32} />
            </div>
            <p className="font-bold text-lg text-gray-500">Add New Drop</p>
            <p className="text-xs mt-2 opacity-60">Photo / Upload / Paste</p>
            <input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {/* FORM */}
      {image && (
        <div className="w-full mt-8 space-y-6 animate-fade-in-up">
          
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
             <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Category</h4>
             <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {Object.values(CategoryL1).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryL1(cat); setCategoryL2(''); setIsAddingL2(false); }}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                    categoryL1 === cat ? 'bg-black text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
             <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Type</h4>
             <div className="flex flex-wrap gap-2">
              {categories[categoryL1].map(sub => (
                <button
                  key={sub}
                  onClick={() => { setCategoryL2(sub); setIsAddingL2(false); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    categoryL2 === sub && !isAddingL2 ? 'bg-brand-blue text-white shadow-md rotate-1' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {sub}
                </button>
              ))}
              <button 
                onClick={() => setIsAddingL2(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 text-gray-400 flex items-center gap-1 hover:border-brand-blue hover:text-brand-blue ${isAddingL2 ? 'border-brand-blue text-brand-blue bg-blue-50' : ''}`}
              >
                <Plus size={14} /> Custom
              </button>
            </div>
            {isAddingL2 && (
              <input
                type="text"
                value={customL2}
                onChange={(e) => setCustomL2(e.target.value)}
                placeholder="Ex: Varsity Jacket..."
                className="mt-3 w-full p-3 bg-gray-50 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue"
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Season</h4>
                <div className="flex flex-col gap-2">
                    {Object.values(Season).map(s => (
                        <button
                        key={s}
                        onClick={() => setSeason(s)}
                        className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                            season === s 
                            ? (s === Season.WARM ? 'bg-brand-orange text-white' : s === Season.COLD ? 'bg-brand-blue text-white' : 'bg-gray-800 text-white') 
                            : 'bg-gray-100 text-gray-500'
                        }`}
                        >
                        {s.split(' ')[0]}
                        </button>
                    ))}
                </div>
             </div>

             <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Color</h4>
                <div className="grid grid-cols-4 gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-full aspect-square rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c.toLowerCase() }}
                        />
                    ))}
                </div>
             </div>
          </div>

          <div className="fixed bottom-6 left-4 right-4 z-50 pb-safe">
              <button
                onClick={handleSave}
                disabled={(isAddingL2 && !customL2.trim()) || isSaving}
                className="w-full py-4 bg-gray-900 text-white rounded-3xl font-black text-lg shadow-2xl shadow-gray-900/40 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <><Check size={24} /> {initialItem ? 'SAVE CHANGES' : 'ADD TO CLOSET'}</>}
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. SHUFFLE VIEW - Mood Board Style
const ShuffleView: React.FC<{ items: ClothingItem[], onSave: (outfit: Outfit) => void }> = ({ items, onSave }) => {
  const [locked, setLocked] = useState<Record<string, string | null>>({
    [CategoryL1.TOP]: null,
    [CategoryL1.BOTTOM]: null,
    [CategoryL1.SHOES]: null,
    [CategoryL1.DRESS]: null
  });
  
  const [mode, setMode] = useState<'Standard' | 'OnePiece'>('Standard');
  const [currentOutfit, setCurrentOutfit] = useState<Record<string, ClothingItem | null>>({});
  const [isShuffling, setIsShuffling] = useState(false);

  const getValidItems = useCallback((cat: CategoryL1, excludeSeason?: Season) => {
    return items.filter(i => {
      if (i.isDeleted || i.categoryL1 !== cat) return false;
      if (excludeSeason) {
         if (excludeSeason === Season.COLD && i.season === Season.COLD) return false;
         if (excludeSeason === Season.WARM && i.season === Season.WARM) return false;
      }
      return true;
    });
  }, [items]);

  const shuffle = useCallback(() => {
    setIsShuffling(true);
    setTimeout(() => setIsShuffling(false), 500); // Animation timer

    const newOutfit: Record<string, ClothingItem | null> = { ...currentOutfit };
    let primarySeason: Season | null = null;

    Object.entries(locked).forEach(([cat, itemId]) => {
      if (itemId) {
        const item = items.find(i => i.id === itemId);
        if (item) {
          newOutfit[cat] = item;
          if (item.season !== Season.ALL) primarySeason = item.season;
        }
      }
    });

    const slots = mode === 'Standard' 
      ? [CategoryL1.TOP, CategoryL1.BOTTOM, CategoryL1.SHOES] 
      : [CategoryL1.DRESS, CategoryL1.SHOES];

    slots.forEach(slot => {
      if (!locked[slot]) {
        const excludeSeason = primarySeason === Season.WARM ? Season.COLD : (primarySeason === Season.COLD ? Season.WARM : undefined);
        const pool = getValidItems(slot, excludeSeason);
        
        if (pool.length > 0) {
          const randomItem = pool[Math.floor(Math.random() * pool.length)];
          newOutfit[slot] = randomItem;
          if (!primarySeason && randomItem.season !== Season.ALL) primarySeason = randomItem.season;
        } else {
             // Fallback
             const fallbackPool = getValidItems(slot);
             newOutfit[slot] = fallbackPool.length > 0 ? fallbackPool[Math.floor(Math.random() * fallbackPool.length)] : null;
        }
      }
    });

    if (mode === 'Standard') delete newOutfit[CategoryL1.DRESS];
    else { delete newOutfit[CategoryL1.TOP]; delete newOutfit[CategoryL1.BOTTOM]; }

    setCurrentOutfit(newOutfit);
  }, [items, locked, mode, getValidItems, currentOutfit]);

  useEffect(() => { shuffle(); }, [mode]);

  const toggleLock = (slot: string, itemId: string | null) => {
    if (!itemId) return;
    setLocked(prev => ({
      ...prev,
      [slot]: prev[slot] === itemId ? null : itemId
    }));
  };

  const handleSaveOutfit = () => {
    const validItems = Object.values(currentOutfit).filter((i): i is ClothingItem => i !== null);
    if (validItems.length < 2) return;
    onSave({
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      items: validItems
    });
    alert("Outfit Captured!");
  };

  const MoodBoardItem = ({ slot, item }: { slot: string, item: ClothingItem | null }) => {
    const isLocked = item && locked[slot] === item.id;
    const style = item ? getRandomCardStyle(item.id) : { color: 'bg-white', rotation: 'rotate-0' };
    
    return (
      <div 
        className={`relative transition-all duration-500 ease-spring ${isShuffling && !isLocked ? 'scale-90 opacity-50 blur-sm' : 'scale-100 opacity-100'}`}
      >
        <div className={`
             rounded-3xl p-4 shadow-lg border-2 border-white relative overflow-visible group
             ${style.color} ${style.rotation}
             ${item ? 'h-48' : 'h-32 flex items-center justify-center bg-gray-100 border-dashed border-gray-300'}
        `}>
           <div className="absolute inset-0 texture-speckle opacity-30 pointer-events-none rounded-3xl"></div>
           
           {item ? (
             <>
               <img src={item.imageData} className="w-full h-full object-contain sticker-effect filter drop-shadow-xl" alt={slot} />
               <button 
                onClick={() => toggleLock(slot, item.id)}
                className={`absolute -top-2 -right-2 p-2 rounded-full shadow-md z-10 transition-colors ${isLocked ? 'bg-black text-white' : 'bg-white text-gray-400 hover:text-gray-900'}`}
               >
                 {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
               </button>
               <span className="absolute bottom-2 left-3 bg-white/90 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-800 shadow-sm backdrop-blur-sm">
                   {item.categoryL2}
               </span>
             </>
           ) : (
             <div className="text-gray-300 flex flex-col items-center">
                 <span className="text-xs font-bold uppercase">{slot}</span>
             </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 h-full flex flex-col">
      {/* MODE TOGGLE */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex text-sm font-bold">
          <button 
            className={`px-6 py-2 rounded-xl transition-all ${mode === 'Standard' ? 'bg-black text-white shadow-md' : 'text-gray-400'}`}
            onClick={() => setMode('Standard')}
          >
            Daily
          </button>
          <button 
             className={`px-6 py-2 rounded-xl transition-all ${mode === 'OnePiece' ? 'bg-black text-white shadow-md' : 'text-gray-400'}`}
             onClick={() => setMode('OnePiece')}
          >
            Dress
          </button>
        </div>
      </div>

      {/* MOOD BOARD GRID */}
      <div className="flex-1 flex flex-col justify-center gap-6 pb-10">
        {mode === 'Standard' ? (
          <>
            <MoodBoardItem slot={CategoryL1.TOP} item={currentOutfit[CategoryL1.TOP] || null} />
            <div className="flex gap-4">
                 <div className="flex-1">
                    <MoodBoardItem slot={CategoryL1.BOTTOM} item={currentOutfit[CategoryL1.BOTTOM] || null} />
                 </div>
                 <div className="flex-1 mt-8">
                    <MoodBoardItem slot={CategoryL1.SHOES} item={currentOutfit[CategoryL1.SHOES] || null} />
                 </div>
            </div>
          </>
        ) : (
          <>
            <MoodBoardItem slot={CategoryL1.DRESS} item={currentOutfit[CategoryL1.DRESS] || null} />
            <MoodBoardItem slot={CategoryL1.SHOES} item={currentOutfit[CategoryL1.SHOES] || null} />
          </>
        )}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-5 gap-4 mb-24">
        <button 
          onClick={shuffle}
          className="col-span-3 py-4 bg-white border-2 border-gray-100 rounded-3xl text-gray-900 font-black text-lg shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw size={22} className={isShuffling ? "animate-spin" : ""} /> SHUFFLE
        </button>
        <button 
           onClick={handleSaveOutfit}
           className="col-span-2 py-4 bg-brand-green text-white rounded-3xl font-black shadow-lg shadow-brand-green/30 hover:bg-green-500 active:scale-95 transition-all flex items-center justify-center"
        >
           <Check size={26} />
        </button>
      </div>
    </div>
  );
};

// 4. CALENDAR VIEW - Timeline Style
const CalendarView: React.FC<{ outfits: Outfit[], items: ClothingItem[] }> = ({ outfits, items }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const dayOutfits = outfits.filter(o => o.date === selectedDate);

  return (
    <div className="px-4 pb-24">
       <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6 flex items-center justify-between">
            <button className="p-2 bg-gray-50 rounded-full" onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]);
            }}>&lt;</button>
            <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-black text-lg text-center bg-transparent focus:outline-none"
            />
            <button className="p-2 bg-gray-50 rounded-full" onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]);
            }}>&gt;</button>
       </div>
       
       <div className="space-y-6">
          {dayOutfits.length === 0 ? (
             <div className="text-center py-20 opacity-50">
                <p className="font-bold text-gray-400">No fit checks today.</p>
             </div>
          ) : (
             dayOutfits.map(outfit => (
                <div key={outfit.id} className="relative bg-white rounded-3xl p-6 shadow-md border border-gray-100 overflow-hidden">
                    <div className="absolute inset-0 texture-speckle opacity-20 pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-2 h-full bg-brand-orange"></div>
                    
                    <div className="flex flex-wrap gap-4 items-center justify-center relative z-10">
                        {outfit.items.map((item, idx) => (
                            <div key={item.id} className={`w-20 h-20 ${idx%2===0?'rotate-6':'-rotate-6'}`}>
                                <img src={item.imageData} className="w-full h-full object-contain sticker-effect" alt="" />
                            </div>
                        ))}
                    </div>
                </div>
             ))
          )}
       </div>
    </div>
  );
};

// 5. TRASH VIEW
const TrashView: React.FC<{ items: ClothingItem[], onRestore: (id: string) => void, onPermanentDelete: (id: string) => void }> = ({ items, onRestore, onPermanentDelete }) => {
  const deletedItems = items.filter(i => i.isDeleted).sort((a, b) => (b.trashDate || 0) - (a.trashDate || 0));

  return (
    <div className="px-4 pb-24">
       {deletedItems.length === 0 ? (
           <div className="text-center text-gray-400 mt-20 font-medium">Recycle bin is empty.</div>
       ) : (
           <div className="grid grid-cols-2 gap-4">
              {deletedItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-4 border-2 border-dashed border-gray-200 opacity-75 grayscale hover:grayscale-0 transition-all">
                      <div className="aspect-square mb-2 relative">
                         <img src={item.imageData} className="w-full h-full object-contain" alt="" />
                      </div>
                      <div className="flex gap-2 mt-2">
                          <button onClick={() => onRestore(item.id)} className="flex-1 bg-green-100 text-green-700 text-xs py-2 rounded-lg font-bold">Restore</button>
                          <button onClick={() => onPermanentDelete(item.id)} className="flex-1 bg-red-100 text-red-700 text-xs py-2 rounded-lg font-bold">Delete</button>
                      </div>
                  </div>
              ))}
           </div>
       )}
    </div>
  );
};

// --- SHARED COMPONENTS ---

const NavButton: React.FC<{ icon: React.ElementType, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all ${
        active ? 'bg-gray-100 text-gray-900 scale-105 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
    }`}
  >
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    {active && <span className="text-[9px] font-black mt-1 uppercase tracking-wide">{label}</span>}
  </button>
);

const FilterChip: React.FC<{ label: string, selected: boolean, onClick: () => void, color?: string }> = ({ label, selected, onClick, color }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
      selected 
        ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105' 
        : 'bg-white text-gray-500 border-transparent hover:bg-gray-50'
    }`}
  >
    {color && (
        <span className="w-3 h-3 rounded-full border border-gray-200 inline-block mr-2 align-middle" style={{ backgroundColor: color.toLowerCase() }}></span>
    )}
    {label}
  </button>
);

const StickerCard: React.FC<{ item: ClothingItem, onDelete: () => void, onEdit: () => void, index: number }> = ({ item, onDelete, onEdit, index }) => {
    const style = useMemo(() => getRandomCardStyle(item.id), [item.id]);

    return (
        <div 
            className={`
                group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:rotate-0
                ${style.color} ${style.rotation}
            `}
        >
            <div className="absolute inset-0 texture-speckle opacity-20 pointer-events-none"></div>
            
            <div className="aspect-[3/4] p-3 flex items-center justify-center relative">
                <img 
                    src={item.imageData} 
                    alt={item.categoryL2} 
                    className="w-full h-full object-contain sticker-effect transition-transform duration-300 group-hover:scale-110" 
                />
            </div>
            
            {/* Hover Actions Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                 <div className="flex justify-end gap-2">
                    <button onClick={onEdit} className="bg-white text-brand-blue p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                        <Pencil size={16} />
                    </button>
                    <button onClick={onDelete} className="bg-white text-red-500 p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                        <Trash2 size={16} />
                    </button>
                 </div>
                 <div className="bg-white/90 backdrop-blur rounded-xl p-2 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-800">{item.categoryL2}</p>
                 </div>
            </div>
        </div>
    );
};

const EraserToolIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z"></path>
    <path d="M11 11L20 20"></path>
  </svg>
);

export default App;