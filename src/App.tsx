import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Settings as SettingsIcon, 
  Users, 
  Truck, 
  PackagePlus, 
  ReceiptText, 
  LogOut,
  Menu,
  X,
  Lock,
  User as UserIcon,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { auth, db, loginWithEmail, signOut, registerWithEmail } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError } from './lib/firebaseUtils';
import { AppSettings, TeamMember, UserProfile, UserRole } from './types';
import { onSnapshot } from 'firebase/firestore';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { pushToGithub, parseGithubUrl } from './services/githubService';

// Components
import DistributorList from './components/DistributorList';
import IncomingGoods from './components/IncomingGoods';
import Bills from './components/Bills';
import Reports from './components/Reports';
import Settings from './components/Settings';
import AccountManagement from './components/AccountManagement';
import NotificationCenter from './components/NotificationCenter';

type View = 'reports' | 'distributors' | 'incoming' | 'bills' | 'settings' | 'accounts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [view, setView] = useState<View>('reports');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showToast, setShowToast] = useState(false);
  
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Background sync logic for GitHub
  useEffect(() => {
    if (!appSettings?.githubRepo || !appSettings?.githubToken || !userProfile) return;

    const interval = setInterval(async () => {
      console.log("Periodic background sync to GitHub initiated...");
      const parsed = parseGithubUrl(appSettings.githubRepo!);
      if (!parsed) return;

      try {
        const config = { ...parsed, token: appSettings.githubToken!, repo: appSettings.githubRepo!, owner: parsed.owner, repoName: parsed.repoName };
        
        // Sync Distributors
        const distSnap = await getDocs(query(collection(db, 'distributors'), where('ownerId', '==', userProfile.ownerId)));
        await pushToGithub(config, 'data/distributors.json', JSON.stringify(distSnap.docs.map(d => d.data()), null, 2), 'Background sync: Distributors');

        // Sync Bills
        const billsSnap = await getDocs(query(collection(db, 'bills'), where('ownerId', '==', userProfile.ownerId)));
        await pushToGithub(config, 'data/bills.json', JSON.stringify(billsSnap.docs.map(d => d.data()), null, 2), 'Background sync: Bills');

      } catch (e) {
        console.error("Background sync failed:", e);
      }
    }, 1000 * 60 * 5); // Every 5 minutes

    return () => clearInterval(interval);
  }, [appSettings?.githubRepo, appSettings?.githubToken, userProfile]);

  const getThemeStyles = () => {
    switch (appSettings?.themePreset) {
      case 'light':
        return {
          bgMain: 'bg-zinc-50',
          bgSidebar: 'bg-white',
          bgHeader: 'bg-white/80',
          border: 'border-zinc-200'
        };
      case 'midnight':
        return {
          bgMain: 'bg-[#020617]',
          bgSidebar: 'bg-[#020617]/60',
          bgHeader: 'bg-[#020617]/50',
          border: 'border-blue-500/10'
        };
      case 'slate':
        return {
          bgMain: 'bg-[#0f172a]',
          bgSidebar: 'bg-[#0f172a]/60',
          bgHeader: 'bg-[#0f172a]/50',
          border: 'border-slate-800'
        };
      case 'modern':
        return {
          bgMain: 'bg-[#18181b]',
          bgSidebar: 'bg-[#18181b]/60',
          bgHeader: 'bg-[#18181b]/50',
          border: 'border-white/5'
        };
      default:
        return {
          bgMain: 'bg-[#0b0c10]',
          bgSidebar: 'bg-[#090a0d]/40',
          bgHeader: 'bg-[#0b0c10]/50',
          border: 'border-white/5'
        };
    }
  };

  const theme = getThemeStyles();

  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerSavedToast = () => {
    // Clear existing timeouts to prevent race conditions
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    setSyncStatus('saved');
    setShowToast(true);

    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2000);

    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('idle');
    }, 4000);
  };

  // Login form state
  const [loginMode, setLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const slowTimer = setTimeout(() => {
      if (loading) setLoadingSlow(true);
    }, 5000);

    // Emergency loading exit
    const emergencyTimer = setTimeout(() => {
      if (loading) {
        console.warn("Emergency loading termination triggered.");
        setLoading(false);
      }
    }, 15000);

    return onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          const profileRef = doc(db, 'user_profiles', u.uid);
          
          // Race profile fetch against a timeout
          const profilePromise = getDoc(profileRef);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          );

          let currentProfile: UserProfile | null = null;
          try {
            const profileSnap = await Promise.race([profilePromise, timeoutPromise]) as any;
            if (profileSnap.exists()) {
              currentProfile = profileSnap.data() as UserProfile;
              setUserProfile(currentProfile);
            } else {
              // If logged in but no profile, and is owner by logic, we might need a fallback
              console.warn("No profile found for user:", u.uid);
            }
          } catch (e) {
            console.warn("Profile fetch timed out or failed:", e);
          }
          setUser(u);

          // Fetch App Settings
          const correctOwnerId = currentProfile?.ownerId || u.uid;
          const qSettings = query(collection(db, 'app_settings'), where('ownerId', '==', correctOwnerId));
          const unsubSettings = onSnapshot(qSettings, (snap) => {
            if (!snap.empty) {
              setAppSettings({ id: snap.docs[0].id, ...snap.docs[0].data() } as AppSettings);
            }
          });

          return () => unsubSettings();
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error("Error in auth state change:", err);
      } finally {
        setLoading(false);
        clearTimeout(slowTimer);
        clearTimeout(emergencyTimer);
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      // Find user by username (Firestore search is case-sensitive)
      // Check for Owner first case-insensitively
      const isInitialOwner = username.toLowerCase() === 'owner' && password === 'Fu061894';
      
      const q = query(collection(db, 'user_profiles'), where('username', '==', isInitialOwner ? 'Owner' : username));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, 'list', 'user_profiles');
      }
      
      // If not found and it's owner, try lowercase
      if (snap?.empty && isInitialOwner) {
        const q2 = query(collection(db, 'user_profiles'), where('username', '==', 'owner'));
        try {
          snap = await getDocs(q2);
        } catch (err) {
          handleFirestoreError(err, 'list', 'user_profiles');
        }
      }

      if (snap.empty) {
        // Also check in team_members
        const qTeam = query(collection(db, 'team_members'), where('username', '==', username));
        try {
          snap = await getDocs(qTeam);
        } catch (err) {
          handleFirestoreError(err, 'list', 'team_members');
        }
      }

      if (snap.empty) {
        if (isInitialOwner) {
          const email = 'owner@finestra.local';
          let cred;
          try {
            cred = await registerWithEmail(email, password);
          } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
              cred = await loginWithEmail(email, password);
            } else {
              throw err;
            }
          }

          if (cred) {
            const newProfile: UserProfile = {
              uid: cred.user.uid,
              email,
              username: 'Owner',
              role: 'owner',
              ownerId: cred.user.uid
            };
            await setDoc(doc(db, 'user_profiles', cred.user.uid), newProfile);
            setUserProfile(newProfile);
            setLoading(false);
            return;
          }
        }
        throw new Error('Username tidak ditemukan.');
      }

      const data = snap.docs[0].data() as any;
      const isTeamMember = !data.uid && data.password; // New team member from admin
      
      // If team member, check initial password
      if (isTeamMember && data.password !== password) {
        throw new Error('Password salah untuk akun baru ini.');
      }

      const profile = data as UserProfile;
      try {
        await loginWithEmail(profile.email, password);
      } catch (err: any) {
        // If profile exists in Firestore but not in Auth (account created by admin)
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // If magic owner password is used, and it's the owner profile, retry with registration
          if (isInitialOwner && profile.username.toLowerCase() === 'owner') {
             try {
                const cred = await registerWithEmail(profile.email, password);
                const updatedProfile = { ...profile, uid: cred.user.uid };
                await setDoc(doc(db, 'user_profiles', cred.user.uid), updatedProfile);
                setUserProfile(updatedProfile);
                return;
             } catch (regErr: any) {
                if (regErr.code === 'auth/email-already-in-use') {
                   // Just wrong password
                }
             }
          }

          if (err.code === 'auth/user-not-found') {
             // For non-owner accounts, attempt to claim if first login
             try {
                const cred = await registerWithEmail(profile.email, password);
                const updatedProfile = { ...profile, uid: cred.user.uid };
                await setDoc(doc(db, 'user_profiles', cred.user.uid), updatedProfile);
                setUserProfile(updatedProfile);
                return;
             } catch (regErr) {
                throw new Error('Kredensial tidak valid.');
             }
          }
          throw new Error('Password salah atau otoritas ditolak.');
        }
        throw err;
      }
    } catch (err: any) {
      if (err.message?.includes('offline')) {
        setAuthError('Gagal terhubung ke server (Sistem Offline). Silakan periksa koneksi internet atau konfigurasi Firebase Anda.');
      } else {
        setAuthError(err.message || 'Login gagal.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center transition-colors duration-700", theme.bgMain)}>
        <div className="relative w-16 h-16 mb-6">
           <div className="absolute inset-0 border-2 border-white/5 rounded-full"></div>
           <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
        {loadingSlow && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center px-6"
          >
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-black animate-pulse">Menghubungkan ke Server...</p>
            <p className="text-zinc-700 text-[10px] italic mt-2">Ini mungkin memakan waktu lebih lama jika koneksi lambat</p>
          </motion.div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center p-4 font-sans appearance-none transition-colors duration-700", theme.bgMain)}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("max-w-md w-full backdrop-blur-2xl p-10 rounded-[2rem] border shadow-2xl overflow-hidden relative", theme.border, appSettings?.themePreset === 'midnight' ? "bg-blue-950/20" : "bg-white/5")}
        >
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full"></div>
          
          <div className="text-center mb-10 relative z-10">
            <h1 className="text-4xl font-serif italic text-zinc-900 dark:text-white tracking-wide mb-2 transition-all">
              {appSettings?.appName || 'Finestra.'}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
              {appSettings?.tagline || 'Manajemen Keuangan'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 block font-bold">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  required
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 block font-bold">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="text-red-400 text-xs font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-center"
              >
                {authError}
              </motion.p>
            )}

            <button
              type="submit"
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-[#09090b] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] dark:hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]"
            >
              Masuk ke Sistem
            </button>
            
            <p className="text-center text-[10px] text-zinc-600 italic">
              Akses default: <span className="text-zinc-400">Owner</span> / <span className="text-zinc-400">Fu061894</span>
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'reports', label: 'Dashboard', icon: BarChart3, roles: ['owner', 'hrd', 'admin staff'] },
    { id: 'distributors', label: 'Distributor', icon: Truck, roles: ['owner', 'hrd', 'admin staff'] },
    { id: 'incoming', label: 'Barang Masuk', icon: PackagePlus, roles: ['owner', 'hrd', 'admin staff'] },
    { id: 'bills', label: 'Manajemen Tagihan', icon: ReceiptText, roles: ['owner', 'hrd', 'admin staff'] },
    { id: 'accounts', label: 'Manajemen Akun', icon: Users, roles: ['owner', 'hrd'] },
    { id: 'settings', label: 'Pengaturan', icon: SettingsIcon, roles: ['owner', 'hrd', 'admin staff'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    !userProfile || item.roles.includes(userProfile.role)
  );

  // Fallback profile if fetch failed
  const effectiveProfile = userProfile || (user ? {
    uid: user.uid,
    email: user.email || '',
    username: user.email?.split('@')[0] || 'User',
    role: (user.email === 'owner@finestra.local' || user.uid === 'Owner') ? 'owner' : 'admin staff',
    ownerId: user.uid // Simplified fallback
  } as UserProfile : null);

  const SidebarItem = React.memo(({ item, isActive, isCollapsed, onClick }: { 
    item: any, 
    isActive: boolean, 
    isCollapsed: boolean, 
    onClick: () => void 
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 active:scale-95 group",
        isActive 
          ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20" 
          : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
      )}
    >
      <item.icon size={18} className={cn("transition-transform group-hover:scale-110", isActive ? "text-white" : "text-zinc-500")} />
      {isCollapsed && <span className={cn("text-[13px] font-medium tracking-wide whitespace-nowrap", isActive ? "text-white" : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200")}>{item.label}</span>}
      {isActive && isCollapsed && <ChevronRight size={14} className="ml-auto text-white/50" />}
    </button>
  ));

  return (
    <div className={cn("min-h-screen flex text-zinc-900 dark:text-zinc-300 overflow-hidden transition-colors duration-700", theme.bgMain)}>
      {/* Sidebar Navigation */}
      <aside 
        className={cn(
          "backdrop-blur-3xl border-r flex flex-col transition-all duration-500 z-50 sticky top-0 h-screen",
          theme.bgSidebar,
          theme.border,
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        <div className="p-8 mb-6 cursor-pointer" onClick={() => setSidebarOpen(!isSidebarOpen)}>
          <div className={cn("flex flex-col transition-all duration-300", !isSidebarOpen && "items-center")}>
            <h1 className={cn("text-3xl font-serif italic text-zinc-900 dark:text-white tracking-wide transition-all", !isSidebarOpen && "text-xl")}>
              {isSidebarOpen ? (appSettings?.appName || 'Finestra.') : (appSettings?.appName?.charAt(0) || 'F.')}
            </h1>
            {isSidebarOpen && <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-400 dark:text-zinc-500 mt-1 font-bold">{appSettings?.tagline || 'Keuangan'}</p>}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {filteredNavItems.map((item) => (
            <SidebarItem 
              key={item.id}
              item={item}
              isActive={view === item.id}
              isCollapsed={isSidebarOpen}
              onClick={() => setView(item.id as View)}
            />
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-zinc-200 dark:border-zinc-800/50">
          <div className={cn("flex items-center gap-3 p-3 mb-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900/30", !isSidebarOpen && "justify-center px-0")}>
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 text-sm font-black shadow-inner">
              {effectiveProfile?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">{effectiveProfile?.username}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black truncate">{effectiveProfile?.role === 'owner' ? 'Pemilik' : 'Staf'}</span>
              </div>
            )}
          </div>
          <button
            onClick={signOut}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-bold uppercase tracking-widest",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut size={16} />
            {isSidebarOpen && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content View */}
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-colors duration-700", theme.bgMain)}>
        <header className={cn("h-24 backdrop-blur-md border-b flex items-center px-10 justify-between sticky top-0 z-40", theme.bgHeader, theme.border)}>
          <div>
            <h2 className="text-3xl font-serif text-zinc-900 dark:text-white tracking-tight">
              {navItems.find(i => i.id === view)?.label}
            </h2>
            <p className="text-[11px] text-zinc-500 italic mt-0.5 tracking-wide">
              {view === 'reports' && 'Intelijen Operasional & Analitik Terpadu'}
              {view === 'distributors' && 'Direktori Partner Strategis Anda'}
              {view === 'incoming' && 'Log Pengadaan Inventaris & Aset'}
              {view === 'bills' && 'Buku Besar Kewajiban Finansial'}
              {view === 'accounts' && 'Protokol Kontrol Akses Pengguna'}
              {view === 'settings' && 'Konfigurasi Parameter Sistem'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className={cn("flex items-center gap-3 px-4 py-1.5 rounded-full transition-all", appSettings?.themePreset === 'light' ? "bg-zinc-100 border border-zinc-200" : "bg-zinc-900/50 border border-zinc-800")}>
                {syncStatus === 'saving' ? (
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : syncStatus === 'syncing' ? (
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : syncStatus === 'error' ? (
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                ) : (
                  <div className={cn("w-2 h-2 rounded-full", syncStatus === 'saved' ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-emerald-500 animate-pulse")} />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                  {syncStatus === 'saving' ? 'Menyimpan...' : 
                   syncStatus === 'syncing' ? 'Sinkron Cloud...' :
                   syncStatus === 'saved' ? 'Data Tersimpan' : 
                   syncStatus === 'error' ? 'Kesalahan Sinkron' : 'Sinkronisasi Aktif'}
                </span>
             </div>
             {effectiveProfile && <NotificationCenter profile={effectiveProfile} onNavigate={(v) => setView(v)} />}
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-7xl mx-auto h-full"
            >
              {effectiveProfile && (
                <>
                  {view === 'reports' && <Reports profile={effectiveProfile} onNavigate={(v) => setView(v)} />}
                  {view === 'distributors' && <DistributorList profile={effectiveProfile} onSave={triggerSavedToast} setSyncStatus={setSyncStatus} />}
                  {view === 'incoming' && <IncomingGoods profile={effectiveProfile} onSave={triggerSavedToast} setSyncStatus={setSyncStatus} />}
                  {view === 'bills' && <Bills profile={effectiveProfile} appSettings={appSettings} onSave={triggerSavedToast} setSyncStatus={setSyncStatus} />}
                  {view === 'accounts' && <AccountManagement profile={effectiveProfile} />}
                  {view === 'settings' && <Settings profile={effectiveProfile} onSave={triggerSavedToast} setSyncStatus={setSyncStatus} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {showToast && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]"
              >
                <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-blue-600/30 flex items-center gap-3">
                   <div className="p-1 rounded-full bg-white/10">
                      <Sparkles size={14} className="text-white" />
                   </div>
                   <span className="text-[11px] font-black uppercase tracking-widest">Informasi Sistem Berhasil Diperbarui</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <footer className="mt-20 py-10 border-t border-zinc-800/30 text-center">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.3em]">{appSettings?.footer || '© 2024 Finestra Finance. All rights reserved.'}</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
