import React, { useState } from 'react';
import { UserProfile } from '../types';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { Shield, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function SettingsView({ profile }: { profile: UserProfile }) {
  const [newUsername, setNewUsername] = useState(profile.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage(null);
    
    try {
      // 1. Update Username if changed
      if (newUsername !== profile.username) {
        const q = query(collection(db, 'user_profiles'), where('username', '==', newUsername));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error('Username already taken.');
        
        await updateDoc(doc(db, 'user_profiles', profile.uid), {
          username: newUsername
        });
      }

      // 2. Update Password if provided
      if (newPassword) {
        if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        }
      }

      setMessage({ text: 'Security profiles updated successfully.', type: 'success' });
      setNewPassword('');
    } catch (err: any) {
      setMessage({ text: err.message || 'Update failed.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 font-sans p-4">
      <div className="bg-[#141417] border border-zinc-800 rounded-[3rem] p-12 overflow-hidden relative shadow-sm">
        {/* Decorative */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 blur-[100px] rounded-full"></div>
        
        <div className="flex items-center gap-6 mb-12 relative z-10">
           <div className="p-4 bg-zinc-900 rounded-[1.5rem] border border-zinc-800 text-white shadow-inner">
              <Shield size={32} className="text-amber-500" />
           </div>
           <div>
              <h3 className="text-3xl font-serif italic text-white tracking-tight">Security Credentials</h3>
              <p className="text-sm text-zinc-500 mt-1 italic uppercase tracking-wider">Modify your digital access keys</p>
           </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-10 relative z-10">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-3">
                    <UserIcon size={12} className="text-zinc-600" /> Identifier (Username)
                 </label>
                 <input 
                   type="text"
                   value={newUsername}
                   onChange={(e) => setNewUsername(e.target.value)}
                   className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:border-white transition-all font-medium text-sm"
                 />
                 <p className="text-[9px] text-zinc-600 italic">This is your primary login identifier within the cluster.</p>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-3">
                    <Lock size={12} className="text-zinc-600" /> New Cryptokey (Password)
                 </label>
                 <input 
                   type="password"
                   value={newPassword}
                   onChange={(e) => setNewPassword(e.target.value)}
                   placeholder="Leave blank to keep current"
                   className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none focus:border-white transition-all font-mono text-sm"
                 />
                 <p className="text-[9px] text-zinc-600 italic">Security recommendation: Minimum 8 characters alpha-numeric.</p>
              </div>
           </div>

           {message && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className={cn(
                 "p-5 rounded-2xl border flex items-center gap-4",
                 message.type === 'success' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-red-500/5 border-red-500/20 text-red-500"
               )}
             >
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <span className="text-xs font-bold uppercase tracking-wider">{message.text}</span>
             </motion.div>
           )}

           <div className="pt-6 border-t border-zinc-800/50">
              <button 
                disabled={isUpdating}
                className="px-10 py-4 bg-white text-black rounded-full font-black text-[11px] uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
              >
                {isUpdating ? 'Synchronizing...' : 'Commit Changes'}
              </button>
           </div>
        </form>
      </div>

      <div className="bg-zinc-950/50 border border-zinc-900 rounded-[2rem] p-8 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Environment: Production CLUSTER-A</p>
         </div>
         <p className="text-[10px] text-zinc-800 font-mono italic">UID: {profile.uid}</p>
      </div>
    </div>
  );
}
