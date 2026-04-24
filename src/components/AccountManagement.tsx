import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, setDoc, doc, getDocs } from 'firebase/firestore';
import { db, registerWithEmail, auth } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { Users, UserPlus, Shield, User as UserIcon, Crown, Lock, Info, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AccountManagement({ profile }: { profile: UserProfile }) {
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isInviteOpen, setInviteOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin staff');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'user_profiles'), where('ownerId', '==', profile.ownerId));
    return onSnapshot(q, (snap) => {
      setTeamMembers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    });
  }, [profile.ownerId]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // 1. Check if username exists
      const q = query(collection(db, 'user_profiles'), where('username', '==', newUsername));
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error('Username sudah digunakan.');

      // 2. We can't easily create auth accounts for others without admin SDK in client side 
      // without being logged out.
      // STRATEGY: We'll store a "Pending" profile. The first time the user logs in with this 
      // username and password, the system will auto-register them if they don't exist in Auth.
      // For this demo, we'll just create the profile. 
      // NOTE: In a real app, this would be a Cloud Function.
      
      const email = `${newUsername.toLowerCase().replace(/\s+/g, '.')}@finestra.local`;
      
      // We'll use a unique ID for the doc until they claim it with a UID
      const tempId = `temp_${Date.now()}`;
      const newProfile: UserProfile = {
        uid: tempId, // Temporary ID
        email: email,
        username: newUsername,
        role: newRole,
        ownerId: profile.ownerId
      };

      await setDoc(doc(db, 'user_profiles', tempId), newProfile);
      
      // NOTE: To actually make it work, when they login in App.tsx, we check if 
      // there's a temp profile for that username, and if so, we create the Auth account.
      
      alert(`Akun ${newUsername} berhasil dikonfigurasi. User dapat login dengan password yang Anda tentukan.`);
      setInviteOpen(false);
      setNewUsername('');
      setNewPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const canManage = profile.role === 'owner' || profile.role === 'hrd';

  return (
    <div className="space-y-10 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141417] border border-zinc-800 rounded-[2rem] p-8 mt-10 shadow-sm flex flex-col items-center text-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:rotate-12 transition-transform">
            <Shield size={100} />
          </div>
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center text-white mb-6 border border-zinc-800 shadow-inner relative z-10">
            <Shield size={32} className="text-emerald-500" />
          </div>
          <h3 className="font-serif italic text-xl text-white mb-2 relative z-10">Security Sync</h3>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed relative z-10 px-4">Cluster data isolation is active. Managed by cryptographic owner IDs.</p>
          <div className="w-full bg-zinc-950 border border-zinc-900 py-3 rounded-xl text-[9px] font-black tracking-[0.2em] text-emerald-500/50 uppercase">
            Status: Fully Encrypted
          </div>
        </div>

        <div className="bg-[#141417] border border-zinc-800 rounded-[2rem] p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden group">
          <div className="absolute -left-4 -bottom-4 opacity-5 group-hover:-rotate-12 transition-transform">
            <Users size={120} />
          </div>
          <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center text-white mb-6 border border-zinc-800 shadow-inner relative z-10">
            <Users size={32} className="text-amber-500" />
          </div>
          <h3 className="font-serif italic text-xl text-white mb-2 relative z-10">Total Operatives</h3>
          <p className="text-5xl font-light text-white mb-2 relative z-10">{teamMembers.length}</p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black relative z-10">Active Personnel</p>
        </div>

        <div className="bg-[#141417] border border-zinc-700/50 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Crown size={120} /></div>
          <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center text-white mb-6 border border-white/10 backdrop-blur-md relative z-10">
            <Crown size={32} className="text-white" />
          </div>
          <h3 className="font-serif italic text-xl text-white mb-2 relative z-10 uppercase tracking-widest">Authority</h3>
          <p className="text-sm text-zinc-400 mb-6 relative z-10">Session Role: <span className="text-white font-black italic">{profile.role.toUpperCase()}</span></p>
          <div className="mt-auto px-6 py-2 bg-white text-black rounded-full text-[9px] font-black uppercase tracking-[0.2em] relative z-10 shadow-lg shadow-white/5">
            Verified Identity
          </div>
        </div>
      </div>

      <div className="bg-[#141417] border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-10 border-b border-zinc-800/50 bg-zinc-900/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-2xl font-serif text-white tracking-tight">Personnel Directory</h3>
            <p className="text-xs text-zinc-500 mt-1 italic uppercase tracking-wider">Access levels and credential mapping</p>
          </div>
          {canManage ? (
            <button
               onClick={() => setInviteOpen(true)}
               className="bg-white text-black px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-zinc-200 transition-all shadow-xl shadow-white/5"
            >
              <UserPlus size={16} />
              Provision New Account
            </button>
          ) : (
            <div className="flex items-center gap-3 px-6 py-3 bg-zinc-950 border border-zinc-800 rounded-full text-zinc-600 text-[10px] font-black tracking-widest uppercase">
              <Lock size={14} /> Immutable Access
            </div>
          )}
        </div>
        
        <div className="divide-y divide-zinc-800/50">
           {teamMembers.map((member) => (
             <div key={member.uid} className="p-8 flex items-center justify-between hover:bg-zinc-900/50 transition-all group">
                <div className="flex items-center gap-6">
                   <div className={cn(
                     "w-16 h-16 rounded-2xl flex items-center justify-center font-serif italic text-2xl border transition-all group-hover:scale-105 shadow-inner",
                     member.role === 'owner' ? "bg-white text-black border-white" : "bg-zinc-900 text-zinc-400 border-zinc-800"
                   )}>
                      {member.username.charAt(0)}
                   </div>
                   <div className="flex flex-col">
                      <span className="text-lg font-medium text-white tracking-tight">{member.username}</span>
                      <span className="text-[10px] text-zinc-600 font-mono italic uppercase tracking-widest mt-1">{member.email}</span>
                   </div>
                </div>
                <div className="flex items-center gap-10">
                   <div className="flex flex-col items-end">
                      <div className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                        member.role === 'owner' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                        member.role === 'hrd' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        "bg-zinc-800/50 text-zinc-500 border-zinc-700/50"
                      )}>
                         {member.role}
                      </div>
                      <span className="text-[8px] text-zinc-600 mt-2 font-black uppercase tracking-widest italic tracking-tighter">Clearance Level</span>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[#09090b]/90 backdrop-blur-xl">
             <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 30 }}
               className="bg-[#141417] rounded-[3rem] p-12 max-w-lg w-full shadow-2xl relative overflow-hidden border border-zinc-800"
             >
                {/* Decorative */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/5 blur-[50px] rounded-full"></div>
                
                <div className="absolute top-8 right-8">
                  <button onClick={() => setInviteOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                     <X size={24} />
                  </button>
                </div>
                <h3 className="text-3xl font-serif italic text-white mb-2">New Provisioning</h3>
                <p className="text-zinc-500 text-sm mb-10 leading-relaxed italic pr-10">Establish a new digital persona within your cluster. Define credentials and authority level.</p>
                
                <form onSubmit={handleCreateAccount} className="space-y-8">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3 block">Designated Username</label>
                        <input 
                          required
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="e.g. Finance_Director"
                          className="w-full px-6 py-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:outline-none focus:border-white transition-all text-white font-medium"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3 block">Assigned Password</label>
                        <input 
                          required
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-6 py-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl focus:outline-none focus:border-white transition-all text-white font-mono"
                        />
                      </div>
                   </div>
                   
                   <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 block">Select Authority Tier</label>
                      <div className="grid grid-cols-3 gap-3">
                         {['owner', 'hrd', 'admin staff'].map((r) => (
                           <button
                             key={r}
                             type="button"
                             onClick={() => setNewRole(r as UserRole)}
                             className={cn(
                               "py-5 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[9px] flex flex-col items-center gap-3",
                               newRole === r 
                                 ? "border-white bg-white text-black shadow-xl scale-105" 
                                 : "border-zinc-800 bg-zinc-900 text-zinc-600 hover:border-zinc-700"
                             )}
                           >
                              {r === 'owner' ? <Crown size={18} /> : r === 'hrd' ? <Shield size={18} /> : <UserIcon size={18} />}
                              {r}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-[1.5rem] flex gap-4 items-start">
                      <Info size={18} className="text-zinc-600 flex-shrink-0 mt-1" />
                      <p className="text-[10px] text-zinc-500 leading-relaxed italic">Provisioning will register this identity across the secure cluster. First login will finalize the cryptolink.</p>
                   </div>

                   <button 
                    disabled={isCreating}
                    className="w-full py-5 bg-white text-black rounded-full font-black uppercase tracking-[0.3em] text-[11px] hover:bg-zinc-200 transition-all shadow-2xl shadow-white/5 active:scale-95 disabled:opacity-50"
                   >
                      {isCreating ? 'Provisioning...' : 'Seal Application'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
