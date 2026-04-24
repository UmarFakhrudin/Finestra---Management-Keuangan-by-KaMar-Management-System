import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Bill, UserProfile } from '../types';
import { Bell, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { format, isBefore, isAfter, addDays, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';

export default function NotificationCenter({ profile, onNavigate }: { profile: UserProfile, onNavigate: (view: 'bills') => void }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bills'),
      where('ownerId', '==', profile.ownerId),
      where('status', '==', 'pending'),
      orderBy('dueDate', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    });

    return () => unsub();
  }, [profile.ownerId]);

  const today = startOfDay(new Date());
  const next7Days = addDays(today, 7);

  const notifications = bills.filter(bill => {
    if (!bill.dueDate) return false;
    const dueDate = new Date(bill.dueDate);
    return isBefore(dueDate, next7Days);
  });

  const overdueCount = notifications.filter(n => n.dueDate && isBefore(new Date(n.dueDate), today)).length;
  const upcomingCount = notifications.length - overdueCount;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-3 rounded-xl transition-all relative group",
          isOpen ? "bg-white text-black" : "bg-zinc-900/50 text-zinc-500 hover:text-zinc-200 border border-zinc-800"
        )}
      >
        <Bell size={18} />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-lg border-2 border-[#09090b]">
            {notifications.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-96 bg-[#141417] border border-zinc-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800/50 bg-zinc-900/30">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-serif italic text-white tracking-tight">Pusat Notifikasi</h3>
                  <div className="flex gap-2">
                    {overdueCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black uppercase rounded-full border border-red-500/20">
                        {overdueCount} Terlambat
                      </span>
                    )}
                    {upcomingCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded-full border border-amber-500/20">
                        {upcomingCount} Akan Datang
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-zinc-600 font-serif italic text-sm">Tidak ada peringatan tagihan aktif</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30">
                    {notifications.map((bill) => {
                      const isOverdue = bill.dueDate && isBefore(new Date(bill.dueDate), today);
                      return (
                        <div key={bill.id} className="p-4 hover:bg-zinc-900/50 transition-colors group">
                          <div className="flex gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                              isOverdue ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {isOverdue ? <AlertTriangle size={18} /> : <Clock size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-bold text-white truncate pr-2">{bill.itemName}</p>
                                <p className="text-xs font-black text-white shrink-0">{formatCurrency(bill.amount)}</p>
                              </div>
                              <p className="text-[10px] text-zinc-500 mb-2 truncate italic">
                                Jatuh tempo: {bill.dueDate ? format(new Date(bill.dueDate), 'dd MMM yyyy') : '-'}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                  isOverdue ? "text-red-500 bg-red-500/5 border border-red-500/20" : "text-amber-500 bg-amber-500/5 border border-amber-500/20"
                                )}>
                                  {isOverdue ? 'Jatuh Tempo Terlewati' : 'Mendekati Jatuh Tempo'}
                                </span>
                                <button 
                                  onClick={() => { onNavigate('bills'); setIsOpen(false); }}
                                  className="text-[9px] font-bold text-zinc-600 hover:text-white flex items-center gap-1 transition-colors uppercase tracking-widest"
                                >
                                  Cek Detail <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-900/30 border-t border-zinc-800/50">
                <button 
                  onClick={() => { onNavigate('bills'); setIsOpen(false); }}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Lihat Semua Tagihan
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
