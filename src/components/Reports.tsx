import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ItemReceipt, Bill, Distributor } from '../types';
import { formatCurrency } from '../lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, FileText, Download, PieChart as PieChartIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { motion } from 'motion/react';

export default function Reports({ profile, onNavigate }: { profile: UserProfile, onNavigate?: (view: 'bills') => void }) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [receipts, setReceipts] = useState<ItemReceipt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  
  const [monthRange, setMonthRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });

  useEffect(() => {
    const qDist = query(collection(db, 'distributors'), where('ownerId', '==', profile.ownerId));
    const qReceipts = query(collection(db, 'item_receipts'), where('ownerId', '==', profile.ownerId));
    const qBills = query(collection(db, 'bills'), where('ownerId', '==', profile.ownerId));

    const unsubDist = onSnapshot(qDist, (snap) => setDistributors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Distributor))));
    const unsubReceipts = onSnapshot(qReceipts, (snap) => setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemReceipt))));
    const unsubBills = onSnapshot(qBills, (snap) => setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill))));

    return () => { unsubDist(); unsubReceipts(); unsubBills(); };
  }, [profile.ownerId]);

  // Calculations
  const totalIncoming = receipts.reduce((acc, curr) => acc + curr.amount, 0);
  const totalBills = bills.reduce((acc, curr) => acc + curr.amount, 0);
  const unpaidBills = bills.filter(b => b.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const paidBills = totalBills - unpaidBills;

  const currentMonthReceipts = receipts.filter(r => isWithinInterval(new Date(r.date), monthRange));
  const monthIncoming = currentMonthReceipts.reduce((acc, curr) => acc + curr.amount, 0);

  // Memoized stats to prevent recalculation on every minor state update
  const stats = React.useMemo(() => [
    { label: 'Total Barang Masuk', value: totalIncoming, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Total Tagihan', value: totalBills, icon: FileText, color: 'text-zinc-400 dark:text-zinc-400', bg: 'bg-zinc-200 dark:bg-zinc-800' },
    { label: 'Tagihan Tertunda', value: unpaidBills, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Tagihan Lunas', value: paidBills, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ], [totalIncoming, totalBills, unpaidBills, paidBills]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 400 } }
  };

  return (
    <div className="space-y-10 font-sans pb-10">
      {/* Metrics Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            variants={itemVariants}
            className="bg-zinc-100 dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group overflow-hidden relative"
          >
            <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:scale-125 transition-transform">
               <stat.icon size={120} />
            </div>
            <div className={`p-2.5 ${stat.bg} w-fit rounded-xl mb-6 relative z-10`}>
              <stat.icon className={stat.color} size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 relative z-10">{stat.label}</p>
            <p className="text-3xl font-light text-zinc-900 dark:text-white tracking-tight relative z-10">{formatCurrency(stat.value)}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Monthly Summary Section */}
        <div className="lg:col-span-12 bg-zinc-100 dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-10">
             <BarChart3 size={200} />
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 mb-10">
            <div>
              <h3 className="text-2xl font-serif text-zinc-900 dark:text-white italic">Wawasan Bulanan</h3>
              <p className="text-sm text-zinc-500 mt-1 italic">Alur keuangan untuk {format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <button className="flex items-center gap-3 px-6 py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all shadow-lg shadow-white/5">
              <Download size={14} /> Laporan Audit Lengkap
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
             <div className="lg:col-span-2 space-y-8">
                <div className="space-y-2">
                   <div className="flex items-end gap-3">
                      <span className="text-6xl font-light text-white tracking-tighter">{formatCurrency(monthIncoming)}</span>
                      <span className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px] pb-4">Nilai Masuk</span>
                   </div>
                   <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (monthIncoming / Math.max(1, totalIncoming)) * 100)}%` }}
                        transition={{ duration: 1.5, ease: 'circOut' }}
                        className="bg-amber-500 h-full shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                      ></motion.div>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
                   <div className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-[1.5rem]">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Transaksi</p>
                      <p className="text-2xl font-light text-white">{currentMonthReceipts.length}</p>
                   </div>
                   <div className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-[1.5rem]">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Indeks Kesehatan</p>
                      <p className="text-2xl font-light text-emerald-500 italic">Prima</p>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                   <PieChartIcon className="text-zinc-600" size={16} />
                   <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Pangsa Distributor</h4>
                </div>
                <div className="space-y-5">
                   {distributors.slice(0, 4).map(d => {
                     const distReceipts = receipts.filter(r => r.distributorId === d.id);
                     const distTotal = distReceipts.reduce((acc, curr) => acc + curr.amount, 0);
                     const percentage = totalIncoming > 0 ? (distTotal / totalIncoming) * 100 : 0;
                     
                     return (
                       <div key={d.id} className="group">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-wider">{d.name}</span>
                             <span className="text-[10px] font-mono text-zinc-600">{percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden border border-zinc-800/30">
                             <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className="bg-zinc-700 group-hover:bg-amber-500 h-full transition-all" 
                             ></motion.div>
                          </div>
                       </div>
                     );
                   })}
                </div>
             </div>
          </div>
        </div>

        {/* Action Needed Alert */}
        {bills.filter(b => b.status === 'pending').length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-12 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <AlertCircle size={100} />
             </div>
             <div className="flex items-center gap-6 relative z-10 text-center md:text-left">
                <div className="p-4 bg-amber-500 text-black rounded-2xl shadow-xl shadow-amber-500/20">
                   <AlertCircle size={28} />
                </div>
                <div>
                   <h4 className="text-xl font-serif italic text-white">Perhatian: Kewajiban Tertunda</h4>
                   <p className="text-sm text-amber-500/70 mt-1">
                     Ada {bills.filter(b => b.status === 'pending').length} kewajiban pelunasan yang memerlukan audit segera.
                   </p>
                </div>
             </div>
             <div className="flex flex-col items-end gap-2 relative z-10">
                <span className="text-2xl font-light text-white tracking-tight">{formatCurrency(unpaidBills)}</span>
                <button 
                  onClick={() => onNavigate?.('bills')}
                  className="px-8 py-3 bg-amber-500 text-black rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10"
                >
                   Audit Kewajiban
                </button>
             </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
