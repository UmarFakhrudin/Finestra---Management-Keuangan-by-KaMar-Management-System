import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AppSettings, TeamMember, UserRole } from '../types';
import { 
  Settings as SettingsIcon, Layout, Users, Shield, 
  Trash2, Plus, Save, Palette, Bell, Info, 
  CheckCircle2, Globe, ShieldCheck, Mail, UserPlus,
  ArrowRight, Heart, RefreshCcw, Cloud
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { pushToGithub, parseGithubUrl, testGithubConnection } from '../services/githubService';
import { exportAppData, importAppData } from '../services/dataService';

export default function Settings({ profile, onSave, setSyncStatus }: { 
  profile: UserProfile, 
  onSave?: () => void,
  setSyncStatus?: (status: 'idle' | 'saving' | 'saved' | 'error' | 'syncing') => void 
}) {
  const [activeTab, setActiveTab] = useState<'app' | 'team'>('app');
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const initialLoad = useRef(true);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Form states
  const [appForm, setAppForm] = useState<Partial<AppSettings>>({
    appName: 'My Application',
    tagline: 'Business Management',
    footer: '© 2024 All rights reserved.',
    themeColor: '#3b82f6',
    themePreset: 'dark'
  });
  const [teamForm, setTeamForm] = useState({
    email: '',
    username: '',
    password: '',
    role: 'admin staff' as UserRole
  });

  useEffect(() => {
    // Listen for App Settings
    const qSettings = query(collection(db, 'app_settings'), where('ownerId', '==', profile.ownerId));
    const unsubSettings = onSnapshot(qSettings, (snap) => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as AppSettings;
        setAppSettings(data);
        setAppForm(data);
      } else {
        // Init default settings if none exist
        const defaultSettings: AppSettings = {
          ownerId: profile.ownerId,
          appName: 'My App',
          tagline: 'Financial Management System',
          footer: '© 2024 All rights reserved.',
          themeColor: '#3b82f6'
        };
        addDoc(collection(db, 'app_settings'), defaultSettings);
      }
    });

    // Listen for Team Members
    const qTeam = query(collection(db, 'team_members'), where('ownerId', '==', profile.ownerId));
    const unsubTeam = onSnapshot(qTeam, (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember)));
      setLoading(false);
    });

    return () => { unsubSettings(); unsubTeam(); };
  }, [profile.ownerId]);

  useEffect(() => {
    if (appForm?.githubRepo && appForm?.githubToken) {
      const check = async () => {
        const parsed = parseGithubUrl(appForm.githubRepo!);
        if (parsed) {
          const ok = await testGithubConnection({ 
            owner: parsed.owner, 
            repoName: parsed.repoName, 
            token: appForm.githubToken! 
          });
          setIsConnected(ok);
        } else {
          setIsConnected(false);
        }
      };
      const timeout = setTimeout(check, 1000);
      return () => clearTimeout(timeout);
    } else {
      setIsConnected(null);
    }
  }, [appForm?.githubRepo, appForm?.githubToken]);

  // Auto-save logic
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }

    if (activeTab !== 'app' || !appSettings?.id) return;

    // Debounce save
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    
    saveTimeout.current = setTimeout(async () => {
      setSyncStatus?.('saving');
      try {
        await updateDoc(doc(db, 'app_settings', appSettings.id), appForm);
        onSave?.(); // App.tsx will handle the 'saved' -> 'idle' transition
        
        // Auto-sync to GitHub if configured (as Side Effect)
        if (appForm.githubRepo && appForm.githubToken) {
           const parsed = parseGithubUrl(appForm.githubRepo);
           if (parsed) {
              pushToGithub(
                { ...parsed, token: appForm.githubToken, repo: appForm.githubRepo, owner: parsed.owner, repoName: parsed.repoName },
                'data/app_settings.json',
                JSON.stringify(appForm, null, 2),
                'Auto-sync settings'
              ).catch(e => console.error("Auto-sync background failed:", e));
           }
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSyncStatus?.('error');
        setTimeout(() => setSyncStatus?.('idle'), 3000);
      }
    }, 800); // Slightly longer debounce for auto-sync

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [appForm, appSettings?.id, activeTab]);

  const syncToGithub = async () => {
    if (!appForm.githubRepo || !appForm.githubToken) return;
    
    const parsed = parseGithubUrl(appForm.githubRepo);
    if (!parsed) return;

    setSyncing(true);
    setSyncStatus?.('syncing');

    try {
      const config = { ...parsed, token: appForm.githubToken, repo: appForm.githubRepo, owner: parsed.owner, repoName: parsed.repoName };
      
      // 1. Sync App Settings
      await pushToGithub(
        config,
        'data/app_settings.json',
        JSON.stringify({ ...appForm, syncTime: new Date().toISOString() }, null, 2),
        `Sync settings: ${appForm.appName}`
      );

      // 2. Fetch and Sync Distributors
      const distSnap = await getDocs(query(collection(db, 'distributors'), where('ownerId', '==', profile.ownerId)));
      const distributors = distSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      await pushToGithub(
        config,
        'data/distributors.json',
        JSON.stringify(distributors, null, 2),
        `Sync distributors: ${distributors.length} items`
      );

      // 3. Fetch and Sync Bills
      const billsSnap = await getDocs(query(collection(db, 'bills'), where('ownerId', '==', profile.ownerId)));
      const bills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      await pushToGithub(
        config,
        'data/bills.json',
        JSON.stringify(bills, null, 2),
        `Sync bills: ${bills.length} items`
      );

      // 4. Fetch and Sync Team Members
      await pushToGithub(
        config,
        'data/team_members.json',
        JSON.stringify(team, null, 2),
        `Sync team: ${team.length} members`
      );

      setSyncing(false);
      setSyncStatus?.('saved');
      setTimeout(() => setSyncStatus?.('idle'), 2000);
    } catch (error) {
      console.error("Github comprehensive sync failed:", error);
      setSyncing(false);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const handleUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appSettings?.id) return;
    
    setSyncStatus?.('saving');
    try {
      await updateDoc(doc(db, 'app_settings', appSettings.id), appForm);
      onSave?.(); // Inform App.tsx immediately (sets 'saved' and shows toast)
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
      // Secondary Sync Action - don't block the 'saved' status UI
      if (appForm.githubRepo && appForm.githubToken) {
         syncToGithub(); // No await here to keep UI responsive
      }
    } catch (err) {
      console.error("Manual save failed:", err);
      setSyncStatus?.('error');
      setTimeout(() => setSyncStatus?.('idle'), 3000);
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'team_members'), {
      ...teamForm,
      ownerId: profile.ownerId,
      createdAt: new Date().toISOString()
    });
    setTeamForm({ email: '', username: '', password: '', role: 'admin staff' });
  };

  const removeTeamMember = async (id: string) => {
    await deleteDoc(doc(db, 'team_members', id));
  };

  const themes = [
    { name: 'Pure Blue', color: '#3b82f6' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Vivid Orange', color: '#f97316' },
    { name: 'Royal Purple', color: '#a855f7' },
    { name: 'Cyber Pink', color: '#ec4899' },
    { name: 'Classic Zinc', color: '#71717a' },
  ];

  const presets = [
    { id: 'dark', name: 'Original Dark', bg: 'bg-[#0b0c10]', desc: 'The classic refined dark look' },
    { id: 'light', name: 'Clean Light', bg: 'bg-zinc-50', desc: 'Minimalist white interface' },
    { id: 'midnight', name: 'Deep Midnight', bg: 'bg-[#10192e]', desc: 'Rich navy blue atmosphere' },
    { id: 'slate', name: 'Modern Slate', bg: 'bg-[#1e293b]', desc: 'Clean slate gray interface' },
    { id: 'modern', name: 'Graphite', bg: 'bg-[#27272a]', desc: 'Solid graphite black aesthetic' },
  ];

  const themeColor = appForm.themeColor || '#3b82f6';

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-serif italic text-white tracking-tight">Kendalikan Ekosistem</h2>
          <p className="text-zinc-500 font-medium text-sm mt-2">Personalisasi identitas dan akses tata kelola</p>
        </div>
        <div className="flex bg-[#141417] p-1.5 rounded-2xl border border-zinc-800">
           {[
             { id: 'app', label: 'App Info', icon: Layout },
             { id: 'team', label: 'Team', icon: Users }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "px-6 py-3 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all",
                 activeTab === tab.id ? "bg-zinc-800 text-white shadow-xl shadow-black/20" : "text-zinc-500 hover:text-zinc-300"
               )}
             >
               <tab.icon size={14} />
               {tab.label}
             </button>
           ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Form Column */}
        <div className="lg:col-span-8 space-y-8">
           <AnimatePresence mode="wait">
             {activeTab === 'app' ? (
               <motion.div
                 key="app"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="bg-[#141417] border border-zinc-800 rounded-[2.5rem] p-10 relative overflow-hidden"
               >
                 <div className="absolute top-0 right-0 p-10 opacity-5 -translate-y-6">
                    <Info size={300} />
                 </div>
                 
                 <form onSubmit={handleUpdateApp} className="space-y-10 relative z-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                         <Globe size={12} className="text-zinc-700" /> Nama Aplikasi
                       </label>
                       <input 
                         type="text"
                         value={appForm.appName || ''}
                         onChange={(e) => setAppForm({ ...appForm, appName: e.target.value })}
                         className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                       />
                     </div>
                     <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                         <Palette size={12} className="text-zinc-700" /> Slogan / Tagline
                       </label>
                       <input 
                         type="text"
                         value={appForm.tagline || ''}
                         onChange={(e) => setAppForm({ ...appForm, tagline: e.target.value })}
                         className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400 focus:outline-none focus:border-amber-500 italic"
                       />
                     </div>
                   </div>

                   <div className="space-y-6">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Palette size={12} className="text-zinc-700" /> Atmosfer Aplikasi (Theme Preset)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {presets.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setAppForm({ ...appForm, themePreset: p.id as any })}
                            className={cn(
                              "group relative p-4 rounded-2xl border transition-all flex items-center gap-4 text-left",
                              appForm.themePreset === p.id 
                                ? "border-zinc-500 bg-zinc-500/5 shadow-sm" 
                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-transparent"
                            )}
                          >
                            <div className={cn("w-10 h-10 rounded-xl shadow-md shrink-0 border border-zinc-200/20", p.bg)} />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-tight text-zinc-900 dark:text-white">{p.name}</p>
                               <p className="text-[9px] font-medium text-zinc-500 mt-0.5">{p.desc}</p>
                            </div>
                            {appForm.themePreset === p.id && (
                               <motion.div layoutId="preset-check" className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                  <CheckCircle2 size={10} />
                               </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-6">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                        <Palette size={12} className="text-zinc-700" /> Aksen Tema (Color Accent)
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                        {themes.map(t => (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => setAppForm({ ...appForm, themeColor: t.color })}
                            className={cn(
                              "group relative h-16 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2",
                              appForm.themeColor === t.color ? "border-white bg-white/5" : "border-zinc-800 hover:border-zinc-500 bg-transparent"
                            )}
                          >
                            <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: t.color }} />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-500">{t.name}</span>
                            {appForm.themeColor === t.color && (
                               <motion.div layoutId="theme-check" className="absolute -top-2 -right-2 bg-white text-black p-1 rounded-full shadow-xl">
                                  <CheckCircle2 size={10} />
                               </motion.div>
                            )}
                          </button>
                        ))}
                      </div>
                   </div>

                     <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                          <Globe size={12} className="text-zinc-700" /> Cloud & Deployment Repository
                        </label>
                        <div className="bg-zinc-950/30 border border-zinc-800 rounded-3xl p-6 space-y-4">
                           <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                                 <RefreshCcw size={18} />
                              </div>
                              <div className="flex-1">
                                 <p className="text-[10px] font-black uppercase tracking-tight text-white">GitHub Storage Sync</p>
                                 <p className="text-[9px] text-zinc-500">Gunakan repositori sebagai host utama media & aset</p>
                              </div>
                              <div className="flex items-center gap-2">
                                 <button
                                   type="button"
                                   onClick={syncToGithub}
                                   disabled={syncing || !appForm.githubToken || !appForm.githubRepo}
                                   className={cn(
                                     "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                                     (!appForm.githubToken || !appForm.githubRepo) ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                                     syncing ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                   )}
                                 >
                                    <Cloud size={10} className={cn(syncing && "animate-pulse")} />
                                    {syncing ? 'Syncing...' : 'Sync Now'}
                                 </button>
                                 <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    isConnected === true ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : 
                                    isConnected === false ? "bg-red-500" : "bg-zinc-600"
                                 )} />
                                 <span className={cn(
                                    "text-[8px] font-black uppercase",
                                    isConnected === true ? "text-emerald-500" : 
                                    isConnected === false ? "text-red-500" : "text-zinc-500"
                                 )}>
                                    {isConnected === true ? 'Cloud Active' : isConnected === false ? 'Error' : 'Offline'}
                                 </span>
                              </div>
                           </div>
                           
                           {/* Backup Controls */}
                           <div className="flex gap-2 mt-4">
                              <button 
                                onClick={() => exportAppData(profile.ownerId)}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-2 px-3 flex items-center justify-center gap-2 transition-all group"
                              >
                                 <Save size={12} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase">Export Backup</span>
                              </button>
                              
                              <label className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-2 px-3 flex items-center justify-center gap-2 cursor-pointer group transition-all">
                                 <Plus size={12} className="text-emerald-500 group-hover:rotate-90 transition-transform" />
                                 <span className="text-[9px] font-black text-zinc-400 uppercase">Import Data</span>
                                 <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".json"
                                    onChange={async (e) => {
                                       const file = e.target.files?.[0];
                                       if (!file) return;
                                       const reader = new FileReader();
                                       reader.onload = async (event) => {
                                          try {
                                             const json = JSON.parse(event.target?.result as string);
                                             await importAppData(profile.ownerId, json);
                                             onSave?.();
                                             alert('Data berhasil diimport & disinkronkan!');
                                          } catch (err) {
                                             alert('Gagal mengimport data. File tidak valid.');
                                          }
                                       };
                                       reader.readAsText(file);
                                    }}
                                 />
                              </label>
                           </div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-zinc-600 ml-1">GitHub Repo URL</p>
                              <input 
                                type="text"
                                placeholder="https://github.com/username/repo"
                                value={appForm.githubRepo || 'https://github.com/UmarFakhrudin/Cloudhub-FPOS'}
                                onChange={(e) => setAppForm({ ...appForm, githubRepo: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:border-blue-500 outline-none"
                              />
                           </div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-zinc-600 ml-1">GitHub Personal Access Token (PAT)</p>
                              <input 
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={appForm.githubToken || ''}
                                onChange={(e) => setAppForm({ ...appForm, githubToken: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:border-blue-500 outline-none"
                              />
                           </div>
                           <p className="text-[8px] text-zinc-500 px-1 leading-relaxed">
                              * Dengan PAT, sistem dapat melakukan 'Push' media langsung ke branch utama repository Anda secara otomatis.
                           </p>
                        </div>
                     </div>

                   <div className="flex justify-between items-center bg-zinc-950 p-6 rounded-3xl border border-zinc-900">
                      <div className="flex items-center gap-4 text-zinc-500">
                         <RefreshCcw size={18} className="animate-spin-slow" />
                         <span className="text-[10px] font-bold uppercase tracking-widest italic text-zinc-400">GitHub Cloud Storage Active</span>
                      </div>
                      <button 
                        type="submit"
                        style={{ backgroundColor: themeColor }}
                        className="px-10 py-4 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-white/5 active:scale-95"
                      >
                        {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                        {saved ? 'Tersimpan' : 'Update Info'}
                      </button>
                   </div>
                 </form>
               </motion.div>
             ) : (
               <motion.div
                 key="team"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="space-y-10"
               >
                 {/* Team Access Management */}
                 <div className="bg-[#141417] border border-zinc-800 rounded-[2.5rem] p-10">
                    <h3 className="text-2xl font-serif italic text-white mb-10 flex items-center gap-4">
                       Otorisasi Akses Tim
                    </h3>
                    
                    <form onSubmit={handleAddTeamMember} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Email User</label>
                          <div className="relative">
                             <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={14} />
                             <input 
                               required
                               type="email"
                               placeholder="user@example.com"
                               value={teamForm.email}
                               onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })}
                               className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-xs text-white focus:border-blue-500 outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Username</label>
                          <input 
                             required
                             placeholder="Ex: Amanda"
                             value={teamForm.username}
                             onChange={(e) => setTeamForm({ ...teamForm, username: e.target.value })}
                             className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-xs text-white focus:border-blue-500 outline-none"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Password Access</label>
                          <div className="relative">
                             <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={14} />
                             <input 
                               required
                               type="password"
                               placeholder="••••••••"
                               value={teamForm.password}
                               onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })}
                               className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-xs text-white focus:border-blue-500 outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Role Otoritas</label>
                          <div className="flex gap-2">
                             <select 
                                value={teamForm.role}
                                onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value as UserRole })}
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-xs text-white focus:border-blue-500 outline-none appearance-none"
                             >
                                <option value="admin staff">Admin Staff</option>
                                <option value="hrd">HRD Manager</option>
                             </select>
                             <button type="submit" className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/10">
                                <Plus size={18} />
                             </button>
                          </div>
                       </div>
                    </form>

                    <div className="bg-zinc-950/50 rounded-3xl border border-zinc-900 overflow-hidden">
                       <table className="w-full text-left">
                          <thead className="bg-zinc-900/30">
                             <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                <th className="p-6">Anggota Tim</th>
                                <th className="p-6">Role</th>
                                <th className="p-6">Status</th>
                                <th className="p-6 text-right">Aksi</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900">
                             {team.map(member => (
                                <tr key={member.id} className="group hover:bg-white/[0.02]">
                                   <td className="p-6">
                                      <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-500">
                                            {member.username.charAt(0)}
                                         </div>
                                         <div>
                                            <p className="text-sm font-bold text-white">{member.username}</p>
                                            <p className="text-[10px] text-zinc-600">{member.email}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="p-6">
                                      <span className={cn(
                                         "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                         member.role === 'hrd' ? "border-amber-500/20 text-amber-500" : "border-zinc-700 text-zinc-500"
                                      )}>{member.role}</span>
                                   </td>
                                   <td className="p-6">
                                      <div className="flex items-center gap-2 text-emerald-500 font-black text-[9px] uppercase">
                                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> TERVALIDASI
                                      </div>
                                   </td>
                                   <td className="p-6 text-right">
                                      <button 
                                        onClick={() => removeTeamMember(member.id!)}
                                        className="text-zinc-700 hover:text-red-500 transition-colors"
                                      >
                                         <Trash2 size={16} />
                                      </button>
                                   </td>
                                </tr>
                             ))}
                             {team.length === 0 && (
                                <tr>
                                   <td colSpan={4} className="p-10 text-center text-zinc-700 italic text-sm">
                                      Belum ada anggota tim tambahan
                                   </td>
                                </tr>
                             )}
                          </tbody>
                       </table>
                    </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Right Info Column */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-[#141417]/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
              <div className="flex items-start justify-between mb-8">
                 <ShieldCheck className="text-white" size={24} />
                 <span className="text-[9px] font-black tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full text-white">Owner Access</span>
              </div>
              <h4 className="text-xl font-serif italic text-zinc-300">Profil Administrator</h4>
              <div className="mt-4 flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <Users size={24} className="text-zinc-500" />
                 </div>
                 <div>
                    <p className="text-white font-bold">{profile.username}</p>
                    <p className="text-xs text-zinc-500">{profile.email}</p>
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-600/10">
              <UserPlus size={32} className="opacity-50 mb-6" />
              <h4 className="text-xl font-serif italic mb-2">Ekspansi Tim</h4>
              <p className="text-xs text-white/70 leading-relaxed font-medium">Tambahkan anggota tim untuk membantu manajemen tagihan dan pengadaan barang secara kolaboratif.</p>
              <div className="mt-6 pt-6 border-t border-white/10">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>Kuota Tim</span>
                    <span>5 / 10 Slot</span>
                 </div>
                 <div className="w-full h-1 bg-white/10 rounded-full mt-3">
                    <div className="w-1/2 h-full bg-white rounded-full shadow-lg" />
                 </div>
              </div>
           </div>

           <div className="bg-[#141417] border border-dashed border-zinc-800 rounded-3xl p-8 text-center">
              <Heart className="mx-auto text-amber-500/50 mb-4" size={20} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">System Version</p>
              <p className="text-lg font-serif italic text-zinc-400 mt-1">v1.2.0 Stable</p>
           </div>
        </div>
      </div>
    </div>
  );
}
